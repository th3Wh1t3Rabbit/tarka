import { describe, expect, it } from 'vitest'
import { compileScenario, verifyCompiledBundle } from '../../src/game/compiler/compile'
import { eulerBundle, eulerEvidenceGraph, eulerLeadConfig } from '../../src/game/scenario/euler'
import { scenarioCatalog } from '../../src/game/scenario/catalog'
import { syntheticBundle } from '../../src/game/scenario/synthetic-compiled'
import { evaluateCompiledTheory } from '../../src/game/solver/evaluate'
import { sha256Scenario } from '../../src/game/solver/hash'

describe('G5 generic deterministic compiler', () => {
  it('compiles synthetic calibration and Euler through the same public interface', () => {
    expect(scenarioCatalog.entries.map(({ id }) => id)).toEqual(['EULER_2023_FALSE_EXIT', 'synthetic-prism-calibration-v2'])
    expect(verifyCompiledBundle(eulerBundle)).toBe(true)
    expect(verifyCompiledBundle(syntheticBundle)).toBe(true)
  })

  it('produces identical scenario and world hashes for identical input and versions', () => {
    expect(compileScenario(eulerEvidenceGraph, eulerLeadConfig)).toEqual(eulerBundle)
  })

  it('changes the scenario truth surface when relevant evidence changes', () => {
    const changed = structuredClone(eulerEvidenceGraph)
    changed.evidence.find(({ id }) => id === 'CONTEXT_SECONDARY')!.uncertainty = 'Changed bounded context note.'
    const compiled = compileScenario(changed, eulerLeadConfig)
    expect(compiled.provenance.scenarioHash).not.toBe(eulerBundle.provenance.scenarioHash)
    expect(compiled.provenance.worldHash).toBe(eulerBundle.provenance.worldHash)
  })

  it('changes world provenance for a critical-edge mutation and layout for a time mutation', () => {
    const edgeChanged = structuredClone(eulerEvidenceGraph)
    edgeChanged.relationships.find(({ id }) => id === 'main-receiving-point')!.id = 'main-receiving-point-mutated'
    expect(compileScenario(edgeChanged, eulerLeadConfig).provenance.worldHash).not.toBe(eulerBundle.provenance.worldHash)

    const timeChanged = structuredClone(eulerEvidenceGraph)
    timeChanged.events.find(({ id }) => id === 'early_exploit')!.observedAtUtc = '2023-03-13T08:51:59Z'
    expect(compileScenario(timeChanged, eulerLeadConfig).provenance.worldHash).not.toBe(eulerBundle.provenance.worldHash)
  })

  it('rejects removal of the convergence edge and asset-bearing initiation edges', () => {
    const noConvergence = structuredClone(eulerEvidenceGraph)
    noConvergence.relationships = noConvergence.relationships.filter(({ id }) => id !== 'route-convergence')
    expect(() => compileScenario(noConvergence, eulerLeadConfig)).toThrow('First falsifier')
    const falseInitiation = structuredClone(eulerEvidenceGraph)
    Object.assign(falseInitiation.relationships.find(({ id }) => id === 'early-initiation')!, { asset: 'DAI', amount: '8877507.3483067' })
    expect(() => compileScenario(falseInitiation, eulerLeadConfig)).toThrow('Initiation edge cannot claim an asset transfer')
  })

  it('compiles declared node identities and complete node provenance without runtime special-casing', () => {
    const renamed = structuredClone(eulerLeadConfig)
    for (const role of Object.keys(renamed.experiencePlan.navigation.nodeIds) as Array<keyof typeof renamed.experiencePlan.navigation.nodeIds>) renamed.experiencePlan.navigation.nodeIds[role] = `declared-${role}`
    renamed.branches[0].nodeId = renamed.experiencePlan.navigation.nodeIds['branch-primary']
    renamed.branches[1].nodeId = renamed.experiencePlan.navigation.nodeIds['branch-secondary']
    const compiled = compileScenario(eulerEvidenceGraph, renamed)
    expect(compiled.world.nodes.every(({ id }) => id.startsWith('declared-'))).toBe(true)
    expect(compiled.world.nodes.every(({ provenanceEvidenceIds }) => provenanceEvidenceIds.length > 0)).toBe(true)
  })

  it('derives deterministic provenance generation no earlier than every source retrieval', () => {
    const latest = Math.max(...eulerEvidenceGraph.evidence.map(({ retrievedAtUtc }) => Date.parse(retrievedAtUtc)))
    expect(Date.parse(eulerBundle.provenance.generatedAt)).toBeGreaterThanOrEqual(latest)
    expect(eulerBundle.scenario.generatedAt).toBe(eulerBundle.provenance.generatedAt)
  })

  it('uses standards-based SHA-256 provenance', () => {
    expect(sha256Scenario({})).toBe('sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a')
    expect(eulerBundle.provenance.scenarioHash).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('rejects changed convergence math, post-cutoff evidence, and negative amounts', () => {
    const wrongAmount = structuredClone(eulerEvidenceGraph)
    wrongAmount.evidence.find(({ id }) => id === 'EXACT_CONVERGENCE')!.facts.assetAmounts[0]!.amount = '1'
    expect(() => compileScenario(wrongAmount, eulerLeadConfig)).toThrow('Relationship amount')
    const future = structuredClone(eulerEvidenceGraph)
    future.evidence.find(({ id }) => id === 'CONTEXT_SECONDARY')!.observedAtUtc = '2023-03-13T12:15:01Z'
    expect(() => compileScenario(future, eulerLeadConfig)).toThrow('after cutoff')
    const negative = structuredClone(eulerEvidenceGraph)
    negative.evidence.find(({ id }) => id === 'STATE_EARLY_ENGINE')!.facts.assetAmounts[0]!.amount = '-1'
    expect(() => compileScenario(negative, eulerLeadConfig)).toThrow('negative asset amount')
  })

  it('cross-checks every historical evidence endpoint against the reviewed redistribution policy', () => {
    const restricted = structuredClone(eulerEvidenceGraph)
    restricted.evidence[0]!.sourceEndpoint = '/api/v1/account'
    expect(() => compileScenario(restricted, eulerLeadConfig)).toThrow('not public-allowlisted by reviewed provider policy')
  })

  it('preserves exact, corroborating, and contextual grades without using context as proof', () => {
    expect(new Set(eulerBundle.scenario.evidence.map(({ grade }) => grade))).toEqual(new Set(['EXACT', 'CORROBORATING', 'CONTEXTUAL']))
    expect(eulerBundle.scenario.proofEvidenceIds.map((id) => eulerBundle.scenario.evidence.find((item) => item.id === id)?.grade)).toEqual(['EXACT', 'EXACT', 'EXACT'])
    expect(eulerBundle.scenario.proofEvidenceIds).not.toContain('STATE_EARLY_ENGINE')
    const invalid = structuredClone(eulerLeadConfig)
    invalid.proofEvidenceIds = ['CONTEXT_QUIET_INTERVAL']
    expect(() => compileScenario(eulerEvidenceGraph, invalid)).toThrow(/cannot multiply proof|Contextual evidence/)
  })

  it('accounts for every deliberate omission and omits negative historical rows', () => {
    expect(eulerBundle.scenario.omittedEventManifest.count).toBe(eulerBundle.scenario.omittedEventManifest.ids.length)
    expect(eulerBundle.scenario.omittedEventManifest.ids).toContain('UNEXPLAINED_NEGATIVE_BALANCE_ROWS')
    expect(JSON.stringify(eulerBundle)).not.toContain('-8877507')
  })

  it('derives proof closure and first falsifier from validated graph dependencies', () => {
    expect(evaluateCompiledTheory(eulerBundle.scenario, eulerBundle.scenario.canonicalTheory)).toEqual({ accepted: true, firstContradiction: null, proofEvidenceIds: ['EXACT_EARLY_NET', 'EXACT_MAIN_RECEIVER', 'EXACT_CONVERGENCE'] })
    const wrong = evaluateCompiledTheory(eulerBundle.scenario, eulerBundle.scenario.wrongTheory)
    expect(wrong.accepted).toBe(false)
    expect(wrong.firstContradiction?.evidenceIds).toContain(eulerBundle.scenario.firstFalsifier)
  })

  it('rejects a non-falsifying wrong theory and dangling contradiction evidence', () => {
    const sameTheory = structuredClone(eulerLeadConfig)
    sameTheory.wrongTheory = structuredClone(sameTheory.canonicalTheory)
    expect(() => compileScenario(eulerEvidenceGraph, sameTheory)).toThrow('Wrong theory cannot equal')
    const dangling = structuredClone(eulerLeadConfig)
    dangling.contradictions.route.evidenceIds = ['MISSING']
    expect(() => compileScenario(eulerEvidenceGraph, dangling)).toThrow('Contradiction references missing')
  })
})
