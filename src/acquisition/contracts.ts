export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type EvidenceTemporalClass = 'HISTORICAL_AT_CUTOFF' | 'CURRENT_ONLY' | 'UNKNOWN'
export type EvidenceLens = 'ROUTE_SCAN' | 'STATE_ECHO' | 'CONVERSION_TRACE' | 'ECHO_ONLY'
export type EndpointClass = 'historical-events' | 'historical-balances' | 'current-relationships' | 'current-portfolio'
export type RedistributionClass = 'PUBLIC_ALLOWLISTED' | 'RESTRICTED' | 'PROHIBITED'

export interface CandidateSeed {
  candidateId: string
  label: string
  caseCutoff: string
  requestedWindow: { start: string; end: string }
  purposeIds: string[]
  allowedLenses: EvidenceLens[]
}

export interface PlannedRequest {
  identityVersion: '1.0.0'
  endpoint: string
  endpointClass: EndpointClass
  apiVersion: string
  requestBody: JsonObject
  candidateId: string
  purposeId: string
  temporalWindow: { start: string; end: string }
  normalizationContractVersion: string
  pagination: { page: number; cursor: string | null }
  refresh: { reason: string; identity: string } | null
}

export interface RequestAllowance {
  schemaVersion: '1.0.0'
  allowanceId: string
  leadAuthorizationId: string
  approvedCandidateIds: string[]
  approvedEndpoints: string[]
  maximumRequests: number
  maximumProjectedCredits: number
  maximumPerEndpointCalls: Record<string, number>
  validFromUtc: string
  validUntilUtc: string
}

export interface AllowanceUsage {
  issuedRequests: number
  projectedCredits: number
  endpointCalls: Record<string, number>
}

export interface EndpointPolicy {
  endpoint: string
  apiVersion: string
  endpointClass: EndpointClass
  planningCreditCost: number
  allowedLenses: EvidenceLens[]
  redistribution: RedistributionClass
  maximumPages: number
  transport: 'FIXTURE_ONLY_G3' | 'NANSEN_BUILD_TIME_G4A'
}

export interface ProviderPolicy {
  schemaVersion: '1.0.0'
  provider: 'FUTURE_NANSEN_BUILD_TIME'
  requestProtocol: { method: 'POST'; contentType: 'application/json' }
  authentication: { method: 'HEADER'; headerName: 'apikey'; g3Resolution: 'DISABLED' }
  concurrency: 1
  minimumDelayMs: number
  retryAfterSemantics: 'HONOR_SECONDS_OR_HTTP_DATE'
  historicalResponsePolicy: 'MAY_BE_RESTATED'
  retry: {
    maximumAttempts: number
    baseDelayMs: number
    maximumDelayMs: number
    retryableHttpStatuses: number[]
    nonRetryableHttpStatuses: number[]
  }
  endpoints: EndpointPolicy[]
}

export type LedgerStatus = 'SIMULATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REUSED'

export interface CallLedgerRecord {
  schemaVersion: '1.0.0'
  callSequence: number
  candidateId: string
  purposeId: string
  endpoint: string
  requestFingerprint: string
  canonicalRequestHash: string
  plannedCreditEstimate: number
  maximumAllowedCredits: number
  attemptNumber: number
  status: LedgerStatus
  startedAtUtc: string
  completedAtUtc: string | null
  httpStatus: number | null
  redactedRequestMetadata: JsonObject
  providerRequestId: string | null
  returnedCreditMetadata: JsonObject | null
  returnedRateMetadata: JsonObject | null
  rawSha256: string | null
  rawStorageLocations: { primary: string; mirror: string } | null
  normalizedSha256: string | null
  normalizerVersion: string
  decision: { result: 'ACCEPTED' | 'REJECTED' | 'PENDING'; reason: string }
  publicExportStatus: 'NOT_EVALUATED' | 'ALLOWED' | 'REJECTED'
}

export interface RawResponseEnvelope {
  schemaVersion: '1.0.0'
  requestFingerprint: string
  requestHash: string
  retrievedAtUtc: string
  httpStatus: number
  responseHeaders: Record<string, string>
  bodySha256: string
  bodyByteLength: number
}

export interface NormalizedEvidenceRecord {
  schemaVersion: '1.0.0'
  evidenceId: string
  candidateId: string
  sourceEndpoint: string
  endpointClass: EndpointClass
  requestedStartUtc: string
  requestedEndUtc: string
  sourceRetrievedAtUtc: string
  observedEventTimeUtc: string | null
  temporalClass: EvidenceTemporalClass
  caseCutoffUtc: string
  admissibleToChrono: boolean
  requestedLens: EvidenceLens
  sourceRawSha256: string
  facts: JsonObject
}

export interface CandidateEvidenceGraph {
  schemaVersion: '1.0.0'
  candidateId: string
  caseCutoffUtc: string
  evidence: NormalizedEvidenceRecord[]
  derivedClaims: Array<{ claimId: string; evidenceIds: string[]; statement: string }>
}

export type ScoreCategory =
  | 'proofClosureAuditability'
  | 'nansenIndispensability'
  | 'branchTransformationTopology'
  | 'timeMechanicPotential'
  | 'nonexpertNarrativeClarity'
  | 'replayTruthfulDepth'
  | 'visualWorldReadability'
  | 'complianceDataReliability'

export type FatalDefect =
  | 'NO_EXACT_PROOF_CLOSURE'
  | 'ESSENTIAL_UNSUPPORTED_GAP'
  | 'LOOK_AHEAD_LEAKAGE'
  | 'PROHIBITED_PUBLIC_DATA_DEPENDENCY'
  | 'GRAPH_NOT_HONESTLY_COMPRESSIBLE'
  | 'INVENTED_CLUE_DEPENDENCY'

export interface CaseScore {
  schemaVersion: '1.0.0'
  candidateId: string
  categories: Record<ScoreCategory, number>
  total: number
  fatalDefects: FatalDefect[]
  eligible: boolean
}

export interface ProvenanceRecord {
  schemaVersion: '1.0.0'
  candidateId: string
  caseCutoffUtc: string
  sourceRawSha256: string[]
  normalizedSha256: string[]
  candidateGraphSha256: string
  publicScenarioSha256: string
  generatedAtUtc: string
}

export interface PublicEvidenceProjection {
  evidenceId: string
  observedEventTimeUtc: string
  temporalClass: 'HISTORICAL_AT_CUTOFF'
  lens: Exclude<EvidenceLens, 'ECHO_ONLY'>
  facts: JsonObject
  sourceHash: string
}

export interface PublicScenarioDraft {
  schemaVersion: '1.0.0'
  candidateId: string
  caseCutoffUtc: string
  evidence: PublicEvidenceProjection[]
  provenance: ProvenanceRecord
}

export interface FixturePage {
  page: number
  cursor: string | null
  nextCursor: string | null
  responseFixture: string
  httpStatus: number | 'TIMEOUT'
  responseHeaders: Record<string, string>
}

export interface DryRunPlan {
  schemaVersion: '1.0.0'
  mode: 'FIXTURE_ONLY_NO_NETWORK'
  seed: CandidateSeed
  allowance: RequestAllowance
  requests: Array<{ request: PlannedRequest; pages: FixturePage[] }>
}

export interface StoreRoots {
  primaryRoot: string
  mirrorRoot: string
}

export interface StoredResponseResult {
  disposition: 'STORED' | 'REUSED' | 'RESUMED'
  rawSha256: string
  normalizedSha256: string
  primaryPath: string
  mirrorPath: string
  ledgerRecord: CallLedgerRecord
}
