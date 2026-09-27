import { mkdir, open, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { TextDecoder } from 'node:util'

import type { CallLedgerRecord, JsonObject, JsonValue } from '../contracts.js'

const LEDGER_KEYS = [
  'schemaVersion', 'callSequence', 'candidateId', 'purposeId', 'endpoint',
  'requestFingerprint', 'canonicalRequestHash', 'plannedCreditEstimate',
  'maximumAllowedCredits', 'attemptNumber', 'status', 'startedAtUtc',
  'completedAtUtc', 'httpStatus', 'redactedRequestMetadata', 'providerRequestId',
  'returnedCreditMetadata', 'returnedRateMetadata', 'rawSha256',
  'rawStorageLocations', 'normalizedSha256', 'normalizerVersion', 'decision',
  'publicExportStatus',
] as const

const FORBIDDEN_METADATA_KEY = /(?:api.?key|authorization|credential|password|secret|token|cookie)/i
const FORBIDDEN_METADATA_VALUE = /(?:\bBearer\s+\S+|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{16,})/i
const SHA256 = /^[a-f0-9]{64}$/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  return isObject(value) && Object.values(value).every(isJsonValue)
}

function isSafeMetadata(value: unknown): value is JsonObject {
  const inspect = (entry: unknown): boolean => {
    if (typeof entry === 'string') return !FORBIDDEN_METADATA_VALUE.test(entry)
    if (entry === null || typeof entry === 'boolean') return true
    if (typeof entry === 'number') return Number.isFinite(entry)
    if (Array.isArray(entry)) return entry.every(inspect)
    if (!isObject(entry)) return false
    return Object.entries(entry).every(([key, nested]) => !FORBIDDEN_METADATA_KEY.test(key) && inspect(nested))
  }
  return isObject(value) && isJsonValue(value) && inspect(value)
}

function isUtc(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && value.endsWith('Z')
}

function isNullableString(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0)
}

function fail(message: string): never {
  throw new TypeError(`Invalid ledger record: ${message}`)
}

export function validateLedgerRecord(value: unknown): CallLedgerRecord {
  if (!isObject(value) || !hasExactKeys(value, LEDGER_KEYS)) fail('schema keys do not match')
  if (value.schemaVersion !== '1.0.0') fail('unsupported schema version')
  if (!Number.isInteger(value.callSequence) || (value.callSequence as number) < 1) fail('callSequence must be a positive integer')

  for (const field of ['candidateId', 'purposeId', 'endpoint', 'normalizerVersion'] as const) {
    if (typeof value[field] !== 'string' || !(value[field] as string).trim()) fail(`${field} must be non-empty`)
  }
  if (!(value.endpoint as string).startsWith('/') || /[?#]/.test(value.endpoint as string)) fail('endpoint must be a path without query or fragment')

  if (typeof value.requestFingerprint !== 'string' || !SHA256.test(value.requestFingerprint)) fail('requestFingerprint must be SHA-256')
  if (typeof value.canonicalRequestHash !== 'string' || !SHA256.test(value.canonicalRequestHash)) fail('canonicalRequestHash must be SHA-256')
  if (!Number.isInteger(value.plannedCreditEstimate) || (value.plannedCreditEstimate as number) < 0) fail('plannedCreditEstimate must be a non-negative integer')
  if (!Number.isInteger(value.maximumAllowedCredits) || (value.maximumAllowedCredits as number) < 0) fail('maximumAllowedCredits must be a non-negative integer')
  if (!Number.isInteger(value.attemptNumber) || (value.attemptNumber as number) < 0) fail('attemptNumber must be a non-negative integer')

  const statuses = ['SIMULATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'REUSED']
  if (typeof value.status !== 'string' || !statuses.includes(value.status)) fail('unknown status')
  if (!isUtc(value.startedAtUtc)) fail('startedAtUtc must be UTC')
  if (!(value.completedAtUtc === null || isUtc(value.completedAtUtc))) fail('completedAtUtc must be UTC or null')
  if (value.completedAtUtc !== null && Date.parse(value.completedAtUtc as string) < Date.parse(value.startedAtUtc as string)) fail('completion precedes start')
  if (!(value.httpStatus === null || (Number.isInteger(value.httpStatus) && (value.httpStatus as number) >= 100 && (value.httpStatus as number) <= 599))) fail('httpStatus is invalid')
  if (!isSafeMetadata(value.redactedRequestMetadata)) fail('redacted request metadata is unsafe')
  if (!isNullableString(value.providerRequestId) || (typeof value.providerRequestId === 'string' && FORBIDDEN_METADATA_VALUE.test(value.providerRequestId))) fail('providerRequestId is invalid')
  if (!(value.returnedCreditMetadata === null || isSafeMetadata(value.returnedCreditMetadata))) fail('returnedCreditMetadata is unsafe')
  if (!(value.returnedRateMetadata === null || isSafeMetadata(value.returnedRateMetadata))) fail('returnedRateMetadata is unsafe')

  if (!(value.rawSha256 === null || (typeof value.rawSha256 === 'string' && SHA256.test(value.rawSha256)))) fail('rawSha256 is invalid')
  if (!(value.normalizedSha256 === null || (typeof value.normalizedSha256 === 'string' && SHA256.test(value.normalizedSha256)))) fail('normalizedSha256 is invalid')
  if (value.rawStorageLocations !== null) {
    if (!isObject(value.rawStorageLocations) || !hasExactKeys(value.rawStorageLocations, ['primary', 'mirror'])) fail('raw storage locations are invalid')
    if (typeof value.rawStorageLocations.primary !== 'string' || !value.rawStorageLocations.primary) fail('primary storage location is invalid')
    if (typeof value.rawStorageLocations.mirror !== 'string' || !value.rawStorageLocations.mirror) fail('mirror storage location is invalid')
  }

  if (!isObject(value.decision) || !hasExactKeys(value.decision, ['result', 'reason'])) fail('decision is invalid')
  if (!['ACCEPTED', 'REJECTED', 'PENDING'].includes(value.decision.result as string) || typeof value.decision.reason !== 'string' || !(value.decision.reason as string).trim() || FORBIDDEN_METADATA_VALUE.test(value.decision.reason as string)) fail('decision is invalid')
  if (!['NOT_EVALUATED', 'ALLOWED', 'REJECTED'].includes(value.publicExportStatus as string)) fail('publicExportStatus is invalid')

  const isDurable = value.rawSha256 !== null && value.rawStorageLocations !== null
  if (['SIMULATED', 'COMPLETED', 'REUSED'].includes(value.status as string) && (!isDurable || value.normalizedSha256 === null || value.completedAtUtc === null)) {
    fail('terminal records require durable primary, mirror, and normalized content')
  }
  if (value.status === 'IN_PROGRESS' && value.completedAtUtc !== null) fail('in-progress record cannot be completed')

  return value as unknown as CallLedgerRecord
}

export async function readLedger(ledgerPath: string): Promise<CallLedgerRecord[]> {
  let text: string
  try {
    text = await readFile(ledgerPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  if (text === '') return []
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  if (lines.some((line) => line.trim() === '')) throw new TypeError('Invalid ledger: blank JSONL record')

  const records = lines.map((line, index) => {
    try {
      return validateLedgerRecord(JSON.parse(line) as unknown)
    } catch (error) {
      throw new TypeError(`Invalid ledger line ${index + 1}: ${(error as Error).message}`, { cause: error })
    }
  })

  records.forEach((record, index) => {
    if (record.callSequence !== index + 1) throw new TypeError(`Invalid ledger line ${index + 1}: call sequence is not contiguous`)
  })
  return records
}

export interface LedgerTailRecoveryResult {
  recovered: boolean
  quarantinedPath: string | null
  recoveredByteLength: number
}

function parseCompleteLedgerPrefix(bytes: Uint8Array): CallLedgerRecord[] {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let text: string
  try {
    text = decoder.decode(bytes)
  } catch {
    throw new TypeError('Invalid ledger: complete records contain invalid UTF-8')
  }
  if (text === '') return []
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  if (lines.some((line) => line.trim() === '')) throw new TypeError('Invalid ledger: blank JSONL record')
  const records = lines.map((line, index) => {
    try {
      return validateLedgerRecord(JSON.parse(line) as unknown)
    } catch (error) {
      throw new TypeError(`Invalid ledger line ${index + 1}: ${(error as Error).message}`, { cause: error })
    }
  })
  records.forEach((record, index) => {
    if (record.callSequence !== index + 1) throw new TypeError(`Invalid ledger line ${index + 1}: call sequence is not contiguous`)
  })
  return records
}

/**
 * Repairs only a provably unterminated JSON-object tail. Complete lines are
 * validated before mutation; complete-but-un-terminated records and arbitrary
 * garbage fail closed. The exact partial bytes are copied to quarantine first.
 */
export async function recoverCrashPartialLedgerTail(
  ledgerPath: string,
  quarantineRoot = resolve(dirname(ledgerPath), 'recovery'),
): Promise<LedgerTailRecoveryResult> {
  let bytes: Buffer
  try {
    bytes = await readFile(ledgerPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { recovered: false, quarantinedPath: null, recoveredByteLength: 0 }
    throw error
  }
  if (bytes.length === 0 || bytes.at(-1) === 0x0a) {
    parseCompleteLedgerPrefix(bytes)
    return { recovered: false, quarantinedPath: null, recoveredByteLength: 0 }
  }

  const boundary = bytes.lastIndexOf(0x0a) + 1
  const prefix = bytes.subarray(0, boundary)
  const tail = bytes.subarray(boundary)
  const completeRecords = parseCompleteLedgerPrefix(prefix)
  let tailText: string | null = null
  try {
    tailText = new TextDecoder('utf-8', { fatal: true }).decode(tail)
  } catch {
    // A split UTF-8 code point is a provable crash-partial tail.
  }
  if (tailText !== null) {
    if (!tailText.trimStart().startsWith('{')) throw new TypeError('Invalid ledger: unterminated tail is not a partial JSON object')
    try {
      validateLedgerRecord(JSON.parse(tailText) as unknown)
      throw new TypeError('Invalid ledger: complete final record is missing its newline terminator')
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('missing its newline terminator')) throw error
      if (!(error instanceof SyntaxError)) throw new TypeError(`Invalid ledger: unterminated tail is not safely recoverable: ${(error as Error).message}`, { cause: error })
    }
  } else if (tail[0] !== 0x7b && tail[0] !== 0x20 && tail[0] !== 0x09) {
    throw new TypeError('Invalid ledger: invalid UTF-8 tail is not a partial JSON object')
  }

  await mkdir(quarantineRoot, { recursive: true })
  let quarantineIndex = 1
  let quarantinePath = resolve(quarantineRoot, `calls.partial-after-${completeRecords.length}.${quarantineIndex}.bin`)
  let quarantineHandle: Awaited<ReturnType<typeof open>>
  while (true) {
    try {
      quarantineHandle = await open(quarantinePath, 'wx')
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      quarantineIndex += 1
      quarantinePath = resolve(quarantineRoot, `calls.partial-after-${completeRecords.length}.${quarantineIndex}.bin`)
    }
  }
  try {
    await quarantineHandle.writeFile(tail)
    await quarantineHandle.sync()
  } finally {
    await quarantineHandle.close()
  }
  const ledgerHandle = await open(ledgerPath, 'r+')
  try {
    await ledgerHandle.truncate(boundary)
    await ledgerHandle.sync()
  } finally {
    await ledgerHandle.close()
  }
  return { recovered: true, quarantinedPath: quarantinePath, recoveredByteLength: tail.length }
}

export async function appendLedgerRecord(ledgerPath: string, record: CallLedgerRecord): Promise<void> {
  validateLedgerRecord(record)
  const records = await readLedger(ledgerPath)
  if (record.callSequence !== records.length + 1) throw new TypeError('Ledger append refused: call sequence is not next')

  await mkdir(dirname(ledgerPath), { recursive: true })
  const handle = await open(ledgerPath, 'a')
  try {
    await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export function findCompletedRequest(records: readonly CallLedgerRecord[], requestFingerprint: string): CallLedgerRecord | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]
    if (
      record !== undefined
      && record.requestFingerprint === requestFingerprint
      && ['COMPLETED', 'REUSED', 'SIMULATED'].includes(record.status)
      && record.rawSha256 !== null
      && record.rawStorageLocations !== null
      && record.normalizedSha256 !== null
    ) return record
  }
  return null
}
