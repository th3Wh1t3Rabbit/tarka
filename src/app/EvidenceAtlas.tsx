import type { CaseFixture } from '../investigation/contracts'
import type { InvestigationState } from '../investigation/state'
import { evidenceAtlas } from '../investigation/atlas'
import { useState } from 'react'

export function EvidenceAtlas({ fixture, state }: { fixture: CaseFixture; state: InvestigationState }) {
  const atlas = evidenceAtlas(fixture, state)
  const [shown, setShown] = useState(20)
  return <section aria-label="Call Atlas and route map">
    <h3>CALL ATLAS — accessible source-to-evidence map</h3>
    <p>Historical source lineage only. These are not new NQ5 calls. One source can produce several evidence views.</p>
    <p>{atlas.calls.length} known source consumers; {Math.min(shown, atlas.calls.length)} shown.</p>
    <table><caption>Known source calls and consumers</caption><thead><tr><th>Source call</th><th>Data family</th><th>Record consumer</th><th>Grade</th><th>Raw digest</th></tr></thead><tbody>{atlas.calls.slice(0, shown).map((call, index) => <tr key={`${call.sourceCallId}:${index}`}><th>{call.sourceCallId}</th><td>{call.endpoint}</td><td>{call.recordId}</td><td>{call.grade}</td><td>{call.rawSha256}</td></tr>)}</tbody></table>
    <h3>ROUTE MAP — accessible observed relations</h3>
    <table><caption>Discovered routes in chronological order</caption><thead><tr><th>Record</th><th>UTC</th><th>Source</th><th>Destination</th><th>Grade and continuity</th></tr></thead><tbody>{atlas.routes.slice(0, shown).map((route) => <tr key={route.recordId}><th>{route.recordId}</th><td>{route.observedAtUtc}</td><td>{route.source}</td><td>{route.destination}</td><td><details><summary>{route.grade}: six checks and claim boundary</summary><ul>{route.checks.map((check) => <li key={check.dimension}>{check.dimension}: {check.status}. {check.explanation}</li>)}</ul><p>{route.boundary}</p></details></td></tr>)}</tbody></table>
    {shown < atlas.routes.length && <button onClick={() => setShown(shown + 20)}>SHOW MORE ATLAS / ROUTE RELATIONS</button>}
  </section>
}
