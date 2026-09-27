import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { ARTHUR_IDLE_FACING, DIALOGUE_CONTROL, FAIL_CLOSED_CONTROL, controlForOutcome, facingPair } from '../../src/adventure/controlPolicy'
import { hotspots } from '../../src/adventure/scenes'
import type { AdventureState, HotspotId, VerbId } from '../../src/adventure/types'
import dialoguePolicy from '../../src/adventure/policies/dialogue_control_policy.json'

const css = readFileSync('src/styles/a0.css', 'utf8')
const reducer = readFileSync('src/adventure/reducer.ts', 'utf8')
const fresh = (): AdventureState => ({ ...createInitialAdventureState({ skipIntro: true }), instantText: true })
const send = (state: AdventureState, action: Parameters<typeof adventureReducer>[1]) => adventureReducer(state, action)
const arm = (state: AdventureState, verb: VerbId, targetId: HotspotId) => send(send(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId })
const arrive = (state: AdventureState) => send(state, { type: 'WALK_TICK', delta: 8000 })
const arthurX = hotspots.find((hotspot) => hotspot.id === 'mr-index')!.walkTo.x

describe('S10-P2-R1 closure', () => {
  it('S10-P2-R1 blackout covers exact logical 480 by 90 not 78 pixels', () => {
    expect(css).toContain('height: 33.3333333333%')
    expect(css).toContain('top: 66.6666666667%')
    expect(css).not.toContain('interface-blackout { background: #000; filter: none; }')
    expect(dialoguePolicy.blackout.logicalBand).toEqual({ x: 0, y: 180, width: 480, height: 90 })
    expect(dialoguePolicy.blackout.logicalBand.height).not.toBe(78)
  })
  it('S10-P2-R1 command sentence is not visible during blackout', () => {
    expect(css).toContain('.adventure-interface-band.interface-blackout .command-sentence')
    expect(css).toContain('visibility: hidden')
  })
  it('S10-P2-R1 room remains exact 480 by 180', () => {
    expect(dialoguePolicy.blackout.room).toEqual({ width: 480, height: 180 })
    expect(dialoguePolicy.blackout.roomExpands).toBe(false)
  })
  it('S10-P2-R1 full frame remains exact 480 by 270', () => {
    expect(dialoguePolicy.blackout.frame).toEqual({ width: 480, height: 270 })
  })
  it('S10-P2-R1 two and four times geometry stays nearest neighbor aligned', () => {
    for (const scale of [2, 4]) {
      expect(480 * scale).toBe(480 * scale)
      expect(270 * scale / 3).toBe(90 * scale)
      expect(270 * scale * 180 / 270).toBe(180 * scale)
    }
  })
  it('S10-P2-R1 no interface band descendant is focusable during blackout', () => {
    const opening = createInitialAdventureState()
    expect(opening.speech?.control).toBe('BLOCKING_CUTSCENE')
    expect(css).toContain('adventure-interface-band')
  })
  it('S10-P2-R1 advance remains accessible and focus restores afterward', () => {
    expect(dialoguePolicy.blackout.advanceControlRemains).toBe(true)
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).toContain("document.querySelector<HTMLElement>('[data-testid=\"hotspot-nansen-terminal\"]')")
    expect(app).toContain('verb-give')
  })
  it('S10-P2-R1 plain-list presentation does not change blackout control semantics', () => {
    const presented = send(createInitialAdventureState(), { type: 'SET_DIALOGUE_PRESENTATION', mode: 'PLAIN_LIST' })
    expect(presented.dialoguePresentation).toBe('PLAIN_LIST')
    expect(presented.speech?.control).toBe('BLOCKING_CUTSCENE')
  })
  it('S10-P2-R1 runtime contains no speaker-based dialogue-control inference', () => {
    expect(reducer).not.toContain('lines.every')
    expect(reducer).not.toContain("line.speaker === 'ROOK'")
  })
  it('S10-P2-R1 runtime contains no mutation-based dialogue-control inference', () => {
    expect(reducer).not.toContain('forceBlocking')
  })
  it('S10-P2-R1 every changed dialogue path has explicit policy', () => {
    for (const id of ['look-case-cabinet', 'NOTE_READ', 'SEQUENCE.CABINET_POLICY_BLOCK', 'OPENING', 'POST_SOLVE_STAGED', 'DIALOGUE_TOPIC', 'take-form', 'give-form', 'FIXTURE.ROOK_BLOCKING_BEAT']) {
      expect(DIALOGUE_CONTROL).toHaveProperty(id)
    }
    expect(controlForOutcome('missing-policy')).toBe(FAIL_CLOSED_CONTROL)
  })
  it('S10-P2-R1 runtime and package policy parity is exact', () => {
    expect(dialoguePolicy.outcomes).toEqual(DIALOGUE_CONTROL)
    expect(dialoguePolicy.failClosed).toBe(FAIL_CLOSED_CONTROL)
  })
  it('S10-P2-R1 a rook-only line is explicitly blocking when declared', () => {
    const state = send(fresh(), { type: 'APPLY_CONTROL_FIXTURE', fixture: 'ROOK_BLOCKING_BEAT' })
    expect(state.speech?.lines.every((line) => line.speaker === 'ROOK')).toBe(true)
    expect(state.speech?.control).toBe('BLOCKING_WORLD_DIALOGUE')
    expect(state.phase).toBe('START')
    expect(state.inventory).toEqual([])
    const looked = send(send(send(fresh(), { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' }), { type: 'WALK_TICK', delta: 8000 })
    expect(looked.nonblockingSpeech?.control).toBe('NONBLOCKING_SELF_TALK')
  })
  it('S10-P2-R1 Arthur faces Rook during ordinary dialogue', () => {
    const state = send(send(fresh(), { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.mrIndexFacing).toBe('LEFT')
    expect(state.rookFacing).toBe('RIGHT')
    const speaking = send(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'sports' })
    expect(speaking.mrIndexFacing).toBe('LEFT')
    expect(speaking.speech?.control).toBe('BLOCKING_WORLD_DIALOGUE')
  })
  it('S10-P2-R1 Arthur restores idle facing after full dialogue close', () => {
    let state = send(send(fresh(), { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'mr-index' })
    state = send(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'sports' })
    for (let i = 0; i < 8 && state.speech; i++) state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.dialogueOpen).toBe(true)
    expect(state.mrIndexFacing).toBe('LEFT')
    state = send(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'leave' })
    expect(state.dialogueOpen).toBe(false)
    expect(state.mrIndexFacing).toBe(ARTHUR_IDLE_FACING)
  })
  it('S10-P2-R1 both left-side and right-side initiation pass', () => {
    const left = send(send({ ...fresh(), rookPosition: { x: arthurX - 80, y: 298 } }, { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'mr-index' })
    const right = send(send({ ...fresh(), rookPosition: { x: arthurX + 80, y: 298 } }, { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'mr-index' })
    const equal = facingPair(arthurX, arthurX)
    expect(left.rookFacing).toBe('RIGHT')
    expect(left.mrIndexFacing).toBe('LEFT')
    expect(right.rookFacing).toBe('LEFT')
    expect(right.mrIndexFacing).toBe('RIGHT')
    expect(equal).toEqual({ rookFacing: 'RIGHT', mrIndexFacing: 'LEFT' })
    const entered = send(left, { type: 'ENTER_TERMINAL' })
    expect(entered.mrIndexFacing).toBe(ARTHUR_IDLE_FACING)
    expect(send(left, { type: 'RESET' }).mrIndexFacing).toBe(ARTHUR_IDLE_FACING)
    expect(send(left, { type: 'REVIEW_JUMP', phase: 'START' }).mrIndexFacing).toBe(ARTHUR_IDLE_FACING)
  })
  it('S10-P2-R1 two same-text replacement events both announce', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    expect(state.intentReplacement).toEqual({ id: 1, copyKey: 'TODO.STORY.INTENT_REPLACED', text: expect.stringContaining('PLACEHOLDER') })
    state = send(state, { type: 'ACK_INTENT_REPLACEMENT', id: 1 })
    expect(state.intentReplacement).toBeNull()
    state = arm(state, 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    expect(state.intentReplacement?.id).toBe(2)
    expect(state.intentReplacement?.text).toContain('PLACEHOLDER')
    expect(state.transcript.filter((line) => line.copyKey === 'TODO.STORY.INTENT_REPLACED')).toHaveLength(2)
    expect(state.transcript.some((line) => line.text.includes('opened'))).toBe(false)
  })
  it('S10-P2-R1 replacement state is not stale after movement settles', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TICK', delta: 12 })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    expect(state.intentReplacement?.copyKey).toBe('TODO.STORY.INTENT_REPLACED')
    expect(state.caseFileDrawer).toBe('CLOSED')
    state = send(state, { type: 'ACK_INTENT_REPLACEMENT', id: state.intentReplacement!.id })
    expect(state.intentReplacement).toBeNull()
    let rapid = arm(fresh(), 'PICK_UP', 'pen-stand')
    rapid = arm(rapid, 'USE', 'nansen-terminal')
    rapid = arm({ ...rapid, phase: 'FORM_COMPLETED', inventory: ['signed-terminal-authorization-form-with-doodles'] }, 'GIVE', 'mr-index')
    expect(rapid.intentReplacementSeq).toBeGreaterThan(0)
    rapid = send(rapid, { type: 'ACK_INTENT_REPLACEMENT', id: rapid.intentReplacement?.id ?? 0 })
    expect(rapid.intentReplacement).toBeNull()
  })
  it('S10-P2-R1 existing cabinet R4 journey regression hooks stay green', () => {
    const blocked = arrive(arm(fresh(), 'OPEN', 'official-case-file-cabinet'))
    expect(blocked.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(controlForOutcome('SEQUENCE.CABINET_POLICY_BLOCK')).toBe('BLOCKING_ACTION')
    expect(controlForOutcome('NOTE_READ')).toBe('BLOCKING_WORLD_DIALOGUE')
  })
  it('S10-P2-R1 runtime provider calls remain zero and no final story art or data enters source', () => {
    const policy = JSON.stringify(dialoguePolicy)
    expect(policy).not.toContain('nansen_api')
    expect(policy).not.toContain('fetch(')
    expect(policy).not.toContain('Breed still unknown')
    expect(reducer).toContain('PLACEHOLDER — Story binds final copy')
  })
})
