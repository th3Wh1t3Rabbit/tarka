import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildFrozenFixture, syntheticFixture } from '../../src/investigation/fixture'
import { canonicalQuery, compareDecimal, dispatchQuery, queryReceipt, zeroClassification } from '../../src/investigation/query'
import { availableCards, clueState, createInvestigationState, exactPredicate, exportLocalSave, investigationReducer, knownRecords, recommendations, restoreInvestigation, threadChecks, threadStatus, visibleClues, type Command } from '../../src/investigation/state'
import { createPlaceholderSemanticCatalog } from '../../src/adventure/semanticCatalog'
import { loadPerformanceProfile, logicalPropPresentation, performanceFrame, placeholderPerformanceProfile, resolvePerformance, validatePerformanceProfile } from '../../src/adventure/performanceCatalog'
import type { CaseFixture, Filter, Query } from '../../src/investigation/contracts'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'

const base = 'public/scenarios/euler-2023-false-exit/'
const frozen = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json', 'utf8')), JSON.parse(readFileSync(base + 'evidence-graph.json', 'utf8')))
const earned = (fixture = frozen) => investigationReducer(fixture, investigationReducer(fixture, createInvestigationState(fixture), { type: 'EARN_ACCESS' }), { type: 'REVIEW_RECEIPT' })
const collected = (fixture = frozen) => investigationReducer(fixture, earned(fixture), { type: 'COLLECT_CASE_FILE' })
const filter = (field: Filter['field'], value: string): Filter => ({ field, value, origin: 'PLAYER_FILTER', sourceId: 'TEST.KNOWN' })
function journey(fixture: CaseFixture, commands: Command[]) { return commands.reduce((state, command) => investigationReducer(fixture, command.type === 'DISPATCH' ? investigationReducer(fixture, state, { type: 'REVIEW_RECEIPT' }) : state, command), collected(fixture)) }
function proof(fixture = frozen) {
  return journey(fixture, [{ type: 'DISPATCH', path: 'TERMINAL' }, { type: 'SELECT_RESULT', recordId: fixture.openingRecordId }, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }, { type: 'DISPATCH', path: 'TERMINAL' }, { type: 'READ_BRANCH', branch: 'SECOND' }, { type: 'SELECT_RESULT', recordId: fixture.proof.slots.LINK }, { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' }])
}

describe('A2U fixture investigation, not a paid campaign', () => {
  it('detects same-origin provider proxies as well as external provider requests', () => {
    expect(violatesFrozenBrowserPolicy('http://127.0.0.1:4173/api/v1/profiler/address/transactions')).toBe(true)
    expect(violatesFrozenBrowserPolicy('http://127.0.0.1:4173/api/v1beta1/profiler/address/historical-transactions')).toBe(true)
    expect(violatesFrozenBrowserPolicy('https://api.nansen.ai/api/v1/account')).toBe(true)
    expect(violatesFrozenBrowserPolicy('https://eth-mainnet.g.alchemy.com/v2/example')).toBe(true)
    expect(violatesFrozenBrowserPolicy('http://127.0.0.1:4173/scenarios/euler-2023-false-exit/scenario.json')).toBe(false)
  })
  it('keeps opening access earned and initial locked receipts undiscovered', () => {
    const locked = createInvestigationState(frozen)
    expect(investigationReducer(frozen, locked, { type: 'DISPATCH', path: 'TERMINAL' }).result).toBeNull()
    expect(availableCards(frozen, locked)).toEqual([])
    expect(knownRecords(frozen, collected())).toEqual([])
    expect(visibleClues(frozen, collected()).map(({ id }) => id)).toEqual(frozen.startingClueIds)
    expect(frozen.startingClueIds).toEqual(['CLUE.ASSET', 'CLUE.FILE_ASSET_ADDRESS', 'CLUE.AMOUNT', 'CLUE.WINDOW'])
    expect(clueState(frozen, collected(), `CLUE.PROOF.${frozen.proof.slots.LINK}`)).toBe('LOCKED')
  })
  it('preserves the accepted cutoff, convergence time, and bounded conclusion', () => {
    expect(frozen.cutoffUtc).toBe('2023-03-13T12:15:00Z')
    expect(frozen.proof.linkTimeUtc).toBe('2023-03-13T11:38:11Z')
    expect(frozen.proof.conclusion).toBe('THE FIRST TRAIL JOINED THE SECOND ROUTE.')
    expect(frozen.ledger.curatedAcceptedCalls).toBe(0)
    expect(frozen.coverage.every((cell) => !cell.supportsNegative && cell.status === 'PARTIAL')).toBe(true)
  })
  it('uses AND semantics independent of chip order and preserves disclosed provenance', () => {
    const state = journey(frozen, [{ type: 'STAGE_CLUE', clueId: 'CLUE.START' }, { type: 'STAGE_CLUE', clueId: 'CLUE.WINDOW' }, { type: 'STAGE_CLUE', clueId: 'CLUE.ASSET' }])
    const reversed = { ...state.query, filters: [...state.query.filters].reverse() }
    expect(canonicalQuery(reversed)).toEqual(canonicalQuery(state.query))
    expect(dispatchQuery(frozen, reversed, null).recordIds).toEqual(dispatchQuery(frozen, state.query, null).recordIds)
    const result = investigationReducer(frozen, investigationReducer(frozen, state, { type: 'REVIEW_RECEIPT' }), { type: 'DISPATCH', path: 'TERMINAL' })
    expect(result.result?.query).toEqual(state.query)
    expect(queryReceipt(frozen, state.query).noHiddenFilterMutation).toBe(true)
    expect(queryReceipt(frozen, state.query).activeFilters.every((f) => f.origin === 'CASE_CLUE')).toBe(true)
  })
  it('requires the displayed receipt before a first physical dispatch or any changed query', () => {
    const initial = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    expect(investigationReducer(frozen, initial, { type: 'DISPATCH', path: 'PLUNGER' }).result).toBeNull()
    const changed = investigationReducer(frozen, collected(), { type: 'STAGE_CLUE', clueId: 'CLUE.ASSET' })
    expect(investigationReducer(frozen, changed, { type: 'DISPATCH', path: 'PLUNGER' }).result).toBeNull()
    expect(investigationReducer(frozen, investigationReducer(frozen, changed, { type: 'REVIEW_RECEIPT' }), { type: 'DISPATCH', path: 'PLUNGER' }).result).not.toBeNull()
  })
  it('stages the two disclosed comparison record IDs rather than silently sweeping the corpus', () => {
    const state = journey(frozen, [{ type: 'DISPATCH', path: 'TERMINAL' }, { type: 'SELECT_RESULT', recordId: frozen.openingRecordId }, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }, { type: 'DISPATCH', path: 'TERMINAL' }, { type: 'COMPARE', recordId: frozen.openingRecordId }, { type: 'COMPARE', recordId: frozen.proof.slots.LINK }, { type: 'STAGE_CARD', cardId: 'CARD.COMPARE_ROUTES' }, { type: 'DISPATCH', path: 'TERMINAL' }])
    expect(new Set(state.result?.recordIds)).toEqual(new Set([frozen.openingRecordId, frozen.proof.slots.LINK]))
    expect(state.query.filters[0]?.field).toBe('RECORD_SET')
  })
  it('uses the Lead-authored initial trio and limits foreground candidates to three', () => {
    const recs = recommendations(frozen, collected())
    expect(recs.map(({ id }) => id)).toEqual(['CARD.INCIDENT_DAI'])
    expect(recs.every((card) => card.lead_promoted === false)).toBe(true)
    expect(investigationReducer(frozen, collected(), { type: 'DISPATCH', path: 'TERMINAL' }).shown).toBe(3)
  })
  it.each(['TERMINAL', 'PLUNGER'] as const)('shares the exact dispatch path for %s', (path) => {
    const result = investigationReducer(frozen, earned(), { type: 'DISPATCH', path })
    expect(result.result).toEqual(dispatchQuery(frozen, earned().query, null))
    expect(result.canister).toBe('RETURNED')
    const open = investigationReducer(frozen, result, { type: 'OPEN_CANISTER' })
    expect(open.canister).toBe('OPEN')
    expect(open.result).toEqual(result.result)
  })
  it('does not promote candidate fit, state views, or contextual rows into route proof', () => {
    for (const record of frozen.records.filter((record) => record.id !== frozen.proof.slots.LINK)) expect(exactPredicate(frozen, record)).toBe(false)
    const candidate = journey(frozen, [{ type: 'DISPATCH', path: 'TERMINAL' }, { type: 'PIN', recordId: frozen.proof.slots.LINK }])
    expect(candidate.exactEventIds).toHaveLength(0)
    expect(threadStatus(frozen, candidate)).toBe('NEEDS_EXACT_LINK')
    expect(investigationReducer(frozen, candidate, { type: 'ASSEMBLE', slot: 'LINK', recordId: frozen.proof.slots.LINK }).assembly).toEqual({})
  })
  it('closes the exact gap idempotently and exposes six continuity dimensions', () => {
    const exact = proof()
    expect(exact.exactEventIds).toEqual([`EXACT.${frozen.proof.slots.LINK}`])
    expect(investigationReducer(frozen, exact, { type: 'DISPATCH', path: 'PLUNGER' }).exactEventIds).toEqual(exact.exactEventIds)
    expect(threadStatus(frozen, exact)).toBe('PROVED')
    expect(threadChecks(frozen, exact, frozen.records.find(({ id }) => id === frozen.proof.slots.LINK)!)).toHaveLength(6)
    expect(clueState(frozen, exact, `CLUE.PROOF.${frozen.proof.slots.LINK}`)).toBe('ARCHIVED')
  })
  it('falsifies a mistaken theory only at its first discovered exact contradiction', () => {
    let state = journey(frozen, [{ type: 'COLLECT_CASE_FILE' }, { type: 'DISPATCH', path: 'TERMINAL' }, { type: 'SELECT_RESULT', recordId: frozen.openingRecordId }, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }, { type: 'DISPATCH', path: 'TERMINAL' }])
    expect(state.candidateRouteResolved).toBe(true)
    const pair = state.discoveredRecords.filter((id) => id !== frozen.openingRecordId).slice(0, 2)
    state = investigationReducer(frozen, state, { type: 'COMPARE', recordId: pair[0]! })
    state = investigationReducer(frozen, state, { type: 'COMPARE', recordId: pair[1]! })
    state = investigationReducer(frozen, state, { type: 'THEORY', theory: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' })
    for (const command of proof().commands.slice(1)) state = investigationReducer(frozen, state, command)
    expect(state.rejectedTheory?.firstContradiction).toBe(frozen.proof.slots.LINK)
    const repeated = investigationReducer(frozen, state, { type: 'DISPATCH', path: 'PLUNGER' })
    expect(repeated.rejectedTheory).toEqual(state.rejectedTheory)
  })
  it('requires all three exact slots and retains both true breach memories', () => {
    let state = proof()
    for (const slot of ['AMOUNT', 'RECEIVER', 'LINK'] as const) state = investigationReducer(frozen, state, { type: 'ASSEMBLE', slot, recordId: frozen.proof.slots[slot] })
    expect(state.complete).toBe(true)
    expect(state.discoveredRecords).toContain(frozen.openingRecordId)
    expect(state.discoveredRecords).toContain(frozen.secondRecordId)
    expect(state.announcement).toContain(frozen.proof.boundary)
  })
  it('rejects mutated exact relationship, time, cutoff, derived grade, and hash', () => {
    const link = frozen.records.find(({ id }) => id === frozen.proof.slots.LINK)!
    for (const mutation of [{ destination: frozen.proof.linkSource }, { exactRelationship: false }, { observedAtUtc: '2023-03-13T13:00:00Z' }, { grade: 'CORROBORATING' as const }, { derivedFrom: [frozen.openingRecordId] }, { provenance: { ...link.provenance, rawSha256: 'invalid' } }]) expect(exactPredicate(frozen, { ...link, ...mutation })).toBe(false)
  })
  it('does not prove an impossible same-unit amount continuity relationship', () => {
    const link = frozen.records.find(({ id }) => id === frozen.proof.slots.LINK)!
    expect(exactPredicate(frozen, { ...link, assetAmounts: [{ ...link.assetAmounts[0]!, amount: '999999999999' }] })).toBe(false)
    expect(exactPredicate(frozen, { ...link, assetAmounts: [{ ...link.assetAmounts[0]!, unit: 'USD' }] })).toBe(false)
  })
  it('uses exact decimal comparisons without rounding or cross-asset sums', () => {
    expect(compareDecimal('8877507.348306697', '8877507.3483067')).toBe(-1)
    expect(compareDecimal('1.000', '1')).toBe(0)
    expect(compareDecimal('9007199254740993', '9007199254740992')).toBe(1)
    expect(() => compareDecimal('NaN', '1')).toThrow()
    const query: Query = { lens: 'ACTIVITY', questionId: 'TEST', filters: [filter('MIN_AMOUNT', '100')] }
    expect(() => dispatchQuery(frozen, query, null)).toThrow('MIN_AMOUNT requires exactly one distinct ASSET')
  })
  it('distinguishes no match, bounded negative evidence, and outside coverage', () => {
    const query: Query = { lens: 'ACTIVITY', questionId: 'TEST.ZERO', filters: [filter('SUBJECT', frozen.proof.linkSource), filter('FROM', frozen.coverage[0]!.fromUtc), filter('TO', frozen.cutoffUtc), filter('ASSET', 'NONMATCH')] }
    expect(zeroClassification(frozen, query)).toBe('NO_MATCH_IN_ACCEPTED_CORPUS')
    const complete = structuredClone(frozen); complete.coverage.forEach((cell) => { cell.status = 'COMPLETE'; cell.supportsNegative = true })
    expect(zeroClassification(complete, query)).toBe('NEGATIVE_EVIDENCE_SUPPORTED')
    expect(zeroClassification(complete, { ...query, filters: [...query.filters, filter('TO', '2024-01-01T00:00:00Z')] })).toBe('QUERY_OUTSIDE_COVERAGE')
    expect(zeroClassification(frozen, { ...query, filters: [filter('SUBJECT', '0xNOT_COVERED')] })).toBe('QUERY_OUTSIDE_COVERAGE')
  })
  it('supports alternate order, undo/redo, saved queries, reset, and leave/return', () => {
    const staged = journey(frozen, [{ type: 'STAGE_CLUE', clueId: 'CLUE.ASSET' }, { type: 'STAGE_CLUE', clueId: 'CLUE.WINDOW' }, { type: 'SAVE_QUERY' }])
    const undone = investigationReducer(frozen, staged, { type: 'UNDO' })
    expect(investigationReducer(frozen, undone, { type: 'REDO' }).query).toEqual(staged.query)
    expect(restoreInvestigation(frozen, exportLocalSave(staged))).toEqual(staged)
    const reset = investigationReducer(frozen, staged, { type: 'RESET_CASE' })
    expect(reset.access).toBe(true)
    expect(restoreInvestigation(frozen, exportLocalSave(reset)).access).toBe(true)
    expect(reset.discoveredRecords).toEqual([])
  })
  it('retains access after more than 5,000 commands without a truncated save', () => {
    let state = earned()
    for (let index = 0; index < 5001; index++) state = investigationReducer(frozen, state, { type: 'SECTION', section: 'CASE' })
    expect(restoreInvestigation(frozen, exportLocalSave(state)).access).toBe(true)
  })
  it('recovers invalid input/save without inventing proof or consuming clues', () => {
    const state = earned()
    const invalid = investigationReducer(frozen, state, { type: 'ADD_FILTER', filter: filter('MIN_AMOUNT', 'NaN') })
    expect(invalid.query).toEqual(state.query)
    expect(invalid.discoveredClues).toEqual(state.discoveredClues)
    expect(restoreInvestigation(frozen, '{invalid').exactEventIds).toEqual([])
    expect(restoreInvestigation(syntheticFixture(frozen), exportLocalSave(proof())).access).toBe(false)
  })
  it('derives query effects, results and conclusion from a nonhistorical second fixture', () => {
    const fixture = syntheticFixture(frozen); const state = proof(fixture)
    expect(state.exactEventIds).toHaveLength(1)
    expect(state.result?.folders[0]?.summary).toContain('[SYNTHETIC]')
    expect(state.result?.folders[0]?.summary).toContain('1234.5 TEST')
    expect(JSON.stringify(visibleClues(fixture, earned(fixture)))).not.toContain(frozen.proof.linkSource)
    expect(fixture.proof.conclusion).not.toBe(frozen.proof.conclusion)
    const originalHashes = new Set(frozen.records.map(({ transactionHash }) => transactionHash))
    expect(fixture.clues.flatMap(({ filters }) => filters.filter(({ field }) => field === 'TRANSACTION')).every(({ value }) => !originalHashes.has(value))).toBe(true)
    for (const clue of visibleClues(fixture, state).filter(({ role }) => role === 'CANDIDATE' || role === 'PROOF')) {
      const staged = investigationReducer(fixture, investigationReducer(fixture, state, { type: 'RESET_QUERY' }), { type: 'STAGE_CLUE', clueId: clue.id })
      expect(dispatchQuery(fixture, staged.query, null).recordIds.length).toBeGreaterThan(0)
    }
  })
  it('handles a 12,288-row representative corpus deterministically', () => {
    const large = structuredClone(frozen)
    large.records = Array.from({ length: 12288 }, (_, index) => ({ ...frozen.records[index % frozen.records.length]!, id: `LARGE.${index}` }))
    const start = performance.now(); const result = dispatchQuery(large, earned().query, null)
    expect(result.recordIds).toHaveLength(12288)
    expect(performance.now() - start).toBeLessThan(2000)
    expect(new Set(result.recordIds).size).toBe(12288)
  })
})

describe('late-bound intention capability seam', () => {
  const profile = placeholderPerformanceProfile(createPlaceholderSemanticCatalog())
  afterEach(() => vi.unstubAllGlobals())
  it('requires decoded, hash-verified, dimension-matching assets before reviewed binding', async () => {
    const reviewed = { ...structuredClone(profile), status: 'LEAD_REVIEWED' as const }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(reviewed))))
    const validProbe = async (asset: { width: number; height: number }) => ({ status: 'LOADED' as const, width: asset.width, height: asset.height, contentFingerprint: 'a'.repeat(64) })
    expect((await loadPerformanceProfile(profile.packId, true, createPlaceholderSemanticCatalog(), validProbe)).status).toBe('LEAD_REVIEWED')
    const missing = async () => ({ status: 'MISSING' as const, detail: 'HTTP 404' })
    expect((await loadPerformanceProfile(profile.packId, true, createPlaceholderSemanticCatalog(), missing)).status).toBe('UNBOUND')
    const wrong = async () => ({ status: 'LOADED' as const, width: 99999, height: 1, contentFingerprint: 'a'.repeat(64) })
    expect((await loadPerformanceProfile(profile.packId, true, createPlaceholderSemanticCatalog(), wrong)).status).toBe('UNBOUND')
    const broken = async () => ({ status: 'DECODE_FAILED' as const, detail: 'bad image' })
    expect((await loadPerformanceProfile(profile.packId, true, createPlaceholderSemanticCatalog(), broken)).status).toBe('UNBOUND')
  })
  it('allows only idle/static speech and a two-frame variable walk in a production profile', () => {
    const sparse = structuredClone(profile); sparse.status = 'LEAD_REVIEWED'
    for (const character of ['rook', 'archivist'] as const) sparse.characters[character] = sparse.characters[character].filter((clip) => ['IDLE', 'SPEAK', 'LOCOMOTION'].includes(clip.intention)).map((clip) => ({ ...clip, frames: clip.frames.slice(0, clip.intention === 'LOCOMOTION' ? 2 : 1) }))
    expect(validatePerformanceProfile(sparse)).toBe(true)
    expect(resolvePerformance(sparse, 'rook', { intention: 'GESTURE' }).intention).toBe('IDLE')
    const talk = resolvePerformance(sparse, 'rook', { intention: 'SPEAK' })
    expect(performanceFrame(talk, 100000, true, false)).toBe(0)
  })
  it('settles speech closed and obeys reduced motion without needing paired production mouths', () => {
    const talk = resolvePerformance(profile, 'rook', { intention: 'SPEAK' })
    expect(performanceFrame(talk, 200, false, false)).toBe(talk.settledFrame)
    expect(performanceFrame(talk, 200, true, true)).toBe(talk.reducedFrame)
  })
  it('rejects path traversal, empty frames, invalid controls, and invalid runtime input', () => {
    expect(validatePerformanceProfile(null as unknown as typeof profile)).toBe(false)
    for (const mutation of [{ frames: [] }, { mode: 'INVALID' }, { reducedFrame: 100 }, { mirror: null }]) {
      const bad = structuredClone(profile); Object.assign(bad.characters.rook[0]!, mutation); expect(validatePerformanceProfile(bad)).toBe(false)
    }
    const bad = structuredClone(profile); bad.characters.rook[0]!.frames[0]!.asset.src = `/art-packs/${profile.packId}/../secret.svg`
    expect(validatePerformanceProfile(bad)).toBe(false)
  })
  it('decouples logical prop transitions from optional visual clips', () => {
    expect(logicalPropPresentation('CANISTER.OPEN')).toEqual({ logicalState: 'CANISTER.OPEN', visualClipId: null, immediateSwapPermitted: true })
  })
})
