import type { CaseFixture, CaseRecord, ClueState, DispatchResult, Filter, FolderStatus, Presentation, Query, QuestionCard, Section, ThreadStatus } from './contracts'
import { canonicalQuery, compareDecimal, dispatchQuery, firstExcludingPredicate, queryValidationIssues } from './query'
import { CANONICAL_SECTIONS } from './contracts'
import { investigationHintCopy } from '../controller/content/adapter'
import { SIDE_LEAD_TOKENS } from './sideLead'
import { S13_QUERY_GROUPS, s13NextQueryGroup, s13QueryGroupForQuestion, s13VisibleRecords } from './s13'
import { S16_QUERY_PLANS, createS16Run, s16RunIsValid, type S16QueryId, type S16QueryRun, type S16QuerySemantics, type S16RunOrigin } from './s16Queries'

export type Theory = 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' | 'FIRST_TRAIL_JOINS_SECOND_ROUTE'
export interface SideLeadState { noteDiscovered: boolean; selectedTokenId: string | null; marketContextReviewed: boolean; proofBoundaryReviewed: boolean; resolved: boolean }
export interface S16RecordContext { recordId: string; origin: { kind: 'ALL'; page: number } | { kind: 'RUN'; runId: string; page: number } | { kind: 'REPORT'; page: 0 }; sourcePage: 0 | 1 | 2 | 3 }
export interface S16LegacyReceipt { group: 'FLOOD_ORIENT' | 'CANDIDATES_CASE_FILE_BOUNDS' | 'RECEIPT_ROUTE_VERIFICATION'; status: 'COMPLETED' | 'DRAFT'; receiptReviewed: boolean }
export interface S16LegacySource { saveVersion: 2; source: { fixtureId: string; fixtureMode: CaseFixture['mode']; fixtureOrigin: string }; entries: Command[] }
export interface InvestigationState {
  version: '1.0.0'; fixtureId: string; fixtureMode: CaseFixture['mode']; fixtureOrigin: string; access: boolean; broadSeaSeen: boolean; section: Section; askOpen: boolean; presentation: Presentation
  discoveredClues: string[]; discoveredRecords: string[]; query: Query; past: Query[]; future: Query[]; lastDispatchQuery: Query | null
  result: DispatchResult | null; selectedRecordId: string | null; pinned: string[]; savedLeads: string[]; comparison: string[]; shown: number
  workingTheory: Theory | null; rejectedTheory: { id: Theory; firstContradiction: string } | null
  exactEventIds: string[]; exactConvergenceVerified: boolean; exactCorrectionStarted: boolean; assembly: Partial<Record<'AMOUNT' | 'RECEIVER' | 'LINK', string>>; complete: boolean
  savedQueries: Query[]; announcement: string; error: string | null; canister: 'EMPTY' | 'RETURNED' | 'OPEN'; sideLead: SideLeadState; candidateRouteResolved: boolean; commands: Command[]
  reviewedReceipt: string | null
  s13FilterStage: number; s13SelectedRecordId: string | null; s13VerifiedRecordId: string | null; s13Comparison: string[]
  s16Runs: S16QueryRun[]; s16SelectedRunId: string | null; s16StartAdded: boolean; s16RouteAdded: boolean; s16RouteRecordId: string | null
  s16RecordContext: S16RecordContext | null; s16Pages: Record<string, number>; s16LegacyHistory: S16LegacyReceipt[]; s16LegacySource: S16LegacySource | null; s16ConclusionReviewed: boolean
}
export type Command =
  | { type: 'EARN_ACCESS' }
  | { type: 'REVIEW_RECEIPT' }
  | { type: 'ASK_QUESTION' }
  | { type: 'SECTION'; section: Section }
  | { type: 'PRESENTATION'; mode: Presentation }
  | { type: 'READ_BRANCH'; branch: 'FIRST' | 'SECOND' }
  | { type: 'STAGE_CLUE'; clueId: string }
  | { type: 'STAGE_CARD'; cardId: string }
  | { type: 'ADD_FILTER'; filter: Filter }
  | { type: 'REMOVE_FILTER'; index: number }
  | { type: 'UNDO' | 'REDO' | 'RESET_LAST_DISPATCH' | 'RESET_QUERY' | 'RESET_CASE' | 'SAVE_QUERY' }
  | { type: 'LOAD_QUERY'; index: number }
  | { type: 'DISPATCH'; path: 'TERMINAL' | 'PLUNGER' }
  | { type: 'OPEN_CANISTER' }
  | { type: 'COLLECT_CASE_FILE' }
  | { type: 'COLLECT_SIDE_NOTE' }
  | { type: 'SELECT_SIDE_TOKEN'; tokenId: string }
  | { type: 'REVIEW_BRCG_MARKET' | 'REVIEW_BRCG_PROOF' }
  | { type: 'SELECT_RESULT' | 'PIN' | 'SAVE_LEAD' | 'COMPARE'; recordId: string }
  | { type: 'SHOW_MORE' }
  | { type: 'THEORY'; theory: Theory }
  | { type: 'DEFER_THEORY' }
  | { type: 'ASSEMBLE'; slot: 'AMOUNT' | 'RECEIVER' | 'LINK'; recordId: string }
  | { type: 'ACK_EXACT_CORRECTION' }
  | { type: 'S13_SELECT_RECORD'; recordId: string }
  | { type: 'S13_COMPARE'; recordId: string }
  | { type: 'S13_VERIFY_RECORD'; recordId: string }
  | { type: 'S16_RUN_QUERY'; planId: S16QueryId; semantics: S16QuerySemantics; origin: S16RunOrigin }
  | { type: 'S16_SELECT_RUN'; runId: string }
  | { type: 'S16_ADD_START' | 'S16_ADD_ROUTE'; runId: string; recordId: string }
  | { type: 'S16_OPEN_RECORD'; recordId: string; origin: { kind: 'ALL'; page: number } | { kind: 'RUN'; runId: string; page: number } | { kind: 'REPORT'; page: 0 } }
  | { type: 'S16_SOURCE_PAGE'; page: 0 | 1 | 2 | 3 }
  | { type: 'S16_CLOSE_RECORD' }
  | { type: 'S16_SET_PAGE'; key: string; page: number }
  | { type: 'S16_VERIFY_CONNECTION'; runId: string; recordId: string }
  | { type: 'S16_FILE_FINDINGS' | 'S16_REVIEW_CONCLUSION' }
  | { type: 'HINT'; tier: 'METHOD_HINT' | 'CASE_HINT' | 'DIRECT_HINT' }

const emptyQuery = (): Query => ({ lens: 'ACTIVITY', filters: [], questionId: 'QUESTION.ORIENT' })
// Deterministic origin binding, not a secret, signature or tamper-proof client save.
// Distinct synthetic record/proof namespaces also prevent metadata-only replay.
export function fixtureOrigin(fixture: CaseFixture): string {
  return 'TE-INVESTIGATION-ORIGIN@1.0.0:' + JSON.stringify({ id: fixture.id, mode: fixture.mode, recordIds: fixture.records.map(record => record.id).sort(), proofSlots: { AMOUNT: fixture.proof.slots.AMOUNT, RECEIVER: fixture.proof.slots.RECEIVER, LINK: fixture.proof.slots.LINK } })
}
function sameOrigin(fixture: CaseFixture, value: { fixtureId?: unknown; fixtureMode?: unknown; fixtureOrigin?: unknown } | null | undefined): boolean {
  return !!value && value.fixtureId === fixture.id && value.fixtureMode === fixture.mode && value.fixtureOrigin === fixtureOrigin(fixture)
}
function stateIdentifiersMatch(fixture: CaseFixture, state: InvestigationState): boolean {
  const records = new Set(fixture.records.map(record => record.id)), clues = new Set(fixture.clues.map(clue => clue.id))
  const list = (value: unknown, allowed: Set<string>): boolean => Array.isArray(value) && value.every(id => typeof id === 'string' && allowed.has(id))
  if (![state.discoveredRecords, state.pinned, state.savedLeads, state.comparison].every(ids => list(ids, records)) || !list(state.discoveredClues, clues) || (state.selectedRecordId !== null && !records.has(state.selectedRecordId))) return false
  if (!list(state.exactEventIds, new Set([...records].map(id => `EXACT.${id}`))) || !state.assembly || Object.entries(state.assembly).some(([slot, id]) => !['AMOUNT', 'RECEIVER', 'LINK'].includes(slot) || id !== fixture.proof.slots[slot as keyof typeof fixture.proof.slots])) return false
  const s13Ids = new Set(fixture.s13?.caseCorpus.map(record => record.recordId) ?? [])
  if (!Number.isSafeInteger(state.s13FilterStage) || state.s13FilterStage < 0 || state.s13FilterStage > (fixture.s13?.evidenceDelta.stages.length ?? 0) || (state.s13SelectedRecordId !== null && !s13Ids.has(state.s13SelectedRecordId)) || (state.s13VerifiedRecordId !== null && !s13Ids.has(state.s13VerifiedRecordId)) || !list(state.s13Comparison, s13Ids) || state.s13Comparison.length > 2) return false
  if (state.s13VerifiedRecordId !== null && state.s13VerifiedRecordId !== fixture.s13?.proof.exactRecord.recordId) return false
  if (!Array.isArray(state.s16Runs) || (state.s16Runs.length > 0 && (!fixture.s13 || !state.s16Runs.every((run, index) => s16RunIsValid(fixture.s13!, run, state.s16Runs.slice(0, index)))))) return false
  if (state.s16SelectedRunId !== null && !state.s16Runs.some(run => run.id === state.s16SelectedRunId)) return false
  if (typeof state.s16StartAdded !== 'boolean' || typeof state.s16RouteAdded !== 'boolean' || (state.s16RouteAdded !== (state.s16RouteRecordId !== null))) return false
  if (state.s16RouteRecordId !== null) {
    const q2 = state.s16Runs.find(run => run.planId === 'Q2' && run.mode === 'GUIDED')
    if (!q2 || !fixture.s13 || !s16RouteRecordAdmitted(fixture, state, q2.id, state.s16RouteRecordId)) return false
  }
  if (!state.s16Pages || Object.getPrototypeOf(state.s16Pages) !== Object.prototype || Object.entries(state.s16Pages).some(([key, page]) => (key !== 'ALL' && !state.s16Runs.some(run => run.id === key)) || !Number.isSafeInteger(page) || page < 0)) return false
  if (state.s16RecordContext !== null) {
    const context = state.s16RecordContext
    if (!s13Ids.has(context.recordId) || !Number.isSafeInteger(context.sourcePage) || context.sourcePage < 0 || context.sourcePage > 3 || !Number.isSafeInteger(context.origin.page) || context.origin.page < 0) return false
    if (context.origin.kind === 'RUN') {
      const runId = context.origin.runId
      const run = state.s16Runs.find(item => item.id === runId)
      if (!run || !run.matchingIds.includes(context.recordId)) return false
    }
  }
  if (!Array.isArray(state.s16LegacyHistory) || state.s16LegacyHistory.some(item => !['FLOOD_ORIENT', 'CANDIDATES_CASE_FILE_BOUNDS', 'RECEIPT_ROUTE_VERIFICATION'].includes(item.group) || !['COMPLETED', 'DRAFT'].includes(item.status) || typeof item.receiptReviewed !== 'boolean')) return false
  if (state.s16LegacySource !== null) {
    const legacy = state.s16LegacySource
    if (!isClosed(legacy, ['saveVersion', 'source', 'entries']) || legacy.saveVersion !== 2 || !isClosed(legacy.source, ['fixtureId', 'fixtureMode', 'fixtureOrigin']) || !sameOrigin(fixture, legacy.source) || !Array.isArray(legacy.entries) || !legacy.entries.every(entry => v2CommandShape(fixture, entry))) return false
  }
  if (typeof state.s16ConclusionReviewed !== 'boolean' || (state.s16ConclusionReviewed && !state.complete)) return false
  const guided = state.s16Runs.filter(run => run.mode === 'GUIDED').map(run => run.planId)
  if (new Set(guided).size !== guided.length || (guided.includes('Q3') && guided[0] !== 'Q2') || (state.s16StartAdded && !guided.includes('Q2')) || (state.s16RouteAdded && !guided.includes('Q2'))) return false
  if (state.result && !list(state.result.recordIds, records)) return false
  if (!state.sideLead || typeof state.sideLead.noteDiscovered !== 'boolean' || typeof state.sideLead.marketContextReviewed !== 'boolean' || typeof state.sideLead.proofBoundaryReviewed !== 'boolean' || typeof state.sideLead.resolved !== 'boolean') return false
  if (state.sideLead.selectedTokenId !== null && !SIDE_LEAD_TOKENS.some(token => token.id === state.sideLead.selectedTokenId)) return false
  if (state.sideLead.resolved !== (state.sideLead.marketContextReviewed && state.sideLead.proofBoundaryReviewed) || (!state.sideLead.noteDiscovered && (state.sideLead.selectedTokenId !== null || state.sideLead.marketContextReviewed || state.sideLead.proofBoundaryReviewed))) return false
  return !state.complete || (['AMOUNT', 'RECEIVER', 'LINK'] as const).every(slot => state.assembly[slot] === fixture.proof.slots[slot])
}
export function createInvestigationState(fixture: CaseFixture): InvestigationState {
  return { version: '1.0.0', reviewedReceipt: null, s13FilterStage: 0, s13SelectedRecordId: null, s13VerifiedRecordId: null, s13Comparison: [], s16Runs: [], s16SelectedRunId: null, s16StartAdded: false, s16RouteAdded: false, s16RouteRecordId: null, s16RecordContext: null, s16Pages: { ALL: 0 }, s16LegacyHistory: [], s16LegacySource: null, s16ConclusionReviewed: false, fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture), access: false, broadSeaSeen: false, section: 'CASE', askOpen: false, presentation: 'FULLSCREEN_CRT', discoveredClues: [], discoveredRecords: [], query: emptyQuery(), past: [], future: [], lastDispatchQuery: null, result: null, selectedRecordId: null, pinned: [], savedLeads: [], comparison: [], shown: 3, workingTheory: null, rejectedTheory: null, exactEventIds: [], exactConvergenceVerified: false, exactCorrectionStarted: false, assembly: {}, complete: false, savedQueries: [], announcement: 'Earn terminal authorization in the Records Office.', error: null, canister: 'EMPTY', sideLead: { noteDiscovered: false, selectedTokenId: null, marketContextReviewed: false, proofBoundaryReviewed: false, resolved: false }, candidateRouteResolved: false, commands: [] }
}
const unique = (values: string[]) => [...new Set(values)]
export function collectedStartingClues(fixture: CaseFixture, state: InvestigationState): boolean {
  return fixture.startingClueIds.every((id) => state.discoveredClues.includes(id))
}
export function s13CaseFileGateSatisfied(fixture: CaseFixture, state: InvestigationState): boolean {
  return !!fixture.s13 && fixture.s13.caseFileGate.clueIds.every(id => state.discoveredClues.includes(id))
}
export function visibleClues(fixture: CaseFixture, state: InvestigationState) { return fixture.clues.filter(({ id }) => state.discoveredClues.includes(id)) }
export function clueState(fixture: CaseFixture, state: InvestigationState, clueId: string): ClueState {
  if (!state.discoveredClues.includes(clueId)) return 'LOCKED'
  if (state.query.filters.some(({ sourceId }) => sourceId === clueId)) return 'APPLIED'
  const clue = fixture.clues.find(({ id }) => id === clueId)
  if (clue?.sourceRecordIds.some((id) => state.exactEventIds.includes(`EXACT.${id}`))) return 'ARCHIVED'
  if (clue?.sourceRecordIds.some((id) => state.pinned.includes(id))) return 'PINNED'
  if (clue?.sourceRecordIds.includes(state.selectedRecordId ?? '')) return 'RELATED'
  return clue?.role === 'CANDIDATE' ? 'DISCOVERED' : 'AVAILABLE'
}
export function knownRecords(fixture: CaseFixture, state: InvestigationState) { return fixture.records.filter(({ id }) => state.discoveredRecords.includes(id)) }
export function openQuestion(fixture: CaseFixture, state: InvestigationState) {
  if (!state.access) return 'How do I earn authorized access?'
  if (state.complete) return fixture.proof.boundary
  if (state.exactEventIds.length) return 'Which exact records fill Amount, Receiver, and Link?'
  if (state.pinned.length) return 'Which exact record tests the unresolved thread gap?'
  return fixture.question
}
// S9-P1-R1 candidate-route milestone: a TEST-question dispatch (FOLLOW_FORWARD
// or COMPARE_ROUTES) resolved to records. Comparison clicks, theory filings,
// and selected-record state alone never satisfy it. Fail-closed without access.
export function candidateRouteResolvedMilestone(_fixture: CaseFixture, state: InvestigationState): boolean {
  return state.access && state.candidateRouteResolved
}
export function availableCards(fixture: CaseFixture, state: InvestigationState): QuestionCard[] {
  if (!state.access) return []
  const clues = visibleClues(fixture, state)
  const clueId = (id: string) => fixture.mode === 'SYNTHETIC_TEST' ? `${fixture.id}.${id}` : id
  const filters = (ids: string[]) => clues.filter(({ id }) => ids.map(clueId).includes(id)).flatMap(({ filters: effects }) => effects)
  const make = (id: string, question: string, lens: QuestionCard['lens'], stage: QuestionCard['stage'], prerequisites: string[], effects: QuestionCard['effects'], resultClass: string, complexity: number): QuestionCard => ({ id: `CARD.${id}`, questionId: `QUESTION.${id}`, question, lens, stage, prerequisites, effects, why: `Uses discovered ${prerequisites.join(', ')} to address the active open question.`, resultClass, mayEstablish: lens === 'STATE' ? 'Bounded state corroboration.' : lens === 'RECEIPT' ? 'An exact event, only if the accepted relationship predicate matches.' : 'Observed activity or candidate relationships within retrieved coverage.', cannotEstablish: fixture.proof.boundary, nextRule: lens === 'RECEIPT' ? 'File exact proof or inspect why it is insufficient.' : 'Test time, direction, asset, then an exact receipt.', family: lens === 'STATE' ? 'profiler/address/historical-balances (fixture fallback: transaction-derived state)' : lens === 'RELATIONSHIPS' ? 'profiler/address/counterparties' : lens === 'RECEIPT' ? 'transaction-with-token-transfer-lookup' : 'profiler/address/transactions', complexity, lead_promoted: false })
  if (fixture.s13 && s13CaseFileGateSatisfied(fixture, state)) {
    const group = s13NextQueryGroup(state.s13FilterStage)
    if (!group) return []
    const prerequisites = group.id === 'CANDIDATES_CASE_FILE_BOUNDS' ? [...fixture.s13.caseFileGate.clueIds] : []
    const effects = group.id === 'CANDIDATES_CASE_FILE_BOUNDS' ? filters([...fixture.s13.caseFileGate.clueIds]) : []
    return [{ id: group.cardId, questionId: group.questionId, question: group.question, lens: group.lens, stage: group.id === 'FLOOD_ORIENT' ? 'ORIENT' : group.id === 'CANDIDATES_CASE_FILE_BOUNDS' ? 'NARROW' : 'VERIFY', prerequisites, effects, why: `Uses the accepted ${group.title.toLowerCase()} transaction to apply ${group.subpredicateLabels.join(' and ')}.`, resultClass: group.expectedResultClass, mayEstablish: fixture.s13.evidenceDelta.stages[group.endStage - 1]!.whatTheStageMayEstablish ?? '', cannotEstablish: fixture.s13.evidenceDelta.stages[group.endStage - 1]!.whatItCannotEstablish ?? fixture.proof.boundary, nextRule: group.endStage === 6 ? 'Inspect and explicitly verify the surviving source.' : 'Review the Evidence Delta, then stage the next CASE question.', family: group.lens === 'RECEIPT' ? 'transaction-with-token-transfer-lookup' : 'profiler/address/transactions', complexity: group.endStage / 2, lead_promoted: false }]
  }
  const cards = [
    make('WHAT_LEFT', 'What left the First Engine?', 'ACTIVITY', 'ORIENT', ['CLUE.START', 'CLUE.OUT'], filters(['CLUE.OUT']), 'ACTIVITY', 1),
    make('INCIDENT', 'WHAT HAPPENED DURING THE INCIDENT WINDOW?', 'ACTIVITY', 'ORIENT', ['CLUE.START', 'CLUE.WINDOW'], filters(['CLUE.START', 'CLUE.WINDOW']), 'ACTIVITY', 1),
    make('INCIDENT_DAI', 'Which DAI movements match the incident window?', 'ACTIVITY', 'ORIENT', ['CLUE.ASSET', 'CLUE.FILE_ASSET_ADDRESS', 'CLUE.WINDOW'], filters(['CLUE.ASSET', 'CLUE.WINDOW']), 'ACTIVITY', 1),
    make('ASSET_OUT', 'SHOW THIS ASSET MOVING OUT', 'ACTIVITY', 'NARROW', ['CLUE.START', 'CLUE.ASSET', 'CLUE.OUT'], filters(['CLUE.ASSET', 'CLUE.OUT', 'CLUE.WINDOW']), 'CANDIDATES', 2),
    make('HIGH_VALUE', 'SHOW HIGH-VALUE ACTIVITY', 'ACTIVITY', 'NARROW', ['CLUE.START', 'CLUE.ASSET', 'CLUE.AMOUNT'], filters(['CLUE.START', 'CLUE.ASSET', 'CLUE.AMOUNT']), 'CANDIDATES', 3),
    make('INTERACTIONS', 'Who interacted with the First Engine?', 'RELATIONSHIPS', 'RELATE', ['CLUE.START'], filters(['CLUE.START', 'CLUE.WINDOW']), 'COUNTERPARTIES', 2),
    make('STATE_CHANGE', 'What changed before and after?', 'STATE', 'CORROBORATE', ['CLUE.START', 'CLUE.WINDOW'], filters(['CLUE.START', 'CLUE.WINDOW']), 'STATE', 2),
  ]
  const startingSubject = fixture.clues.find(({ id }) => id === clueId('CLUE.START'))?.filters[0]?.value
  if (startingSubject) cards.push(make('WHAT_ARRIVED', 'WHAT ARRIVED HERE?', 'ACTIVITY', 'ORIENT', ['CLUE.START'], [{ field: 'DESTINATION', value: startingSubject }], 'ACTIVITY', 1))
  const selected = knownRecords(fixture, state).find(({ id }) => id === state.selectedRecordId)
  if (selected) {
    cards.push(make('FOLLOW_FORWARD', 'FOLLOW THIS CANDIDATE FORWARD', 'RELATIONSHIPS', 'TEST', [], [{ field: 'SOURCE', value: selected.destination }], 'CANDIDATES', 2))
    cards.push(make('EXACT_RECEIPT', 'Which exact record shows the First Engine sending the recorded DAI amount to the Receiving Vault inside the case window?', 'RECEIPT', 'VERIFY', [], [{ field: 'TRANSACTION', value: selected.transactionHash }], 'EXACT_RECEIPT', 1))
  }
  if (state.comparison.length === 2 && candidateRouteResolvedMilestone(fixture, state)) cards.push(make('COMPARE_ROUTES', 'COMPARE THESE TWO ROUTES', 'RELATIONSHIPS', 'TEST', [], [{ field: 'RECORD_SET', value: [...state.comparison].sort().join('|') }], 'COMPARISON', 2))
  // S9-P1-R1 progressive disclosure: stage 3 foregrounds exactly the one
  // guided first question (CARD.INCIDENT_DAI, stageable from case-file facts
  // alone); the VERIFY/exact card requires candidate-route resolution.
  const STAGE3_IDS = ['CARD.INCIDENT_DAI']
  return cards.map(card => ({ ...card, prerequisites: card.prerequisites.map(clueId) }))
    .filter((card) => card.prerequisites.every((id) => state.discoveredClues.includes(id)))
    .filter((card) => (card.stage === 'VERIFY' ? state.candidateRouteResolved : true))
    .filter((card) => (!state.result && state.exactEventIds.length === 0 ? STAGE3_IDS.includes(card.id) : true))
}
export function recommendations(fixture: CaseFixture, state: InvestigationState) {
  const cards = availableCards(fixture, state)
  if (!state.result && !state.exactEventIds.length && !state.comparison.length && !state.workingTheory) {
    return cards
  }
  const visited = new Set(state.commands.filter((command) => command.type === 'STAGE_CARD').map((command) => command.cardId))
  const ranked = cards.sort((a, b) => {
    const relevance = (card: QuestionCard) => state.selectedRecordId && !state.exactEventIds.length && card.stage === 'VERIFY' ? 0 : state.result && card.stage === 'NARROW' ? 1 : card.stage === 'ORIENT' ? 2 : 3
    return relevance(a) - relevance(b) || Number(visited.has(a.id)) - Number(visited.has(b.id)) || a.complexity - b.complexity || a.id.localeCompare(b.id)
  })
  const chosen: QuestionCard[] = []
  for (const card of ranked) if (!chosen.some((other) => other.lens === card.lens) && chosen.length < 3) chosen.push(card)
  for (const card of ranked) if (!chosen.includes(card) && chosen.length < 3) chosen.push(card)
  return chosen
}
export type TerminalStage = 1 | 2 | 3 | 4 | 5 | 6
export interface TerminalCapabilities { stage: TerminalStage; canOpen: boolean; sections: Section[]; askCardIds: string[]; showQuerySurface: boolean; allowTheory: boolean; allowCompare: boolean; allowSecondMemory: boolean; sideLeadVisible: boolean }
export function terminalCapabilities(fixture: CaseFixture, state: InvestigationState): TerminalCapabilities {
  const collected = collectedStartingClues(fixture, state)
  const routeResolved = candidateRouteResolvedMilestone(fixture, state)
  const exact = state.exactEventIds.length > 0
  const stage: TerminalStage = !state.access ? 1 : !collected ? 2 : !state.result && !exact ? 3 : !routeResolved && !exact ? 4 : !exact ? 5 : 6
  const ordinarySections: Section[] = stage <= 1 ? [] : stage <= 3 ? ['CASE'] : stage === 4 ? ['CASE', 'RESULTS', 'SOURCE', 'LEDGER'] : ['CASE', 'RESULTS', 'EXPLORE', 'SOURCE', 'LEDGER']
  const sections = fixture.s13 && s13CaseFileGateSatisfied(fixture, state) ? [...CANONICAL_SECTIONS] : ordinarySections
  return {
    stage,
    canOpen: state.access,
    sections,
    askCardIds: stage < 3 ? [] : availableCards(fixture, state).map((card) => card.id),
    showQuerySurface: stage >= 3,
    allowTheory: candidateRouteResolvedMilestone(fixture, state),
    allowCompare: candidateRouteResolvedMilestone(fixture, state),
    allowSecondMemory: stage >= 4,
    sideLeadVisible: state.sideLead.noteDiscovered,
  }
}
export function exactPredicate(fixture: CaseFixture, record: CaseRecord) {
  const opening = fixture.records.find(({ id }) => id === fixture.openingRecordId)
  try {
    if (!opening || !record.assetAmounts.some((amount) => amount.asset === fixture.proof.linkAsset && opening.assetAmounts.some((first) => first.asset === amount.asset && first.unit === amount.unit && compareDecimal(amount.amount, first.amount) <= 0))) return false
  } catch { return false }
  return record.id === fixture.proof.slots.LINK && record.grade === 'EXACT' && record.exactRelationship && record.derivedFrom.length === 0 && record.source === fixture.proof.linkSource && record.destination === fixture.proof.linkDestination && record.observedAtUtc === fixture.proof.linkTimeUtc && Date.parse(record.observedAtUtc) <= Date.parse(fixture.cutoffUtc) && record.assetAmounts.some(({ asset }) => asset === fixture.proof.linkAsset) && /^[a-f0-9]{64}$/.test(record.provenance.rawSha256)
}
/** Validate the fixture-owned proof map privately before publishing any slot. */
export function validatedProofAssembly(fixture: CaseFixture): InvestigationState['assembly'] | null {
  const slots = ['AMOUNT', 'RECEIVER', 'LINK'] as const
  const records = slots.map(slot => fixture.records.find(record => record.id === fixture.proof.slots[slot]))
  if (records.some(record => !record || record.grade !== 'EXACT' || record.derivedFrom.length > 0)) return null
  const link = records[2]
  if (!link || !exactPredicate(fixture, link)) return null
  return { AMOUNT: fixture.proof.slots.AMOUNT, RECEIVER: fixture.proof.slots.RECEIVER, LINK: fixture.proof.slots.LINK }
}
export function folderStatus(state: InvestigationState, record: CaseRecord): FolderStatus {
  if (state.exactEventIds.includes(`EXACT.${record.id}`)) return 'EXACT'
  if (state.rejectedTheory?.firstContradiction === record.id) return 'EXACT'
  if (state.savedLeads.includes(record.id)) return 'SAVED'
  return record.grade === 'CORROBORATING' ? 'CORROBORATING' : 'UNTESTED'
}
export function threadChecks(fixture: CaseFixture, state: InvestigationState, record: CaseRecord) {
  const opening = fixture.records.find(({ id }) => id === fixture.openingRecordId)!
  const sameAsset = record.assetAmounts.some(({ asset }) => opening.assetAmounts.some((amount) => amount.asset === asset))
  const exact = state.exactEventIds.includes(`EXACT.${record.id}`)
  return [
    { dimension: 'CHRONOLOGY', status: record.observedAtUtc >= opening.observedAtUtc ? 'PASS' : 'FAIL', explanation: 'Record order relative to the earned first event.' },
    { dimension: 'SOURCE_DESTINATION', status: record.source === opening.destination ? 'PASS' : 'UNRESOLVED', explanation: 'A shared address is compatibility, not human identity.' },
    { dimension: 'ASSET_OR_PROVEN_TRANSFORMATION', status: sameAsset ? 'PASS' : 'UNRESOLVED', explanation: 'Unlike assets are never silently added.' },
    { dimension: 'AMOUNT_RELATIONSHIP', status: exact && sameAsset && record.assetAmounts.some((amount) => opening.assetAmounts.some((first) => first.asset === amount.asset && first.unit === amount.unit && compareDecimal(amount.amount, first.amount) <= 0)) ? 'PASS' : 'UNRESOLVED', explanation: exact ? 'Exact event amount is within the earned amount in the same asset and unit; this does not allocate all later value.' : 'Provider precision and a specific exact relationship are required; no cross-unit sum.' },
    { dimension: 'EXACT_RELATIONSHIP', status: exact ? 'PASS' : 'UNRESOLVED', explanation: exact ? 'Accepted exact predicate verified.' : 'Candidate fit is not proof.' },
    { dimension: 'CUTOFF', status: record.observedAtUtc <= fixture.cutoffUtc ? 'PASS' : 'FAIL', explanation: fixture.cutoffUtc },
  ]
}
export function threadStatus(fixture: CaseFixture, state: InvestigationState): ThreadStatus {
  if (state.exactEventIds.length) return 'PROVED'
  const records = fixture.records.filter(({ id }) => state.pinned.includes(id))
  if (!records.length) return 'OPEN'
  if (records.some((record) => threadChecks(fixture, state, record).some(({ status }) => status === 'FAIL'))) return 'CONTRADICTED'
  if (records.some(({ grade }) => grade === 'CORROBORATING')) return 'CORROBORATED_NOT_PROVEN'
  return records.some((record) => record.source === fixture.records.find(({ id }) => id === fixture.openingRecordId)!.destination) ? 'NEEDS_EXACT_LINK' : 'CANDIDATE_FITS'
}
function changeQuery(state: InvestigationState, query: Query): InvestigationState {
  return { ...state, query, reviewedReceipt: null, past: [...state.past, structuredClone(state.query)].slice(-100), future: [], section: 'CASE', askOpen: true, error: null, announcement: 'Query changed. Review every active filter in the Query Receipt.' }
}
export function queryReceiptKey(query: Query): string {
  return JSON.stringify({ questionId: query.questionId, ...canonicalQuery(query) })
}
function s16QueryUnlocked(fixture: CaseFixture, state: InvestigationState, planId: S16QueryId, semantics: S16QuerySemantics): boolean {
  if (!fixture.s13 || !s13CaseFileGateSatisfied(fixture, state)) return false
  const plan = S16_QUERY_PLANS[planId]
  if (!plan) return false
  if (planId === 'P_VIEWS' && semantics !== 'R1') return false
  if (plan.mode === 'GUIDED' && state.s16Runs.some(run => run.planId === planId)) return false
  if (plan.gate === 'START' && !state.s16StartAdded) return false
  if (plan.gate === 'ROUTE' && !state.s16RouteAdded) return false
  if (planId === 'Q3' && (!state.s16StartAdded || !state.s16RouteAdded || !state.s16Runs.some(run => run.planId === 'Q2' && run.mode === 'GUIDED'))) return false
  return true
}
export function s16RouteRecordAdmitted(fixture: CaseFixture, state: InvestigationState, runId: string, recordId: string): boolean {
  const run = state.s16Runs.find(item => item.id === runId && item.planId === 'Q2' && item.mode === 'GUIDED')
  const exact = fixture.s13?.proof.exactRecord
  const supporting = fixture.s13?.proof.contextualCorroboration
  if (!run || !exact || !supporting || !run.matchingIds.includes(recordId)) return false
  const record = fixture.s13?.caseCorpus.find(item => item.recordId === recordId)
  return !!record && record.transaction_hash === exact.transaction_hash && (recordId === exact.recordId || recordId === supporting.recordId)
}
function apply(fixture: CaseFixture, state: InvestigationState, command: Command): InvestigationState {
  if (command.type === 'RESET_CASE') {
    if (!state.access) return createInvestigationState(fixture)
    let next = apply(fixture, createInvestigationState(fixture), { type: 'EARN_ACCESS' })
    if (collectedStartingClues(fixture, state)) next = apply(fixture, next, { type: 'COLLECT_CASE_FILE' })
    if (state.sideLead.noteDiscovered) next = apply(fixture, next, { type: 'COLLECT_SIDE_NOTE' })
    return next
  }
  if (command.type === 'EARN_ACCESS') return state.access ? state : { ...state, access: true, announcement: 'Terminal authorized for today. Collect the official case file to establish known inputs.' }
  if (command.type === 'COLLECT_CASE_FILE') {
    if (!state.access) return { ...state, error: 'Earn access through the accepted Records Office puzzle first.' }
    if (collectedStartingClues(fixture, state)) return state
    return { ...state, discoveredClues: unique([...state.discoveredClues, ...fixture.startingClueIds]), announcement: 'Euler case file collected. DAI, token contract, amount, and incident window established.' }
  }
  if (command.type === 'COLLECT_SIDE_NOTE') {
    if (!state.access) return { ...state, error: 'Earn access through the accepted Records Office puzzle first.' }
    if (state.sideLead.noteDiscovered) return state
    return { ...state, sideLead: { ...state.sideLead, noteDiscovered: true }, announcement: 'Office-note token lead filed. Not Euler case evidence.' }
  }
  if (command.type === 'SELECT_SIDE_TOKEN') {
    if (!state.sideLead.noteDiscovered) return { ...state, error: 'No office note has been discovered.' }
    if (!SIDE_LEAD_TOKENS.some((token) => token.id === command.tokenId)) return { ...state, error: 'Unknown token choice.' }
    return { ...state, sideLead: { ...state.sideLead, selectedTokenId: command.tokenId }, announcement: 'BRCG identified. Market snapshot ready for review.' }
  }
  if (command.type === 'REVIEW_BRCG_MARKET' || command.type === 'REVIEW_BRCG_PROOF') {
    if (!state.sideLead.noteDiscovered || state.sideLead.selectedTokenId !== 'BRCG') return { ...state, error: 'Identify BRCG from the fully read note before reviewing Token God Mode.' }
    const sideLead = { ...state.sideLead, ...(command.type === 'REVIEW_BRCG_MARKET' ? { marketContextReviewed: true } : { proofBoundaryReviewed: true }) }
    sideLead.resolved = sideLead.marketContextReviewed && sideLead.proofBoundaryReviewed
    const announcement = sideLead.resolved
      ? 'BRCG snapshot resolved. The token count is worth about $7.10 at the recorded price; ownership, access, and saleability remain unknown.'
      : command.type === 'REVIEW_BRCG_MARKET'
        ? 'Market context logged: 0 buyers, 22 sellers, and $13.16 of seven-day volume indicate very little active demand. Confirm the evidence limits next.'
        : 'Evidence limits confirmed. This snapshot does not prove ownership, access, saleability, or any Euler connection. Log the market context next.'
    return { ...state, sideLead, error: null, announcement }
  }
  if (!state.access) return { ...state, error: 'Earn access through the accepted Records Office puzzle first.' }
  switch (command.type) {
    case 'S16_RUN_QUERY': {
      if (!fixture.s13 || !s16QueryUnlocked(fixture, state, command.planId, command.semantics)) return { ...state, error: 'That question is not available at this point in the case.' }
      const run = createS16Run(fixture.s13, command.planId, state.s16Runs, command.semantics, command.origin)
      const guidedStage = command.planId === 'Q2' ? 4 : command.planId === 'Q3' ? 6 : state.s13FilterStage
      return { ...state, s16Runs: [...state.s16Runs, run], s16SelectedRunId: run.id, s13FilterStage: guidedStage, s13SelectedRecordId: null, s13Comparison: [], s16RecordContext: null, section: 'RESULTS', askOpen: false, broadSeaSeen: true, error: null, announcement: `${run.short}: ${run.countStages.join(' → ')} records.` }
    }
    case 'S16_SELECT_RUN': return state.s16Runs.some(run => run.id === command.runId) ? { ...state, s16SelectedRunId: command.runId, s16RecordContext: null, section: 'RESULTS', error: null, announcement: 'Saved query results reopened without rerunning.' } : { ...state, error: 'That saved query is unavailable.' }
    case 'S16_ADD_START': {
      const run = state.s16Runs.find(item => item.planId === 'Q2' && item.mode === 'GUIDED')
      const early = fixture.s13?.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')
      if (!run || command.runId !== run.id || !early || command.recordId !== early.recordId || !run.matchingIds.includes(command.recordId) || state.s16RecordContext?.recordId !== command.recordId || state.s16RecordContext.origin.kind !== 'RUN' || state.s16RecordContext.origin.runId !== command.runId) return { ...state, error: 'Review the matching first transfer from its saved result before adding it.' }
      return { ...state, s16StartAdded: true, error: null, announcement: 'First transfer saved. First Engine is a case nickname for the destination address, not its owner.' }
    }
    case 'S16_ADD_ROUTE': {
      const run = state.s16Runs.find(item => item.planId === 'Q2' && item.mode === 'GUIDED')
      if (!run || command.runId !== run.id || !s16RouteRecordAdmitted(fixture, state, command.runId, command.recordId) || state.s16RecordContext?.recordId !== command.recordId || state.s16RecordContext.origin.kind !== 'RUN' || state.s16RecordContext.origin.runId !== command.runId) return { ...state, error: 'Open an admitted later transaction view from the saved matches before saving it.' }
      return { ...state, s16RouteAdded: true, s16RouteRecordId: command.recordId, candidateRouteResolved: true, error: null, announcement: 'Possible connection saved. First Engine and Receiving Vault are address nicknames, not identity claims.' }
    }
    case 'S16_OPEN_RECORD': {
      if (!fixture.s13?.caseCorpus.some(record => record.recordId === command.recordId)) return { ...state, error: 'That record is unavailable.' }
      if (command.origin.kind === 'RUN') {
        const runId = command.origin.runId
        const run = state.s16Runs.find(item => item.id === runId)
        if (!run?.matchingIds.includes(command.recordId)) return { ...state, error: 'That record does not belong to the selected saved result.' }
      }
      if (command.origin.kind === 'REPORT' && (state.s13VerifiedRecordId !== command.recordId || command.recordId !== fixture.s13.proof.exactRecord.recordId)) return { ...state, error: 'Only the verified report transaction can be opened from the case report.' }
      return { ...state, ...(command.origin.kind === 'RUN' ? { s16SelectedRunId: command.origin.runId, section: 'RESULTS' as const } : {}), s16RecordContext: { recordId: command.recordId, origin: structuredClone(command.origin), sourcePage: 0 }, error: null, announcement: 'Record summary opened from its saved origin.' }
    }
    case 'S16_SOURCE_PAGE': return state.s16RecordContext ? { ...state, s16RecordContext: { ...state.s16RecordContext, sourcePage: command.page }, error: null, announcement: command.page ? 'Selected record source page.' : 'Selected record summary.' } : { ...state, error: 'Open a record before viewing its source.' }
    case 'S16_CLOSE_RECORD': return state.s16RecordContext ? { ...state, s16RecordContext: null, error: null, announcement: 'Returned to the originating record list.' } : state
    case 'S16_SET_PAGE': return { ...state, s16Pages: { ...state.s16Pages, [command.key]: command.page }, error: null }
    case 'S16_VERIFY_CONNECTION': {
      const exact = fixture.s13?.proof.exactRecord
      const run = state.s16Runs.find(item => item.id === command.runId && item.planId === 'Q3' && item.mode === 'GUIDED')
      const context = state.s16RecordContext
      if (!exact || !run || command.recordId !== exact.recordId || !run.matchingIds.includes(command.recordId) || context?.recordId !== command.recordId || context.origin.kind !== 'RUN' || context.origin.runId !== command.runId) return { ...state, error: 'Open the exact surviving transaction from the current connection result before verifying it.' }
      const selected = apply(fixture, state, { type: 'S13_SELECT_RECORD', recordId: command.recordId })
      const verified = apply(fixture, selected, { type: 'S13_VERIFY_RECORD', recordId: command.recordId })
      return verified.s13VerifiedRecordId === command.recordId ? { ...verified, workingTheory: null, rejectedTheory: null, s16RecordContext: null, section: 'CASE' } : verified
    }
    case 'S16_FILE_FINDINGS': {
      const exact = fixture.s13?.proof.exactRecord
      const assembly = validatedProofAssembly(fixture)
      if (!exact || state.s13VerifiedRecordId !== exact.recordId || !assembly) return { ...state, error: 'Review and verify the exact receipt before filing findings.' }
      return { ...state, assembly, complete: true, error: null, announcement: `${fixture.proof.conclusion} Findings filed; the case remains open until confirmed closure. ${fixture.proof.boundary}` }
    }
    case 'S16_REVIEW_CONCLUSION': return state.complete ? { ...state, s16ConclusionReviewed: true, error: null, announcement: 'Bounded conclusion reviewed. The case remains open until explicit confirmation.' } : { ...state, error: 'File the exact findings before reviewing the conclusion.' }
    case 'REVIEW_RECEIPT': return { ...state, reviewedReceipt: queryReceiptKey(state.query), announcement: 'Query Receipt reviewed. The staged question may now be dispatched without hidden filters.' }
    case 'SECTION': return CANONICAL_SECTIONS.includes(command.section) ? { ...state, section: command.section, broadSeaSeen: state.broadSeaSeen || command.section === 'EXPLORE', error: null, announcement: `${command.section} section.` } : { ...state, error: 'Noncanonical section rejected; ASK belongs inside CASE and ARCHIVE is not a section.' }
    case 'ASK_QUESTION': return { ...state, section: 'CASE', askOpen: true, announcement: 'Build a bounded question inside CASE; review its Query Receipt before dispatch.' }
    case 'PRESENTATION': return { ...state, presentation: command.mode, announcement: `${command.mode}; the same case state and controls are preserved.` }
    case 'READ_BRANCH': {
      if (!state.result) return { ...state, error: 'Breach memories are unavailable before the first dispatch.' }
      return { ...state, discoveredRecords: unique([...state.discoveredRecords, command.branch === 'FIRST' ? fixture.openingRecordId : fixture.secondRecordId]), announcement: 'True breach memory added to Known Facts.' }
    }
    case 'STAGE_CLUE': {
      const clue = visibleClues(fixture, state).find(({ id }) => id === command.clueId)
      if (!clue) return { ...state, error: 'That clue has not been discovered.' }
      const added = clue.filters.map((filter): Filter => ({ ...filter, origin: 'CASE_CLUE', sourceId: clue.id }))
      const filters = [...state.query.filters, ...added].filter((filter, index, all) => all.findIndex((item) => item.field === filter.field && item.value === filter.value) === index)
      return changeQuery(state, { ...state.query, filters })
    }
    case 'STAGE_CARD': {
      const card = availableCards(fixture, state).find(({ id }) => id === command.cardId)
      if (!card) return { ...state, error: 'Question prerequisites are not discovered.' }
      return changeQuery(state, { lens: card.lens, questionId: card.questionId, filters: card.effects.map((filter) => ({ ...filter, origin: card.stage === 'VERIFY' || card.id === 'CARD.FOLLOW_FORWARD' ? 'RESULT_DERIVED' : 'QUESTION_CARD', sourceId: card.id })) })
    }
    case 'ADD_FILTER': {
      const filter = command.filter
      const allowedFields = ['SUBJECT', 'SOURCE', 'DESTINATION', 'ASSET', 'FROM', 'TO', 'MIN_AMOUNT', 'TRANSACTION', 'GRADE', 'KIND', 'RECORD_SET']
      if (!allowedFields.includes(filter.field) || !filter.value || filter.value.length > 200) return { ...state, error: 'Invalid filter; staged inputs preserved.' }
      const known = knownRecords(fixture, state)
      const clueValues = visibleClues(fixture, state).flatMap((clue) => clue.filters.filter((item) => item.field === filter.field).map((item) => item.value))
      const identifiers = ['SUBJECT', 'SOURCE', 'DESTINATION'].includes(filter.field) ? known.flatMap((record) => [record.source, record.destination]) : filter.field === 'TRANSACTION' ? known.map((record) => record.transactionHash) : filter.field === 'ASSET' ? known.flatMap((record) => record.assetAmounts.map((amount) => amount.asset)) : []
      if (['SUBJECT', 'SOURCE', 'DESTINATION', 'TRANSACTION', 'ASSET'].includes(filter.field) && ![...clueValues, ...identifiers].some((value) => value.toLowerCase() === filter.value.toLowerCase())) return { ...state, error: 'That identifier has not been discovered; staged inputs preserved.' }
      if (filter.field === 'RECORD_SET' && filter.value.split('|').some((id) => !known.some((record) => record.id === id))) return { ...state, error: 'That record has not been discovered; staged inputs preserved.' }
      if (['MIN_AMOUNT'].includes(filter.field)) { try { compareDecimal(filter.value, '0') } catch { return { ...state, error: 'Invalid decimal; staged inputs preserved.' } } }
      if (['FROM', 'TO'].includes(filter.field) && !Number.isFinite(Date.parse(filter.value))) return { ...state, error: 'Invalid time; staged inputs preserved.' }
      return changeQuery(state, { ...state.query, filters: [...state.query.filters, filter] })
    }
    case 'REMOVE_FILTER': return changeQuery(state, { ...state.query, filters: state.query.filters.filter((_, index) => index !== command.index) })
    case 'UNDO': { const query = state.past.at(-1); return query ? { ...state, query, past: state.past.slice(0, -1), future: [state.query, ...state.future], announcement: 'Query undone; discovered evidence preserved.' } : state }
    case 'REDO': { const query = state.future[0]; return query ? { ...state, query, past: [...state.past, state.query], future: state.future.slice(1), announcement: 'Query redone.' } : state }
    case 'RESET_LAST_DISPATCH': return changeQuery(state, state.lastDispatchQuery ?? emptyQuery())
    case 'RESET_QUERY': return changeQuery(state, emptyQuery())
    case 'SAVE_QUERY': return { ...state, savedQueries: [...state.savedQueries, structuredClone(state.query)].slice(-20), announcement: 'Local query saved.' }
    case 'LOAD_QUERY': return state.savedQueries[command.index] ? changeQuery(state, state.savedQueries[command.index]!) : state
    case 'DISPATCH': {
      const issues = queryValidationIssues(state.query)
      if (issues.length) return { ...state, section: 'CASE', askOpen: true, error: issues.join(' '), announcement: `Query not dispatched. ${issues.join(' ')}` }
      const before = queryReceiptKey(state.query)
      if (state.reviewedReceipt !== before) return { ...state, section: 'CASE', askOpen: true, announcement: 'Review the Query Receipt before dispatch. No hidden filter was added. Then DISPATCH from the terminal.' }
      const s13Group = fixture.s13 ? s13QueryGroupForQuestion(state.query.questionId) : undefined
      if (s13Group) {
        if (!s13CaseFileGateSatisfied(fixture, state) || state.s13FilterStage !== s13Group.startStage) return { ...state, section: 'CASE', askOpen: true, error: 'Stage the next accepted S13 Question Card in sequence.' }
        const acceptedStages = fixture.s13!.evidenceDelta.stages.slice(s13Group.startStage, s13Group.endStage)
        if (acceptedStages.length !== s13Group.endStage - s13Group.startStage) return { ...state, error: 'Accepted semantic-stage mapping is unavailable.' }
        return { ...state, s13FilterStage: s13Group.endStage, s13SelectedRecordId: null, s13Comparison: [], lastDispatchQuery: structuredClone(state.query), section: 'RESULTS', askOpen: false, broadSeaSeen: true, error: null, candidateRouteResolved: state.candidateRouteResolved || s13Group.endStage >= 4, announcement: `${s13Group.title} dispatched through CASE. ${acceptedStages.map(stage => stage.newCount).join(' → ')} records; ${acceptedStages.at(-1)!.includedReason}` }
      }
      const canonicalBefore = JSON.stringify(canonicalQuery(state.query))
      const result = dispatchQuery(fixture, state.query, state.result)
      if (JSON.stringify(canonicalQuery(result.query)) !== canonicalBefore) throw new Error('Hidden dispatch filter mutation')
      const exact = state.query.lens === 'RECEIPT' && state.query.filters.some(({ field }) => field === 'TRANSACTION') ? fixture.records.find((record) => result.recordIds.includes(record.id) && exactPredicate(fixture, record)) : undefined
      const newExact = exact && !state.exactEventIds.includes(`EXACT.${exact.id}`)
      const unlocked = fixture.clues.filter((clue) => result.recordIds.some((id) => clue.unlockEvent === `RESULT.${id}`) || (exact && clue.unlockEvent === `EXACT.${exact.id}`)).map(({ id }) => id)
      return { ...state, discoveredClues: unique([...state.discoveredClues, ...unlocked]), result, lastDispatchQuery: structuredClone(state.query), discoveredRecords: unique([...state.discoveredRecords, ...result.recordIds]), section: 'RESULTS', shown: 3, canister: 'RETURNED', error: null, candidateRouteResolved: state.candidateRouteResolved || (['QUESTION.FOLLOW_FORWARD', 'QUESTION.COMPARE_ROUTES'].includes(state.query.questionId) && result.recordIds.length > 0), exactEventIds: newExact ? [...state.exactEventIds, `EXACT.${exact.id}`] : state.exactEventIds, exactConvergenceVerified: state.exactConvergenceVerified || Boolean(newExact && exact.id === fixture.proof.slots.LINK), selectedRecordId: exact?.id ?? state.selectedRecordId, rejectedTheory: newExact && state.workingTheory === 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' ? { id: state.workingTheory, firstContradiction: exact.id } : state.rejectedTheory, workingTheory: newExact && state.workingTheory === 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' ? null : state.workingTheory, announcement: newExact ? `EXACT receipt found. ${exact.observedAtUtc}. Trace gap closed. ${fixture.proof.boundary}` : `${result.recordIds.length} matching records. ${result.zeroClass ?? 'Candidate folders returned'}; ${result.delta.includedReason}.` }
    }
    case 'OPEN_CANISTER': return { ...state, canister: state.canister === 'RETURNED' ? 'OPEN' : state.canister, section: 'RESULTS', announcement: state.canister === 'RETURNED' ? 'Result folder revealed.' : 'No returned result to reveal.' }
    case 'SELECT_RESULT': return state.discoveredRecords.includes(command.recordId) ? { ...state, selectedRecordId: command.recordId } : state
    case 'PIN': return state.discoveredRecords.includes(command.recordId) ? { ...state, pinned: unique([...state.pinned, command.recordId]), selectedRecordId: command.recordId, announcement: 'Result pinned as evidence of its stated grade. Exact link still requires verification.' } : state
    case 'SAVE_LEAD': return state.discoveredRecords.includes(command.recordId) ? { ...state, savedLeads: unique([...state.savedLeads, command.recordId]), announcement: 'Reusable lead saved; no clue consumed.' } : state
    case 'COMPARE': return !candidateRouteResolvedMilestone(fixture, state) ? { ...state, error: 'Candidate-route resolution is required before comparing records.' } : state.discoveredRecords.includes(command.recordId) ? { ...state, comparison: state.comparison.includes(command.recordId) ? state.comparison.filter((id) => id !== command.recordId) : [...state.comparison.slice(-1), command.recordId], announcement: 'Comparison tray changed; at most two candidates.' } : state
    case 'SHOW_MORE': return { ...state, shown: state.shown + 3 }
    case 'THEORY': return state.candidateRouteResolved && ['FIRST_TRAIL_STOPS_AT_FIRST_ENGINE', 'FIRST_TRAIL_JOINS_SECOND_ROUTE'].includes(command.theory) ? { ...state, workingTheory: command.theory, announcement: 'Working theory recorded, not accepted as truth.' } : { ...state, error: 'Candidate-route resolution is required before filing a theory.' }
    case 'DEFER_THEORY': return { ...state, workingTheory: null, announcement: 'Exact receipt deferred; no theory filed.' }
    case 'S13_SELECT_RECORD': {
      if (!fixture.s13 || !s13VisibleRecords(fixture.s13, state.s13FilterStage).some(record => record.recordId === command.recordId)) return { ...state, error: 'That record is not visible at the current semantic stage.' }
      const hero = command.recordId === fixture.s13.proof.exactRecord.recordId
      return { ...state, s13SelectedRecordId: command.recordId, error: null, announcement: hero && state.s13VerifiedRecordId !== command.recordId ? 'Surviving candidate source opened. Decisive fields remain sealed until explicit verification.' : `${command.recordId} source and limits opened.` }
    }
    case 'S13_COMPARE': {
      if (!fixture.s13 || state.s13FilterStage < 4 || !s13VisibleRecords(fixture.s13, state.s13FilterStage).some(record => record.recordId === command.recordId)) return { ...state, error: 'Comparison is available only for current S13 candidate results.' }
      return { ...state, s13Comparison: state.s13Comparison.includes(command.recordId) ? state.s13Comparison.filter(id => id !== command.recordId) : [...state.s13Comparison.slice(-1), command.recordId], announcement: 'S13 comparison tray changed; evidence remains bounded to the current result.' }
    }
    case 'S13_VERIFY_RECORD': {
      if (fixture.s13 && command.recordId === fixture.s13.proof.contextualCorroboration.recordId) return { ...state, error: 'Contextual evidence cannot fill AMOUNT, RECEIVER, or LINK.' }
      if (!fixture.s13 || state.s13FilterStage !== fixture.s13.evidenceDelta.stages.length || state.s13SelectedRecordId !== command.recordId) return { ...state, error: 'Inspect the surviving receipt after all accepted questions before verification.' }
      const exactS13 = fixture.s13.proof.exactRecord
      const contextual = fixture.s13.proof.contextualCorroboration
      if (command.recordId === contextual.recordId || command.recordId !== exactS13.recordId || exactS13.evidenceGradeCeiling !== 'EXACT' || JSON.stringify(exactS13.fillsProofSlots) !== JSON.stringify(['AMOUNT', 'RECEIVER', 'LINK'])) return { ...state, error: 'Contextual or non-exact evidence cannot fill a proof slot.' }
      if (state.s13VerifiedRecordId === command.recordId) return state
      const bridge = fixture.records.find(({ id }) => id === fixture.proof.slots.LINK)
      if (!bridge || !exactPredicate(fixture, bridge)) return { ...state, error: 'The accepted exact bridge is unavailable; proof remains sealed.' }
      const query: Query = { lens: 'RECEIPT', questionId: 'QUESTION.S13_EXACT_VERIFICATION', filters: [{ field: 'TRANSACTION', value: bridge.transactionHash, origin: 'RESULT_DERIVED', sourceId: 'CARD.EXACT_RECEIPT' }] }
      const result = dispatchQuery(fixture, query, state.result)
      const exactId = `EXACT.${bridge.id}`
      const unlocked = fixture.clues.filter((clue) => clue.unlockEvent === exactId || clue.unlockEvent === `RESULT.${bridge.id}`).map(({ id }) => id)
      return { ...state, s13VerifiedRecordId: command.recordId, query, lastDispatchQuery: structuredClone(query), result, discoveredClues: unique([...state.discoveredClues, ...unlocked]), discoveredRecords: unique([...state.discoveredRecords, bridge.id]), exactEventIds: unique([...state.exactEventIds, exactId]), exactConvergenceVerified: true, selectedRecordId: bridge.id, section: 'RESULTS', shown: 3, canister: 'RETURNED', error: null, rejectedTheory: state.workingTheory === 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' ? { id: state.workingTheory, firstContradiction: bridge.id } : state.rejectedTheory, workingTheory: state.workingTheory === 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' ? null : state.workingTheory, announcement: `Exact receipt verified and filed as a candidate result. Open Caseboard to assemble AMOUNT, RECEIVER, and LINK. ${fixture.proof.boundary}` }
    }
    case 'ACK_EXACT_CORRECTION': return state.exactConvergenceVerified && !state.exactCorrectionStarted ? { ...state, exactCorrectionStarted: true } : state
    case 'ASSEMBLE': {
      const record = knownRecords(fixture, state).find(({ id }) => id === command.recordId)
      if (!state.exactEventIds.length || !record || record.grade !== 'EXACT' || record.derivedFrom.length || fixture.proof.slots[command.slot] !== record.id) return { ...state, error: 'Only the required discovered exact evidence can fill this slot.' }
      if (command.slot === 'LINK' && (state.assembly.AMOUNT !== fixture.proof.slots.AMOUNT || state.assembly.RECEIVER !== fixture.proof.slots.RECEIVER)) return { ...state, error: 'File AMOUNT and RECEIVER in either order before the final LINK.' }
      const assembly = { ...state.assembly, [command.slot]: record.id }
      const complete = (['AMOUNT', 'RECEIVER', 'LINK'] as const).every((slot) => assembly[slot] === fixture.proof.slots[slot])
      return { ...state, assembly, complete, announcement: complete ? `${fixture.proof.conclusion} ${fixture.proof.boundary}` : `${command.slot} filed with exact evidence.` }
    }
    case 'HINT': return { ...state, announcement: investigationHintCopy(state,command.tier) }
  }
}
const isClosed = (value: unknown, keys: string[]): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false
  const own = Reflect.ownKeys(value)
  return own.length === keys.length && own.every(key => typeof key === 'string' && keys.includes(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value'))
}
const cardIds = [...['WHAT_LEFT', 'INCIDENT', 'INCIDENT_DAI', 'ASSET_OUT', 'HIGH_VALUE', 'INTERACTIONS', 'STATE_CHANGE', 'WHAT_ARRIVED', 'FOLLOW_FORWARD', 'EXACT_RECEIPT', 'COMPARE_ROUTES'].map(id => 'CARD.' + id), ...S13_QUERY_GROUPS.map(group => group.cardId)]
/** Complete structural / fixture preflight; no reducer calls or effects. */
function commandShape(fixture: CaseFixture, value: unknown): value is Command {
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'type')) return false
  const type = Object.getOwnPropertyDescriptor(value, 'type')!
  if (!Object.hasOwn(type, 'value') || typeof type.value !== 'string') return false
  const c = value as Record<string, unknown>
  const enums = (key: string, choices: readonly string[]) => typeof c[key] === 'string' && choices.includes(c[key] as string)
  const record = () => typeof c.recordId === 'string' && fixture.records.some(r => r.id === c.recordId)
  const shape = (keys: string[]) => isClosed(c, ['type', ...keys])
  switch (c.type) {
    case 'EARN_ACCESS': case 'REVIEW_RECEIPT': case 'ASK_QUESTION': case 'UNDO': case 'REDO': case 'RESET_LAST_DISPATCH': case 'RESET_QUERY': case 'RESET_CASE': case 'SAVE_QUERY': case 'OPEN_CANISTER': case 'SHOW_MORE': case 'DEFER_THEORY': case 'ACK_EXACT_CORRECTION': case 'COLLECT_CASE_FILE': case 'COLLECT_SIDE_NOTE': case 'REVIEW_BRCG_MARKET': case 'REVIEW_BRCG_PROOF': case 'S16_CLOSE_RECORD': case 'S16_FILE_FINDINGS': case 'S16_REVIEW_CONCLUSION': return shape([])
    case 'SECTION': return shape(['section']) && enums('section', CANONICAL_SECTIONS)
    case 'PRESENTATION': return shape(['mode']) && enums('mode', ['FULLSCREEN_CRT', 'DOCKED_OVERLAY', 'PLAIN_LIST'])
    case 'READ_BRANCH': return shape(['branch']) && enums('branch', ['FIRST', 'SECOND'])
    case 'STAGE_CLUE': return shape(['clueId']) && typeof c.clueId === 'string' && fixture.clues.some(clue => clue.id === c.clueId)
    case 'SELECT_SIDE_TOKEN': return shape(['tokenId']) && typeof c.tokenId === 'string' && SIDE_LEAD_TOKENS.some((token) => token.id === c.tokenId)
    case 'STAGE_CARD': return shape(['cardId']) && enums('cardId', cardIds)
    case 'REMOVE_FILTER': case 'LOAD_QUERY': return shape(['index']) && Number.isSafeInteger(c.index) && (c.index as number) >= 0
    case 'DISPATCH': return shape(['path']) && enums('path', ['TERMINAL', 'PLUNGER'])
    case 'SELECT_RESULT': case 'PIN': case 'SAVE_LEAD': case 'COMPARE': return shape(['recordId']) && record()
    case 'THEORY': return shape(['theory']) && enums('theory', ['FIRST_TRAIL_STOPS_AT_FIRST_ENGINE', 'FIRST_TRAIL_JOINS_SECOND_ROUTE'])
    case 'ASSEMBLE': return shape(['slot', 'recordId']) && enums('slot', ['AMOUNT', 'RECEIVER', 'LINK']) && record() && c.recordId === fixture.proof.slots[c.slot as keyof typeof fixture.proof.slots]
    case 'S13_SELECT_RECORD': case 'S13_COMPARE': return shape(['recordId']) && typeof c.recordId === 'string' && !!fixture.s13?.caseCorpus.some(record => record.recordId === c.recordId)
    case 'S13_VERIFY_RECORD': return shape(['recordId']) && typeof c.recordId === 'string' && !!fixture.s13?.caseCorpus.some(record => record.recordId === c.recordId)
    case 'S16_RUN_QUERY': return shape(['planId', 'semantics', 'origin']) && enums('planId', Object.keys(S16_QUERY_PLANS)) && enums('semantics', ['R1', 'R2']) && enums('origin', ['CURRENT', 'R1_NATIVE', 'MIGRATED_V2'])
    case 'S16_SELECT_RUN': return shape(['runId']) && typeof c.runId === 'string' && /^S16-RUN-\d{4}$/.test(c.runId)
    case 'S16_ADD_START': case 'S16_ADD_ROUTE': case 'S16_VERIFY_CONNECTION': return shape(['runId', 'recordId']) && typeof c.runId === 'string' && /^S16-RUN-\d{4}$/.test(c.runId) && typeof c.recordId === 'string' && !!fixture.s13?.caseCorpus.some(item => item.recordId === c.recordId)
    case 'S16_SOURCE_PAGE': return shape(['page']) && Number.isSafeInteger(c.page) && (c.page as number) >= 0 && (c.page as number) <= 3
    case 'S16_SET_PAGE': return shape(['key', 'page']) && typeof c.key === 'string' && (c.key === 'ALL' || /^S16-RUN-\d{4}$/.test(c.key)) && Number.isSafeInteger(c.page) && (c.page as number) >= 0
    case 'S16_OPEN_RECORD': {
      if (!shape(['recordId', 'origin']) || typeof c.recordId !== 'string' || !fixture.s13?.caseCorpus.some(item => item.recordId === c.recordId) || !c.origin || typeof c.origin !== 'object') return false
      const origin = c.origin as Record<string, unknown>
      if (origin.kind === 'ALL') return isClosed(origin, ['kind', 'page']) && Number.isSafeInteger(origin.page) && (origin.page as number) >= 0
      if (origin.kind === 'REPORT') return isClosed(origin, ['kind', 'page']) && origin.page === 0
      return origin.kind === 'RUN' && isClosed(origin, ['kind', 'runId', 'page']) && typeof origin.runId === 'string' && /^S16-RUN-\d{4}$/.test(origin.runId) && Number.isSafeInteger(origin.page) && (origin.page as number) >= 0
    }
    case 'HINT': return shape(['tier']) && enums('tier', ['METHOD_HINT', 'CASE_HINT', 'DIRECT_HINT'])
    case 'ADD_FILTER': {
      if (!shape(['filter']) || !isClosed(c.filter, ['field', 'value', 'origin', 'sourceId'])) return false
      const f = c.filter
      if (typeof f.field !== 'string' || !['SUBJECT', 'SOURCE', 'DESTINATION', 'ASSET', 'FROM', 'TO', 'MIN_AMOUNT', 'TRANSACTION', 'GRADE', 'KIND', 'RECORD_SET'].includes(f.field) || typeof f.value !== 'string' || !f.value || f.value.length > 200 || typeof f.sourceId !== 'string') return false
      if (f.origin === 'PLAYER_FILTER') { if (f.sourceId !== 'TEST.KNOWN' && f.sourceId !== 'PLAYER.EXPLICIT') return false }
      else if (f.origin === 'CASE_CLUE') { if (!fixture.clues.some(clue => clue.id === f.sourceId && clue.filters.some(x => x.field === f.field && x.value === f.value))) return false }
      else if (f.origin === 'QUESTION_CARD' || f.origin === 'RESULT_DERIVED') { if (!cardIds.includes(f.sourceId)) return false }
      else return false
      if (f.field === 'RECORD_SET') return f.value.split('|').every(id => fixture.records.some(r => r.id === id))
      if (f.field === 'GRADE') return ['EXACT', 'CORROBORATING', 'CONTEXTUAL'].includes(f.value)
      if (f.field === 'KIND') return ['ACTIVITY', 'STATE'].includes(f.value)
      if (f.field === 'MIN_AMOUNT') { try { return compareDecimal(f.value, '0') >= 0 } catch { return false } }
      if (f.field === 'FROM' || f.field === 'TO') return Number.isFinite(Date.parse(f.value))
      const values = fixture.clues.flatMap(clue => clue.filters.filter(x => x.field === f.field).map(x => x.value))
      for (const r of fixture.records) values.push(...(f.field === 'ASSET' ? r.assetAmounts.map(x => x.asset) : f.field === 'TRANSACTION' ? [r.transactionHash] : [r.source, r.destination]))
      return values.some(v => v.toLowerCase() === (f.value as string).toLowerCase())
    }
    default: return false
  }
}
/** Replay prerequisites checked on a private draft, never a partial return. */
function applicable(fixture: CaseFixture, state: InvestigationState, c: Command): boolean {
  if (c.type === 'EARN_ACCESS' || c.type === 'RESET_CASE') return true
  if (!state.access) return false
  switch (c.type) {
    case 'ACK_EXACT_CORRECTION': return state.exactConvergenceVerified && !state.exactCorrectionStarted
    case 'COLLECT_CASE_FILE': return state.access && !collectedStartingClues(fixture, state)
    case 'COLLECT_SIDE_NOTE': return state.access && !state.sideLead.noteDiscovered
    case 'SELECT_SIDE_TOKEN': return state.sideLead.noteDiscovered
    case 'REVIEW_BRCG_MARKET': return state.sideLead.noteDiscovered && state.sideLead.selectedTokenId === 'BRCG' && !state.sideLead.marketContextReviewed
    case 'REVIEW_BRCG_PROOF': return state.sideLead.noteDiscovered && state.sideLead.selectedTokenId === 'BRCG' && !state.sideLead.proofBoundaryReviewed
    case 'READ_BRANCH': return state.result !== null
    case 'THEORY': return state.candidateRouteResolved
    case 'STAGE_CLUE': return state.discoveredClues.includes(c.clueId)
    case 'STAGE_CARD': return availableCards(fixture, state).some(card => card.id === c.cardId)
    case 'SELECT_RESULT': case 'PIN': case 'SAVE_LEAD': return state.discoveredRecords.includes(c.recordId)
    case 'COMPARE': return candidateRouteResolvedMilestone(fixture, state) && state.discoveredRecords.includes(c.recordId)
    case 'REMOVE_FILTER': return c.index < state.query.filters.length
    case 'LOAD_QUERY': return c.index < state.savedQueries.length
    case 'ASSEMBLE': return state.assembly[c.slot] !== c.recordId && state.exactEventIds.length > 0 && state.discoveredRecords.includes(c.recordId) && fixture.records.some(r => r.id === c.recordId && r.grade === 'EXACT' && r.derivedFrom.length === 0)
    case 'S13_SELECT_RECORD': return !!fixture.s13 && s13VisibleRecords(fixture.s13, state.s13FilterStage).some(record => record.recordId === c.recordId)
    case 'S13_COMPARE': return !!fixture.s13 && state.s13FilterStage >= 4 && s13VisibleRecords(fixture.s13, state.s13FilterStage).some(record => record.recordId === c.recordId)
    case 'S13_VERIFY_RECORD': return !!fixture.s13 && state.s13VerifiedRecordId === null && state.s13SelectedRecordId === c.recordId && c.recordId === fixture.s13.proof.exactRecord.recordId && state.s13FilterStage === fixture.s13.evidenceDelta.stages.length
    case 'S16_RUN_QUERY': return s16QueryUnlocked(fixture, state, c.planId, c.semantics)
    case 'S16_SELECT_RUN': return state.s16Runs.some(run => run.id === c.runId)
    case 'S16_ADD_START': return !state.s16StartAdded && apply(fixture, state, c).error === null
    case 'S16_ADD_ROUTE': return !state.s16RouteAdded && apply(fixture, state, c).error === null
    case 'S16_OPEN_RECORD': return apply(fixture, state, c).error === null
    case 'S16_SOURCE_PAGE': return state.s16RecordContext !== null
    case 'S16_CLOSE_RECORD': return state.s16RecordContext !== null
    case 'S16_SET_PAGE': return (c.key === 'ALL' || state.s16Runs.some(run => run.id === c.key)) && apply(fixture, state, c).error === null
    case 'S16_VERIFY_CONNECTION': return state.s13VerifiedRecordId === null && apply(fixture, state, c).error === null
    case 'S16_FILE_FINDINGS': return !state.complete && apply(fixture, state, c).error === null
    case 'S16_REVIEW_CONCLUSION': return state.complete && !state.s16ConclusionReviewed
    case 'ADD_FILTER': {
      if (c.filter.origin === 'CASE_CLUE' && !state.discoveredClues.includes(c.filter.sourceId)) return false
      if (c.filter.origin === 'QUESTION_CARD' || c.filter.origin === 'RESULT_DERIVED') {
        if (!availableCards(fixture, state).some(card => card.id === c.filter.sourceId && card.effects.some(f => f.field === c.filter.field && f.value === c.filter.value))) return false
      }
      return apply(fixture, state, c).error === null
    }
    default: return true
  }
}
export function investigationReducer(fixture: CaseFixture, state: InvestigationState, command: Command): InvestigationState {
  // Reject before applying OR recording: not even EARN_ACCESS from foreign state.
  if (!sameOrigin(fixture, state) || !stateIdentifiersMatch(fixture, state)) return createInvestigationState(fixture)
  const commandType = Object.getOwnPropertyDescriptor(command ?? {}, 'type')?.value
  if (!commandShape(fixture, command)) return { ...state, error: commandType === 'SECTION' ? 'Noncanonical section rejected; ASK belongs inside CASE and ARCHIVE is not a section.' : commandType === 'ADD_FILTER' || commandType === 'STAGE_CLUE' ? 'That identifier has not been discovered or is an invalid closed filter; staged inputs preserved.' : 'Invalid command; only required discovered exact evidence and closed fixture inputs are accepted.' }
  const next = apply(fixture, state, command)
  // Unavailable/wrong attempts retain their existing recovery message but never
  // become replay authority. Legitimate guarded dispatch remains reproducible.
  if (!applicable(fixture, state, command)) return { ...next, commands: state.commands }
  const resetLog: Command[] = command.type === 'RESET_CASE' ? [...(next.access ? [{ type: 'EARN_ACCESS' } as Command] : []), ...(collectedStartingClues(fixture, next) ? [{ type: 'COLLECT_CASE_FILE' } as Command] : []), ...(next.sideLead.noteDiscovered ? [{ type: 'COLLECT_SIDE_NOTE' } as Command] : [])] : [...state.commands, structuredClone(command)]
  return { ...next, commands: resetLog }
}
function v2CommandShape(fixture: CaseFixture, value: unknown): value is Command {
  return commandShape(fixture, value) && !value.type.startsWith('S16_')
}
function applyV2Oracle(fixture: CaseFixture, state: InvestigationState, command: Command): InvestigationState {
  const next = apply(fixture, state, command)
  return command.type === 'S13_SELECT_RECORD' && next.s13SelectedRecordId === command.recordId ? { ...next, section: 'SOURCE' } : next
}
function replayV2Oracle(fixture: CaseFixture, entries: readonly Command[]): InvestigationState | null {
  let draft = createInvestigationState(fixture)
  for (const command of entries) {
    if (!applicable(fixture, draft, command)) {
      if (command.type === 'COMPARE') continue
      return null
    }
    draft = applyV2Oracle(fixture, draft, command)
    if (!sameOrigin(fixture, draft) || !stateIdentifiersMatch(fixture, draft)) return null
  }
  return draft
}
function v2LegacyHistory(entries: readonly Command[]): S16LegacyReceipt[] {
  const receipts: S16LegacyReceipt[] = []
  let pending: S16LegacyReceipt['group'] | null = null
  let receiptReviewed = false
  const flushDraft = () => {
    if (!pending) return
    receipts.push({ group: pending, status: 'DRAFT', receiptReviewed })
    pending = null
    receiptReviewed = false
  }
  for (const command of entries) {
    if (command.type === 'STAGE_CARD') {
      const group = S13_QUERY_GROUPS.find(item => item.cardId === command.cardId)?.id ?? null
      if (group) {
        if (pending && pending !== group) flushDraft()
        if (!pending) pending = group
        continue
      }
    }
    if (command.type === 'REVIEW_RECEIPT' && pending) { receiptReviewed = true; continue }
    if (command.type === 'DISPATCH' && pending) {
      receipts.push({ group: pending, status: 'COMPLETED', receiptReviewed })
      pending = null
      receiptReviewed = false
      continue
    }
    if (pending && (command.type === 'SECTION' || command.type === 'PRESENTATION' || command.type === 'ASK_QUESTION')) continue
    flushDraft()
  }
  flushDraft()
  return receipts
}
function migrateV2State(fixture: CaseFixture, source: S16LegacySource): InvestigationState | null {
  const legacy = replayV2Oracle(fixture, source.entries)
  if (!legacy || !fixture.s13) return legacy ? { ...legacy, commands: [], s16LegacySource: structuredClone(source) } : null
  const runs: S16QueryRun[] = []
  if (legacy.s13FilterStage >= 4) runs.push(createS16Run(fixture.s13, 'Q2', runs, 'R2', 'MIGRATED_V2'))
  if (legacy.s13FilterStage >= 6) runs.push(createS16Run(fixture.s13, 'Q3', runs, 'R2', 'MIGRATED_V2'))
  const selectedId = legacy.s13SelectedRecordId
  const selectedRun = selectedId ? [...runs].reverse().find(run => run.matchingIds.includes(selectedId)) : null
  const context: S16RecordContext | null = selectedId ? {
    recordId: selectedId,
    origin: selectedRun ? { kind: 'RUN', runId: selectedRun.id, page: 0 } : { kind: 'ALL', page: 0 },
    sourcePage: legacy.section === 'SOURCE' ? 1 : 0,
  } : null
  const routeEarned = legacy.s13FilterStage >= 4
  return {
    ...legacy,
    section: legacy.section === 'SOURCE' ? 'RESULTS' : legacy.section,
    s16Runs: runs,
    s16SelectedRunId: selectedRun?.id ?? runs.at(-1)?.id ?? null,
    s16StartAdded: routeEarned,
    s16RouteAdded: routeEarned,
    s16RouteRecordId: routeEarned ? fixture.s13.proof.exactRecord.recordId : null,
    s16RecordContext: context,
    s16Pages: { ALL: 0, ...Object.fromEntries(runs.map(run => [run.id, 0])) },
    s16LegacyHistory: v2LegacyHistory(source.entries),
    s16LegacySource: structuredClone(source),
    s16ConclusionReviewed: false,
    candidateRouteResolved: legacy.candidateRouteResolved || routeEarned,
    commands: [],
  }
}
function migrateV3Commands(fixture: CaseFixture, entries: readonly unknown[]): Command[] | null {
  const migrated: Command[] = []
  let q2RunId: string | null = null
  let runCount = 0
  const early = fixture.s13?.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')
  const exact = fixture.s13?.proof.exactRecord
  for (const value of entries) {
    if (isClosed(value, ['type', 'planId']) && value.type === 'S16_RUN_QUERY' && typeof value.planId === 'string' && Object.hasOwn(S16_QUERY_PLANS, value.planId)) {
      runCount += 1
      const runId = `S16-RUN-${String(runCount).padStart(4, '0')}`
      if (value.planId === 'Q2') q2RunId = runId
      migrated.push({ type: 'S16_RUN_QUERY', planId: value.planId as S16QueryId, semantics: 'R1', origin: 'R1_NATIVE' })
      continue
    }
    if (isClosed(value, ['type']) && value.type === 'S16_ADD_START') {
      if (!q2RunId || !early) return null
      migrated.push({ type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'RUN', runId: q2RunId, page: 0 } }, { type: 'S16_ADD_START', runId: q2RunId, recordId: early.recordId })
      continue
    }
    if (isClosed(value, ['type']) && value.type === 'S16_ADD_ROUTE') {
      if (!q2RunId || !exact) return null
      migrated.push({ type: 'S16_OPEN_RECORD', recordId: exact.recordId, origin: { kind: 'RUN', runId: q2RunId, page: 0 } }, { type: 'S16_ADD_ROUTE', runId: q2RunId, recordId: exact.recordId })
      continue
    }
    if (!commandShape(fixture, value)) return null
    migrated.push(value)
  }
  return migrated
}
export function restoreInvestigation(fixture: CaseFixture, text: string | null): InvestigationState {
  const initial = createInvestigationState(fixture)
  if (!text) return initial
  try {
    const saved: unknown = JSON.parse(text)
    const legacy = isClosed(saved, ['fixtureId', 'fixtureMode', 'fixtureOrigin', 'commands'])
    if (!saved || typeof saved !== 'object') return initial
    const envelope = saved as Record<string, unknown>
    const saveVersion = envelope.saveVersion
    const v5Keys = Object.hasOwn(envelope, 'legacySource') ? ['fixtureId', 'fixtureMode', 'fixtureOrigin', 'saveVersion', 'commands', 'legacySource'] : ['fixtureId', 'fixtureMode', 'fixtureOrigin', 'saveVersion', 'commands']
    const versioned = (saveVersion === 2 || saveVersion === 3 || saveVersion === 4) && isClosed(saved, ['fixtureId', 'fixtureMode', 'fixtureOrigin', 'saveVersion', 'commands'])
    const versionedV5 = saveVersion === 5 && isClosed(saved, v5Keys)
    if (!legacy && !versioned && !versionedV5) return initial
    if (!sameOrigin(fixture, envelope)) return initial
    const history = envelope.commands
    if (!isClosed(history, ['source', 'entries']) || !isClosed(history.source, ['fixtureId', 'fixtureMode', 'fixtureOrigin']) || !sameOrigin(fixture, history.source) || !Array.isArray(history.entries)) return initial
    const rawEntries = [...history.entries]

    // V2 is validated and replayed only in its original command language. The
    // source-bound history remains separate from later native actions so no
    // privileged synthetic import command can be injected into a newer save.
    if (saveVersion === 2) {
      if (!rawEntries.every(c => v2CommandShape(fixture, c))) return initial
      const source: S16LegacySource = { saveVersion: 2, source: structuredClone(history.source) as S16LegacySource['source'], entries: structuredClone(rawEntries as Command[]) }
      return migrateV2State(fixture, source) ?? initial
    }

    let base = initial
    if (versionedV5 && Object.hasOwn(envelope, 'legacySource')) {
      const value = envelope.legacySource
      if (!isClosed(value, ['saveVersion', 'source', 'entries']) || value.saveVersion !== 2 || !isClosed(value.source, ['fixtureId', 'fixtureMode', 'fixtureOrigin']) || !sameOrigin(fixture, value.source) || !Array.isArray(value.entries) || !value.entries.every(c => v2CommandShape(fixture, c))) return initial
      const source: S16LegacySource = { saveVersion: 2, source: structuredClone(value.source) as S16LegacySource['source'], entries: structuredClone(value.entries as Command[]) }
      base = migrateV2State(fixture, source) ?? initial
      if (base === initial) return initial
    }
    const storedEntries = saveVersion === 3 ? migrateV3Commands(fixture, rawEntries) : rawEntries.every(c => commandShape(fixture, c)) ? rawEntries as Command[] : null
    if (!storedEntries) return initial
    const retiredInS16 = (command: Command) => command.type === 'REVIEW_RECEIPT' || command.type === 'DISPATCH' || command.type === 'ASSEMBLE' || (command.type === 'SECTION' && command.section === 'SOURCE') || (command.type === 'STAGE_CARD' && S13_QUERY_GROUPS.some(group => group.cardId === command.cardId))
    if ((saveVersion === 3 || saveVersion === 4 || saveVersion === 5) && fixture.s13 && storedEntries.some(retiredInS16)) return initial
    const entries = [...storedEntries]
    // Deterministic migration: unversioned historical envelopes earned access
    // through the retired strip path and therefore contain EARN_ACCESS without
    // COLLECT_CASE_FILE. Synthesize the collection once so earned knowledge
    // survives; the retired strip item itself was never persisted and cannot
    // be restored. Versioned (v2) envelopes replay exactly with no synthesis.
    const earnIndex = entries.findIndex((c) => c.type === 'EARN_ACCESS')
    if (legacy && earnIndex >= 0 && !entries.some((c) => c.type === 'COLLECT_CASE_FILE')) entries.splice(earnIndex + 1, 0, { type: 'COLLECT_CASE_FILE' })
    // R17 migration: pre-milestone COMPARE entries recorded under older rules
    // are skipped (comparison selection is ephemeral UI state, never an owned
    // fact), preserving every applicable prefix fact. All other inapplicable
    // entries abort to a clean initial state as pinned by atomic-replay
    // authority; integrity mismatches below always fail closed.
    let draft = base
    const kept: Command[] = []
    for (const c of entries) {
      if (!applicable(fixture, draft, c)) {
        if (c.type !== 'COMPARE') return initial
        continue
      }
      draft = apply(fixture, draft, c)
      if (!sameOrigin(fixture, draft) || !stateIdentifiersMatch(fixture, draft)) return initial
      kept.push(c)
    }
    // Publish/replay only after the full private applicability simulation passes.
    const published = kept.reduce((state, c) => investigationReducer(fixture, state, c), base)
    return { ...published, commands: kept.map((c) => structuredClone(c)) }
  } catch { return initial }
}
export function exportLocalSave(state: InvestigationState) {
  const source = { fixtureId: state.fixtureId, fixtureMode: state.fixtureMode, fixtureOrigin: state.fixtureOrigin }
  return JSON.stringify({ ...source, saveVersion: 5, commands: { source, entries: state.commands }, ...(state.s16LegacySource ? { legacySource: state.s16LegacySource } : {}) })
}
export function explainExcluded(fixture: CaseFixture, state: InvestigationState, recordId: string) { const record = knownRecords(fixture, state).find(({ id }) => id === recordId); return record ? firstExcludingPredicate(record, state.query) ?? 'Still matches the staged query.' : 'This record is not discovered.' }
