/** Local picture playback. These timers must not dispatch game actions. */
export const VISUAL_ONLY_TIMERS = ['MUG_STEAM_FRAME'] as const

export const SEMANTIC_TIMERS = [
  'WALK_TICK',
  'GLOBE_TICK',
  'SEQUENCE_ADVANCE',
  'SPEECH_REVEAL',
  'NONBLOCKING_AUTO_CLEAR',
  'SCENE_AUTO_CLEAR',
  'OPENING_STAGE',
  'DIALOGUE_AUTO_ADVANCE',
  'IDLE_TICK',
  'REPLACEMENT_ACK',
  'FOCUS_RESTORE',
  'TERMINAL_PRESENTATION',
] as const

export type SemanticTimerName = (typeof SEMANTIC_TIMERS)[number]

export interface SemanticTimerToken {
  name: SemanticTimerName
  generation: number
  eventId: string
}

export function nextTimerToken(previous: SemanticTimerToken | null, name: SemanticTimerName, eventId: string): SemanticTimerToken {
  const generation = previous?.name === name ? previous.generation + 1 : 1
  return { name, generation, eventId }
}

/** A callback may run only for the token that is still the current registration. */
export function timerFireAllowed(current: SemanticTimerToken | null, fired: SemanticTimerToken): boolean {
  return current != null && current.name === fired.name && current.generation === fired.generation && current.eventId === fired.eventId
}
