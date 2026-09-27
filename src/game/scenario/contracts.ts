import type { TheoryEvaluation, TheoryOptions, TheorySelection, TheorySlot } from './schema'

export type EvidenceGrade = 'EXACT' | 'CORROBORATING' | 'CONTEXTUAL'
export type ProofGrade = 'EXACT_EVENT' | 'DERIVED_VIEW' | 'CONTEXT' | 'CURRENT_METADATA_ONLY' | 'POST_CUTOFF_CONTEXT' | 'RAW_CHAIN_VERIFIED'
export type NumericPrecisionStatus = 'PROVIDER_REPORTED_DECIMAL' | 'ATOMIC_LOG_VERIFIED' | 'ROUNDED_PLAYER_DISPLAY'
export type ScenarioKind = 'SYNTHETIC_CALIBRATION' | 'HISTORICAL_CASE'
export type BranchSlot = string
export type MissionStage = 'ENTRY' | 'OPENING' | 'APPROACH' | 'CASE_INDEX' | 'BRANCH' | 'RETURN' | 'SYNTHESIS' | 'HYPOTHESIS' | 'HYPOTHESIS_TEST' | 'DEEP_TRACE' | 'RECEIVING_POINT' | 'CASE_ASSEMBLY' | 'TRUTH_ENGINE' | 'COMPLETE'
export type PresentationProfile = 'GUIDED_PROBE_3D' | 'FIRST_PERSON_RAIL_3D' | 'ORTHOGRAPHIC_2_5D' | 'TOP_DOWN_VECTOR_2D'
export type CameraMode = 'NAVIGATION' | 'INSPECTION' | 'SIGNATURE_TRANSITION' | 'THEORY' | 'TRUTH_ENGINE'
export type WorldRole = 'entry-origin' | 'record-gate' | 'case-index' | 'branch-primary' | 'branch-secondary' | 'protocol-subgraph' | 'joining-gate' | 'receiving-point'
export type PassageRole = 'approach' | 'branch' | 'return' | 'hypothesis-test' | 'continuation' | 'context'

export interface EvidenceAssetAmount {
  asset: string
  amount: string
  unit: 'TOKEN' | 'NATIVE'
}

export interface EvidenceRoleBinding {
  entityId: string
  role: string
  address: string | null
}

export interface EvidenceFacts {
  assetAmounts: EvidenceAssetAmount[]
  roleBindings: EvidenceRoleBinding[]
  stateLabel: string | null
  provesRoute: boolean
  negativeRowsPublished: number
}

export interface NormalizedEvidenceItem {
  id: string
  grade: EvidenceGrade
  observedAtUtc: string | null
  sourceFamily: 'TRANSACTION' | 'TOKEN_TRANSFERS' | 'HISTORICAL_BALANCES' | 'ADDRESS_ACTIVITY' | 'SYNTHETIC_FIXTURE'
  sourceEndpoint: string
  retrievedAtUtc: string
  temporalClass: 'HISTORICAL_AT_CUTOFF' | 'CURRENT_METADATA_ONLY' | 'POST_CUTOFF_CONTEXT' | 'SYNTHETIC'
  normalizedSha256: string
  redistribution: 'PUBLIC_ALLOWLISTED'
  uncertainty: string | null
  rawSha256: string
  claim: string
  transactionHash: string | null
  proofGrade: ProofGrade
  sourceLineageId: string
  independenceGroup: string
  derivedFromEvidenceIds: string[]
  independentForProof: boolean
  numericPrecisionStatus: NumericPrecisionStatus
  facts: EvidenceFacts
}

export interface NormalizedEntity {
  id: string
  role: string
  kind: 'ADDRESS' | 'CONTRACT' | 'WORLD_ROLE' | 'SYNTHETIC_ENTITY'
  address: string | null
}

export interface NormalizedEvent {
  id: string
  kind: 'TRANSACTION' | 'TOKEN_TRANSFER' | 'STATE' | 'CONTEXT' | 'SYNTHETIC'
  observedAtUtc: string | null
  transactionHash: string | null
  evidenceIds: string[]
}

export interface NormalizedRelationship {
  id: string
  kind: 'INITIATES' | 'RECEIVES' | 'CONVERGES_TO' | 'CONTEXT_ONLY' | 'SYNTHETIC_ROUTE'
  fromEntityId: string
  toEntityId: string
  eventId: string
  evidenceId: string
  basisEvidenceId: string | null
  asset: string | null
  amount: string | null
  falsifiesTheoryOptionIds: string[]
}

export interface ProofDependency {
  slot: TheorySlot
  evidenceIds: string[]
}

export interface KnownEvidenceGap {
  id: string
  disposition: 'OMIT' | 'FALLBACK' | 'CONTEXT_ONLY'
  explanation: string
}

export interface NormalizedEvidenceGraph {
  schemaVersion: '1.0.0'
  scenarioId: string
  cutoffUtc: string | null
  entities: NormalizedEntity[]
  events: NormalizedEvent[]
  relationships: NormalizedRelationship[]
  proofDependencies: ProofDependency[]
  firstFalsifier: string
  gaps: KnownEvidenceGap[]
  evidence: NormalizedEvidenceItem[]
}

export interface LeadBranchConfig {
  id: BranchSlot
  routeLabel: string
  entryLabel: string
  objective: string
  evidenceId: string
  discoveryEvidenceIds: string[]
  evidenceStamp: string
  evidenceBody: string
  evidenceExact: string
  actionLabel: string
  transitionAfterFirst: string[]
  nodeId: string
  outboundPathId: string
  returnPathId: string
  discoveryAction: string
  completionAction: string
}

export interface HypothesisOption {
  id: string
  label: string
  outcome: 'CONFIRMED' | 'FALSIFIED'
}

export interface HypothesisContract {
  question: string
  options: [HypothesisOption, HypothesisOption]
  testAction: 'SWEEP_FORWARD'
  testActionLabel: string
  evidenceId: string
  confirmedCopy: string[]
  falsifiedCopy: string[]
}

export interface CaseAssemblySlot {
  id: 'AMOUNT' | 'RECEIVER' | 'LINK'
  label: string
  requiredEvidenceId: string
}

export interface CaseAssemblyContract {
  title: 'BUILD THE CASE'
  slots: [CaseAssemblySlot, CaseAssemblySlot, CaseAssemblySlot]
  selectableEvidenceIds: string[]
  contextualEvidenceIds: string[]
  insufficientCopy: string
}

export interface ExperiencePlan {
  stages: MissionStage[]
  branchIds: [string, string]
  approachPathId: string
  synthesisAction: string
  navigation: {
    nodeIds: Record<WorldRole, string>
    approachToGatePathId: string
    deepTraceBranchId: string | null
    deepTracePathId: string | null
    hypothesisTestPathId: string
    receivingPathId: string
  }
  hypothesis: HypothesisContract
  caseAssembly: CaseAssemblyContract
  truthAdvanceMode: 'PLAYER_PACED'
}

export interface LeadCaseConfig {
  schemaVersion: '1.0.0'
  scenarioId: string
  kind: ScenarioKind
  missionLabel: string
  title: string
  chain: string
  historicalWindow: { startUtc: string; endUtc: string } | null
  historicalCutoff: string | null
  prelaunch: string[]
  opening: [string, string, string]
  caseFrame: string[][]
  caseQuestion: string
  firstScanMarker: string[]
  objectives: Record<string, string>
  captions: Record<string, string>
  branches: [LeadBranchConfig, LeadBranchConfig]
  flow: {
    openingEvidenceId: string
    forkEvidenceId: string
    conversionEvidenceId: string
    destinationEvidenceId: string
    requiredEvidenceIds: string[]
    anchorLabel: string
    alignTitle: string
    alignBody: string
    resonanceProof: string
    conversionTitle: string
    conversionBody: string
    conversionExact: string[]
    destinationTitle: string
    destinationBody: string
    destinationExact: string[]
  }
  theoryOptions: TheoryOptions
  canonicalTheory: Required<TheorySelection>
  wrongTheory: Required<TheorySelection>
  contradictions: Record<TheorySlot, NonNullable<TheoryEvaluation['firstContradiction']>>
  proofEvidenceIds: string[]
  firstFalsifier: string
  truthTimeline: string[]
  truthStages: [string, string, string]
  truthConclusion: string[]
  completion: { title: string; solvedTitle: string; body: string; disclaimer: string; primaryAction: string; secondaryAction: string | null }
  provenanceCopy: string
  omittedEventIds: string[]
  worldLabels: Record<WorldRole, string>
  worldProminence: Partial<Record<WorldRole, number>>
  experiencePlan: ExperiencePlan
}

export interface ScenarioManifest extends Omit<LeadCaseConfig, 'schemaVersion' | 'omittedEventIds'> {
  schemaVersion: '3.0.0'
  compilerVersion: '2.0.0'
  generatedAt: string
  evidence: NormalizedEvidenceItem[]
  omittedEventManifest: { ids: string[]; count: number; reason: string }
}

export interface WorldNode {
  id: string
  role: WorldRole
  label: string
  evidenceId: string | null
  provenanceEvidenceIds: string[]
  presentation: { position: [number, number, number]; cameraLandmark: [number, number, number]; prominence: number }
}

export interface WorldPassage {
  id: string
  from: string
  to: string
  role: PassageRole
  initiallyHidden: boolean
  durationMs: number
  facingHint: 'FORWARD' | 'LEFT' | 'RIGHT' | 'RETURN'
  arrivalStage: MissionStage
  provenanceRelationshipIds: string[]
  selectableDestination: boolean
  presentation: { spline: [[number, number, number], [number, number, number], [number, number, number]]; arrivalRadius: number }
}

export interface WorldManifest {
  version: '3.0.0'
  scenarioId: string
  proceduralOnly: true
  activePresentationProfile: 'GUIDED_PROBE_3D'
  implementedProfiles: ['GUIDED_PROBE_3D']
  fallbackOrder: ['FIRST_PERSON_RAIL_3D', 'ORTHOGRAPHIC_2_5D', 'TOP_DOWN_VECTOR_2D']
  nodes: WorldNode[]
  passages: WorldPassage[]
}

export interface ScenarioProvenance {
  schemaVersion: '1.0.0'
  scenarioId: string
  sourceFamilies: NormalizedEvidenceItem['sourceFamily'][]
  rawResponseHashes: string[]
  normalizedObjectHashes: string[]
  normalizedGraphHash: string
  compilerVersion: '2.0.0'
  worldVersion: '3.0.0'
  scenarioHash: string
  worldHash: string
  generatedAt: string
}

export interface CompiledScenarioBundle {
  scenario: ScenarioManifest
  world: WorldManifest
  provenance: ScenarioProvenance
}

export interface ScenarioCatalogEntry {
  id: string
  kind: ScenarioKind
  title: string
  bundle: CompiledScenarioBundle
}

export interface ScenarioCatalog {
  schemaVersion: '1.0.0'
  defaultScenarioId: string
  entries: ScenarioCatalogEntry[]
}
