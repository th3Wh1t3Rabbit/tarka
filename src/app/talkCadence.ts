export type TalkCadenceActor = 'ROOK' | 'MR_INDEX'

export interface TalkCadence {
  /** Indices into the actor's approved [closed, open] mouth pair. */
  framePattern: readonly (0 | 1)[]
  frameDurationsMs: readonly number[]
}

/**
 * Shared production mouth rhythm. Character personality comes from pose,
 * wording and authored beats—not from making Arthur visibly speak at a slower
 * mechanical rate than Rook.
 */
export const TALK_CADENCES: Record<TalkCadenceActor, TalkCadence> = {
  ROOK: {
    framePattern: [0, 1],
    frameDurationsMs: [125, 125],
  },
  MR_INDEX: {
    framePattern: [0, 1],
    frameDurationsMs: [125, 125],
  },
}

export function talkFrameAtElapsed(actor: TalkCadenceActor, elapsedMs: number) {
  const cadence = TALK_CADENCES[actor]
  const cycleMs = cadence.frameDurationsMs.reduce((total, duration) => total + duration, 0)
  let cursor = Math.max(0, elapsedMs) % cycleMs
  for (let index = 0; index < cadence.frameDurationsMs.length; index += 1) {
    const duration = cadence.frameDurationsMs[index]!
    if (cursor < duration) return cadence.framePattern[index]!
    cursor -= duration
  }
  return cadence.framePattern.at(-1)!
}
