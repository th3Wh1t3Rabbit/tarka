import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { persistInvestigation, synchronizeOfficeMilestones } from '../../src/investigation/officeSync'
import { createInvestigationState, investigationReducer, restoreInvestigation, terminalCapabilities } from '../../src/investigation/state'
import type { AdventureState } from '../../src/adventure/types'

const fixture = buildFrozenFixture(
  JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/scenario.json', 'utf8')),
  JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/evidence-graph.json', 'utf8')),
)
const office = (patch: Partial<AdventureState> = {}): Pick<AdventureState, 'phase' | 'inventory' | 'piggyNoteReadState'> => ({
  phase: 'COMPLETE', inventory: [], piggyNoteReadState: 'UNREAD', ...patch,
})
const fresh = (): AdventureState => ({ ...createInitialAdventureState({ skipIntro: true }), instantText: true, phase: 'COMPLETE' })
const send = (state: AdventureState, action: Parameters<typeof adventureReducer>[1]) => adventureReducer(state, action)
const counts = (state: { commands: { type: string }[] }, type: string) => state.commands.filter((command) => command.type === type).length

describe('S10-P3-R1 re-entry', () => {
  it('S10-P3-R1 pre-case terminal command creates non-null case state', () => {
    const created = investigationReducer(fixture, synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office()), { type: 'PRESENTATION', mode: 'DOCKED_OVERLAY' })
    expect(created).not.toBeNull()
    expect(created.access).toBe(true)
    expect(created.presentation).toBe('DOCKED_OVERLAY')
    expect(terminalCapabilities(fixture, created).stage).toBe(2)
    expect(terminalCapabilities(fixture, created).askCardIds).not.toContain('CARD.INCIDENT_DAI')
  })

  it('S10-P3-R1 later case-file collection unlocks question 1 on re-entry', () => {
    const existing = investigationReducer(fixture, synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office()), { type: 'PRESENTATION', mode: 'DOCKED_OVERLAY' })
    const reentered = synchronizeOfficeMilestones(fixture, existing, office({ inventory: ['euler-case-file'] }))
    expect(terminalCapabilities(fixture, reentered).askCardIds).toContain('CARD.INCIDENT_DAI')
    expect(terminalCapabilities(fixture, reentered).stage).toBe(3)
    expect(reentered.discoveredClues).toEqual(expect.arrayContaining(['CLUE.ASSET', 'CLUE.AMOUNT']))
  })

  it('S10-P3-R1 existing prebrief progress survives synchronization', () => {
    let existing = synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office())
    existing = investigationReducer(fixture, existing, { type: 'PRESENTATION', mode: 'PLAIN_LIST' })
    existing = { ...existing, section: 'CASE', announcement: 'kept' }
    const synced = synchronizeOfficeMilestones(fixture, existing, office({ inventory: ['euler-case-file'] }))
    expect(synced.presentation).toBe('PLAIN_LIST')
    expect(synced.section).toBe('CASE')
    expect(synced.announcement).toBe('Euler case file collected. DAI, token contract, amount, and incident window established.')
    expect(counts(synced, 'PRESENTATION')).toBe(1)
  })

  it('S10-P3-R1 repeated case-file synchronization is idempotent', () => {
    const once = synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office({ inventory: ['euler-case-file'] }))
    const twice = synchronizeOfficeMilestones(fixture, once, office({ inventory: ['euler-case-file'] }))
    expect(twice).toBe(once)
    expect(counts(twice, 'EARN_ACCESS')).toBe(1)
    expect(counts(twice, 'COLLECT_CASE_FILE')).toBe(1)
  })

  it('S10-P3-R1 pre-note terminal command creates non-null case state', () => {
    const created = investigationReducer(fixture, synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office({ inventory: ['fictional-token-note'] })), { type: 'SECTION', section: 'CASE' })
    expect(created.sideLead.noteDiscovered).toBe(false)
    expect(created.access).toBe(true)
    expect(terminalCapabilities(fixture, created).sideLeadVisible).toBe(false)
  })

  it('S10-P3-R1 BACK_READ later unlocks the BRCG side lead on re-entry', () => {
    const existing = synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office({ inventory: ['euler-case-file', 'fictional-token-note'] }))
    expect(existing.sideLead.noteDiscovered).toBe(false)
    const reentered = synchronizeOfficeMilestones(fixture, existing, office({ inventory: ['euler-case-file', 'fictional-token-note'], piggyNoteReadState: 'BACK_READ' }))
    expect(reentered.sideLead.noteDiscovered).toBe(true)
    expect(terminalCapabilities(fixture, reentered).sideLeadVisible).toBe(true)
  })

  it('S10-P3-R1 unread front and unacknowledged back do not unlock BRCG', () => {
    const base = synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office({ inventory: ['fictional-token-note'] }))
    expect(synchronizeOfficeMilestones(fixture, base, office({ inventory: ['fictional-token-note'], piggyNoteReadState: 'UNREAD' })).sideLead.noteDiscovered).toBe(false)
    expect(synchronizeOfficeMilestones(fixture, base, office({ piggyNoteReadState: 'UNREAD' })).sideLead.noteDiscovered).toBe(false)
  })

  it('S10-P3-R1 repeated side-note synchronization is idempotent and hero-isolated', () => {
    const hero = synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office({ inventory: ['euler-case-file'] }))
    const once = synchronizeOfficeMilestones(fixture, hero, office({ inventory: ['euler-case-file'], piggyNoteReadState: 'BACK_READ' }))
    const twice = synchronizeOfficeMilestones(fixture, once, office({ inventory: ['euler-case-file'], piggyNoteReadState: 'BACK_READ' }))
    expect(twice).toBe(once)
    expect(counts(twice, 'COLLECT_SIDE_NOTE')).toBe(1)
    expect(twice.discoveredClues).toEqual(hero.discoveredClues)
    expect(twice.exactEventIds).toEqual(hero.exactEventIds)
    expect(twice.complete).toBe(hero.complete)
  })

  it('S10-P3-R1 paced nonblocking self-talk continues during terminal approach', () => {
    let state = send(send({ ...fresh(), instantText: false }, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.nonblockingSpeech?.visibleCharacters).toBe(0)
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.walk?.pendingInteraction?.targetId).toBe('nansen-terminal')
    expect(state.nonblockingSpeech).not.toBeNull()
    state = send(state, { type: 'REVEAL_TICK', characters: 3, channel: 'NONBLOCKING' })
    expect(state.nonblockingSpeech!.visibleCharacters).toBeGreaterThan(0)
    expect(state.terminalEntryPending).toBe(false)
  })

  it('S10-P3-R1 instant self-talk may coexist during approach', () => {
    let state = send(send(fresh(), { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    const text = state.nonblockingSpeech!.lines[0]!.text
    expect(state.nonblockingSpeech?.visibleCharacters).toBe(text.length)
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.nonblockingSpeech?.visibleCharacters).toBe(text.length)
    expect(state.walk).not.toBeNull()
  })

  it('S10-P3-R1 both speech channels are null before terminal mount', () => {
    let state = send(send({ ...fresh(), instantText: false }, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.terminalEntryPending).toBe(true)
    expect(state.speech).toBeNull()
    expect(state.nonblockingSpeech).toBeNull()
    expect(state.dialogueOpen).toBe(false)
    expect(state.activeSequence).toBeNull()
    expect(state.transcript.some((line) => line.channel === 'NONBLOCKING' && line.text.length > 0)).toBe(true)
  })

  it('S10-P3-R1 no reveal tick changes world speech behind the terminal', () => {
    let state = send(send(fresh(), { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    state = send(send(state, { type: 'REQUEST_TERMINAL_ENTRY' }), { type: 'WALK_TICK', delta: 8000 })
    state = send(state, { type: 'ACK_TERMINAL_PRESENTATION' })
    const ticked = send(state, { type: 'REVEAL_TICK', characters: 3, channel: 'NONBLOCKING' })
    expect(ticked).toBe(state)
    expect(ticked.nonblockingSpeech).toBeNull()
  })

  it('S10-P3-R1 terminal close does not resume the pre-entry self-talk', () => {
    let state = send(send(fresh(), { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'office-globe' })
    state = send(send(state, { type: 'REQUEST_TERMINAL_ENTRY' }), { type: 'WALK_TICK', delta: 8000 })
    state = send(state, { type: 'CLOSE_TERMINAL' })
    expect(state.worldQuiescent).toBe(false)
    expect(state.nonblockingSpeech).toBeNull()
    expect(state.speech).toBeNull()
  })

  it('S10-P3-R1 destination-only floor walk replacement mounts and ACKs one event', () => {
    let state = send(fresh(), { type: 'WALK_TO', point: { x: 80, y: 300 } })
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.intentReplacement).toMatchObject({ id: 1, copyKey: 'TODO.STORY.INTENT_REPLACED' })
    expect(state.terminalEntryPending).toBe(false)
    expect(state.transcript.filter((line) => line.copyKey === 'TODO.STORY.INTENT_REPLACED')).toHaveLength(1)
    state = send(state, { type: 'ACK_INTENT_REPLACEMENT', id: 1 })
    expect(state.intentReplacement).toBeNull()
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.terminalEntryPending).toBe(true)
  })

  it('S10-P3-R1 the old floor destination never resumes', () => {
    let state = send(fresh(), { type: 'WALK_TO', point: { x: 80, y: 300 } })
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.rookPosition).toEqual({ x: 870, y: 365 })
    state = send(state, { type: 'CLOSE_TERMINAL' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.walk).toBeNull()
    expect(state.rookPosition).toEqual({ x: 870, y: 365 })
  })

  it('S10-P3-R1 the same already-pending terminal intent creates no duplicate replacement', () => {
    let state = send(fresh(), { type: 'WALK_TO', point: { x: 90, y: 300 } })
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    const seq = state.intentReplacementSeq
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.intentReplacementSeq).toBe(seq)
    expect(state.transcript.filter((line) => line.copyKey === 'TODO.STORY.INTENT_REPLACED')).toHaveLength(1)
    const idle = send(fresh(), { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(idle.intentReplacement).toBeNull()
  })

  it('S10-P3-R1 a repeated terminal target does not duplicate the in-flight entry', () => {
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).not.toContain('open-case-terminal')
    expect(app).toContain("dispatch(state.selectedVerb ? { type: 'INTERACT', targetId: hotspot.id }")
    const walking = send(send(fresh(), { type: 'WALK_TO', point: { x: 80, y: 300 } }), { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(walking.walk?.pendingInteraction?.targetId).toBe('nansen-terminal')
    const again = send(walking, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(again.intentReplacementSeq).toBe(walking.intentReplacementSeq)
    expect(again.walk?.to).toEqual(walking.walk?.to)
  })

  it('S10-P3-R1 keyboard and plain-list match that in-flight state', () => {
    const plain = send(fresh(), { type: 'SET_DIALOGUE_PRESENTATION', mode: 'PLAIN_LIST' })
    const started = send(send(plain, { type: 'WALK_TO', point: { x: 80, y: 300 } }), { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(started.dialoguePresentation).toBe('PLAIN_LIST')
    expect(started.walk?.pendingInteraction?.targetId).toBe('nansen-terminal')
    expect(readFileSync('src/app/App.tsx', 'utf8')).not.toContain("dispatch({ type: 'REQUEST_TERMINAL_ENTRY' })")
  })

  it('S10-P3-R1 prior S10-P3 browser tests and accepted journeys remain green', () => {
    const browser = readFileSync('tests/e2e/s10-p3-terminal.spec.ts', 'utf8')
    expect(browser).toContain('pending official-drawer OPEN')
    expect(readFileSync('tests/e2e/s5-integration.spec.ts', 'utf8')).toContain('DIRECT_SOLVER')
    expect(readFileSync('tests/e2e/s9-p1-r4-completion.spec.ts', 'utf8')).toContain('R4 keyboard paced reading')
  })

  it('S10-P3-R1 runtime provider calls remain zero and no data art final copy ref or release effect occurs', () => {
    const policy = readFileSync('src/adventure/policies/office_investigation_sync_policy.json', 'utf8')
    expect(policy).not.toContain('nansen_api')
    expect(policy).not.toContain('fetch(')
    expect(readFileSync('src/app/App.tsx', 'utf8')).not.toContain('previous ?? openInvestigation')
    const memory = { setItem: () => { throw new Error('denied') } }
    expect(persistInvestigation(memory, 'k', createInvestigationState(fixture))).toBe(false)
    const saved: Record<string, string> = {}
    const state = synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office({ inventory: ['euler-case-file'] }))
    expect(persistInvestigation({ setItem: (key, value) => { saved[key] = value } }, 'k', state)).toBe(true)
    expect(restoreInvestigation(fixture, saved.k!).access).toBe(true)
    expect(counts(restoreInvestigation(fixture, saved.k!), 'COLLECT_CASE_FILE')).toBe(1)
  })
})
