import type { S13Runtime } from './s13.js'

export type QuestionLens = 'ACTIVITY' | 'RELATIONSHIPS' | 'STATE' | 'RECEIPT'
export type EvidenceGrade = 'EXACT' | 'CORROBORATING' | 'CONTEXTUAL'
export type ClueRole = 'ANCHOR' | 'BOUND' | 'TEST' | 'CANDIDATE' | 'FALSIFIER' | 'PROOF'
export type ClueState = 'LOCKED' | 'DISCOVERED' | 'AVAILABLE' | 'APPLIED' | 'RELATED' | 'PINNED' | 'ARCHIVED'
export const CANONICAL_SECTIONS = ['CASE', 'RESULTS', 'EXPLORE', 'SOURCE', 'LEDGER'] as const
export type Section = typeof CANONICAL_SECTIONS[number]
export type Presentation = 'FULLSCREEN_CRT' | 'DOCKED_OVERLAY' | 'PLAIN_LIST'
export type ThreadStatus = 'OPEN' | 'CANDIDATE_FITS' | 'NEEDS_EXACT_LINK' | 'CORROBORATED_NOT_PROVEN' | 'CONTRADICTED' | 'PROVED'
export type FolderStatus = 'UNTESTED' | 'SAVED' | 'CORROBORATING' | 'CONTRADICTED' | 'EXACT'
export type ZeroClass = 'NO_MATCH_IN_ACCEPTED_CORPUS' | 'NEGATIVE_EVIDENCE_SUPPORTED' | 'QUERY_OUTSIDE_COVERAGE'
export type Field = 'SUBJECT' | 'SOURCE' | 'DESTINATION' | 'ASSET' | 'FROM' | 'TO' | 'MIN_AMOUNT' | 'TRANSACTION' | 'GRADE' | 'KIND' | 'RECORD_SET'
export type FilterOrigin = 'CASE_CLUE' | 'QUESTION_CARD' | 'PLAYER_FILTER' | 'RESULT_DERIVED'
export interface Filter { field: Field; value: string; origin: FilterOrigin; sourceId: string }
export interface Query { lens: QuestionLens; filters: Filter[]; questionId: string }
export interface CaseRecord {
  id: string; summary: string; observedAtUtc: string; transactionHash: string
  source: string; destination: string; assetAmounts: { asset: string; amount: string; unit: string }[]
  grade: EvidenceGrade; kind: 'ACTIVITY' | 'STATE'; exactRelationship: boolean
  provenance: { endpoint: string; rawSha256: string; normalizedSha256: string; retrievedAtUtc: string; lineage: string; precision: string; attribution: 'Powered by Nansen API' }
  claimBoundary: string; derivedFrom: string[]
}
export interface CaseClue {
  id: string; label: string; role: ClueRole; category: 'STARTING_POINT' | 'WHEN' | 'WHAT_MOVED' | 'CHECK'
  filters: Omit<Filter, 'origin' | 'sourceId'>[]; sourceRecordIds: string[]; unlockEvent: string; reusable: true; nonConsumable: true; displayValue?: string
}
export interface CoverageCell {
  id: string; subject: string; fromUtc: string; toUtc: string; lens: QuestionLens; partition: string
  status: 'PLANNED' | 'COMPLETE' | 'PARTIAL' | 'EMPTY_COMPLETE' | 'FAILED' | 'NOT_IN_SCOPE'
  supportsNegative: boolean; sourceCallIds: string[]
}
export interface QuestionCard {
  id: string; questionId: string; question: string; lens: QuestionLens; stage: 'ORIENT' | 'NARROW' | 'RELATE' | 'CORROBORATE' | 'TEST' | 'VERIFY'
  prerequisites: string[]; effects: Omit<Filter, 'origin' | 'sourceId'>[]; why: string; resultClass: string
  mayEstablish: string; cannotEstablish: string; nextRule: string; family: string; complexity: number; lead_promoted: false
}
export interface CaseFixture {
  schemaVersion: '1.0.0'; id: string; mode: 'ACCEPTED_FROZEN' | 'SYNTHETIC_TEST'; title: string; question: string; cutoffUtc: string
  records: CaseRecord[]; clues: CaseClue[]; startingClueIds: string[]; openingRecordId: string; secondRecordId: string
  proof: { slots: Record<'AMOUNT' | 'RECEIVER' | 'LINK', string>; linkSource: string; linkDestination: string; linkAsset: string; linkTimeUtc: string; conclusion: string; boundary: string }
  coverage: CoverageCell[]; ledger: { attempts: number; successfulResponses: number; curatedAcceptedCalls: number; credits: number | null; proofRoot: string | null }
  s13?: S13Runtime
}
export interface CandidateFolder {
  id: string; recordId: string; summary: string; whyMatched: string[]; grade: EvidenceGrade; status: FolderStatus
  maySupport: string; cannotProve: string; nextQuestionIds: string[]; sortReason: string
}
export interface DispatchResult {
  query: Query; recordIds: string[]; folders: CandidateFolder[]; zeroClass: ZeroClass | null; coverageIds: string[]
  delta: { previousCount: number; newCount: number; includedReason: string; excluded: { recordId: string; firstPredicate: string }[] }
}
