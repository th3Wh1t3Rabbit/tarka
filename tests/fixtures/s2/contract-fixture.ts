import { readFileSync } from 'node:fs'
import { buildFrozenFixture } from '../../../src/investigation/fixture'

/** Contract-shaped, entirely nonhistorical data. IDs preserve structural joins only. */
export function scenarioFixture(seed = 19, size?: number, preserveOfficeAnchor = false) {
  const base = 'public/scenarios/euler-2023-false-exit/'
  const scenario = JSON.parse(readFileSync(base + 'scenario.json', 'utf8')) as Parameters<typeof buildFrozenFixture>[0]
  const graph = JSON.parse(readFileSync(base + 'evidence-graph.json', 'utf8')) as Parameters<typeof buildFrozenFixture>[1]
  const addresses = new Map<string, string>()
  const address = (old: string) => {
    if (!addresses.has(old)) addresses.set(old, `0x${(seed * 100 + addresses.size + 1).toString(16).padStart(40, '0')}`)
    return addresses.get(old)!
  }
  scenario.scenarioId = `LANE_B_SYNTHETIC_${seed}`
  scenario.title = 'NONHISTORICAL LANE B CONTRACT FIXTURE'
  scenario.caseQuestion = 'Which synthetic route is joined by an exact event?'
  scenario.truthConclusion = ['SYNTHETIC ROUTES JOIN.']
  const acceptedOpening = structuredClone(scenario.evidence.find((r) => r.id === scenario.flow.openingEvidenceId)!)
  scenario.evidence.forEach((row, index) => {
    row.transactionHash = `0x${(seed * 1000 + index).toString(16).padStart(64, '0')}`
    row.claim = `[SYNTHETIC ${seed}] ${row.id}`
    row.rawSha256 = (seed + index).toString(16).padStart(64, '0')
    row.normalizedSha256 = (seed + index + 500).toString(16).padStart(64, '0')
    row.sourceLineageId = `SYNTHETIC.LINEAGE.${index}`
    row.facts.roleBindings.forEach((role) => { role.address = address(role.address) })
    row.facts.assetAmounts.forEach((a) => { a.asset = a.asset === 'DAI' ? (preserveOfficeAnchor ? acceptedOpening.facts.assetAmounts[0]!.asset : 'TEST') : 'OTHER'; a.amount = row.id === scenario.flow.destinationEvidenceId ? `${seed}.125` : `${seed + 100}.5` })
  })
  // The ordinary office loader admits a fixed historical anchor amount. Keep that value
  // from the read-only accepted source; all route identities and contextual data vary.
  if (preserveOfficeAnchor) scenario.evidence.find((r) => r.id === scenario.flow.openingEvidenceId)!.facts.assetAmounts = acceptedOpening.facts.assetAmounts
  if (size) {
    const originals = [...scenario.evidence]
    if (size < originals.length) throw new Error('Fixture size loses required structural records')
    while (scenario.evidence.length < size) {
      const index = scenario.evidence.length
      const row = structuredClone(originals[index % originals.length]!)
      row.id = `LANE_B.CONTEXT.${index}`; row.claim = `[SYNTHETIC] contextual control ${index}`
      row.grade = 'CONTEXTUAL'; row.proofGrade = 'CONTEXTUAL'; row.facts.provesRoute = false
      row.transactionHash = `0x${(seed * 100000 + index).toString(16).padStart(64, '0')}`
      row.facts.roleBindings.forEach((role, j) => { role.address = `0x${(seed * 100000 + (index % 64) * 10 + j).toString(16).padStart(40, '0')}` })
      scenario.evidence.push(row)
    }
  }
  const fixture = buildFrozenFixture(scenario, graph)
  fixture.mode = 'SYNTHETIC_TEST'
  return { scenario, graph, fixture }
}
