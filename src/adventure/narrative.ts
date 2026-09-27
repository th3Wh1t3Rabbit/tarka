import type { CharacterAnimationId, Facing, ReactionOverlayId } from './semanticCatalog'
import { contentText } from '../controller/content/adapter'

export type NarrativeSpeaker = 'ROOK' | 'ARCHIVIST' | 'SYSTEM'
export type InterruptionPolicy = 'BLOCK' | 'CANCEL_AND_IDLE' | 'QUEUE'

export interface DialogueCue {
  id: string
  beatId: string
  speaker: NarrativeSpeaker
  copyKey: string
  provisionalText: string
  animationId: CharacterAnimationId
  facing: Facing
  reactionOverlay?: ReactionOverlayId
  propCue?: { family: string; state: string }
  pauseMs?: number
  cameraFraming?: 'TWO_SHOT' | 'SPEAKER' | 'PROP' | 'EVIDENCE'
  update?: { objectiveId?: string; evidenceId?: string }
  advance: 'PLAYER_PACED'
  interruption: InterruptionPolicy
  reducedMotionAnimationId: CharacterAnimationId
}

export const RECORDS_OFFICE_BEAT_IDS = [
  'records.no_ordinary_witnesses',
  'records.rook_assumes_no_leads',
  'records.event_was_onchain',
  'records.rook_misses_implication',
  'records.public_but_hard_to_read',
  'records.rook_premature_confidence',
  'records.archivist_corrects_scope',
  'records.authorized_case_access',
  'records.nansen_structures_not_solves',
  'records.learn_together',
] as const

const cue = (id: string, beatId: typeof RECORDS_OFFICE_BEAT_IDS[number], speaker: NarrativeSpeaker, provisionalText: string, animationId: CharacterAnimationId, facing: Facing = 'RIGHT', extra: Partial<DialogueCue> = {}): DialogueCue => ({
  id, beatId, speaker, copyKey: `TODO.LEAD_COPY.${beatId}`, provisionalText:contentText(`lane_a.beat.${beatId}`,provisionalText), animationId, facing,
  advance: 'PLAYER_PACED', interruption: 'BLOCK', reducedMotionAnimationId: animationId, ...extra,
})

// The text is deliberately marked provisional. Stable beat and copy keys—not
// these sentences—are the narrative interface owned by mission logic.
export const RECORDS_OFFICE_NARRATIVE: DialogueCue[] = [
  cue('onboarding.01', RECORDS_OFFICE_BEAT_IDS[0], 'ARCHIVIST', '[PROVISIONAL] No ordinary witnesses. No useful camera record.', 'gesture.explain', 'LEFT', { update: { objectiveId: 'UNDERSTAND_THE_RECORD' }, cameraFraming: 'TWO_SHOT' }),
  cue('onboarding.02', RECORDS_OFFICE_BEAT_IDS[1], 'ROOK', '[PROVISIONAL] So the case arrived without a trail.', 'react.confused', 'RIGHT', { reactionOverlay: 'reaction.question' }),
  cue('onboarding.03', RECORDS_OFFICE_BEAT_IDS[2], 'ARCHIVIST', '[PROVISIONAL] The event happened onchain.', 'talk.neutral.closed', 'LEFT'),
  cue('onboarding.04', RECORDS_OFFICE_BEAT_IDS[3], 'ROOK', '[PROVISIONAL] I understand every word except the implication.', 'react.questioning_shrug'),
  cue('onboarding.05', RECORDS_OFFICE_BEAT_IDS[4], 'ARCHIVIST', '[PROVISIONAL] The activity is public. Interpreting it is the difficult part.', 'talk.neutral.closed', 'LEFT'),
  cue('onboarding.06', RECORDS_OFFICE_BEAT_IDS[5], 'ROOK', '[PROVISIONAL] Public evidence. Excellent. Solved by lunch.', 'react.proud', 'RIGHT', { reactionOverlay: 'reaction.sparkle' }),
  cue('onboarding.07', RECORDS_OFFICE_BEAT_IDS[6], 'ARCHIVIST', '[PROVISIONAL] Public is not the same as self-explanatory.', 'react.skeptical', 'LEFT'),
  cue('onboarding.08', RECORDS_OFFICE_BEAT_IDS[7], 'ARCHIVIST', '[PROVISIONAL] This case artifact authorizes the records prepared for this investigation.', 'gesture.present', 'LEFT', { propCue: { family: 'caseAccessArtifact', state: 'recognized' }, cameraFraming: 'PROP' }),
  cue('onboarding.09', RECORDS_OFFICE_BEAT_IDS[8], 'ARCHIVIST', '[PROVISIONAL] Nansen structures the onchain evidence. It does not decide the case or prove offchain intent.', 'talk.emphasis.open', 'LEFT', { cameraFraming: 'EVIDENCE', reducedMotionAnimationId: 'talk.neutral.closed' }),
  cue('onboarding.10', RECORDS_OFFICE_BEAT_IDS[9], 'ROOK', '[PROVISIONAL] Then we read the record before we write the ending.', 'listen.attentive', 'RIGHT', { update: { objectiveId: 'FIND_FIRST_BREACH_RECORD' }, cameraFraming: 'SPEAKER' }),
]

export const UNRESOLVED_LEAD_COPY_KEYS = RECORDS_OFFICE_NARRATIVE.map(({ copyKey }) => copyKey)

export interface DialoguePlaybackState { cueIndex: number; visibleCharacters: number; complete: boolean }

export function createDialoguePlayback(): DialoguePlaybackState { return { cueIndex: 0, visibleCharacters: 0, complete: false } }

export function advanceDialogueInput(state: DialoguePlaybackState, cues: DialogueCue[]) {
  if (state.complete) return state
  const current = cues[state.cueIndex]
  if (!current) return { ...state, complete: true }
  if (state.visibleCharacters < current.provisionalText.length) return { ...state, visibleCharacters: current.provisionalText.length }
  if (state.cueIndex === cues.length - 1) return { cueIndex: state.cueIndex, visibleCharacters: current.provisionalText.length, complete: true }
  return { cueIndex: state.cueIndex + 1, visibleCharacters: 0, complete: false }
}

export function revealDialogueCharacters(state: DialoguePlaybackState, cues: DialogueCue[], count: number) {
  const current = cues[state.cueIndex]
  if (!current || count <= 0) return state
  return { ...state, visibleCharacters: Math.min(current.provisionalText.length, state.visibleCharacters + count) }
}
