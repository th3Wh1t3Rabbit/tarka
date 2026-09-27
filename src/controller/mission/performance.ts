import type { PhysicalPoseDirective, SequenceSpeechStage } from '../../adventure/types'

export const STAGE_MARKS = [
  'STAGE.ROOK_ENTRY',
  'STAGE.ROOK_REQUEST_DISPENSER',
  'STAGE.ROOK_PEN_STAND',
  'STAGE.ROOK_ARTHUR_COUNTER',
  'STAGE.ARTHUR_DESK',
  'STAGE.ROOK_CABINET',
  'STAGE.ROOK_DRAWER',
  'STAGE.ROOK_TERMINAL',
  'STAGE.ROOK_GLOBE',
] as const

export const SEMANTIC_CONTACTS = [
  'CONTACT.FORM_HANDOFF',
  'CONTACT.FORM_STAMP',
  'CONTACT.FORM_RETURN',
  'CONTACT.REPRIMAND',
  'CONTACT.CASEFILE_SCAN',
  'CONTACT.CASEFILE_COLLECT',
  'CONTACT.DRAWER_PICKUP_1',
  'CONTACT.DRAWER_PICKUP_2',
  'CONTACT.DRAWER_PICKUP_3',
  'CONTACT.DRAWER_PICKUP_4',
  'CONTACT.DRAWER_PICKUP_5',
  'CONTACT.CABINET_POLICY_BLOCK',
  'CONTACT.PHYSICAL_ACTION',
] as const

export const SOUND_INTENTS = [
  'SFX.PAPER_PULL', 'SFX.PEN_SCRATCH', 'SFX.STAMP_THUNK', 'SFX.TUBE_LATCH',
  'SFX.TUBE_DISPATCH', 'SFX.CANISTER_RETURN', 'SFX.STRIP_INSERT', 'SFX.CRT_WAKE',
  'SFX.CRT_CONFIRM', 'SFX.GLOBE_SPIN', 'SFX.BELL_DING', 'AMBIENT.RECORDS_OFFICE',
  'MUSIC.RECORDS_OFFICE_LOW_FI', 'MUSIC.CASE_TERMINAL_LOW_FI',
] as const

export type StageMark = typeof STAGE_MARKS[number]
export type SemanticContact = typeof SEMANTIC_CONTACTS[number]
export type SoundIntent = typeof SOUND_INTENTS[number]
export type ActorIntention = 'IDLE' | 'TALK' | 'LISTEN' | 'USE' | 'GIVE' | 'PICK_UP' | 'READ' | 'INSPECT' | 'STAMP' | 'RETURN' | 'RECEIVE'

export interface ScriptedAction {
  id: string
  kind: 'RESERVE' | 'WALK' | 'FACE' | 'INTENTION' | 'CONTACT' | 'SOUND_CAPTION' | 'DIALOGUE' | 'RESTORE_FOCUS'
  actor?: 'ROOK' | 'ARTHUR'
  receiver?: 'ROOK' | 'ARTHUR'
  mark?: StageMark
  intention?: ActorIntention
  receiverIntention?: ActorIntention
  speechStage?: SequenceSpeechStage
  contact?: SemanticContact
  sound?: SoundIntent
  caption?: string
  physicalPose?: PhysicalPoseDirective
  fallback: 'GENERIC' | 'STATIC_TEXT'
}

export interface ScriptedSequence {
  id: 'SEQUENCE.FORM_REVIEW_RETURN' | 'SEQUENCE.TERMINAL_REPRIMAND' | 'SEQUENCE.CASEFILE_COLLECTION' | 'SEQUENCE.DRAWER_LOOT' | 'SEQUENCE.CABINET_POLICY_BLOCK' | 'SEQUENCE.PHYSICAL_CONTACT' | 'SEQUENCE.PRESERVE_REACH'
  blocking: true
  actions: readonly ScriptedAction[]
  mutationContact: SemanticContact
  reducedMotion: 'STATIC_POSES_ITEM_STATE_CAPTION_FOCUS'
}

export const SCRIPTED_SEQUENCES: readonly ScriptedSequence[] = [
  {
    id: 'SEQUENCE.FORM_REVIEW_RETURN', blocking: true, mutationContact: 'CONTACT.FORM_STAMP', reducedMotion: 'STATIC_POSES_ITEM_STATE_CAPTION_FOCUS',
    actions: [
      { id: 'reserve', kind: 'RESERVE', physicalPose: { poseClass: 'NO_REACH', propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' },
      { id: 'rook-walk', kind: 'WALK', actor: 'ROOK', mark: 'STAGE.ROOK_ARTHUR_COUNTER', physicalPose: { poseClass: 'NO_REACH', propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },
      { id: 'arthur-face', kind: 'FACE', actor: 'ARTHUR', mark: 'STAGE.ARTHUR_DESK', physicalPose: { poseClass: 'NO_REACH', propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },
      { id: 'offer', kind: 'INTENTION', actor: 'ROOK', intention: 'GIVE', physicalPose: { actor: 'ROOK', poseClass: 'PAPER_REACH', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },
      // The preparatory beat must not select Arthur's paper-bearing pickup cel
      // while Rook still visibly owns the form. Arthur waits empty-handed.
      { id: 'receive', kind: 'INTENTION', actor: 'ARTHUR', intention: 'RECEIVE', physicalPose: { actor: 'ARTHUR', poseClass: 'IDLE', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },
      // Ownership and visible cel change on the same semantic contact: Rook
      // releases first, then Arthur's receiving cel is allowed to show paper.
      { id: 'handoff', kind: 'CONTACT', actor: 'ARTHUR', intention: 'RECEIVE', contact: 'CONTACT.FORM_HANDOFF', physicalPose: { actor: 'ARTHUR', poseClass: 'EMPTY_HAND_REACH', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' },
      { id: 'review', kind: 'DIALOGUE', actor: 'ARTHUR', intention: 'READ', speechStage: 'FORM_REVIEW', physicalPose: { actor: 'ARTHUR', poseClass: 'DOCUMENT_REVIEW', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },
      { id: 'return', kind: 'CONTACT', actor: 'ARTHUR', receiver: 'ROOK', intention: 'RETURN', receiverIntention: 'RECEIVE', contact: 'CONTACT.FORM_RETURN', physicalPose: { actor: 'ROOK', poseClass: 'PAPER_REACH', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' },
      { id: 'stamp', kind: 'CONTACT', actor: 'ARTHUR', intention: 'STAMP', contact: 'CONTACT.FORM_STAMP', sound: 'SFX.STAMP_THUNK', caption: '[THUNK.]', physicalPose: { actor: 'ARTHUR', poseClass: 'STAMP_USE', propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' } }, fallback: 'GENERIC' },
      { id: 'stamp-caption', kind: 'DIALOGUE', actor: 'ARTHUR', intention: 'TALK', speechStage: 'POST_STAMP_AUTHORIZATION', physicalPose: { actor: 'ARTHUR', poseClass: 'IDLE', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },
      { id: 'focus', kind: 'RESTORE_FOCUS', physicalPose: { poseClass: 'IDLE', releaseActors: ['ROOK', 'ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_APPROVED_INVENTORY', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },
    ],
  },
  {
    id: 'SEQUENCE.TERMINAL_REPRIMAND', blocking: true, mutationContact: 'CONTACT.REPRIMAND', reducedMotion: 'STATIC_POSES_ITEM_STATE_CAPTION_FOCUS',
    actions: [
      { id: 'reserve', kind: 'RESERVE', fallback: 'GENERIC' },
      { id: 'reach', kind: 'INTENTION', actor: 'ROOK', mark: 'STAGE.ROOK_TERMINAL', intention: 'USE', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'STATIC_TEXT' },
      { id: 'hold-blocked-reach', kind: 'CONTACT', actor: 'ROOK', intention: 'USE', contact: 'CONTACT.REPRIMAND', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'reprimand', kind: 'DIALOGUE', actor: 'ARTHUR', intention: 'TALK', speechStage: 'BLOCKED_REPRIMAND', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'focus', kind: 'RESTORE_FOCUS', fallback: 'STATIC_TEXT' },
    ],
  },
  {
    id: 'SEQUENCE.CASEFILE_COLLECTION', blocking: true, mutationContact: 'CONTACT.CASEFILE_COLLECT', reducedMotion: 'STATIC_POSES_ITEM_STATE_CAPTION_FOCUS',
    actions: [
      { id: 'reserve', kind: 'RESERVE', fallback: 'GENERIC' },
      { id: 'walk', kind: 'WALK', actor: 'ROOK', mark: 'STAGE.ROOK_CABINET', fallback: 'STATIC_TEXT' },
      { id: 'scan-beat-1', kind: 'SOUND_CAPTION', caption: '[ROOK SCANS THE CASE TITLES.]', fallback: 'STATIC_TEXT' },
      { id: 'scan-beat-2', kind: 'CONTACT', actor: 'ROOK', intention: 'READ', contact: 'CONTACT.CASEFILE_SCAN', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'search-dialogue', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'CASEFILE_SEARCH', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'STATIC_TEXT' },
      { id: 'collect', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.CASEFILE_COLLECT', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'recite-file', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'CASEFILE_RECITATION', physicalPose: { actor: 'ROOK', poseClass: 'ITEM_REACH' }, fallback: 'STATIC_TEXT' },
      { id: 'focus', kind: 'RESTORE_FOCUS', physicalPose: { poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
    ],
  },
  {
    id: 'SEQUENCE.DRAWER_LOOT', blocking: true, mutationContact: 'CONTACT.DRAWER_PICKUP_5', reducedMotion: 'STATIC_POSES_ITEM_STATE_CAPTION_FOCUS',
    actions: [
      { id: 'reserve', kind: 'RESERVE', fallback: 'GENERIC' },
      { id: 'walk', kind: 'WALK', actor: 'ROOK', mark: 'STAGE.ROOK_DRAWER', fallback: 'STATIC_TEXT' },
      { id: 'pickup-1', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.DRAWER_PICKUP_1', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'describe-rubber-band', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'DRAWER_RUBBER_BAND', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'pickup-2', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.DRAWER_PICKUP_2', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'describe-rubiks-cube', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'DRAWER_RUBIKS_CUBE', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'pickup-3', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.DRAWER_PICKUP_3', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'describe-vhs', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'DRAWER_VHS', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'pickup-4', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.DRAWER_PICKUP_4', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'describe-piggy-bank', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'DRAWER_PIGGY_BANK', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'pickup-5', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.DRAWER_PICKUP_5', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'describe-toolbox', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'DRAWER_TOOLBOX', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'focus', kind: 'RESTORE_FOCUS', physicalPose: { poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
    ],
  },
  {
    id: 'SEQUENCE.CABINET_POLICY_BLOCK', blocking: true, mutationContact: 'CONTACT.CABINET_POLICY_BLOCK', reducedMotion: 'STATIC_POSES_ITEM_STATE_CAPTION_FOCUS',
    actions: [
      { id: 'reserve', kind: 'RESERVE', fallback: 'GENERIC' },
      { id: 'reach', kind: 'INTENTION', actor: 'ROOK', mark: 'STAGE.ROOK_CABINET', intention: 'USE', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, caption: 'Reach attempted. The cabinet stays closed.', fallback: 'STATIC_TEXT' },
      { id: 'hold-blocked-reach', kind: 'CONTACT', actor: 'ROOK', intention: 'USE', contact: 'CONTACT.CABINET_POLICY_BLOCK', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, caption: 'Cabinet contact blocked. The drawer stays closed.', fallback: 'GENERIC' },
      { id: 'reprimand', kind: 'DIALOGUE', actor: 'ARTHUR', intention: 'TALK', speechStage: 'BLOCKED_REPRIMAND', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'focus', kind: 'RESTORE_FOCUS', fallback: 'STATIC_TEXT' },
    ],
  },
  {
    id: 'SEQUENCE.PHYSICAL_CONTACT', blocking: true, mutationContact: 'CONTACT.PHYSICAL_ACTION', reducedMotion: 'STATIC_POSES_ITEM_STATE_CAPTION_FOCUS',
    actions: [
      { id: 'reserve', kind: 'RESERVE', fallback: 'GENERIC' },
      { id: 'reach', kind: 'INTENTION', actor: 'ROOK', intention: 'USE', fallback: 'STATIC_TEXT' },
      { id: 'contact', kind: 'CONTACT', actor: 'ROOK', intention: 'USE', contact: 'CONTACT.PHYSICAL_ACTION', fallback: 'GENERIC' },
      { id: 'focus', kind: 'RESTORE_FOCUS', fallback: 'STATIC_TEXT' },
    ],
  },
  {
    id: 'SEQUENCE.PRESERVE_REACH', blocking: true, mutationContact: 'CONTACT.PHYSICAL_ACTION', reducedMotion: 'STATIC_POSES_ITEM_STATE_CAPTION_FOCUS',
    actions: [
      { id: 'reserve', kind: 'RESERVE', fallback: 'GENERIC' },
      { id: 'preserve-line-before-reach', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'PRESERVE_PRE_REACH', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'reach-preserve', kind: 'INTENTION', actor: 'ROOK', intention: 'USE', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'STATIC_TEXT' },
      { id: 'hold-preserve-reach', kind: 'CONTACT', actor: 'ROOK', intention: 'USE', contact: 'CONTACT.PHYSICAL_ACTION', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' },
      { id: 'preserve-line-after-reach', kind: 'DIALOGUE', actor: 'ROOK', intention: 'TALK', speechStage: 'PRESERVE_POST_REACH', physicalPose: { actor: 'ROOK', poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
      { id: 'focus', kind: 'RESTORE_FOCUS', physicalPose: { poseClass: 'IDLE', releaseActors: ['ROOK'] }, fallback: 'STATIC_TEXT' },
    ],
  },
]

export function sequenceForRule(ruleId: string): ScriptedSequence | null {
  const id = ruleId === 'give-form' ? 'SEQUENCE.FORM_REVIEW_RETURN'
    : ruleId.startsWith('reprimand-') ? 'SEQUENCE.TERMINAL_REPRIMAND'
      : ruleId === 'pickup-case-stack' ? 'SEQUENCE.CASEFILE_COLLECTION'
        : ruleId === 'pickup-misc-contents' ? 'SEQUENCE.DRAWER_LOOT' : null
  return id ? SCRIPTED_SEQUENCES.find((sequence) => sequence.id === id) ?? null : null
}

export interface IdleIntent { actor: 'ROOK' | 'ARTHUR'; intention: 'IDLE' | 'INSPECT'; cue: 'MICRO_IDLE' | 'CURIOUS_GLANCE' | 'PAPER_SQUARE' | 'GLASSES_ADJUST' | 'STATIC' }
export function idleIntentsAt(elapsedSeconds: number, reducedMotion: boolean, paused = false): readonly IdleIntent[] {
  if (paused || reducedMotion) return [{ actor: 'ROOK', intention: 'IDLE', cue: 'STATIC' }, { actor: 'ARTHUR', intention: 'IDLE', cue: 'STATIC' }]
  const second = ((Math.floor(elapsedSeconds) % 20) + 20) % 20
  if (second === 6) return [{ actor: 'ROOK', intention: 'IDLE', cue: 'MICRO_IDLE' }]
  if (second === 10) return [{ actor: 'ARTHUR', intention: 'INSPECT', cue: 'PAPER_SQUARE' }]
  if (second === 14) return [{ actor: 'ROOK', intention: 'INSPECT', cue: 'CURIOUS_GLANCE' }]
  if (second === 18) return [{ actor: 'ARTHUR', intention: 'INSPECT', cue: 'GLASSES_ADJUST' }]
  return []
}

export const GENERIC_PERFORMANCE_FALLBACKS = ['IDLE', 'TALK', 'LISTEN', 'USE'] as const

export const PERFORMANCE_TRACKS = ['FACE', 'GAZE', 'BODY', 'PROP', 'VOICE_TEXT', 'TIME'] as const
export const TIMING_INTENTIONS = ['BEAT_MICRO', 'BEAT_CONVERSATIONAL', 'BEAT_COMIC', 'HOLD_REACTION', 'SILENCE_AWKWARD', 'LOOK_BEFORE_REPLY', 'INTERRUPT_CLEAN', 'TRAIL_OFF', 'EXHALE', 'SIGH', 'HMPH', 'GROAN'] as const
export type PerformanceTrack = typeof PERFORMANCE_TRACKS[number]
export type TimingIntention = typeof TIMING_INTENTIONS[number]
export type PerformanceTrigger = 'BEFORE_LINE' | 'AFTER_SUBSTRING' | 'BEFORE_SUBSTRING' | 'ON_PUNCTUATION' | 'AFTER_LINE'
export interface PerformanceSpan {
  cueId: string
  copyKey: string
  actor: 'ROOK' | 'ARTHUR' | 'TERMINAL' | 'SYSTEM'
  trigger: PerformanceTrigger
  anchor?: string
  track: PerformanceTrack
  intention: string
  priority: number
  interruptsPrevious: boolean
  fallback: 'GENERIC_SILHOUETTE' | 'STATIC_TEXT'
  reducedMotionFallback: 'STATIC_TEXT' | 'PLAYER_PACED_SEPARATION'
  screenReaderNote: null
}

const cue = (cueId: string, copyKey: string, actor: PerformanceSpan['actor'], trigger: PerformanceTrigger, track: PerformanceTrack, intention: string, anchor?: string, interruptsPrevious = false): PerformanceSpan => ({
  cueId, copyKey, actor, trigger, ...(anchor ? { anchor } : {}), track, intention, priority: 100, interruptsPrevious,
  fallback: 'GENERIC_SILHOUETTE', reducedMotionFallback: track === 'TIME' ? 'PLAYER_PACED_SEPARATION' : 'STATIC_TEXT', screenReaderNote: null,
})

export const PERFORMANCE_SPANS: readonly PerformanceSpan[] = [
  cue('PERF.OPEN.ROOK.CONFIDENCE', 'lane_a.s7r2b.opening.3', 'ROOK', 'BEFORE_LINE', 'FACE', 'FALSE_CONFIDENCE'),
  cue('PERF.OPEN.RIGHT.BEAT', 'lane_a.s7r2b.opening.3', 'ROOK', 'AFTER_SUBSTRING', 'TIME', 'BEAT_MICRO', 'Right.'),
  cue('PERF.OPEN.RIGHT.GAZE', 'lane_a.s7r2b.opening.3', 'ROOK', 'AFTER_SUBSTRING', 'GAZE', 'LOOK_TO_ARTHUR', 'Right.'),
  cue('PERF.OPEN.NICKNAME.LEAN', 'lane_a.s7r2b.opening.3', 'ROOK', 'BEFORE_SUBSTRING', 'BODY', 'LEAN_CHARMINGLY', 'Mr. A—'),
  cue('PERF.OPEN.INTERRUPT', 'lane_a.s7r2b.opening.4', 'ARTHUR', 'BEFORE_LINE', 'VOICE_TEXT', 'INTERRUPT_CLEAN', undefined, true),
  cue('PERF.OPEN.IRRITATION', 'lane_a.s7r2b.opening.4', 'ARTHUR', 'BEFORE_LINE', 'FACE', 'RESTRAINED_IRRITATION'),
  cue('PERF.OPEN.COMIC_HOLD', 'lane_a.s7r2b.opening.4', 'ARTHUR', 'AFTER_LINE', 'TIME', 'BEAT_COMIC'),
  cue('PERF.OPEN.RECOVERY', 'lane_a.s7r2b.opening.5', 'ROOK', 'BEFORE_LINE', 'FACE', 'RECOVERING_CONFIDENCE'),
  cue('PERF.OPEN.DRY_LOOK', 'lane_a.s7r2b.opening.6', 'ARTHUR', 'BEFORE_LINE', 'GAZE', 'STILL_DRY_LOOK'),

  cue('PERF.WRONG.PLEASED', 'lane_a.s7r2b.wrong_theory.1', 'ROOK', 'BEFORE_LINE', 'FACE', 'PLEASED_REASONING'),
  cue('PERF.WRONG.VALIDATE', 'lane_a.s7r2b.wrong_theory.2', 'ARTHUR', 'BEFORE_LINE', 'BODY', 'PROCEDURAL_VALIDATION'),
  cue('PERF.WRONG.WITHHOLD', 'lane_a.s7r2b.wrong_theory.4', 'ARTHUR', 'BEFORE_LINE', 'FACE', 'WITHHELD_WARMTH'),
  cue('PERF.WRONG.HOLD', 'lane_a.s7r2b.wrong_theory.4', 'ARTHUR', 'BEFORE_LINE', 'TIME', 'HOLD_REACTION'),

  cue('PERF.EXACT.CONCENTRATION', 'lane_a.s7r2b.exact_correction.1', 'ROOK', 'BEFORE_LINE', 'FACE', 'CONCENTRATION'),
  cue('PERF.EXACT.RECOGNITION', 'lane_a.s7r2b.exact_correction.1', 'ROOK', 'AFTER_SUBSTRING', 'FACE', 'RECOGNITION', '11:38:11.'),
  cue('PERF.EXACT.SATISFACTION', 'lane_a.s7r2b.exact_correction.1', 'ROOK', 'AFTER_LINE', 'FACE', 'QUIET_SATISFACTION'),
  cue('PERF.EXACT.GOOD', 'lane_a.s7r2b.exact_correction.4', 'ARTHUR', 'BEFORE_LINE', 'VOICE_TEXT', 'SMALL_DELIVERY'),
  cue('PERF.EXACT.WAIT', 'lane_a.s7r2b.exact_correction.5', 'ROOK', 'BEFORE_LINE', 'TIME', 'LOOK_BEFORE_REPLY'),
  cue('PERF.EXACT.SILENCE', 'lane_a.s7r2b.exact_correction.6', 'ARTHUR', 'BEFORE_LINE', 'TIME', 'SILENCE_AWKWARD'),

  cue('PERF.GLOBE.1.DISCOVERY', 'lane_a.s7r2b.globe.push.1.1', 'ROOK', 'BEFORE_LINE', 'BODY', 'PERFORM_DISCOVERY'),
  cue('PERF.GLOBE.1.SPIN', 'lane_a.s7r2b.globe.push.1.1', 'ROOK', 'BEFORE_LINE', 'PROP', 'GLOBE_SPIN'),
  cue('PERF.GLOBE.2.JUSTIFY', 'lane_a.s7r2b.globe.push.2.1', 'ROOK', 'BEFORE_LINE', 'VOICE_TEXT', 'JUSTIFY_BEHAVIOR'),
  cue('PERF.GLOBE.3.INTERRUPT', 'lane_a.s7r2b.globe.push.3.2', 'ARTHUR', 'BEFORE_LINE', 'VOICE_TEXT', 'INTERRUPT_CLEAN', undefined, true),
  cue('PERF.GLOBE.LOOP.CONCISE', 'lane_a.s7r2b.globe.push.loop.1', 'ARTHUR', 'BEFORE_LINE', 'BODY', 'STABLE_CONCISE_LOOP'),

  cue('PERF.RETURN.RHYTHM.1', 'lane_a.s7r2b.return.1', 'ROOK', 'BEFORE_LINE', 'TIME', 'BEAT_CONVERSATIONAL'),
  cue('PERF.RETURN.RHYTHM.2', 'lane_a.s7r2b.return.2', 'ARTHUR', 'BEFORE_LINE', 'VOICE_TEXT', 'DRY_EXACT'),
  cue('PERF.RETURN.RHYTHM.3', 'lane_a.s7r2b.return.3', 'ROOK', 'BEFORE_LINE', 'VOICE_TEXT', 'EARNED_CALLBACK'),
  cue('PERF.RETURN.RHYTHM.4', 'lane_a.s7r2b.return.4', 'ARTHUR', 'BEFORE_LINE', 'TIME', 'BEAT_COMIC'),
]

export function performanceSpansFor(copyKey: string): readonly PerformanceSpan[] { return PERFORMANCE_SPANS.filter((span) => span.copyKey === copyKey) }

export function performanceBoundary(span: PerformanceSpan, text: string): number | null {
  if (span.trigger === 'BEFORE_LINE') return 0
  if (span.trigger === 'AFTER_LINE') return text.length
  if (span.trigger === 'ON_PUNCTUATION') {
    if (span.anchor) { const index = text.indexOf(span.anchor); return index < 0 ? null : index + span.anchor.length }
    const index = text.search(/[.!?—,:;]/)
    return index < 0 ? null : index + 1
  }
  if (!span.anchor) return null
  const index = text.indexOf(span.anchor)
  if (index < 0) return null
  return span.trigger === 'BEFORE_SUBSTRING' ? index : index + span.anchor.length
}

export function livePerformanceAt(copyKey: string | undefined, text: string, visibleCharacters: number, reducedMotion: boolean, fallbackActor: PerformanceSpan['actor'] = 'SYSTEM', r55Cues: readonly import('../../adventure/types').R55PerformanceCue[] = []) {
  const actorFor = (actor: PerformanceSpan['actor']) => actor
  const cueActor = r55Cues.find(cue => cue.actor)?.actor
  const actor = actorFor(PERFORMANCE_SPANS.find((span) => span.copyKey === copyKey)?.actor ?? (cueActor === 'arthur' ? 'ARTHUR' : cueActor === 'rook' ? 'ROOK' : fallbackActor))
  const crossed = copyKey ? PERFORMANCE_SPANS
    .map((span, order) => ({ span, order, boundary: span.copyKey === copyKey ? performanceBoundary(span, text) : null }))
    .filter((entry): entry is { span: PerformanceSpan; order: number; boundary: number } => entry.boundary !== null && visibleCharacters >= entry.boundary)
    .sort((a, b) => a.boundary - b.boundary || a.order - b.order) : []
  const intentions: Record<string, Record<string, string>> = {}
  for (const { span } of crossed) {
    const target = actorFor(span.actor)
    intentions[target] ??= {}
    intentions[target]![span.track] = span.intention
  }
  const crossedR55 = visibleCharacters >= 0 ? r55Cues : []
  for (const cue of crossedR55) {
    if (!cue.supportedTrack) continue
    const target = cue.actor === 'arthur' ? 'ARTHUR' : cue.actor === 'rook' ? 'ROOK' : actor
    intentions[target] ??= {}
    intentions[target]![cue.supportedTrack] = cue.selectedClip ?? cue.intent
  }
  return {
    copyKey: copyKey ?? null,
    actor,
    activeActor: actor,
    crossedCueIds: [...crossed.map(({ span }) => span.cueId), ...crossedR55.map(cue => cue.cueId)],
    intentions,
    afterLineHold: crossed.some(({ span }) => span.trigger === 'AFTER_LINE' && span.track === 'TIME'),
    reducedMotion,
  }
}

export function performanceSpanAnchorsAreExact(copyByKey: ReadonlyMap<string, string>): boolean {
  return PERFORMANCE_SPANS.every((span) => !span.anchor || copyByKey.get(span.copyKey)?.replace('{EXACT_CONVERGENCE_TIME}', '11:38:11')?.replace('{EXACT_MAIN_RECEIVER_DISPLAY}', 'Receiving Vault')?.includes(span.anchor))
}
