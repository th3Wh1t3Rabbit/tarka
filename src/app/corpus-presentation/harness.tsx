import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { admitFrozenCorpusCandidate, admitSyntheticCorpusFixture } from '../../investigation/corpus-seam/authority.mjs'
import { createCanonicalView, createSyntheticView, MODES, SURFACES } from '../../investigation/semantic-ux/model'
import type { CorpusView, Surface } from '../../investigation/semantic-ux/model'
import type { Presentation } from '../../investigation/contracts'
import { CorpusPresentation } from './CorpusPresentation'
// Isolated test-only package inputs; not an App.tsx or gameplay integration.
import candidate from '../../../artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json'
import synthetic from '../../../artifacts/g6p-s3/REPORTS/SYNTHETIC_SEMANTIC_FIXTURE.json'

// Test entry point is built statically; it does not use Fast Refresh.
// eslint-disable-next-line react-refresh/only-export-components
function Harness({ view }: { view: CorpusView }) {
  const [mode, setMode] = useState<Presentation>('PLAIN_LIST')
  const [surface, setSurface] = useState<Surface>('CASE')
  return <><nav className="c1-corpus" aria-label="Isolated harness settings">
    <p>Lane C isolated harness — not gameplay integration or Lead acceptance.</p>
    <div className="c1-control"><label htmlFor="h-mode">Presentation mode</label><select id="h-mode" value={mode} onChange={e => setMode(e.target.value as Presentation)}>{MODES.map(m => <option key={m}>{m}</option>)}</select></div>
    <div className="c1-control"><label htmlFor="h-surface">Display surface</label><select id="h-surface" value={surface} onChange={e => setSurface(e.target.value as Surface)}>{SURFACES.map(s => <option key={s}>{s}</option>)}</select></div>
  </nav><CorpusPresentation view={view} mode={mode} surface={surface} /></>
}
const root = createRoot(document.getElementById('root')!)
async function start() {
  const params = new URLSearchParams(location.search)
  const ids = params.has('empty') ? [] : undefined
  const view = params.get('fixture') === 'synthetic'
    ? await createSyntheticView(await admitSyntheticCorpusFixture(synthetic), ids)
    : await createCanonicalView(await admitFrozenCorpusCandidate(candidate), ids)
  root.render(<Harness view={view} />)
}
void start().catch(() => root.render(<p role="alert">Local corpus admission failed. No records were displayed.</p>))
