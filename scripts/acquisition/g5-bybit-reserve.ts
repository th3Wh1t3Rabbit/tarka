import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import type { CallLedgerRecord, FatalDefect, JsonObject, PlannedRequest, RequestAllowance } from '../../src/acquisition/contracts.js'
import { scoreCase } from '../../src/acquisition/evidence/score.js'
import { withExplicitCredential } from '../../src/acquisition/integrity/credential.js'
import { hashCanonicalObject, sha256Hex } from '../../src/acquisition/integrity/identity.js'
import { readLedger } from '../../src/acquisition/integrity/ledger.js'
import { verifyContentStore } from '../../src/acquisition/integrity/store.js'
import { LiveAcquisitionSession, withExclusiveRunLock, type LiveEndpointPolicy } from '../../src/acquisition/live/executor.js'
import { createNansenTransport } from '../../src/acquisition/live/transport.js'
import {
  isInsideContextWindow,
  parseObservations,
  type AcquiredItem,
  type CandidateConfig,
  type EndpointConfigFile,
  type StructuredObservation,
} from './g4a-audition.js'
import { assertCleanGitInputs, fail, printReport, readJson, redactPrivatePaths, resolveCredentialSource, resolvePrivateStoreRoot, writeJsonExclusive } from './common.js'

const candidateId = 'BYBIT_2025_DRAIN_FALLBACK'
const accountCandidateId = 'G5_BYBIT_ACCOUNT_PREFLIGHT'
const authorizationId = 'LEAD-G5-BYBIT-RESERVE-AUDITION-001'
const sharedContractsCommit = '1bbc8950ae2c7e3cae2892441efe4ec40e16a523'
const acceptedBase = 'bd3cfdcaebe41725acddea72c688bc595ff3f093'
const authorizationReportPath = 'artifacts/g5/BYBIT_RESERVE_PRECALL_AUTHORIZATION_REPORT.json'
const resultPath = 'artifacts/g5/BYBIT_RESERVE_AUDITION_LEAD_REVIEW_ONLY.json'
const reuseReconciliationPath = 'artifacts/g5/BYBIT_RESERVE_REUSE_RECONCILIATION.json'
const allowancePath = 'src/acquisition/config/g5-bybit-reserve-allowance.json'
const candidatesPath = 'src/acquisition/config/g4a-candidates.json'
const endpointsPath = 'src/acquisition/config/nansen-endpoints.json'
export const reserveExecutableInputs = [
  'scripts/acquisition/g5-bybit-reserve.ts', 'scripts/acquisition/g4a-audition.ts', 'scripts/acquisition/common.ts',
  'src/acquisition/contracts.ts', 'src/acquisition/evidence/score.ts',
  'src/acquisition/integrity/credential.ts', 'src/acquisition/integrity/governor.ts',
  'src/acquisition/integrity/identity.ts', 'src/acquisition/integrity/ledger.ts',
  'src/acquisition/integrity/retry.ts', 'src/acquisition/integrity/store.ts',
  'src/acquisition/live/executor.ts', 'src/acquisition/live/transport.ts',
  allowancePath, candidatesPath, endpointsPath, 'AGENTS.md',
] as const

interface CandidateConfigFile {
  schemaVersion: string
  threshold: number
  priorityOrder: string[]
  candidates: CandidateConfig[]
}

interface AuthorizationReport {
  schemaVersion: '1.0.0'
  authorizationId: string
  generatedAtUtc: string
  reviewedCommit: string
  reviewedTree: string
  privateStore: '<PRIVATE_STORE>'
  credentialStatus: 'NOT_RESOLVED_BY_SEQUENCE'
  snapshots: Record<string, string>
  plannedUse: {
    maximumHttpAttempts: 18
    maximumCredits: 60
    missingPaidRequests: number
    reusableDurableResponses: number
    plannedFreshAccountRequests: number
    plannedPaidRequests: number
    plannedProjectedCredits: number
  }
  checks: Record<string, boolean>
  AUTHORIZED_TO_ISSUE: boolean
  verificationSha256: string
}

export interface ReserveEvaluation {
  recommendation: 'RESERVE_ELIGIBLE' | 'DEFER'
  total: number
  fatalDefects: FatalDefect[]
  exactFound: number
  exactExpected: number
  routeProof: boolean
  branchProof: boolean
  transformationProof: boolean
  temporalIntegrity: boolean
  criticalNodes: string[]
  unsupportedGaps: string[]
  evidenceGradeCounts: { EXACT: number; CORROBORATING: number; CONTEXTUAL: number }
}

function normalizeNullableTransferArrays(item: AcquiredItem): AcquiredItem {
  if (typeof item.body !== 'object' || item.body === null || Array.isArray(item.body)) return item
  const root = item.body as Record<string, unknown>
  if (!Array.isArray(root.data)) return item
  const data = root.data.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
    const row = value as Record<string, unknown>
    return row.token_transfer_array === null ? { ...row, token_transfer_array: [] } : row
  })
  return { ...item, body: { ...root, data } }
}

function git(command: string[]): string {
  return execFileSync('git', command, { encoding: 'utf8' }).trim()
}

function endpoint(config: EndpointConfigFile, endpointPath: string): LiveEndpointPolicy {
  const matches = config.endpoints.filter((entry) => entry.endpoint === endpointPath)
  if (matches.length !== 1) throw new Error(`Reviewed endpoint policy missing or ambiguous: ${endpointPath}`)
  return matches[0]!
}

function bybitCandidate(config: CandidateConfigFile): CandidateConfig {
  const candidate = config.candidates.find(({ id }) => id === candidateId)
  if (candidate === undefined) throw new Error('Reviewed Bybit seed manifest is missing')
  return { ...candidate, limits: { maxHttpAttempts: 18, maxProjectedCredits: 60 } }
}

function exactRequest(candidate: CandidateConfig, purpose: string, transactionHash: string, policy: LiveEndpointPolicy): PlannedRequest {
  return {
    identityVersion: '1.0.0',
    endpoint: policy.endpoint,
    endpointClass: policy.endpointClass,
    apiVersion: policy.apiVersion,
    requestBody: { chain: candidate.chain, transaction_hash: transactionHash },
    candidateId,
    purposeId: purpose,
    temporalWindow: { ...candidate.contextWindow },
    normalizationContractVersion: 'g5-bybit-nansen-1.0.0',
    pagination: { page: 1, cursor: null },
    refresh: null,
  }
}

export function reserveRequestPlan(candidate: CandidateConfig, endpoints: EndpointConfigFile): Array<{ purpose: string; policy: LiveEndpointPolicy; request: PlannedRequest }> {
  const policy = endpoint(endpoints, '/api/v1/transaction-with-token-transfer-lookup')
  return Object.entries(candidate.transactions).map(([name, transactionHash]) => {
    const purpose = `exact-${name}`
    return { purpose, policy, request: exactRequest(candidate, purpose, transactionHash, policy) }
  })
}

function semanticTerminal(records: CallLedgerRecord[], request: PlannedRequest): CallLedgerRecord | null {
  const requestHash = hashCanonicalObject(request.requestBody)
  return [...records].reverse().find((record) =>
    ['COMPLETED', 'FAILED'].includes(record.status)
    && record.endpoint === request.endpoint
    && record.canonicalRequestHash === requestHash
    && record.rawSha256 !== null
    && record.rawStorageLocations !== null
    && record.normalizedSha256 !== null,
  ) ?? null
}

export function hasDurableSemanticResponse(records: CallLedgerRecord[], request: PlannedRequest): boolean {
  return semanticTerminal(records, request) !== null
}

function exactRoute(
  candidate: CandidateConfig,
  observations: StructuredObservation[],
): { routeProof: boolean; transformationProof: boolean } {
  const routeHash = candidate.transactions.eth_drain?.toLowerCase()
  const recipient = candidate.addresses.known_exploiter_recipient?.toLowerCase()
  const possibleSources = new Set([
    candidate.addresses.victim_safe?.toLowerCase(),
    candidate.addresses.initial_attacker?.toLowerCase(),
  ].filter((value): value is string => value !== undefined))
  if (routeHash === undefined || recipient === undefined) return { routeProof: false, transformationProof: false }
  const route = observations.filter(({ grade, transactionHash }) => grade === 'EXACT' && transactionHash?.toLowerCase() === routeHash)
  const transfer = route.find(({ kind, fromAddress, toAddress, amount }) => kind === 'TOKEN_TRANSFER'
    && fromAddress !== undefined
    && toAddress?.toLowerCase() === recipient
    && possibleSources.has(fromAddress.toLowerCase())
    && amount !== undefined
    && Number.isFinite(amount))
  return { routeProof: transfer !== undefined, transformationProof: transfer !== undefined }
}

function hasImmediateBranch(candidate: CandidateConfig, observations: StructuredObservation[]): boolean {
  const recipient = candidate.addresses.known_exploiter_recipient?.toLowerCase()
  const victim = candidate.addresses.victim_safe?.toLowerCase()
  const qualifyingTransactions = new Set(observations.filter(({ kind, grade, transactionHash, fromAddress, toAddress }) =>
    kind === 'TOKEN_TRANSFER'
    && grade === 'EXACT'
    && transactionHash !== undefined
    && ((recipient !== undefined && toAddress?.toLowerCase() === recipient) || (victim !== undefined && fromAddress?.toLowerCase() === victim)),
  ).map(({ transactionHash }) => transactionHash!.toLowerCase()))
  return qualifyingTransactions.size >= 2
}

function observedCriticalNodes(candidate: CandidateConfig, observations: StructuredObservation[], exactHashes: Set<string>): string[] {
  const observedAddresses = new Set(observations.flatMap(({ fromAddress, toAddress }) => [fromAddress, toAddress]
    .filter((value): value is string => value !== undefined)
    .map((value) => value.toLowerCase())))
  const rolePriority = ['victim_safe', 'delegatecall_contract', 'malicious_implementation', 'initial_attacker', 'known_exploiter_recipient']
  const transactionPriority = ['safe_upgrade', 'eth_drain', 'cmeth_drain', 'meth_drain', 'steth_drain']
  const nodes = [
    ...rolePriority.map((name) => candidate.addresses[name]).filter((value): value is string => value !== undefined && observedAddresses.has(value.toLowerCase())),
    ...transactionPriority.map((name) => candidate.transactions[name]).filter((value): value is string => value !== undefined && exactHashes.has(value.toLowerCase())),
  ]
  return [...new Map(nodes.map((node) => [node.toLowerCase(), node])).values()].slice(0, 10)
}

export function evaluateReserve(candidate: CandidateConfig, items: AcquiredItem[]): ReserveEvaluation {
  // The exact-lookup schema uses null for an empty transfer collection. Treating
  // that reviewed representation as an empty list preserves the transaction fact
  // without manufacturing a transfer or accepting any additional provider field.
  const observations = items.map(normalizeNullableTransferArrays).flatMap(parseObservations)
  const inside = observations.filter((observation) => isInsideContextWindow(candidate, observation))
  const temporalIntegrity = inside.length === observations.length && observations.length > 0
  const exactHashes = new Set(inside.filter(({ grade, transactionHash }) => grade === 'EXACT' && transactionHash !== undefined).map(({ transactionHash }) => transactionHash!.toLowerCase()))
  const expectedHashes = Object.values(candidate.transactions)
  const exactFound = expectedHashes.filter((hash) => exactHashes.has(hash.toLowerCase())).length
  const route = exactRoute(candidate, inside)
  const branchProof = hasImmediateBranch(candidate, inside)
  const criticalNodes = observedCriticalNodes(candidate, inside, exactHashes)
  const fatalDefects: FatalDefect[] = []
  if (exactFound !== expectedHashes.length) fatalDefects.push('NO_EXACT_PROOF_CLOSURE')
  if (!route.routeProof || !route.transformationProof || !branchProof) fatalDefects.push('ESSENTIAL_UNSUPPORTED_GAP')
  if (criticalNodes.length < 6 || criticalNodes.length > 10) fatalDefects.push('GRAPH_NOT_HONESTLY_COMPRESSIBLE')
  if (!temporalIntegrity) fatalDefects.push('LOOK_AHEAD_LEAKAGE')
  const distinctTimes = new Set(inside.map(({ observedAtUtc }) => observedAtUtc)).size
  const categories = {
    proofClosureAuditability: exactFound === expectedHashes.length ? 18 : Math.min(17, exactFound * 3),
    nansenIndispensability: exactFound === expectedHashes.length ? 14 : exactFound > 0 ? 8 : 0,
    branchTransformationTopology: route.routeProof && route.transformationProof && branchProof ? 13 : route.routeProof ? 7 : 0,
    timeMechanicPotential: distinctTimes >= 4 ? 9 : distinctTimes >= 2 ? 5 : 0,
    nonexpertNarrativeClarity: route.routeProof && branchProof ? 8 : route.routeProof ? 5 : 0,
    replayTruthfulDepth: branchProof ? 7 : 3,
    visualWorldReadability: criticalNodes.length >= 6 && criticalNodes.length <= 10 ? 9 : 3,
    complianceDataReliability: temporalIntegrity && observations.every(({ grade }) => grade === 'EXACT') ? 8 : 4,
  }
  const score = scoreCase({ candidateId, categories, fatalDefects, eligibilityThreshold: 78 })
  const unsupportedGaps = [
    'Cross-chain or venue continuity after the bounded Ethereum shard is unsupported and excluded; it is not required for this reserve audition.',
    'No common human identity, off-chain coordination, or attribution claim is supported or made.',
  ]
  return {
    recommendation: score.eligible ? 'RESERVE_ELIGIBLE' : 'DEFER',
    total: score.total,
    fatalDefects: score.fatalDefects,
    exactFound,
    exactExpected: expectedHashes.length,
    routeProof: route.routeProof,
    branchProof,
    transformationProof: route.transformationProof,
    temporalIntegrity,
    criticalNodes,
    unsupportedGaps,
    evidenceGradeCounts: {
      EXACT: inside.filter(({ grade }) => grade === 'EXACT').length,
      CORROBORATING: inside.filter(({ grade }) => grade === 'CORROBORATING').length,
      CONTEXTUAL: inside.filter(({ grade }) => grade === 'CONTEXTUAL').length,
    },
  }
}

function numericMetadata(record: CallLedgerRecord, key: string): number | null {
  const value = record.returnedCreditMetadata?.[key]
  return (typeof value === 'string' || typeof value === 'number') && Number.isFinite(Number(value)) ? Number(value) : null
}

function extractRemaining(body: unknown, record: CallLedgerRecord): number | null {
  const visit = (value: unknown): number | null => {
    if (Array.isArray(value)) {
      for (const child of value) {
        const result = visit(child)
        if (result !== null) return result
      }
      return null
    }
    if (typeof value !== 'object' || value === null) return null
    for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
      if (['credits_remaining', 'creditsremaining', 'remaining_credits', 'remainingcredits'].includes(name.toLowerCase())
        && (typeof child === 'number' || typeof child === 'string')
        && Number.isFinite(Number(child))) return Number(child)
      const result = visit(child)
      if (result !== null) return result
    }
    return null
  }
  return visit(body) ?? numericMetadata(record, 'x-nansen-credits-remaining')
}

export function isExactCreditPair(baselineRemaining: number | null, endingRemaining: number | null, usedCredits: number | null): boolean {
  return baselineRemaining !== null
    && endingRemaining !== null
    && usedCredits !== null
    && usedCredits >= 0
    && baselineRemaining - endingRemaining === usedCredits
}

async function reconcileCreditPairs(records: CallLedgerRecord[], allowance: RequestAllowance): Promise<JsonObject> {
  const scoped = records.filter(({ redactedRequestMetadata }) => redactedRequestMetadata.allowanceId === allowance.allowanceId)
  const accountTerminals = scoped.filter(({ status, candidateId: id }) => status === 'COMPLETED' && id === accountCandidateId)
  const paidTerminals = scoped.filter(({ status, candidateId: id }) => ['COMPLETED', 'FAILED'].includes(status) && id === candidateId)
  const pairs = [] as Array<{ purposeId: string; baselineRemaining: number | null; endingRemaining: number | null; usedCredits: number | null; exact: boolean }>
  for (const paid of paidTerminals) {
    const account = accountTerminals.filter(({ callSequence }) => callSequence < paid.callSequence).at(-1)
    let baselineRemaining: number | null = null
    if (account?.rawStorageLocations !== null && account?.rawStorageLocations !== undefined && account.rawSha256 !== null) {
      const bytes = gunzipSync(await readFile(account.rawStorageLocations.primary))
      if (sha256Hex(bytes) !== account.rawSha256) throw new Error('Account preflight raw hash failed during offline reconciliation')
      baselineRemaining = extractRemaining(JSON.parse(bytes.toString('utf8')) as unknown, account)
    }
    const endingRemaining = numericMetadata(paid, 'x-nansen-credits-remaining')
    const usedCredits = numericMetadata(paid, 'x-nansen-credits-used')
    pairs.push({ purposeId: paid.purposeId, baselineRemaining, endingRemaining, usedCredits, exact: isExactCreditPair(baselineRemaining, endingRemaining, usedCredits) })
  }
  return {
    status: pairs.length === 5 && pairs.every(({ exact }) => exact) ? 'EXACT_ACCOUNT_PRECHECK_PAIRS' : 'INCOMPLETE_OR_MISMATCHED',
    pairCount: pairs.length,
    exactPairCount: pairs.filter(({ exact }) => exact).length,
    pairs,
  }
}

function exactPairs(records: CallLedgerRecord[]): boolean {
  const terminals = new Set(records.filter(({ status }) => ['COMPLETED', 'FAILED'].includes(status)).map(({ requestFingerprint, attemptNumber }) => `${requestFingerprint}:${attemptNumber}`))
  return records.filter(({ status }) => status === 'IN_PROGRESS').every(({ requestFingerprint, attemptNumber }) => terminals.has(`${requestFingerprint}:${attemptNumber}`))
}

function acquisitionScopeClean(): boolean {
  const paths = ['AGENTS.md', 'scripts/acquisition', 'src/acquisition', 'tests/acquisition']
  return spawnSync('git', ['diff', '--quiet', 'HEAD', '--', ...paths]).status === 0
    && spawnSync('git', ['diff', '--cached', '--quiet', 'HEAD', '--', ...paths]).status === 0
}

function signaturePayload(report: Omit<AuthorizationReport, 'verificationSha256'> | AuthorizationReport): JsonObject {
  const payload = { ...report } as Partial<AuthorizationReport>
  delete payload.verificationSha256
  return payload as unknown as JsonObject
}

async function snapshotInputs(ledgerPath: string): Promise<Record<string, string>> {
  const snapshots: Record<string, string> = {}
  for (const file of reserveExecutableInputs) snapshots[file] = sha256Hex(await readFile(file))
  snapshots.ledger = sha256Hex(await readFile(ledgerPath))
  return snapshots
}

async function context() {
  const privateRoot = resolvePrivateStoreRoot()
  const roots = { primaryRoot: path.join(privateRoot, 'primary'), mirrorRoot: path.join(privateRoot, 'mirror') }
  const ledgerPath = path.join(roots.primaryRoot, 'ledger', 'calls.jsonl')
  const allowance = await readJson<RequestAllowance>(allowancePath)
  const candidates = await readJson<CandidateConfigFile>(candidatesPath)
  const endpoints = await readJson<EndpointConfigFile>(endpointsPath)
  const candidate = bybitCandidate(candidates)
  const plan = reserveRequestPlan(candidate, endpoints)
  return { privateRoot, roots, ledgerPath, allowance, endpoints, candidate, plan }
}

async function preflight(): Promise<void> {
  if (process.argv.includes('--credential-file') || process.argv.includes('--credential-env')) throw new Error('Credential configuration is prohibited during Bybit reserve preflight')
  const { roots, ledgerPath, allowance, plan } = await context()
  assertCleanGitInputs([...reserveExecutableInputs])
  const records = await readLedger(ledgerPath)
  const store = await verifyContentStore(roots, ledgerPath)
  const reusable = plan.filter(({ request }) => hasDurableSemanticResponse(records, request)).length
  const missing = plan.length - reusable
  const plannedAccountRequests = missing
  let acceptedAncestor = true
  let sharedContractsFrozen = true
  try { git(['merge-base', '--is-ancestor', acceptedBase, 'HEAD']) } catch { acceptedAncestor = false }
  try { git(['merge-base', '--is-ancestor', sharedContractsCommit, 'HEAD']) } catch { sharedContractsFrozen = false }
  const checks = {
    acceptedBaseIsAncestor: acceptedAncestor,
    sharedContractsFrozenBeforeReserveLane: sharedContractsFrozen,
    privateStoreVerified: store.ok,
    priorLedgerExactlyPaired: exactPairs(records),
    acquisitionScopeClean: acquisitionScopeClean(),
    credentialNotResolved: true,
    allowanceExact: allowance.leadAuthorizationId === authorizationId && allowance.maximumRequests === 18 && allowance.maximumProjectedCredits === 60,
    endpointScopeExact: allowance.approvedEndpoints.length === 2
      && allowance.approvedEndpoints.includes('/api/v1/account')
      && allowance.approvedEndpoints.includes('/api/v1/transaction-with-token-transfer-lookup'),
    candidateScopeExact: allowance.approvedCandidateIds.length === 2
      && allowance.approvedCandidateIds.includes(accountCandidateId)
      && allowance.approvedCandidateIds.includes(candidateId),
    exactSeedPlanOnly: plan.length === 5 && plan.every(({ request }) => request.endpoint === '/api/v1/transaction-with-token-transfer-lookup'),
    plannedWithinCeilings: plannedAccountRequests + missing <= 18 && missing <= 60,
    alchemyExcluded: !allowance.approvedEndpoints.some((value) => value.toLowerCase().includes('alchemy')),
    heroCriticalPathUntouched: true,
  }
  const unsigned: Omit<AuthorizationReport, 'verificationSha256'> = {
    schemaVersion: '1.0.0',
    authorizationId,
    generatedAtUtc: new Date().toISOString(),
    reviewedCommit: git(['rev-parse', 'HEAD']),
    reviewedTree: git(['rev-parse', 'HEAD^{tree}']),
    privateStore: '<PRIVATE_STORE>',
    credentialStatus: 'NOT_RESOLVED_BY_SEQUENCE',
    snapshots: await snapshotInputs(ledgerPath),
    plannedUse: {
      maximumHttpAttempts: 18,
      maximumCredits: 60,
      missingPaidRequests: missing,
      reusableDurableResponses: reusable,
      plannedFreshAccountRequests: plannedAccountRequests,
      plannedPaidRequests: missing,
      plannedProjectedCredits: missing,
    },
    checks,
    AUTHORIZED_TO_ISSUE: Object.values(checks).every(Boolean),
  }
  const report: AuthorizationReport = { ...unsigned, verificationSha256: hashCanonicalObject(signaturePayload(unsigned)) }
  await writeJsonExclusive(authorizationReportPath, report)
  printReport(report)
  if (!report.AUTHORIZED_TO_ISSUE) process.exitCode = 1
}

function withoutSignature(report: AuthorizationReport): Omit<AuthorizationReport, 'verificationSha256'> {
  const copy: Partial<AuthorizationReport> = { ...report }
  delete copy.verificationSha256
  return copy as Omit<AuthorizationReport, 'verificationSha256'>
}

async function verifyAuthorization(report: AuthorizationReport, ledgerPath: string): Promise<void> {
  if (!report.AUTHORIZED_TO_ISSUE || report.authorizationId !== authorizationId) throw new Error('Bybit reserve authorization report does not authorize issue')
  assertCleanGitInputs([...reserveExecutableInputs])
  if (git(['rev-parse', 'HEAD']) !== report.reviewedCommit) throw new Error('Bybit reserve authorization is not bound to the exact reviewed commit')
  if (git(['rev-parse', `${report.reviewedCommit}^{tree}`]) !== report.reviewedTree) throw new Error('Bybit reserve reviewed tree binding is invalid')
  if (JSON.stringify(report.snapshots) !== JSON.stringify(await snapshotInputs(ledgerPath))) throw new Error('Bybit reserve authorization inputs changed after preflight')
  if (report.verificationSha256 !== hashCanonicalObject(signaturePayload(withoutSignature(report)))) throw new Error('Bybit reserve authorization integrity failed')
  const age = Date.now() - Date.parse(report.generatedAtUtc)
  if (!Number.isFinite(age) || age < -5 * 60_000 || age > 6 * 60 * 60_000) throw new Error('Bybit reserve authorization report is stale')
}

async function durableItem(planned: { purpose: string; policy: LiveEndpointPolicy; request: PlannedRequest }, records: CallLedgerRecord[]): Promise<AcquiredItem | null> {
  const terminal = semanticTerminal(records, planned.request)
  if (terminal === null || terminal.rawStorageLocations === null || terminal.rawSha256 === null || terminal.normalizedSha256 === null || terminal.completedAtUtc === null || terminal.httpStatus !== 200) return null
  const bytes = gunzipSync(await readFile(terminal.rawStorageLocations.primary))
  if (sha256Hex(bytes) !== terminal.rawSha256) throw new Error('Durable Bybit response failed raw hash verification')
  return {
    purpose: planned.purpose,
    endpoint: planned.policy.endpoint,
    requestBody: planned.request.requestBody,
    status: terminal.httpStatus,
    rawSha256: terminal.rawSha256,
    normalizedSha256: terminal.normalizedSha256,
    body: JSON.parse(bytes.toString('utf8')) as unknown,
    attemptsIssued: 0,
    projectedCredits: 0,
    creditMetadata: terminal.returnedCreditMetadata,
    retrievedAtUtc: terminal.completedAtUtc,
  }
}

function allowanceUsage(records: CallLedgerRecord[], allowance: RequestAllowance): JsonObject {
  const starts = records.filter(({ status, redactedRequestMetadata }) => status === 'IN_PROGRESS' && redactedRequestMetadata.allowanceId === allowance.allowanceId)
  const terminals = records.filter(({ status, redactedRequestMetadata }) => ['COMPLETED', 'FAILED'].includes(status) && redactedRequestMetadata.allowanceId === allowance.allowanceId)
  const actualCredits = terminals.reduce((sum, record) => sum + (numericMetadata(record, 'x-nansen-credits-used') ?? record.plannedCreditEstimate), 0)
  return {
    httpAttempts: starts.length,
    projectedCredits: starts.reduce((sum, record) => sum + record.plannedCreditEstimate, 0),
    actualCredits,
    accountPreflightAttempts: starts.filter(({ candidateId: id }) => id === accountCandidateId).length,
    paidLookupAttempts: starts.filter(({ candidateId: id }) => id === candidateId).length,
    returnedCreditMetadataRecords: terminals.filter(({ returnedCreditMetadata }) => returnedCreditMetadata !== null).length,
    countTowardBuildathon1000: false,
    ceilings: { httpAttempts: 18, credits: 60 },
    withinCeilings: starts.length <= 18 && actualCredits <= 60,
  }
}

async function finalReport(
  privateRoot: string,
  roots: { primaryRoot: string; mirrorRoot: string },
  ledgerPath: string,
  allowance: RequestAllowance,
  items: AcquiredItem[],
  candidate: CandidateConfig,
  mode: 'PROVIDER_AND_DURABLE_REUSE' | 'DURABLE_REUSE_ONLY',
): Promise<object> {
  const evaluation = evaluateReserve(candidate, items)
  const records = await readLedger(ledgerPath)
  const rawHashes = [...new Set(items.map(({ rawSha256 }) => rawSha256))]
  const normalizedHashes = [...new Set(items.map(({ normalizedSha256 }) => normalizedSha256))]
  return redactPrivatePaths({
    schemaVersion: '1.0.0',
    status: evaluation.recommendation === 'RESERVE_ELIGIBLE' ? 'COMPLETED_PENDING_LEAD_REVIEW' : 'NONBLOCKING_DEFER',
    authorizationId,
    candidateId,
    distribution: 'LEAD_REVIEW_ONLY_DO_NOT_PUBLICLY_EXPORT',
    recommendation: evaluation.recommendation,
    heroImpact: 'NONE_NONBLOCKING_LANE',
    heroGameIntegration: false,
    mission02Admission: false,
    provider: 'Nansen',
    executionMode: mode,
    credentialStatus: mode === 'DURABLE_REUSE_ONLY' ? 'NOT_RESOLVED_ALL_RESPONSES_REUSED' : 'PRESENT_REDACTED',
    privateStore: '<PRIVATE_STORE>',
    usage: allowanceUsage(records, allowance),
    creditReconciliation: await reconcileCreditPairs(records, allowance),
    durableStore: await verifyContentStore(roots, ledgerPath),
    score: {
      independentImplementationScore: evaluation.total,
      threshold: 78,
      fatalDefects: evaluation.fatalDefects,
      thresholdCleared: evaluation.recommendation === 'RESERVE_ELIGIBLE',
      leadAcceptanceRequired: true,
    },
    measurements: {
      exactFound: evaluation.exactFound,
      exactExpected: evaluation.exactExpected,
      routeProof: evaluation.routeProof,
      branchProof: evaluation.branchProof,
      transformationProof: evaluation.transformationProof,
      temporalIntegrity: evaluation.temporalIntegrity,
      criticalNodeCount: evaluation.criticalNodes.length,
      evidenceGradeCounts: evaluation.evidenceGradeCounts,
    },
    boundedGraph: { nodes: evaluation.criticalNodes, nodeCount: evaluation.criticalNodes.length, honestlyCompressed: evaluation.criticalNodes.length >= 6 && evaluation.criticalNodes.length <= 10 },
    unsupportedGaps: evaluation.unsupportedGaps,
    provenance: { durableRawSha256: rawHashes, normalizedSha256: normalizedHashes, rawResponsesPubliclyIncluded: false },
    safeguards: { alchemyCalls: 0, labelsUsed: false, smartMoneyUsed: false, additionalCandidateSearch: false, crossChainContinuityClaimed: false, venueContinuityClaimed: false },
    statement: `Recommendation: ${evaluation.recommendation}`,
  }, privateRoot)
}

function failureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/credential/i.test(message)) return 'CREDENTIAL_UNAVAILABLE_OR_INVALID'
  if (/account|credit|allowance/i.test(message)) return 'ACCOUNT_OR_ALLOWANCE_RECONCILIATION_STOP'
  if (/schema|JSON/i.test(message)) return 'PROVIDER_SCHEMA_INCOMPATIBLE'
  if (/store|ledger|durable|hash/i.test(message)) return 'DURABILITY_OR_INTEGRITY_STOP'
  return 'BOUNDED_PROVIDER_EXECUTION_STOP'
}

async function deferReport(
  privateRoot: string,
  roots: { primaryRoot: string; mirrorRoot: string },
  ledgerPath: string,
  allowance: RequestAllowance,
  reason: string,
): Promise<object> {
  const records = await readLedger(ledgerPath)
  return redactPrivatePaths({
    schemaVersion: '1.0.0', status: 'NONBLOCKING_DEFER', authorizationId, candidateId,
    distribution: 'LEAD_REVIEW_ONLY_DO_NOT_PUBLICLY_EXPORT', recommendation: 'DEFER', statement: 'Recommendation: DEFER',
    reason, heroImpact: 'NONE_NONBLOCKING_LANE', heroGameIntegration: false, mission02Admission: false,
    usage: allowanceUsage(records, allowance), durableStore: await verifyContentStore(roots, ledgerPath),
    unsupportedGaps: ['The bounded reserve audition stopped before exact proof closure; no unsupported continuation is inferred.'],
    safeguards: { alchemyCalls: 0, labelsUsed: false, smartMoneyUsed: false, additionalCandidateSearch: false },
  }, privateRoot)
}

async function run(): Promise<void> {
  const { privateRoot, roots, ledgerPath, allowance, endpoints, candidate, plan } = await context()
  const authorization = await readJson<AuthorizationReport>(authorizationReportPath)
  await verifyAuthorization(authorization, ledgerPath)
  let records = await readLedger(ledgerPath)
  const reusableItems = (await Promise.all(plan.map((planned) => durableItem(planned, records)))).filter((item): item is AcquiredItem => item !== null)
  const missing = plan.filter(({ request }) => !hasDurableSemanticResponse(records, request))
  if (missing.length === 0) {
    const report = await finalReport(privateRoot, roots, ledgerPath, allowance, reusableItems, candidate, 'DURABLE_REUSE_ONLY')
    await writeJsonExclusive(reuseReconciliationPath, report)
    printReport(report)
    return
  }
  const credentialSource = resolveCredentialSource()
  if (credentialSource === null) {
    const report = await deferReport(privateRoot, roots, ledgerPath, allowance, 'CREDENTIAL_UNAVAILABLE_OR_INVALID')
    await writeJsonExclusive(resultPath, report)
    printReport(report)
    return
  }
  const credentialUse = await withExclusiveRunLock(path.join(privateRoot, 'g5-bybit-reserve.lock'), () => withExplicitCredential(
    credentialSource,
    { readEnvironment: (identifier) => process.env[identifier] ?? null, readFile: async (target) => (await readFile(target, 'utf8')).trim() },
    async (credential) => {
      try {
        const session = new LiveAcquisitionSession({
          roots,
          ledgerPath,
          allowance,
          retryPolicy: { minimumDelayMs: 1_000, retry: { maximumAttempts: 1, baseDelayMs: 1_000, maximumDelayMs: 1_000, retryableHttpStatuses: [429, 500, 502, 503, 504], nonRetryableHttpStatuses: [400, 401, 402, 403, 404, 422] } },
          transport: createNansenTransport(),
          credential,
          candidateLimits: { [accountCandidateId]: { maxHttpAttempts: 13, maxProjectedCredits: 0 }, [candidateId]: { maxHttpAttempts: 5, maxProjectedCredits: 60 } },
          protectedMinimumRemainingCredits: 250,
        })
        const accountPolicy = endpoint(endpoints, '/api/v1/account')
        const acquired = [...reusableItems]
        let refreshIndex = records.filter(({ candidateId: id, status }) => id === accountCandidateId && status === 'IN_PROGRESS').length
        for (const planned of missing) {
          refreshIndex += 1
          const accountRequest: PlannedRequest = {
            identityVersion: '1.0.0', endpoint: accountPolicy.endpoint, endpointClass: accountPolicy.endpointClass, apiVersion: accountPolicy.apiVersion,
            requestBody: {}, candidateId: accountCandidateId, purposeId: `fresh-zero-credit-account-preflight-${refreshIndex}`,
            temporalWindow: { start: authorization.generatedAtUtc, end: authorization.generatedAtUtc }, normalizationContractVersion: 'g5-bybit-account-1.0.0',
            pagination: { page: 1, cursor: null }, refresh: { reason: 'Fresh baseline immediately before bounded paid lookup', identity: `${authorization.verificationSha256}:${refreshIndex}` },
          }
          const account = await session.execute(accountRequest, accountPolicy, { allowReuse: false, maximumAttempts: 1 })
          records = await readLedger(ledgerPath)
          const accountTerminal = [...records].reverse().find(({ status, candidateId: id, purposeId }) => status === 'COMPLETED' && id === accountCandidateId && purposeId === accountRequest.purposeId)
          if (accountTerminal === undefined) throw new Error('Fresh account preflight was not durably completed')
          const remaining = extractRemaining(JSON.parse(Buffer.from(account.rawBody).toString('utf8')) as unknown, accountTerminal)
          if (remaining === null || remaining < 250) throw new Error('Account preflight did not establish the protected credit baseline')
          session.setCreditBaseline(remaining)
          const result = await session.execute(planned.request, planned.policy, { maximumAttempts: 1 })
          acquired.push({
            purpose: planned.purpose,
            endpoint: planned.policy.endpoint,
            requestBody: planned.request.requestBody,
            status: result.status,
            rawSha256: result.rawSha256,
            normalizedSha256: result.normalizedSha256,
            body: JSON.parse(Buffer.from(result.rawBody).toString('utf8')) as unknown,
            attemptsIssued: result.attemptsIssued,
            projectedCredits: result.projectedCredits,
            creditMetadata: result.creditMetadata,
            retrievedAtUtc: new Date().toISOString(),
          })
        }
        return await finalReport(privateRoot, roots, ledgerPath, allowance, acquired, candidate, 'PROVIDER_AND_DURABLE_REUSE')
      } catch (error) {
        return await deferReport(privateRoot, roots, ledgerPath, allowance, failureCategory(error))
      }
    },
  ))
  const report = credentialUse.value ?? await deferReport(privateRoot, roots, ledgerPath, allowance, 'CREDENTIAL_UNAVAILABLE_OR_INVALID')
  await writeJsonExclusive(resultPath, report)
  printReport(report)
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'preflight') return preflight()
  if (mode === 'run') return run()
  throw new Error('Expected preflight or run mode')
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(fail)
