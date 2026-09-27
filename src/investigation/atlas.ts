import type { CaseFixture } from './contracts'
import { knownRecords, threadChecks, visibleClues, type InvestigationState } from './state'

export function evidenceAtlas(fixture: CaseFixture, state: InvestigationState) {
  const records = knownRecords(fixture, state)
  const subjects = new Set([...records.flatMap((record) => [record.source, record.destination]), ...visibleClues(fixture, state).flatMap((clue) => clue.filters.filter((filter) => ['SUBJECT', 'SOURCE', 'DESTINATION'].includes(filter.field)).map((filter) => filter.value))])
  return {
    calls: records.map((record) => ({ sourceCallId: record.provenance.lineage, recordId: record.id, endpoint: record.provenance.endpoint, rawSha256: record.provenance.rawSha256, grade: record.grade, campaignCall: false as const })),
    coverage: fixture.coverage.filter((cell) => subjects.has(cell.subject)),
    routes: [...records].sort((a, b) => a.observedAtUtc.localeCompare(b.observedAtUtc) || a.id.localeCompare(b.id)).map((record) => ({ recordId: record.id, source: record.source, destination: record.destination, observedAtUtc: record.observedAtUtc, grade: record.grade, checks: threadChecks(fixture, state, record), boundary: record.claimBoundary })),
  }
}
