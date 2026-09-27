import { adventureReducer, createInitialAdventureState } from '../../../src/adventure/reducer'
import type { AdventureState, HotspotId, InventoryItemId, VerbId } from '../../../src/adventure/types'
import { investigationReducer, createInvestigationState, type Command, type InvestigationState } from '../../../src/investigation/state'
import type { CaseFixture } from '../../../src/investigation/contracts'

export const progression = [
  ['PICK_UP', 'blank-authorization-form', null, null, 'START', 'FORM_HELD', ['blank-terminal-authorization-form']],
  ['PICK_UP', 'pen-stand', null, null, 'START', 'PEN_HELD', ['loose-feather-pen']],
  ['PICK_UP', 'blank-authorization-form', null, null, 'PEN_HELD', 'FORM_AND_PEN', ['blank-terminal-authorization-form', 'loose-feather-pen']],
  ['PICK_UP', 'pen-stand', null, null, 'FORM_HELD', 'FORM_AND_PEN', ['blank-terminal-authorization-form', 'loose-feather-pen']],
  ['USE', null, 'blank-terminal-authorization-form', 'loose-feather-pen', 'FORM_AND_PEN', 'FORM_COMPLETED', ['signed-terminal-authorization-form-with-doodles', 'broken-feather-pen']],
  ['GIVE', 'mr-index', 'signed-terminal-authorization-form-with-doodles', null, 'FORM_COMPLETED', 'COMPLETE', ['broken-feather-pen', 'approved-stamped-terminal-authorization-form']],
] as const
export const progressionChain = [progression[0], progression[3], progression[4], progression[5]] as const
export function drain(state: AdventureState) {
  let next = state
  for (let i = 0; next.activeSequence && i < 40; i++) next = adventureReducer(next, { type: 'ADVANCE_SEQUENCE' })
  if (next.activeSequence) throw new Error('Semantic sequence did not drain within bounded completion signals')
  for (let i = 0; next.speech && i < 40; i++) next = adventureReducer(next, { type: 'ADVANCE_SPEECH' })
  if (next.speech) throw new Error('Speech did not drain within bounded player actions')
  return next
}
export function interaction(state: AdventureState, verb: VerbId, targetId: HotspotId | null, itemId: InventoryItemId | null = null, item2: InventoryItemId | null = null) {
  let next = adventureReducer(state, { type: 'SELECT_VERB', verb })
  if (targetId === null) {
    if (itemId) next = adventureReducer(next, { type: 'ACT_ON_ITEM', itemId })
    if (item2) next = adventureReducer(next, { type: 'ACT_ON_ITEM', itemId: item2 })
  } else {
    if (itemId) next = adventureReducer(next, { type: 'SELECT_ITEM', itemId })
    next = adventureReducer(next, { type: 'INTERACT', targetId })
    next = adventureReducer(next, { type: 'WALK_TICK', delta: 2000 })
  }
  return drain(next)
}
export function reachablePhases() {
  const states = [createInitialAdventureState({ skipIntro: true })]
  for (const [verb, target, item, item2] of progressionChain) states.push(interaction(states.at(-1)!, verb as VerbId, target as HotspotId | null, item as InventoryItemId | null, item2 as InventoryItemId | null))
  return states
}
export const command = (f: CaseFixture, s: InvestigationState, c: Command) => investigationReducer(f, s, c)
export const earned = (f: CaseFixture) => command(f, createInvestigationState(f), { type: 'EARN_ACCESS' })
export function dispatch(f: CaseFixture, s: InvestigationState) {
  return command(f, command(f, s, { type: 'REVIEW_RECEIPT' }), { type: 'DISPATCH', path: 'TERMINAL' })
}
export const collected = (f: CaseFixture) => command(f, earned(f), { type: 'COLLECT_CASE_FILE' })
export function prove(f: CaseFixture, s = collected(f)) {
  s = dispatch(f, s)
  s = command(f, s, { type: 'SELECT_RESULT', recordId: f.openingRecordId })
  s = dispatch(f, command(f, s, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }))
  s = command(f, s, { type: 'SELECT_RESULT', recordId: f.proof.slots.LINK })
  return dispatch(f, command(f, s, { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' }))
}
