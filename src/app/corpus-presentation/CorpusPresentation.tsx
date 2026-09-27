import { useId, useState } from 'react'
import type { Presentation, QuestionLens } from '../../investigation/contracts'
import type { SemanticRole } from '../../investigation/corpus-seam/contracts'
import { assertCorpusView, assertPresentation, browse, LOCAL_EMPTY_COPY } from '../../investigation/semantic-ux/model'
import type { BrowseQuery, CorpusView, GroupBy, SemanticCard, StoryUse, Surface } from '../../investigation/semantic-ux/model'
import './corpus.css'

export interface CorpusPresentationProps { view: CorpusView; mode: Presentation; surface: Surface; onInspect?: ((card: SemanticCard) => void) | undefined }
const intro: Record<Surface, string> = {
  CASE: 'Browse accepted questions and their bounded context. These records do not fill exact-proof slots.',
  RESULTS: 'Review observed counts and scoped no-match findings. Counts describe retrieved results, not unique chain-wide events.',
  EXPLORE: 'Explore the accepted corpus locally by Question Lens, semantic role, consumer use, and coverage. No new retrieval occurs.',
}
const syntheticIntro: Record<Surface, string> = {
  CASE: 'Browse synthetic questions only. No canonical evidence or exact proof is displayed.',
  RESULTS: 'Review synthetic result counts and nonhistorical no-match examples only.',
  EXPLORE: 'Explore this synthetic fixture locally. It is not the accepted corpus; no retrieval occurs.',
}
function RecordCard({ card, onInspect }: { card: SemanticCard; onInspect?: ((card: SemanticCard) => void) | undefined }) {
  const d = card.display, k = d.coverage.key
  return <article data-display-id={d.id} aria-label={`Question: ${d.question}`}>
    <h3>{d.question}</h3>
    <p>{card.boundaryLabel}</p>
    {onInspect && <button type="button" onClick={() => onInspect(card)}>INSPECT DISPLAY-SAFE SOURCE</button>}
    <dl>
      <dt>Question Lens</dt><dd>{d.lens}</dd>
      <dt>Semantic role / grade</dt><dd>{d.role} / {d.grade}</dd>
      <dt>Result status</dt><dd>{card.statusLabel}</dd>
      <dt>Observed result count</dt><dd>{d.observedResultCount}</dd>
      <dt>Temporal classification</dt><dd>{d.temporalClass}</dd>
      <dt>Retrieved scope</dt><dd>{d.coverage.scope}</dd>
      <dt>Coverage status</dt><dd>{d.coverage.status} — historical negative support: no</dd>
      <dt>Subject</dt><dd>{k?.subjectId ?? 'Synthetic example — no canonical subject'}</dd>
      <dt>Time window</dt><dd>{k?.timeWindowId ?? 'Synthetic example — nonhistorical'}</dd>
      <dt>Partition</dt><dd>{k?.partitionId ?? 'Synthetic example'}</dd>
      <dt>Coverage cells</dt><dd><ul>{d.coverage.cellIds.map(id => <li key={id}>{id}</li>)}</ul></dd>
      <dt>Consumer use (derived labels, not evidence grades)</dt><dd>{card.storyUses.join('; ')}</dd>
      <dt>Named consumers (references, not proof or audit bodies)</dt><dd><ul>{d.consumerIds.map(id => <li key={id}>{id}</li>)}</ul></dd>
      <dt>Claim boundaries</dt><dd><ul>{d.claimBoundaries.map(limit => <li key={limit}>{limit}</li>)}</ul></dd>
      <dt>Exact display identifier</dt><dd><code>{d.id}</code></dd>
      <dt>Concept reference</dt><dd><code>{d.conceptId}</code></dd>
      <dt>Question identifier</dt><dd><code>{d.questionId}</code></dd>
    </dl>
  </article>
}
export function CorpusPresentation({ view, mode, surface, onInspect }: CorpusPresentationProps) {
  assertCorpusView(view); assertPresentation(mode, surface)
  const uid = useId()
  const [query, setQuery] = useState<BrowseQuery>({})
  const result = browse(view, query)
  function select<K extends keyof BrowseQuery>(key: K, value: string) {
    setQuery(old => { const next = { ...old }; if (!value) delete next[key]; else Object.assign(next, { [key]: value }); return next })
  }
  function picker(key: keyof BrowseQuery, label: string, values: readonly string[]) {
    return <div className="c1-control"><label htmlFor={`${uid}-${key}`}>{label}</label><select id={`${uid}-${key}`} value={query[key] ?? ''} onChange={e => select(key, e.target.value)}>
      <option value="">All</option>{values.map(value => <option key={value} value={value}>{value}</option>)}
    </select></div>
  }
  return <section className={`c1-corpus c1-${mode.toLowerCase()}`} aria-labelledby={`${uid}-title`} data-mode={mode} data-surface={surface}>
    <a className="c1-skip" href={`#${uid}-records`}>Skip filters to display records</a>
    <header><h1 id={`${uid}-title`}>{surface} — {result.origin === 'canonical' ? 'Accepted corpus display' : 'Synthetic examples — NOT canonical'}</h1>
      <p>{result.origin === 'synthetic' ? syntheticIntro[surface] : intro[surface]}</p><p>{result.origin === 'synthetic' ? 'Nonhistorical test fixtures only. Every role, including EXACT, is nonproof.' : 'Contextual accepted records only. Exact historical truth and central progression are unchanged.'}</p>
      <p className="c1-boundary">SOURCE / LEDGER audit provenance remains controller-owned and separate. This view contains display records and named references only, not audit bodies, private data, or new proof authority.</p>
    </header>
    <fieldset><legend>Local browse controls — no external requests</legend>
      <label htmlFor={`${uid}-search`}>{result.origin === 'synthetic' ? 'Search synthetic example text' : 'Search accepted display text'}<input id={`${uid}-search`} type="search" value={query.search ?? ''} onChange={e => select('search', e.target.value)} /></label>
      {picker('lens', 'Question Lens', result.options.lenses as readonly QuestionLens[])}
      {picker('role', 'Semantic role', result.options.roles as readonly SemanticRole[])}
      {picker('zeroStatus', 'Result status', ['bounded-no-match', 'observed'])}
      {picker('storyUse', 'Consumer / story use', result.options.storyUses as readonly StoryUse[])}
      {picker('consumerId', 'Named consumer', result.options.consumers)}
      {picker('subjectId', 'Coverage subject', result.options.subjects)}
      {picker('timeWindowId', 'Coverage time window', result.options.timeWindows)}
      {picker('coverageCellId', 'Coverage cell', result.options.cells)}
      {picker('groupBy', 'Group records by', ['none', 'lens', 'role', 'storyUse', 'subject', 'timeWindow', 'coverage'] as readonly GroupBy[])}
      <button type="button" onClick={() => setQuery({})}>Reset local filters</button>
    </fieldset>
    <p role="status" aria-live="polite" aria-atomic="true">{result.visible} of {result.total} display records; {result.boundedNoMatches} {result.origin === 'synthetic' ? 'synthetic no-match examples' : 'scoped corpus no-match findings'} in this subset.</p>
    {result.groupBy === 'storyUse' && <p>Records may appear in multiple consumer-use groups. Group membership counts are not additive evidence totals.</p>}
    <section id={`${uid}-records`} tabIndex={-1} aria-label="Display records">
      {result.visible === 0 && <p>{LOCAL_EMPTY_COPY}</p>}
      {result.groups.map(group => <section key={group.key} aria-label={`Group: ${group.key}`}><h2>{group.key}</h2>{group.cards.map(card => <RecordCard key={card.display.id} card={card} onInspect={onInspect} />)}</section>)}
    </section>
  </section>
}
