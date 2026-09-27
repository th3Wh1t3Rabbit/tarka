import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { controlClass, interfaceTreatment } from '../../src/adventure/controlPolicy'
import type { AdventureState, HotspotId, VerbId } from '../../src/adventure/types'

const reducerSource = readFileSync('src/adventure/reducer.ts', 'utf8')
const policySource = readFileSync('src/adventure/controlPolicy.ts', 'utf8')
const fresh = (): AdventureState => ({ ...createInitialAdventureState({ skipIntro: true }), instantText: true })
const send = (state: AdventureState, action: Parameters<typeof adventureReducer>[1]) => adventureReducer(state, action)
const arm = (state: AdventureState, verb: VerbId, targetId: HotspotId) => send(send(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId })
const ack = (state: AdventureState) => send(state, { type: 'ACK_INTENT_REPLACEMENT', id: state.intentReplacement?.id ?? -1 })
const replaced = (state: AdventureState) => state.transcript.filter((line) => line.copyKey === 'TODO.STORY.INTENT_REPLACED')

describe('S10-P2-R2 replacement events', () => {
  it('S10-P2-R2 drawer to floor event mounts, announces, and clears by matching ACK', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    expect(state.intentReplacement).toMatchObject({ id: 1, copyKey: 'TODO.STORY.INTENT_REPLACED' })
    expect(state.walk?.pendingInteraction).toBeNull()
    expect(replaced(state)).toHaveLength(1)
    state = ack(state)
    expect(state.intentReplacement).toBeNull()
    expect(state.caseFileDrawer).toBe('CLOSED')
  })

  it('S10-P2-R2 drawer to globe event mounts before the globe result and clears afterward', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TICK', delta: 12 })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    expect(state.intentReplacement?.id).toBe(1)
    expect(state.walk?.pendingInteraction?.verb).toBe('LOOK_AT')
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.nonblockingSpeech).not.toBeNull()
    expect(replaced(state)).toHaveLength(1)
    expect(state.transcript.some((line) => line.copyKey !== 'TODO.STORY.INTENT_REPLACED' && line.text.length > 0)).toBe(true)
    expect(state.caseFileDrawer).toBe('CLOSED')
    state = ack(state)
    expect(state.intentReplacement).toBeNull()
    expect(state.nonblockingSpeech).not.toBeNull()
  })

  it('S10-P2-R2 drawer to Arthur event mounts and does not remain through the dialogue', () => {
    let state = arm(fresh(), 'PULL', 'request-dispenser')
    state = send(send(state, { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.intentReplacement?.id).toBe(1)
    expect(state.dialogueOpen).toBe(true)
    expect(state.mrIndexFacing).toBe('LEFT')
    expect(state.walk).toBeNull()
    state = ack(state)
    expect(state.intentReplacement).toBeNull()
    expect(state.dialogueOpen).toBe(true)
    state = send(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'leave' })
    expect(state.dialogueOpen).toBe(false)
    expect(state.intentReplacement).toBeNull()
    expect(state.mrIndexFacing).toBe('RIGHT')
    expect(state.inventory).not.toContain('blank-terminal-authorization-form')
  })

  it('S10-P2-R2 two same-text remote LOOK replacement events both announce', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(send(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    const first = state.intentReplacement?.text
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    state = ack(state)
    state = arm(state, 'OPEN', 'miscellaneous-drawer-cabinet')
    state = send(send(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'historical-clock' })
    expect(state.intentReplacement?.id).toBe(2)
    expect(state.intentReplacement?.text).toBe(first)
    expect(replaced(state)).toHaveLength(2)
    expect(state.caseFileDrawer).toBe('CLOSED')
    expect(state.miscDrawer).toBe('CLOSED')
  })

  it('S10-P2-R2 rapid pen to terminal to form events use increasing ids', () => {
    let state = arm(fresh(), 'PICK_UP', 'pen-stand')
    state = arm(state, 'USE', 'nansen-terminal')
    expect(state.intentReplacement?.id).toBe(1)
    state = { ...state, phase: 'FORM_COMPLETED', inventory: ['signed-terminal-authorization-form-with-doodles'] }
    state = send(state, { type: 'SELECT_VERB', verb: 'GIVE' })
    state = send(state, { type: 'ACT_ON_ITEM', itemId: 'signed-terminal-authorization-form-with-doodles' })
    state = send(state, { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.intentReplacement?.id).toBe(2)
    expect(state.intentReplacement?.id).toBeGreaterThan(1)
    expect(state.phase).toBe('FORM_COMPLETED')
    expect(replaced(state).every((line) => !line.text.includes('collected') && !line.text.includes('opened'))).toBe(true)
  })

  it('S10-P2-R2 stale ACK for id N cannot clear current id N+1', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TO', point: { x: 90, y: 300 } })
    state = arm(state, 'OPEN', 'miscellaneous-drawer-cabinet')
    state = send(state, { type: 'WALK_TO', point: { x: 100, y: 300 } })
    expect(state.intentReplacement?.id).toBe(2)
    state = send(state, { type: 'ACK_INTENT_REPLACEMENT', id: 1 })
    expect(state.intentReplacement?.id).toBe(2)
    state = send(state, { type: 'ACK_INTENT_REPLACEMENT', id: 2 })
    expect(state.intentReplacement).toBeNull()
  })

  it('S10-P2-R2 reset and review jump clear the mounted event', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    expect(state.intentReplacement?.id).toBe(1)
    expect(send(state, { type: 'RESET' }).intentReplacement).toBeNull()
    expect(send(state, { type: 'REVIEW_JUMP', phase: 'START' }).intentReplacement).toBeNull()
    expect(send(state, { type: 'RESET' }).walk).toBeNull()
    expect(send(state, { type: 'RESET' }).caseFileDrawer).toBe('CLOSED')
  })

  it('S10-P2-R2 transcript retains one event per replacement and never says the old action completed', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = arm(state, 'PULL', 'request-dispenser')
    state = arm(state, 'OPEN', 'miscellaneous-drawer-cabinet')
    expect(replaced(state)).toHaveLength(2)
    expect(replaced(state).every((line) => line.copyKey === 'TODO.STORY.INTENT_REPLACED' && line.text.includes('PLACEHOLDER') && !line.text.includes('opened'))).toBe(true)
  })

  it('S10-P2-R2 plain-list observes the same event ids and outcomes', () => {
    let state = send(fresh(), { type: 'SET_DIALOGUE_PRESENTATION', mode: 'PLAIN_LIST' })
    state = arm(state, 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    expect(state.dialoguePresentation).toBe('PLAIN_LIST')
    expect(state.intentReplacement?.id).toBe(1)
    expect(state.intentReplacement?.copyKey).toBe('TODO.STORY.INTENT_REPLACED')
  })

  it('S10-P2-R2 no create-and-clear-in-one-reducer-action path remains', () => {
    expect(reducerSource).not.toContain('intentReplacement: null,\n      nonblockingSpeech')
    const created = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    const looked = send(send(created, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    expect(looked.intentReplacement).not.toBeNull()
  })

  it('S10-P2-R2 no replacement event persists after acknowledged settlement', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    state = ack(state)
    expect(state.intentReplacement).toBeNull()
    expect(replaced(state)).toHaveLength(1)
  })

  it('S10-P2-R2 returnTo INTRO is absent as a control heuristic', () => {
    expect(policySource).not.toContain("returnTo === 'INTRO'")
    const opening = createInitialAdventureState()
    expect(opening.speech?.control).toBe('BLOCKING_CUTSCENE')
    expect(controlClass(opening)).toBe('BLOCKING_CUTSCENE')
    expect(interfaceTreatment(opening)).toBe('BLACKOUT')
    const overridden = {
      ...fresh(),
      speech: { ...opening.speech!, returnTo: 'INTRO' as const, control: 'BLOCKING_WORLD_DIALOGUE' as const },
    }
    expect(controlClass(overridden)).toBe('BLOCKING_WORLD_DIALOGUE')
    expect(interfaceTreatment(overridden)).not.toBe('BLACKOUT')
  })

  it('S10-P2-R2 opening remains explicit BLOCKING_CUTSCENE and BLACKOUT', () => {
    const opening = createInitialAdventureState()
    expect(controlClass(opening)).toBe('BLOCKING_CUTSCENE')
    expect(interfaceTreatment(opening)).toBe('BLACKOUT')
  })

  it('S10-P2-R2 full 480 by 90 geometry remains green', () => {
    const css = readFileSync('src/styles/a0.css', 'utf8')
    expect(css).toContain('adventure-interface-band')
    expect(css).toContain('height: 33.3333333333%')
    expect(css).toContain('top: 66.6666666667%')
  })

  it('S10-P2-R2 explicit policy parity remains green', async () => {
    const { DIALOGUE_CONTROL, FAIL_CLOSED_CONTROL } = await import('../../src/adventure/controlPolicy')
    const policy = JSON.parse(readFileSync('src/adventure/policies/dialogue_control_policy.json', 'utf8'))
    expect(policy.outcomes).toEqual(DIALOGUE_CONTROL)
    expect(policy.failClosed).toBe(FAIL_CLOSED_CONTROL)
  })

  it('S10-P2-R2 Arthur facing lifecycle remains green', () => {
    let state = send(send(fresh(), { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.rookFacing).toBe('RIGHT')
    expect(state.mrIndexFacing).toBe('LEFT')
    state = send(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'leave' })
    expect(state.mrIndexFacing).toBe('RIGHT')
  })

  it('S10-P2-R2 cabinet R4 and journey regression hooks remain green', () => {
    const state = send(arm(fresh(), 'OPEN', 'official-case-file-cabinet'), { type: 'WALK_TICK', delta: 8000 })
    expect(state.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(state.caseFileDrawer).toBe('CLOSED')
  })

  it('S10-P2-R2 runtime provider calls remain zero', () => {
    const policy = readFileSync('src/adventure/policies/dialogue_control_policy.json', 'utf8')
    expect(policy).not.toContain('nansen_api')
    expect(policy).not.toContain('fetch(')
  })

  it('S10-P2-R2 no data art final story copy ref or release effect occurs', () => {
    expect(readFileSync('src/adventure/controlPolicy.ts', 'utf8')).toContain('PLACEHOLDER — Story binds final copy')
    expect(readFileSync('src/adventure/controlPolicy.ts', 'utf8')).not.toContain('Breed still unknown')
  })
})
