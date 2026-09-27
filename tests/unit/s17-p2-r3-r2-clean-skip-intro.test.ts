import { describe, expect, it } from 'vitest'
import { adventureReducer, canSkipOpening, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureAction, AdventureState } from '../../src/adventure/types'
import { bindOpeningStageTimer } from '../../src/app/semanticTimerController'
import { createLiveTimerOwner, type TimerClock } from '../../src/app/useSemanticTimers'
import { PRINCIPAL_OPENING } from '../../src/story/s15r2/principalFeedback'

const LANDING_IDS = ['OPEN-077', 'OPEN-078', 'OPEN-079', 'OPEN-079::2', 'OPEN-079::3', 'OPEN-080']
const LANDING_TEXT = [
  'Take a blank terminal authorization form from the dispenser.',
  'Fill it out COMPLETELY, then bring it back to me.',
  'Until you submit it...',
  'and unless management renders you a favorable response...',
  'do not use the terminal or access the case files.',
  'And DO NOT touch anything else!',
]

const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)

function openingDialogue(display: AdventureState['dialogueDisplay'] = 'FULL') {
  let state = createInitialAdventureState({ dialogue: { mode: 'AUTO', pace: 'NORMAL', display } })
  state = send(state, { type: 'BEGIN_ROOK_ENTRY' })
  state = send(state, { type: 'WALK_TICK', delta: 10_000 })
  expect(state.openingStage).toBe('DIALOGUE')
  expect(state.speech?.lines[0]?.copyKey).toBe('OPEN-001')
  return state
}

function confirm(state: AdventureState) {
  const opened = send(state, { type: 'OPEN_INTRO_SKIP_CONFIRMATION' })
  expect(opened.introSkipConfirmationOpen).toBe(true)
  return send(opened, { type: 'SKIP_OPENING_TO_INSTRUCTIONS' })
}

function manualClock() {
  let now = 0
  let id = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const clock: TimerClock & { advance(ms: number): void } = {
    setInterval(fn, ms) { const next = ++id; timers.set(next, { at: now + ms, fn }); return next },
    clearInterval(key) { timers.delete(key) },
    setTimeout(fn, ms) { const next = ++id; timers.set(next, { at: now + ms, fn }); return next },
    clearTimeout(key) { timers.delete(key) },
    requestAnimationFrame() { return ++id },
    cancelAnimationFrame() { /* visual frames are outside this reducer test */ },
    advance(ms) {
      const end = now + ms
      for (;;) {
        const next = [...timers].sort((left, right) => left[1].at - right[1].at)[0]
        if (!next || next[1].at > end) break
        timers.delete(next[0])
        now = next[1].at
        next[1].fn()
      }
      now = end
    },
  }
  return clock
}

describe('S17-P2-R3-R2 clean production Skip Intro', () => {
  it('keeps eligibility across every effective delivery before OPEN-077, including split identities', () => {
    const opening = openingDialogue('TYPED')
    const lines = opening.speech!.lines
    const landingIndex = lines.findIndex(line => line.copyKey === 'OPEN-077')
    expect(lines).toHaveLength(110)
    expect(landingIndex).toBe(104)
    expect(lines.filter(line => line.sourceCopyKey === 'OPEN-019').map(line => line.copyKey)).toEqual([
      'OPEN-019.delivery-1',
      'OPEN-019.delivery-2',
    ])

    for (let lineIndex = 0; lineIndex < landingIndex; lineIndex += 1) {
      const line = lines[lineIndex]!
      const visibleCharacters = Math.min(7, line.text.length)
      const candidate = { ...opening, speech: { ...opening.speech!, lineIndex, visibleCharacters } }
      expect(canSkipOpening(candidate), `${lineIndex}:${line.copyKey}`).toBe(true)
      const opened = send(candidate, { type: 'OPEN_INTRO_SKIP_CONFIRMATION' })
      expect(opened.introSkipConfirmationOpen, `${line.copyKey}:open`).toBe(true)
      const canceled = send(opened, { type: 'CANCEL_INTRO_SKIP_CONFIRMATION' })
      expect(canceled.speech?.lines[canceled.speech.lineIndex]?.copyKey, `${line.copyKey}:identity`).toBe(line.copyKey)
      expect(canceled.speech?.visibleCharacters, `${line.copyKey}:reveal`).toBe(visibleCharacters)
    }
    for (let lineIndex = landingIndex; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!
      const candidate = { ...opening, speech: { ...opening.speech!, lineIndex } }
      expect(canSkipOpening(candidate), `${lineIndex}:${line.copyKey}`).toBe(false)
    }
    expect(canSkipOpening({ ...opening, speech: { ...opening.speech!, lineIndex: landingIndex } }), 'OPEN-077').toBe(false)
  })

  it('lands every eligible opening stage on exactly the six approved instructions', () => {
    const first = openingDialogue()
    const typed = openingDialogue('TYPED')
    const landingIndex = first.speech!.lines.findIndex(line => line.copyKey === 'OPEN-077')
    const candidates: AdventureState[] = [
      createInitialAdventureState(),
      send(createInitialAdventureState(), { type: 'BEGIN_ROOK_ENTRY' }),
      first,
      { ...typed, speech: { ...typed.speech!, visibleCharacters: 3 } },
      { ...first, speech: { ...first.speech!, lineIndex: Math.floor(landingIndex / 2) } },
      { ...first, speech: { ...first.speech!, lineIndex: landingIndex - 1 } },
    ]
    for (const [candidateIndex, candidate] of candidates.entries()) {
      expect(canSkipOpening(candidate), `candidate ${candidateIndex}`).toBe(true)
      const priorTranscript = candidate.transcript.map(line => line.copyKey)
      const state = confirm(candidate)
      expect(state.speech?.lines.map(line => line.copyKey)).toEqual(LANDING_IDS)
      expect(state.speech?.lines.map(line => line.text)).toEqual(LANDING_TEXT)
      expect(state.transcript.slice(0, -1).map(line => line.copyKey)).toEqual(priorTranscript)
      expect(state.transcript.at(-1)?.copyKey).toBe('OPEN-077')
      expect(state).toMatchObject({
        introComplete: false,
        openingStage: 'DIALOGUE',
        introSkipConfirmationOpen: false,
        introSkipUsed: true,
        phase: 'START',
        authorizationState: 'PENDING',
        inventory: [],
        rookPosition: { x: 228 },
        rookPose: 'IDLE',
        mrIndexPose: 'IDLE',
        walk: null,
        activeSequence: null,
        nonblockingSpeech: null,
        terminalEntryPending: false,
        worldQuiescent: false,
        caseFileDrawer: 'CLOSED',
        miscDrawer: 'CLOSED',
        caseStack: 'UNSEARCHED',
        miscContents: 'UNCOLLECTED',
        investigationMilestone: 'BEFORE_Q1',
        brcgInvestigationState: 'UNREAD',
      })
    }
  })

  it('cancels without changing the exact semantic line or Typed reveal position', () => {
    const opening = openingDialogue('TYPED')
    const partial = { ...opening, speech: { ...opening.speech!, lineIndex: 12, visibleCharacters: 7 } }
    const opened = send(partial, { type: 'OPEN_INTRO_SKIP_CONFIRMATION' })
    const canceled = send(opened, { type: 'CANCEL_INTRO_SKIP_CONFIRMATION' })
    expect(canceled.introSkipConfirmationOpen).toBe(false)
    expect(canceled.openingStage).toBe(partial.openingStage)
    expect(canceled.speech?.lines[canceled.speech.lineIndex]?.copyKey).toBe(partial.speech?.lines[partial.speech.lineIndex]?.copyKey)
    expect(canceled.speech?.visibleCharacters).toBe(7)
    expect(canceled.walk).toStrictEqual(partial.walk)
    expect(canceled.transcript).toStrictEqual(partial.transcript)
  })

  it('blocks reducer input and ignores stale opening callbacks while the modal is open', () => {
    let state = createInitialAdventureState()
    const clock = manualClock()
    const owner = createLiveTimerOwner(clock)
    const dispatch = (action: AdventureAction) => { state = send(state, action) }
    bindOpeningStageTimer(owner, clock, state.openingStage, state.reducedAnimation, false, dispatch)
    state = send(state, { type: 'OPEN_INTRO_SKIP_CONFIRMATION' })
    const frozen = state
    for (const action of [
      { type: 'BEGIN_ROOK_ENTRY' },
      { type: 'WALK_TICK', delta: 9_999 },
      { type: 'REVEAL_TICK', characters: 99 },
      { type: 'ADVANCE_SPEECH' },
      { type: 'SELECT_VERB', verb: 'USE' },
      { type: 'IDLE_TICK', foreground: true },
    ] satisfies AdventureAction[]) expect(send(state, action)).toBe(frozen)
    clock.advance(10_000)
    expect(state).toBe(frozen)

    state = send(state, { type: 'CANCEL_INTRO_SKIP_CONFIRMATION' })
    expect(state.openingStage).toBe('ARTHUR_PAPER')
    bindOpeningStageTimer(owner, clock, state.openingStage, state.reducedAnimation, false, dispatch)
    clock.advance(2_000)
    expect(state.openingStage).toBe('ROOK_ENTERING')
  })

  it('rejects skip at or after OPEN-077, after completion, and after use', () => {
    const opening = openingDialogue()
    const landingIndex = opening.speech!.lines.findIndex(line => line.copyKey === 'OPEN-077')
    for (const lineIndex of [landingIndex, landingIndex + 1, opening.speech!.lines.length - 1]) {
      const candidate = { ...opening, speech: { ...opening.speech!, lineIndex } }
      expect(canSkipOpening(candidate)).toBe(false)
      expect(send(candidate, { type: 'OPEN_INTRO_SKIP_CONFIRMATION' })).toStrictEqual(candidate)
    }
    const completed = createInitialAdventureState({ skipIntro: true })
    expect(canSkipOpening(completed)).toBe(false)
    const skipped = confirm(opening)
    expect(canSkipOpening(skipped)).toBe(false)
  })

  it('completes through the ordinary INTRO owner and RESET restores eligibility', () => {
    let state = confirm(openingDialogue())
    for (const expected of LANDING_IDS) {
      expect(state.speech?.lines[state.speech.lineIndex]?.copyKey).toBe(expected)
      state = send(state, { type: 'ADVANCE_SPEECH' })
    }
    expect(state).toMatchObject({ speech: null, introComplete: true, openingStage: 'COMPLETE' })
    const reset = send(state, { type: 'RESET' })
    expect(reset).toMatchObject({ introComplete: false, openingStage: 'ARTHUR_PAPER', introSkipConfirmationOpen: false, introSkipUsed: false })
    expect(canSkipOpening(reset)).toBe(true)
  })

  it('keeps the Principal source immutable and split deliveries uniquely identified', () => {
    const tail = PRINCIPAL_OPENING.slice(PRINCIPAL_OPENING.findIndex(line => line.copyKey === 'OPEN-077'))
    expect(tail.map(line => line.copyKey)).toEqual(LANDING_IDS)
    expect(new Set(tail.map(line => line.copyKey)).size).toBe(6)
    expect(tail.filter(line => line.sourceCopyKey === 'OPEN-079')).toHaveLength(3)
  })
})
