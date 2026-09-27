import { describe, expect, it } from 'vitest'
import type { TheorySelection, TheorySlot } from '../../src/game/scenario/schema'
import { syntheticScenario } from '../../src/game/scenario/synthetic'
import { evaluateTheory } from '../../src/game/solver/evaluate'

const alternateBySlot: Record<TheorySlot, string> = {
  route: 'high-noise',
  transformation: 'signal-terminated',
  destination: 'high-chamber',
  proof: 'activity-plus-intensity',
}

const expectedBySlot = {
  route: { code: 'NO_MARKED_STATE', evidenceIds: ['activity-contradiction'] },
  transformation: { code: 'CONVERSION_MISMATCH', evidenceIds: ['conversion-event'] },
  destination: { code: 'DESTINATION_MISMATCH', evidenceIds: ['archive-successor-delta'] },
  proof: { code: 'PROOF_INSUFFICIENT', evidenceIds: ['conversion-event', 'archive-successor-delta'] },
} as const

describe('deterministic theory solver', () => {
  it('accepts the canonical theory with the decisive proof closure', () => {
    expect(evaluateTheory(syntheticScenario, syntheticScenario.canonicalTheory)).toEqual({
      accepted: true,
      firstContradiction: null,
      proofEvidenceIds: ['quiet-transformation-gap', 'conversion-event', 'archive-successor-delta'],
    })
  })

  it.each(['route', 'transformation', 'destination', 'proof'] as TheorySlot[])(
    'rejects a single wrong %s field with its specific first contradiction',
    (slot) => {
      const theory: TheorySelection = { ...syntheticScenario.canonicalTheory, [slot]: alternateBySlot[slot] }
      const result = evaluateTheory(syntheticScenario, theory)
      expect(result.accepted).toBe(false)
      expect(result.firstContradiction).toMatchObject({ slot, ...expectedBySlot[slot] })
      expect(result.proofEvidenceIds).toEqual([])
    },
  )

  it('stops at the first contradiction in route-to-proof order', () => {
    const allWrong: TheorySelection = { ...alternateBySlot }
    expect(evaluateTheory(syntheticScenario, allWrong).firstContradiction?.slot).toBe('route')
  })

  it('returns isolated contradiction evidence arrays across evaluations', () => {
    const wrong: TheorySelection = { ...syntheticScenario.canonicalTheory, route: 'high-noise' }
    const first = evaluateTheory(syntheticScenario, wrong)
    first.firstContradiction?.evidenceIds.push('mutated')
    expect(evaluateTheory(syntheticScenario, wrong).firstContradiction?.evidenceIds).toEqual(['activity-contradiction'])
  })

  it('refuses to solve a scenario whose accounting invariants are invalid', () => {
    const invalid = structuredClone(syntheticScenario)
    const conversion = invalid.events.find(({ id }) => id === 'evt-prism-conversion')
    if (!conversion) throw new Error('conversion fixture missing')
    conversion.outputs[0] = { asset: 'CYAN', amount: 10 }
    expect(() => evaluateTheory(invalid, invalid.canonicalTheory)).toThrow('invalid synthetic scenario')
  })
})
