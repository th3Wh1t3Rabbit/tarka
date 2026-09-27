import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { interfaceTreatment } from '../../src/adventure/controlPolicy'
import { adventureReducer, createInitialAdventureState, isTalking, revealedSpeaker, speakerTurnOwner, terminalCanOpen, terminalIsAuthorized, terminalIsPowered } from '../../src/adventure/reducer'
import { EMPTY_RUNTIME_SESSION } from '../../src/adventure/runtimeSession'
import type { AdventureAction, AdventureState, SpeechLine, SpeechState } from '../../src/adventure/types'

const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
const productionSession = { ...EMPTY_RUNTIME_SESSION, layoutHash: 's15-r7-production-layout' }
const performance = () => ({ copyKey: null, actor: 'ROOK' as const, crossedCueIds: [], intentions: {}, activeActor: 'ROOK' as const, afterLineHold: false, reducedMotion: false })
const speaking = (lines: SpeechLine[], lineIndex = 0, visibleCharacters = 0): SpeechState => ({ lines, lineIndex, visibleCharacters, returnTo: 'SCENE', control: 'BLOCKING_WORLD_DIALOGUE', performance: performance() })
const observations: unknown[] = []

function observe(testId: string, state: AdventureState) {
  observations.push({
    schema: 'tarka.s15-r7.reducer-stage-observation.v1', testId,
    phase: state.phase, authorizationState: state.authorizationState,
    openingStage: state.openingStage, introComplete: state.introComplete,
    actionId: state.activeSequence?.currentActionId ?? 'SETTLED', status: state.activeSequence?.status ?? 'SETTLED',
    speechStage: state.activeSequence?.waitingSpeechStage ?? null,
    selectedVerb: state.activeSequence?.selectedVerb ?? state.selectedVerb,
    actorIntentions: state.activeSequence?.currentActorIntentions ?? {},
    semanticContact: state.activeSequence?.currentSemanticContact ?? state.lastSemanticContact,
    poseClass: state.activeSequence?.currentPhysicalPoseClass ?? null,
    propOwners: state.activeSequence?.currentPropOwners ?? {},
    inventory: [...state.inventory], sequenceEventCount: state.sequenceEvents.length,
  })
}

afterAll(() => {
  if (process.env.S15_R7_WRITE_RECEIPT !== '1') return
  const directory = resolve('review/s15-r7/RECEIPTS')
  mkdirSync(directory, { recursive: true })
  writeFileSync(resolve(directory, 'REDUCER_STAGE_OBSERVATIONS.ndjson'), `${observations.map(row => JSON.stringify(row)).join('\n')}\n`)
})

function completeSpeech(state: AdventureState) {
  let next = state
  for (let guard = 0; next.speech && guard < 200; guard += 1) {
    next = send(next, { type: 'REVEAL_FULL' })
    next = send(next, { type: 'ADVANCE_SPEECH' })
  }
  expect(next.speech).toBeNull()
  return next
}

function beginFormSequence() {
  const signed = 'signed-terminal-authorization-form-with-doodles' as const
  let state: AdventureState = { ...createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } }), phase: 'FORM_COMPLETED', inventory: [signed, 'broken-feather-pen'] }
  state = send(state, { type: 'SELECT_VERB', verb: 'GIVE' })
  state = send(state, { type: 'SELECT_ITEM', itemId: signed })
  state = send(state, { type: 'INTERACT', targetId: 'mr-index' })
  if (state.walk) state = send(state, { type: 'WALK_TICK', delta: 10_000 })
  return state
}

function advanceTo(state: AdventureState, actionId: string) {
  let next = state
  for (let guard = 0; next.activeSequence?.currentActionId !== actionId && guard < 30; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  expect(next.activeSequence?.currentActionId).toBe(actionId)
  return next
}

describe.sequential('S15-R7 opening, speaker turn, form, and terminal closure', () => {
  it('R7-01 owns BLACKOUT and reducer-level world inertia from the first office frame through intro dismissal', () => {
    let state = createInitialAdventureState({ session: productionSession })
    expect(state.openingStage).toBe('ARTHUR_PAPER')
    expect(interfaceTreatment(state), 'R7_FRAME_ZERO_BLACKOUT').toBe('BLACKOUT')
    const untouched = send(send(state, { type: 'SELECT_VERB', verb: 'PICK_UP' }), { type: 'WALK_TO', point: { x: 500, y: 350 } })
    expect(untouched, 'R7_FRAME_ZERO_WORLD_INERT').toMatchObject({ selectedVerb: null, walk: null, phase: 'START', inventory: [] })
    state = send(state, { type: 'BEGIN_ROOK_ENTRY' })
    expect(state.openingStage).toBe('ROOK_ENTERING')
    expect(interfaceTreatment(state), 'R7_ENTRY_BLACKOUT').toBe('BLACKOUT')
    const entryAttempt = send(send(state, { type: 'SELECT_VERB', verb: 'USE' }), { type: 'INTERACT', targetId: 'desk-lamp' })
    expect(entryAttempt.lampPower, 'R7_ENTRY_WORLD_INERT').toBe('ON')
    expect(entryAttempt.selectedVerb).toBeNull()
    state = send(state, { type: 'WALK_TICK', delta: 10_000 })
    expect(state.openingStage).toBe('DIALOGUE')
    expect(interfaceTreatment(state), 'R7_DIALOGUE_BLACKOUT').toBe('BLACKOUT')
    observe('R7-01-dialogue-blackout', state)
    state = completeSpeech(state)
    expect(state).toMatchObject({ openingStage: 'COMPLETE', introComplete: true })
    expect(interfaceTreatment(state)).toBe('ACTIVE')
  })

  it('R7-02 keeps one speaker-turn mouth owner across full reveal, same-speaker bubbles, transitions, modes, and dismissal', () => {
    const lines: SpeechLine[] = [
      { speaker: 'ROOK', text: 'First.' },
      { speaker: 'ROOK', text: 'Second.' },
      { speaker: 'MR_INDEX', text: 'Third.' },
    ]
    for (const dialogueMode of ['AUTO', 'MANUAL'] as const) {
      let state: AdventureState = { ...createInitialAdventureState({ skipIntro: true }), dialogueMode, speech: speaking(lines) }
      expect(speakerTurnOwner(state)).toBe('ROOK')
      state = send(state, { type: 'REVEAL_FULL' })
      expect(isTalking(state, 'ROOK'), 'R7_FULL_REVEAL_MOUTH_CONTINUES').toBe(true)
      expect(revealedSpeaker(state)).toBe('ROOK')
      state = send(state, { type: 'ADVANCE_SPEECH' })
      expect(state.speech?.lineIndex).toBe(1)
      expect(isTalking(state, 'ROOK'), 'R7_SAME_SPEAKER_MOUTH_CONTINUES').toBe(true)
      expect(isTalking(state, 'MR_INDEX')).toBe(false)
      state = send(state, { type: 'REVEAL_FULL' })
      state = send(state, { type: 'ADVANCE_SPEECH' })
      expect(isTalking(state, 'ROOK'), 'R7_STALE_OUTGOING_SPEAKER_CLEARED').toBe(false)
      expect(isTalking(state, 'MR_INDEX'), 'R7_SPEAKER_TRANSITION_OWNER').toBe(true)
      state = send(state, { type: 'REVEAL_FULL' })
      state = send(state, { type: 'ADVANCE_SPEECH' })
      expect(speakerTurnOwner(state), 'R7_FINAL_DISMISSAL_CLEARS_OWNER').toBe('NONE')
      expect(isTalking(state, 'MR_INDEX')).toBe(false)
    }
  })

  it('R7-03 pauses for review, returns the paper, commits at stamp, and pauses for continuation', () => {
    let state = advanceTo(beginFormSequence(), 'review')
    expect(state.activeSequence, 'R7_REVIEW_DIALOGUE_BEFORE_STAMP').toMatchObject({ status: 'WAITING_FOR_SPEECH', waitingSpeechStage: 'FORM_REVIEW', currentPropOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' }, currentActorIntentions: { ARTHUR: 'READ' } })
    expect(state.speech?.lines.every(line => (line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey) === 'COPY.A1:Review dialogue')).toBe(true)
    expect(new Set(state.speech?.lines.map(line => line.text)).size, 'R7_REVIEW_DIALOGUE_NO_DUPLICATE_REPLAY').toBe(state.speech?.lines.length)
    expect(terminalIsAuthorized(state), 'R7_STAMP_CANNOT_PRECEDE_REVIEW').toBe(false)
    observe('R7-03-review-before-stamp', state)
    state = completeSpeech(state)
    state = advanceTo(state, 'return')
    expect(state.activeSequence?.currentActorIntentions, 'R7_RETURN_DIRECTION_ARTHUR_TO_ROOK').toEqual({ ARTHUR: 'RETURN', ROOK: 'RECEIVE' })
    expect(state.activeSequence?.currentPropOwners).toEqual({ FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' })
    expect(state.inventory).not.toContain('approved-stamped-terminal-authorization-form')
    expect(state.sequenceEvents.filter(event => event.semanticContact === 'CONTACT.FORM_RETURN'), 'R7_FORM_RETURNS_ONCE').toHaveLength(1)
    observe('R7-03-return-before-stamp', state)
    state = advanceTo(state, 'stamp')
    expect(state).toMatchObject({ authorizationState: 'APPROVED', phase: 'COMPLETE', mrIndexPose: 'STAMP' })
    expect(state.activeSequence?.currentPropOwners).toEqual({ FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' })
    expect(state.inventory.filter(item => item === 'approved-stamped-terminal-authorization-form')).toHaveLength(1)
    expect(state.sequenceEvents.filter(event => event.mutationTiming === 'APPROVAL_COMMIT'), 'R7_APPROVAL_COMMITS_ONCE_AT_STAMP').toHaveLength(1)
    observe('R7-03-stamp-commit', state)
    state = advanceTo(state, 'stamp-caption')
    expect(state.activeSequence).toMatchObject({ status: 'WAITING_FOR_SPEECH', waitingSpeechStage: 'POST_STAMP_AUTHORIZATION', currentPropOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } })
    expect(new Set(state.speech?.lines.map(line => line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey))).toEqual(new Set(['COPY.A1:Stamp, return, and authorization', 'COPY.A1:Confidential-files warning and approved continuation']))
    for (const phrase of ['But just for TODAY.', 'Knew the dinosaurs would win you over.', 'They did not.', 'Do not snoop.', 'How much snooping counts as snooping?', 'What if I need another case file?']) {
      expect(state.speech?.lines.filter(line => line.text.includes(phrase)), `R7_POST_STAMP_EXACTLY_ONCE:${phrase}`).toHaveLength(1)
    }
    observe('R7-03-post-stamp-continuation', state)
    state = completeSpeech(state)
    expect(state.activeSequence).toMatchObject({ status: 'ACTION_ACTIVE', currentActionId: 'stamp-caption', waitingSpeechStage: null })
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.activeSequence).toBeNull()
    expect(state.speech).toBeNull()
  })

  it('R7-04 keeps signed and approved forms inventory-only while bounding desk-stamp visibility', () => {
    const app = readFileSync('src/app/App.tsx', 'utf8')
    const css = readFileSync('src/styles/a0.css', 'utf8')
    expect(app, 'R7_NO_LOOSE_FORM_OVERLAY').not.toContain('visible-form-paper')
    expect(app).not.toContain('FormPaperOverlay')
    expect(app).not.toContain('FORM_ART')
    expect(css).not.toContain('.form-paper-overlay')
    const sequenceSource = readFileSync('src/controller/mission/performance.ts', 'utf8')
    expect(sequenceSource).toContain("FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE'")
    expect(sequenceSource, 'R7_DESK_STAMP_RESTORED_AFTER_USE').toContain("speechStage: 'POST_STAMP_AUTHORIZATION', physicalPose: { actor: 'ARTHUR', poseClass: 'IDLE', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' }")
  })

  it('R7-05 obeys the superseding approved-form-return terminal power authority', () => {
    const before = createInitialAdventureState({ skipIntro: true })
    expect(terminalIsPowered(before), 'R9_TERMINAL_OFF_BEFORE_APPROVED_RETURN').toBe(false)
    expect(terminalIsAuthorized(before)).toBe(false)
    expect(terminalCanOpen(before), 'R7_TERMINAL_BLOCKED_BEFORE_AUTHORIZATION').toBe(false)
    let attempt = send(send(before, { type: 'SELECT_VERB', verb: 'USE' }), { type: 'INTERACT', targetId: 'nansen-terminal' })
    if (attempt.walk) attempt = send(attempt, { type: 'WALK_TICK', delta: 10_000 })
    expect(attempt.worldQuiescent).toBe(false)
    expect(attempt.lastSequenceId).toBe('SEQUENCE.TERMINAL_REPRIMAND')
    const after: AdventureState = { ...before, phase: 'COMPLETE', authorizationState: 'APPROVED', inventory: ['approved-stamped-terminal-authorization-form'] }
    expect(terminalIsPowered(after)).toBe(true)
    expect(terminalCanOpen(after), 'R7_TERMINAL_OPENS_AFTER_AUTHORIZATION_RETURN').toBe(true)
    expect(send(after, { type: 'ENTER_TERMINAL' }).worldQuiescent).toBe(true)
  })

  it('R7-06 receipts preserve selected verb, intention, pose, contact, owner, transfer direction, and mutation timing', () => {
    let pickup = createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } })
    pickup = send(send(pickup, { type: 'SELECT_VERB', verb: 'PICK_UP' }), { type: 'INTERACT', targetId: 'blank-authorization-form' })
    if (pickup.walk) pickup = send(pickup, { type: 'WALK_TICK', delta: 10_000 })
    pickup = advanceTo(pickup, 'contact')
    expect(pickup.sequenceEvents.at(-1), 'R7_PICKUP_RECEIPT_NOT_USE').toMatchObject({ actor: 'ROOK', semanticIntention: 'PICK_UP', selectedVerb: 'PICK_UP', poseClass: 'EMPTY_HAND_REACH', semanticContact: 'CONTACT.ITEM.take-form', mutationTiming: 'CONTACT' })
    observe('R7-06-pick-up', pickup)
    const form = advanceTo(beginFormSequence(), 'return')
    const receipt = form.sequenceEvents.find(event => event.semanticContact === 'CONTACT.FORM_RETURN')
    expect(receipt, 'R7_RETURN_RECEIPT_NOT_ROOK_GIVE').toMatchObject({ actor: 'ARTHUR', receiver: 'ROOK', semanticIntention: 'RETURN', receiverIntention: 'RECEIVE', selectedVerb: 'GIVE', poseClass: 'PAPER_REACH', visiblePropOwner: 'ROOK_VISIBLE', mutationTiming: 'RETURN' })
  })
})
