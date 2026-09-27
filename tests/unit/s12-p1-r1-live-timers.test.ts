import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { SEMANTIC_TIMERS, VISUAL_ONLY_TIMERS } from '../../src/adventure/semanticTimers'
import type { AdventureAction, AdventureState } from '../../src/adventure/types'
import { bindFocusTimer, bindGlobeTimer, bindIdleTimer, bindReplacementTimer, bindSpeechRevealTimer, bindWalkTimer, type FocusTarget } from '../../src/app/semanticTimerController'
import { createLiveTimerOwner, retainTimerSession, type TimerClock } from '../../src/app/useSemanticTimers'

function manualClock() {
  let now = 0
  let nextId = 1
  let frameId = 1
  const items = new Map<number, { fn: () => void; ms: number; at: number; repeat: boolean }>()
  const animationFrames = new Map<number, () => void>()
  const clock: TimerClock & { advance(ms: number): void; animationFrames: Map<number, () => void> } = {
    setInterval(fn, ms) { const id = nextId++; items.set(id, { fn, ms, at: now + ms, repeat: true }); return id },
    clearInterval(id) { items.delete(id) },
    setTimeout(fn, ms) { const id = nextId++; items.set(id, { fn, ms, at: now + ms, repeat: false }); return id },
    clearTimeout(id) { items.delete(id) },
    animationFrames,
    requestAnimationFrame(fn) { const id = frameId++; animationFrames.set(id, fn); return id },
    cancelAnimationFrame(id) { animationFrames.delete(id) },
    advance(ms) {
      for (const [id, fn] of [...animationFrames]) { animationFrames.delete(id); fn() }
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

function harness() {
  const clock = manualClock()
  const owner = createLiveTimerOwner(clock)
  let state = createInitialAdventureState({ skipIntro: true })
  const dispatch = (action: AdventureAction) => { state = adventureReducer(state, action) }
  return { clock, owner, dispatch, get state() { return state }, set state(next: AdventureState) { state = next } }
}

describe('S12-P1-R1 live semantic timers', () => {
  it('drives walk ticks through the reducer and ignores them after invalidation', () => {
    const run = harness()
    run.dispatch({ type: 'WALK_TO', point: { x: 500, y: 350 } })
    const stop = bindWalkTimer(run.owner, run.clock, run.state.walk, run.state.worldQuiescent, run.dispatch)
    run.clock.advance(40)
    const moved = run.state.rookPosition.x
    expect(moved).toBeGreaterThan(228)
    run.owner.invalidateAll()
    run.clock.advance(400)
    expect(run.state.rookPosition.x).toBe(moved)
    stop()
    const reset = adventureReducer(run.state, { type: 'RESET' })
    expect(reset.lifecycleEpoch).toBe(1)
    expect(reset.walk).toBeNull()
    expect(adventureReducer(run.state, { type: 'REVIEW_JUMP', phase: 'START' }).lifecycleEpoch).toBe(1)
  })

  it('suspends world ticks while the terminal is open and does not revive the old callback', () => {
    const run = harness()
    const hidden = bindIdleTimer(run.owner, run.clock, run.state.worldQuiescent, true, () => true, run.dispatch)
    run.clock.advance(3000)
    expect(run.state.inactiveSeconds).toBe(0)
    hidden()
    run.owner.invalidateAll()
    bindIdleTimer(run.owner, run.clock, run.state.worldQuiescent, false, () => true, run.dispatch)
    run.clock.advance(1000)
    expect(run.state.inactiveSeconds).toBe(1)
  })

  it('lets a newer speech reveal replace the previous one', () => {
    const run = harness()
    run.state = { ...run.state, instantText: false, dialogueDisplay: 'TYPED' }
    run.dispatch({ type: 'APPLY_CONTROL_FIXTURE', fixture: 'ROOK_BLOCKING_BEAT' })
    bindSpeechRevealTimer(run.owner, run.clock, run.state.speech, run.state.nonblockingSpeech, run.state.instantText, run.state.worldQuiescent, run.dispatch, run.state.dialoguePace, run.state.dialogueDisplay)
    bindSpeechRevealTimer(run.owner, run.clock, run.state.speech, run.state.nonblockingSpeech, run.state.instantText, run.state.worldQuiescent, run.dispatch, run.state.dialoguePace, run.state.dialogueDisplay)
    run.clock.advance(124)
    expect(run.state.speech?.visibleCharacters).toBe(0)
    run.clock.advance(1)
    expect(run.state.speech?.visibleCharacters).toBe(3)
  })

  it('does not focus an inert target after a newer transition', () => {
    const run = harness()
    const focused: string[] = []
    const inert: FocusTarget = { focus() { focused.push('inert') }, isConnected: true, closest: () => ({}) }
    const live: FocusTarget = { focus() { focused.push('live') }, isConnected: true, closest: () => null }
    run.state = { ...run.state, speech: { lines: [{ speaker: 'ROOK', text: 'hello', copyKey: 'a' }], lineIndex: 0, visibleCharacters: 5, returnTo: 'SCENE', control: 'BLOCKING_WORLD_DIALOGUE', performance: { intentions: {}, crossedCueIds: [], afterLineHold: false, activeActor: 'ROOK', actor: 'ROOK', copyKey: 'a', reducedMotion: false } } }
    const stop = bindFocusTimer(run.owner, run.clock, run.state.speech, run.state.dialogueOpen, run.state.focusReturnTarget, { query: () => inert, active: () => null }, { current: null }, { current: false })
    stop()
    run.owner.invalidateAll()
    run.state = { ...run.state, speech: null }
    bindFocusTimer(run.owner, run.clock, run.state.speech, run.state.dialogueOpen, run.state.focusReturnTarget, { query: () => live, active: () => null }, { current: live }, { current: true })
    run.clock.advance(20)
    expect(focused).toEqual(['live'])
  })

  it('keeps one timer session and does not cross-cancel a visual frame', () => {
    const first = retainTimerSession()
    const second = retainTimerSession()
    expect(second.owner).toBe(first.owner)
    expect(second.clock).toBe(first.clock)
    const hook = readFileSync('src/app/useSemanticTimers.ts', 'utf8')
    expect(hook).toContain('useState(retainTimerSession)')
    expect(hook).not.toContain('useSemanticTimers(clock: TimerClock = browserTimerClock())')
    const clock = manualClock()
    const owner = createLiveTimerOwner(clock)
    const stop = bindReplacementTimer(owner, clock, 1, false, () => undefined)
    stop()
    expect(owner.activeHandles()).toEqual([])
    const visual = clock.requestAnimationFrame(() => undefined)
    expect(visual).toBe(1)
    owner.invalidateAll()
    expect(clock.animationFrames.has(visual)).toBe(true)
  })

  it('keeps mug steam outside the semantic timer registry', () => {
    expect(VISUAL_ONLY_TIMERS).toContain('MUG_STEAM_FRAME')
    expect(SEMANTIC_TIMERS).not.toContain('MUG_STEAM_FRAME')
    expect(readFileSync('src/app/App.tsx', 'utf8')).toContain('bindWalkTimer')
    expect(readFileSync('src/app/App.tsx', 'utf8')).not.toContain('if (synced !== caseState) setCaseState')
  })

  it('keeps a single globe frame driver alive across in-flight promotion', () => {
    const source = readFileSync('src/app/App.tsx', 'utf8')
    expect(source).toContain('[state.globeMotion, semanticPaused, timers, clock, dispatch]')
    expect(source).not.toContain('[state.globeMotion, state.globeRevision, semanticPaused')

    const run = harness()
    let now = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => (now += 34))
    run.state = { ...run.state, globePose: 'PUSH', globeMotion: 'SPINNING', globeLevel: 1, globeBoostRemainingMs: 5000 }
    const stop = bindGlobeTimer(run.owner, run.clock, run.state, run.dispatch)
    run.clock.advance(34)
    run.clock.advance(34)
    expect(run.state.globeElapsedMs).toBeGreaterThan(0)
    const before = run.state.globeElapsedMs
    run.state = { ...run.state, globeLevel: 2, globeRevision: run.state.globeRevision + 1 }
    run.clock.advance(34)
    expect(run.state.globeElapsedMs).toBeGreaterThan(before)
    expect(run.clock.animationFrames.size).toBe(1)
    stop()
    nowSpy.mockRestore()
  })

  it('recovers a visible mobile globe when the browser strands its animation frame', () => {
    const run = harness()
    let now = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => (now += 50))
    run.state = { ...run.state, globePose: 'PUSH', globeMotion: 'SPINNING', globeLevel: 1, globeBoostRemainingMs: 5000 }
    const stop = bindGlobeTimer(run.owner, run.clock, run.state, run.dispatch)

    // Model the Android symptom: the registered callback disappears without
    // firing, while ordinary foreground timers remain alive.
    run.clock.animationFrames.clear()
    run.clock.advance(250)

    expect(run.state.globeElapsedMs).toBeGreaterThan(0)
    expect(run.clock.animationFrames.size).toBe(1)
    stop()
    expect(run.owner.activeHandles()).toEqual([])
    nowSpy.mockRestore()
  })

  it('restarts exactly one globe driver after a terminal pause', () => {
    const run = harness()
    let now = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => (now += 34))
    run.state = { ...run.state, globePose: 'PUSH', globeMotion: 'SPINNING', globeLevel: 1, globeBoostRemainingMs: 5000 }
    const stopBeforeTerminal = bindGlobeTimer(run.owner, run.clock, run.state, run.dispatch)
    run.clock.advance(34)
    run.clock.advance(34)
    const beforeTerminal = run.state.globeElapsedMs
    expect(beforeTerminal).toBeGreaterThan(0)

    stopBeforeTerminal()
    expect(run.owner.activeHandles()).toEqual([])
    const whileTerminalOpen = bindGlobeTimer(run.owner, run.clock, { ...run.state, worldQuiescent: true }, run.dispatch)
    run.clock.advance(250)
    expect(run.state.globeElapsedMs).toBe(beforeTerminal)
    whileTerminalOpen()

    const stopAfterTerminal = bindGlobeTimer(run.owner, run.clock, { ...run.state, worldQuiescent: false }, run.dispatch)
    run.clock.advance(34)
    run.clock.advance(34)
    expect(run.state.globeElapsedMs).toBeGreaterThan(beforeTerminal)
    expect(run.clock.animationFrames.size).toBe(1)
    expect(run.owner.activeHandles().filter(handle => handle.kind === 'INTERVAL')).toHaveLength(1)
    stopAfterTerminal()
    expect(run.owner.activeHandles()).toEqual([])
    nowSpy.mockRestore()
  })
})
