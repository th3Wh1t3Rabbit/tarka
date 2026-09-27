import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { HotspotId, InventoryItemId, VerbId } from '../../src/adventure/types'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { createInvestigationState, investigationReducer, terminalCapabilities } from '../../src/investigation/state'

type Office = ReturnType<typeof createInitialAdventureState>
const base = 'public/scenarios/euler-2023-false-exit/'
const frozen = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json', 'utf8')), JSON.parse(readFileSync(base + 'evidence-graph.json', 'utf8')))
const freshInstant = (): Office => ({ ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true, instantText: true })
const freshPaced = (): Office => ({ ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true, instantText: false })
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
const withNote = (start: Office): Office => {
  let s = doVerb(doVerb(start, 'OPEN', 'miscellaneous-drawer-cabinet'), 'PICK_UP', 'miscellaneous-catch-all-contents')
  s = drain(adventureReducer(adventureReducer(s, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'ACT_ON_ITEM', itemId: 'small-toolbox-closed' }))
  let t = adventureReducer(s, { type: 'SELECT_VERB', verb: 'USE' })
  t = adventureReducer(t, { type: 'ACT_ON_ITEM', itemId: 'hammer' })
  return drain(adventureReducer(t, { type: 'ACT_ON_ITEM', itemId: 'piggy-bank-intact' }))
}
const lookNote = (s: Office): Office => adventureReducer(adventureReducer(s, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'ACT_ON_ITEM', itemId: 'fictional-token-note' })
const stepSpeech = (s: Office): Office => adventureReducer(s, { type: 'ADVANCE_SPEECH' })
const authorized = () => investigationReducer(frozen, investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' }), { type: 'COLLECT_CASE_FILE' })
// Mirrors App.sendCase: COLLECT_SIDE_NOTE is synchronized only after BACK_READ.
const appSync = (office: Office, investigation = authorized()) => {
  if (office.piggyNoteReadState !== 'BACK_READ') return investigation
  return investigationReducer(frozen, investigation, { type: 'COLLECT_SIDE_NOTE' })
}
const hidden = (office: Office, investigation = appSync(office)) => {
  expect(office.piggyNoteReadState).toBe('UNREAD')
  expect(office.lastSemanticContact).not.toBe('CONTACT.NOTE_BACK_COMPLETE')
  expect(investigation.sideLead.noteDiscovered).toBe(false)
  expect(terminalCapabilities(frozen, investigation).sideLeadVisible).toBe(false)
  expect(investigation.commands.filter((c) => c.type === 'COLLECT_SIDE_NOTE')).toHaveLength(0)
}

describe('S9-P1-R4 real note-completion contact', () => {
  it('LOOK queues the reading without inventing BACK_READ or a side lead', () => {
    const smashed = withNote(freshInstant())
    hidden(smashed)
    const reading = lookNote(smashed)
    expect(reading.speech?.lineIndex).toBe(0)
    expect(reading.speech?.lines).toHaveLength(3)
    expect(reading.lastInteractionId).toBe('INTERACTION.ITEM.look-note')
    hidden(reading)
  })
  it('paced reading stays UNREAD through reveals and passages until the final acknowledgment', () => {
    const smashed = withNote(freshPaced())
    expect(smashed.inventory).toContain('fictional-token-note')
    const reading = lookNote(smashed)
    hidden(reading)
    expect(reading.speech?.lineIndex).toBe(0)
    const stages: Array<[string, number | null]> = []
    let s = reading
    for (let i = 0; i < 6; i++) {
      s = stepSpeech(s)
      stages.push([s.piggyNoteReadState, s.speech ? s.speech.lineIndex : null])
      if (s.piggyNoteReadState === 'UNREAD') hidden(s)
    }
    expect(stages).toEqual([
      ['UNREAD', 0],
      ['UNREAD', 1],
      ['UNREAD', 1],
      ['UNREAD', 2],
      ['UNREAD', 2],
      ['BACK_READ', null],
    ])
    expect(s.lastSemanticContact).toBe('CONTACT.NOTE_BACK_COMPLETE')
    expect(s.inventory).toContain('fictional-token-note')
    const lead = appSync(s)
    expect(lead.sideLead.noteDiscovered).toBe(true)
    expect(terminalCapabilities(frozen, lead).sideLeadVisible).toBe(true)
    expect(lead.commands.filter((c) => c.type === 'COLLECT_SIDE_NOTE')).toHaveLength(1)
  })
  it('front acknowledgment and an unacked back-side line stay UNREAD and hidden', () => {
    const reading = lookNote(withNote(freshInstant()))
    hidden(reading)
    const frontAcked = stepSpeech(reading)
    expect(frontAcked.speech?.lineIndex).toBe(1)
    hidden(frontAcked)
    const backCurrent = stepSpeech(frontAcked)
    expect(backCurrent.speech?.lineIndex).toBe(2)
    expect(backCurrent.speech?.visibleCharacters).toBe(backCurrent.speech?.lines[2]!.text.length)
    hidden(backCurrent)
    const done = stepSpeech(backCurrent)
    expect(done.speech).toBeNull()
    expect(done.piggyNoteReadState).toBe('BACK_READ')
    expect(done.lastSemanticContact).toBe('CONTACT.NOTE_BACK_COMPLETE')
    expect(appSync(done).sideLead.noteDiscovered).toBe(true)
  })
  it('instant text still requires every advancement and cannot skip the contact', () => {
    const smashed = withNote(freshInstant())
    const reading = lookNote(smashed)
    expect(reading.speech?.visibleCharacters).toBe(reading.speech?.lines[0]!.text.length)
    hidden(reading)
    const first = stepSpeech(reading)
    expect(first.speech?.lineIndex).toBe(1)
    hidden(first)
    const second = stepSpeech(first)
    expect(second.lastSemanticContact).not.toBe('CONTACT.NOTE_BACK_COMPLETE')
    expect(second.speech?.lineIndex).toBe(2)
    hidden(second)
    const done = stepSpeech(second)
    expect(done.speech).toBeNull()
    expect(done.piggyNoteReadState).toBe('BACK_READ')
    expect(done.lastSemanticContact).toBe('CONTACT.NOTE_BACK_COMPLETE')
  })
  it('REVEAL_FULL and toggling instant text cannot skip the required acknowledgment', () => {
    const reading = lookNote(withNote(freshPaced()))
    const revealed = adventureReducer(reading, { type: 'REVEAL_FULL' })
    expect(revealed.speech?.lineIndex).toBe(0)
    hidden(revealed)
    const instanced = adventureReducer(revealed, { type: 'TOGGLE_INSTANT_TEXT' })
    expect(instanced.instantText).toBe(true)
    hidden(instanced)
    const stillQueued = adventureReducer(instanced, { type: 'REVEAL_FULL' })
    hidden(stillQueued)
    const done = drain(stillQueued)
    expect(done.piggyNoteReadState).toBe('BACK_READ')
  })
  it('inventory-direct LOOK and pending-walk LOOK converge on the same sequence and contact', () => {
    const smashed = withNote(freshInstant())
    const direct = lookNote(smashed)
    expect(direct.speech?.lines.map((line) => line.copyKey)).toEqual([
      'lane_a.note.front.read',
      'lane_a.note.back.read',
      'lane_a.note.back.complete',
    ])
    const walked = adventureReducer(smashed, {
      type: 'WALK_TO',
      point: { x: 400, y: 300 },
      pendingInteraction: { verb: 'LOOK_AT', targetId: 'historical-clock', itemId: 'fictional-token-note' },
    })
    expect(walked.piggyNoteReadState).toBe('UNREAD')
    expect(walked.speech?.lines.map((line) => line.copyKey)).toEqual(direct.speech?.lines.map((line) => line.copyKey))
    expect(drain(direct).lastSemanticContact).toBe(drain(walked).lastSemanticContact)
    let animated: Office = { ...smashed, reducedAnimation: false, instantText: true }
    animated = adventureReducer(animated, {
      type: 'WALK_TO',
      point: { x: 500, y: 300 },
      pendingInteraction: { verb: 'LOOK_AT', targetId: 'historical-clock', itemId: 'fictional-token-note' },
    })
    expect(animated.walk).not.toBeNull()
    expect(animated.speech).toBeNull()
    hidden(animated)
    for (let i = 0; i < 80 && animated.walk; i++) animated = adventureReducer(animated, { type: 'WALK_TICK', delta: 80 })
    expect(animated.walk).toBeNull()
    hidden(animated)
    expect(animated.speech?.lines).toHaveLength(3)
    const arrived = drain(animated)
    expect(arrived.piggyNoteReadState).toBe('BACK_READ')
    expect(arrived.lastSemanticContact).toBe('CONTACT.NOTE_BACK_COMPLETE')
  })
  it('advancing unrelated speech never sets the milestone or contact', () => {
    let s = adventureReducer(freshInstant(), { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    s = adventureReducer(s, { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    expect(s.speech).toBeNull()
    expect(s.nonblockingSpeech).not.toBeNull()
    let done = s
    for (let i = 0; i < 8 && done.nonblockingSpeech; i++) {
      done = adventureReducer(done, { type: 'REVEAL_FULL', channel: 'NONBLOCKING' })
      done = adventureReducer(done, { type: 'ADVANCE_SPEECH', channel: 'NONBLOCKING' })
    }
    expect(done.nonblockingSpeech).toBeNull()
    hidden(done)
  })
  it('interruption before completion restarts fail-closed without inventing BACK_READ', () => {
    const smashed = withNote(freshInstant())
    const mid = stepSpeech(lookNote(smashed))
    expect(mid.speech?.lineIndex).toBe(1)
    hidden(mid)
    const reset = adventureReducer(mid, { type: 'RESET' })
    hidden(reset)
    expect(reset.inventory).toEqual([])
    const jumped = adventureReducer(mid, { type: 'REVIEW_JUMP', phase: 'COMPLETE' })
    hidden(jumped)
    expect(appSync(mid).sideLead.noteDiscovered).toBe(false)
  })
  it('repeat reads after BACK_READ stay idempotent with a single contact and one lead', () => {
    const smashed = withNote(freshInstant())
    const done = drain(lookNote(smashed))
    expect(done.piggyNoteReadState).toBe('BACK_READ')
    const first = appSync(done)
    expect(first.commands.filter((c) => c.type === 'COLLECT_SIDE_NOTE')).toHaveLength(1)
    const events = done.sequenceEvents.length
    const reread = drain(lookNote(done))
    expect(reread.piggyNoteReadState).toBe('BACK_READ')
    expect(reread.lastSemanticContact).toBe('CONTACT.NOTE_BACK_COMPLETE')
    expect(reread.inventory).toEqual(done.inventory)
    expect(reread.sequenceEvents.length).toBe(events)
    const again = appSync(reread, first)
    expect(again.commands.filter((c) => c.type === 'COLLECT_SIDE_NOTE')).toHaveLength(1)
    expect(again.sideLead.noteDiscovered).toBe(true)
  })
})
