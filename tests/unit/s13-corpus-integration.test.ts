import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { attachS13Runtime, buildFrozenFixture, syntheticFixture } from '../../src/investigation/fixture'
import { S13_QUERY_GROUPS, s13QueryGroupSummary, s13RecordLabel, s13VisibleRecords, type S13Runtime } from '../../src/investigation/s13'
import { createInvestigationState, exportLocalSave, fixtureOrigin, investigationReducer, restoreInvestigation, s13CaseFileGateSatisfied, terminalCapabilities, type Command, type InvestigationState } from '../../src/investigation/state'

const fromPublic = (name: string) => JSON.parse(readFileSync(`public/scenarios/euler-2023-false-exit/${name}`, 'utf8'))
const scenario = fromPublic('scenario.json')
const graph = fromPublic('evidence-graph.json')
const runtime = fromPublic('s13-runtime.json') as S13Runtime
const baseFixture = buildFrozenFixture(scenario, graph)
const fixture = attachS13Runtime(baseFixture, runtime)
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const reduce = (state: InvestigationState, command: Command) => investigationReducer(fixture, state, command)
const gated = () => reduce(reduce(createInvestigationState(fixture), { type: 'EARN_ACCESS' }), { type: 'COLLECT_CASE_FILE' })
const legacyQuestions = (state = gated(), through = 3) => S13_QUERY_GROUPS.slice(0, through).reduce((current, group) => {
  current = reduce(current, { type: 'STAGE_CARD', cardId: group.cardId })
  current = reduce(current, { type: 'REVIEW_RECEIPT' })
  return reduce(current, { type: 'DISPATCH', path: 'TERMINAL' })
}, state)
const questions = (state = gated(), through = 2) => {
  if (through < 1) return state
  state = reduce(state, { type: 'S16_RUN_QUERY', planId: 'Q2', semantics: 'R2', origin: 'CURRENT' })
  if (through < 2) return state
  const q2 = state.s16Runs.find(run => run.planId === 'Q2')!
  const early = runtime.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')!
  state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
  state = reduce(state, { type: 'S16_ADD_START', runId: q2.id, recordId: early.recordId })
  state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: runtime.proof.exactRecord.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
  state = reduce(state, { type: 'S16_ADD_ROUTE', runId: q2.id, recordId: runtime.proof.exactRecord.recordId })
  return reduce(state, { type: 'S16_RUN_QUERY', planId: 'Q3', semantics: 'R2', origin: 'CURRENT' })
}
const verified = () => {
  let state = questions()
  state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: runtime.proof.exactRecord.recordId })
  return reduce(state, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId })
}

describe('S13-R1 accepted corpus integration', () => {
  it('preserves the 101=25+76 union, overlay, 45/31 split, 227 corpus, and fixed runtime identity', () => {
    const ids = runtime.callAtlas.map(row => row.publicCallId)
    expect(ids).toHaveLength(101)
    expect(new Set(ids).size).toBe(101)
    expect(runtime.callAtlas.filter(row => row.sourceCampaign === 'P2-R1')).toHaveLength(25)
    const e03 = runtime.callAtlas.filter(row => row.sourceCampaign === 'E03')
    expect(e03).toHaveLength(76)
    expect(e03.every(row => row.acceptanceStatus === 'ACCEPTED_BY_CHATGPT_MAIN_LEAD')).toBe(true)
    expect(e03.filter(row => row.curatedEvidenceAcceptanceStatus === 'ACCEPTED_BY_CHATGPT_MAIN_LEAD')).toHaveLength(45)
    expect(e03.filter(row => row.curatedEvidenceAcceptanceStatus === 'NOT_APPLICABLE_CALL_ATLAS_RECEIPT_ONLY')).toHaveLength(31)
    expect(runtime.caseCorpus).toHaveLength(227)
    expect(new Set(runtime.caseCorpus.map(row => row.recordId)).size).toBe(227)
    expect(digest(readFileSync('public/scenarios/euler-2023-false-exit/s13-runtime.json'))).toBe('82918530c6be5cf69b8f5631f5040758db36add9c28ce0737be7f888c16c78d3')
  })

  it('keeps receipt-only rows out of Case Corpus and the projection public-safe', () => {
    const receiptOnly = new Set(runtime.callAtlas.filter(row => row.curatedEvidenceAcceptanceStatus === 'NOT_APPLICABLE_CALL_ATLAS_RECEIPT_ONLY').map(row => row.publicCallId))
    expect(runtime.caseCorpus.some(row => row.sourcePublicCallId && receiptOnly.has(row.sourcePublicCallId))).toBe(false)
    const projection = JSON.stringify(runtime).toLowerCase()
    for (const forbidden of ['providerrequestid', 'rawbody', 'remainingcredits', 'credential', '/path/to/local-user/', 'e02_brcg_token_screener']) expect(projection).not.toContain(forbidden)
  })

  it('keeps the prebrief aggregate-only and the exact two-clue gate fail-closed', () => {
    expect(runtime.prebrief).toMatchObject({ callAtlasReceiptCount: 101, semanticRecordCount: 227, providerResponseRowCount: 200, individualRecordsIncluded: false, filterPredicatesIncluded: false, exactSlotFieldsIncluded: false })
    const prebrief = JSON.stringify(runtime.prebrief).toLowerCase()
    for (const forbidden of ['0x', 'transaction', 'filter.unframed', 'hero.exact', '8877507']) expect(prebrief).not.toContain(forbidden)
    const access = reduce(createInvestigationState(fixture), { type: 'EARN_ACCESS' })
    expect(terminalCapabilities(fixture, access).sections).toEqual(['CASE'])
    expect(s13CaseFileGateSatisfied(fixture, { ...access, discoveredClues: ['CLUE.CASE_FILE.DAI'] })).toBe(false)
    expect(s13CaseFileGateSatisfied(fixture, gated())).toBe(true)
  })

  it('connects CASE-owned S13 results to comparison, theory, and Caseboard capabilities', () => {
    let state = gated()
    let caps = terminalCapabilities(fixture, state)
    expect(caps.showQuerySurface).toBe(true)
    expect(caps.askCardIds).toEqual(['CARD.S13_FLOOD_ORIENT'])
    expect(caps.sections).toEqual(['CASE', 'RESULTS', 'EXPLORE', 'SOURCE', 'LEDGER'])
    state = questions(state, 1)
    const q2 = state.s16Runs[0]!
    const early = runtime.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')!
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
    state = reduce(state, { type: 'S16_ADD_START', runId: q2.id, recordId: early.recordId })
    state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: runtime.proof.exactRecord.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
    state = reduce(state, { type: 'S16_ADD_ROUTE', runId: q2.id, recordId: runtime.proof.exactRecord.recordId })
    caps = terminalCapabilities(fixture, state)
    expect(caps.allowCompare).toBe(true)
    expect(caps.allowTheory).toBe(true)
    const candidates = s13VisibleRecords(runtime, state.s13FilterStage)
    state = reduce(state, { type: 'S13_COMPARE', recordId: candidates[0]!.recordId })
    state = reduce(state, { type: 'S13_COMPARE', recordId: candidates[1]!.recordId })
    expect(state.s13Comparison).toEqual([candidates[0]!.recordId, candidates[1]!.recordId])
    state = reduce(state, { type: 'THEORY', theory: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' })
    expect(state.workingTheory).toBe('FIRST_TRAIL_STOPS_AT_FIRST_ENGINE')
  })

  it('uses two native CASE runs while retaining all six historical semantic-stage receipts', () => {
    const state = questions(gated())
    expect(runtime.evidenceDelta.stages.map(row => row.newCount)).toEqual([98, 98, 74, 3, 2, 1])
    expect(S13_QUERY_GROUPS.map(group => [group.startStage, group.endStage])).toEqual([[0, 2], [2, 4], [4, 6]])
    expect(state.s16Runs.map(run => [run.planId, run.countStages])).toEqual([['Q2', [98, 74, 3]], ['Q3', [3, 2, 1]]])
    expect(state.commands.filter(command => command.type === 'S16_RUN_QUERY')).toHaveLength(2)
    expect(state.commands.filter(command => command.type === 'DISPATCH')).toHaveLength(0)
    expect(state.commands.filter(command => command.type === 'REVIEW_RECEIPT')).toHaveLength(0)
    expect(s13VisibleRecords(runtime, state.s13FilterStage).map(row => row.recordId)).toEqual(['HERO.EXACT_CONVERGENCE'])
  })

  it('derives the three exact query-group count summaries from admitted stage data', () => {
    const summaries = S13_QUERY_GROUPS.map(group => s13QueryGroupSummary(runtime, group))
    expect(summaries.map(summary => summary.inputCount)).toEqual([98, 98, 3])
    expect(summaries.map(summary => summary.outputCount)).toEqual([98, 3, 1])
    expect(summaries.map(summary => summary.stages.map(stage => stage.newCount))).toEqual([[98, 98], [74, 3], [2, 1]])
  })

  it('fails closed atomically when version-2 history contains one or six retired dispatch commands', () => {
    const valid = JSON.parse(exportLocalSave(gated()))
    for (const retiredCount of [1, 6]) {
      const crafted = structuredClone(valid)
      crafted.commands.entries.push(...Array.from({ length: retiredCount }, (_, index) => ({ type: 'S13_DISPATCH_QUESTION', stage: index + 1 })))
      const restored = restoreInvestigation(fixture, JSON.stringify(crafted))
      expect(restored).toEqual(createInvestigationState(fixture))
      expect(restored.s13FilterStage).toBe(0)
      expect(restored.reviewedReceipt).toBeNull()
      expect(restored.commands).toEqual([])
    }
  })

  it('migrates valid version-2 S13 history into the two native guided runs', () => {
    const expected = legacyQuestions()
    const source = { fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture) }
    const restored = restoreInvestigation(fixture, JSON.stringify({ ...source, saveVersion: 2, commands: { source, entries: expected.commands } }))
    expect(restored.s13FilterStage).toBe(6)
    expect(restored.commands.filter(command => command.type === 'DISPATCH')).toHaveLength(0)
    expect(restored.s16Runs.map(run => run.planId)).toEqual(['Q2', 'Q3'])
  })

  it('uses neutral broad-pool labels and does not reveal the Hero identity at stage 1', () => {
    const broad = s13VisibleRecords(runtime, 2)
    const heroIndex = broad.findIndex(record => record.recordId === 'HERO.EXACT_CONVERGENCE')
    const corpusIndex = runtime.caseCorpus.findIndex(record => record.recordId === 'HERO.EXACT_CONVERGENCE')
    expect(heroIndex).toBeGreaterThanOrEqual(0)
    const label = s13RecordLabel(broad[heroIndex]!, corpusIndex, false)
    expect(label).toBe(`TRANSFER RECORD ${String(corpusIndex + 1).padStart(3, '0')}`)
    expect(label).not.toMatch(/HERO|EXACT|CONVERGENCE|8877507/i)
  })

  it('does not auto-prove at the one-record stage; explicit source inspection and verification are required', () => {
    let state = questions()
    expect(state.exactEventIds).toEqual([])
    expect(state.assembly).toEqual({})
    expect(state.complete).toBe(false)
    state = reduce(state, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId })
    expect(state.exactEventIds).toEqual([])
    expect(state.error).toMatch(/inspect/i)
    state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: runtime.proof.exactRecord.recordId })
    state = reduce(state, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId })
    expect(state.s13VerifiedRecordId).toBe('HERO.EXACT_CONVERGENCE')
    expect(state.exactEventIds).toEqual(['EXACT.EXACT_CONVERGENCE'])
    expect(state.result?.recordIds).toContain('EXACT_CONVERGENCE')
    expect(state.assembly).toEqual({})
  })

  it('rejects contextual evidence as proof and keeps it out of every slot', () => {
    let state = questions(gated(), 1)
    const contextual = runtime.proof.contextualCorroboration.recordId
    expect(s13VisibleRecords(runtime, 4).some(record => record.recordId === contextual)).toBe(true)
    state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: contextual })
    state = reduce(state, { type: 'S13_VERIFY_RECORD', recordId: contextual })
    expect(state.error).toMatch(/contextual evidence cannot fill/i)
    expect(state.exactEventIds).toEqual([])
    expect(state.assembly).toEqual({})
  })

  it('files all three reviewed findings atomically without narrative activation', () => {
    let state = verified()
    const exact = fixture.proof.slots.LINK
    expect(state.assembly).toEqual({})
    state = reduce(state, { type: 'S16_FILE_FINDINGS' })
    expect(state.complete).toBe(true)
    expect(state.assembly).toEqual({ AMOUNT: exact, RECEIVER: exact, LINK: exact })
    expect(runtime.productionBoundary).toEqual({ runtimeProviderCalls: 0, r55DialogueActive: false, endingActive: false, mission02Active: false })
  })

  it('is idempotent after exact verification and repeated atomic filing', () => {
    let state = verified()
    const verifiedCommands = state.commands.length
    state = reduce(state, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId })
    expect(state.commands).toHaveLength(verifiedCommands)
    const exact = fixture.proof.slots.LINK
    state = reduce(state, { type: 'S16_FILE_FINDINGS' })
    const completedCommands = state.commands.length
    state = reduce(state, { type: 'S16_FILE_FINDINGS' })
    expect(state.complete).toBe(true)
    expect(state.commands).toHaveLength(completedCommands)
    expect(state.assembly).toEqual({ AMOUNT: exact, RECEIVER: exact, LINK: exact })
  })

  it('round-trips nonzero progress and the selected S13 source using recordId', () => {
    let state = questions(gated(), 1)
    const selected = s13VisibleRecords(runtime, 4)[0]!.recordId
    state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: selected })
    const restored = restoreInvestigation(fixture, exportLocalSave(state))
    expect(restored.s13FilterStage).toBe(4)
    expect(restored.s13SelectedRecordId).toBe(selected)
    expect(restored.section).toBe('RESULTS')
  })

  it('migrates partial and fully assembled version-2 proof state', () => {
    const exact = fixture.proof.slots.LINK
    const source = { fixtureId: fixture.id, fixtureMode: fixture.mode, fixtureOrigin: fixtureOrigin(fixture) }
    const legacyVerified = (() => { let state = legacyQuestions(); state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: runtime.proof.exactRecord.recordId }); return reduce(state, { type: 'S13_VERIFY_RECORD', recordId: runtime.proof.exactRecord.recordId }) })()
    const envelope = (entries: Command[]) => JSON.stringify({ ...source, saveVersion: 2, commands: { source, entries } })
    const partial = restoreInvestigation(fixture, envelope([...legacyVerified.commands, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: exact }]))
    expect(partial.s13VerifiedRecordId).toBe(runtime.proof.exactRecord.recordId)
    expect(partial.assembly).toEqual({ AMOUNT: exact })
    const complete = restoreInvestigation(fixture, envelope([...legacyVerified.commands, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: exact }, { type: 'ASSEMBLE', slot: 'RECEIVER', recordId: exact }, { type: 'ASSEMBLE', slot: 'LINK', recordId: exact }]))
    expect(complete.complete).toBe(true)
    expect(complete.assembly).toEqual({ AMOUNT: exact, RECEIVER: exact, LINK: exact })
  })

  it('keeps BRCG gated behind the accepted side-note state', () => {
    expect(gated().sideLead.noteDiscovered).toBe(false)
    const unlocked = reduce(gated(), { type: 'COLLECT_SIDE_NOTE' })
    expect(unlocked.sideLead.noteDiscovered).toBe(true)
    expect(runtime.brcg).toMatchObject({ requiredForLaunch: true, playerDiscoveryOptional: true, e02RowsIncluded: false, boundedNoMatch: { zeroResultClass: 'NO_MATCH_IN_ACCEPTED_CORPUS', establishesGlobalAbsence: false, mayFalsifyTheory: false } })
  })

  it('removes S13-only clues and restores the original proof contract in the synthetic fixture', () => {
    const synthetic = syntheticFixture(fixture)
    expect(synthetic.s13).toBeUndefined()
    expect(synthetic.startingClueIds).toHaveLength(4)
    expect(synthetic.startingClueIds.join(' ')).not.toContain('CASE_FILE')
    expect(synthetic.clues.map(({ id }) => id).join(' ')).not.toContain('CASE_FILE')
    expect(new Set(Object.values(synthetic.proof.slots)).size).toBe(3)
  })

  it('starts fresh with no S13 progress while exported progress remains serializable', () => {
    const progressed = questions(gated(), 1)
    expect(JSON.parse(exportLocalSave(progressed)).saveVersion).toBe(5)
    const fresh = createInvestigationState(fixture)
    expect(fresh.s13FilterStage).toBe(0)
    expect(fresh.s13SelectedRecordId).toBeNull()
    expect(fresh.s13VerifiedRecordId).toBeNull()
    expect(fresh.assembly).toEqual({})
  })

  it.runIf(Boolean(process.env.S13_INPUT_ROOT))('replays the fixed-hash compiler byte-for-byte', () => {
    const temporary = mkdtempSync(join(tmpdir(), 's13-compiler-'))
    try {
      const output = join(temporary, 'runtime.json')
      const result = spawnSync('python3', ['scripts/s13/compile_runtime.py', '--input-root', process.env.S13_INPUT_ROOT!, '--output', output], { cwd: process.cwd(), encoding: 'utf8' })
      expect(result.status, result.stdout + result.stderr).toBe(0)
      const expected = readFileSync('public/scenarios/euler-2023-false-exit/s13-runtime.json')
      const actual = readFileSync(output)
      expect(digest(actual)).toBe(digest(expected))
      expect(actual.equals(expected)).toBe(true)
    } finally { rmSync(temporary, { recursive: true, force: true }) }
  })
})
