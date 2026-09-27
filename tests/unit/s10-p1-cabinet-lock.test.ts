import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { HotspotId, VerbId } from '../../src/adventure/types'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { createInvestigationState, investigationReducer, terminalCapabilities } from '../../src/investigation/state'

type Office = ReturnType<typeof createInitialAdventureState>
const fresh = (): Office => ({ ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true, instantText: true })
const drain = (state: Office): Office => {
  let s = state
  for (let i = 0; i < 20 && s.activeSequence; i++) s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
  for (let i = 0; i < 20 && s.speech; i++) s = adventureReducer(s, { type: 'ADVANCE_SPEECH' })
  return s
}
const begin = (s: Office, verb: VerbId, targetId: HotspotId): Office => adventureReducer(adventureReducer(s, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId })
const cabinets = ['official-case-file-cabinet', 'miscellaneous-drawer-cabinet'] as const
const verbs = ['OPEN', 'USE', 'PULL'] as const

describe('S10-P1 preauthorization cabinet lock', () => {
  it('OPEN, USE, and PULL on both cabinets reach, then block, and stay closed', () => {
    for (const target of cabinets) {
      for (const verb of verbs) {
        let s = begin(fresh(), verb, target)
        expect(s.speech).toBeNull()
        expect(s.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
        expect(s.caseFileDrawer).toBe('CLOSED')
        expect(s.miscDrawer).toBe('CLOSED')
        s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
        s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
        expect(s.speech).toBeNull()
        expect(s.lastSemanticContact).not.toBe('CONTACT.CABINET_POLICY_BLOCK')
        s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
        expect(s.speech).toBeNull()
        expect(s.lastSemanticContact).toBe('CONTACT.CABINET_POLICY_BLOCK')
        expect(s.caseFileDrawer).toBe('CLOSED')
        expect(s.miscDrawer).toBe('CLOSED')
        expect(s.inventory).toEqual([])
        s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
        expect(s.activeSequence).toBeNull()
        expect(s.speech?.lines[0]?.copyKey).toBe('TODO.STORY.PREAUTH_CABINET_POLICY_BLOCK')
        expect(s.speech?.lines[0]?.speaker).toBe('MR_INDEX')
        const contacts = s.sequenceEvents.filter((event) => event.semanticContact === 'CONTACT.CABINET_POLICY_BLOCK')
        expect(contacts).toHaveLength(1)
        expect(contacts[0]?.mutationApplied).toBe(false)
      }
    }
  })
  it('does not queue Arthur before the blocked contact, and a repeat cannot leak', () => {
    const first = drain(begin(fresh(), 'OPEN', 'official-case-file-cabinet'))
    expect(first.caseFileDrawer).toBe('CLOSED')
    expect(first.inventory).toEqual([])
    const second = drain(begin(first, 'PULL', 'official-case-file-cabinet'))
    expect(second.caseFileDrawer).toBe('CLOSED')
    expect(second.inventory).toEqual([])
    expect(second.sequenceEvents.filter((event) => event.semanticContact === 'CONTACT.CABINET_POLICY_BLOCK')).toHaveLength(2)
    const caption = second.transcript.findIndex((line) => line.text.includes('Cabinet contact blocked'))
    const arthur = second.transcript.findIndex((line) => line.copyKey === 'TODO.STORY.PREAUTH_CABINET_POLICY_BLOCK')
    expect(caption).toBeGreaterThanOrEqual(0)
    expect(arthur).toBeGreaterThan(caption)
  })
  it('keeps LOOK nonrevealing and leaves globe, close, push, and the terminal block intact', () => {
    const looked = drain(begin(fresh(), 'LOOK_AT', 'official-case-file-cabinet'))
    expect(looked.caseFileDrawer).toBe('CLOSED')
    expect(looked.lastSequenceId).not.toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(looked.inventory).toEqual([])
    const globe = drain(begin(fresh(), 'PUSH', 'office-globe'))
    expect(globe.caseFileDrawer).toBe('CLOSED')
    expect(globe.miscDrawer).toBe('CLOSED')
    expect(globe.phase).toBe('START')
    const closed = drain(begin(fresh(), 'CLOSE', 'miscellaneous-drawer-cabinet'))
    expect(closed.miscDrawer).toBe('CLOSED')
    expect(closed.lastSequenceId).not.toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    const pushed = drain(begin(fresh(), 'PUSH', 'official-case-file-cabinet'))
    expect(pushed.caseFileDrawer).toBe('CLOSED')
    const terminal = begin(fresh(), 'USE', 'nansen-terminal')
    expect(terminal.activeSequence?.id).toBe('SEQUENCE.TERMINAL_REPRIMAND')
    expect(drain(terminal).phase).toBe('START')
  })
  it('pending walk stays closed until arrival, and reset or review jump cannot invent an open drawer', () => {
    let walking = { ...fresh(), reducedAnimation: false }
    walking = adventureReducer(walking, { type: 'SELECT_VERB', verb: 'OPEN' })
    walking = adventureReducer(walking, { type: 'INTERACT', targetId: 'miscellaneous-drawer-cabinet' })
    expect(walking.walk).not.toBeNull()
    expect(walking.activeSequence).toBeNull()
    expect(walking.speech).toBeNull()
    expect(walking.miscDrawer).toBe('CLOSED')
    for (let i = 0; i < 40 && walking.walk; i++) walking = adventureReducer(walking, { type: 'WALK_TICK', delta: 80 })
    expect(walking.walk).toBeNull()
    expect(walking.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(walking.miscDrawer).toBe('CLOSED')
    const reset = adventureReducer(walking, { type: 'RESET' })
    expect(reset.phase).toBe('START')
    expect(reset.miscDrawer).toBe('CLOSED')
    expect(reset.inventory).toEqual([])
    const jumped = adventureReducer(walking, { type: 'REVIEW_JUMP', phase: 'COMPLETE' })
    expect(jumped.caseFileDrawer).toBe('CLOSED')
    expect(jumped.miscDrawer).toBe('CLOSED')
  })
  it('restores normal once-only drawer behavior after the stamp milestone', () => {
    const authorized = { ...fresh(), phase: 'COMPLETE' as const }
    let opened = drain(begin(authorized, 'OPEN', 'official-case-file-cabinet'))
    expect(opened.caseFileDrawer).toBe('OPEN')
    expect(opened.lastSequenceId).not.toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    opened = drain(begin(opened, 'PICK_UP', 'disorderly-stack-of-confidential-files'))
    expect(opened.inventory.filter((id) => id === 'euler-case-file')).toHaveLength(1)
    const again = drain(begin(opened, 'PICK_UP', 'disorderly-stack-of-confidential-files'))
    expect(again.inventory.filter((id) => id === 'euler-case-file')).toHaveLength(1)
    let misc = drain(begin(authorized, 'USE', 'miscellaneous-drawer-cabinet'))
    expect(misc.miscDrawer).toBe('OPEN')
    misc = drain(begin(misc, 'PICK_UP', 'miscellaneous-catch-all-contents'))
    expect(misc.inventory).toEqual(['rubber-band', 'rubiks-cube', 'sharknado-2-vhs', 'piggy-bank-intact', 'small-toolbox-closed'])
  })
})

const frozen = buildFrozenFixture(
  JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/scenario.json', 'utf8')),
  JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/evidence-graph.json', 'utf8')),
)
function protectedProjection(office: Office) {
  let investigation = createInvestigationState(frozen)
  if (office.phase === 'COMPLETE') {
    investigation = investigationReducer(frozen, investigation, { type: 'EARN_ACCESS' })
    if (office.inventory.includes('euler-case-file')) investigation = investigationReducer(frozen, investigation, { type: 'COLLECT_CASE_FILE' })
    if (office.piggyNoteReadState === 'BACK_READ') investigation = investigationReducer(frozen, investigation, { type: 'COLLECT_SIDE_NOTE' })
  }
  const caps = terminalCapabilities(frozen, investigation)
  const count = (id: string) => office.inventory.filter((item) => item === id).length
  return {
    phase: office.phase,
    caseFileDrawer: office.caseFileDrawer,
    miscDrawer: office.miscDrawer,
    caseStack: office.caseStack,
    miscContents: office.miscContents,
    inventory: office.inventory,
    caseFile: count('euler-case-file'),
    piggy: count('piggy-bank-intact'),
    toolboxClosed: count('small-toolbox-closed'),
    toolboxOpen: count('small-toolbox-open-empty'),
    hammer: count('hammer'),
    nails: count('nails'),
    note: count('fictional-token-note'),
    noteRead: office.piggyNoteReadState,
    clues: investigation.discoveredClues,
    sideLead: investigation.sideLead,
    assembly: investigation.assembly,
    records: investigation.discoveredRecords,
    complete: investigation.complete,
    theory: investigation.workingTheory,
    terminalOpen: office.phase === 'COMPLETE',
    terminalStage: caps.stage,
    sideLeadVisible: caps.sideLeadVisible,
  }
}

describe('S10-P1-R1 protected-state projection, interruption, and idempotence', () => {
  it('S10-P1-R1 protected-state projection is unchanged at every preauth checkpoint', () => {
    for (const target of cabinets) {
      for (const verb of verbs) {
        const start = fresh()
        const before = protectedProjection(start)
        let s = begin(start, verb, target)
        const checkpoints = [s]
        while (s.activeSequence) {
          s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
          checkpoints.push(s)
        }
        expect(checkpoints.map((state) => state.activeSequence === null ? 'speech' : state.activeSequence.actionIndex)).toEqual([-1, 0, 1, 2, 'speech'])
        expect(checkpoints[3]?.lastSemanticContact).toBe('CONTACT.CABINET_POLICY_BLOCK')
        expect(checkpoints[3]?.speech).toBeNull()
        expect(checkpoints[4]?.speech?.lines[0]?.copyKey).toBe('TODO.STORY.PREAUTH_CABINET_POLICY_BLOCK')
        expect(checkpoints[4]?.speech?.lines[0]?.text).toContain('PLACEHOLDER')
        for (const state of checkpoints) expect(protectedProjection(state)).toEqual(before)
        const done = drain(checkpoints[4]!)
        expect(protectedProjection(done)).toEqual(before)
        expect(done.sequenceEvents.filter((event) => event.semanticContact === 'CONTACT.CABINET_POLICY_BLOCK')).toHaveLength(1)
        expect(done.transcript.filter((line) => line.copyKey === 'TODO.STORY.PREAUTH_CABINET_POLICY_BLOCK')).toHaveLength(1)
      }
    }
  })
  it('S10-P1-R1 competing input and USE with an item cannot open a second sequence', () => {
    let s = begin(fresh(), 'USE', 'official-case-file-cabinet')
    s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
    s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
    const reach = adventureReducer(s, { type: 'SELECT_VERB', verb: 'PULL' })
    expect(reach.activeSequence?.actionIndex).toBe(1)
    expect(reach.lastSemanticContact).not.toBe('CONTACT.CABINET_POLICY_BLOCK')
    expect(protectedProjection(reach)).toEqual(protectedProjection(fresh()))
    const contact = adventureReducer(reach, { type: 'ADVANCE_SEQUENCE' })
    const competed = adventureReducer(contact, { type: 'INTERACT', targetId: 'miscellaneous-drawer-cabinet' })
    expect(competed.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(competed.sequenceEvents.filter((event) => event.semanticContact === 'CONTACT.CABINET_POLICY_BLOCK')).toHaveLength(1)
    expect(protectedProjection(competed)).toEqual(protectedProjection(fresh()))
    let armed = fresh()
    armed = { ...armed, inventory: ['hammer'], selectedVerb: 'USE', selectedItemId: 'hammer' }
    armed = adventureReducer(armed, { type: 'INTERACT', targetId: 'miscellaneous-drawer-cabinet' })
    expect(armed.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(protectedProjection(drain(armed)).hammer).toBe(1)
    expect(protectedProjection(drain(armed)).miscDrawer).toBe('CLOSED')
  })
})
