import type { CaseFixture, Section } from './contracts'
import type { Command, InvestigationState } from './state'
import { s16AllRecords, type S16QueryRun } from './s16Queries'
import type { S13Record, S13Runtime } from './s13'

export type S16TerminalSection = Extract<Section, 'CASE' | 'RESULTS' | 'EXPLORE' | 'LEDGER'>
export type S16Screen = 'LOCKED' | 'PRE_FILE_CASE' | 'PRE_FILE_RECORDS' | 'CASE_GUIDE' | 'BUILD_QUERY' | 'RESULTS' | 'EXPLORE' | 'HISTORY' | 'PROOF' | 'COMPLETE'

export interface S16TerminalContract {
  screen: S16Screen
  section: S16TerminalSection
  sections: readonly S16TerminalSection[]
  fileRead: boolean
  task: string
  thread: string
  searchableRecords: readonly S13Record[]
  selectedRun: S16QueryRun | null
  providerCalls: 0
}

export const S16_SECTION_PURPOSES: Readonly<Record<S16TerminalSection, string>> = {
  CASE: 'NEXT QUESTION & FINDINGS',
  RESULTS: 'SELECTED QUERY MATCHES',
  EXPLORE: 'ALL RECORDS & OPTIONAL QUESTIONS',
  LEDGER: 'QUERY HISTORY',
}

export const S16_COMMAND_PRESENTATION = {
  EARN_ACCESS: 'WORLD_ONLY', REVIEW_RECEIPT: 'REDUCER_ONLY', ASK_QUESTION: 'REDUCER_ONLY', SECTION: 'FOREGROUND', PRESENTATION: 'REDUCER_ONLY', READ_BRANCH: 'REDUCER_ONLY', STAGE_CLUE: 'REDUCER_ONLY', STAGE_CARD: 'REDUCER_ONLY', ADD_FILTER: 'REDUCER_ONLY', REMOVE_FILTER: 'REDUCER_ONLY', UNDO: 'REDUCER_ONLY', REDO: 'REDUCER_ONLY', RESET_LAST_DISPATCH: 'REDUCER_ONLY', RESET_QUERY: 'REDUCER_ONLY', RESET_CASE: 'CONTEXTUAL', SAVE_QUERY: 'REDUCER_ONLY', LOAD_QUERY: 'REDUCER_ONLY', DISPATCH: 'REDUCER_ONLY', OPEN_CANISTER: 'REDUCER_ONLY', COLLECT_CASE_FILE: 'WORLD_ONLY', COLLECT_SIDE_NOTE: 'WORLD_ONLY', SELECT_SIDE_TOKEN: 'CONTEXTUAL', REVIEW_BRCG_MARKET: 'CONTEXTUAL', REVIEW_BRCG_PROOF: 'CONTEXTUAL', SELECT_RESULT: 'REDUCER_ONLY', PIN: 'REDUCER_ONLY', SAVE_LEAD: 'REDUCER_ONLY', COMPARE: 'REDUCER_ONLY', SHOW_MORE: 'REDUCER_ONLY', THEORY: 'CONTEXTUAL', DEFER_THEORY: 'CONTEXTUAL', ASSEMBLE: 'REDUCER_ONLY', ACK_EXACT_CORRECTION: 'REDUCER_ONLY', S13_SELECT_RECORD: 'CONTEXTUAL', S13_COMPARE: 'REDUCER_ONLY', S13_VERIFY_RECORD: 'FOREGROUND', S16_RUN_QUERY: 'FOREGROUND', S16_SELECT_RUN: 'CONTEXTUAL', S16_ADD_START: 'FOREGROUND', S16_ADD_ROUTE: 'FOREGROUND', S16_OPEN_RECORD: 'CONTEXTUAL', S16_SOURCE_PAGE: 'CONTEXTUAL', S16_CLOSE_RECORD: 'CONTEXTUAL', S16_SET_PAGE: 'REDUCER_ONLY', S16_VERIFY_CONNECTION: 'FOREGROUND', S16_FILE_FINDINGS: 'FOREGROUND', S16_REVIEW_CONCLUSION: 'FOREGROUND', HINT: 'CONTEXTUAL',
} as const satisfies Record<Command['type'], 'FOREGROUND' | 'CONTEXTUAL' | 'REDUCER_ONLY' | 'WORLD_ONLY'>

export function s16SearchableRecords(runtime: S13Runtime): S13Record[] { return s16AllRecords(runtime) }

export function s16FileRead(fixture: CaseFixture, state: InvestigationState): boolean {
  return !!fixture.s13 && fixture.s13.caseFileGate.clueIds.every(id => state.discoveredClues.includes(id))
}

export function s16Sections(state: InvestigationState): readonly S16TerminalSection[] {
  if (!state.access) return []
  return state.s16Runs.length ? ['CASE', 'RESULTS', 'EXPLORE', 'LEDGER'] : ['CASE', 'EXPLORE']
}

function effectiveSection(state: InvestigationState, sections: readonly S16TerminalSection[]): S16TerminalSection {
  if (sections.includes(state.section as S16TerminalSection)) return state.section as S16TerminalSection
  return state.s16SelectedRunId && sections.includes('RESULTS') ? 'RESULTS' : 'CASE'
}

function screenFor(state: InvestigationState, section: S16TerminalSection, fileRead: boolean): S16Screen {
  if (!state.access) return 'LOCKED'
  if (!fileRead) return section === 'EXPLORE' ? 'PRE_FILE_RECORDS' : 'PRE_FILE_CASE'
  if (section === 'RESULTS') return 'RESULTS'
  if (section === 'EXPLORE') return 'EXPLORE'
  if (section === 'LEDGER') return 'HISTORY'
  if (state.complete) return 'COMPLETE'
  if (state.s13VerifiedRecordId) return 'PROOF'
  return 'CASE_GUIDE'
}

function taskFor(state: InvestigationState, fileRead: boolean, section: S16TerminalSection): { task: string; thread: string } {
  if (section === 'EXPLORE') return { task: 'EXPLORE', thread: fileRead ? 'Browse records or ask another question.' : 'Browse the records while you look for the file.' }
  if (section === 'LEDGER') return { task: 'HISTORY', thread: 'Your searches · select one to reopen its results.' }
  if (section === 'RESULTS') return { task: 'THE THREE MATCHES', thread: 'Compare addresses, amounts and times.' }
  if (!fileRead) return { task: 'EULER CASE', thread: 'Read the file to ask a case question.' }
  if (state.complete) return { task: 'CASE REPORT', thread: 'Saved · the case is still open' }
  if (state.s13VerifiedRecordId) return { task: 'CASE REPORT', thread: 'Connection confirmed · not yet saved' }
  const exactRun = state.s16Runs.find(run => run.planId === 'Q3')
  if (exactRun) return { task: 'CHECK THE CONNECTION', thread: 'Your transaction search is complete.' }
  if (state.s16StartAdded && state.s16RouteAdded) return { task: 'TEST THE TWO SAVED CLUES', thread: 'The receiver of the early transfer is the later sender.' }
  if (state.s16RouteAdded) return { task: 'SAVE THE EARLIER TRANSFER', thread: 'The later view is already saved.' }
  if (state.s16StartAdded) return { task: 'FOLLOW THE LATER ROUTE', thread: 'The starting point is saved.' }
  const amountRun = state.s16Runs.find(run => run.planId === 'Q2')
  if (amountRun) return { task: 'FOLLOW THE MATCHING TRANSFERS', thread: 'Compare addresses, amounts and times.' }
  return { task: 'EULER CASE', thread: 'Find the DAI trail described in the file.' }
}

export function deriveS16TerminalContract(fixture: CaseFixture, state: InvestigationState): S16TerminalContract {
  if (!fixture.s13) throw new Error('S16 terminal requires accepted S13 runtime')
  const sections = s16Sections(state)
  const section = effectiveSection(state, sections)
  const fileRead = s16FileRead(fixture, state)
  const task = taskFor(state, fileRead, section)
  return {
    screen: screenFor(state, section, fileRead), section, sections, fileRead,
    ...task,
    searchableRecords: s16SearchableRecords(fixture.s13),
    selectedRun: state.s16Runs.find(run => run.id === state.s16SelectedRunId) ?? null,
    providerCalls: fixture.s13.productionBoundary.runtimeProviderCalls,
  }
}
