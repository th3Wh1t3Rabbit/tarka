import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { CandidateEvidenceGraph, EndpointPolicy, JsonObject, NormalizedEvidenceRecord, PlannedRequest, ProvenanceRecord, ProviderPolicy, PublicScenarioDraft, RequestAllowance } from '../../src/acquisition/contracts.js'
import { scoreCase } from '../../src/acquisition/evidence/score.js'
import { classifyTemporalEvidence } from '../../src/acquisition/evidence/temporal.js'
import { projectPublicScenario } from '../../src/acquisition/evidence/public-export.js'
import { withExplicitCredential } from '../../src/acquisition/integrity/credential.js'
import { readLedger } from '../../src/acquisition/integrity/ledger.js'
import { REQUIRED_PRECALL_COMMANDS, verifyPrecallAuthorization, type PrecallAuthorizationReport } from '../../src/acquisition/live/precall.js'
import { LiveAcquisitionSession, type LiveEndpointPolicy, withExclusiveRunLock } from '../../src/acquisition/live/executor.js'
import { createNansenTransport } from '../../src/acquisition/live/transport.js'
import { fingerprintRequest, sha256Hex, hashCanonicalObject } from '../../src/acquisition/integrity/identity.js'
import { loadReusableResponse } from '../../src/acquisition/integrity/store.js'
import { fail, getArgument, printReport, readJson, resolveCredentialSource, resolvePrivateStoreRoot, resolveRepositoryPath, writeJson } from './common.js'

export interface CandidateConfig {
  id: string
  chain: string
  auditionWindow: { start: string; end: string }
  contextWindow: { start: string; end: string }
  addresses: Record<string, string>
  transactions: Record<string, string>
  limits: { maxHttpAttempts: number; maxProjectedCredits: number }
}

interface CandidateConfigFile {
  schemaVersion: string
  threshold: number
  priorityOrder: string[]
  candidates: CandidateConfig[]
}

export interface EndpointConfigFile {
  endpoints: Array<LiveEndpointPolicy & { method: 'GET' | 'POST' }>
}

export interface AcquiredItem {
  purpose: string
  endpoint: string
  requestBody: JsonObject
  status: number
  rawSha256: string
  normalizedSha256: string
  body: unknown
  attemptsIssued: number
  projectedCredits: number
  creditMetadata: JsonObject | null
  retrievedAtUtc: string
}

function plannedRequest(candidate: CandidateConfig, purpose: string, endpointPolicy: EndpointPolicy, body: JsonObject): PlannedRequest {
  return {
    identityVersion: '1.0.0',
    endpoint: endpointPolicy.endpoint,
    endpointClass: endpointPolicy.endpointClass,
    apiVersion: endpointPolicy.apiVersion,
    requestBody: body,
    candidateId: candidate.id,
    purposeId: purpose,
    temporalWindow: { start: candidate.contextWindow.start, end: candidate.contextWindow.end },
    normalizationContractVersion: 'g4a-nansen-1.0.0',
    pagination: { page: 1, cursor: null },
    refresh: null,
  }
}

function parseJson(bytes: Uint8Array): unknown {
  try { return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown } catch { return null }
}

function findNumericField(value: unknown, names: ReadonlySet<string>): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumericField(item, names)
      if (found !== null) return found
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (names.has(key.toLowerCase()) && (typeof item === 'number' || (typeof item === 'string' && item.trim() !== '')) && Number.isFinite(Number(item))) return Number(item)
      const found = findNumericField(item, names)
      if (found !== null) return found
    }
  }
  return null
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Provider schema incompatible: ${context} must be an object`)
  return value as Record<string, unknown>
}

function dataRows(value: unknown, context: string): Record<string, unknown>[] {
  const root = record(value, context)
  if (!Array.isArray(root.data)) throw new Error(`Provider schema incompatible: ${context}.data must be an array`)
  return root.data.map((row, index) => record(row, `${context}.data[${index}]`))
}

export interface StructuredObservation {
  kind: 'TRANSACTION' | 'TOKEN_TRANSFER' | 'ADDRESS_ACTIVITY' | 'BALANCE_SNAPSHOT'
  grade: 'EXACT' | 'CORROBORATING' | 'CONTEXTUAL'
  endpoint: string
  rawSha256: string
  normalizedSha256: string
  retrievedAtUtc: string
  observedAtUtc: string
  transactionHash?: string
  sourceEventId?: string
  fromAddress?: string
  toAddress?: string
  asset?: string
  amount?: number
  sourcePurpose: string
}

export interface ConnectedRouteEvaluation {
  routeTransaction: string | undefined
  sourceAddress: string | undefined
  destinationAddress: string | undefined
  routeProof: boolean
  transformationProof: boolean
  routeObservations: StructuredObservation[]
  connectedObservations: StructuredObservation[]
}

export function evaluateConnectedRoute(candidate: CandidateConfig, observations: StructuredObservation[]): ConnectedRouteEvaluation {
  const routeTransaction = candidate.transactions.mev_dai_withdrawal_to_main_route ?? candidate.transactions.eth_drain
  const sourceAddress = candidate.addresses.mev_front_runner_exploiter_3 ?? candidate.addresses.initial_attacker
  const destinationAddress = candidate.addresses.main_recipient_exploiter_2 ?? candidate.addresses.main_exploiter_1 ?? candidate.addresses.known_exploiter_recipient
  if (routeTransaction === undefined || sourceAddress === undefined || destinationAddress === undefined) {
    return { routeTransaction, sourceAddress, destinationAddress, routeProof: false, transformationProof: false, routeObservations: [], connectedObservations: [] }
  }

  const edges = observations.filter((observation) => observation.grade === 'EXACT'
    && observation.transactionHash?.toLowerCase() === routeTransaction.toLowerCase()
    && observation.fromAddress !== undefined
    && observation.toAddress !== undefined)
  const start = sourceAddress.toLowerCase()
  const target = destinationAddress.toLowerCase()
  const queue: Array<{ address: string; usedTransfer: boolean; path: StructuredObservation[] }> = [{ address: start, usedTransfer: false, path: [] }]
  const visited = new Set([`${start}:false`])
  let routePath: StructuredObservation[] | null = null
  let transformedPath: StructuredObservation[] | null = null
  while (queue.length > 0) {
    const state = queue.shift()!
    if (state.address === target) {
      routePath ??= state.path
      if (state.usedTransfer) {
        transformedPath = state.path
        break
      }
    }
    for (const edge of edges) {
      if (edge.fromAddress!.toLowerCase() !== state.address) continue
      const next = edge.toAddress!.toLowerCase()
      const validTransfer = edge.kind === 'TOKEN_TRANSFER' && edge.asset !== undefined && edge.amount !== undefined && Number.isFinite(edge.amount)
      const usedTransfer = state.usedTransfer || validTransfer
      const key = `${next}:${usedTransfer}`
      if (visited.has(key)) continue
      visited.add(key)
      queue.push({ address: next, usedTransfer, path: [...state.path, edge] })
    }
  }
  return {
    routeTransaction,
    sourceAddress,
    destinationAddress,
    routeProof: routePath !== null || transformedPath !== null,
    transformationProof: transformedPath !== null,
    routeObservations: edges,
    connectedObservations: transformedPath ?? routePath ?? [],
  }
}

export function criticalSeedIdentities(candidate: CandidateConfig, observations: StructuredObservation[], connectedRoute: StructuredObservation[] = []): string[] {
  const exactHashes = new Set(observations.filter(({ grade, transactionHash }) => grade === 'EXACT' && transactionHash !== undefined).map(({ transactionHash }) => transactionHash!.toLowerCase()))
  const observedAddresses = new Set(observations.flatMap(({ fromAddress, toAddress }) => [fromAddress, toAddress].filter((value): value is string => value !== undefined).map((value) => value.toLowerCase())))
  const identities = [
    ...Object.values(candidate.transactions).filter((hash) => exactHashes.has(hash.toLowerCase())),
    ...Object.values(candidate.addresses).filter((address) => observedAddresses.has(address.toLowerCase())),
    ...connectedRoute.flatMap(({ fromAddress, toAddress }) => [fromAddress, toAddress].filter((value): value is string => value !== undefined)),
  ]
  return [...new Map(identities.map((identity) => [identity.toLowerCase(), identity])).values()]
}

function requiredString(row: Record<string, unknown>, key: string, context: string): string {
  if (typeof row[key] !== 'string' || !(row[key] as string).trim()) throw new Error(`Provider schema incompatible: ${context}.${key} must be a string`)
  return row[key] as string
}

function requiredUtcTimestamp(row: Record<string, unknown>, key: string, context: string): string {
  const value = requiredString(row, key, context)
  const candidate = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value
  const parsed = Date.parse(candidate)
  if (!Number.isFinite(parsed)) throw new Error(`Provider schema incompatible: ${context}.${key} must be a timestamp`)
  return new Date(parsed).toISOString()
}

export function parseObservations(item: AcquiredItem): StructuredObservation[] {
  const observations: StructuredObservation[] = []
  const rows = dataRows(item.body, item.purpose)
  if (item.endpoint === '/api/v1/transaction-with-token-transfer-lookup') {
    const expected = item.requestBody.transaction_hash
    if (typeof expected !== 'string') throw new Error('Exact request identity is missing')
    for (const [index, row] of rows.entries()) {
      const context = `${item.purpose}.data[${index}]`
      const transactionHash = requiredString(row, 'transaction_hash', context)
      const observedAtUtc = requiredUtcTimestamp(row, 'block_timestamp', context)
      const fromAddress = requiredString(row, 'from_address', context)
      const toAddress = requiredString(row, 'to_address', context)
      requiredString(row, 'chain', context)
      if (!Array.isArray(row.token_transfer_array)) throw new Error(`Provider schema incompatible: ${context}.token_transfer_array must be an array`)
      if (transactionHash.toLowerCase() !== expected.toLowerCase()) continue
      observations.push({ kind: 'TRANSACTION', grade: 'EXACT', endpoint: item.endpoint, rawSha256: item.rawSha256, normalizedSha256: item.normalizedSha256, retrievedAtUtc: item.retrievedAtUtc, observedAtUtc, transactionHash, sourceEventId: transactionHash, fromAddress, toAddress, asset: 'NATIVE', ...(typeof row.native_value === 'number' ? { amount: row.native_value } : {}), sourcePurpose: item.purpose })
      for (const [transferIndex, transferValue] of row.token_transfer_array.entries()) {
        const transfer = record(transferValue, `${context}.token_transfer_array[${transferIndex}]`)
        if (typeof transfer.token_amount !== 'number' || !Number.isFinite(transfer.token_amount)) throw new Error(`Provider schema incompatible: ${context}.token_amount must be numeric`)
        observations.push({
          kind: 'TOKEN_TRANSFER', grade: 'EXACT', endpoint: item.endpoint, rawSha256: item.rawSha256, normalizedSha256: item.normalizedSha256, retrievedAtUtc: item.retrievedAtUtc, observedAtUtc, transactionHash,
          sourceEventId: requiredString(transfer, 'transfer_id', `${context}.token_transfer_array[${transferIndex}]`),
          fromAddress: requiredString(transfer, 'from_address', context), toAddress: requiredString(transfer, 'to_address', context),
          asset: requiredString(transfer, 'token_address', context), amount: transfer.token_amount, sourcePurpose: item.purpose,
        })
      }
    }
  } else if (item.endpoint === '/api/v1/profiler/address/transactions') {
    for (const [index, row] of rows.entries()) {
      const context = `${item.purpose}.data[${index}]`
      const transactionHash = requiredString(row, 'transaction_hash', context)
      observations.push({ kind: 'ADDRESS_ACTIVITY', grade: 'CONTEXTUAL', endpoint: item.endpoint, rawSha256: item.rawSha256, normalizedSha256: item.normalizedSha256, retrievedAtUtc: item.retrievedAtUtc, observedAtUtc: requiredUtcTimestamp(row, 'block_timestamp', context), transactionHash, sourceEventId: transactionHash, sourcePurpose: item.purpose })
    }
  } else if (item.endpoint === '/api/v1/profiler/address/historical-balances') {
    const address = item.requestBody.address
    if (typeof address !== 'string') throw new Error('Historical balance request address is missing')
    for (const [index, row] of rows.entries()) {
      const context = `${item.purpose}.data[${index}]`
      observations.push({ kind: 'BALANCE_SNAPSHOT', grade: 'CORROBORATING', endpoint: item.endpoint, rawSha256: item.rawSha256, normalizedSha256: item.normalizedSha256, retrievedAtUtc: item.retrievedAtUtc, observedAtUtc: requiredUtcTimestamp(row, 'block_timestamp', context), toAddress: address, asset: requiredString(row, 'token_address', context), ...(typeof row.token_amount === 'number' ? { amount: row.token_amount } : {}), sourcePurpose: item.purpose })
    }
  }
  return observations
}

export function toNormalizedRecord(candidate: CandidateConfig, observation: StructuredObservation): NormalizedEvidenceRecord {
  const lens = observation.grade === 'CORROBORATING' ? 'STATE_ECHO' : observation.kind === 'TOKEN_TRANSFER' ? 'CONVERSION_TRACE' : 'ROUTE_SCAN'
  const endpointClass = observation.grade === 'CORROBORATING' ? 'historical-balances' : 'historical-events'
  const temporal = classifyTemporalEvidence({ endpointClass, requestedLens: lens, observedEventTimeUtc: observation.observedAtUtc, caseCutoffUtc: candidate.auditionWindow.end })
  const facts = {
    eventId: hashCanonicalObject({ purpose: observation.sourcePurpose, sourceEventId: observation.sourceEventId ?? null, time: observation.observedAtUtc, transactionHash: observation.transactionHash ?? null, from: observation.fromAddress ?? null, to: observation.toAddress ?? null, asset: observation.asset ?? null, amount: observation.amount ?? null } as never),
    kind: observation.kind,
    ...(observation.transactionHash === undefined ? {} : { transactionHash: observation.transactionHash }),
    ...(observation.fromAddress === undefined ? {} : { fromEntity: observation.fromAddress }),
    ...(observation.toAddress === undefined ? {} : { toEntity: observation.toAddress }),
    ...(observation.asset === undefined ? {} : { asset: observation.asset }),
    ...(observation.amount === undefined ? {} : { amount: observation.amount }),
  } as JsonObject
  return {
    schemaVersion: '1.0.0', evidenceId: `${candidate.id}:${facts.eventId as string}`, candidateId: candidate.id,
    sourceEndpoint: observation.endpoint, endpointClass, requestedStartUtc: candidate.contextWindow.start, requestedEndUtc: candidate.contextWindow.end, sourceRetrievedAtUtc: observation.retrievedAtUtc,
    observedEventTimeUtc: observation.observedAtUtc, temporalClass: temporal.temporalClass, caseCutoffUtc: candidate.auditionWindow.end,
    admissibleToChrono: temporal.admissibleToChrono, requestedLens: lens, sourceRawSha256: observation.rawSha256, facts,
  }
}

export function isInsideContextWindow(candidate: CandidateConfig, observation: StructuredObservation): boolean {
  const observedAt = Date.parse(observation.observedAtUtc)
  return observedAt >= Date.parse(candidate.contextWindow.start) && observedAt <= Date.parse(candidate.contextWindow.end)
}

export function normalizeUniqueEvidence(candidate: CandidateConfig, observations: StructuredObservation[]): Array<{ observation: StructuredObservation; normalized: NormalizedEvidenceRecord }> {
  const uniqueEvidence = new Map<string, { observation: StructuredObservation; normalized: NormalizedEvidenceRecord }>()
  for (const observation of observations) {
    const normalized = toNormalizedRecord(candidate, observation)
    if (!uniqueEvidence.has(normalized.evidenceId)) uniqueEvidence.set(normalized.evidenceId, { observation, normalized })
  }
  return [...uniqueEvidence.values()]
}

function endpoint(config: EndpointConfigFile, endpointPath: string): LiveEndpointPolicy {
  const matches = config.endpoints.filter((entry) => entry.endpoint === endpointPath)
  if (matches.length !== 1) throw new Error(`Reviewed endpoint policy missing or ambiguous: ${endpointPath}`)
  return matches[0]!
}

export function candidateRequestPlan(candidate: CandidateConfig, endpoints: EndpointConfigFile): Array<{ purpose: string; policy: LiveEndpointPolicy; body: JsonObject; request: PlannedRequest }> {
  const plan: Array<{ purpose: string; policy: LiveEndpointPolicy; body: JsonObject; request: PlannedRequest }> = []
  const add = (purpose: string, policy: LiveEndpointPolicy, body: JsonObject) => plan.push({ purpose, policy, body, request: plannedRequest(candidate, purpose, policy, body) })
  const lookupPolicy = endpoint(endpoints, '/api/v1/transaction-with-token-transfer-lookup')
  const transactionsPolicy = endpoint(endpoints, '/api/v1/profiler/address/transactions')
  const balancesPolicy = endpoint(endpoints, '/api/v1/profiler/address/historical-balances')
  for (const [name, transactionHash] of Object.entries(candidate.transactions)) add(`exact-${name}`, lookupPolicy, { chain: candidate.chain, transaction_hash: transactionHash })
  for (const [name, address] of Object.entries(candidate.addresses).slice(0, 4)) add(`window-${name}`, transactionsPolicy, {
    address, chain: candidate.chain, date: { from: candidate.contextWindow.start, to: candidate.contextWindow.end }, hide_spam_token: true, pagination: { page: 1, per_page: 100 },
  })
  if (candidate.id.startsWith('EULER')) {
    for (const [name, address] of Object.entries(candidate.addresses).slice(0, 4)) add(`state-${name}`, balancesPolicy, {
      address, chain: candidate.chain, date: { from: candidate.contextWindow.start, to: candidate.contextWindow.end }, pagination: { page: 1, per_page: 100 },
    })
  }
  return plan
}

async function acquireCandidate(candidate: CandidateConfig, threshold: number, session: LiveAcquisitionSession, endpoints: EndpointConfigFile): Promise<{ report: JsonObject; items: AcquiredItem[] }> {
  const items: AcquiredItem[] = []

  const execute = async (purpose: string, policy: LiveEndpointPolicy, body: JsonObject, request: PlannedRequest) => {
    const result = await session.execute(request, policy)
    const parsed = parseJson(result.rawBody)
    if (parsed === null) throw new Error(`Provider schema incompatible for ${purpose}`)
    items.push({ purpose, endpoint: policy.endpoint, requestBody: body, status: result.status, rawSha256: result.rawSha256, normalizedSha256: result.normalizedSha256, body: parsed, attemptsIssued: result.attemptsIssued, projectedCredits: result.projectedCredits, creditMetadata: result.creditMetadata, retrievedAtUtc: new Date().toISOString() })
  }

  for (const planned of candidateRequestPlan(candidate, endpoints)) await execute(planned.purpose, planned.policy, planned.body, planned.request)

  return { items, report: buildCandidateReport(candidate, threshold, items, endpoints) }
}

export function buildCandidateReport(candidate: CandidateConfig, threshold: number, items: AcquiredItem[], endpoints: EndpointConfigFile): JsonObject {
  const attemptsIssued = items.reduce((sum, item) => sum + item.attemptsIssued, 0)
  const projectedCredits = items.reduce((sum, item) => sum + item.projectedCredits, 0)
  if (attemptsIssued > candidate.limits.maxHttpAttempts || projectedCredits > candidate.limits.maxProjectedCredits) throw new Error('Candidate allowance exceeded')
  const acquiredObservations = items.flatMap(parseObservations)
  const outOfWindowObservations = acquiredObservations.filter((observation) => !isInsideContextWindow(candidate, observation))
  const uniqueEvidence = normalizeUniqueEvidence(candidate, acquiredObservations.filter((observation) => isInsideContextWindow(candidate, observation)))
  const observations = uniqueEvidence.map(({ observation }) => observation)
  const normalizedRecords = uniqueEvidence.map(({ normalized }) => normalized)
  const admissibleRecords = normalizedRecords.filter(({ admissibleToChrono }) => admissibleToChrono)
  const admissibleEvidenceIds = new Set(admissibleRecords.map(({ evidenceId }) => evidenceId))
  const admissibleObservations = observations.filter((_, index) => admissibleEvidenceIds.has(normalizedRecords[index]!.evidenceId))
  const exactHashes = new Set(admissibleObservations.filter(({ grade, transactionHash }) => grade === 'EXACT' && transactionHash !== undefined).map(({ transactionHash }) => transactionHash!.toLowerCase()))
  const exactFound = Object.values(candidate.transactions).filter((hash) => exactHashes.has(hash.toLowerCase())).length
  const observedAddresses = new Set(admissibleObservations.flatMap(({ fromAddress, toAddress }) => [fromAddress, toAddress].filter((value): value is string => value !== undefined).map((value) => value.toLowerCase())))
  const addressCoverage = Object.values(candidate.addresses).filter((address) => observedAddresses.has(address.toLowerCase())).length
  const balanceObservations = admissibleObservations.filter(({ kind }) => kind === 'BALANCE_SNAPSHOT')
  const balanceGroups = new Map<string, StructuredObservation[]>()
  for (const observation of balanceObservations) {
    const key = `${observation.toAddress}:${observation.asset}`
    balanceGroups.set(key, [...(balanceGroups.get(key) ?? []), observation])
  }
  const balanceCorroboration = [...balanceGroups.values()].filter((group) => new Set(group.map(({ amount }) => amount)).size > 1 && new Set(group.map(({ observedAtUtc }) => observedAtUtc)).size > 1).length
  const connectedRoute = evaluateConnectedRoute(candidate, admissibleObservations)
  const { routeProof, transformationProof } = connectedRoute
  const timestampEvidence = admissibleObservations.filter(({ observedAtUtc }) => Number.isFinite(Date.parse(observedAtUtc))).length
  const criticalNodes = criticalSeedIdentities(candidate, admissibleObservations, connectedRoute.routeObservations)
  const fatalDefects = [] as Array<'NO_EXACT_PROOF_CLOSURE' | 'ESSENTIAL_UNSUPPORTED_GAP' | 'GRAPH_NOT_HONESTLY_COMPRESSIBLE'>
  if (exactFound !== Object.keys(candidate.transactions).length) fatalDefects.push('NO_EXACT_PROOF_CLOSURE')
  if (!routeProof || !transformationProof || (candidate.id.startsWith('EULER') && balanceCorroboration < 1)) fatalDefects.push('ESSENTIAL_UNSUPPORTED_GAP')
  if (criticalNodes.length < 6 || criticalNodes.length > 10) fatalDefects.push('GRAPH_NOT_HONESTLY_COMPRESSIBLE')
  const categories = {
    proofClosureAuditability: exactFound === Object.keys(candidate.transactions).length ? 20 : Math.min(19, exactFound * 4),
    nansenIndispensability: exactFound > 0 && addressCoverage > 0 && balanceCorroboration > 0 ? 15 : exactFound > 0 ? 8 : 0,
    branchTransformationTopology: routeProof && transformationProof && addressCoverage >= 2 ? 15 : addressCoverage >= 2 ? 8 : 0,
    timeMechanicPotential: timestampEvidence >= 2 ? 10 : timestampEvidence > 0 ? 5 : 0,
    nonexpertNarrativeClarity: routeProof ? 10 : 5,
    replayTruthfulDepth: routeProof ? 9 : 4,
    visualWorldReadability: criticalNodes.length >= 6 && criticalNodes.length <= 10 ? 10 : 4,
    complianceDataReliability: admissibleObservations.length > 0 && admissibleObservations.length === observations.length ? 10 : admissibleObservations.length > 0 ? 6 : 0,
  }
  const connectedEvidenceIds = new Set(connectedRoute.connectedObservations.map((observation) => toNormalizedRecord(candidate, observation).evidenceId))
  const graph: CandidateEvidenceGraph = { schemaVersion: '1.0.0', candidateId: candidate.id, caseCutoffUtc: candidate.auditionWindow.end, evidence: admissibleRecords, derivedClaims: routeProof ? [{ claimId: 'route-continuity', evidenceIds: admissibleRecords.filter(({ evidenceId }) => connectedEvidenceIds.has(evidenceId)).map(({ evidenceId }) => evidenceId), statement: 'Exact transfer records establish the candidate route continuity.' }] : [] }
  if (graph.derivedClaims[0]?.evidenceIds.length === 0) graph.derivedClaims = []
  const providerPolicy: ProviderPolicy = { schemaVersion: '1.0.0', provider: 'FUTURE_NANSEN_BUILD_TIME', requestProtocol: { method: 'POST', contentType: 'application/json' }, authentication: { method: 'HEADER', headerName: 'apikey', g3Resolution: 'DISABLED' }, concurrency: 1, minimumDelayMs: 1000, retryAfterSemantics: 'HONOR_SECONDS_OR_HTTP_DATE', historicalResponsePolicy: 'MAY_BE_RESTATED', retry: { maximumAttempts: 3, baseDelayMs: 1000, maximumDelayMs: 8000, retryableHttpStatuses: [429, 500, 502, 503, 504], nonRetryableHttpStatuses: [400, 401, 402, 403, 404, 422] }, endpoints: endpoints.endpoints }
  let publicDraft: PublicScenarioDraft | null = null
  if (admissibleRecords.length > 0) {
    const provenance: ProvenanceRecord = { schemaVersion: '1.0.0', candidateId: candidate.id, caseCutoffUtc: candidate.auditionWindow.end, sourceRawSha256: [...new Set(items.map(({ rawSha256 }) => rawSha256))], normalizedSha256: [...new Set(items.map(({ normalizedSha256 }) => normalizedSha256))], candidateGraphSha256: hashCanonicalObject(graph as never), publicScenarioSha256: '0'.repeat(64), generatedAtUtc: items.map(({ retrievedAtUtc }) => retrievedAtUtc).sort().at(-1)! }
    publicDraft = projectPublicScenario(graph, provenance, providerPolicy)
  }
  const score = scoreCase({ candidateId: candidate.id, categories, fatalDefects, eligibilityThreshold: threshold })
  const normalizedGraph = { schemaVersion: '1.0.0', candidateId: candidate.id, cutoffUtc: candidate.auditionWindow.end, allEvidence: normalizedRecords, publicEvidenceCount: admissibleRecords.length, postCutoffOrUnknownOmitted: normalizedRecords.length - admissibleRecords.length, routeContinuityProved: routeProof, transformationProved: transformationProof }
  const exactEventTransferGraph = { nodes: criticalNodes, edges: admissibleObservations.filter(({ grade }) => grade === 'EXACT').map(({ transactionHash, fromAddress, toAddress, asset, amount, observedAtUtc }) => ({ transactionHash: transactionHash ?? null, fromAddress: fromAddress ?? null, toAddress: toAddress ?? null, asset: asset ?? null, amount: amount ?? null, observedAtUtc })) }
  const addressStateGraph = { snapshots: admissibleObservations.filter(({ kind }) => kind === 'BALANCE_SNAPSHOT').map(({ toAddress, asset, amount, observedAtUtc, rawSha256 }) => ({ address: toAddress ?? null, asset: asset ?? null, amount: amount ?? null, observedAtUtc, rawSha256 })) }
  const unsupportedGapReport = fatalDefects.map((defect) => ({ defect, status: 'UNSUPPORTED', blocksPromotion: true }))
  const recommendation = score.eligible ? 'ADVANCE_FOR_LEAD_BINDING' : fatalDefects.length > 0 ? 'REJECT' : 'INCONCLUSIVE'
  const answers = [
    'The initiating event is the supplied seed transaction sequence inside the fixed audition window.',
    exactFound === Object.keys(candidate.transactions).length ? 'Every supplied seed transaction is returned by exact Nansen lookup.' : `${exactFound} of ${Object.keys(candidate.transactions).length} supplied seed transactions are returned by exact lookup.`,
    routeProof ? 'The stored transfer lookup proves the supplied changed-form/continuity route at transaction level.' : 'The acquired response set does not yet prove a changed-form continuity route.',
    routeProof ? 'The supplied destination address is present in the exact route evidence.' : 'A terminal destination is not proven by the acquired set.',
    'The plausible false interpretation is that the first branch is an independent terminal destination.',
    routeProof ? 'The exact transfer lookup links the route transaction to the supplied main destination, falsifying independence.' : 'No acquired item conclusively falsifies the independent-destination theory.',
    'Nansen exact transaction-plus-transfer lookup is indispensable to the transaction-level continuity claim.',
    'Bounded address activity is contextual; historical balances corroborate state but do not prove causation.',
    'Events outside the supplied windows, labels, unrelated counterparties, later recovery activity, and unrelated assets are omitted for scope and temporal integrity.',
    criticalNodes.length >= 6 && criticalNodes.length <= 10 ? 'The critical path fits the 6–10-node guardrail; Lead-authored integration remains separate.' : 'The graph is not yet honestly compressible to the player-flow guardrail.',
    fatalDefects.length === 0 ? 'No fatal gap remains in the audition-level evidence package.' : `Unsupported findings: ${fatalDefects.join(', ')}.`,
    score.eligible ? 'No next paid call is justified before Lead review.' : 'A narrowly targeted call should address only the listed fatal gap, subject to fresh Lead authority.',
  ]
  return {
    schemaVersion: '1.0.0', candidateId: candidate.id, recommendation, heroSelected: false,
    score: score as unknown as JsonObject, measurements: { exactFound, exactExpected: Object.keys(candidate.transactions).length, addressCoverage, balanceCorroboration, routeProof, transformationProof, criticalNodeCount: criticalNodes.length, attemptsIssued, projectedCredits },
    fatalDefects, textOnlyPossibleRoute: criticalNodes, plausibleWrongTheory: answers[4]!,
    answers, normalizedEvidenceGraph: normalizedGraph as never, exactEventTransferGraph, addressStateGraph, criticalPathGraph: { nodes: criticalNodes, routeContinuityProved: routeProof },
    evidenceClassification: { EXACT: admissibleObservations.filter(({ grade }) => grade === 'EXACT').length, CORROBORATING: admissibleObservations.filter(({ grade }) => grade === 'CORROBORATING').length, CONTEXTUAL: admissibleObservations.filter(({ grade }) => grade === 'CONTEXTUAL').length },
    omittedEventCensus: { postCutoffOrUnknown: normalizedRecords.length - admissibleRecords.length, outOfWindow: outOfWindowObservations.length, unrelatedCandidates: 'not acquired', labels: 'stripped by field policy' }, unsupportedGapReport,
    publicScenarioDraft: publicDraft as never, attribution: { provider: 'Nansen', endpointPolicies: [...new Set(items.map(({ endpoint: sourceEndpoint }) => sourceEndpoint))], purpose: 'Lead-only historical candidate audition' },
  }
}

async function main() {
  for (const forbiddenOverride of ['--precall', '--review', '--report-root']) if (process.argv.includes(forbiddenOverride)) throw new Error(`The G4A campaign path is fixed and cannot be overridden: ${forbiddenOverride}`)
  const precallPath = resolveRepositoryPath(getArgument('--precall') ?? 'artifacts/g4a/PRECALL_AUTHORIZATION_REPORT.json')
  const precall = await readJson<PrecallAuthorizationReport>(path.relative(process.cwd(), precallPath))
  const reviewPath = resolveRepositoryPath(getArgument('--review') ?? 'artifacts/g4a/PRECALL_REVIEW.json')
  const snapshotFiles = {
    allowance: await readFile('src/acquisition/config/g4a-allowance.json'),
    candidates: await readFile('src/acquisition/config/g4a-candidates.json'),
    endpoints: await readFile('src/acquisition/config/nansen-endpoints.json'),
    agents: await readFile('AGENTS.md'),
    review: await readFile(reviewPath),
  }
  const commandLogHashes: Record<string, string> = {}
  for (const name of REQUIRED_PRECALL_COMMANDS) commandLogHashes[name] = sha256Hex(await readFile(path.join(path.dirname(precallPath), 'precall-logs', `${name}.log`)))
  const credentialSource = resolveCredentialSource()
  if (credentialSource === null) throw new Error('An explicit credential source is required')
  const privateRoot = resolvePrivateStoreRoot()
  const reportRoot = resolveRepositoryPath(getArgument('--report-root') ?? 'artifacts/g4a')
  const allowance = await readJson<RequestAllowance>('src/acquisition/config/g4a-allowance.json')
  const candidates = await readJson<CandidateConfigFile>('src/acquisition/config/g4a-candidates.json')
  const endpoints = await readJson<EndpointConfigFile>('src/acquisition/config/nansen-endpoints.json')
  const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const currentTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
  const gitRoot = path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim())
  if (gitRoot !== path.resolve(process.cwd())) throw new Error('G4A must run from the canonical repository root')
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim() !== '') throw new Error('Tracked working tree changed after pre-call review')
  verifyPrecallAuthorization(precall, {
    currentCommit,
    currentTree,
    authorizationId: allowance.leadAuthorizationId,
    campaignRootBindingSha256: sha256Hex(privateRoot),
    snapshots: { ...Object.fromEntries(Object.entries(snapshotFiles).map(([name, bytes]) => [name, sha256Hex(bytes)])), ...Object.fromEntries(Object.entries(commandLogHashes).map(([name, digest]) => [`log:${name}`, digest])) },
    commandLogHashes,
    nowUtc: new Date().toISOString(),
  })
  const retryPolicy = {
    minimumDelayMs: 1_000,
    retry: { maximumAttempts: 3, baseDelayMs: 1_000, maximumDelayMs: 8_000, retryableHttpStatuses: [429, 500, 502, 503, 504], nonRetryableHttpStatuses: [400, 401, 402, 403, 404, 422] },
  }
  const roots = { primaryRoot: path.join(privateRoot, 'primary'), mirrorRoot: path.join(privateRoot, 'mirror') }
  const ledgerPath = path.join(privateRoot, 'primary', 'ledger', 'calls.jsonl')
  const credentialUse = await withExclusiveRunLock(path.join(privateRoot, 'g4a-run.lock'), () => withExplicitCredential(
    credentialSource,
    { readEnvironment: (identifier) => process.env[identifier] ?? null, readFile: async (target) => (await readFile(target, 'utf8')).trim() },
    async (credential) => {
      try {
      const candidateLimits = Object.fromEntries(candidates.candidates.map(({ id, limits }) => [id, limits]))
      candidateLimits.G4A_ACCOUNT_PREFLIGHT = { maxHttpAttempts: 1, maxProjectedCredits: 0 }
      const session = new LiveAcquisitionSession({ roots, ledgerPath, allowance, retryPolicy, transport: createNansenTransport(), credential, candidateLimits, protectedMinimumRemainingCredits: 250 })
      const accountCandidate: CandidateConfig = { id: 'G4A_ACCOUNT_PREFLIGHT', chain: 'ethereum', auditionWindow: { start: precall.generatedAtUtc, end: precall.generatedAtUtc }, contextWindow: { start: precall.generatedAtUtc, end: precall.generatedAtUtc }, addresses: {}, transactions: {}, limits: { maxHttpAttempts: 1, maxProjectedCredits: 0 } }
      const accountPolicy = endpoint(endpoints, '/api/v1/account')
      const accountRequest = { ...plannedRequest(accountCandidate, 'zero-credit-account-preflight', accountPolicy, {}), refresh: { reason: 'Fresh authorized account preflight', identity: precall.verificationSha256 } }
      const durableAccount = await loadReusableResponse(roots, ledgerPath, accountRequest)
      const account = durableAccount === null
        ? await session.execute(accountRequest, accountPolicy, { allowReuse: false, maximumAttempts: 1 })
        : await session.execute(accountRequest, accountPolicy)
      const accountBody = parseJson(account.rawBody)
      const remaining = findNumericField(accountBody, new Set(['credits_remaining', 'creditsremaining', 'remaining_credits', 'remainingcredits']))
        ?? findNumericField(account.creditMetadata, new Set(['x-nansen-credits-remaining']))
      const accountReport = { schemaVersion: '1.0.0', status: account.status === 200 ? 'PASS' : 'FAIL', credentialStatus: 'PRESENT_REDACTED', plan: typeof accountBody === 'object' && accountBody !== null && typeof (accountBody as Record<string, unknown>).plan === 'string' ? (accountBody as Record<string, unknown>).plan : 'REDACTED_OR_UNAVAILABLE', remainingCredits: remaining, projectedCredits: 0, attemptsIssued: account.attemptsIssued, rawSha256: account.rawSha256 }
      await writeJson(path.relative(process.cwd(), path.join(reportRoot, 'ACCOUNT_PREFLIGHT_REDACTED.json')), accountReport)
      if (remaining === null || remaining < 250) return { status: 'BLOCKED_WITH_EVIDENCE', reason: 'ACCOUNT_PREFLIGHT_INSUFFICIENT_OR_UNREPORTED_CREDITS', accountReport }
      await writeJson(path.relative(process.cwd(), path.join(reportRoot, 'G4A_RUNTIME_AUTHORIZATION_STATE.json')), { schemaVersion: '1.0.0', precallVerificationSha256: precall.verificationSha256, credentialStatus: 'PRESENT_REDACTED', accountRequestFingerprint: fingerprintRequest(accountRequest), accountRawSha256: account.rawSha256, accountRemainingCredits: remaining, accountResponseReusedOnResume: account.reused })
      const durableBeforeAudition = await readLedger(ledgerPath)
      const durablePaidRemaining = [...durableBeforeAudition].reverse()
        .filter(({ status, plannedCreditEstimate }) => ['COMPLETED', 'FAILED'].includes(status) && plannedCreditEstimate > 0)
        .map(({ returnedCreditMetadata }) => findNumericField(returnedCreditMetadata, new Set(['x-nansen-credits-remaining'])))
        .find((value): value is number => value !== null && value <= remaining)
      session.setCreditBaseline(remaining, durablePaidRemaining ?? remaining)

      const candidateReports: JsonObject[] = []
      for (const candidateId of candidates.priorityOrder) {
        const candidate = candidates.candidates.find(({ id }) => id === candidateId)
        if (!candidate) throw new Error(`Missing candidate ${candidateId}`)
        const result = await acquireCandidate(candidate, candidates.threshold, session, endpoints)
        candidateReports.push(result.report)
        await writeJson(path.relative(process.cwd(), path.join(reportRoot, `${candidate.id}_CANDIDATE_REPORT.json`)), result.report)
        const score = result.report.score as unknown as { eligible: boolean }
        if (candidate.id === 'EULER_2023_INITIAL_EXPLOIT' && score.eligible) break
      }
      const records = await readLedger(ledgerPath)
      const issued = records.filter(({ status }) => status === 'IN_PROGRESS')
      const terminals = records.filter(({ status }) => ['COMPLETED', 'FAILED'].includes(status))
      const numeric = (record: typeof terminals[number], name: string) => {
        const value = record.returnedCreditMetadata?.[name]
        return (typeof value === 'string' || typeof value === 'number') && Number.isFinite(Number(value)) ? Number(value) : null
      }
      const actualCreditsUsed = terminals.reduce((sum, record) => sum + (numeric(record, 'x-nansen-credits-used') ?? record.plannedCreditEstimate), 0)
      const endingRemaining = [...terminals].reverse().map((record) => numeric(record, 'x-nansen-credits-remaining')).find((value) => value !== null) ?? remaining
      const accountDelta = remaining - endingRemaining
      const use = { httpAttemptsIssued: issued.length, projectedCredits: issued.reduce((sum, record) => sum + record.plannedCreditEstimate, 0), actualCreditsUsed, accountCreditDelta: accountDelta, firstReportedRemaining: remaining, lastReportedRemaining: endingRemaining, countTowardBuildathon1000: false, returnedCreditMetadataRecords: terminals.filter(({ returnedCreditMetadata }) => returnedCreditMetadata !== null).length }
      if (use.httpAttemptsIssued > 64 || use.projectedCredits > 200 || actualCreditsUsed > 200 || accountDelta < 0 || accountDelta > 200 || Math.abs(accountDelta - actualCreditsUsed) > 0.000001) throw new Error('Global allowance or provider-credit reconciliation failed')
      const runReport = { schemaVersion: '1.0.0', status: 'COMPLETED_PENDING_LEAD_REVIEW', authorizationId: allowance.leadAuthorizationId, heroSelected: false, accountPreflight: accountReport, actualUse: use, candidatesAudited: candidateReports.map((report) => report.candidateId), eulerThresholdStopApplied: candidateReports.length === 1 && (candidateReports[0]!.score as unknown as { eligible: boolean }).eligible }
      await writeJson(path.relative(process.cwd(), path.join(reportRoot, 'G4A_AUDITION_RUN_REPORT.json')), runReport)
      return runReport
      } catch (error) {
        const blocked = { schemaVersion: '1.0.0', status: 'BLOCKED_WITH_EVIDENCE', reason: 'ACQUISITION_STOP_CONDITION', detail: error instanceof Error ? error.message : 'Unknown acquisition failure', credentialStatus: 'PRESENT_REDACTED', heroSelected: false }
        await writeJson(path.relative(process.cwd(), path.join(reportRoot, 'G4A_AUDITION_RUN_REPORT.json')), blocked)
        return blocked
      }
    },
  ))
  if (credentialUse.presence.status !== 'PRESENT' || credentialUse.value === undefined) {
    const blocked = { status: 'BLOCKED_WITH_EVIDENCE', reason: 'AUTHORIZED_PROJECT_CREDENTIAL_COULD_NOT_BE_RESOLVED', credentialStatus: credentialUse.presence.status }
    await writeJson(path.relative(process.cwd(), path.join(reportRoot, 'G4A_AUDITION_RUN_REPORT.json')), blocked)
    printReport(blocked)
    process.exitCode = 1
    return
  }
  printReport(credentialUse.value)
  if (credentialUse.value.status === 'BLOCKED_WITH_EVIDENCE') process.exitCode = 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(fail)
