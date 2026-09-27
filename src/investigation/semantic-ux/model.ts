import { displayForMode, syntheticDisplayForMode } from '../corpus-seam/authority.mjs'
import type { AdmittedCorpus, AdmittedSyntheticCorpus, DeepReadonly } from '../corpus-seam/authority.mjs'
import type { DisplayRecord, SemanticRole } from '../corpus-seam/contracts'
import type { Presentation, QuestionLens } from '../contracts'

export const MODES = ['FULLSCREEN_CRT', 'DOCKED_OVERLAY', 'PLAIN_LIST'] as const
export const SURFACES = ['CASE', 'RESULTS', 'EXPLORE'] as const
export type Surface = typeof SURFACES[number]
export type StoryUse = 'Case context' | 'Corpus browsing' | 'Flow question' | 'Dead-end question' | 'Evidence comparison' | 'Query receipt' | 'Coverage context' | 'Audit reference' | 'Regression reference' | 'Other named consumer'
export type GroupBy = 'none' | 'lens' | 'role' | 'storyUse' | 'subject' | 'timeWindow' | 'coverage'
export interface BrowseQuery {
  search?: string; lens?: QuestionLens; role?: SemanticRole
  zeroStatus?: 'bounded-no-match' | 'observed'; consumerId?: string
  storyUse?: StoryUse; subjectId?: string; timeWindowId?: string
  coverageCellId?: string; groupBy?: GroupBy
}
export const NO_MATCH_COPY = 'No match in the accepted corpus for this question and retrieved scope. This does not establish historical or chain-wide absence.'
export const SYNTHETIC_NO_MATCH_COPY = 'No match in this synthetic fixture. This is a nonhistorical example, not an accepted-corpus finding.'
export const LOCAL_EMPTY_COPY = 'No display records match these local filters. This is not a corpus no-match finding or evidence of historical absence.'
export interface SemanticCard {
  readonly display: DeepReadonly<DisplayRecord>
  readonly storyUses: readonly StoryUse[]
  readonly statusLabel: string
  readonly boundaryLabel: string
}
declare const viewBrand: unique symbol
export interface CorpusView {
  readonly [viewBrand]: true
  readonly origin: 'canonical' | 'synthetic'
  readonly cards: readonly SemanticCard[]
  readonly groups: readonly { key: string; cards: readonly SemanticCard[] }[]
  readonly total: number
  readonly visible: number
  readonly boundedNoMatches: number
  readonly groupBy: GroupBy
  readonly options: {
    readonly lenses: readonly QuestionLens[]; readonly roles: readonly SemanticRole[]
    readonly consumers: readonly string[]; readonly storyUses: readonly StoryUse[]
    readonly subjects: readonly string[]; readonly timeWindows: readonly string[]; readonly cells: readonly string[]
  }
}
// Runtime membership is necessary even for callers that cast around TypeScript.
// Neither raw records nor structurally copied view objects are admitted here.
const pools = new WeakMap<object, readonly SemanticCard[]>()
const origins = new WeakMap<object, 'canonical' | 'synthetic'>()
const sortStrings = <T extends string>(xs: readonly T[]): readonly T[] => Object.freeze([...new Set(xs)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0))
function uses(ids: readonly string[]): readonly StoryUse[] {
  return sortStrings(ids.map(id => {
    if (id.startsWith('CASEBOARD.')) return 'Case context'
    if (id.startsWith('CASE_CORPUS.')) return 'Corpus browsing'
    if (id.startsWith('FLOWTEST.')) return 'Flow question'
    if (id.startsWith('DEADEND.')) return 'Dead-end question'
    if (id.startsWith('EVIDENCE_DELTA.')) return 'Evidence comparison'
    if (id.startsWith('QUERY_RECEIPT.')) return 'Query receipt'
    if (id.startsWith('CELL.') || id.startsWith('COVERAGE.')) return 'Coverage context'
    if (id.startsWith('CALL_ATLAS.') || id.startsWith('PROVENANCE.')) return 'Audit reference'
    if (id.startsWith('TEST.')) return 'Regression reference'
    return 'Other named consumer'
  }))
}
function card(display: DeepReadonly<DisplayRecord>): SemanticCard {
  return Object.freeze({ display, storyUses: uses(display.consumerIds),
    statusLabel: display.synthetic
      ? (display.zeroResultClass ? SYNTHETIC_NO_MATCH_COPY : `${display.observedResultCount} synthetic example results; not accepted historical evidence.`)
      : (display.zeroResultClass ? NO_MATCH_COPY : `${display.observedResultCount} observed results in the accepted retrieved scope; partial coverage only.`),
    boundaryLabel: display.synthetic ? 'Synthetic, nonhistorical, noncanonical, nonproof example.' : 'Contextual display only. Exact Euler proof remains separate; no proof-slot or recursive authority.' })
}
const folded = (x: string) => x.normalize('NFKC').toLowerCase()
function searchText(c: SemanticCard): string {
  const d = c.display, k = d.coverage.key
  return folded([d.id, d.conceptId, d.questionId, d.question, d.lens, d.role, d.grade,
    d.temporalClass, d.zeroResultClass ?? '', c.statusLabel, ...c.storyUses, ...d.consumerIds,
    d.coverage.scope, d.coverage.status, ...d.coverage.cellIds, ...Object.values(k ?? {}), ...d.claimBoundaries].join('\n'))
}
function matches(c: SemanticCard, q: BrowseQuery): boolean {
  const d = c.display
  const terms = folded(q.search ?? '').trim().split(/\s+/u).filter(Boolean)
  return terms.every(t => searchText(c).includes(t)) &&
    (q.lens === undefined || d.lens === q.lens) && (q.role === undefined || d.role === q.role) &&
    (q.zeroStatus === undefined || (q.zeroStatus === 'bounded-no-match' ? d.zeroResultClass !== null : d.zeroResultClass === null)) &&
    (q.consumerId === undefined || d.consumerIds.includes(q.consumerId)) &&
    (q.storyUse === undefined || c.storyUses.includes(q.storyUse)) &&
    (q.subjectId === undefined || d.coverage.key?.subjectId === q.subjectId) &&
    (q.timeWindowId === undefined || d.coverage.key?.timeWindowId === q.timeWindowId) &&
    (q.coverageCellId === undefined || d.coverage.cellIds.includes(q.coverageCellId))
}
function groupKeys(c: SemanticCard, by: GroupBy): readonly string[] {
  const d = c.display
  switch (by) {
    case 'none': return ['Display records']
    case 'lens': return [d.lens]
    case 'role': return [d.role]
    case 'storyUse': return c.storyUses
    case 'subject': return [d.coverage.key?.subjectId ?? 'No canonical subject (synthetic)']
    case 'timeWindow': return [d.coverage.key?.timeWindowId ?? 'No historical time window (synthetic)']
    case 'coverage': return [d.coverage.scope]
  }
}
function build(pool: readonly SemanticCard[], origin: 'canonical' | 'synthetic', q: BrowseQuery): CorpusView {
  const groupBy = q.groupBy ?? 'none'
  if (!['none', 'lens', 'role', 'storyUse', 'subject', 'timeWindow', 'coverage'].includes(groupBy)) throw Error('C1_INVALID_GROUP')
  if (q.zeroStatus !== undefined && !['bounded-no-match', 'observed'].includes(q.zeroStatus)) throw Error('C1_INVALID_ZERO_FILTER')
  const cards = Object.freeze(pool.filter(c => matches(c, q)))
  const grouped = new Map<string, SemanticCard[]>()
  for (const c of cards) for (const key of groupKeys(c, groupBy)) grouped.set(key, [...(grouped.get(key) ?? []), c])
  const groups = Object.freeze(sortStrings([...grouped.keys()]).map(key => Object.freeze({ key, cards: Object.freeze(grouped.get(key)!) })))
  const options = Object.freeze({
    lenses: sortStrings(pool.map(c => c.display.lens)), roles: sortStrings(pool.map(c => c.display.role)),
    consumers: sortStrings(pool.flatMap(c => [...c.display.consumerIds])), storyUses: sortStrings(pool.flatMap(c => [...c.storyUses])),
    subjects: sortStrings(pool.flatMap(c => c.display.coverage.key ? [c.display.coverage.key.subjectId] : [])),
    timeWindows: sortStrings(pool.flatMap(c => c.display.coverage.key ? [c.display.coverage.key.timeWindowId] : [])),
    cells: sortStrings(pool.flatMap(c => [...c.display.coverage.cellIds])),
  })
  const view = Object.freeze({ origin, cards, groups, total: pool.length, visible: cards.length,
    boundedNoMatches: cards.filter(c => c.display.zeroResultClass !== null).length, groupBy, options }) as CorpusView
  pools.set(view, pool); origins.set(view, origin)
  return view
}
export async function createCanonicalView(token: AdmittedCorpus, acceptedIds?: string[]): Promise<CorpusView> {
  const records = await displayForMode(token, 'PLAIN_LIST', acceptedIds === undefined ? undefined : [...acceptedIds])
  return build(Object.freeze(records.map(card)), 'canonical', {})
}
export async function createSyntheticView(token: AdmittedSyntheticCorpus, ids?: string[]): Promise<CorpusView> {
  const records = await syntheticDisplayForMode(token, 'PLAIN_LIST', ids === undefined ? undefined : [...ids])
  return build(Object.freeze(records.map(card)), 'synthetic', {})
}
export function assertCorpusView(view: CorpusView): void {
  if (!view || !pools.has(view)) throw Error('C1_VIEW_NOT_ADMITTED')
}
// Pure deterministic local projection: always filters the admitted base subset,
// not the previous filtered result. The token/source is never exposed in the VM.
export function browse(view: CorpusView, query: BrowseQuery = {}): CorpusView {
  assertCorpusView(view)
  return build(pools.get(view)!, origins.get(view)!, query)
}
export function assertPresentation(mode: Presentation, surface: Surface): void {
  if (!(MODES as readonly string[]).includes(mode) || !(SURFACES as readonly string[]).includes(surface)) throw Error('C1_INVALID_PRESENTATION')
}
