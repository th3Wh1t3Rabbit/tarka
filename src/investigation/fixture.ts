import type { CaseClue, CaseFixture, CaseRecord, CoverageCell } from './contracts.js'
import type { S13Runtime } from './s13.js'

interface EvidenceInput { id: string; claim: string; grade: CaseRecord['grade']; observedAtUtc: string; transactionHash: string; sourceEndpoint: string; rawSha256: string; normalizedSha256: string; retrievedAtUtc: string; sourceLineageId: string; numericPrecisionStatus: string; proofGrade: string; derivedFromEvidenceIds: string[]; facts: { assetAmounts: CaseRecord['assetAmounts']; roleBindings: { entityId: string; role: string; address: string }[]; provesRoute: boolean } }
interface ScenarioInput { scenarioId: string; title: string; caseQuestion: string; historicalCutoff: string; historicalWindow: { startUtc: string; endUtc: string }; evidence: EvidenceInput[]; flow: { openingEvidenceId: string; destinationEvidenceId: string }; branches: { id: string; evidenceId: string }[]; truthConclusion: string[] }
interface GraphInput { relationships: { evidenceId: string; fromEntityId: string; toEntityId: string; kind: string }[] }
const BOUNDARY = 'No common human identity, offchain intent, unsupported coordination, or ultimate destination of all later value is established.'
export function buildFrozenFixture(scenario: ScenarioInput, graph: GraphInput): CaseFixture {
  const records = scenario.evidence.map((evidence): CaseRecord => {
    const relation = graph.relationships.find((row) => row.evidenceId === evidence.id && ['CONVERGES_TO', 'RECEIVES'].includes(row.kind)) ?? graph.relationships.find((row) => row.evidenceId === evidence.id)
    const role = (id: string | undefined) => evidence.facts.roleBindings.find((row) => row.entityId === id)?.address ?? evidence.facts.roleBindings[0]?.address ?? ''
    return { id: evidence.id, summary: evidence.claim, observedAtUtc: evidence.observedAtUtc, transactionHash: evidence.transactionHash, source: role(relation?.fromEntityId), destination: role(relation?.toEntityId), assetAmounts: evidence.facts.assetAmounts, grade: evidence.grade, kind: evidence.grade === 'CORROBORATING' ? 'STATE' : 'ACTIVITY', exactRelationship: evidence.grade === 'EXACT' && evidence.proofGrade === 'EXACT_EVENT' && evidence.facts.provesRoute, derivedFrom: evidence.derivedFromEvidenceIds, claimBoundary: BOUNDARY, provenance: { endpoint: evidence.sourceEndpoint, rawSha256: evidence.rawSha256, normalizedSha256: evidence.normalizedSha256, retrievedAtUtc: evidence.retrievedAtUtc, lineage: evidence.sourceLineageId, precision: evidence.numericPrecisionStatus, attribution: 'Powered by Nansen API' } }
  })
  const opening = records.find(({ id }) => id === scenario.flow.openingEvidenceId)!
  const link = records.find(({ id }) => id === scenario.flow.destinationEvidenceId)!
  const second = records.find(({ id }) => id === scenario.branches.find(({ id }) => id === 'second-breach')!.evidenceId)!
  if (!opening || !link || !second || records.some((record) => !Number.isFinite(Date.parse(record.observedAtUtc)) || Date.parse(record.observedAtUtc) > Date.parse(scenario.historicalCutoff))) throw new Error('Invalid frozen fixture')
  // Accepted DAI token contract address (MAIN-bound truth for the case-file copy).
  // It is display-only: no accepted query field addresses a token contract.
  const ACCEPTED_DAI_CONTRACT_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f'
  const clue = (id: string, label: string, category: CaseClue['category'], filters: CaseClue['filters'], sourceRecordIds = [opening.id], unlockEvent = 'COLLECTION.EULER_CASE_FILE'): CaseClue => ({ id, label, role: category === 'STARTING_POINT' ? 'ANCHOR' : 'BOUND', category, filters, sourceRecordIds, unlockEvent, reusable: true, nonConsumable: true })
  // Case-file facts only: DAI, DAI contract address, ~8.88M amount, incident
  // window (required by the first-question recipe). First Engine, outgoing
  // direction, and the opening record unlock at the first dispatch instead.
  const clues = [
    clue('CLUE.ASSET', 'Recorded asset', 'WHAT_MOVED', [{ field: 'ASSET', value: opening.assetAmounts[0]!.asset }]),
    { ...clue('CLUE.FILE_ASSET_ADDRESS', 'DAI token contract', 'WHAT_MOVED', [{ field: 'ASSET', value: opening.assetAmounts[0]!.asset }]), displayValue: ACCEPTED_DAI_CONTRACT_ADDRESS },
    clue('CLUE.AMOUNT', 'First Breach amount', 'WHAT_MOVED', [{ field: 'MIN_AMOUNT', value: opening.assetAmounts[0]!.amount }]),
    clue('CLUE.WINDOW', 'Incident window', 'WHEN', [{ field: 'FROM', value: scenario.historicalWindow.startUtc }, { field: 'TO', value: scenario.historicalWindow.endUtc }]),
    clue('CLUE.START', 'First Breach address / First Engine', 'STARTING_POINT', [{ field: 'SUBJECT', value: opening.destination }], [opening.id], `RESULT.${opening.id}`),
    clue('CLUE.OUT', 'Outgoing direction', 'WHAT_MOVED', [{ field: 'SOURCE', value: opening.destination }], [opening.id], `RESULT.${opening.id}`),
  ]
  const subjects = [...new Set(records.flatMap(({ source, destination }) => [source, destination]))].filter(Boolean)
  const startingClueIds = ['CLUE.ASSET', 'CLUE.FILE_ASSET_ADDRESS', 'CLUE.AMOUNT', 'CLUE.WINDOW']
  for (const record of records) {
    clues.push({ ...clue(`CLUE.RESULT.${record.id}`, 'Discovered candidate receipt', 'CHECK', [{ field: 'TRANSACTION', value: record.transactionHash }], [record.id]), role: 'CANDIDATE', unlockEvent: `RESULT.${record.id}` })
    if (record.id === link.id) clues.push({ ...clue(`CLUE.PROOF.${record.id}`, 'Verified Link receipt', 'CHECK', [{ field: 'TRANSACTION', value: record.transactionHash }], [record.id]), role: 'PROOF', unlockEvent: `EXACT.${record.id}` })
  }
  const coverage: CoverageCell[] = subjects.flatMap((subject) => (['ACTIVITY', 'RELATIONSHIPS', 'STATE', 'RECEIPT'] as const).map((lens) => ({ id: `${subject}:${lens}:accepted`, subject, lens, fromUtc: scenario.historicalWindow.startUtc, toUtc: scenario.historicalCutoff, partition: 'ACCEPTED_RECORDS_ONLY', status: 'PARTIAL' as const, supportsNegative: false, sourceCallIds: [] })))
  return { schemaVersion: '1.0.0', id: scenario.scenarioId, mode: 'ACCEPTED_FROZEN', title: scenario.title, question: scenario.caseQuestion, cutoffUtc: scenario.historicalCutoff, records, clues, startingClueIds, openingRecordId: opening.id, secondRecordId: second.id, proof: { slots: { AMOUNT: opening.id, RECEIVER: second.id, LINK: link.id }, linkSource: link.source, linkDestination: link.destination, linkAsset: link.assetAmounts[0]!.asset, linkTimeUtc: link.observedAtUtc, conclusion: 'THE FIRST TRAIL JOINED THE SECOND ROUTE.', boundary: BOUNDARY }, coverage, ledger: { attempts: 0, successfulResponses: 0, curatedAcceptedCalls: 0, credits: null, proofRoot: null } }
}

/** Bind the S13-only clue aliases and exact-proof rule without changing the base/synthetic contract. */
export function attachS13Runtime(base: CaseFixture, s13: S13Runtime): CaseFixture {
  const fixture = structuredClone(base)
  const opening = fixture.records.find(({ id }) => id === fixture.openingRecordId)!
  const clue = (id: string, label: string, filters: CaseClue['filters']): CaseClue => ({ id, label, role: 'BOUND', category: 'WHAT_MOVED', filters, sourceRecordIds: [opening.id], unlockEvent: 'COLLECTION.EULER_CASE_FILE', reusable: true, nonConsumable: true })
  const aliases = [
    clue('CLUE.CASE_FILE.DAI', 'Case-file DAI clue', [{ field: 'ASSET', value: opening.assetAmounts[0]!.asset }]),
    clue('CLUE.CASE_FILE.AMOUNT_8_88M', 'Case-file approximate 8.88M clue', [{ field: 'MIN_AMOUNT', value: opening.assetAmounts[0]!.amount }]),
  ]
  fixture.clues.push(...aliases.filter(({ id }) => !fixture.clues.some((existing) => existing.id === id)))
  fixture.startingClueIds = [...fixture.startingClueIds, ...aliases.map(({ id }) => id).filter((id) => !fixture.startingClueIds.includes(id))]
  fixture.proof.slots = { AMOUNT: fixture.proof.slots.LINK, RECEIVER: fixture.proof.slots.LINK, LINK: fixture.proof.slots.LINK }
  fixture.s13 = s13
  return fixture
}
export async function loadFrozenFixture(): Promise<CaseFixture> {
  const base = '/scenarios/euler-2023-false-exit/'
  const [scenario, graph, s13] = await Promise.all(['scenario.json', 'evidence-graph.json', 's13-runtime.json'].map(async (name) => { const response = await fetch(base + name); if (!response.ok) throw new Error(`Frozen corpus unavailable (${response.status})`); return response.json() }))
  const fixture = buildFrozenFixture(scenario as ScenarioInput, graph as GraphInput)
  return scenario.scenarioId === 'EULER_2023_FALSE_EXIT' ? attachS13Runtime(fixture, s13 as S13Runtime) : fixture
}
/** Explicitly nonhistorical second fixture; tests must not label it Euler history. */
export function syntheticFixture(frozen: CaseFixture): CaseFixture {
  const fixture = structuredClone(frozen)
  delete fixture.s13
  const s13ClueIds = new Set(['CLUE.CASE_FILE.DAI', 'CLUE.CASE_FILE.AMOUNT_8_88M'])
  fixture.clues = fixture.clues.filter(({ id }) => !s13ClueIds.has(id))
  fixture.startingClueIds = fixture.startingClueIds.filter((id) => !s13ClueIds.has(id))
  fixture.proof.slots = { AMOUNT: fixture.openingRecordId, RECEIVER: fixture.secondRecordId, LINK: fixture.proof.slots.LINK }
  fixture.id = 'SYNTHETIC_CAUSALITY_B'; fixture.mode = 'SYNTHETIC_TEST'; fixture.title = 'SYNTHETIC SECOND FIXTURE'
  const recordIds = new Map(fixture.records.map(record => [record.id, `${fixture.id}.RECORD.${record.id}`]))
  const recordId = (id: string) => recordIds.get(id) ?? `${fixture.id}.EXTERNAL.${id}`
  const clueId = (id: string) => id.startsWith('CLUE.RESULT.') ? `CLUE.RESULT.${recordId(id.slice('CLUE.RESULT.'.length))}` : id.startsWith('CLUE.PROOF.') ? `CLUE.PROOF.${recordId(id.slice('CLUE.PROOF.'.length))}` : `${fixture.id}.${id}`
  const eventId = (id: string) => id.startsWith('RESULT.') ? `RESULT.${recordId(id.slice('RESULT.'.length))}` : id.startsWith('EXACT.') ? `EXACT.${recordId(id.slice('EXACT.'.length))}` : `${fixture.id}.EVENT.${id}`
  const mapping = new Map(fixture.records.flatMap(({ source, destination }) => [source, destination]).filter(Boolean).map((address, index) => [address, `0x${(index + 100).toString(16).padStart(40, '0')}`]))
  const replace = (value: string) => { let result = value; for (const [from, to] of mapping) result = result.replaceAll(from, to); return result }
  const hashes = new Map(fixture.records.map((record, index) => [record.transactionHash, `0x${index.toString(16).padStart(64, '0')}`]))
  fixture.records = fixture.records.map((record) => {
    const assetAmounts = record.assetAmounts.map((amount) => ({ ...amount, asset: amount.asset === 'DAI' ? 'TEST' : amount.asset, amount: amount.asset === 'DAI' ? '1234.5' : amount.amount }))
    return { ...record, id: recordId(record.id), derivedFrom: record.derivedFrom.map(recordId), summary: `[SYNTHETIC] ${record.grade} ${assetAmounts.map(({ amount, asset }) => `${amount} ${asset}`).join('; ')} from ${replace(record.source)} to ${replace(record.destination)} at ${record.observedAtUtc}`, source: mapping.get(record.source)!, destination: mapping.get(record.destination)!, assetAmounts, transactionHash: hashes.get(record.transactionHash)! }
  })
  fixture.clues = fixture.clues.map((clue) => ({ ...clue, id: clueId(clue.id), sourceRecordIds: clue.sourceRecordIds.map(recordId), unlockEvent: eventId(clue.unlockEvent), filters: clue.filters.map((filter) => ({ ...filter, value: filter.field === 'RECORD_SET' ? filter.value.split('|').map(recordId).join('|') : mapping.get(filter.value) ?? hashes.get(filter.value) ?? (filter.field === 'ASSET' ? 'TEST' : filter.field === 'MIN_AMOUNT' ? '1234.5' : filter.value) })) }))
  fixture.startingClueIds = fixture.startingClueIds.map(clueId)
  fixture.openingRecordId = recordId(fixture.openingRecordId); fixture.secondRecordId = recordId(fixture.secondRecordId)
  fixture.proof.slots = { AMOUNT: recordId(fixture.proof.slots.AMOUNT), RECEIVER: recordId(fixture.proof.slots.RECEIVER), LINK: recordId(fixture.proof.slots.LINK) }
  fixture.proof.linkSource = mapping.get(fixture.proof.linkSource)!; fixture.proof.linkDestination = mapping.get(fixture.proof.linkDestination)!; fixture.proof.linkAsset = 'TEST'
  fixture.proof.conclusion = 'SYNTHETIC TRAIL CONTINUITY ESTABLISHED.'
  fixture.coverage = fixture.coverage.map((cell) => ({ ...cell, subject: mapping.get(cell.subject)!, status: 'COMPLETE', supportsNegative: true }))
  return fixture
}
