export interface S13Receipt {
  publicCallId: string
  sequence: number
  sourceCampaign: 'P2-R1' | 'E03'
  acceptanceStatus: string
  curatedEvidenceAcceptanceStatus: string
  endpointFamily: string
  boundedQuestion: string
  lens: string
  purpose: string
  coverage: string | string[]
  evidenceGradeCeiling: string
  namedConsumers: string[]
  claimBoundaries: string[]
  attribution: string
  requestBodySha256: string
  responseSha256: string
  normalizedSha256: string
  caseCorpusRecordIds: string[]
}

export interface S13Record {
  recordId: string
  recordKind: string
  semanticRole: string
  sourcePublicCallId?: string
  evidenceId?: string
  block_timestamp?: string | null
  transaction_hash?: string | null
  from_address?: string | null
  to_address?: string | null
  token_address?: string | null
  transfer_amount?: string | null
  evidenceGradeCeiling?: string
  fillsProofSlots?: string[]
  attribution?: string
  limitation?: string
  zeroResultClass?: string
  brcg?: boolean
  establishesGlobalAbsence?: boolean
  mayFalsifyTheory?: boolean
  [key: string]: unknown
}

export interface S13Stage {
  semanticFilterId: string
  previousCount: number | null
  newCount: number
  includedReason: string
  sourceClueIds: string[]
  evidenceGradeCeiling: string
  survivingRecordIds: string[]
  firstExcludingPredicate?: unknown
  whatTheStageMayEstablish?: string
  whatItCannotEstablish?: string
}

export interface S13Runtime {
  schemaVersion: '1.0.0'
  compiler: string
  attribution: 'Powered by Nansen API'
  metrics: { callAtlasReceipts: 101; p2r1Receipts: 25; e03Receipts: 76; e03Curated: 45; e03ReceiptOnly: 31; semanticRecords: 227; providerRows: 200; credits: '112'; filterSequence: [98, 98, 74, 3, 2, 1]; r55CountSlots: [98, 3, 2] }
  prebrief: { projectionId: 'PREBRIEF_OVERVIEW'; individualRecordsIncluded: false; filterPredicatesIncluded: false; exactSlotFieldsIncluded: false; callAtlasReceiptCount: 101; semanticRecordCount: 227; providerResponseRowCount: 200; sourceFamilyCounts: Record<string, number>; recordCategoryCounts: Record<string, number>; attribution: string }
  caseFileGate: { clueIds: ['CLUE.CASE_FILE.DAI', 'CLUE.CASE_FILE.AMOUNT_8_88M']; lockedUntil: 'CASE_FILE_COLLECTED_AND_READ' }
  callAtlas: S13Receipt[]
  caseCorpus: S13Record[]
  evidenceDelta: { sequence: [98, 98, 74, 3, 2, 1]; stages: S13Stage[]; exactProofJoin: { survivorRecordId: 'HERO.EXACT_CONVERGENCE'; contextualCorroboratingView: string; contextualViewFillsProofSlots: false; proofSlots: Record<'AMOUNT' | 'RECEIVER' | 'LINK', Record<string, string>>; acceptedConclusion: string; doesNotProve: string[] } }
  proof: { onlyExactHeroMayFill: ['AMOUNT', 'RECEIVER', 'LINK']; exactRecord: S13Record; contextualCorroboration: S13Record; conclusion: string; doesNotProve: string[] }
  brcg: { requiredForLaunch: true; playerDiscoveryOptional: true; snapshot: { address: string; observationUtc: string; priceUsdLexeme: string }; boundedNoMatch: { zeroResultClass: 'NO_MATCH_IN_ACCEPTED_CORPUS'; establishesGlobalAbsence: false; mayFalsifyTheory: false; providerResultCount: 0 }; e02RowsIncluded: false }
  acceptance: { status: 'MAIN_ACCEPTED_FOR_S13_INTEGRATION'; bindingSha256: string; acceptedCallAtlasReceipts: 101; semanticRecords: 227 }
  productionBoundary: { runtimeProviderCalls: 0; r55DialogueActive: false; endingActive: false; mission02Active: false }
}

export interface S13QueryGroup {
  id: 'FLOOD_ORIENT' | 'CANDIDATES_CASE_FILE_BOUNDS' | 'RECEIPT_ROUTE_VERIFICATION'
  cardId: 'CARD.S13_FLOOD_ORIENT' | 'CARD.S13_CANDIDATES' | 'CARD.S13_RECEIPT'
  questionId: 'QUESTION.S13_FLOOD_ORIENT' | 'QUESTION.S13_CANDIDATES' | 'QUESTION.S13_RECEIPT'
  title: string
  question: string
  lens: 'ACTIVITY' | 'RELATIONSHIPS' | 'RECEIPT'
  startStage: 0 | 2 | 4
  endStage: 2 | 4 | 6
  expectedResultClass: 'CANDIDATES' | 'EXACT_RECEIPT'
  subpredicateLabels: readonly string[]
}

/** Accepted S13 semantic stages grouped into the three production query transactions. */
export const S13_QUERY_GROUPS: readonly S13QueryGroup[] = [
  {
    id: 'FLOOD_ORIENT', cardId: 'CARD.S13_FLOOD_ORIENT', questionId: 'QUESTION.S13_FLOOD_ORIENT',
    title: 'FLOOD / ORIENT', question: 'Orient within the accepted transfer pool and confirm the accepted incident window.', lens: 'ACTIVITY',
    startStage: 0, endStage: 2, expectedResultClass: 'CANDIDATES',
    subpredicateLabels: ['Neutral accepted transfer-pool orientation', 'Accepted incident-window bound'],
  },
  {
    id: 'CANDIDATES_CASE_FILE_BOUNDS', cardId: 'CARD.S13_CANDIDATES', questionId: 'QUESTION.S13_CANDIDATES',
    title: 'CANDIDATES / CASE-FILE BOUNDS', question: 'Which DAI movements match the case-file approximate 8.88M amount band?', lens: 'ACTIVITY',
    startStage: 2, endStage: 4, expectedResultClass: 'CANDIDATES',
    subpredicateLabels: ['Case-file DAI asset bound', 'Case-file approximate 8.88M amount band'],
  },
  {
    id: 'RECEIPT_ROUTE_VERIFICATION', cardId: 'CARD.S13_RECEIPT', questionId: 'QUESTION.S13_RECEIPT',
    title: 'RECEIPT / ROUTE VERIFICATION', question: 'Which First Engine route contains the exact surviving receipt?', lens: 'RECEIPT',
    startStage: 4, endStage: 6, expectedResultClass: 'EXACT_RECEIPT',
    subpredicateLabels: ['First Engine to Receiving Vault route', 'Exact accepted receipt match'],
  },
] as const

export function s13QueryGroupForQuestion(questionId: string): S13QueryGroup | undefined {
  return S13_QUERY_GROUPS.find(group => group.questionId === questionId)
}

export function s13NextQueryGroup(stage: number): S13QueryGroup | undefined {
  return S13_QUERY_GROUPS.find(group => group.startStage === stage)
}

export interface S13QueryGroupSummary {
  inputCount: number
  outputCount: number
  stages: readonly S13Stage[]
}

/** One data-derived owner for the staged preview and pre-dispatch receipt funnel. */
export function s13QueryGroupSummary(runtime: S13Runtime, group: S13QueryGroup): S13QueryGroupSummary {
  const stages = runtime.evidenceDelta.stages.slice(group.startStage, group.endStage)
  if (stages.length !== group.endStage - group.startStage) throw new Error(`Incomplete S13 query group: ${group.id}`)
  const firstPrevious = stages.find(stage => stage.previousCount !== null)?.previousCount
  const inputCount = firstPrevious ?? runtime.evidenceDelta.sequence[0]
  const outputCount = stages.at(-1)?.newCount
  if (!Number.isSafeInteger(inputCount) || !Number.isSafeInteger(outputCount)) throw new Error(`Invalid S13 query-group counts: ${group.id}`)
  return { inputCount, outputCount: outputCount!, stages }
}

export function s13VisibleRecords(runtime: S13Runtime, stage: number): S13Record[] {
  if (!Number.isInteger(stage) || stage < 1 || stage > runtime.evidenceDelta.stages.length) return []
  const ids = new Set(runtime.evidenceDelta.stages[stage - 1]!.survivingRecordIds)
  return runtime.caseCorpus.filter((record) => ids.has(record.recordId))
}

/** Stable neutral player label; raw solution-bearing IDs remain internal until verification. */
export function s13RecordLabel(record: S13Record, index: number, verified: boolean): string {
  if (verified && record.recordId === 'HERO.EXACT_CONVERGENCE') return '◆ EXACT VERIFIED RECEIPT'
  const family = record.recordKind.includes('RELATIONSHIP') ? 'RELATIONSHIP' : record.recordKind.includes('ACTIVITY') ? 'ACTIVITY' : record.recordKind.includes('NO_MATCH') ? 'BOUNDED NO-MATCH' : 'TRANSFER'
  return `${family} RECORD ${String(index + 1).padStart(3, '0')}`
}
