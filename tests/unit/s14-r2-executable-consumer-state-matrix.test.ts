import { describe, expect, it } from 'vitest'
import projection from '../../src/story/r55/generated/r55-production.json'
import { arthurGuidanceSpeech, arthurItemSpeech, deadEndSpeech, inventorySpeechForState, itemRules, postAuthorizationDirectionSpeech, usefulRules } from '../../src/adventure/content'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { InventoryItemId, SpeechLine } from '../../src/adventure/types'
import { r55SpeechByEvent, r55SpeechBySourceSlice, R55_SOURCE_SLICE_INVENTORY } from '../../src/story/r55/production'

const event = (key: string) => projection.events.find(candidate => candidate.key === key)!
const ids = (lines: readonly SpeechLine[]) => lines.map(line => line.copyKey)
const expected = (key: string) => r55SpeechByEvent(key as Parameters<typeof r55SpeechByEvent>[0]).map(line => line.copyKey)
const expectedSlice = (key: string, index: number) => {
  const slice = R55_SOURCE_SLICE_INVENTORY.find(candidate => candidate.eventKey === key && candidate.startIndex === index)!
  return r55SpeechBySourceSlice(slice.routeId).map(line => line.copyKey)
}
const exact = (key: string, lines: readonly SpeechLine[]) => expect(ids(lines), key).toEqual(expected(key))

describe('S14-R2 executable R55 consumer state matrix', () => {
  it('preserves 163 authority groups and 10 separately authenticated source aliases', () => {
    expect(projection.events).toHaveLength(163)
    expect(projection.sharedEventAliases).toHaveLength(10)
    for (const alias of projection.sharedEventAliases) {
      const aliasEvent = event(alias.eventKey)
      const targetEvent = event(alias.targetEventKey)
      expect(aliasEvent.lines.map(line => [line.speaker, line.text])).toEqual(targetEvent.lines.map(line => [line.speaker, line.text]))
      expect(alias.aliasSourceNodeIds).toEqual(aliasEvent.lines.map(line => line.nodeId))
    }
  })

  it('executes authorization object, item, and postauthorization branches', () => {
    expect(ids([...deadEndSpeech('PICK_UP', 'request-dispenser', null), ...usefulRules.find(rule => rule.id === 'take-pen')!.speech])).toEqual([...expectedSlice('COPY.A1:PICK UP', 0), 'OVR-PEN-01', 'OVR-PEN-02', 'OVR-PEN-03'])
    exact('COPY.A1:PUSH or PULL', deadEndSpeech('PUSH', 'request-dispenser', null))
    exact('COPY.A1:OPEN', deadEndSpeech('OPEN', 'request-dispenser', null))
    exact('COPY.A1:CLOSE', deadEndSpeech('CLOSE', 'request-dispenser', null))
    exact('COPY.A1:USE', deadEndSpeech('USE', 'request-dispenser', null))
    exact('COPY.A1:LOOK AT in world', [...deadEndSpeech('LOOK_AT', 'blank-authorization-form', null), ...deadEndSpeech('LOOK_AT', 'pen-stand', null)])
    exact('COPY.A1:GIVE blank form to Arthur', deadEndSpeech('GIVE', 'mr-index', 'blank-terminal-authorization-form'))
    exact('COPY.A1:USE with an incompatible target', deadEndSpeech('USE', 'coffee-mug', 'loose-feather-pen'))
    exact('COPY.A1:OPEN or CLOSE', deadEndSpeech('OPEN', 'blank-authorization-form', null))
    exact('COPY.A2_A4:A2.1 — Post-authorization direction', postAuthorizationDirectionSpeech('INITIAL'))
    expect(ids(postAuthorizationDirectionSpeech('REMINDER'))).toEqual(expectedSlice('COPY.A2_A4:A2.2 — Optional Arthur reminder', 0))
    expect(ids(postAuthorizationDirectionSpeech('REPEAT'))).toEqual(expectedSlice('COPY.A2_A4:A2.2 — Optional Arthur reminder', 10))
    const initialEuler = expected('COPY.A2_A4:Initial Euler-file recitation')
    expect(ids(usefulRules.find(rule => rule.id === 'pickup-case-stack')!.speech.slice(-initialEuler.length))).toEqual(initialEuler)
  })

  it('executes toolbox, piggy, note, BRCG, and inventory progress branches', () => {
    exact('COPY.A2_A4:`LOOK AT` closed toolbox', inventorySpeechForState('small-toolbox-closed', 'LOOK_AT'))
    exact('COPY.A2_A4:`OPEN` or `USE` toolbox', itemRules.find(rule => rule.id === 'open-toolbox')!.speech)
    exact('COPY.A2_A4:`LOOK AT` open empty toolbox', inventorySpeechForState('small-toolbox-open-empty', 'LOOK_AT'))
    exact('COPY.A2_A4:`LOOK AT HAMMER`', inventorySpeechForState('hammer', 'LOOK_AT'))
    exact('COPY.A2_A4:`LOOK AT SMALL HANDFUL OF DAINTY NAILS`', inventorySpeechForState('nails', 'LOOK_AT'))
    exact('COPY.A2_A4:`LOOK AT PIGGY BANK`', inventorySpeechForState('piggy-bank-intact', 'LOOK_AT'))
    exact('COPY.A2_A4:`TALK TO PIGGY BANK`', inventorySpeechForState('piggy-bank-intact', 'TALK_TO'))
    exact('COPY.INVENTORY:TALK TO', inventorySpeechForState('piggy-bank-intact', 'TALK_TO', { lastInteractionId: 'INTERACTION.ITEM.talk_to-piggy-bank-intact' }))
    exact('COPY.BRCG:OPEN or CLOSE — untested', inventorySpeechForState('fictional-token-note', 'OPEN', { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'UNTESTED' }))
    exact('COPY.BRCG:OPEN or CLOSE — resolved', inventorySpeechForState('fictional-token-note', 'CLOSE', { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'RESOLVED' }))
    exact('COPY.INVENTORY:OPEN or CLOSE — BRCG untested', inventorySpeechForState('fictional-token-note', 'OPEN', { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'UNTESTED', lastInteractionId: 'INTERACTION.ITEM.open-fictional-token-note' }))
    exact('COPY.INVENTORY:OPEN or CLOSE — BRCG resolved', inventorySpeechForState('fictional-token-note', 'CLOSE', { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'RESOLVED', lastInteractionId: 'INTERACTION.ITEM.close-fictional-token-note' }))
    const progress = ['BEFORE_Q1', 'AFTER_Q1', 'AFTER_Q2', 'EXACT_RECEIPT', 'PROOF_COMPLETE'] as const
    const progressKeys = ['COPY.INVENTORY:Before Question 1 is complete', 'COPY.INVENTORY:After Question 1, before Question 2', 'COPY.INVENTORY:After Question 2, before Question 3', 'COPY.INVENTORY:After Question 3, before proof assembly', 'COPY.INVENTORY:Proof complete, case not yet closed']
    progress.forEach((milestone, index) => exact(progressKeys[index]!, inventorySpeechForState('euler-case-file', 'LOOK_AT', { investigationMilestone: milestone, ...(milestone === 'BEFORE_Q1' ? { lastInteractionId: 'INTERACTION.ITEM.look-euler-case-file' } : {}) })))
    exact('COPY.REPEAT:Proof complete, case not yet closed', inventorySpeechForState('euler-case-file', 'LOOK_AT', { investigationMilestone: 'PROOF_COMPLETE', lastInteractionId: 'INTERACTION.ITEM.look-euler-case-file' }))
    const genericUse = ['rubber-band', 'rubiks-cube', 'hammer', 'nails', 'fictional-token-note'].flatMap(itemId => inventorySpeechForState(itemId as InventoryItemId, 'USE', {}, 'approved-stamped-terminal-authorization-form'))
    expect(genericUse.every(line => line.authority === 'FINAL_APPROVED_FALLBACK_CONTRACT' && line.copyKey?.startsWith('FALLBACK.USE.INCOMPATIBLE.V1.'))).toBe(true)
    expect(genericUse.map(line => line.text).join(' ')).not.toMatch(/VHS|videotape|Whatever is inside/i)
    const genericTalk = inventorySpeechForState('rubber-band', 'TALK_TO')
    expect(genericTalk.every(line => line.authority === 'FINAL_APPROVED_FALLBACK_CONTRACT' && line.copyKey?.startsWith('FALLBACK.TALK.INVENTORY.V1.'))).toBe(true)
    exact('COPY.INVENTORY:USE with Case Terminal', deadEndSpeech('USE', 'nansen-terminal', 'sharknado-2-vhs'))
    exact('COPY.INVENTORY:CLOSE after opening', inventorySpeechForState('small-toolbox-open-empty', 'CLOSE'))
  })

  it('executes background object-specific physical and repeat branches', () => {
    expect(ids([...deadEndSpeech('PICK_UP', 'office-globe', null), ...deadEndSpeech('PICK_UP', 'desk-lamp', null), ...deadEndSpeech('PICK_UP', 'coffee-mug', null)])).toEqual([
      ...expectedSlice('COPY.BACKGROUND:PICK UP', 0),
      'S17.REACHABILITY.desk-lamp.PICK_UP.1', 'S17.REACHABILITY.desk-lamp.PICK_UP.2',
      ...expectedSlice('COPY.BACKGROUND:PICK UP', 2),
    ])
    exact('COPY.BACKGROUND:PICK UP / USE', [...deadEndSpeech('PICK_UP', 'wall-city-bridge', null), ...deadEndSpeech('USE', 'wall-records-sign', null), ...deadEndSpeech('PICK_UP', 'wall-not-a-number', null)])
    expect(deadEndSpeech('GIVE', 'wall-preserve', null).map(line => line.text)).toEqual(['It’s not mine to give.'])
    exact('COPY.BACKGROUND:OPEN / PULL', deadEndSpeech('OPEN', 'wall-preserve', null))
    exact('COPY.BACKGROUND:Physical interaction', deadEndSpeech('PUSH', 'window', null))
    exact('COPY.BACKGROUND:PICK UP / USE / OPEN / PUSH / CLOSE / PULL', deadEndSpeech('OPEN', 'book-shelf', null))
    exact('COPY.BACKGROUND:GIVE', deadEndSpeech('GIVE', 'office-globe', null))
    exact('COPY.BACKGROUND:OPEN / CLOSE', deadEndSpeech('OPEN', 'office-globe', null))
    exact('COPY.BACKGROUND:PUSH or PULL', [...deadEndSpeech('PUSH', 'desk-lamp', null), ...deadEndSpeech('PULL', 'coffee-mug', null)])
    exact('COPY.BACKGROUND:PICK UP — after authorization approval', deadEndSpeech('PICK_UP', 'arthur-stamp', null, { ...createInitialAdventureState(), phase: 'COMPLETE' }))
    exact('COPY.BACKGROUND:USE — after approval', deadEndSpeech('USE', 'arthur-stamp', null, { ...createInitialAdventureState(), phase: 'COMPLETE' }))
    exact('COPY.BACKGROUND:USE or `USE BARELY LEGIBLE SIGNED AUTHORIZATION FORM WITH STAMP`', deadEndSpeech('USE', 'arthur-stamp', null, { ...createInitialAdventureState(), phase: 'START' }))
    exact('COPY.REPEAT:LOOK AT', [...deadEndSpeech('LOOK_AT', 'disorderly-stack-of-confidential-files', null, { ...createInitialAdventureState(), caseStack: 'SEARCHED_EULER_REMOVED' }), ...deadEndSpeech('LOOK_AT', 'miscellaneous-catch-all-contents', null, { ...createInitialAdventureState(), miscContents: 'COLLECTED_GUM_REMAINS' })])
  })

  it('executes every Arthur item and milestone branch', () => {
    const itemKeys: Array<[InventoryItemId, string]> = [
      ['euler-case-file', 'COPY.ARTHUR:Euler Case File'], ['loose-feather-pen', 'COPY.ARTHUR:Feather Pen — intact, before form completion'],
      ['rubber-band', 'COPY.ARTHUR:Rubber Band'], ['rubiks-cube', 'COPY.ARTHUR:Rubik’s Cube'], ['sharknado-2-vhs', 'COPY.ARTHUR:Sharknado 2 VHS'],
      ['piggy-bank-intact', 'COPY.ARTHUR:Intact Piggy Bank'], ['small-toolbox-closed', 'COPY.ARTHUR:Do-It-Herself Small Pink Toolbox'],
      ['hammer', 'COPY.ARTHUR:Heavy-Duty Hammer'], ['nails', 'COPY.ARTHUR:Small Handful of Dainty Nails'],
    ]
    itemKeys.forEach(([itemId, key]) => exact(key, arthurItemSpeech(itemId)))
    exact('COPY.ARTHUR:Unread', arthurItemSpeech('fictional-token-note', { piggyNoteReadState: 'UNREAD' }))
    exact('COPY.ARTHUR:Read, BRCG untested', arthurItemSpeech('fictional-token-note', { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'UNTESTED' }))
    exact('COPY.ARTHUR:BRCG resolved', arthurItemSpeech('fictional-token-note', { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'RESOLVED' }))
    const base = { phase: 'COMPLETE' as const, inventory: ['euler-case-file' as const] }
    exact('COPY.ARTHUR:Question 1 complete, Question 2 incomplete', arthurGuidanceSpeech({ ...base, investigationMilestone: 'AFTER_Q1' }))
    exact('COPY.ARTHUR:Question 2 complete, Question 3 incomplete', arthurGuidanceSpeech({ ...base, investigationMilestone: 'AFTER_Q2' }))
    exact('COPY.ARTHUR:Exact receipt found, proof incomplete', arthurGuidanceSpeech({ ...base, investigationMilestone: 'EXACT_RECEIPT' }))
    exact('COPY.ARTHUR:Proof complete, case open', arthurGuidanceSpeech({ ...base, investigationMilestone: 'PROOF_COMPLETE' }))
  })

  it('drives globe speed 1, speed 2, maximum, repeat, and reversal through the reducer without lookup failure', () => {
    let state = { ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true }
    const act = (verb: 'PUSH' | 'PULL') => {
      state = adventureReducer({ ...state, nonblockingSpeech: null }, { type: 'SELECT_VERB', verb })
      state = adventureReducer(state, { type: 'INTERACT', targetId: 'office-globe' })
      for (let guard = 0; state.activeSequence && guard < 20; guard += 1) state = adventureReducer(state, { type: 'ADVANCE_SEQUENCE' })
      return state.nonblockingSpeech!.lines
    }
    exact('COPY.BACKGROUND:First global reach of speed 1', act('PUSH'))
    exact('COPY.BACKGROUND:First global reach of speed 2', act('PUSH'))
    exact('COPY.BACKGROUND:First global reach of maximum speed', act('PUSH'))
    exact('COPY.BACKGROUND:Further compatible acceleration at maximum', act('PUSH'))
    exact('COPY.BACKGROUND:Actual reversal', act('PULL'))
    expect(state.globeLevel).toBe(1)
    expect(state.globePose).toBe('PULL')
  })
})
