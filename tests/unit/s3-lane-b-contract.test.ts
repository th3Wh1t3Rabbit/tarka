import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hotspots } from '../../src/adventure/content'
import { VERBS } from '../../src/adventure/types'
import { dispatchQuery } from '../../src/investigation/query'
import { exactPredicate, exportLocalSave, restoreInvestigation, threadStatus } from '../../src/investigation/state'
import type { Query } from '../../src/investigation/contracts'
import { scenarioFixture } from '../fixtures/s2/contract-fixture'
import { command, dispatch, earned, interaction, progression, prove, reachablePhases } from '../fixtures/s2/domain-helpers'
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
function permutations<T>(xs: T[]): T[][] { return xs.length ? xs.flatMap((x, i) => permutations(xs.filter((_, j) => i !== j)).map((ys) => [x, ...ys])) : [[]] }

describe('S3 adapted minimal Lane B properties (not an independent review)',()=>{
  it('B-U01 exhaustive reachable phase × verb × hotspot × owned item preserves inventory or follows contract edge', () => {
    const states = reachablePhases(); expect(states.map((s) => s.phase)).toEqual(['START', 'FORM_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'COMPLETE'])
    const rows: unknown[] = []
    const cabinet = (id: string) => id === 'official-case-file-cabinet' || id === 'miscellaneous-drawer-cabinet'
    for (const s of states) for (const verb of VERBS) for (const hotspot of hotspots) for (const item of [null, ...s.inventory]) {
      const next = interaction(s, verb, hotspot.id, item)
      const edge = progression.find((row) => row[4] === s.phase && verb === row[0] && (row[1] ?? null) === hotspot.id && (row[2] ?? null) === item && row[3] === null)
      const advances = edge !== undefined
      const blankFormPickup = s.phase === 'START' && hotspot.id === 'blank-authorization-form' && (verb === 'PICK_UP' || verb === 'PULL') && item == null
      expect(next.phase, `${s.phase}/${verb}/${hotspot.id}/${item}`).toBe(blankFormPickup ? 'FORM_HELD' : advances ? edge[5] : s.phase)
      if (blankFormPickup) {
        expect(next.inventory).toEqual(['blank-terminal-authorization-form'])
      } else if (!advances && cabinet(hotspot.id) && (verb === 'OPEN' || verb === 'LOOK_AT')) {
        expect(new Set(next.inventory).size).toBe(next.inventory.length)
        expect(next.inventory.filter((id) => !s.inventory.includes(id)).every((id) => ['euler-case-file', 'rubber-band', 'rubiks-cube', 'sharknado-2-vhs', 'piggy-bank-intact', 'small-toolbox-closed'].includes(id))).toBe(true)
      } else {
        expect(next.inventory).toEqual(advances ? [...edge[6]] : s.inventory)
      }
      expect(next.archivedEvidenceIds).toEqual([])
      expect(next).toEqual(interaction(s, verb, hotspot.id, item))
      expect(new Set(next.inventory).size).toBe(next.inventory.length)
      rows.push({ phase: s.phase, verb, hotspot: hotspot.id, item, nextPhase: next.phase, inventory: next.inventory, status: 'PASS' })
    }
  })
  it('B-U04 exact predicate mutation resistance, all assembly orders, theory falsifier and idempotence', () => {
    const rows: unknown[] = []
    for (const seed of [7,19,41]) {
      const f = scenarioFixture(seed).fixture; const link = f.records.find((r) => r.id === f.proof.slots.LINK)!
      expect(exactPredicate(f, link)).toBe(true)
      for (const mutation of [{ grade: 'CONTEXTUAL' }, { source: 'wrong' }, { destination: 'wrong' }, { observedAtUtc: '2030-01-01T00:00:00Z' }, { exactRelationship: false }, { derivedFrom: ['CONTEXT'] }, { provenance: { ...link.provenance, rawSha256: 'invalid' } }, { assetAmounts: [{ asset: 'WRONG', amount: '1', unit: 'TOKEN_DECIMAL' }] }, { assetAmounts: [{ ...link.assetAmounts[0]!, amount: '999999999' }] }]) {
        expect(exactPredicate(f, { ...link, ...mutation } as typeof link)).toBe(false)
      }
      let s = command(f, earned(f), { type: 'COLLECT_CASE_FILE' }); s = dispatch(f, s)
      const pair = s.discoveredRecords.filter((id) => id !== f.openingRecordId).slice(0, 2)
      s = command(f, s, { type: 'COMPARE', recordId: pair[0]! }); s = command(f, s, { type: 'COMPARE', recordId: pair[1]! })
      s = command(f, s, { type: 'SELECT_RESULT', recordId: f.openingRecordId })
      s = command(f, s, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }); s = dispatch(f, s)
      s = command(f, s, { type: 'THEORY', theory: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' }); s = prove(f, s)
      expect(s.rejectedTheory?.firstContradiction).toBe(link.id); expect(threadStatus(f, s)).toBe('PROVED')
      expect(dispatch(f, s).exactEventIds).toEqual(s.exactEventIds)
      for (const order of permutations(['AMOUNT','RECEIVER'] as const).map(order=>[...order,'LINK'] as const)) {
        let c = command(f, s, { type: 'READ_BRANCH', branch: 'SECOND' })
        for (const slot of order) c = command(f, c, { type: 'ASSEMBLE', slot, recordId: f.proof.slots[slot] })
        expect(c.complete).toBe(true); expect(c.exactEventIds).toHaveLength(1)
        expect(restoreInvestigation(f, exportLocalSave(c))).toEqual(c)
        rows.push({ seed, order, exactEventIds: c.exactEventIds, assembly: c.assembly, status: 'PASS' })
      }
    }
  })
  it('B-U05 deterministic large-corpus repeated/reordered results and timings with no invented threshold', () => {
    const rows = []
    for (const size of [64,1024,12288]) {
      const f = scenarioFixture(19, size).fixture
      const query: Query = { lens: 'ACTIVITY', questionId: 'LARGE', filters: [] }
      const expected = dispatchQuery(f, query, null)
      for (let run = 0; run < 3; run++) {
        const start = performance.now()
        const result = dispatchQuery({ ...f, records: run % 2 ? [...f.records].reverse() : [...f.records] }, query, null)
        const ms = performance.now() - start
        expect(result).toEqual(expected); expect(result.recordIds).toHaveLength(size)
        expect(prove(f).exactEventIds).toHaveLength(1)
        rows.push({ size, run, dispatchMs: ms, digest: digest(result), status: 'PASS' })
      }
    }
  }, 60000)
})
