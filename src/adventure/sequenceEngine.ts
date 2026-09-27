import { ARCHIVIST_ANIMATION_IDS, ROOK_ANIMATION_IDS, ROOK_WALK_SEQUENCE, type CharacterAnimationCatalog, type CharacterId, type Facing, type ReactionOverlayId, type SemanticAnimation, type SequenceMode } from './semanticCatalog'

export type MicroLoopId = 'blink' | 'eyebrow' | 'idle_shift' | 'foot_tap' | 'glasses_adjust' | 'head_tilt'

export interface SequenceState {
  characterId: CharacterId
  animationId: string
  frameIndex: number
  elapsedMs: number
  direction: 1 | -1
  facing: Facing
  anchorX: number
  anchorY: number
  held: boolean
  revealingText: boolean
  microLoop: MicroLoopId | null
  overlay: ReactionOverlayId | null
  overlayFrameIndex: number
  overlayElapsedMs: number
  overlayDirection: 1 | -1
  talkEmphasis: boolean
  blinkIndex: number
}

const MICRO_COMPATIBILITY: Record<CharacterId, Partial<Record<string, readonly MicroLoopId[]>>> = {
  rook: {
    'react.annoyed': ['blink', 'foot_tap'],
    'react.confused': ['blink', 'eyebrow'],
    'listen.attentive': ['blink', 'head_tilt'],
    'idle.neutral': ['blink', 'idle_shift'],
  },
  archivist: {
    'react.skeptical': ['blink', 'eyebrow'],
    'listen.attentive': ['blink', 'head_tilt'],
    'idle.neutral': ['blink', 'glasses_adjust', 'idle_shift'],
  },
}

export function microLoopAllowed(characterId: CharacterId, animationId: string, microLoop: MicroLoopId) {
  if (animationId.startsWith('walk.') && microLoop === 'foot_tap') return false
  return MICRO_COMPATIBILITY[characterId][animationId]?.includes(microLoop) ?? false
}

export function createSequenceState(characterId: CharacterId, animationId = 'idle.neutral', facing: Facing = 'RIGHT'): SequenceState {
  return { characterId, animationId, frameIndex: 0, elapsedMs: 0, direction: 1, facing, anchorX: 0, anchorY: 0, held: false, revealingText: false, microLoop: null, overlay: null, overlayFrameIndex: 0, overlayElapsedMs: 0, overlayDirection: 1, talkEmphasis: animationId.startsWith('talk.emphasis'), blinkIndex: 0 }
}

function advanceIndex(mode: SequenceMode, length: number, frameIndex: number, direction: 1 | -1) {
  if (length <= 1) return { frameIndex, direction }
  let nextIndex = frameIndex + direction
  let nextDirection = direction
  if (mode === 'PING_PONG' && (nextIndex >= length || nextIndex < 0)) {
    nextDirection = direction === 1 ? -1 : 1
    nextIndex = frameIndex + nextDirection
  } else if (nextIndex >= length) {
    nextIndex = mode === 'LOOP' ? 0 : length - 1
  }
  return { frameIndex: nextIndex, direction: nextDirection }
}

function frameAdvance(sequence: SemanticAnimation, state: SequenceState) {
  const { frameIndex, direction } = advanceIndex(sequence.mode, sequence.frames.length, state.frameIndex, state.direction)
  return { ...state, frameIndex, direction }
}

export function tickSequence(state: SequenceState, sequence: SemanticAnimation, deltaMs: number, reducedMotion = false): SequenceState {
  if (sequence.id.startsWith('talk.') && !state.revealingText) return { ...state, frameIndex: 0, elapsedMs: 0 }
  if (reducedMotion || deltaMs <= 0) return state
  let next = { ...state, elapsedMs: state.elapsedMs + deltaMs }
  let duration = sequence.frames[next.frameIndex]?.durationMs ?? 1
  while (next.elapsedMs >= duration) {
    next = { ...frameAdvance(sequence, next), elapsedMs: next.elapsedMs - duration }
    duration = sequence.frames[next.frameIndex]?.durationMs ?? 1
    if ((sequence.mode === 'ONCE' || sequence.mode === 'HOLD_LAST') && next.frameIndex === sequence.frames.length - 1) break
  }
  return next
}

export function cancelSequence(state: SequenceState, idleId = 'idle.neutral'): SequenceState {
  return { ...state, animationId: idleId, frameIndex: 0, elapsedMs: 0, direction: 1, held: false, revealingText: false, microLoop: null, overlay: null, overlayFrameIndex: 0, overlayElapsedMs: 0, overlayDirection: 1, talkEmphasis: false }
}

export function completeSequence(state: SequenceState, sequence: SemanticAnimation): SequenceState {
  if (state.held || sequence.returnTo === null) return state
  return cancelSequence(state, sequence.returnTo)
}

export function requestAnimation(state: SequenceState, current: SemanticAnimation, requested: SemanticAnimation, options: { held?: boolean; facing?: Facing } = {}): SequenceState {
  const allowedIds: readonly string[] = state.characterId === 'rook' ? ROOK_ANIMATION_IDS : ARCHIVIST_ANIMATION_IDS
  if (!allowedIds.includes(requested.id)) return state
  if (requested.priority < current.priority && state.held) return state
  if (options.facing === 'FRONT' && !requested.frontFacing) return state
  if (options.facing && options.facing !== requested.sourceFacing && !requested.mirrorHorizontal) return state
  return { ...state, animationId: requested.id, frameIndex: 0, elapsedMs: 0, direction: 1, held: options.held ?? false, facing: options.facing ?? state.facing, microLoop: null, talkEmphasis: requested.id.startsWith('talk.emphasis') }
}

export function talkFrameId(state: SequenceState, emphasis = false) {
  if (!state.revealingText) return 'talk.neutral.closed'
  const open = Math.floor(state.elapsedMs / 150) % 2 === 1
  if (emphasis) return open ? 'talk.emphasis.open' : 'talk.emphasis.closed'
  return open ? 'talk.neutral.open' : 'talk.neutral.closed'
}

export function setTextReveal(state: SequenceState, revealing: boolean) {
  const talkId = state.animationId.startsWith('talk.')
  return { ...state, revealingText: revealing, frameIndex: talkId && !revealing ? 0 : state.frameIndex }
}

export function attachMicroLoop(state: SequenceState, microLoop: MicroLoopId) {
  return microLoopAllowed(state.characterId, state.animationId, microLoop) ? { ...state, microLoop } : state
}

export function attachOverlay(state: SequenceState, overlay: ReactionOverlayId | null) {
  return { ...state, overlay, overlayFrameIndex: 0, overlayElapsedMs: 0, overlayDirection: 1 as const }
}

function tickOverlay(state: SequenceState, catalog: CharacterAnimationCatalog, deltaMs: number) {
  if (!state.overlay) return state
  const overlay = catalog.overlays[state.overlay]
  if (!overlay || overlay.frames.length <= 1) return state
  let next = { ...state, overlayElapsedMs: state.overlayElapsedMs + deltaMs }
  let duration = overlay.frames[next.overlayFrameIndex]?.durationMs ?? 1
  while (next.overlayElapsedMs >= duration) {
    const advanced = advanceIndex(overlay.mode, overlay.frames.length, next.overlayFrameIndex, next.overlayDirection)
    next = { ...next, overlayFrameIndex: advanced.frameIndex, overlayDirection: advanced.direction, overlayElapsedMs: next.overlayElapsedMs - duration }
    duration = overlay.frames[next.overlayFrameIndex]?.durationMs ?? 1
    if ((overlay.mode === 'ONCE' || overlay.mode === 'HOLD_LAST') && next.overlayFrameIndex === overlay.frames.length - 1) break
  }
  return next
}

/** Advances catalog-level semantic phases as well as frames within one phase. */
export function tickSemanticPlayback(state: SequenceState, catalog: CharacterAnimationCatalog, deltaMs: number, reducedMotion = false): SequenceState {
  if (reducedMotion || deltaMs <= 0) return state
  let next: SequenceState
  const entries = catalog.characters[state.characterId] as Record<string, SemanticAnimation>
  if (state.animationId.startsWith('talk.')) {
    next = { ...state, elapsedMs: state.revealingText ? state.elapsedMs + deltaMs : 0, frameIndex: 0 }
    const requestedId = talkFrameId(next, state.talkEmphasis)
    const fallbackId = requestedId.endsWith('.open') ? 'talk.neutral.open' : 'talk.neutral.closed'
    next.animationId = entries[requestedId]?.frames.length ? requestedId : fallbackId
  } else if (state.characterId === 'rook' && ROOK_WALK_SEQUENCE.includes(state.animationId as typeof ROOK_WALK_SEQUENCE[number])) {
    next = { ...state, elapsedMs: state.elapsedMs + deltaMs, frameIndex: 0 }
    let sequence = entries[next.animationId]!
    let duration = sequence.frames[0]?.durationMs ?? 1
    while (next.elapsedMs >= duration) {
      const index = ROOK_WALK_SEQUENCE.indexOf(next.animationId as typeof ROOK_WALK_SEQUENCE[number])
      next = { ...next, animationId: ROOK_WALK_SEQUENCE[(index + 1) % ROOK_WALK_SEQUENCE.length]!, elapsedMs: next.elapsedMs - duration }
      sequence = entries[next.animationId]!
      duration = sequence.frames[0]?.durationMs ?? 1
    }
  } else {
    next = tickSequence(state, sequenceFor(catalog, state), deltaMs)
  }
  return tickOverlay(next, catalog, deltaMs)
}

export function deterministicBlinkAt(seed: number, blinkIndex: number) {
  // Integer-only LCG: stable across browsers and independent of wall-clock time.
  const value = (Math.imul((seed ^ blinkIndex) >>> 0, 1664525) + 1013904223) >>> 0
  return 2200 + (value % 2600)
}

export function mirrorTransform(state: SequenceState, sequence: SemanticAnimation) {
  return state.facing === 'LEFT' && sequence.mirrorHorizontal ? 'scaleX(-1)' : 'none'
}

export function sequenceFor(catalog: CharacterAnimationCatalog, state: SequenceState) {
  const entries = catalog.characters[state.characterId] as Record<string, SemanticAnimation>
  return entries[state.animationId] ?? entries['idle.neutral']!
}
