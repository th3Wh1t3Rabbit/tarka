import type { AdventureState, ControlClass, HotspotId, InterfaceTreatment, PendingInteraction, VerbId } from './types'

export const INTENT_REPLACED_KEY = 'SYSTEM.INTENT_REPLACED'
export const INTENT_REPLACED_TEXT = 'Prior action replaced.'
export const ARTHUR_IDLE_FACING = 'RIGHT' as const
export const EQUAL_X_FACING = { rookFacing: 'RIGHT', mrIndexFacing: 'LEFT' } as const
export const FAIL_CLOSED_CONTROL: ControlClass = 'BLOCKING_WORLD_DIALOGUE'

const BLOCKING_FEEDBACK = 'BLOCKING_WORLD_DIALOGUE' as const
const SELF_TALK = 'NONBLOCKING_SELF_TALK' as const

export const DIALOGUE_CONTROL = {
  OPENING: 'BLOCKING_CUTSCENE',
  POST_SOLVE_STAGED: 'BLOCKING_CUTSCENE',
  RETURN_EXCHANGE: 'BLOCKING_CUTSCENE',
  'SEQUENCE.CABINET_POLICY_BLOCK': 'BLOCKING_ACTION',
  PRESERVE_REACH: 'BLOCKING_ACTION',
  CABINET_POLICY_BLOCK: BLOCKING_FEEDBACK,
  DIALOGUE_TOPIC: BLOCKING_FEEDBACK,
  NOTE_READ: BLOCKING_FEEDBACK,
  OFFICE_HINT: BLOCKING_FEEDBACK,
  RETURN_TAG: BLOCKING_FEEDBACK,
  REVIEW_TALKING: BLOCKING_FEEDBACK,
  'FIXTURE.ROOK_BLOCKING_BEAT': BLOCKING_FEEDBACK,
  'ITEM.LOOK': SELF_TALK,
  DEAD_END: SELF_TALK,
  HERO_OPTIONAL: SELF_TALK,
  FORM_BARK: SELF_TALK,
  'COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead': SELF_TALK,
  'COPY.A1:6. Exit topic': SELF_TALK,
  'COPY.END:4.1 Default ending — BRCG not completed': SELF_TALK,
  'look-case-cabinet': SELF_TALK,
  'look-drawer': SELF_TALK,
  'look-case-stack': SELF_TALK,
  'look-misc-contents': SELF_TALK,
  'open-toolbox-open': SELF_TALK,
  'use-toolbox-open': SELF_TALK,
  'take-form': BLOCKING_FEEDBACK,
  'take-pen': BLOCKING_FEEDBACK,
  'take-form-2': BLOCKING_FEEDBACK,
  'take-pen-2': BLOCKING_FEEDBACK,
  'give-form': BLOCKING_FEEDBACK,
  'reprimand-start': BLOCKING_FEEDBACK,
  'reprimand-form-held': BLOCKING_FEEDBACK,
  'reprimand-pen-held': BLOCKING_FEEDBACK,
  'reprimand-form-and-pen': BLOCKING_FEEDBACK,
  'reprimand-form-completed': BLOCKING_FEEDBACK,
  'reprimand-form-submitted': BLOCKING_FEEDBACK,
  'open-case-drawer': BLOCKING_FEEDBACK,
  'pull-case-drawer': BLOCKING_FEEDBACK,
  'close-case-drawer': BLOCKING_FEEDBACK,
  'push-case-drawer': BLOCKING_FEEDBACK,
  'use-case-drawer-open': BLOCKING_FEEDBACK,
  'use-case-drawer-shut': BLOCKING_FEEDBACK,
  'pickup-case-stack': BLOCKING_FEEDBACK,
  'open-misc-drawer': BLOCKING_FEEDBACK,
  'pull-misc-drawer': BLOCKING_FEEDBACK,
  'close-misc-drawer': BLOCKING_FEEDBACK,
  'push-misc-drawer': BLOCKING_FEEDBACK,
  'use-misc-drawer-open': BLOCKING_FEEDBACK,
  'use-misc-drawer-shut': BLOCKING_FEEDBACK,
  'pickup-misc-contents': BLOCKING_FEEDBACK,
  'combine-form-pen': BLOCKING_FEEDBACK,
  'open-toolbox': BLOCKING_FEEDBACK,
  'use-toolbox': BLOCKING_FEEDBACK,
  'smash-piggy': BLOCKING_FEEDBACK,
} as const satisfies Record<string, ControlClass>

export function controlForOutcome(id: string): ControlClass {
  return (DIALOGUE_CONTROL as Record<string, ControlClass>)[id] ?? FAIL_CLOSED_CONTROL
}

export function facingPair(rookX: number, arthurX: number): { rookFacing: 'LEFT' | 'RIGHT'; mrIndexFacing: 'LEFT' | 'RIGHT' } {
  if (rookX === arthurX) return { ...EQUAL_X_FACING }
  if (rookX < arthurX) return { rookFacing: 'RIGHT', mrIndexFacing: 'LEFT' }
  return { rookFacing: 'LEFT', mrIndexFacing: 'RIGHT' }
}

const REMOTE_VERBS = new Set<VerbId>(['LOOK_AT', 'TALK_TO'])

export function requiresProximity(pending: PendingInteraction): boolean {
  if (pending.verb === 'TALK_TO' && pending.targetId === 'mr-index') return false
  return !REMOTE_VERBS.has(pending.verb)
}

export const PROXIMITY_HOTSPOT_VERBS: readonly VerbId[] = ['OPEN', 'USE', 'PULL', 'PICK_UP', 'GIVE', 'CLOSE', 'PUSH']
export const PROXIMITY_TARGETS: readonly HotspotId[] = [
  'official-case-file-cabinet',
  'miscellaneous-drawer-cabinet',
  'disorderly-stack-of-confidential-files',
  'miscellaneous-catch-all-contents',
  'pen-stand',
  'request-dispenser',
  'blank-authorization-form',
  'nansen-terminal',
  'mr-index',
]

export function globeActionAllowsControls(state: Pick<AdventureState, 'activeSequence'>) {
  return state.activeSequence?.id === 'SEQUENCE.PHYSICAL_CONTACT' && state.activeSequence.pendingStateChangeRule.startsWith('dynamic.globe.')
}

export function controlClass(state: AdventureState): ControlClass {
  if (!state.introComplete || state.openingStage !== 'COMPLETE') return 'BLOCKING_CUTSCENE'
  if (globeActionAllowsControls(state)) return 'PLAYER_CONTROLLED'
  if (state.activeSequence) return 'BLOCKING_ACTION'
  if (state.speech?.control === 'BLOCKING_CUTSCENE') return 'BLOCKING_CUTSCENE'
  if (state.speech || state.dialogueOpen) return state.speech?.control === 'BLOCKING_ACTION' ? 'BLOCKING_ACTION' : 'BLOCKING_WORLD_DIALOGUE'
  if (state.walk) return 'WALK_PENDING_REPLACEABLE'
  if (state.nonblockingSpeech?.control === 'NONBLOCKING_SELF_TALK' || state.nonblockingSpeech) return 'NONBLOCKING_SELF_TALK'
  return 'PLAYER_CONTROLLED'
}

export function interfaceTreatment(state: AdventureState): InterfaceTreatment {
  const active = controlClass(state)
  if (active === 'BLOCKING_CUTSCENE') return 'BLACKOUT'
  if (state.dialogueOpen || state.speech?.returnTo === 'DIALOGUE') return 'BLACKOUT'
  if (active === 'BLOCKING_ACTION' || active === 'BLOCKING_WORLD_DIALOGUE') return 'INERT_VISIBLE'
  return 'ACTIVE'
}

/** One production owner for the frame-zero opening world lock. */
export function openingWorldIsInert(state: Pick<AdventureState, 'introComplete' | 'openingStage'>): boolean {
  return !state.introComplete || state.openingStage !== 'COMPLETE'
}

export function worldDialogueAllowed(terminalOpen: boolean): boolean {
  return !terminalOpen
}

export function sameIntent(left: PendingInteraction | null | undefined, right: PendingInteraction | null | undefined): boolean {
  if (!left || !right) return false
  return left.verb === right.verb && left.targetId === right.targetId && left.itemId === right.itemId
}
