import { describe, expect, it } from 'vitest'
import { applyAtomicPrecisionOutcomes } from '../../src/game/compiler/atomicPrecision'
import { eulerEvidenceGraph } from '../../src/game/scenario/euler'

describe('G6 optional Alchemy atomic verification seam', () => {
  it('keeps Nansen provider precision unchanged when the optional key is absent', () => {
    const result = applyAtomicPrecisionOutcomes(eulerEvidenceGraph, [{ evidenceId: 'EXACT_CONVERGENCE', status: 'KEY_ABSENT', providerDecimal: '8877507.348306697', tokenDecimals: 18, observedAtomicUnits: null }])
    expect(result).toEqual(eulerEvidenceGraph)
  })

  it('changes only precision grade and wording after an exact atomic match', () => {
    const result = applyAtomicPrecisionOutcomes(eulerEvidenceGraph, [{ evidenceId: 'EXACT_CONVERGENCE', status: 'EXACT_MATCH', providerDecimal: '8877507.348306697', tokenDecimals: 18, observedAtomicUnits: '8877507348306697000000000' }])
    const original = eulerEvidenceGraph.evidence.find(({ id }) => id === 'EXACT_CONVERGENCE')!
    const verified = result.evidence.find(({ id }) => id === 'EXACT_CONVERGENCE')!
    expect({ ...verified, numericPrecisionStatus: original.numericPrecisionStatus, uncertainty: original.uncertainty }).toEqual(original)
    expect(verified.numericPrecisionStatus).toBe('ATOMIC_LOG_VERIFIED')
    expect(result.entities).toEqual(eulerEvidenceGraph.entities)
    expect(result.events).toEqual(eulerEvidenceGraph.events)
    expect(result.relationships).toEqual(eulerEvidenceGraph.relationships)
    expect(result.proofDependencies).toEqual(eulerEvidenceGraph.proofDependencies)
  })

  it('fails closed with blocking evidence on an atomic mismatch', () => {
    expect(() => applyAtomicPrecisionOutcomes(eulerEvidenceGraph, [{ evidenceId: 'EXACT_CONVERGENCE', status: 'ATOMIC_MISMATCH', providerDecimal: '8877507.348306697', tokenDecimals: 18, observedAtomicUnits: '8877507348306697000000001' }])).toThrow('BLOCKED_WITH_EVIDENCE')
  })
})
