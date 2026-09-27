import type { SpeechLine, PuzzlePhase, VerbId, HotspotId, InventoryItemId } from '../../adventure/types'
import type { CaseFixture } from '../../investigation/contracts'
import type { InvestigationState } from '../../investigation/state'
import { canonicalQuery, dispatchQuery } from '../../investigation/query'
import { r55TextByEvent } from '../../story/r55/production'

export const CONTENT_INTERFACE_IDENTITY = 'R55_PRODUCTION_BOUND_CONTENT@1.0.0'
export const ARCHIVIST_SEMANTIC_ID = 'ARTHUR'

export function publicObjectName(object: { id: string; name: string }, styled = false): string {
  return ['ARTHUR', 'MR_INDEX', 'mr-index', 'archivist'].includes(object.id) ? styled ? 'MR. A' : 'Arthur' : object.name
}
export function publicSpeaker(id: string, styled = false): string {
  if (id.toUpperCase() === 'ROOK') return 'Rook'
  if (id.toUpperCase() === 'TERMINAL') return 'Terminal'
  if (id.toUpperCase() === 'SYSTEM') return 'System'
  return publicObjectName({ id, name: id }, styled)
}

// Compatibility helpers remain data-free: production copy owners bind R55
// directly, while non-R55 factual terminal text keeps its caller-supplied copy.
export function contentText(_key: string, fallback: string, context: Readonly<Record<string, boolean>> = {}): string { void context; return fallback }
export function officeLines(_prefix: string, lines: SpeechLine[], phase?: PuzzlePhase): SpeechLine[] { void phase; return lines }
export function officeDeadEnd(_verb: VerbId, _target: HotspotId, _item: InventoryItemId | null, fallback: string): string { return fallback }

export function negativeScopeAccepted(fixture: CaseFixture, state: InvestigationState): boolean {
  const result = state.result
  if (!state.access || state.fixtureId !== fixture.id || fixture.id !== 'EULER_2023_FALSE_EXIT' || fixture.mode !== 'ACCEPTED_FROZEN' || fixture.cutoffUtc !== '2023-03-13T12:15:00Z' || result?.zeroClass !== 'NEGATIVE_EVIDENCE_SUPPORTED' || result.recordIds.length) return false
  try {
    const from = result.query.filters.filter(filter => filter.field === 'FROM')
    const to = result.query.filters.filter(filter => filter.field === 'TO')
    if (from.length !== 1 || to.length !== 1 || !Number.isFinite(Date.parse(from[0]!.value)) || !Number.isFinite(Date.parse(to[0]!.value)) || Date.parse(from[0]!.value) > Date.parse(to[0]!.value)) return false
    const known = fixture.records.filter(record => state.discoveredRecords.includes(record.id))
    const subjects = result.query.filters.filter(filter => ['SUBJECT', 'SOURCE', 'DESTINATION'].includes(filter.field))
    if (!subjects.length || subjects.some(filter => !known.some(record => [record.source, record.destination].some(address => address.toLowerCase() === filter.value.toLowerCase())))) return false
    const replay = dispatchQuery(fixture, result.query, null)
    return replay.zeroClass === 'NEGATIVE_EVIDENCE_SUPPORTED' && replay.recordIds.length === 0 && replay.coverageIds.length > 0 && JSON.stringify([...replay.coverageIds].sort()) === JSON.stringify([...result.coverageIds].sort()) && JSON.stringify(canonicalQuery(replay.query)) === JSON.stringify(canonicalQuery(result.query))
  } catch { return false }
}
export function zeroResultCopy(fixture: CaseFixture, state: InvestigationState): string {
  return negativeScopeAccepted(fixture, state)
    ? 'No matching record appears inside the accepted bounded coverage. This does not establish global absence.'
    : 'Inspect the result classification and accepted coverage. Missing information does not establish absence.'
}
export function recoveryCopy(announcement: string): string { return announcement }
export function methodHintCopy(): string { return 'Inspect a discovered record and its claim boundary.' }
export type HintTier = 'METHOD_HINT' | 'CASE_HINT' | 'DIRECT_HINT'
export function puzzleHintCopy(phase: PuzzlePhase, tier: HintTier): string {
  void tier
  const key = phase === 'START' ? 'COPY.A1:No form collected'
    : phase === 'FORM_HELD' ? 'COPY.A1:Form collected, pen not collected'
      : phase === 'PEN_HELD' || phase === 'FORM_AND_PEN' ? 'COPY.A1:Form and pen available, form incomplete'
        : phase === 'FORM_COMPLETED' || phase === 'FORM_SUBMITTED' ? 'COPY.A1:Completed form available'
          : 'COPY.ARTHUR:Authorized, Euler file not collected'
  return r55TextByEvent(key).join('\n\n')
}
export type TerminalHintMilestone = 'TERMINAL.ACCESS_EARNED' | 'TERMINAL.BROAD_SEA_SEEN' | 'TERMINAL.CANDIDATES_AVAILABLE' | 'TERMINAL.COMPARISON_AVAILABLE' | 'TERMINAL.WORKING_THEORY_SELECTED' | 'TERMINAL.THEORY_REJECTED' | 'TERMINAL.EXACT_CONVERGENCE_VERIFIED' | 'TERMINAL.PROOF_COMPLETE'
export function terminalHintMilestone(state: InvestigationState): TerminalHintMilestone {
  if (state.complete) return 'TERMINAL.PROOF_COMPLETE'
  if (state.rejectedTheory) return 'TERMINAL.THEORY_REJECTED'
  if (state.exactConvergenceVerified) return 'TERMINAL.EXACT_CONVERGENCE_VERIFIED'
  if (state.workingTheory) return 'TERMINAL.WORKING_THEORY_SELECTED'
  if (state.comparison.length === 2) return 'TERMINAL.COMPARISON_AVAILABLE'
  if (state.result?.folders.length) return 'TERMINAL.CANDIDATES_AVAILABLE'
  if (state.broadSeaSeen) return 'TERMINAL.BROAD_SEA_SEEN'
  return 'TERMINAL.ACCESS_EARNED'
}
export function investigationHintCopy(state: InvestigationState, tier: HintTier): string {
  void tier
  const milestone = terminalHintMilestone(state)
  const key = milestone === 'TERMINAL.PROOF_COMPLETE' || milestone === 'TERMINAL.EXACT_CONVERGENCE_VERIFIED'
    ? 'COPY.HERO:Theory resolution'
    : milestone === 'TERMINAL.CANDIDATES_AVAILABLE' || milestone === 'TERMINAL.COMPARISON_AVAILABLE' || milestone === 'TERMINAL.WORKING_THEORY_SELECTED' || milestone === 'TERMINAL.THEORY_REJECTED'
      ? 'COPY.HERO:Evidence Delta 2'
      : 'COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead'
  return r55TextByEvent(key).join('\n\n')
}
