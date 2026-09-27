import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { HotspotId, InventoryItemId, VerbId } from '../../src/adventure/types'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { createInvestigationState, exportLocalSave, investigationReducer, restoreInvestigation, terminalCapabilities } from '../../src/investigation/state'
import { SIDE_LEAD_HIGH_LEVEL_VIEW, SIDE_LEAD_TECHNICAL_VIEW, SIDE_LEAD_TOKENS } from '../../src/investigation/sideLead'

const base = 'public/scenarios/euler-2023-false-exit/'
const frozen = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json', 'utf8')), JSON.parse(readFileSync(base + 'evidence-graph.json', 'utf8')))

type Office = ReturnType<typeof createInitialAdventureState>
const fresh = (): Office => ({ ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true, instantText: true })
const drain = (state: Office): Office => {
  let s = state
  for (let i = 0; i < 40 && s.activeSequence; i++) s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
  for (let i = 0; i < 40 && s.speech; i++) { s = adventureReducer(s, { type: 'REVEAL_FULL' }); s = adventureReducer(s, { type: 'ADVANCE_SPEECH' }) }
  return s
}
const doVerb = (s: Office, verb: VerbId, targetId: HotspotId, itemId?: InventoryItemId): Office => {
  const shells = targetId === 'official-case-file-cabinet' || targetId === 'miscellaneous-drawer-cabinet'
  const base = shells && s.phase !== 'COMPLETE' ? { ...s, phase: 'COMPLETE' as const } : s
  let x = adventureReducer(base, { type: 'SELECT_VERB', verb })
  if (itemId) x = adventureReducer(x, { type: 'SELECT_ITEM', itemId })
  return drain(adventureReducer(x, { type: 'INTERACT', targetId }))
}
const actOn = (s: Office, verb: VerbId, itemId: InventoryItemId): Office => drain(adventureReducer(adventureReducer(s, { type: 'SELECT_VERB', verb }), { type: 'ACT_ON_ITEM', itemId }))
const lookNote = (s: Office): Office => adventureReducer(adventureReducer(s, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'ACT_ON_ITEM', itemId: 'fictional-token-note' })
const stepSpeech = (s: Office): Office => adventureReducer(s, { type: 'ADVANCE_SPEECH' })
const combine = (s: Office, first: InventoryItemId, second: InventoryItemId): Office => {
  let x = adventureReducer(s, { type: 'SELECT_VERB', verb: 'USE' })
  x = adventureReducer(x, { type: 'ACT_ON_ITEM', itemId: first })
  return drain(adventureReducer(x, { type: 'ACT_ON_ITEM', itemId: second }))
}
const withMiscToolbox = (): Office => doVerb(doVerb(fresh(), 'OPEN', 'miscellaneous-drawer-cabinet'), 'PICK_UP', 'miscellaneous-catch-all-contents')

describe('S9-P1-R3 toolbox persistence and note-read seam', () => {
  it('R19.1 OPEN closed toolbox retains the open-empty toolbox with hammer and nails', () => {
    const s = withMiscToolbox()
    const opened = actOn(s, 'OPEN', 'small-toolbox-closed')
    expect(opened.inventory).not.toContain('small-toolbox-closed')
    expect(opened.inventory).toContain('small-toolbox-open-empty')
    expect(opened.inventory).toContain('hammer')
    expect(opened.inventory).toContain('nails')
    expect(opened.inventory.length).toBe(s.inventory.length + 2)
    expect(opened.lastInteractionId).toBe('INTERACTION.ITEM.open-toolbox')
  })
  it('R19.2 USE closed toolbox grants the identical set with no reach animation grant', () => {
    const s = withMiscToolbox()
    const opened = actOn(s, 'OPEN', 'small-toolbox-closed')
    const used = actOn(s, 'USE', 'small-toolbox-closed')
    expect([...used.inventory].sort()).toEqual([...opened.inventory].sort())
    expect(used.lastInteractionId).toBe('INTERACTION.ITEM.use-toolbox')
  })
  it('R19.3 repeat OPEN/USE on the open-empty toolbox cannot duplicate outputs', () => {
    const opened = actOn(withMiscToolbox(), 'OPEN', 'small-toolbox-closed')
    const reopened = actOn(opened, 'OPEN', 'small-toolbox-open-empty')
    const reused = actOn(opened, 'USE', 'small-toolbox-open-empty')
    expect(reopened.inventory).toEqual(opened.inventory)
    expect(reused.inventory).toEqual(opened.inventory)
    for (const id of ['small-toolbox-open-empty', 'hammer', 'nails'] as const) {
      expect(reopened.inventory.filter((item) => item === id)).toHaveLength(1)
      expect(reused.inventory.filter((item) => item === id)).toHaveLength(1)
    }
    expect(reopened.lastInteractionId).toBe('INTERACTION.ITEM.open-toolbox-open')
    expect(reused.lastInteractionId).toBe('INTERACTION.ITEM.use-toolbox-open')
  })
  it('R19.4 LOOK AT the open-empty toolbox is nonmutating behind a late-bound key', () => {
    const opened = actOn(withMiscToolbox(), 'OPEN', 'small-toolbox-closed')
    const looked = actOn(opened, 'LOOK_AT', 'small-toolbox-open-empty')
    expect(looked.inventory).toEqual(opened.inventory)
    expect(looked.piggyNoteReadState).toBe('UNREAD')
    expect(looked.lastSemanticContact).toBeNull()
  })
  it('R19.5 toolbox outputs stay within the ten visible inventory slots', () => {
    const s = withMiscToolbox()
    const opened = actOn(s, 'OPEN', 'small-toolbox-closed')
    const smashed = combine(opened, 'hammer', 'piggy-bank-intact')
    for (const state of [opened, smashed]) {
      expect(state.inventory.length).toBeLessThanOrEqual(10)
      expect(new Set(state.inventory).size).toBe(state.inventory.length)
    }
    expect(smashed.inventory).toContain('small-toolbox-open-empty')
    expect(smashed.inventory).toContain('fictional-token-note')
  })
  it('R20.1 smashing the pig adds the note but leaves the read milestone UNREAD', () => {
    const opened = actOn(withMiscToolbox(), 'OPEN', 'small-toolbox-closed')
    const smashed = combine(opened, 'hammer', 'piggy-bank-intact')
    expect(smashed.inventory).not.toContain('piggy-bank-intact')
    expect(smashed.inventory).toContain('hammer')
    expect(smashed.inventory).toContain('fictional-token-note')
    expect(smashed.piggyNoteReadState).toBe('UNREAD')
    expect(smashed.lastSemanticContact).not.toBe('CONTACT.NOTE_BACK_COMPLETE')
  })
  it('R21.1 BACK_READ fires only at the final required acknowledgment', () => {
    const smashed = combine(actOn(withMiscToolbox(), 'OPEN', 'small-toolbox-closed'), 'hammer', 'piggy-bank-intact')
    expect(smashed.piggyNoteReadState).toBe('UNREAD')
    const reading = lookNote(smashed)
    expect(reading.piggyNoteReadState).toBe('UNREAD')
    expect(reading.lastSemanticContact).not.toBe('CONTACT.NOTE_BACK_COMPLETE')
    expect(reading.lastInteractionId).toBe('INTERACTION.ITEM.look-note')
    expect(reading.inventory).toContain('fictional-token-note')
    const lines = reading.speech?.lines ?? []
    expect(lines).toHaveLength(3)
    for (const line of lines) expect(line.copyKey?.startsWith('lane_a.note.')).toBe(true)
    const frontAcked = stepSpeech(reading)
    expect(frontAcked.piggyNoteReadState).toBe('UNREAD')
    expect(frontAcked.speech?.lineIndex).toBe(1)
    const backCurrent = stepSpeech(frontAcked)
    expect(backCurrent.piggyNoteReadState).toBe('UNREAD')
    expect(backCurrent.lastSemanticContact).not.toBe('CONTACT.NOTE_BACK_COMPLETE')
    expect(backCurrent.speech?.lineIndex).toBe(2)
    const done = stepSpeech(backCurrent)
    expect(done.speech).toBeNull()
    expect(done.piggyNoteReadState).toBe('BACK_READ')
    expect(done.lastSemanticContact).toBe('CONTACT.NOTE_BACK_COMPLETE')
  })
  it('R21.2 repeat LOOK AT is idempotent and preserves the reusable item', () => {
    const smashed = combine(actOn(withMiscToolbox(), 'OPEN', 'small-toolbox-closed'), 'hammer', 'piggy-bank-intact')
    const done = stepSpeech(stepSpeech(stepSpeech(lookNote(smashed))))
    expect(done.piggyNoteReadState).toBe('BACK_READ')
    const reread = drain(lookNote(done))
    expect(reread.piggyNoteReadState).toBe('BACK_READ')
    expect(reread.lastSemanticContact).toBe('CONTACT.NOTE_BACK_COMPLETE')
    expect(reread.inventory).toEqual(done.inventory)
    expect(reread.inventory).toContain('fictional-token-note')
  })
  it('R21.3 hotspot LOOK AT path reaches the same completion contact', () => {
    const smashed = combine(actOn(withMiscToolbox(), 'OPEN', 'small-toolbox-closed'), 'hammer', 'piggy-bank-intact')
    const arrived = adventureReducer(smashed, { type: 'WALK_TO', point: { x: 100, y: 300 }, pendingInteraction: { verb: 'LOOK_AT', targetId: 'historical-clock', itemId: 'fictional-token-note' } })
    expect(arrived.piggyNoteReadState).toBe('UNREAD')
    expect(arrived.speech?.lines).toHaveLength(3)
    const done = drain(arrived)
    expect(done.piggyNoteReadState).toBe('BACK_READ')
    expect(done.lastSemanticContact).toBe('CONTACT.NOTE_BACK_COMPLETE')
    expect(done.inventory).toContain('fictional-token-note')
  })
  it('R22.1 terminal side lead stays absent until the BACK_READ-triggered command', () => {
    const earned = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    expect(terminalCapabilities(frozen, earned).sideLeadVisible).toBe(false)
    const filed = investigationReducer(frozen, earned, { type: 'COLLECT_CASE_FILE' })
    expect(terminalCapabilities(frozen, filed).sideLeadVisible).toBe(false)
    const read = investigationReducer(frozen, filed, { type: 'COLLECT_SIDE_NOTE' })
    expect(terminalCapabilities(frozen, read).sideLeadVisible).toBe(true)
    expect(SIDE_LEAD_TOKENS).toHaveLength(1)
  })
  it('R22.2 exactly one optional choice; RESET and reopen preserve without duplicating the lead', () => {
    const earned = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    const read = investigationReducer(frozen, investigationReducer(frozen, earned, { type: 'COLLECT_CASE_FILE' }), { type: 'COLLECT_SIDE_NOTE' })
    const chosen = investigationReducer(frozen, read, { type: 'SELECT_SIDE_TOKEN', tokenId: SIDE_LEAD_TOKENS[0]!.id })
    expect(chosen.sideLead.selectedTokenId).toBe(SIDE_LEAD_TOKENS[0]!.id)
    const reselected = investigationReducer(frozen, chosen, { type: 'SELECT_SIDE_TOKEN', tokenId: SIDE_LEAD_TOKENS[0]!.id })
    expect(reselected.sideLead.selectedTokenId).toBe(SIDE_LEAD_TOKENS[0]!.id)
    const reset = investigationReducer(frozen, chosen, { type: 'RESET_CASE' })
    expect(reset.sideLead.noteDiscovered).toBe(true)
    expect(reset.commands.filter((c) => c.type === 'COLLECT_SIDE_NOTE')).toHaveLength(1)
    const reopened = restoreInvestigation(frozen, exportLocalSave(chosen))
    expect(reopened.sideLead.noteDiscovered).toBe(true)
    expect(reopened.commands.filter((c) => c.type === 'COLLECT_SIDE_NOTE')).toHaveLength(1)
    expect(terminalCapabilities(frozen, reopened).sideLeadVisible).toBe(true)
  })
  it('R22.3 crafted undiscovered state fails closed on selection', () => {
    const earned = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    const blind = investigationReducer(frozen, earned, { type: 'SELECT_SIDE_TOKEN', tokenId: SIDE_LEAD_TOKENS[0]!.id })
    expect(blind.error).toBeTruthy()
    expect(blind.sideLead.selectedTokenId).toBeNull()
    expect(terminalCapabilities(frozen, blind).sideLeadVisible).toBe(false)
  })
  it('R23 optional side-lead provenance stays late-bound and never enters Hero state', () => {
    const earned = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    const before = investigationReducer(frozen, earned, { type: 'COLLECT_CASE_FILE' })
    const read = investigationReducer(frozen, before, { type: 'COLLECT_SIDE_NOTE' })
    const chosen = investigationReducer(frozen, read, { type: 'SELECT_SIDE_TOKEN', tokenId: SIDE_LEAD_TOKENS[0]!.id })
    expect(SIDE_LEAD_TOKENS[0]!.provenance).toBe('LATE_BOUND')
    expect(chosen.discoveredClues).toEqual(before.discoveredClues)
    expect(chosen.discoveredRecords).toEqual(before.discoveredRecords)
    expect(chosen.assembly).toEqual({})
    expect(chosen.query).toEqual(before.query)
    expect(chosen.workingTheory).toBeNull()
    expect(chosen.complete).toBe(false)
    expect(JSON.stringify([chosen.discoveredClues, chosen.discoveredRecords, chosen.assembly, chosen.query])).not.toMatch(/FICTIONAL|LATE-BOUND/)
    const views = JSON.stringify([SIDE_LEAD_HIGH_LEVEL_VIEW, SIDE_LEAD_TECHNICAL_VIEW, SIDE_LEAD_TOKENS])
    expect(views).toMatch(/LATE-BOUND|late-bound/)
    expect(views).not.toMatch(/INVALID-TRAINING|Powered by Nansen|No Nansen provenance|FICTIONAL_OFFICE_NOTE/)
  })
  it('R3 review jump and reset fail closed without inventing the read milestone', () => {
    const smashed = combine(actOn(withMiscToolbox(), 'OPEN', 'small-toolbox-closed'), 'hammer', 'piggy-bank-intact')
    const read = actOn(smashed, 'LOOK_AT', 'fictional-token-note')
    expect(read.piggyNoteReadState).toBe('BACK_READ')
    const jumped = adventureReducer(read, { type: 'REVIEW_JUMP', phase: 'COMPLETE' })
    expect(jumped.piggyNoteReadState).toBe('UNREAD')
    const reset = adventureReducer(read, { type: 'RESET' })
    expect(reset.piggyNoteReadState).toBe('UNREAD')
    expect(reset.inventory).toEqual([])
  })
})
