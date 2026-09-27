import candidate from '../../../artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json'
import synthetic from '../../../artifacts/g6p-s3/REPORTS/SYNTHETIC_SEMANTIC_FIXTURE.json'
import scenario from '../../../public/scenarios/euler-2023-false-exit/scenario.json'
import graph from '../../../public/scenarios/euler-2023-false-exit/evidence-graph.json'
import { buildFrozenFixture } from '../../investigation/fixture'
import type { CaseFixture } from '../../investigation/contracts'
import { canonicalJSON, admitFrozenCorpusCandidate, admitSyntheticCorpusFixture } from '../../investigation/corpus-seam/authority.mjs'
import { createCanonicalView, createSyntheticView } from '../../investigation/semantic-ux/model'

// Permanent, governed inputs. Admission and authority remain the original frozen seam.
// Never accept a fixture ID/mode alone as evidence of canonical truth.
const acceptedFixture = buildFrozenFixture(scenario as Parameters<typeof buildFrozenFixture>[0], graph)
export function canonicalFixture(fixture: CaseFixture): boolean {
  return fixture.mode === 'ACCEPTED_FROZEN' && canonicalJSON(fixture) === canonicalJSON(acceptedFixture)
}
export async function controllerCorpus(fixture: CaseFixture) {
  if (canonicalFixture(fixture)) return createCanonicalView(await admitFrozenCorpusCandidate(candidate))
  if (fixture.mode === 'SYNTHETIC_TEST') return createSyntheticView(await admitSyntheticCorpusFixture(synthetic))
  throw Error('S5_UNRECOGNIZED_FIXTURE_NO_CANONICAL_AUTHORITY')
}
