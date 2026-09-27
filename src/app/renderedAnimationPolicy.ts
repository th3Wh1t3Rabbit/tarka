export type VisualSpeakerOwner = 'ROOK' | 'MR_INDEX' | 'TERMINAL' | 'SYSTEM' | 'NONE'

export interface RenderedAnimationPolicyInput {
  actor: 'ROOK' | 'MR_INDEX'
  speakerOwner: VisualSpeakerOwner
  clipId: string
  frames: readonly string[]
  active: boolean
  loop: boolean
}

export interface RenderedAnimationPolicy {
  identity: string
  frames: string[]
  active: boolean
  loop: boolean
  mouthMode: 'POSE_TALK' | 'POSE_LISTEN' | 'ORDINARY_TALK' | 'NON_SPEECH'
}

const TALKING_POSES = new Set(['arthur.document', 'arthur.point'])

/**
 * The production owner for rendered mouth-frame behavior. Semantic ownership is
 * converted here into the exact frames and loop policy the renderer may use.
 */
export function renderedAnimationPolicy(input: RenderedAnimationPolicyInput): RenderedAnimationPolicy {
  const ownsSpeech = input.speakerOwner === input.actor
  const talkingPose = TALKING_POSES.has(input.clipId)
  const documentPose = input.clipId === 'arthur.document'
  const mouthMode = talkingPose
    ? ownsSpeech ? 'POSE_TALK' : 'POSE_LISTEN'
    : ownsSpeech && input.clipId.endsWith('.talk') ? 'ORDINARY_TALK' : 'NON_SPEECH'
  const documentClosed = input.frames[0]
  const documentOpen = input.frames.at(-1)
  const frames = documentPose
    ? ownsSpeech && documentClosed && documentOpen
      ? [documentClosed, documentClosed, documentOpen, documentClosed, documentClosed]
      : input.frames.slice(0, 1)
    : talkingPose && !ownsSpeech ? input.frames.slice(0, 1) : [...input.frames]
  const loop = documentPose ? ownsSpeech && frames.length > 1 : talkingPose ? ownsSpeech && frames.length > 1 : input.loop
  const active = talkingPose ? loop : input.active
  const identity = [input.actor, input.speakerOwner, input.clipId, mouthMode, active ? 'active' : 'still', loop ? 'loop' : 'hold', frames.join('|')].join('::')
  return { identity, frames, active, loop, mouthMode }
}
