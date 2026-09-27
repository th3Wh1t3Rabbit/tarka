import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { controlClass, interfaceTreatment } from '../../src/adventure/controlPolicy'
import type { AdventureState, HotspotId, VerbId } from '../../src/adventure/types'

const fresh = (): AdventureState => ({ ...createInitialAdventureState({ skipIntro: true }), instantText: true })
const send = (state: AdventureState, type: Parameters<typeof adventureReducer>[1]) => adventureReducer(state, type)
const arm = (state: AdventureState, verb: VerbId, targetId: HotspotId) => send(send(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId })
const arrive = (state: AdventureState) => send(state, { type: 'WALK_TICK', delta: 8000 })

describe('S10-P2 single intent', () => {
  it('S10-P2 floor click replaces a pending drawer walk and the drawer never commits', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    expect(state.walk?.pendingInteraction?.targetId).toBe('official-case-file-cabinet')
    expect(state.activeSequence).toBeNull()
    expect(controlClass(state)).toBe('WALK_PENDING_REPLACEABLE')
    state = send(state, { type: 'WALK_TICK', delta: 20 })
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    expect(state.walk?.pendingInteraction).toBeNull()
    expect(state.intentReplacement?.text).toContain('PLACEHOLDER')
    expect(state.intentReplacement?.id).toBe(1)
    expect(state.transcript.some((line) => line.copyKey === 'TODO.STORY.INTENT_REPLACED' && line.text.includes('opened'))).toBe(false)
    state = arrive(state)
    expect(state.caseFileDrawer).toBe('CLOSED')
    expect(state.lastSemanticContact).not.toBe('CONTACT.CABINET_POLICY_BLOCK')
    expect(state.activeSequence).toBeNull()
  })

  it('S10-P2 LOOK AT the globe replaces a pending drawer and only the globe completes', () => {
    let state = arm(fresh(), 'OPEN', 'miscellaneous-drawer-cabinet')
    state = send(state, { type: 'WALK_TICK', delta: 20 })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    expect(state.caseFileDrawer).toBe('CLOSED')
    expect(state.miscDrawer).toBe('CLOSED')
    expect(state.walk?.pendingInteraction?.verb).toBe('LOOK_AT')
    state = arrive(state)
    expect(state.walk).toBeNull()
    expect(state.nonblockingSpeech).not.toBeNull()
    expect(state.lastInteractionId ?? '').toMatch(/globe|GLOBE|office-globe/i)
    state = arrive(state)
    expect(state.lastSemanticContact).not.toBe('CONTACT.CABINET_POLICY_BLOCK')
    expect(state.miscDrawer).toBe('CLOSED')
  })

  it('S10-P2 pending pen pickup replaced before arrival does not collect the pen', () => {
    let state = arm(fresh(), 'PICK_UP', 'pen-stand')
    state = send(state, { type: 'WALK_TICK', delta: 12 })
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    state = arrive(state)
    expect(state.inventory).not.toContain('loose-feather-pen')
    expect(state.phase).toBe('START')
  })

  it('S10-P2 pending terminal use replaced before arrival does not open the terminal', () => {
    let state = arm(fresh(), 'USE', 'nansen-terminal')
    state = send(state, { type: 'WALK_TICK', delta: 12 })
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    state = arrive(state)
    expect(state.lastSequenceId).not.toBe('SEQUENCE.TERMINAL_REPRIMAND')
    expect(state.phase).toBe('START')
    expect(state.activeSequence).toBeNull()
  })

  it('S10-P2 pending form handoff replaced before arrival does not stamp', () => {
    let state = fresh()
    state = { ...state, phase: 'FORM_COMPLETED', inventory: ['signed-terminal-authorization-form-with-doodles'] }
    state = send(state, { type: 'SELECT_VERB', verb: 'GIVE' })
    state = send(state, { type: 'ACT_ON_ITEM', itemId: 'signed-terminal-authorization-form-with-doodles' })
    state = send(state, { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.walk?.pendingInteraction?.verb).toBe('GIVE')
    expect(state.phase).toBe('FORM_COMPLETED')
    state = send(state, { type: 'WALK_TICK', delta: 12 })
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    state = arrive(state)
    expect(state.phase).toBe('FORM_COMPLETED')
    expect(state.lastSemanticContact).not.toBe('CONTACT.FORM_RETURN')
    expect(state.inventory).toContain('signed-terminal-authorization-form-with-doodles')
  })

  it('S10-P2 rapid commands keep only the final uncommitted intent', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = arm(state, 'PICK_UP', 'pen-stand')
    state = arm(state, 'PICK_UP', 'blank-authorization-form')
    expect(state.walk?.pendingInteraction).toEqual({ verb: 'PICK_UP', targetId: 'blank-authorization-form', itemId: null })
    expect(state.walk?.pendingInteraction && Array.isArray(state.walk.pendingInteraction)).toBe(false)
    state = arrive(state)
    expect(state.inventory).toEqual(['blank-terminal-authorization-form'])
    expect(state.caseFileDrawer).toBe('CLOSED')
    expect(state.inventory).not.toContain('loose-feather-pen')
  })

  it('S10-P2 a superseded pending interaction never fires later', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    const superseded = state.walk?.pendingInteraction
    state = arm(state, 'PICK_UP', 'blank-authorization-form')
    for (let i = 0; i < 6; i++) state = arrive(state)
    expect(superseded?.targetId).toBe('official-case-file-cabinet')
    expect(state.sequenceEvents.some((event) => event.semanticContact === 'CONTACT.CABINET_POLICY_BLOCK')).toBe(false)
    expect(state.caseFileDrawer).toBe('CLOSED')
    expect(state.inventory).toEqual(['blank-terminal-authorization-form'])
  })

  it('S10-P2 a committed cabinet sequence cannot be forked', () => {
    const state = arrive(arm(fresh(), 'OPEN', 'official-case-file-cabinet'))
    expect(state.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(controlClass(state)).toBe('BLOCKING_ACTION')
    expect(interfaceTreatment(state)).toBe('INERT_VISIBLE')
    const forked = send(send(state, { type: 'SELECT_VERB', verb: 'PULL' }), { type: 'INTERACT', targetId: 'miscellaneous-drawer-cabinet' })
    expect(forked.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(forked.miscDrawer).toBe('CLOSED')
    expect(forked.sequenceEvents.filter((event) => event.semanticContact === 'CONTACT.CABINET_POLICY_BLOCK')).toHaveLength(state.sequenceEvents.filter((event) => event.semanticContact === 'CONTACT.CABINET_POLICY_BLOCK').length)
  })

  it('S10-P2 reload reset and review jump cannot resurrect a superseded intent', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = arm(state, 'PULL', 'request-dispenser')
    const reset = send(state, { type: 'RESET' })
    const jumped = send(state, { type: 'REVIEW_JUMP', phase: 'START' })
    for (const next of [reset, jumped]) {
      expect(next.walk).toBeNull()
      expect(next.caseFileDrawer).toBe('CLOSED')
      expect(next.inventory).not.toContain('blank-terminal-authorization-form')
      expect(next.lastSemanticContact).toBeNull()
    }
  })

  it('S10-P2 cabinet lock six pairs stay closed before authorization', () => {
    for (const target of ['official-case-file-cabinet', 'miscellaneous-drawer-cabinet'] as const) {
      for (const verb of ['OPEN', 'USE', 'PULL'] as const) {
        const done = arrive(arm(fresh(), verb, target))
        expect(done.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
        expect(done.caseFileDrawer).toBe('CLOSED')
        expect(done.miscDrawer).toBe('CLOSED')
        expect(done.speech).toBeNull()
      }
    }
  })

  it('S10-P2 mouse touch and keyboard replacement agree', () => {
    const mouse = send(send(arm(fresh(), 'OPEN', 'official-case-file-cabinet'), { type: 'WALK_TICK', delta: 12 }), { type: 'WALK_TO', point: { x: 90, y: 300 } })
    const keyboard = send(send(arm(fresh(), 'OPEN', 'official-case-file-cabinet'), { type: 'WALK_TICK', delta: 12 }), { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    const approached = send(keyboard, { type: 'INTERACT', targetId: 'office-globe' })
    const touched = arrive(approached)
    expect(mouse.walk?.pendingInteraction).toBeNull()
    expect(mouse.caseFileDrawer).toBe('CLOSED')
    expect(touched.miscDrawer).toBe('CLOSED')
    expect(touched.caseFileDrawer).toBe('CLOSED')
    expect(touched.nonblockingSpeech).not.toBeNull()
    expect(touched.lastInteractionId ?? '').toMatch(/globe|GLOBE|office-globe/i)
    expect(mouse.intentReplacement?.text).toBe(keyboard.intentReplacement?.text)
    expect(mouse.intentReplacement?.id).toBe(1)
    expect(keyboard.intentReplacement?.id).toBe(1)
  })
})

describe('S10-P2 policy files', () => {
  it('S10-P2 no final Story copy or production art is introduced', () => {
    const policy = readFileSync('src/adventure/policies/dialogue_control_policy.json', 'utf8')
    const staging = readFileSync('src/adventure/policies/staging_and_facing_policy.json', 'utf8')
    expect(policy).toContain('LATE_BOUND')
    expect(readFileSync('src/adventure/reducer.ts', 'utf8')).toContain('PLACEHOLDER — Story binds final copy')
    expect(policy).toContain('TODO.STORY.POST_SOLVE_DIALOGUE')
    expect(policy + staging).not.toContain('decryption key')
    expect(policy + staging).not.toContain('Breed still unknown')
    expect(staging).toContain('artLayerRequired": false')
  })
})
