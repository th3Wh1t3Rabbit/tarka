import type { AdventureAction, AdventureState, DialogueDisplay, DialogueMode, DialoguePace } from '../adventure/types'
import type { LiveTimerOwner, TimerClock } from './useSemanticTimers'
import { dialogueAdvanceDelayMs, dialogueRevealIntervalMs } from '../story/s15r2/principalFeedback'
import { effectiveReadingDisplay, speechShouldReveal } from '../adventure/speechDisplayPolicy'

export interface FocusTarget {
  focus(): void
  isConnected: boolean
  closest(selector: string): unknown
}

export interface FocusPort {
  query(selector: string): FocusTarget | null
  active(): FocusTarget | null
}

function interval(owner: LiveTimerOwner, clock: TimerClock, name: Parameters<LiveTimerOwner['arm']>[0], eventId: string, ms: number, fire: () => void) {
  const token = owner.arm(name, eventId)
  const id = owner.track('INTERVAL', clock.setInterval(() => { if (owner.allow(token)) fire() }, ms))
  return () => { clock.clearInterval(id); owner.release('INTERVAL', id); owner.retire(token) }
}

function timeout(owner: LiveTimerOwner, clock: TimerClock, name: Parameters<LiveTimerOwner['arm']>[0], eventId: string, ms: number, fire: () => void) {
  const token = owner.arm(name, eventId)
  const id = owner.track('TIMEOUT', clock.setTimeout(() => { owner.release('TIMEOUT', id); if (owner.allow(token)) fire() }, ms))
  return () => { clock.clearTimeout(id); owner.release('TIMEOUT', id); owner.retire(token) }
}

export function bindWalkTimer(owner: LiveTimerOwner, clock: TimerClock, walk: AdventureState['walk'], worldQuiescent: boolean, dispatch: (action: AdventureAction) => void) {
  if (!walk || worldQuiescent) return () => undefined
  return interval(owner, clock, 'WALK_TICK', `${walk.from.x}:${walk.to.x}:${walk.segmentIndex}`, 40, () => dispatch({ type: 'WALK_TICK', delta: 12 }))
}

export function bindGlobeTimer(owner: LiveTimerOwner, clock: TimerClock, state: Pick<AdventureState, 'globeMotion' | 'worldQuiescent'>, dispatch: (action: AdventureAction) => void) {
  if (state.globeMotion !== 'SPINNING' || state.worldQuiescent) return () => undefined
  // Keep one live frame driver across in-flight promotion/reversal. Rebinding
  // on every globe revision created a visible one-or-more-frame pause on some
  // mobile browsers immediately after a repeated touch. A small independent
  // watchdog covers the opposite Android failure mode: a visible tab can
  // occasionally strand its requestAnimationFrame chain until another scene
  // transition remounts the timer. The watchdog advances only after two missed
  // frames and uses the same bounded wall-clock accumulator, so it cannot add a
  // second speed source or create a catch-up burst.
  const token = owner.arm('GLOBE_TICK', state.globeMotion)
  const targetFrameMs = 1000 / 30
  const watchdogIntervalMs = 50
  const stalledFrameMs = 90
  let live = true
  let frameId = 0
  let previousAt: number | null = null
  let lastAnimationFrameAt: number | null = null
  let animationFrameStalled = false
  let accumulatedMs = 0
  const now = () => typeof performance === 'undefined' ? Date.now() : performance.now()
  const foreground = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  const schedule = () => {
    frameId = owner.track('ANIMATION_FRAME', clock.requestAnimationFrame(tick))
  }
  const advance = (currentAt: number) => {
    if (!foreground()) {
      previousAt = currentAt
      accumulatedMs = 0
      return
    }
    if (previousAt == null) {
      previousAt = currentAt
      return
    }
    const wallDelta = Math.max(0, currentAt - previousAt)
    previousAt = currentAt
    // A suspended/throttled tab resumes with one normal frame, never a burst.
    accumulatedMs += wallDelta > 250 ? targetFrameMs : Math.min(wallDelta, 50)
    if (accumulatedMs >= targetFrameMs) {
      const deltaMs = Math.round(Math.min(accumulatedMs, 50))
      // Consume exactly what was advanced. Subtracting only one target frame
      // leaves a hidden backlog at 20–25 fps, which later plays too quickly.
      accumulatedMs = Math.max(0, accumulatedMs - deltaMs)
      dispatch({ type: 'GLOBE_TICK', deltaMs })
    }
  }
  const tick = () => {
    owner.release('ANIMATION_FRAME', frameId)
    if (!live || !owner.allow(token)) return
    const currentAt = now()
    lastAnimationFrameAt = currentAt
    animationFrameStalled = false
    advance(currentAt)
    schedule()
  }
  const watchdogId = owner.track('INTERVAL', clock.setInterval(() => {
    if (!live || !owner.allow(token)) return
    const currentAt = now()
    if (!foreground()) {
      previousAt = currentAt
      lastAnimationFrameAt = currentAt
      animationFrameStalled = false
      accumulatedMs = 0
      return
    }
    if (lastAnimationFrameAt == null) lastAnimationFrameAt = currentAt
    if (!animationFrameStalled && currentAt - lastAnimationFrameAt < stalledFrameMs) return
    if (!animationFrameStalled) {
      animationFrameStalled = true
      // Replace a stranded callback once. The watchdog remains authoritative
      // until the replacement frame actually arrives.
      clock.cancelAnimationFrame(frameId)
      owner.release('ANIMATION_FRAME', frameId)
      schedule()
    }
    advance(currentAt)
  }, watchdogIntervalMs))
  schedule()
  return () => {
    live = false
    clock.cancelAnimationFrame(frameId)
    owner.release('ANIMATION_FRAME', frameId)
    clock.clearInterval(watchdogId)
    owner.release('INTERVAL', watchdogId)
    owner.retire(token)
  }
}

export function bindSequenceTimer(owner: LiveTimerOwner, clock: TimerClock, sequence: AdventureState['activeSequence'], reducedAnimation: boolean, worldQuiescent: boolean, dispatch: (action: AdventureAction) => void) {
  if (!sequence || sequence.status === 'WAITING_FOR_SPEECH' || worldQuiescent) return () => undefined
  const isObservableReview = sequence.currentActorIntentions.ARTHUR === 'READ'
  const isObservablePhysicalPose = sequence.id !== 'SEQUENCE.PHYSICAL_CONTACT' && Boolean(sequence.currentPhysicalPoseClass && sequence.currentPhysicalPoseClass !== 'NO_REACH')
  const blockedReachHold = sequence.currentActionId === 'hold-blocked-reach'
  const preserveReachHold = sequence.currentActionId === 'hold-preserve-reach'
  const actionHoldMs = preserveReachHold ? 1000 : blockedReachHold ? 750 : sequence.currentSemanticContact || isObservableReview || isObservablePhysicalPose ? 500 : reducedAnimation ? 80 : 180
  return timeout(owner, clock, 'SEQUENCE_ADVANCE', `${sequence.id}:${sequence.actionIndex}`, actionHoldMs, () => dispatch({ type: 'ADVANCE_SEQUENCE' }))
}

export function bindSpeechRevealTimer(owner: LiveTimerOwner, clock: TimerClock, speech: AdventureState['speech'], nonblocking: AdventureState['nonblockingSpeech'], instantText: boolean, worldQuiescent: boolean, dispatch: (action: AdventureAction) => void, pace: DialoguePace = 'NORMAL', display: DialogueDisplay = 'FULL') {
  if (worldQuiescent || instantText) return () => undefined
  const revealIntervalMs = dialogueRevealIntervalMs(pace)
  const blockingLine = speech?.lines[speech.lineIndex]
  if (speech && blockingLine && speechShouldReveal(blockingLine, display, instantText) && speech.visibleCharacters < blockingLine.text.length) {
    return interval(owner, clock, 'SPEECH_REVEAL', `blocking:${speech.lineIndex}:${blockingLine.copyKey ?? blockingLine.text}:${pace}:${display}`, revealIntervalMs, () => dispatch({ type: 'REVEAL_TICK', characters: 3 }))
  }
  const optionalLine = nonblocking?.lines[nonblocking.lineIndex]
  if (!speech && nonblocking && optionalLine && speechShouldReveal(optionalLine, display, instantText) && nonblocking.visibleCharacters < optionalLine.text.length) {
    return interval(owner, clock, 'SPEECH_REVEAL', `nonblocking:${nonblocking.lineIndex}:${optionalLine.copyKey ?? optionalLine.text}:${pace}:${display}`, revealIntervalMs, () => dispatch({ type: 'REVEAL_TICK', characters: 3, channel: 'NONBLOCKING' }))
  }
  return () => undefined
}

export function bindNonblockingClearTimer(owner: LiveTimerOwner, clock: TimerClock, speech: AdventureState['speech'], nonblocking: AdventureState['nonblockingSpeech'], worldQuiescent: boolean, dispatch: (action: AdventureAction) => void, mode: DialogueMode = 'AUTO', pace: DialoguePace = 'NORMAL', display: DialogueDisplay = 'FULL', instantText = false) {
  if (!nonblocking || speech || worldQuiescent || mode !== 'AUTO') return () => undefined
  const line = nonblocking.lines[nonblocking.lineIndex]
  if (!line || nonblocking.visibleCharacters < line.text.length) return () => undefined
  const effectiveDisplay = effectiveReadingDisplay(line, display, instantText)
  return timeout(owner, clock, 'NONBLOCKING_AUTO_CLEAR', `${nonblocking.lineIndex}:${line.copyKey ?? line.text}:${pace}:${effectiveDisplay}`, dialogueAdvanceDelayMs(line, pace, effectiveDisplay), () => dispatch({ type: 'ADVANCE_SPEECH', channel: 'NONBLOCKING' }))
}

export function bindSceneClearTimer(owner: LiveTimerOwner, clock: TimerClock, speech: AdventureState['speech'], worldQuiescent: boolean, dispatch: (action: AdventureAction) => void, mode: DialogueMode = 'AUTO', pace: DialoguePace = 'NORMAL', display: DialogueDisplay = 'FULL', instantText = false) {
  if (!speech || worldQuiescent || mode !== 'AUTO' || speech.returnTo === 'DIALOGUE' || speech.returnTo === 'INTRO' || speech.lines.some((line) => line.copyKey === 'lane_a.note.front.read')) return () => undefined
  const line = speech.lines[speech.lineIndex]
  if (!line || speech.visibleCharacters < line.text.length) return () => undefined
  const effectiveDisplay = effectiveReadingDisplay(line, display, instantText)
  return timeout(owner, clock, 'SCENE_AUTO_CLEAR', `${speech.lineIndex}:${line.copyKey ?? line.text}:${pace}:${effectiveDisplay}`, dialogueAdvanceDelayMs(line, pace, effectiveDisplay), () => dispatch({ type: 'ADVANCE_SPEECH' }))
}

export function bindOpeningStageTimer(owner: LiveTimerOwner, clock: TimerClock, openingStage: AdventureState['openingStage'], reducedAnimation: boolean, worldQuiescent: boolean, dispatch: (action: AdventureAction) => void) {
  if (openingStage !== 'ARTHUR_PAPER' || worldQuiescent) return () => undefined
  return timeout(owner, clock, 'OPENING_STAGE', openingStage, reducedAnimation ? 200 : 2000, () => dispatch({ type: 'BEGIN_ROOK_ENTRY' }))
}

export function bindDialogueAdvanceTimer(owner: LiveTimerOwner, clock: TimerClock, state: Pick<AdventureState, 'speech' | 'dialogueMode' | 'dialoguePace' | 'dialogueDisplay' | 'instantText' | 'worldQuiescent'>, dispatch: (action: AdventureAction) => void) {
  if (!state.speech || state.dialogueMode !== 'AUTO' || state.worldQuiescent) return () => undefined
  const line = state.speech.lines[state.speech.lineIndex]
  if (!line || state.speech.visibleCharacters < line.text.length) return () => undefined
  const effectiveDisplay = effectiveReadingDisplay(line, state.dialogueDisplay, state.instantText)
  return timeout(owner, clock, 'DIALOGUE_AUTO_ADVANCE', `${state.speech.lineIndex}:${line.copyKey ?? line.text}:${state.dialoguePace}:${effectiveDisplay}`, dialogueAdvanceDelayMs(line, state.dialoguePace, effectiveDisplay), () => dispatch({ type: 'ADVANCE_SPEECH' }))
}

export function bindIdleTimer(owner: LiveTimerOwner, clock: TimerClock, worldQuiescent: boolean, terminalOpen: boolean, foreground: () => boolean, dispatch: (action: AdventureAction) => void) {
  if (worldQuiescent || terminalOpen) return () => undefined
  return interval(owner, clock, 'IDLE_TICK', 'world', 1000, () => dispatch({ type: 'IDLE_TICK', foreground: foreground() && !terminalOpen }))
}

export function bindReplacementTimer(owner: LiveTimerOwner, clock: TimerClock, replacementId: number | undefined, worldQuiescent: boolean, dispatch: (action: AdventureAction) => void) {
  if (replacementId == null || worldQuiescent) return () => undefined
  return timeout(owner, clock, 'REPLACEMENT_ACK', String(replacementId), 0, () => dispatch({ type: 'ACK_INTENT_REPLACEMENT', id: replacementId }))
}

/** Hold the terminal's empty-hand contact pose before replacing the room. */
export function bindTerminalPresentationTimer(owner: LiveTimerOwner, clock: TimerClock, pending: boolean, blocked: boolean, dispatch: (action: AdventureAction) => void) {
  if (!pending || blocked) return () => undefined
  return timeout(owner, clock, 'TERMINAL_PRESENTATION', 'terminal-contact-hold', 750, () => dispatch({ type: 'ACK_TERMINAL_PRESENTATION' }))
}

export function bindFocusTimer(owner: LiveTimerOwner, clock: TimerClock, speech: AdventureState['speech'], dialogueOpen: boolean, focusReturnTarget: AdventureState['focusReturnTarget'], focus: FocusPort, remembered: { current: FocusTarget | null }, hadBlocking: { current: boolean }) {
  const eventId = speech ? `speech:${speech.lineIndex}:${speech.lines[speech.lineIndex]?.copyKey ?? ''}` : 'restore'
  const token = owner.arm('FOCUS_RESTORE', eventId)
  const opening = Boolean(speech && !hadBlocking.current)
  const closing = Boolean(!speech && hadBlocking.current)
  if (opening) remembered.current = focusReturnTarget ? focus.query(`[data-testid="hotspot-${focusReturnTarget}"]`) : focus.active()
  const previous = remembered.current
  const id = owner.track('ANIMATION_FRAME', clock.requestAnimationFrame(() => { owner.release('ANIMATION_FRAME', id)
    if (!owner.allow(token)) return
    const body = typeof document === 'undefined' ? null : document.body
    const usable = (target: FocusTarget | null) => Boolean(target && target !== body && target.isConnected && !target.closest('[inert]'))
    if (opening) {
      const panel = focus.query('[data-testid="speech-panel"]')
      if (usable(panel)) panel!.focus()
    } else if (closing) {
      const dialogue = dialogueOpen ? focus.query('[data-testid^="dialogue-"]') : null
      const target = usable(dialogue) ? dialogue : usable(previous) ? previous : focus.query('[data-testid="hotspot-nansen-terminal"]') ?? focus.query('[data-testid="verb-give"]')
      if (usable(target)) target!.focus()
    }
  }))
  hadBlocking.current = Boolean(speech)
  return () => { clock.cancelAnimationFrame(id); owner.release('ANIMATION_FRAME', id); owner.retire(token) }
}
