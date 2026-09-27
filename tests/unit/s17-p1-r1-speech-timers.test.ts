import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { FULL_TYPEWRITER_EXCEPTION } from '../../src/adventure/speechDisplayPolicy'
import type { AdventureAction, AdventureState, SpeechLine } from '../../src/adventure/types'
import { bindDialogueAdvanceTimer, bindSequenceTimer, bindSpeechRevealTimer, bindTerminalPresentationTimer } from '../../src/app/semanticTimerController'
import { createLiveTimerOwner, type TimerClock } from '../../src/app/useSemanticTimers'
import { dialogueAdvanceDelayMs } from '../../src/story/s15r2/principalFeedback'
import { FINAL_SCRIPT_LINES } from '../../src/story/s17/finalScript'

function manualClock() {
  let now = 0
  let nextId = 1
  const items = new Map<number, { fn: () => void; ms: number; at: number; repeat: boolean }>()
  const clock: TimerClock & { advance(ms: number): void; delays(): number[] } = {
    setInterval(fn, ms) { const id = nextId++; items.set(id, { fn, ms, at: now + ms, repeat: true }); return id },
    clearInterval(id) { items.delete(id) },
    setTimeout(fn, ms) { const id = nextId++; items.set(id, { fn, ms, at: now + ms, repeat: false }); return id },
    clearTimeout(id) { items.delete(id) },
    requestAnimationFrame() { return nextId++ },
    cancelAnimationFrame() { /* no visual frames in these tests */ },
    delays() { return [...items.values()].map(item => item.at - now).sort((a, b) => a - b) },
    advance(ms) {
      const end = now + ms
      for (;;) {
        let soonest: number | null = null
        for (const [id, item] of items) if (soonest == null || item.at < items.get(soonest)!.at) soonest = id
        if (soonest == null || items.get(soonest)!.at > end) break
        const item = items.get(soonest)!
        now = item.at
        if (item.repeat) item.at = now + item.ms
        else items.delete(soonest)
        item.fn()
      }
      now = end
    },
  }
  return clock
}

function harness(dialogueDisplay: AdventureState['dialogueDisplay'] = 'FULL') {
  const clock = manualClock()
  const owner = createLiveTimerOwner(clock)
  let state = createInitialAdventureState({ skipIntro: true, dialogue: { mode: 'AUTO', pace: 'NORMAL', display: dialogueDisplay } })
  const dispatch = (action: AdventureAction) => { state = adventureReducer(state, action) }
  return { clock, owner, dispatch, get state() { return state }, set state(next: AdventureState) { state = next } }
}

function fixture(run: ReturnType<typeof harness>) {
  run.dispatch({ type: 'APPLY_CONTROL_FIXTURE', fixture: 'ROOK_BLOCKING_BEAT' })
  expect(run.state.speech).not.toBeNull()
}

function withLine(state: AdventureState, line: SpeechLine, visibleCharacters: number): AdventureState {
  const prior = state.speech!
  return { ...state, speech: { ...prior, lines: [line], lineIndex: 0, visibleCharacters, performance: { ...prior.performance, copyKey: line.copyKey ?? null } } }
}

describe('S17-P1-R1 speech display timers', () => {
  it('renders ordinary Full lines immediately and creates no reveal interval', () => {
    const run = harness('FULL')
    fixture(run)
    expect(run.state.speech?.visibleCharacters).toBe(run.state.speech?.lines[0]!.text.length)
    bindSpeechRevealTimer(run.owner, run.clock, run.state.speech, null, false, false, run.dispatch, 'NORMAL', 'FULL')
    expect(run.owner.activeHandles()).toEqual([])
  })

  it('reveals Typed at distinct remapped Fast, Normal, and Slow cadences without duplicate intervals', () => {
    const normal = harness('TYPED')
    fixture(normal)
    bindSpeechRevealTimer(normal.owner, normal.clock, normal.state.speech, null, false, false, normal.dispatch, 'NORMAL', 'TYPED')
    bindSpeechRevealTimer(normal.owner, normal.clock, normal.state.speech, null, false, false, normal.dispatch, 'NORMAL', 'TYPED')
    normal.clock.advance(124)
    expect(normal.state.speech?.visibleCharacters).toBe(0)
    normal.clock.advance(1)
    expect(normal.state.speech?.visibleCharacters).toBe(3)

    const fast = harness('TYPED')
    fixture(fast)
    bindSpeechRevealTimer(fast.owner, fast.clock, fast.state.speech, null, false, false, fast.dispatch, 'FAST', 'TYPED')
    fast.clock.advance(99)
    expect(fast.state.speech?.visibleCharacters).toBe(0)
    fast.clock.advance(1)
    expect(fast.state.speech?.visibleCharacters).toBe(3)

    const slow = harness('TYPED')
    fixture(slow)
    bindSpeechRevealTimer(slow.owner, slow.clock, slow.state.speech, null, false, false, slow.dispatch, 'SLOW', 'TYPED')
    slow.clock.advance(149)
    expect(slow.state.speech?.visibleCharacters).toBe(0)
    slow.clock.advance(1)
    expect(slow.state.speech?.visibleCharacters).toBe(3)
  })

  it('keeps exactly the approved Wheeeeeeee line typed in Full mode', () => {
    const line = FINAL_SCRIPT_LINES.find(candidate => candidate.copyKey === FULL_TYPEWRITER_EXCEPTION.copyKey)
    expect(line?.text).toBe(FULL_TYPEWRITER_EXCEPTION.text)
    expect(line?.finalScriptSource?.eventKey).toBe(FULL_TYPEWRITER_EXCEPTION.eventKey)
    const run = harness('FULL')
    fixture(run)
    run.state = withLine(run.state, line!, 0)
    bindSpeechRevealTimer(run.owner, run.clock, run.state.speech, null, false, false, run.dispatch, 'NORMAL', 'FULL')
    expect(run.owner.activeHandles()).toHaveLength(1)
    run.clock.advance(125)
    expect(run.state.speech?.visibleCharacters).toBe(3)

    const lookalike = { ...line!, copyKey: `${line!.copyKey}-lookalike` }
    run.owner.invalidateAll()
    run.state = withLine(run.state, lookalike, lookalike.text.length)
    bindSpeechRevealTimer(run.owner, run.clock, run.state.speech, null, false, false, run.dispatch, 'NORMAL', 'FULL')
    expect(run.owner.activeHandles()).toEqual([])
  })

  it('schedules word-sensitive Full dwell with additive beats across every pace', () => {
    const line: SpeechLine = { speaker: 'ROOK', text: 'A considered sentence with several readable words.', beatBeforeMs: 125, beatAfterMs: 250, copyKey: 'dwell' }
    for (const pace of ['SLOW', 'NORMAL', 'FAST'] as const) {
      const run = harness('FULL')
      fixture(run)
      run.state = { ...withLine(run.state, line, line.text.length), dialoguePace: pace }
      bindDialogueAdvanceTimer(run.owner, run.clock, run.state, run.dispatch)
      expect(run.clock.delays()).toEqual([dialogueAdvanceDelayMs(line, pace, 'FULL')])
      const withoutBeat = dialogueAdvanceDelayMs({ ...line, beatBeforeMs: 0, beatAfterMs: 0 }, pace, 'FULL')
      expect(run.clock.delays()[0]! - withoutBeat).toBe(375)
    }
  })

  it('never auto-advances Manual and retires stale Auto callbacks', () => {
    const manual = harness('FULL')
    fixture(manual)
    manual.state = { ...manual.state, dialogueMode: 'MANUAL' }
    bindDialogueAdvanceTimer(manual.owner, manual.clock, manual.state, manual.dispatch)
    expect(manual.owner.activeHandles()).toEqual([])

    const automatic = harness('FULL')
    fixture(automatic)
    const original = automatic.state.speech
    const stop = bindDialogueAdvanceTimer(automatic.owner, automatic.clock, automatic.state, automatic.dispatch)
    stop()
    automatic.clock.advance(60_000)
    expect(automatic.state.speech).toBe(original)
  })

  it('holds blocked physical contact for 750ms independent of dialogue settings and reduced motion', () => {
    for (const reducedAnimation of [false, true]) {
      const run = harness('FULL')
      run.state = { ...run.state, reducedAnimation }
      run.dispatch({ type: 'SELECT_VERB', verb: 'USE' })
      run.dispatch({ type: 'INTERACT', targetId: 'nansen-terminal' })
      if (run.state.walk) run.dispatch({ type: 'WALK_TICK', delta: 10_000 })
      run.dispatch({ type: 'ADVANCE_SEQUENCE' })
      run.dispatch({ type: 'ADVANCE_SEQUENCE' })
      run.dispatch({ type: 'ADVANCE_SEQUENCE' })
      expect(run.state.activeSequence?.currentActionId).toBe('hold-blocked-reach')
      bindSequenceTimer(run.owner, run.clock, run.state.activeSequence, reducedAnimation, false, run.dispatch)
      expect(run.clock.delays()).toEqual([750])
      run.clock.advance(749)
      expect(run.state.activeSequence?.currentActionId).toBe('hold-blocked-reach')
      run.clock.advance(1)
      expect(run.state.activeSequence?.currentActionId).toBe('reprimand')
    }
  })

  it('holds the authorized terminal reach for 750ms before presentation', () => {
    const run = harness('FULL')
    run.state = { ...run.state, terminalEntryPending: true, worldQuiescent: true, rookPose: 'REACH' }
    bindTerminalPresentationTimer(run.owner, run.clock, true, false, run.dispatch)
    expect(run.clock.delays()).toEqual([750])
    run.clock.advance(749)
    expect(run.state).toMatchObject({ terminalEntryPending: true, rookPose: 'REACH' })
    run.clock.advance(1)
    expect(run.state).toMatchObject({ terminalEntryPending: false, rookPose: 'IDLE', worldQuiescent: true })

    const blocked = harness('FULL')
    bindTerminalPresentationTimer(blocked.owner, blocked.clock, true, true, blocked.dispatch)
    expect(blocked.owner.activeHandles()).toEqual([])
  })

  it('switches Typed to Full mid-line without rewind and keeps explicit instant text authoritative', () => {
    const run = harness('TYPED')
    fixture(run)
    run.dispatch({ type: 'REVEAL_TICK', characters: 3 })
    expect(run.state.speech?.visibleCharacters).toBe(3)
    run.dispatch({ type: 'SET_DIALOGUE_DISPLAY', display: 'FULL' })
    expect(run.state.speech?.visibleCharacters).toBe(run.state.speech?.lines[0]!.text.length)
    run.dispatch({ type: 'SET_DIALOGUE_DISPLAY', display: 'TYPED' })
    expect(run.state.speech?.visibleCharacters).toBe(run.state.speech?.lines[0]!.text.length)

    run.state = { ...run.state, instantText: true, speech: run.state.speech ? { ...run.state.speech, visibleCharacters: run.state.speech.lines[0]!.text.length } : null }
    bindSpeechRevealTimer(run.owner, run.clock, run.state.speech, null, true, false, run.dispatch, 'NORMAL', 'TYPED')
    expect(run.owner.activeHandles()).toEqual([])
  })
})
