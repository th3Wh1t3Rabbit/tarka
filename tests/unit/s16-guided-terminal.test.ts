import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { attachS13Runtime, buildFrozenFixture } from '../../src/investigation/fixture'
import type { S13Runtime } from '../../src/investigation/s13'
import { deriveS16TerminalContract, S16_COMMAND_PRESENTATION, s16SearchableRecords } from '../../src/investigation/s16'
import { S16_OPTIONAL_QUERY_IDS, S16_QUERY_PLANS, S16_TOKEN_SYMBOLS, createS16Run, s16AllRecords, s16ExplainRecord, s16RecordsForRun, s16RunIsValid, s16TokenSymbol, type S16QueryId } from '../../src/investigation/s16Queries'
import { createInvestigationState, exportLocalSave, fixtureOrigin, investigationReducer, restoreInvestigation, validatedProofAssembly, type Command, type InvestigationState } from '../../src/investigation/state'

const fromPublic = (name: string) => JSON.parse(readFileSync(`public/scenarios/euler-2023-false-exit/${name}`, 'utf8'))
const runtime = fromPublic('s13-runtime.json') as S13Runtime
const fixture = attachS13Runtime(buildFrozenFixture(fromPublic('scenario.json'), fromPublic('evidence-graph.json')), runtime)
const reduce = (state: InvestigationState, command: Command) => investigationReducer(fixture, state, command)
const access = () => reduce(createInvestigationState(fixture), { type: 'EARN_ACCESS' })
const fileRead = () => reduce(access(), { type: 'COLLECT_CASE_FILE' })
const run = (state: InvestigationState, planId: S16QueryId) => reduce(state, { type: 'S16_RUN_QUERY', planId, semantics: 'R2', origin: 'CURRENT' })
const throughQ2 = () => run(fileRead(), 'Q2')
const addRoute = (input: InvestigationState) => {
  let state = input
  const q2 = state.s16Runs.find(item => item.planId === 'Q2')!
  const early = runtime.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')!
  state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
  state = reduce(state, { type: 'S16_ADD_START', runId: q2.id, recordId: early.recordId })
  state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: runtime.proof.exactRecord.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
  return reduce(state, { type: 'S16_ADD_ROUTE', runId: q2.id, recordId: runtime.proof.exactRecord.recordId })
}
const throughQ3 = () => run(addRoute(throughQ2()), 'Q3')

describe('S16-R1 native query owner', () => {
  it('matches the reviewed deterministic explanations for all 98 records before and after the file', () => {
    const entries = [false, true].flatMap(file => s16AllRecords(runtime).map(record => ({
      recordId: record.recordId,
      asset: s16TokenSymbol(record),
      file,
      ...s16ExplainRecord(runtime, record, file),
    })))
    expect(entries).toHaveLength(196)
    expect(createHash('sha256').update(JSON.stringify(entries)).digest('hex')).toBe('9aa412ccdbcc168cd7f5b0358a055f280eb2225ec25e65d692be706d27279f95')
  })

  it('changes explanations because accepted fields changed without silently changing proof', () => {
    const mutate = (recordId: string, change: (copy: S13Runtime, record: S13Runtime['caseCorpus'][number]) => void) => {
      const copy = structuredClone(runtime)
      const record = copy.caseCorpus.find(item => item.recordId === recordId)!
      const before = s16ExplainRecord(runtime, runtime.caseCorpus.find(item => item.recordId === recordId)!, true)
      change(copy, record)
      const after = s16ExplainRecord(copy, record, true)
      expect(after).not.toEqual(before)
      expect(copy.proof.exactRecord.recordId).toBe(runtime.proof.exactRecord.recordId)
      return { before, after }
    }

    const nonDai = s16AllRecords(runtime).find(record => s16TokenSymbol(record) === 'WBTC')!
    const token = mutate(nonDai.recordId, (_copy, record) => { record.token_address = '0x6b175474e89094c44da98b954eedeac495271d0f' })
    expect(token.after.limits).not.toContain('not DAI')

    const amountRecord = s16AllRecords(runtime)[0]!
    const changedAmount = mutate(amountRecord.recordId, (_copy, record) => { record.transfer_amount = '0.125' })
    expect(changedAmount.after.shows).toContain('0.125')

    const reverseRecord = s16AllRecords(runtime).find(record => s16ExplainRecord(runtime, record, false).rule === 'reverse-in-transaction')!
    const reverseFacts = s16ExplainRecord(runtime, reverseRecord, false).facts
    const changedReverse = mutate(reverseRecord.recordId, (copy) => {
      const reverse = copy.caseCorpus.find(item => item.recordId === reverseFacts.reverseIds[0])!
      reverse.from_address = '0x1111111111111111111111111111111111111111'
    })
    expect(changedReverse.after.rule).not.toBe('reverse-in-transaction')

    const repeated = s16AllRecords(runtime).find(record => s16ExplainRecord(runtime, record, false).rule === 'repeated-route')!
    const changedGrouping = mutate(repeated.recordId, (copy, record) => {
      for (const item of copy.caseCorpus) if (item.from_address === record.from_address && item.to_address === record.to_address) item.transaction_hash = record.transaction_hash ?? null
    })
    expect(changedGrouping.after.rule).not.toBe('repeated-route')

    const hero = runtime.caseCorpus.find(record => record.recordId === 'HERO.EXACT_MAIN_RECEIVER')!
    const changedGrade = mutate(hero.recordId, (_copy, record) => { record.recordKind = 'TRANSFER_EVENT' })
    expect(changedGrade.after.limits).toContain('above the 8,000,000–9,500,000 DAI search range')
  })

  it('derives the immutable two-query funnels from accepted record IDs', () => {
    const first = createS16Run(runtime, 'Q2', [])
    const second = createS16Run(runtime, 'Q3', [first])
    expect(first.countStages).toEqual([98, 74, 3])
    expect(second.countStages).toEqual([3, 2, 1])
    expect(first.inputIds).toHaveLength(98)
    expect(first.matchingIds).toHaveLength(3)
    expect(second.matchingIds).toEqual([runtime.proof.exactRecord.recordId])
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.inputIds)).toBe(true)
    expect(s16RunIsValid(runtime, first, [])).toBe(true)
    expect(s16RunIsValid(runtime, { ...first, matchingIds: first.matchingIds.slice(1) }, [])).toBe(false)
  })

  it('evaluates the ten useful optional questions with their audited real counts', () => {
    const expected: Record<(typeof S16_OPTIONAL_QUERY_IDS)[number], number> = { A_DAI: 74, A_OTHER: 24, A_LARGE: 12, R_REPEAT: 16, R_FIRST: 7, R_VAULT: 4, S_BEFORE: 10, S_AFTER: 88, P_START: 8, P_LINK: 2 }
    expect(S16_OPTIONAL_QUERY_IDS).toHaveLength(10)
    for (const planId of S16_OPTIONAL_QUERY_IDS) {
      const actual = createS16Run(runtime, planId, [])
      expect(actual.matchingIds, planId).toHaveLength(expected[planId])
      expect(s16RecordsForRun(runtime, actual).map(record => record.recordId)).toEqual(actual.matchingIds)
    }
  })

  it('maps all five admitted Ethereum token contracts exactly', () => {
    const records = s16SearchableRecords(runtime)
    const counts = records.reduce<Record<string, number>>((result, record) => { const symbol = s16TokenSymbol(record); result[symbol] = (result[symbol] ?? 0) + 1; return result }, {})
    expect(counts).toEqual({ DAI: 74, WBTC: 5, wstETH: 7, stETH: 7, USDC: 5 })
    expect(Object.keys(S16_TOKEN_SYMBOLS)).toHaveLength(5)
    expect(records.some(record => s16TokenSymbol(record) === 'UNIDENTIFIED')).toBe(false)
  })
})

describe('S16-R1 reducer flow', () => {
  it('records only the two actual guided runs and files three findings atomically', () => {
    let state = throughQ2()
    expect(state.s16Runs.map(item => item.planId)).toEqual(['Q2'])
    expect(state.s13FilterStage).toBe(4)
    state = addRoute(state)
    state = run(state, 'Q3')
    expect(state.s16Runs.map(item => item.planId)).toEqual(['Q2', 'Q3'])
    expect(state.s13FilterStage).toBe(6)
    state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: runtime.proof.exactRecord.recordId })
    state = reduce(state, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId })
    expect(state.complete).toBe(false)
    expect(state.assembly).toEqual({})
    state = reduce(state, { type: 'S16_FILE_FINDINGS' })
    expect(state.complete).toBe(true)
    expect(state.assembly).toEqual(fixture.proof.slots)
    expect(state.commands.filter(command => command.type === 'S16_FILE_FINDINGS')).toHaveLength(1)
    expect(reduce(state, { type: 'S16_FILE_FINDINGS' }).commands).toEqual(state.commands)
  })

  it('validates every fixture-owned proof slot before publishing an atomic report', () => {
    expect(validatedProofAssembly(fixture)).toEqual(fixture.proof.slots)
    const missing = structuredClone(fixture)
    missing.proof.slots.AMOUNT = 'MISSING'
    expect(validatedProofAssembly(missing)).toBeNull()
    const wrongGrade = structuredClone(fixture)
    wrongGrade.records.find(record => record.id === wrongGrade.proof.slots.LINK)!.grade = 'CONTEXTUAL'
    expect(validatedProofAssembly(wrongGrade)).toBeNull()
    const wrongBinding = structuredClone(fixture)
    wrongBinding.proof.linkDestination = '0x0000000000000000000000000000000000000000'
    expect(validatedProofAssembly(wrongBinding)).toBeNull()
  })

  it('keeps navigation and optional queries independent from mandatory progress', () => {
    let state = throughQ2()
    const progress = { stage: state.s13FilterStage, start: state.s16StartAdded, route: state.s16RouteAdded, exact: state.s13VerifiedRecordId }
    state = reduce(state, { type: 'SECTION', section: 'EXPLORE' })
    state = run(state, 'A_DAI')
    state = reduce(state, { type: 'SECTION', section: 'LEDGER' })
    state = reduce(state, { type: 'S16_SELECT_RUN', runId: state.s16Runs[0]!.id })
    expect({ stage: state.s13FilterStage, start: state.s16StartAdded, route: state.s16RouteAdded, exact: state.s13VerifiedRecordId }).toEqual(progress)
    expect(state.s16Runs.map(item => item.planId)).toEqual(['Q2', 'A_DAI'])
  })

  it('saves either later view before the earlier clue and preserves the selected view across reloads', () => {
    let state = throughQ2()
    const q2 = state.s16Runs[0]!
    const early = runtime.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')!
    const support = runtime.proof.contextualCorroboration
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: support.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
    state = reduce(state, { type: 'S16_ADD_ROUTE', runId: q2.id, recordId: support.recordId })
    expect(state).toMatchObject({ s16StartAdded: false, s16RouteAdded: true, s16RouteRecordId: support.recordId })
    expect(state.s16RecordContext?.recordId).toBe(support.recordId)
    const blocked = run(state, 'Q3')
    expect(blocked.s16Runs.map(item => item.planId)).toEqual(['Q2'])
    state = restoreInvestigation(fixture, exportLocalSave(restoreInvestigation(fixture, exportLocalSave(state))))
    expect(state).toMatchObject({ s16StartAdded: false, s16RouteAdded: true, s16RouteRecordId: support.recordId })
    expect(state.s16RecordContext?.recordId).toBe(support.recordId)
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
    state = reduce(state, { type: 'S16_ADD_START', runId: q2.id, recordId: early.recordId })
    expect(state.s16RecordContext?.recordId).toBe(early.recordId)
    state = run(state, 'Q3')
    expect(state.s16Runs.map(item => item.planId)).toEqual(['Q2', 'Q3'])
  })

  it('keeps all valid sections reachable after findings are filed', () => {
    let state = throughQ3()
    state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: runtime.proof.exactRecord.recordId })
    state = reduce(state, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId })
    state = reduce(state, { type: 'S16_FILE_FINDINGS' })
    expect(deriveS16TerminalContract(fixture, state).sections).toEqual(['CASE', 'RESULTS', 'EXPLORE', 'LEDGER'])
    for (const section of ['RESULTS', 'EXPLORE', 'LEDGER'] as const) expect(deriveS16TerminalContract(fixture, reduce(state, { type: 'SECTION', section })).section).toBe(section)
  })

  it('never promotes a contextual same-hash record into exact proof', () => {
    const contextual = runtime.caseCorpus.find(record => record.recordId !== runtime.proof.exactRecord.recordId && record.transaction_hash === runtime.proof.exactRecord.transaction_hash)
    expect(contextual).toBeDefined()
    let state = throughQ3()
    state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: contextual!.recordId })
    state = reduce(state, { type: 'S13_VERIFY_RECORD', recordId: contextual!.recordId })
    expect(state.s13VerifiedRecordId).toBeNull()
    expect(state.exactEventIds).toEqual([])
    expect(state.assembly).toEqual({})
  })

  it('keeps the BRCG side lead isolated from Euler completion', () => {
    let state = reduce(access(), { type: 'COLLECT_SIDE_NOTE' })
    state = reduce(state, { type: 'SELECT_SIDE_TOKEN', tokenId: 'BRCG' })
    state = reduce(state, { type: 'REVIEW_BRCG_MARKET' })
    state = reduce(state, { type: 'REVIEW_BRCG_PROOF' })
    expect(state.sideLead.resolved).toBe(true)
    expect(state.complete).toBe(false)
    expect(state.s16Runs).toEqual([])
  })

  it('rejects stale record actions and removes legacy hunch state from the MVP filing path', () => {
    let state = throughQ2()
    const q2 = state.s16Runs[0]!
    const early = runtime.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')!
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'ALL', page: 0 } })
    state = reduce(state, { type: 'S16_ADD_START', runId: q2.id, recordId: early.recordId })
    expect(state.s16StartAdded).toBe(false)
    state = addRoute(throughQ2())
    state = reduce(state, { type: 'THEORY', theory: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' })
    state = run(state, 'Q3')
    const q3 = state.s16Runs.find(item => item.planId === 'Q3')!
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: runtime.proof.exactRecord.recordId, origin: { kind: 'RUN', runId: q3.id, page: 0 } })
    state = reduce(state, { type: 'S16_VERIFY_CONNECTION', runId: q3.id, recordId: runtime.proof.exactRecord.recordId })
    expect(state.workingTheory).toBeNull()
    expect(state.rejectedTheory).toBeNull()
    state = reduce(state, { type: 'S16_FILE_FINDINGS' })
    expect(state.complete).toBe(true)
  })
})

describe('S16-R1 versioned persistence', () => {
  it('exports v5 run commands and restores exact selected run snapshots', () => {
    let state = throughQ2()
    state = run(state, 'A_DAI')
    state = reduce(state, { type: 'S16_SELECT_RUN', runId: state.s16Runs[0]!.id })
    const saved = JSON.parse(exportLocalSave(state))
    expect(saved.saveVersion).toBe(5)
    const restored = restoreInvestigation(fixture, JSON.stringify(saved))
    expect(restored.s16Runs).toEqual(state.s16Runs)
    expect(restored.s16SelectedRunId).toBe(state.s16Runs[0]!.id)
  })

  it('migrates a real v2 three-query history to two truthful guided runs and earned route facts', () => {
    const entries: Command[] = [
      { type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_CANDIDATES' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_RECEIPT' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
      { type: 'S13_SELECT_RECORD', recordId: runtime.proof.exactRecord.recordId }, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId },
      { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: fixture.proof.slots.AMOUNT },
    ]
    const source = { fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture) }
    const restored = restoreInvestigation(fixture, JSON.stringify({ ...source, saveVersion: 2, commands: { source, entries } }))
    expect(restored.s16Runs.map(item => item.planId)).toEqual(['Q2', 'Q3'])
    expect(restored.s16StartAdded).toBe(true)
    expect(restored.s16RouteAdded).toBe(true)
    expect(restored.s13VerifiedRecordId).toBe(runtime.proof.exactRecord.recordId)
    expect(restored.assembly).toEqual({ AMOUNT: fixture.proof.slots.AMOUNT })
  })

  it('fails closed atomically for unknown, forged, wrong-origin, and impossible histories', () => {
    const initial = createInvestigationState(fixture)
    const source = { fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture) }
    const envelope = (entries: unknown[], overrides = {}) => JSON.stringify({ ...source, ...overrides, saveVersion: 4, commands: { source, entries } })
    expect(restoreInvestigation(fixture, envelope([{ type: 'UNKNOWN' }]))).toEqual(initial)
    expect(restoreInvestigation(fixture, envelope([{ type: 'EARN_ACCESS' }, { type: 'S16_RUN_QUERY', planId: 'Q3', semantics: 'R2', origin: 'CURRENT' }]))).toEqual(initial)
    expect(restoreInvestigation(fixture, envelope([{ type: 'EARN_ACCESS' }], { fixtureId: 'forged' }))).toEqual(initial)
    const valid = JSON.parse(exportLocalSave(throughQ2()))
    valid.commands.entries.push({ type: 'S16_SELECT_RUN', runId: 'S16-RUN-9999' })
    expect(restoreInvestigation(fixture, JSON.stringify(valid))).toEqual(initial)
  })

  it('validates original v2 receipt prerequisites before translating any history', () => {
    const initial = createInvestigationState(fixture)
    const source = { fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture) }
    const missingReceiptReview: Command[] = [
      { type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' }, { type: 'DISPATCH', path: 'TERMINAL' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_CANDIDATES' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
    ]
    const restored = restoreInvestigation(fixture, JSON.stringify({ ...source, saveVersion: 2, commands: { source, entries: missingReceiptReview } }))
    expect(restored).toEqual(initial)
    expect(restored.s16Runs).toEqual([])
    expect(restored.s16StartAdded).toBe(false)
  })

  it('retains valid interrupted v2 history without relabeling it as a current query', () => {
    const source = { fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture) }
    const entries: Command[] = [
      { type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_CANDIDATES' }, { type: 'REVIEW_RECEIPT' },
    ]
    const migrated = restoreInvestigation(fixture, JSON.stringify({ ...source, saveVersion: 2, commands: { source, entries } }))
    expect(migrated.access).toBe(true)
    expect(migrated.discoveredClues).toEqual(fixture.startingClueIds)
    expect(migrated.s16Runs).toEqual([])
    expect(migrated.s16LegacyHistory).toEqual([
      { group: 'FLOOD_ORIENT', status: 'COMPLETED', receiptReviewed: true },
      { group: 'CANDIDATES_CASE_FILE_BOUNDS', status: 'DRAFT', receiptReviewed: true },
    ])
    const twice = restoreInvestigation(fixture, exportLocalSave(restoreInvestigation(fixture, exportLocalSave(migrated))))
    expect(twice.s16LegacyHistory).toEqual(migrated.s16LegacyHistory)
    expect(twice.commands.some(command => command.type === 'DISPATCH' || command.type === 'REVIEW_RECEIPT' || command.type === 'STAGE_CARD')).toBe(false)
  })

  it('preserves R1 query meanings while fresh R2 repeat queries use distinct transactions', () => {
    const source = { fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture) }
    const entries = [
      { type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' },
      { type: 'S16_RUN_QUERY', planId: 'R_REPEAT' },
      { type: 'S16_RUN_QUERY', planId: 'P_VIEWS' },
    ]
    let restored = restoreInvestigation(fixture, JSON.stringify({ ...source, saveVersion: 3, commands: { source, entries } }))
    expect(restored.s16Runs.map(item => [item.planId, item.matchingIds.length, item.semantics])).toEqual([['R_REPEAT', 22, 'R1'], ['P_VIEWS', 70, 'R1']])
    restored = restoreInvestigation(fixture, exportLocalSave(restored))
    expect(restored.s16Runs.map(item => item.matchingIds.length)).toEqual([22, 70])
    restored = run(restored, 'R_REPEAT')
    expect(restored.s16Runs.at(-1)).toMatchObject({ planId: 'R_REPEAT', semantics: 'R2' })
    expect(restored.s16Runs.at(-1)!.matchingIds).toHaveLength(16)
  })

  it('never lets more than one hundred optional runs starve either guided query across reloads', () => {
    let state = fileRead()
    for (let index = 0; index < 105; index += 1) state = run(state, 'A_DAI')
    state = restoreInvestigation(fixture, exportLocalSave(state))
    state = run(state, 'Q2')
    expect(state.s16Runs.find(item => item.planId === 'Q2')?.countStages).toEqual([98, 74, 3])
    for (let index = 0; index < 105; index += 1) state = run(state, 'S_AFTER')
    state = restoreInvestigation(fixture, exportLocalSave(state))
    state = addRoute(state)
    state = run(state, 'Q3')
    expect(state.s16Runs.find(item => item.planId === 'Q3')?.countStages).toEqual([3, 2, 1])
    expect(state.s16Runs.filter(item => item.mode === 'GUIDED')).toHaveLength(2)
  })

  it('round-trips nonzero list/source context twice and continues from that exact origin', () => {
    let state = throughQ2()
    const q2 = state.s16Runs[0]!
    const recordId = q2.matchingIds[2]!
    state = reduce(state, { type: 'S16_SET_PAGE', key: q2.id, page: 2 })
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId, origin: { kind: 'RUN', runId: q2.id, page: 2 } })
    state = reduce(state, { type: 'S16_SOURCE_PAGE', page: 2 })
    state = restoreInvestigation(fixture, exportLocalSave(restoreInvestigation(fixture, exportLocalSave(state))))
    expect(state.s16Pages[q2.id]).toBe(2)
    expect(state.s16RecordContext).toEqual({ recordId, origin: { kind: 'RUN', runId: q2.id, page: 2 }, sourcePage: 2 })
    state = reduce(state, { type: 'S16_SOURCE_PAGE', page: 3 })
    expect(state.s16RecordContext?.sourcePage).toBe(3)
  })
})

describe('S16-R3 source-bound legacy persistence', () => {
  const source = { fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture) }
  const envelope = (entries: unknown[], saveVersion = 2) => JSON.stringify({ ...source, saveVersion, commands: { source, entries } })
  const completeQueries: Command[] = [
    { type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' },
    { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
    { type: 'STAGE_CARD', cardId: 'CARD.S13_CANDIDATES' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
    { type: 'STAGE_CARD', cardId: 'CARD.S13_RECEIPT' }, { type: 'REVIEW_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' },
    { type: 'S13_SELECT_RECORD', recordId: runtime.proof.exactRecord.recordId }, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId },
  ]

  it('conserves the complete admitted v2 oracle matrix across two reloads and continued play', () => {
    const q1 = completeQueries.slice(0, 5)
    const q2 = completeQueries.slice(0, 8)
    const q3 = completeQueries.slice(0, 11)
    const verified = completeQueries
    const cases: Array<[string, Command[]]> = [
      ['access-only', [{ type: 'EARN_ACCESS' }]],
      ['file-and-clues', completeQueries.slice(0, 2)],
      ['flood-complete', q1],
      ['candidate-complete', q2],
      ['receipt-complete', q3],
      ['receipt-reviewed-draft', [...completeQueries.slice(0, 2), { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' }, { type: 'REVIEW_RECEIPT' }]],
      ['repeated-draft', [...completeQueries.slice(0, 2), { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' }, { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' }]],
      ['navigation-interleaved', [...completeQueries.slice(0, 3), { type: 'SECTION', section: 'EXPLORE' }, ...completeQueries.slice(3, 5)]],
      ['selected-source', [...q3, { type: 'S13_SELECT_RECORD', recordId: runtime.proof.exactRecord.recordId }]],
      ['exact-verification', verified],
      ['partial-amount', [...verified, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: fixture.proof.slots.AMOUNT }]],
      ['partial-receiver', [...verified, { type: 'ASSEMBLE', slot: 'RECEIVER', recordId: fixture.proof.slots.RECEIVER }]],
      ['partial-link-ready', [...verified, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: fixture.proof.slots.AMOUNT }, { type: 'ASSEMBLE', slot: 'RECEIVER', recordId: fixture.proof.slots.RECEIVER }]],
      ['full-findings', [...verified, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: fixture.proof.slots.AMOUNT }, { type: 'ASSEMBLE', slot: 'RECEIVER', recordId: fixture.proof.slots.RECEIVER }, { type: 'ASSEMBLE', slot: 'LINK', recordId: fixture.proof.slots.LINK }]],
      ['optional-brcg', [{ type: 'EARN_ACCESS' }, { type: 'COLLECT_SIDE_NOTE' }, { type: 'SELECT_SIDE_TOKEN', tokenId: 'BRCG' }, { type: 'REVIEW_BRCG_MARKET' }, { type: 'REVIEW_BRCG_PROOF' }]],
    ]
    const earned = (state: InvestigationState) => ({ access: state.access, clues: state.discoveredClues, records: state.discoveredRecords, stage: state.s13FilterStage, selected: state.s13SelectedRecordId, verified: state.s13VerifiedRecordId, exact: state.exactEventIds, assembly: state.assembly, complete: state.complete, sideLead: state.sideLead, legacy: state.s16LegacyHistory })
    for (const [name, entries] of cases) {
      const migrated = restoreInvestigation(fixture, envelope(entries))
      expect(migrated.s16LegacySource?.entries, name).toEqual(entries)
      const once = restoreInvestigation(fixture, exportLocalSave(migrated))
      const twice = restoreInvestigation(fixture, exportLocalSave(once))
      expect(earned(twice), name).toEqual(earned(migrated))
      const continued = reduce(twice, { type: 'SECTION', section: 'EXPLORE' })
      expect(continued.section, name).toBe('EXPLORE')
      expect(restoreInvestigation(fixture, exportLocalSave(continued)).section, name).toBe('EXPLORE')
    }
  })

  it('preserves a legal partial finding through two exports, reloads, and continued current play', () => {
    const entries: Command[] = [...completeQueries, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: fixture.proof.slots.AMOUNT }]
    let state = restoreInvestigation(fixture, envelope(entries))
    expect(state).toMatchObject({ access: true, s13FilterStage: 6, s13VerifiedRecordId: runtime.proof.exactRecord.recordId, assembly: { AMOUNT: fixture.proof.slots.AMOUNT }, complete: false })
    state = restoreInvestigation(fixture, exportLocalSave(state))
    state = restoreInvestigation(fixture, exportLocalSave(state))
    expect(state.assembly).toEqual({ AMOUNT: fixture.proof.slots.AMOUNT })
    expect(state.discoveredClues).toHaveLength(8)
    state = run(state, 'A_DAI')
    expect(state.s16Runs.at(-1)).toMatchObject({ planId: 'A_DAI', origin: 'CURRENT' })
    expect(restoreInvestigation(fixture, exportLocalSave(state)).assembly).toEqual({ AMOUNT: fixture.proof.slots.AMOUNT })
  })

  it('preserves repeated and navigation-interleaved v2 drafts under their original language', () => {
    const repeated: Command[] = [
      { type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' },
      { type: 'STAGE_CARD', cardId: 'CARD.S13_FLOOD_ORIENT' },
    ]
    const repeatedState = restoreInvestigation(fixture, envelope(repeated))
    expect(repeatedState.access).toBe(true)
    expect(repeatedState.discoveredClues).toHaveLength(6)
    expect(repeatedState.s16LegacyHistory).toEqual([{ group: 'FLOOD_ORIENT', status: 'DRAFT', receiptReviewed: false }])
    expect(restoreInvestigation(fixture, exportLocalSave(repeatedState)).s16LegacyHistory).toEqual(repeatedState.s16LegacyHistory)

    const interleaved: Command[] = [...completeQueries]
    interleaved.splice(3, 0, { type: 'SECTION', section: 'EXPLORE' })
    interleaved.push({ type: 'ASSEMBLE', slot: 'AMOUNT', recordId: fixture.proof.slots.AMOUNT })
    let interleavedState = restoreInvestigation(fixture, envelope(interleaved))
    expect(interleavedState.discoveredClues).toHaveLength(8)
    expect(interleavedState.assembly).toEqual({ AMOUNT: fixture.proof.slots.AMOUNT })
    interleavedState = restoreInvestigation(fixture, exportLocalSave(interleavedState))
    expect(interleavedState.discoveredClues).toHaveLength(8)
    expect(interleavedState.assembly).toEqual({ AMOUNT: fixture.proof.slots.AMOUNT })
  })

  it('rejects postdated migration commands in v2 and unbound import shortcuts in v4', () => {
    const initial = createInvestigationState(fixture)
    const imports = [
      { type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' },
      { type: 'S16_IMPORT_V2', group: 'FLOOD_ORIENT', status: 'COMPLETED', receiptReviewed: false },
      { type: 'S16_IMPORT_V2', group: 'CANDIDATES_CASE_FILE_BOUNDS', status: 'COMPLETED', receiptReviewed: false },
      { type: 'S16_IMPORT_V2', group: 'RECEIPT_ROUTE_VERIFICATION', status: 'COMPLETED', receiptReviewed: false },
    ]
    expect(restoreInvestigation(fixture, envelope(imports, 2))).toEqual(initial)
    expect(restoreInvestigation(fixture, envelope(imports, 4))).toEqual(initial)
    expect(restoreInvestigation(fixture, envelope([...imports, { type: 'S16_FILE_FINDINGS' }], 4))).toEqual(initial)
    expect(restoreInvestigation(fixture, envelope([{ type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' }, { type: 'S16_RUN_QUERY', planId: 'Q2', semantics: 'R2', origin: 'CURRENT' }], 2))).toEqual(initial)
    expect(restoreInvestigation(fixture, envelope([{ type: 'COLLECT_CASE_FILE' }, { type: 'EARN_ACCESS' }], 2))).toEqual(initial)
    expect(restoreInvestigation(fixture, envelope([{ type: 'EARN_ACCESS' }, { type: 'STAGE_CARD', cardId: 'CARD.IMPOSSIBLE' }], 2))).toEqual(initial)
  })

  it('adds the bounded route from either admitted later Q2 view but never verifies contextual support', () => {
    let state = throughQ2()
    const q2 = state.s16Runs[0]!
    const early = runtime.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')!
    const support = runtime.caseCorpus.find(record => record.recordId !== runtime.proof.exactRecord.recordId && record.transaction_hash === runtime.proof.exactRecord.transaction_hash)!
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
    state = reduce(state, { type: 'S16_ADD_START', runId: q2.id, recordId: early.recordId })
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: support.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
    state = reduce(state, { type: 'S16_ADD_ROUTE', runId: q2.id, recordId: support.recordId })
    expect(state.s16RouteAdded).toBe(true)
    state = run(state, 'Q3')
    const q3 = state.s16Runs.find(item => item.planId === 'Q3')!
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: support.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
    state = reduce(state, { type: 'S16_VERIFY_CONNECTION', runId: q3.id, recordId: support.recordId })
    expect(state.s13VerifiedRecordId).toBeNull()
  })
})

describe('S16-R1 presentation ownership', () => {
  it('exposes four player-facing sections and no global Source tab', () => {
    expect(deriveS16TerminalContract(fixture, access()).sections).toEqual(['CASE', 'EXPLORE'])
    expect(deriveS16TerminalContract(fixture, throughQ2()).sections).toEqual(['CASE', 'RESULTS', 'EXPLORE', 'LEDGER'])
    expect(deriveS16TerminalContract(fixture, throughQ2()).sections).not.toContain('SOURCE')
  })

  it('owns every reducer command explicitly and foregrounds the new native actions', () => {
    expect(S16_COMMAND_PRESENTATION.S16_RUN_QUERY).toBe('FOREGROUND')
    expect(S16_COMMAND_PRESENTATION.S16_FILE_FINDINGS).toBe('FOREGROUND')
    expect(S16_COMMAND_PRESENTATION.DISPATCH).toBe('REDUCER_ONLY')
    expect(Object.keys(S16_COMMAND_PRESENTATION).length).toBeGreaterThan(40)
    expect(S16_QUERY_PLANS.Q2.conditions).toHaveLength(2)
  })

  it('keeps the approved paginator, contextual source, and synchronized degauss seams', () => {
    const terminal = readFileSync('src/app/S16Terminal.tsx', 'utf8')
    const viewport = readFileSync('src/app/TerminalViewport.tsx', 'utf8')
    const audioOwner = readFileSync('src/app/terminalAudio.ts', 'utf8')
    const css = readFileSync('src/app/terminal-viewport.css', 'utf8')
    expect(terminal).toContain('const PAGE_SIZE = 8')
    expect(terminal).toContain('NANSEN TRANSFER RECORD')
    expect(terminal).toContain('SAVED TRANSACTION FIELDS')
    expect(terminal).not.toContain('compact label="From"')
    expect(terminal).not.toMatch(/<b>(?:METHOD|REQUEST BODY|ISSUED|COMPLETED)<\/b>/)
    expect(viewport).toContain('if (locked.current) return')
    expect(viewport).toContain('}, 2100)')
    expect(viewport).toContain('}, 6000)')
    expect(audioOwner).toContain('TERMINAL_EFFECT_GAIN = 0.375')
    expect(audioOwner).toContain('TERMINAL_AUTOMATIC_EFFECT_GAIN = 0.225')
    expect(audioOwner).toContain('TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS = 0.25')
    expect(audioOwner).toContain('TERMINAL_EFFECT_PEAK_BEFORE_LOOP_END_SECONDS = 0.15')
    expect(audioOwner).toContain("source.start(startAt)")
    const screenKeyframe = css.match(/@keyframes degauss-screen\{[^\n]+/)?.[0] ?? ''
    expect(screenKeyframe).toContain('scaleX(1.34) scaleY(.68)')
    expect(screenKeyframe).not.toContain('translateY')
    expect(css).toContain('.s5-native-terminal.is-degaussing .s16-terminal{animation:degauss-screen 2.1s')
    expect(css).toContain('.s5-screen-aperture{position:absolute;left:44px;top:12px;z-index:2;width:393px;height:219px;overflow:hidden')
  })
})
