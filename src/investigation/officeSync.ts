import type { AdventureState } from '../adventure/types'
import type { CaseFixture } from './contracts'
import { collectedStartingClues, createInvestigationState, exportLocalSave, investigationReducer, type InvestigationState } from './state'

// One pure owner for office milestones entering an existing or new investigation.
// Repeated calls add nothing that is already present, and never rewind progress.
export function synchronizeOfficeMilestones(fixture: CaseFixture, investigation: InvestigationState, adventure: Pick<AdventureState, 'phase' | 'inventory' | 'piggyNoteReadState'>): InvestigationState {
  let next = investigation
  if (adventure.phase === 'COMPLETE' && !next.access) next = investigationReducer(fixture, next, { type: 'EARN_ACCESS' })
  if (next.access && adventure.inventory.includes('euler-case-file') && !collectedStartingClues(fixture, next)) next = investigationReducer(fixture, next, { type: 'COLLECT_CASE_FILE' })
  if (next.access && adventure.piggyNoteReadState === 'BACK_READ' && !next.sideLead.noteDiscovered) next = investigationReducer(fixture, next, { type: 'COLLECT_SIDE_NOTE' })
  return next
}

export function investigationBase(fixture: CaseFixture, existing: InvestigationState | null): InvestigationState {
  return existing ?? createInvestigationState(fixture)
}

export function persistInvestigation(storage: Pick<Storage, 'setItem'> | null, key: string, state: InvestigationState): boolean {
  if (!storage) return false
  try { storage.setItem(key, exportLocalSave(state)); return true } catch { return false }
}
