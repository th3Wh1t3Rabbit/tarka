import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { availableCards, createInvestigationState, investigationReducer, terminalCapabilities, visibleClues } from '../../src/investigation/state'
import { SIDE_LEAD_HIGH_LEVEL_VIEW, SIDE_LEAD_PROVENANCE_LATE_BOUND, SIDE_LEAD_SOURCE_CLASS, SIDE_LEAD_TECHNICAL_VIEW, SIDE_LEAD_TOKENS } from '../../src/investigation/sideLead'

const base = 'public/scenarios/euler-2023-false-exit/'
const frozen = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json', 'utf8')), JSON.parse(readFileSync(base + 'evidence-graph.json', 'utf8')))

describe('S9-P1 E02-neutral optional side-lead boundary', () => {
  it('starts undiscovered with no selection', () => {
    const s = createInvestigationState(frozen)
    expect(s.sideLead).toEqual({ noteDiscovered: false, selectedTokenId: null })
    expect(terminalCapabilities(frozen, s).sideLeadVisible).toBe(false)
  })
  it('discovers the note idempotently without touching case state', () => {
    const e = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    const before = investigationReducer(frozen, e, { type: 'COLLECT_CASE_FILE' })
    const after = investigationReducer(frozen, before, { type: 'COLLECT_SIDE_NOTE' })
    expect(after.sideLead.noteDiscovered).toBe(true)
    expect(after.discoveredClues).toEqual(before.discoveredClues)
    expect(after.discoveredRecords).toEqual(before.discoveredRecords)
    expect(after.assembly).toEqual({})
    expect(terminalCapabilities(frozen, after).sideLeadVisible).toBe(true)
    const again = investigationReducer(frozen, after, { type: 'COLLECT_SIDE_NOTE' })
    expect(again.commands.filter((c) => c.type === 'COLLECT_SIDE_NOTE')).toHaveLength(1)
  })
  it('defines exactly one optional token identity with late-bound provenance', () => {
    expect(SIDE_LEAD_TOKENS).toHaveLength(1)
    expect(SIDE_LEAD_TOKENS[0]!.id).toBe('FICTIONAL.TOKEN.ALPHA')
    expect(SIDE_LEAD_TOKENS[0]!.provenance).toBe('LATE_BOUND')
    expect(SIDE_LEAD_TOKENS[0]!.name).toMatch(/LATE-BOUND/)
    expect(SIDE_LEAD_TOKENS[0]!.address).toMatch(/LATE-BOUND/)
    expect(`${SIDE_LEAD_TOKENS[0]!.name} ${SIDE_LEAD_TOKENS[0]!.address}`).not.toMatch(/0x[0-9a-fA-F]{4,}|\$|888|INVALID-TRAINING|Powered by Nansen/)
  })
  it('replaces optional token selection and rejects unknown ids', () => {
    const e = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    const blind = investigationReducer(frozen, e, { type: 'SELECT_SIDE_TOKEN', tokenId: SIDE_LEAD_TOKENS[0]!.id })
    expect(blind.error).toBeTruthy()
    expect(blind.sideLead.selectedTokenId).toBeNull()
    const d = investigationReducer(frozen, e, { type: 'COLLECT_SIDE_NOTE' })
    const chosen = investigationReducer(frozen, d, { type: 'SELECT_SIDE_TOKEN', tokenId: SIDE_LEAD_TOKENS[0]!.id })
    expect(chosen.sideLead.selectedTokenId).toBe(SIDE_LEAD_TOKENS[0]!.id)
    expect(chosen.assembly).toEqual({})
  })
  it('never enters Hero clues, cards, records, questions, theories, proof, or completion', () => {
    const e = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    const c = investigationReducer(frozen, e, { type: 'COLLECT_CASE_FILE' })
    const d = investigationReducer(frozen, c, { type: 'COLLECT_SIDE_NOTE' })
    const sideIds = [...SIDE_LEAD_TOKENS.map((t) => t.id), 'fictional-token-note']
    for (const id of sideIds) {
      expect(visibleClues(frozen, d).some((clue) => clue.id === id)).toBe(false)
      expect(availableCards(frozen, d).some((card) => card.id === id || card.prerequisites.includes(id))).toBe(false)
    }
    expect(d.discoveredRecords).toEqual([])
    expect(d.assembly).toEqual({})
    expect(d.workingTheory).toBeNull()
    expect(d.complete).toBe(false)
    expect(frozen.clues.some((clue) => clue.id.includes('FICTIONAL'))).toBe(false)
    expect(frozen.records).toHaveLength(6)
    expect(JSON.stringify(frozen)).not.toMatch(/FICTIONAL/)
  })
  it('keeps provenance late-bound with no E02 values and no permanent fiction claim', () => {
    const views = JSON.stringify([SIDE_LEAD_HIGH_LEVEL_VIEW, SIDE_LEAD_TECHNICAL_VIEW, SIDE_LEAD_TOKENS])
    expect(SIDE_LEAD_SOURCE_CLASS).toBe('OPTIONAL OFFICE-NOTE TOKEN LEAD / NOT EULER CASE EVIDENCE')
    expect(views).toContain(SIDE_LEAD_PROVENANCE_LATE_BOUND)
    expect(views).toMatch(/LATE-BOUND|late-bound/)
    expect(views).not.toMatch(/INVALID-TRAINING/)
    expect(views).not.toMatch(/Powered by Nansen/)
    expect(views).not.toContain('No Nansen provenance exists')
    expect(views).not.toContain('FICTIONAL_OFFICE_NOTE')
    expect(views).not.toMatch(/0x[0-9a-fA-F]{4,}|\$[0-9]|888,?888/)
    expect(views).not.toMatch(/rdpk-|nansen_api|BEGIN .*PRIVATE KEY|mnemonic/i)
  })
  it('late-bound provenance fields can exist without entering or mutating Hero state', () => {
    const overlay = {
      ...SIDE_LEAD_TOKENS[0]!,
      provider: 'LATE_BOUND',
      snapshotUtc: 'LATE_BOUND',
      attribution: 'LATE_BOUND',
    }
    const e = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    const before = investigationReducer(frozen, e, { type: 'COLLECT_CASE_FILE' })
    const read = investigationReducer(frozen, before, { type: 'COLLECT_SIDE_NOTE' })
    const chosen = investigationReducer(frozen, read, { type: 'SELECT_SIDE_TOKEN', tokenId: overlay.id })
    expect(overlay.provenance).toBe('LATE_BOUND')
    expect(chosen.sideLead.selectedTokenId).toBe(overlay.id)
    expect(chosen.discoveredClues).toEqual(before.discoveredClues)
    expect(chosen.discoveredRecords).toEqual(before.discoveredRecords)
    expect(chosen.assembly).toEqual({})
    expect(chosen.query).toEqual(before.query)
    expect(chosen.workingTheory).toBeNull()
    expect(chosen.complete).toBe(false)
    expect(JSON.stringify([chosen.discoveredClues, chosen.discoveredRecords, chosen.assembly, chosen.query, chosen.workingTheory])).not.toMatch(/LATE_BOUND|FICTIONAL\.TOKEN|0xd4c4407f/)
    expect(`${overlay.address} ${overlay.name}`).not.toMatch(/0x[0-9a-fA-F]{4,}|Powered by Nansen|\$[0-9]/)
  })
})
