import type { PerformanceIntention } from '../adventure/performanceCatalog'
import type { InvestigationState } from './state'

/** Semantic requests only: no production inventory, dimensions, anchors or clips. */
export function investigationCue(state: InvestigationState) {
  const last = state.commands.at(-1)
  const intention: PerformanceIntention = state.complete || state.exactEventIds.length ? 'REACT' : last?.type === 'HINT' ? 'LISTEN' : last?.type === 'DISPATCH' ? 'USE' : last?.type === 'OPEN_CANISTER' ? 'PICK_UP' : state.section === 'SOURCE' ? 'READ' : state.section === 'CASE' ? 'INSPECT' : 'WORK'
  return { rook: { intention, facing: 'FRONT' as const }, archivist: { intention: last?.type === 'HINT' ? 'GESTURE' as const : 'LISTEN' as const, facing: 'FRONT' as const }, priority: state.exactEventIds.length ? 100 : 10, optional: true as const, props: { canister: state.canister, tray: state.query.filters.length ? 'STAGED' : 'EMPTY', proof: state.complete ? 'FILED' : state.exactEventIds.length ? 'VERIFIED' : 'OPEN' }, fallback: `${state.query.filters.length} staged filters; proof ${state.complete ? 'filed' : state.exactEventIds.length ? 'verified' : 'open'}.` }
}
