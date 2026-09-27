import type { DialoguePace } from '../adventure/types'

const PACE_SCALE: Record<DialoguePace, number> = {
  FAST: 0.86,
  NORMAL: 1,
  SLOW: 1.15,
}

/**
 * Duration of visible mouth motion for a fully displayed line. This is shorter
 * than the bubble's reading/auto-advance hold: the character finishes speaking,
 * closes their mouth, and the player retains time to read. It is intentionally
 * actor-neutral so Rook and Arthur speak at the same rate.
 */
export function speechMotionWindowMs(text: string, pace: DialoguePace) {
  const natural = Math.round((500 + text.trim().length * 27) * PACE_SCALE[pace])
  return Math.max(650, Math.min(1600, natural))
}
