import type { AdventureState, SpeechLine } from '../adventure/types'
import { routeAnimationPolicyForState } from '../adventure/physicalChoreography'
import { clipById } from '../adventure/animationCues'

export function characterPoseClipId(character: 'ROOK' | 'MR_INDEX', state: AdventureState): string | null {
  if (character === 'ROOK') {
    const route = routeAnimationPolicyForState(state)
    return route?.clipId === 'NONE' ? null : route?.clipId ?? null
  }
  return state.mrIndexPose === 'STAMP' ? 'arthur.stamp' : state.mrIndexPose === 'DOCUMENT' ? 'arthur.document' : state.mrIndexPose === 'RECEIVE' ? 'arthur.receive' : null
}

export function authoredPerformanceClip(line: SpeechLine | null, character: 'ROOK' | 'MR_INDEX', speechActive = false) {
  const actor = character === 'ROOK' ? 'rook' : 'arthur'
  return line?.performanceCues?.find((cue) => {
    const activationReady = cue.activation !== 'AFTER_SPEECH' || !speechActive
    return activationReady && cue.actor === actor && cue.selectedClip && clipById(cue.selectedClip)?.actorId === actor
  })?.selectedClip ?? null
}

/**
 * Identity for the single inspect entrance that belongs to a whole speech
 * delivery. A transcript entry is appended as each line begins, so removing
 * the current line index keeps the identity stable across adjacent bubbles.
 */
export function inspectInteractionDeliveryKey(input: {
  channel: 'blocking' | 'optional'
  transcriptLength: number
  lineIndex: number
  interactionId: string | null
}) {
  return `${input.channel}:${input.transcriptLength - input.lineIndex}:${input.interactionId ?? 'interaction'}`
}

const ROOK_NOTE_PROP_LINES = new Set([
  'r55-da4adaad250b1cc85b01',
  'r55-5c2509bd85ce5b207d9b',
  'r55-cd5c8540f8eb7e6c4c52',
  'r55-b757ba999465d8559bf3',
  'r55-1325b81ac9f2ea385e43',
  'r55-3b040c93c3084e57490d',
  'r55-e2572f71562a8f7e581b',
  'r55-7f897b33d7845947b34e',
  'r55-ab72cdc427578f678bf3',
  'r55-7e50eef016ea5c310099',
  'r55-a587af038cabb880cc5e',
  'r55-03712d5bd06101148df7',
  'r55-03712d5bd06101148df7::2',
  'r55-30df9025aecf70737be1',
])

/** The small note is only visible while Rook is actively reading its two sides. */
export function rookReadsSmallNote(line: SpeechLine | null): boolean {
  return Boolean(line?.copyKey && ROOK_NOTE_PROP_LINES.has(line.copyKey))
}
