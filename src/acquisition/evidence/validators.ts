import type {
  CandidateEvidenceGraph,
  CandidateSeed,
  EndpointClass,
  EvidenceLens,
  FatalDefect,
  JsonObject,
  NormalizedEvidenceRecord,
  PlannedRequest,
  ProvenanceRecord,
  PublicScenarioDraft,
  ScoreCategory,
} from '../contracts.js'
import { classifyTemporalEvidence } from './temporal.js'

export class EvidenceValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvidenceValidationError'
  }
}

const ENDPOINT_CLASSES = [
  'historical-events',
  'historical-balances',
  'current-relationships',
  'current-portfolio',
] as const satisfies readonly EndpointClass[]
const LENSES = ['ROUTE_SCAN', 'STATE_ECHO', 'CONVERSION_TRACE', 'ECHO_ONLY'] as const satisfies readonly EvidenceLens[]
const SCORE_CATEGORIES = [
  'proofClosureAuditability',
  'nansenIndispensability',
  'branchTransformationTopology',
  'timeMechanicPotential',
  'nonexpertNarrativeClarity',
  'replayTruthfulDepth',
  'visualWorldReadability',
  'complianceDataReliability',
] as const satisfies readonly ScoreCategory[]
const FATAL_DEFECTS = [
  'NO_EXACT_PROOF_CLOSURE',
  'ESSENTIAL_UNSUPPORTED_GAP',
  'LOOK_AHEAD_LEAKAGE',
  'PROHIBITED_PUBLIC_DATA_DEPENDENCY',
  'GRAPH_NOT_HONESTLY_COMPRESSIBLE',
  'INVENTED_CLUE_DEPENDENCY',
] as const satisfies readonly FatalDefect[]
const SHA256 = /^[a-f0-9]{64}$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

function fail(path: string, message: string): never {
  throw new EvidenceValidationError(`${path}: ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(path, `unexpected or missing keys (expected ${wanted.join(', ')})`)
  }
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) fail(path, 'must be a non-empty string')
  return value as string
}

function identifier(value: unknown, path: string): string {
  const result = string(value, path)
  if (!IDENTIFIER.test(result)) fail(path, 'must be a stable identifier')
  return result
}

function utc(value: unknown, path: string): string {
  const result = string(value, path)
  if (!UTC.test(result) || !Number.isFinite(Date.parse(result))) fail(path, 'must be a valid UTC timestamp')
  return result
}

function sha256(value: unknown, path: string): string {
  const result = string(value, path)
  if (!SHA256.test(result)) fail(path, 'must be a lowercase SHA-256 digest')
  return result
}

function number(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  return value as number
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  return value
}

function enumValue<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(path, `must be one of ${values.join(', ')}`)
  return value as T
}

function uniqueStrings(value: unknown, path: string): string[] {
  const values = array(value, path).map((item, index) => identifier(item, `${path}[${index}]`))
  if (new Set(values).size !== values.length) fail(path, 'must not contain duplicates')
  return values
}

function jsonObject(value: unknown, path: string): JsonObject {
  const result = record(value, path)
  const visit = (candidate: unknown, currentPath: string): void => {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') return
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, `${currentPath}[${index}]`))
      return
    }
    if (typeof candidate === 'object') {
      Object.entries(candidate as Record<string, unknown>).forEach(([key, item]) => visit(item, `${currentPath}.${key}`))
      return
    }
    fail(currentPath, 'must contain only JSON values')
  }
  visit(result, path)
  return result as JsonObject
}

export function validateCandidateSeed(value: unknown): CandidateSeed {
  const input = record(value, 'CandidateSeed')
  exactKeys(input, ['candidateId', 'label', 'caseCutoff', 'requestedWindow', 'purposeIds', 'allowedLenses'], 'CandidateSeed')
  const requestedWindow = record(input.requestedWindow, 'CandidateSeed.requestedWindow')
  exactKeys(requestedWindow, ['start', 'end'], 'CandidateSeed.requestedWindow')
  const start = utc(requestedWindow.start, 'CandidateSeed.requestedWindow.start')
  const end = utc(requestedWindow.end, 'CandidateSeed.requestedWindow.end')
  const cutoff = utc(input.caseCutoff, 'CandidateSeed.caseCutoff')
  if (Date.parse(start) > Date.parse(end)) fail('CandidateSeed.requestedWindow', 'start must not follow end')
  if (Date.parse(end) > Date.parse(cutoff)) fail('CandidateSeed.requestedWindow.end', 'must not cross the case cutoff')
  const allowedLenses = array(input.allowedLenses, 'CandidateSeed.allowedLenses').map((item, index) => enumValue(item, LENSES, `CandidateSeed.allowedLenses[${index}]`))
  if (allowedLenses.length === 0 || new Set(allowedLenses).size !== allowedLenses.length) fail('CandidateSeed.allowedLenses', 'must contain unique lenses')
  const purposeIds = uniqueStrings(input.purposeIds, 'CandidateSeed.purposeIds')
  if (purposeIds.length === 0) fail('CandidateSeed.purposeIds', 'must not be empty')
  return { candidateId: identifier(input.candidateId, 'CandidateSeed.candidateId'), label: string(input.label, 'CandidateSeed.label'), caseCutoff: cutoff, requestedWindow: { start, end }, purposeIds, allowedLenses }
}

export function validatePlannedRequest(value: unknown): PlannedRequest {
  const input = record(value, 'PlannedRequest')
  exactKeys(input, ['identityVersion', 'endpoint', 'endpointClass', 'apiVersion', 'requestBody', 'candidateId', 'purposeId', 'temporalWindow', 'normalizationContractVersion', 'pagination', 'refresh'], 'PlannedRequest')
  if (input.identityVersion !== '1.0.0') fail('PlannedRequest.identityVersion', 'must equal 1.0.0')
  const temporalWindow = record(input.temporalWindow, 'PlannedRequest.temporalWindow')
  exactKeys(temporalWindow, ['start', 'end'], 'PlannedRequest.temporalWindow')
  const start = utc(temporalWindow.start, 'PlannedRequest.temporalWindow.start')
  const end = utc(temporalWindow.end, 'PlannedRequest.temporalWindow.end')
  if (Date.parse(start) > Date.parse(end)) fail('PlannedRequest.temporalWindow', 'start must not follow end')
  const pagination = record(input.pagination, 'PlannedRequest.pagination')
  exactKeys(pagination, ['page', 'cursor'], 'PlannedRequest.pagination')
  const page = number(pagination.page, 'PlannedRequest.pagination.page')
  if (!Number.isInteger(page) || page < 1) fail('PlannedRequest.pagination.page', 'must be a positive integer')
  const cursor = pagination.cursor === null ? null : string(pagination.cursor, 'PlannedRequest.pagination.cursor')
  let refresh: PlannedRequest['refresh'] = null
  if (input.refresh !== null) {
    const refreshRecord = record(input.refresh, 'PlannedRequest.refresh')
    exactKeys(refreshRecord, ['reason', 'identity'], 'PlannedRequest.refresh')
    refresh = { reason: string(refreshRecord.reason, 'PlannedRequest.refresh.reason'), identity: identifier(refreshRecord.identity, 'PlannedRequest.refresh.identity') }
  }
  const endpoint = string(input.endpoint, 'PlannedRequest.endpoint')
  if (!endpoint.startsWith('/fixture/')) fail('PlannedRequest.endpoint', 'G3 endpoints must remain fixture-only')
  return {
    identityVersion: '1.0.0', endpoint,
    endpointClass: enumValue(input.endpointClass, ENDPOINT_CLASSES, 'PlannedRequest.endpointClass'),
    apiVersion: string(input.apiVersion, 'PlannedRequest.apiVersion'), requestBody: jsonObject(input.requestBody, 'PlannedRequest.requestBody'),
    candidateId: identifier(input.candidateId, 'PlannedRequest.candidateId'), purposeId: identifier(input.purposeId, 'PlannedRequest.purposeId'),
    temporalWindow: { start, end }, normalizationContractVersion: string(input.normalizationContractVersion, 'PlannedRequest.normalizationContractVersion'),
    pagination: { page, cursor }, refresh,
  }
}

export function validateNormalizedEvidenceRecord(value: unknown): NormalizedEvidenceRecord {
  const input = record(value, 'NormalizedEvidenceRecord')
  exactKeys(input, ['schemaVersion', 'evidenceId', 'candidateId', 'sourceEndpoint', 'endpointClass', 'requestedStartUtc', 'requestedEndUtc', 'sourceRetrievedAtUtc', 'observedEventTimeUtc', 'temporalClass', 'caseCutoffUtc', 'admissibleToChrono', 'requestedLens', 'sourceRawSha256', 'facts'], 'NormalizedEvidenceRecord')
  if (input.schemaVersion !== '1.0.0') fail('NormalizedEvidenceRecord.schemaVersion', 'must equal 1.0.0')
  const endpointClass = enumValue(input.endpointClass, ENDPOINT_CLASSES, 'NormalizedEvidenceRecord.endpointClass')
  const requestedLens = enumValue(input.requestedLens, LENSES, 'NormalizedEvidenceRecord.requestedLens')
  const observedEventTimeUtc = input.observedEventTimeUtc === null ? null : utc(input.observedEventTimeUtc, 'NormalizedEvidenceRecord.observedEventTimeUtc')
  const caseCutoffUtc = utc(input.caseCutoffUtc, 'NormalizedEvidenceRecord.caseCutoffUtc')
  const classification = classifyTemporalEvidence({ endpointClass, requestedLens, observedEventTimeUtc, caseCutoffUtc })
  if (input.temporalClass !== classification.temporalClass) fail('NormalizedEvidenceRecord.temporalClass', `must equal derived class ${classification.temporalClass}`)
  if (input.admissibleToChrono !== classification.admissibleToChrono) fail('NormalizedEvidenceRecord.admissibleToChrono', 'must equal the derived temporal decision')
  const requestedStartUtc = utc(input.requestedStartUtc, 'NormalizedEvidenceRecord.requestedStartUtc')
  const requestedEndUtc = utc(input.requestedEndUtc, 'NormalizedEvidenceRecord.requestedEndUtc')
  if (Date.parse(requestedStartUtc) > Date.parse(requestedEndUtc)) fail('NormalizedEvidenceRecord', 'requested start must not follow end')
  if (observedEventTimeUtc !== null && (Date.parse(observedEventTimeUtc) < Date.parse(requestedStartUtc) || Date.parse(observedEventTimeUtc) > Date.parse(requestedEndUtc))) fail('NormalizedEvidenceRecord.observedEventTimeUtc', 'must lie inside requested window')
  return {
    schemaVersion: '1.0.0', evidenceId: identifier(input.evidenceId, 'NormalizedEvidenceRecord.evidenceId'), candidateId: identifier(input.candidateId, 'NormalizedEvidenceRecord.candidateId'),
    sourceEndpoint: string(input.sourceEndpoint, 'NormalizedEvidenceRecord.sourceEndpoint'), endpointClass, requestedStartUtc, requestedEndUtc,
    sourceRetrievedAtUtc: utc(input.sourceRetrievedAtUtc, 'NormalizedEvidenceRecord.sourceRetrievedAtUtc'), observedEventTimeUtc,
    temporalClass: classification.temporalClass, caseCutoffUtc, admissibleToChrono: classification.admissibleToChrono, requestedLens,
    sourceRawSha256: sha256(input.sourceRawSha256, 'NormalizedEvidenceRecord.sourceRawSha256'), facts: jsonObject(input.facts, 'NormalizedEvidenceRecord.facts'),
  }
}

export function validateCandidateEvidenceGraph(value: unknown): CandidateEvidenceGraph {
  const input = record(value, 'CandidateEvidenceGraph')
  exactKeys(input, ['schemaVersion', 'candidateId', 'caseCutoffUtc', 'evidence', 'derivedClaims'], 'CandidateEvidenceGraph')
  if (input.schemaVersion !== '1.0.0') fail('CandidateEvidenceGraph.schemaVersion', 'must equal 1.0.0')
  const candidateId = identifier(input.candidateId, 'CandidateEvidenceGraph.candidateId')
  const caseCutoffUtc = utc(input.caseCutoffUtc, 'CandidateEvidenceGraph.caseCutoffUtc')
  const evidence = array(input.evidence, 'CandidateEvidenceGraph.evidence').map(validateNormalizedEvidenceRecord)
  const evidenceIds = new Set<string>()
  evidence.forEach((item, index) => {
    if (item.candidateId !== candidateId || item.caseCutoffUtc !== caseCutoffUtc) fail(`CandidateEvidenceGraph.evidence[${index}]`, 'candidate and cutoff must match graph')
    if (evidenceIds.has(item.evidenceId)) fail(`CandidateEvidenceGraph.evidence[${index}].evidenceId`, 'must be unique')
    evidenceIds.add(item.evidenceId)
  })
  const claimIds = new Set<string>()
  const derivedClaims = array(input.derivedClaims, 'CandidateEvidenceGraph.derivedClaims').map((item, index) => {
    const claim = record(item, `CandidateEvidenceGraph.derivedClaims[${index}]`)
    exactKeys(claim, ['claimId', 'evidenceIds', 'statement'], `CandidateEvidenceGraph.derivedClaims[${index}]`)
    const claimId = identifier(claim.claimId, `CandidateEvidenceGraph.derivedClaims[${index}].claimId`)
    if (claimIds.has(claimId)) fail(`CandidateEvidenceGraph.derivedClaims[${index}].claimId`, 'must be unique')
    claimIds.add(claimId)
    const referencedEvidenceIds = uniqueStrings(claim.evidenceIds, `CandidateEvidenceGraph.derivedClaims[${index}].evidenceIds`)
    if (referencedEvidenceIds.length === 0 || referencedEvidenceIds.some((id) => !evidenceIds.has(id))) fail(`CandidateEvidenceGraph.derivedClaims[${index}].evidenceIds`, 'must reference one or more graph evidence records')
    return { claimId, evidenceIds: referencedEvidenceIds, statement: string(claim.statement, `CandidateEvidenceGraph.derivedClaims[${index}].statement`) }
  })
  return { schemaVersion: '1.0.0', candidateId, caseCutoffUtc, evidence, derivedClaims }
}

export function validateProvenanceRecord(value: unknown): ProvenanceRecord {
  const input = record(value, 'ProvenanceRecord')
  exactKeys(input, ['schemaVersion', 'candidateId', 'caseCutoffUtc', 'sourceRawSha256', 'normalizedSha256', 'candidateGraphSha256', 'publicScenarioSha256', 'generatedAtUtc'], 'ProvenanceRecord')
  if (input.schemaVersion !== '1.0.0') fail('ProvenanceRecord.schemaVersion', 'must equal 1.0.0')
  const digestList = (candidate: unknown, path: string): string[] => {
    const values = array(candidate, path).map((item, index) => sha256(item, `${path}[${index}]`))
    if (values.length === 0 || new Set(values).size !== values.length) fail(path, 'must contain unique source hashes')
    return values
  }
  return {
    schemaVersion: '1.0.0', candidateId: identifier(input.candidateId, 'ProvenanceRecord.candidateId'), caseCutoffUtc: utc(input.caseCutoffUtc, 'ProvenanceRecord.caseCutoffUtc'),
    sourceRawSha256: digestList(input.sourceRawSha256, 'ProvenanceRecord.sourceRawSha256'), normalizedSha256: digestList(input.normalizedSha256, 'ProvenanceRecord.normalizedSha256'),
    candidateGraphSha256: sha256(input.candidateGraphSha256, 'ProvenanceRecord.candidateGraphSha256'), publicScenarioSha256: sha256(input.publicScenarioSha256, 'ProvenanceRecord.publicScenarioSha256'),
    generatedAtUtc: utc(input.generatedAtUtc, 'ProvenanceRecord.generatedAtUtc'),
  }
}

export function validatePublicScenarioDraft(value: unknown): PublicScenarioDraft {
  const input = record(value, 'PublicScenarioDraft')
  exactKeys(input, ['schemaVersion', 'candidateId', 'caseCutoffUtc', 'evidence', 'provenance'], 'PublicScenarioDraft')
  if (input.schemaVersion !== '1.0.0') fail('PublicScenarioDraft.schemaVersion', 'must equal 1.0.0')
  const candidateId = identifier(input.candidateId, 'PublicScenarioDraft.candidateId')
  const caseCutoffUtc = utc(input.caseCutoffUtc, 'PublicScenarioDraft.caseCutoffUtc')
  const evidence = array(input.evidence, 'PublicScenarioDraft.evidence').map((item, index) => {
    const projection = record(item, `PublicScenarioDraft.evidence[${index}]`)
    exactKeys(projection, ['evidenceId', 'observedEventTimeUtc', 'temporalClass', 'lens', 'facts', 'sourceHash'], `PublicScenarioDraft.evidence[${index}]`)
    if (projection.temporalClass !== 'HISTORICAL_AT_CUTOFF') fail(`PublicScenarioDraft.evidence[${index}].temporalClass`, 'must be HISTORICAL_AT_CUTOFF')
    const lens = enumValue(projection.lens, ['ROUTE_SCAN', 'STATE_ECHO', 'CONVERSION_TRACE'] as const, `PublicScenarioDraft.evidence[${index}].lens`)
    const observedEventTimeUtc = utc(projection.observedEventTimeUtc, `PublicScenarioDraft.evidence[${index}].observedEventTimeUtc`)
    if (Date.parse(observedEventTimeUtc) > Date.parse(caseCutoffUtc)) fail(`PublicScenarioDraft.evidence[${index}].observedEventTimeUtc`, 'must not follow case cutoff')
    const facts = jsonObject(projection.facts, `PublicScenarioDraft.evidence[${index}].facts`)
    for (const [key, fact] of Object.entries(facts)) {
      if (fact !== null && typeof fact === 'object') fail(`PublicScenarioDraft.evidence[${index}].facts.${key}`, 'public fact values must be primitives')
    }
    return { evidenceId: identifier(projection.evidenceId, `PublicScenarioDraft.evidence[${index}].evidenceId`), observedEventTimeUtc, temporalClass: 'HISTORICAL_AT_CUTOFF' as const, lens, facts, sourceHash: sha256(projection.sourceHash, `PublicScenarioDraft.evidence[${index}].sourceHash`) }
  })
  if (new Set(evidence.map((item) => item.evidenceId)).size !== evidence.length) fail('PublicScenarioDraft.evidence', 'evidence IDs must be unique')
  const provenance = validateProvenanceRecord(input.provenance)
  if (provenance.candidateId !== candidateId || provenance.caseCutoffUtc !== caseCutoffUtc) fail('PublicScenarioDraft.provenance', 'candidate and cutoff must match public scenario')
  if (evidence.some((item) => !provenance.sourceRawSha256.includes(item.sourceHash))) fail('PublicScenarioDraft.provenance.sourceRawSha256', 'must declare every public evidence source hash')
  return { schemaVersion: '1.0.0', candidateId, caseCutoffUtc, evidence, provenance }
}

export const evidenceValidationConstants = { ENDPOINT_CLASSES, LENSES, SCORE_CATEGORIES, FATAL_DEFECTS }
