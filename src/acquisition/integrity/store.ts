import { randomUUID } from 'node:crypto'
import { access, mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

import type { CallLedgerRecord, JsonObject, JsonValue, PlannedRequest, StoreRoots, StoredResponseResult } from '../contracts.js'
import { canonicalJson, fingerprintRequest, hashCanonicalObject, sha256Hex } from './identity.js'
import { appendLedgerRecord, findCompletedRequest, readLedger, recoverCrashPartialLedgerTail } from './ledger.js'

export interface StoreFixtureResponseInput {
  roots: StoreRoots
  ledgerPath: string
  request: PlannedRequest
  rawBody: string | Uint8Array
  normalize?: (exactRawBody: Uint8Array) => JsonValue
  extractResponseMetadata?: (normalized: JsonValue) => {
    returnedCreditMetadata?: JsonObject | null
    returnedRateMetadata?: JsonObject | null
  }
  plannedCreditEstimate: number
  maximumAllowedCredits: number
  attemptNumber: number
  startedAtUtc: string
  completedAtUtc: string
  httpStatus: number
  redactedRequestMetadata?: JsonObject
  providerRequestId?: string | null
  returnedCreditMetadata?: JsonObject | null
  returnedRateMetadata?: JsonObject | null
  normalizerVersion: string
  finalStatus?: 'COMPLETED' | 'SIMULATED' | 'FAILED'
  decision?: CallLedgerRecord['decision']
  publicExportStatus?: CallLedgerRecord['publicExportStatus']
}

export interface ContentStoreVerification {
  ok: boolean
  checkedRecords: number
  checkedRawObjects: number
  checkedNormalizedObjects: number
  errors: string[]
}

export interface ReusableStoredResponse {
  rawBody: Uint8Array
  ledgerRecord: CallLedgerRecord
}

function rawPath(root: string, hash: string): string {
  return resolve(root, 'raw', 'sha256', hash.slice(0, 2), `${hash}.json.gz`)
}

function normalizedPath(root: string, hash: string): string {
  return resolve(root, 'normalized', 'sha256', hash.slice(0, 2), `${hash}.json`)
}

function resolveRecordedLocation(value: string, roots: StoreRoots): string {
  if (value.startsWith('<REPOSITORY>/')) return resolve(process.cwd(), value.slice('<REPOSITORY>/'.length))
  if (value.startsWith('<PRIVATE_STORE>/')) return resolve(dirname(roots.primaryRoot), value.slice('<PRIVATE_STORE>/'.length))
  return resolve(value)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function atomicWrite(path: string, bytes: Uint8Array, verifyExisting: () => Promise<void>): Promise<boolean> {
  if (await pathExists(path)) {
    await verifyExisting()
    return true
  }

  const parent = dirname(path)
  await mkdir(parent, { recursive: true })
  const temporary = resolve(parent, `.${path.split('/').at(-1) ?? 'content'}.${process.pid}.${randomUUID()}.tmp`)
  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    handle = await open(temporary, 'wx')
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close()
    handle = null

    if (await pathExists(path)) {
      await verifyExisting()
      await rm(temporary, { force: true })
      return true
    }

    await rename(temporary, path)
    await syncDirectory(parent)
    return false
  } catch (error) {
    if (handle !== null) await handle.close().catch(() => undefined)
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

async function readVerifiedRaw(path: string, expectedHash: string): Promise<Uint8Array> {
  let exactBody: Uint8Array
  try {
    exactBody = gunzipSync(await readFile(path))
  } catch {
    throw new Error(`Content-store corruption: unreadable raw object ${expectedHash}`)
  }
  if (sha256Hex(exactBody) !== expectedHash) throw new Error(`Content-store corruption: raw hash mismatch ${expectedHash}`)
  return exactBody
}

async function verifyRaw(path: string, expectedHash: string): Promise<void> {
  await readVerifiedRaw(path, expectedHash)
}

async function verifyNormalized(path: string, expectedHash: string): Promise<void> {
  const bytes = await readFile(path)
  if (sha256Hex(bytes) !== expectedHash) throw new Error(`Content-store corruption: normalized hash mismatch ${expectedHash}`)
}

function makeBaseRecord(input: StoreFixtureResponseInput, sequence: number, requestFingerprint: string): CallLedgerRecord {
  return {
    schemaVersion: '1.0.0',
    callSequence: sequence,
    candidateId: input.request.candidateId,
    purposeId: input.request.purposeId,
    endpoint: input.request.endpoint,
    requestFingerprint,
    canonicalRequestHash: hashCanonicalObject(input.request.requestBody),
    plannedCreditEstimate: input.plannedCreditEstimate,
    maximumAllowedCredits: input.maximumAllowedCredits,
    attemptNumber: input.attemptNumber,
    status: 'IN_PROGRESS',
    startedAtUtc: input.startedAtUtc,
    completedAtUtc: null,
    httpStatus: null,
    redactedRequestMetadata: input.redactedRequestMetadata ?? {
      apiVersion: input.request.apiVersion,
      endpointClass: input.request.endpointClass,
      page: input.request.pagination.page,
      cursorPresent: input.request.pagination.cursor !== null,
      deliberateRefresh: input.request.refresh !== null,
    },
    providerRequestId: input.providerRequestId ?? null,
    returnedCreditMetadata: null,
    returnedRateMetadata: null,
    rawSha256: null,
    rawStorageLocations: null,
    normalizedSha256: null,
    normalizerVersion: input.normalizerVersion,
    decision: { result: 'PENDING', reason: 'RAW_STORAGE_PENDING' },
    publicExportStatus: 'NOT_EVALUATED',
  }
}

export async function beginRequestAttempt(input: StoreFixtureResponseInput): Promise<CallLedgerRecord> {
  await recoverCrashPartialLedgerTail(input.ledgerPath)
  const records = await readLedger(input.ledgerPath)
  const record = makeBaseRecord(input, records.length + 1, fingerprintRequest(input.request))
  await appendLedgerRecord(input.ledgerPath, record)
  return record
}

export async function failRequestAttempt(
  input: StoreFixtureResponseInput,
  reason = 'TRANSPORT_FAILURE_NO_RESPONSE',
): Promise<CallLedgerRecord> {
  await recoverCrashPartialLedgerTail(input.ledgerPath)
  const records = await readLedger(input.ledgerPath)
  const record: CallLedgerRecord = {
    ...makeBaseRecord(input, records.length + 1, fingerprintRequest(input.request)),
    status: 'FAILED',
    completedAtUtc: input.completedAtUtc,
    decision: { result: 'REJECTED', reason },
  }
  await appendLedgerRecord(input.ledgerPath, record)
  return record
}

async function appendReuse(
  input: StoreFixtureResponseInput,
  sequence: number,
  completed: CallLedgerRecord,
): Promise<CallLedgerRecord> {
  if (completed.rawSha256 === null || completed.rawStorageLocations === null || completed.normalizedSha256 === null) {
    throw new Error('Completed request is missing durable storage metadata')
  }
  const primary = rawPath(input.roots.primaryRoot, completed.rawSha256)
  const mirror = rawPath(input.roots.mirrorRoot, completed.rawSha256)
  if (resolveRecordedLocation(completed.rawStorageLocations.primary, input.roots) !== primary || resolveRecordedLocation(completed.rawStorageLocations.mirror, input.roots) !== mirror) {
    throw new Error('Content-store corruption: ledger storage location mismatch')
  }
  await verifyRaw(primary, completed.rawSha256)
  await verifyRaw(mirror, completed.rawSha256)
  await verifyNormalized(normalizedPath(input.roots.primaryRoot, completed.normalizedSha256), completed.normalizedSha256)

  const reused: CallLedgerRecord = {
    ...makeBaseRecord(input, sequence, completed.requestFingerprint),
    status: 'REUSED',
    completedAtUtc: input.completedAtUtc,
    httpStatus: completed.httpStatus,
    returnedCreditMetadata: completed.returnedCreditMetadata,
    returnedRateMetadata: completed.returnedRateMetadata,
    rawSha256: completed.rawSha256,
    rawStorageLocations: { primary, mirror },
    normalizedSha256: completed.normalizedSha256,
    decision: { result: 'ACCEPTED', reason: 'COMPLETED_REQUEST_REUSED_WITHOUT_NEW_CALL' },
  }
  await appendLedgerRecord(input.ledgerPath, reused)
  return reused
}

export async function storeFixtureResponse(input: StoreFixtureResponseInput): Promise<StoredResponseResult> {
  if (resolve(input.roots.primaryRoot) === resolve(input.roots.mirrorRoot)) {
    throw new Error('Primary and mirror roots must be distinct')
  }
  await recoverCrashPartialLedgerTail(input.ledgerPath)
  const requestFingerprint = fingerprintRequest(input.request)
  let records = await readLedger(input.ledgerPath)
  const completed = findCompletedRequest(records, requestFingerprint)
  if (completed !== null) {
    const reused = await appendReuse(input, records.length + 1, completed)
    return {
      disposition: 'REUSED',
      rawSha256: reused.rawSha256 as string,
      normalizedSha256: reused.normalizedSha256 as string,
      primaryPath: reused.rawStorageLocations?.primary as string,
      mirrorPath: reused.rawStorageLocations?.mirror as string,
      ledgerRecord: reused,
    }
  }

  const previousAttemptExists = records.some((record) => record.requestFingerprint === requestFingerprint)
  if (!previousAttemptExists) {
    await appendLedgerRecord(input.ledgerPath, makeBaseRecord(input, records.length + 1, requestFingerprint))
    records = await readLedger(input.ledgerPath)
  }

  const exactRaw = typeof input.rawBody === 'string' ? Buffer.from(input.rawBody, 'utf8') : Buffer.from(input.rawBody)
  const rawSha256 = sha256Hex(exactRaw)
  const compressed = gzipSync(exactRaw, { level: 9 })
  const primary = rawPath(input.roots.primaryRoot, rawSha256)
  const mirror = rawPath(input.roots.mirrorRoot, rawSha256)
  await atomicWrite(primary, compressed, () => verifyRaw(primary, rawSha256))
  await atomicWrite(mirror, compressed, () => verifyRaw(mirror, rawSha256))

  let normalized: JsonValue
  try {
    normalized = input.normalize === undefined ? JSON.parse(exactRaw.toString('utf8')) as JsonValue : input.normalize(exactRaw)
  } catch {
    throw new Error(`Normalization failed after durable raw storage ${rawSha256}`)
  }
  const normalizedBytes = Buffer.from(canonicalJson(normalized), 'utf8')
  const normalizedSha256 = sha256Hex(normalizedBytes)
  const normalizedLocation = normalizedPath(input.roots.primaryRoot, normalizedSha256)
  await atomicWrite(normalizedLocation, normalizedBytes, () => verifyNormalized(normalizedLocation, normalizedSha256))
  const extractedMetadata = input.extractResponseMetadata?.(normalized)

  const ledgerRecord: CallLedgerRecord = {
    ...makeBaseRecord(input, records.length + 1, requestFingerprint),
    status: input.finalStatus ?? 'COMPLETED',
    completedAtUtc: input.completedAtUtc,
    httpStatus: input.httpStatus,
    returnedCreditMetadata: input.returnedCreditMetadata ?? extractedMetadata?.returnedCreditMetadata ?? null,
    returnedRateMetadata: input.returnedRateMetadata ?? extractedMetadata?.returnedRateMetadata ?? null,
    rawSha256,
    rawStorageLocations: { primary, mirror },
    normalizedSha256,
    decision: input.decision ?? { result: input.finalStatus === 'FAILED' ? 'REJECTED' : 'ACCEPTED', reason: input.finalStatus === 'SIMULATED' ? 'FIXTURE_RESPONSE_DURABLY_STORED' : input.finalStatus === 'FAILED' ? 'HTTP_RESPONSE_REJECTED_AFTER_DURABLE_STORAGE' : 'RESPONSE_DURABLY_STORED' },
    publicExportStatus: input.publicExportStatus ?? 'NOT_EVALUATED',
  }
  await appendLedgerRecord(input.ledgerPath, ledgerRecord)

  return {
    disposition: previousAttemptExists ? 'RESUMED' : 'STORED',
    rawSha256,
    normalizedSha256,
    primaryPath: primary,
    mirrorPath: mirror,
    ledgerRecord,
  }
}

export async function loadReusableResponse(roots: StoreRoots, ledgerPath: string, request: PlannedRequest): Promise<ReusableStoredResponse | null> {
  if (resolve(roots.primaryRoot) === resolve(roots.mirrorRoot)) throw new Error('Primary and mirror roots must be distinct')
  await recoverCrashPartialLedgerTail(ledgerPath)
  const completed = findCompletedRequest(await readLedger(ledgerPath), fingerprintRequest(request))
  if (completed === null) return null
  if (completed.rawSha256 === null || completed.rawStorageLocations === null || completed.normalizedSha256 === null) throw new Error('Completed request is missing durable storage metadata')
  const primary = rawPath(roots.primaryRoot, completed.rawSha256)
  const mirror = rawPath(roots.mirrorRoot, completed.rawSha256)
  if (resolveRecordedLocation(completed.rawStorageLocations.primary, roots) !== primary || resolveRecordedLocation(completed.rawStorageLocations.mirror, roots) !== mirror) throw new Error('Content-store corruption: ledger storage location mismatch')
  const rawBody = await readVerifiedRaw(primary, completed.rawSha256)
  await verifyRaw(mirror, completed.rawSha256)
  await verifyNormalized(normalizedPath(roots.primaryRoot, completed.normalizedSha256), completed.normalizedSha256)
  return { rawBody, ledgerRecord: completed }
}

export async function verifyContentStore(roots: StoreRoots, ledgerPath: string): Promise<ContentStoreVerification> {
  const errors: string[] = []
  let records: CallLedgerRecord[]
  try {
    records = await readLedger(ledgerPath)
  } catch (error) {
    return { ok: false, checkedRecords: 0, checkedRawObjects: 0, checkedNormalizedObjects: 0, errors: [(error as Error).message] }
  }

  const rawHashes = new Set<string>()
  const normalizedHashes = new Set<string>()
  const unmatchedAttempts = new Map<string, CallLedgerRecord[]>()
  for (const record of records) {
    const attemptKey = `${record.requestFingerprint}:${record.attemptNumber}`
    if (record.status === 'IN_PROGRESS') {
      const pending = unmatchedAttempts.get(attemptKey) ?? []
      pending.push(record)
      unmatchedAttempts.set(attemptKey, pending)
    } else if (['COMPLETED', 'FAILED', 'SIMULATED'].includes(record.status)) {
      const pending = unmatchedAttempts.get(attemptKey) ?? []
      if (pending.length === 0) errors.push(`record ${record.callSequence}: terminal attempt has no matching start`)
      else pending.shift()
      unmatchedAttempts.set(attemptKey, pending)
    }
    if (record.rawSha256 === null || record.rawStorageLocations === null) continue
    const expectedPrimary = rawPath(roots.primaryRoot, record.rawSha256)
    const expectedMirror = rawPath(roots.mirrorRoot, record.rawSha256)
    if (resolveRecordedLocation(record.rawStorageLocations.primary, roots) !== expectedPrimary || resolveRecordedLocation(record.rawStorageLocations.mirror, roots) !== expectedMirror) {
      errors.push(`record ${record.callSequence}: storage location mismatch`)
      continue
    }
    if (!rawHashes.has(record.rawSha256)) {
      rawHashes.add(record.rawSha256)
      await verifyRaw(expectedPrimary, record.rawSha256).catch((error: Error) => errors.push(error.message))
      await verifyRaw(expectedMirror, record.rawSha256).catch((error: Error) => errors.push(error.message))
    }
    if (record.normalizedSha256 !== null && !normalizedHashes.has(record.normalizedSha256)) {
      normalizedHashes.add(record.normalizedSha256)
      await verifyNormalized(normalizedPath(roots.primaryRoot, record.normalizedSha256), record.normalizedSha256).catch((error: Error) => errors.push(error.message))
    }
  }
  for (const pending of unmatchedAttempts.values()) {
    for (const record of pending) errors.push(`record ${record.callSequence}: acquisition attempt is incomplete and resumable`)
  }

  return {
    ok: errors.length === 0,
    checkedRecords: records.length,
    checkedRawObjects: rawHashes.size * 2,
    checkedNormalizedObjects: normalizedHashes.size,
    errors,
  }
}
