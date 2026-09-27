import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import scenario from '../../public/scenarios/euler-2023-false-exit/scenario.json'
import graph from '../../public/scenarios/euler-2023-false-exit/evidence-graph.json'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { createInvestigationState, investigationReducer, restoreInvestigation, type Command, type InvestigationState } from '../../src/investigation/state'
import { synchronizeOfficeMilestones } from '../../src/investigation/officeSync'
import type { CaseFixture } from '../../src/investigation/contracts'
import { ACCESSIBILITY_SAVE_KEY, commitAccessibilityPreferences, commitInvestigationSave, devLibraryAccess, readAccessibilityPreferences, type DurableStorage } from '../../src/adventure/durableStores'
import { ephemeralKeysIn } from '../../src/adventure/persistencePolicy'

const fixture = buildFrozenFixture(scenario as Parameters<typeof buildFrozenFixture>[0], graph)
function memory(): DurableStorage & { dump(): Map<string, string> } {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, dump: () => values }
}
function solve(f: CaseFixture): InvestigationState {
  let state = createInvestigationState(f)
  const commands: Command[] = [
    { type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' }, { type: 'STAGE_CARD', cardId: 'CARD.INCIDENT_DAI' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
    { type: 'SELECT_RESULT', recordId: f.openingRecordId }, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
    { type: 'READ_BRANCH', branch: 'SECOND' }, { type: 'SELECT_RESULT', recordId: f.proof.slots.LINK }, { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
    ...(['AMOUNT', 'RECEIVER', 'LINK'] as const).map((slot) => ({ type: 'ASSEMBLE' as const, slot, recordId: f.proof.slots[slot] })),
  ]
  for (const command of commands) state = investigationReducer(f, state, command)
  return state
}

describe('S12-P1-R1 durable stores', () => {
  it('writes an allowlisted investigation and refuses a weaker overwrite of a completed save', () => {
    const storage = memory()
    const done = solve(fixture)
    expect(done.complete).toBe(true)
    expect(commitInvestigationSave(storage, 'case', fixture, done)).toBe(true)
    const saved = JSON.parse(storage.getItem('case')!)
    expect(Object.keys(saved).sort()).toEqual(['commands', 'fixtureId', 'fixtureMode', 'fixtureOrigin', 'saveVersion'])
    expect(ephemeralKeysIn(saved)).toEqual([])
    expect(commitInvestigationSave(storage, 'case', fixture, createInvestigationState(fixture))).toBe(false)
    expect(restoreInvestigation(fixture, storage.getItem('case')).complete).toBe(true)
  })

  it('fails closed when storage is missing or the accessibility schema is wrong', () => {
    expect(commitInvestigationSave(null, 'case', fixture, createInvestigationState(fixture))).toBe(false)
    expect(readAccessibilityPreferences(null).dialoguePresentation).toBe('FULLSCREEN_CRT')
    const storage = memory()
    storage.setItem(ACCESSIBILITY_SAVE_KEY, JSON.stringify({ schema: 'trace-escape.accessibility.v1', instantText: true, walk: { x: 1 } }))
    expect(readAccessibilityPreferences(storage).instantText).toBe(false)
    expect(commitAccessibilityPreferences(storage, { instantText: true, highContrastHotspots: false, dialoguePresentation: 'PLAIN_LIST', reducedAnimation: false })).toBe(true)
    expect(readAccessibilityPreferences(storage)).toMatchObject({ instantText: true, dialoguePresentation: 'PLAIN_LIST' })
    expect(devLibraryAccess(false)).toBe(false)
    expect(devLibraryAccess(true)).toBe(true)
  })

  it('keeps office re-entry idempotent and out of the render path', () => {
    const office = { phase: 'COMPLETE' as const, inventory: ['euler-case-file' as const], piggyNoteReadState: 'BACK_READ' as const }
    const once = synchronizeOfficeMilestones(fixture, createInvestigationState(fixture), office)
    const twice = synchronizeOfficeMilestones(fixture, once, office)
    expect(twice.commands).toEqual(once.commands)
    expect(twice.sideLead.noteDiscovered).toBe(true)
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).not.toContain('if (synced !== caseState) setCaseState')
    expect(app).toContain('commitInvestigationSave')
    expect(app).not.toContain('commitAccessibilityPreferences')
    expect(app).not.toContain('trace-escape.accessibility.v1')
    expect(app).toContain('if (caseState && storageKey && fixture) commitInvestigationSave')
    expect(app).not.toContain('import.meta.env.DEV && caseState')
  })
})
