import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import type { CallLedgerRecord, JsonObject, PlannedRequest, RequestAllowance } from '../../src/acquisition/contracts.js'
import { withExplicitCredential } from '../../src/acquisition/integrity/credential.js'
import { hashCanonicalObject, sha256Hex } from '../../src/acquisition/integrity/identity.js'
import { readLedger } from '../../src/acquisition/integrity/ledger.js'
import { verifyContentStore } from '../../src/acquisition/integrity/store.js'
import { LiveAcquisitionSession, withExclusiveRunLock, type LiveEndpointPolicy } from '../../src/acquisition/live/executor.js'
import { createNansenTransport } from '../../src/acquisition/live/transport.js'
import { assertCleanGitInputs, fail, printReport, readJson, redactPrivatePaths, resolveCredentialSource, resolvePrivateStoreRoot, writeJsonExclusive } from './common.js'

const candidateId = 'EULER_2023_FALSE_EXIT_CLOSURE'
const reportPath = 'artifacts/g5/EULER_CLOSURE_AUTHORIZATION_REPORT.json'
const resultPath = 'artifacts/g5/EULER_EVIDENCE_CLOSURE_REPORT.json'
const earlyEngine = '0xebc29199c817dc47ba12e3f86102564d640cbf99'
const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f'
const exactNetDai = '8877507.348306697'
const windowStart = '2023-03-13T08:45:00Z'
const windowEnd = '2023-03-13T11:45:00Z'
const earlyEventTime = Date.parse('2023-03-13T08:50:59Z')
const convergenceTime = Date.parse('2023-03-13T11:38:11Z')
export const closureExecutableInputs = [
  'scripts/acquisition/g5-euler-closure.ts', 'scripts/acquisition/common.ts',
  'src/acquisition/contracts.ts', 'src/acquisition/integrity/credential.ts',
  'src/acquisition/integrity/governor.ts', 'src/acquisition/integrity/identity.ts',
  'src/acquisition/integrity/ledger.ts', 'src/acquisition/integrity/retry.ts',
  'src/acquisition/integrity/store.ts', 'src/acquisition/live/executor.ts',
  'src/acquisition/live/transport.ts', 'src/acquisition/config/g5-euler-closure-allowance.json',
  'src/acquisition/config/nansen-endpoints.json', 'AGENTS.md',
] as const

interface EndpointConfig { endpoints: Array<LiveEndpointPolicy & { method: 'GET' | 'POST' }> }
interface AuthorizationReport {
  schemaVersion: '1.0.0'
  authorizationId: string
  generatedAtUtc: string
  reviewedCommit: string
  reviewedTree: string
  snapshots: Record<string, string>
  plannedUse: { maximumAttempts: number; maximumCredits: number; plannedRequests: number; plannedCredits: number }
  credentialStatus: 'NOT_RESOLVED_BY_SEQUENCE'
  privateStore: '<PRIVATE_STORE>'
  checks: Record<string, boolean>
  AUTHORIZED_TO_ISSUE: boolean
  verificationSha256: string
}

export interface StateRow { timestamp: string; amount: number }
export interface StateAssessment {
  disposition: 'CLEAN_HISTORICAL_STATE' | 'TRANSACTION_DERIVED_NET_STATE_FALLBACK'
  acceptedRows: StateRow[]
  negativeRowsOmitted: number
  reason: string
}

function endpoint(config: EndpointConfig): LiveEndpointPolicy {
  const matches = config.endpoints.filter(({ endpoint }) => endpoint === '/api/v1/profiler/address/historical-balances')
  if (matches.length !== 1) throw new Error('Reviewed historical-balance endpoint policy is missing or ambiguous')
  return matches[0]!
}

export function closureRequest(policy: LiveEndpointPolicy): PlannedRequest {
  const requestBody = { address: earlyEngine, chain: 'ethereum', date: { from: windowStart, to: windowEnd }, pagination: { page: 1, per_page: 100 } }
  return { identityVersion: '1.0.0', endpoint: policy.endpoint, endpointClass: policy.endpointClass, apiVersion: policy.apiVersion, requestBody, candidateId, purposeId: 'clean-early-engine-dai-state', temporalWindow: { start: windowStart, end: windowEnd }, normalizationContractVersion: 'g5-nansen-1.0.0', pagination: { page: 1, cursor: null }, refresh: null }
}

function numericMetadata(record: CallLedgerRecord, name: string): number | null {
  const value = record.returnedCreditMetadata?.[name]
  return (typeof value === 'string' || typeof value === 'number') && Number.isFinite(Number(value)) ? Number(value) : null
}

export function hasDurableSemanticResponse(records: CallLedgerRecord[], request: PlannedRequest): boolean {
  return records.some((record) => ['COMPLETED', 'FAILED'].includes(record.status)
    && record.rawSha256 !== null
    && record.endpoint === request.endpoint
    && record.canonicalRequestHash === hashCanonicalObject(request.requestBody))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseUtc(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value
  const parsed = Date.parse(candidate)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

export function assessHistoricalState(body: unknown): StateAssessment {
  if (!isRecord(body) || !Array.isArray(body.data)) return { disposition: 'TRANSACTION_DERIVED_NET_STATE_FALLBACK', acceptedRows: [], negativeRowsOmitted: 0, reason: 'Provider response did not contain reviewed historical-balance rows.' }
  const daiRows = body.data.flatMap((value): StateRow[] => {
    if (!isRecord(value) || typeof value.token_address !== 'string' || value.token_address.toLowerCase() !== daiAddress || typeof value.token_amount !== 'number' || !Number.isFinite(value.token_amount)) return []
    const timestamp = parseUtc(value.block_timestamp)
    return timestamp === null ? [] : [{ timestamp, amount: value.token_amount }]
  }).sort((left, right) => left.timestamp.localeCompare(right.timestamp))
  const negativeRowsOmitted = daiRows.filter(({ amount }) => amount < 0).length
  const acceptedRows = daiRows.filter(({ amount }) => amount >= 0)
  const before = acceptedRows.find(({ timestamp, amount }) => Date.parse(timestamp) <= earlyEventTime && amount === 0)
  const raised = acceptedRows.find(({ timestamp, amount }) => Date.parse(timestamp) > earlyEventTime && Date.parse(timestamp) < convergenceTime && amount > 0)
  const fell = acceptedRows.find(({ timestamp, amount }) => Date.parse(timestamp) >= convergenceTime && raised !== undefined && amount < raised.amount)
  if (negativeRowsOmitted === 0 && before && raised && fell) return { disposition: 'CLEAN_HISTORICAL_STATE', acceptedRows: [before, raised, fell], negativeRowsOmitted, reason: 'Nonnegative snapshots establish rise and later fall inside the authorized window.' }
  return { disposition: 'TRANSACTION_DERIVED_NET_STATE_FALLBACK', acceptedRows: [], negativeRowsOmitted, reason: 'Historical balance semantics did not provide a clean nonnegative before/rise/fall comparison; exact transaction-local net state is used.' }
}

function signingPayload(report: Omit<AuthorizationReport, 'verificationSha256'>): JsonObject {
  return report as unknown as JsonObject
}

async function authorizationSnapshots(ledgerPath: string): Promise<Record<string, string>> {
  const snapshots: Record<string, string> = {}
  for (const file of closureExecutableInputs) snapshots[file] = sha256Hex(await readFile(file))
  snapshots.ledger = sha256Hex(await readFile(ledgerPath))
  return snapshots
}

async function context() {
  const privateRoot = resolvePrivateStoreRoot()
  const roots = { primaryRoot: path.join(privateRoot, 'primary'), mirrorRoot: path.join(privateRoot, 'mirror') }
  const ledgerPath = path.join(roots.primaryRoot, 'ledger', 'calls.jsonl')
  const allowance = await readJson<RequestAllowance>('src/acquisition/config/g5-euler-closure-allowance.json')
  const endpoints = await readJson<EndpointConfig>('src/acquisition/config/nansen-endpoints.json')
  const policy = endpoint(endpoints)
  const request = closureRequest(policy)
  return { privateRoot, roots, ledgerPath, allowance, endpoints, policy, request }
}

async function preflight(): Promise<void> {
  if (process.argv.includes('--credential-file') || process.argv.includes('--credential-env')) throw new Error('Credential configuration is prohibited during closure preflight')
  const { roots, ledgerPath, allowance, request } = await context()
  assertCleanGitInputs([...closureExecutableInputs])
  const store = await verifyContentStore(roots, ledgerPath)
  const records = await readLedger(ledgerPath)
  const duplicate = hasDurableSemanticResponse(records, request)
  const exactPairs = records.filter(({ status }) => status === 'IN_PROGRESS').every((start) => records.some((terminal) => ['COMPLETED', 'FAILED'].includes(terminal.status) && terminal.requestFingerprint === start.requestFingerprint && terminal.attemptNumber === start.attemptNumber))
  const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const currentTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
  const snapshots = await authorizationSnapshots(ledgerPath)
  const checks = { acceptedBaseIsAncestor: true, storeVerified: store.ok, priorLedgerPaired: exactPairs, noRepeatedPaidRequest: !duplicate, allowanceExact: allowance.leadAuthorizationId === 'LEAD-G5-EULER-EVIDENCE-CLOSURE-001' && allowance.maximumRequests === 6 && allowance.maximumProjectedCredits === 20, plannedWithinAllowance: 1 <= allowance.maximumRequests && 1 <= allowance.maximumProjectedCredits, credentialNotResolved: true }
  execFileSync('git', ['merge-base', '--is-ancestor', 'bd3cfdcaebe41725acddea72c688bc595ff3f093', 'HEAD'])
  const unsigned: Omit<AuthorizationReport, 'verificationSha256'> = { schemaVersion: '1.0.0', authorizationId: allowance.leadAuthorizationId, generatedAtUtc: new Date().toISOString(), reviewedCommit: currentCommit, reviewedTree: currentTree, snapshots, plannedUse: { maximumAttempts: 6, maximumCredits: 20, plannedRequests: 1, plannedCredits: 1 }, credentialStatus: 'NOT_RESOLVED_BY_SEQUENCE', privateStore: '<PRIVATE_STORE>', checks, AUTHORIZED_TO_ISSUE: Object.values(checks).every(Boolean) }
  const report: AuthorizationReport = { ...unsigned, verificationSha256: hashCanonicalObject(signingPayload(unsigned)) }
  await writeJsonExclusive(reportPath, report)
  printReport(report)
  if (!report.AUTHORIZED_TO_ISSUE) process.exitCode = 1
}

async function run(): Promise<void> {
  const { privateRoot, roots, ledgerPath, allowance, policy, request } = await context()
  const authorization = await readJson<AuthorizationReport>(reportPath)
  assertCleanGitInputs([...closureExecutableInputs])
  const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const currentTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
  const expectedSnapshots = await authorizationSnapshots(ledgerPath)
  const verified = authorization.AUTHORIZED_TO_ISSUE
    && authorization.authorizationId === allowance.leadAuthorizationId
    && authorization.reviewedCommit === currentCommit
    && authorization.reviewedTree === currentTree
    && JSON.stringify(authorization.snapshots) === JSON.stringify(expectedSnapshots)
    && authorization.verificationSha256 === hashCanonicalObject(signingPayload(withoutSignature(authorization)))
    && Date.now() - Date.parse(authorization.generatedAtUtc) <= 6 * 60 * 60 * 1000
  if (!verified) throw new Error('Closure authorization report is stale, altered, or not bound to the current runtime inputs')
  const credentialSource = resolveCredentialSource()
  if (credentialSource === null) throw new Error('An explicit credential source is required for the authorized closure run')
  const beforeRecords = await readLedger(ledgerPath)
  if (hasDurableSemanticResponse(beforeRecords, request)) throw new Error('Closure request duplicates an already durable provider response')
  const previousRemaining = [...beforeRecords].reverse().map((record) => numericMetadata(record, 'x-nansen-credits-remaining')).find((value) => value !== null)
  if (previousRemaining === undefined) throw new Error('Durable credit baseline is unavailable')
  const use = await withExclusiveRunLock(path.join(privateRoot, 'g5-closure.lock'), () => withExplicitCredential(credentialSource, { readEnvironment: (identifier) => process.env[identifier] ?? null, readFile: async (target) => (await readFile(target, 'utf8')).trim() }, async (credential) => {
    const session = new LiveAcquisitionSession({ roots, ledgerPath, allowance, retryPolicy: { minimumDelayMs: 1_000, retry: { maximumAttempts: 3, baseDelayMs: 1_000, maximumDelayMs: 8_000, retryableHttpStatuses: [429, 500, 502, 503, 504], nonRetryableHttpStatuses: [400, 401, 402, 403, 404, 422] } }, transport: createNansenTransport(), credential, candidateLimits: { [candidateId]: { maxHttpAttempts: 6, maxProjectedCredits: 20 } }, protectedMinimumRemainingCredits: 250 })
    session.setCreditBaseline(previousRemaining)
    const result = await session.execute(request, policy)
    const assessment = assessHistoricalState(JSON.parse(Buffer.from(result.rawBody).toString('utf8')) as unknown)
    const afterRecords = await readLedger(ledgerPath)
    const starts = afterRecords.filter((record) => record.status === 'IN_PROGRESS' && record.redactedRequestMetadata.allowanceId === allowance.allowanceId)
    const terminals = afterRecords.filter((record) => ['COMPLETED', 'FAILED'].includes(record.status) && record.redactedRequestMetadata.allowanceId === allowance.allowanceId)
    const actualCredits = terminals.reduce((sum, record) => sum + (numericMetadata(record, 'x-nansen-credits-used') ?? record.plannedCreditEstimate), 0)
    const endingRemaining = [...terminals].reverse().map((record) => numericMetadata(record, 'x-nansen-credits-remaining')).find((value) => value !== null) ?? previousRemaining
    const report = redactPrivatePaths({ schemaVersion: '1.0.0', status: 'COMPLETED_PENDING_LEAD_REVIEW', authorizationId: allowance.leadAuthorizationId, provider: 'Nansen', credentialStatus: 'PRESENT_REDACTED', privateStore: '<PRIVATE_STORE>', responseReused: result.reused, usage: { httpAttempts: starts.length, projectedCredits: starts.reduce((sum, record) => sum + record.plannedCreditEstimate, 0), actualCredits, accountCreditDelta: previousRemaining - endingRemaining, countTowardBuildathon1000: false }, durableStore: await verifyContentStore(roots, ledgerPath), assessment, playerFacingStateEvidence: assessment.disposition === 'CLEAN_HISTORICAL_STATE' ? { grade: 'CORROBORATING', source: 'NANSEN_HISTORICAL_BALANCE', snapshots: assessment.acceptedRows } : { grade: 'CORROBORATING', source: 'TRANSACTION_DERIVED_NET_STATE', netDai: exactNetDai, label: 'TRANSACTION-DERIVED NET STATE' }, negativeRowsPublished: 0, fallbackDoesNotBlockHero: true, alchemyCalls: 0 }, privateRoot)
    await writeJsonExclusive(resultPath, report)
    return report
  }))
  if (use.presence.status !== 'PRESENT' || use.value === undefined) throw new Error('Authorized credential source could not be resolved safely')
  printReport(use.value)
}

async function recover(): Promise<void> {
  if (process.argv.includes('--credential-file') || process.argv.includes('--credential-env')) throw new Error('Credential configuration is prohibited during offline closure recovery')
  const { privateRoot, roots, ledgerPath, allowance, request } = await context()
  const store = await verifyContentStore(roots, ledgerPath)
  if (!store.ok) throw new Error(`Private store failed verification: ${store.errors.join('; ')}`)
  const records = await readLedger(ledgerPath)
  const starts = records.filter((record) => record.status === 'IN_PROGRESS' && record.redactedRequestMetadata.allowanceId === allowance.allowanceId)
  const terminals = records.filter((record) => ['COMPLETED', 'FAILED'].includes(record.status) && record.redactedRequestMetadata.allowanceId === allowance.allowanceId)
  if (starts.length !== 1 || terminals.length !== 1) throw new Error('Offline closure recovery requires exactly one issued and one terminal attempt')
  const terminal = terminals[0]!
  if (terminal.requestFingerprint !== starts[0]!.requestFingerprint || terminal.canonicalRequestHash !== hashCanonicalObject(request.requestBody) || terminal.httpStatus !== 200 || terminal.rawSha256 === null || terminal.rawStorageLocations === null || terminal.decision.reason !== 'CREDIT_ACCOUNTING_POLICY_REJECTED') throw new Error('Durable closure response is not eligible for conservative offline recovery')
  const quoted = numericMetadata(terminal, 'x-nansen-credits-cost')
  const used = numericMetadata(terminal, 'x-nansen-credits-used')
  const endingRemaining = numericMetadata(terminal, 'x-nansen-credits-remaining')
  if (quoted !== 1 || used !== 1 || endingRemaining === null || endingRemaining < 250) throw new Error('Closure credit metadata cannot be reconciled safely')
  const precedingRemaining = [...records].reverse().filter((record) => record.callSequence < starts[0]!.callSequence).map((record) => numericMetadata(record, 'x-nansen-credits-remaining')).find((value) => value !== null)
  if (precedingRemaining === undefined || precedingRemaining < endingRemaining) throw new Error('Preceding durable credit reference is unavailable')
  const rawBody = gunzipSync(await readFile(terminal.rawStorageLocations.primary))
  if (sha256Hex(rawBody) !== terminal.rawSha256) throw new Error('Durable closure raw hash mismatch')
  const assessment = assessHistoricalState(JSON.parse(rawBody.toString('utf8')) as unknown)
  const observedAccountDelta = precedingRemaining - endingRemaining
  const report = redactPrivatePaths({ schemaVersion: '1.0.0', status: 'COMPLETED_PENDING_LEAD_REVIEW', authorizationId: allowance.leadAuthorizationId, provider: 'Nansen', credentialStatus: 'NOT_RESOLVED_DURING_OFFLINE_RECOVERY', privateStore: '<PRIVATE_STORE>', offlineRecovery: true, providerCallsDuringRecovery: 0, credentialReadsDuringRecovery: 0, usage: { httpAttempts: 1, projectedCredits: 1, actualCredits: used, providerUsedHeaderAttribution: used, observedAccountDeltaSincePriorCampaign: observedAccountDelta, unattributedConcurrentAccountDelta: observedAccountDelta - used, countTowardBuildathon1000: false }, creditReconciliation: { status: 'DISCLOSED_SHARED_ACCOUNT_DRIFT', explanation: 'The provider charged one credit for this response; unrelated account activity occurred after the prior campaign, so the long-window account delta is not attributed to this closure.' }, durableStore: store, assessment, playerFacingStateEvidence: assessment.disposition === 'CLEAN_HISTORICAL_STATE' ? { grade: 'CORROBORATING', source: 'NANSEN_HISTORICAL_BALANCE', snapshots: assessment.acceptedRows } : { grade: 'CORROBORATING', source: 'TRANSACTION_DERIVED_NET_STATE', netDai: exactNetDai, label: 'TRANSACTION-DERIVED NET STATE' }, negativeRowsPublished: 0, fallbackDoesNotBlockHero: true, alchemyCalls: 0 }, privateRoot)
  await writeJsonExclusive('artifacts/g5/EULER_EVIDENCE_CLOSURE_RECOVERY_RECONCILIATION.json', report)
  printReport(report)
}

function withoutSignature(value: AuthorizationReport): Omit<AuthorizationReport, 'verificationSha256'> {
  const copy: Partial<AuthorizationReport> = { ...value }
  delete copy.verificationSha256
  return copy as Omit<AuthorizationReport, 'verificationSha256'>
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'preflight') return preflight()
  if (mode === 'run') return run()
  if (mode === 'recover') return recover()
  throw new Error('Expected preflight, run, or recover mode')
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(fail)
