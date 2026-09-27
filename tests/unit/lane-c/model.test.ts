import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { admitFrozenCorpusCandidate, admitSyntheticCorpusFixture, canonicalJSON, displayForMode, validateDisplayRecord } from '../../../src/investigation/corpus-seam/authority.mjs'
import type { AdmittedCorpus, AdmittedSyntheticCorpus } from '../../../src/investigation/corpus-seam/authority.mjs'
import { browse, createCanonicalView, createSyntheticView, MODES, SURFACES, NO_MATCH_COPY, SYNTHETIC_NO_MATCH_COPY, LOCAL_EMPTY_COPY } from '../../../src/investigation/semantic-ux/model'
import type { CorpusView, BrowseQuery, GroupBy } from '../../../src/investigation/semantic-ux/model'
import { CorpusPresentation } from '../../../src/app/corpus-presentation/CorpusPresentation'
import candidate from '../../../artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json'
import synthetic from '../../../artifacts/g6p-s3/REPORTS/SYNTHETIC_SEMANTIC_FIXTURE.json'

const corpus = await admitFrozenCorpusCandidate(candidate)
const base = await createCanonicalView(corpus)
const syntheticToken = await admitSyntheticCorpusFixture(synthetic)
const ids = (v: CorpusView) => v.cards.map(c => c.display.id)
const digest = async (x: unknown) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJSON(x)))).toString('hex')
async function resealDisplay(record: typeof candidate.displayRecords[number]) {
  const body = { ...record } as Partial<typeof record>
  delete body.id; delete body.identity
  const identity = await digest(body)
  return { ...body, identity, id: `SEMANTIC.${identity}` }
}
describe('Lane C admitted semantic foundation', () => {
  it('keeps all 25 exact display values and seven bounded no-matches, with no audit fields', () => {
    expect(base.total).toBe(25); expect(base.boundedNoMatches).toBe(7)
    for (const c of base.cards) {
      expect(c.display).toEqual(candidate.displayRecords.find(d => d.id === c.display.id))
      expect(c.display.proofEligible).toBe(false); expect(c.display.runtimeProviderCalls).toBe(0)
      expect(c.display.recursiveFrontierAuthority).toBe(false)
      expect(Object.keys(c.display)).not.toContain('provenance')
      expect(Object.keys(c.display)).not.toContain('auditReferences')
      if (c.display.zeroResultClass) expect(c.statusLabel).toBe(NO_MATCH_COPY)
    }
    expect(JSON.stringify(base)).not.toContain('publicPrivateDispositions')
  })
  for (const record of candidate.displayRecords) it(`preserves one-record admission across modes: ${record.id}`, async () => {
    const view = await createCanonicalView(corpus, [record.id])
    expect(view.total).toBe(1)
    for (const mode of MODES) {
      expect(await displayForMode(corpus, mode, [record.id])).toEqual(view.cards.map(c => c.display))
      for (const surface of SURFACES) {
        const html = renderToStaticMarkup(createElement(CorpusPresentation, { view, mode, surface }))
        expect(html).toContain(record.id); expect(html).toContain(record.questionId)
        expect(html).toContain('SOURCE / LEDGER'); expect(html).toContain(record.temporalClass)
        if (record.zeroResultClass) expect(html).toContain(NO_MATCH_COPY)
      }
    }
  })
  it('search is deterministic, conjunctive, unicode/case/whitespace normalized', () => {
    expect(ids(browse(base, { search: ' relationships ' }))).toEqual(ids(browse(base, { lens: 'RELATIONSHIPS' })))
    expect(ids(browse(base, { search: 'ＲＥＬＡＴＩＯＮＳＨＩＰＳ' }))).toEqual(ids(browse(base, { lens: 'RELATIONSHIPS' })))
    // CONTEXTUAL is the grade of bounded-no-match records too; text search
    // must not silently become a role-only filter.
    expect(ids(browse(base, { search: 'CONTEXTUAL  relationships' }))).toEqual(ids(browse(base, { lens: 'RELATIONSHIPS' })))
    expect(ids(browse(base, { search: '\t\n' }))).toEqual(ids(base))
  })
  it('every filter matches the independently selected accepted values', () => {
    const queries: BrowseQuery[] = [
      ...base.options.lenses.map(lens => ({ lens })), ...base.options.roles.map(role => ({ role })),
      ...base.options.consumers.map(consumerId => ({ consumerId })), ...base.options.storyUses.map(storyUse => ({ storyUse })),
      ...base.options.subjects.map(subjectId => ({ subjectId })), ...base.options.timeWindows.map(timeWindowId => ({ timeWindowId })),
      ...base.options.cells.map(coverageCellId => ({ coverageCellId })), { zeroStatus: 'bounded-no-match' }, { zeroStatus: 'observed' },
    ]
    for (const q of queries) {
      const expected = base.cards.filter(c => {
        const d = c.display
        return (!q.lens || d.lens === q.lens) && (!q.role || d.role === q.role) &&
          (!q.consumerId || d.consumerIds.includes(q.consumerId)) && (!q.storyUse || c.storyUses.includes(q.storyUse)) &&
          (!q.subjectId || d.coverage.key?.subjectId === q.subjectId) && (!q.timeWindowId || d.coverage.key?.timeWindowId === q.timeWindowId) &&
          (!q.coverageCellId || d.coverage.cellIds.includes(q.coverageCellId)) &&
          (!q.zeroStatus || (q.zeroStatus === 'bounded-no-match' ? d.zeroResultClass !== null : d.zeroResultClass === null))
      })
      expect(ids(browse(base, q))).toEqual(expected.map(c => c.display.id))
      expect(browse(base, q)).toEqual(browse(base, q))
    }
  })
  it('all groupings retain full values; consumer groups may overlap without adding records', () => {
    for (const groupBy of ['none', 'lens', 'role', 'storyUse', 'subject', 'timeWindow', 'coverage'] as GroupBy[]) {
      const result = browse(base, { groupBy })
      expect([...new Set(result.groups.flatMap(g => g.cards.map(c => c.display.id)))].sort()).toEqual([...ids(base)].sort())
      expect(result.visible).toBe(25)
      for (const group of result.groups) for (const c of group.cards) expect(base.cards).toContain(c)
    }
    expect(() => browse(base, { groupBy: 'SOURCE' as GroupBy })).toThrow('C1_INVALID_GROUP')
  })
  it('local empty, admitted empty subset and reset never become historical absence', async () => {
    const empty = await createCanonicalView(corpus, [])
    expect(empty.cards).toEqual([]); expect(empty.total).toBe(0); expect(empty.boundedNoMatches).toBe(0)
    const filtered = browse(base, { search: 'not-in-these-records-xyz' })
    expect(filtered.visible).toBe(0); expect(filtered.boundedNoMatches).toBe(0)
    expect(ids(browse(filtered))).toEqual(ids(base))
    for (const mode of MODES) for (const surface of SURFACES) {
      expect(renderToStaticMarkup(createElement(CorpusPresentation, { view: empty, mode, surface }))).toContain(LOCAL_EMPTY_COPY)
    }
    const subset = await createCanonicalView(corpus, [ids(base)[0]!])
    expect(ids(browse(browse(subset, { search: 'not-there' })))).toEqual(ids(subset))
  })
  it('rejects forged/cross-kind tokens, raw arrays, duplicate and unaccepted selection', async () => {
    for (const fake of [{}, { ...corpus }, candidate.displayRecords, syntheticToken]) {
      await expect(createCanonicalView(fake as AdmittedCorpus)).rejects.toThrow('S3_CORPUS_NOT_ADMITTED')
    }
    await expect(createSyntheticView(corpus as unknown as AdmittedSyntheticCorpus)).rejects.toThrow('S3_SYNTHETIC_NOT_ADMITTED')
    await expect(createCanonicalView(corpus, [ids(base)[0]!, ids(base)[0]!])).rejects.toThrow()
    await expect(createCanonicalView(corpus, ['SEMANTIC.fake'])).rejects.toThrow()
    for (const fake of [{ ...base }, candidate.displayRecords, {}]) {
      expect(() => browse(fake as CorpusView)).toThrow('C1_VIEW_NOT_ADMITTED')
      expect(() => renderToStaticMarkup(createElement(CorpusPresentation, { view: fake as CorpusView, mode: 'PLAIN_LIST', surface: 'CASE' }))).toThrow('C1_VIEW_NOT_ADMITTED')
    }
  })
  it('resealed records cannot acquire membership or authority', async () => {
    const original = candidate.displayRecords[0]!
    for (const change of [{ question: 'Replacement question' }, { observedResultCount: original.observedResultCount + 1 }, { proofEligible: true }, { consumerIds: ['CASEBOARD.FAKE'] }]) {
      const altered = await resealDisplay({ ...original, ...change } as typeof original)
      await expect(validateDisplayRecord(altered, corpus)).rejects.toThrow()
    }
    const body = structuredClone(candidate) as Partial<typeof candidate>
    delete body.identity
    body.displayRecords![0]!.question = 'Resealed complete candidate'
    await expect(admitFrozenCorpusCandidate({ ...body, identity: await digest(body) })).rejects.toThrow()
  })
  it('all nine synthetic roles remain visibly noncanonical and nonproof', async () => {
    const view = await createSyntheticView(syntheticToken)
    expect(view.origin).toBe('synthetic'); expect(view.total).toBe(9)
    expect(new Set(view.cards.map(c => c.display.role)).size).toBe(9)
    for (const card of view.cards) {
      expect(card.display.synthetic).toBe(true); expect(card.display.proofEligible).toBe(false)
      expect(card.boundaryLabel).toContain('noncanonical')
      expect(card.statusLabel).not.toBe(NO_MATCH_COPY)
      if (card.display.zeroResultClass) expect(card.statusLabel).toBe(SYNTHETIC_NO_MATCH_COPY)
      await expect(validateDisplayRecord(card.display, corpus)).rejects.toThrow()
    }
    for (const mode of MODES) for (const surface of SURFACES) expect(renderToStaticMarkup(createElement(CorpusPresentation, { view, mode, surface }))).toContain('Synthetic examples — NOT canonical')
  })
  it('view and every nested semantic value are immutable', () => {
    expect(Object.isFrozen(base)).toBe(true); expect(Object.isFrozen(base.cards)).toBe(true)
    for (const c of base.cards) {
      expect(Object.isFrozen(c)).toBe(true); expect(Object.isFrozen(c.display)).toBe(true)
      expect(Object.isFrozen(c.display.coverage.key)).toBe(true); expect(Object.isFrozen(c.storyUses)).toBe(true)
    }
  })
  it('admission, every local filter/group and rendering use no runtime transport', async () => {
    const transport = vi.fn(() => { throw Error('C1_TRANSPORT_FORBIDDEN') })
    for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) vi.stubGlobal(key, transport)
    try {
      const view = await createCanonicalView(await admitFrozenCorpusCandidate(candidate))
      const fixture = await createSyntheticView(await admitSyntheticCorpusFixture(synthetic))
      for (const source of [view, fixture]) for (const mode of MODES) for (const surface of SURFACES) {
        browse(source, { search: 'contextual', groupBy: 'storyUse' })
        renderToStaticMarkup(createElement(CorpusPresentation, { view: source, mode, surface }))
      }
      expect(transport).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
})
