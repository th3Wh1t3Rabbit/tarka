import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildFrozenFixture, syntheticFixture } from '../../src/investigation/fixture'
import { compileRuntimeCatalogs, visibleInvestigation } from '../../src/investigation/catalog'
import { createInvestigationState, investigationReducer } from '../../src/investigation/state'
import { validateActiveSchema as validateSchema } from '../../scripts/nq5-r2/authority.mjs'

const base = 'public/scenarios/euler-2023-false-exit/'
const fixture = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json')), JSON.parse(readFileSync(base + 'evidence-graph.json')))
const act = (state, command) => investigationReducer(fixture, command.type === 'DISPATCH' ? investigationReducer(fixture, state, { type: 'REVIEW_RECEIPT' }) : state, command)
const locked = createInvestigationState(fixture), earned = act(locked, { type: 'EARN_ACCESS' }), collected = act(earned, { type: 'COLLECT_CASE_FILE' }), broad = act(collected, { type: 'DISPATCH', path: 'TERMINAL' })
const routed = act(act(act(broad, { type: 'SELECT_RESULT', recordId: fixture.openingRecordId }), { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }), { type: 'DISPATCH', path: 'TERMINAL' })
const candidate = act(act(routed, { type: 'COMPARE', recordId: fixture.openingRecordId }), { type: 'COMPARE', recordId: fixture.proof.slots.LINK })
const mistaken = act(candidate, { type: 'THEORY', theory: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' })
const exact = act(act(act(mistaken, { type: 'SELECT_RESULT', recordId: fixture.proof.slots.LINK }), { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' }), { type: 'DISPATCH', path: 'PLUNGER' })
let complete = act(exact, { type: 'READ_BRANCH', branch: 'SECOND' })
for (const slot of ['AMOUNT', 'RECEIVER', 'LINK']) complete = act(complete, { type: 'ASSEMBLE', slot, recordId: fixture.proof.slots[slot] })
const states = { locked, earned, broad, candidate, mistaken, exact, complete }

describe('R2 active-schema compilation: accepted Euler fixture/runtime catalogs', () => {
  for (const [checkpoint, state] of Object.entries(states)) for (const kind of ['clues', 'terminal', 'proof', 'results']) {
    it(`schema:${kind} fixture:EULER_2023_FALSE_EXIT catalog:${checkpoint} result:CONFORMS`, () => {
      const catalogs = compileRuntimeCatalogs(fixture, state)
      expect(validateSchema(kind, catalogs[kind])).toBe(true)
      if (checkpoint === 'complete') expect(state.complete).toBe(true)
      if (checkpoint === 'exact') expect(catalogs.proof.dead_end_candidates[0].first_falsifier.record_id).toBe(fixture.proof.slots.LINK)
    }, 20000)
  }
  it.each(['lens', 'effects', 'recipe', 'terminal-sections', 'receipt', 'folder', 'comparison', 'thread', 'route', 'proof', 'promotion'])('adversarial catalog:%s result:REJECTED', (name) => {
    const catalogs = compileRuntimeCatalogs(fixture, complete)
    let kind = 'clues'
    if (name === 'lens') catalogs.clues.question_lenses[0].id = 'ADMIN'
    if (name === 'effects') catalogs.clues.question_cards[0].filter_effects = []
    if (name === 'recipe') catalogs.clues.query_recipes[0].equivalent_input_paths = ['TERMINAL']
    if (name === 'terminal-sections') { kind = 'terminal'; catalogs.terminal.sections.push('DUPLICATE') }
    if (name === 'receipt') { kind = 'terminal'; catalogs.terminal.query_tray.pre_dispatch_query_receipt.no_hidden_filter_mutation = false }
    if (name === 'folder') { kind = 'results'; catalogs.results.candidate_folders[0].cannot_prove = [] }
    if (name === 'comparison') { kind = 'results'; catalogs.results.comparison_trays[0].candidate_folder_ids = ['ONE'] }
    if (name === 'thread') { kind = 'results'; catalogs.results.trace_threads[0].status = 'GUILTY' }
    if (name === 'route') { kind = 'proof'; catalogs.proof.route_candidates[0].source_record_ids = [] }
    if (name === 'proof') { kind = 'proof'; catalogs.proof.final_assembly.contextual_may_fill = true }
    if (name === 'promotion') catalogs.clues.question_cards[0].lead_promoted = true
    expect(() => validateSchema(kind, catalogs[kind])).toThrow()
  }, 20000)
  it('rejects synthetic-as-Euler conformance instead of relabeling synthetic history', () => {
    const synthetic = syntheticFixture(fixture)
    expect(() => compileRuntimeCatalogs(synthetic, createInvestigationState(synthetic))).toThrow()
  })
  it.each(['ACCEPTED_FROZEN', 'SYNTHETIC_TEST'])('no-leak projection and direct-identifier adversaries:%s', (mode) => {
    const current = mode === 'SYNTHETIC_TEST' ? syntheticFixture(fixture) : fixture
    const state = investigationReducer(current, createInvestigationState(current), { type: 'EARN_ACCESS' })
    const target = current.records.find((record) => record.id === current.proof.slots.LINK)
    const visible = visibleInvestigation(current, state), text = JSON.stringify(visible)
    for (const value of [target.transactionHash, target.destination, `CLUE.PROOF.${target.id}`]) expect(text).not.toContain(value)
    for (const command of [{ type: 'STAGE_CLUE', clueId: `CLUE.RESULT.${target.id}` }, { type: 'SELECT_RESULT', recordId: target.id }, { type: 'PIN', recordId: target.id }, { type: 'SAVE_LEAD', recordId: target.id }, { type: 'COMPARE', recordId: target.id }, { type: 'ADD_FILTER', filter: { field: 'TRANSACTION', value: target.transactionHash, origin: 'PLAYER_FILTER', sourceId: 'MANUAL' } }, { type: 'ADD_FILTER', filter: { field: 'DESTINATION', value: target.destination, origin: 'PLAYER_FILTER', sourceId: 'MANUAL' } }, { type: 'ADD_FILTER', filter: { field: 'RECORD_SET', value: target.id, origin: 'PLAYER_FILTER', sourceId: 'MANUAL' } }]) {
      const rejected = investigationReducer(current, state, command)
      expect(rejected.query).toEqual(state.query); expect(rejected.discoveredRecords).toEqual(state.discoveredRecords); expect(rejected.selectedRecordId).toBeNull(); expect(rejected.comparison).toEqual([]); expect(rejected.pinned).toEqual([])
    }
  })
})
