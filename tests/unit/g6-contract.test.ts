import { describe, expect, it } from 'vitest'
import { createGameReducer, createInitialGameState, replayGame } from '../../src/game/domain/reducer'
import { documentedPresentationFallbacks, guidedProbe3dAdapter } from '../../src/game/render/presentationAdapter'
import { eulerBundle } from '../../src/game/scenario/euler'

describe('G6 frozen contract', () => {
  it('keeps the solved title and discovered amount out of pre-solution copy', () => {
    const { scenario } = eulerBundle
    expect(JSON.stringify([scenario.prelaunch, scenario.opening, scenario.caseFrame])).not.toContain('THE FALSE EXIT')
    expect(JSON.stringify(scenario.caseFrame)).not.toMatch(/8\.88M|8,877,507/)
    expect(scenario.completion.solvedTitle).toBe('THE FALSE EXIT')
  })

  it('uses the symmetric hypothesis labels and one shared test record', () => {
    expect(eulerBundle.scenario.experiencePlan.hypothesis.options.map(({ label }) => label)).toEqual([
      'IT STOPPED AT THE FIRST ENGINE',
      'IT JOINED THE SECOND ROUTE',
    ])
    expect(eulerBundle.scenario.experiencePlan.hypothesis.evidenceId).toBe('EXACT_CONVERGENCE')
  })

  it('freezes exactly three decisive records and rejects context as proof', () => {
    expect(eulerBundle.scenario.experiencePlan.caseAssembly.slots.map(({ label }) => label)).toEqual(['THE AMOUNT', 'THE RECEIVER', 'THE LINK'])
    expect(eulerBundle.scenario.proofEvidenceIds).toEqual(['EXACT_EARLY_NET', 'EXACT_MAIN_RECEIVER', 'EXACT_CONVERGENCE'])
    expect(eulerBundle.scenario.evidence.find(({ id }) => id === 'STATE_EARLY_ENGINE')).toMatchObject({ independentForProof: false, proofGrade: 'DERIVED_VIEW' })
  })

  it('preserves Nansen decimals without manufacturing equality', () => {
    const early = eulerBundle.scenario.evidence.find(({ id }) => id === 'EXACT_EARLY_NET')!
    const convergence = eulerBundle.scenario.evidence.find(({ id }) => id === 'EXACT_CONVERGENCE')!
    expect(early.facts.assetAmounts[0]?.amount).toBe('8877507.3483067')
    expect(convergence.facts.assetAmounts[0]?.amount).toBe('8877507.348306697')
    expect([early.numericPrecisionStatus, convergence.numericPrecisionStatus]).toEqual(['PROVIDER_REPORTED_DECIMAL', 'PROVIDER_REPORTED_DECIMAL'])
  })

  it('keeps navigation logical and resolves presentation through the adapter', () => {
    const state = createInitialGameState(eulerBundle.world)
    expect(JSON.stringify(state.navigation)).not.toMatch(/position|camera|\[\s*-?\d/)
    expect(guidedProbe3dAdapter.profile).toBe('GUIDED_PROBE_3D')
    expect(guidedProbe3dAdapter.resolvePosition(state.navigation, eulerBundle.world)).toEqual(eulerBundle.world.nodes.find(({ id }) => id === state.navigation.currentNodeId)?.presentation.position)
    expect(eulerBundle.world.implementedProfiles).toEqual(['GUIDED_PROBE_3D'])
    expect(documentedPresentationFallbacks).toEqual(['FIRST_PERSON_RAIL_3D', 'ORTHOGRAPHIC_2_5D', 'TOP_DOWN_VECTOR_2D'])
  })

  it('allows replay skipping only after one completed reconstruction', () => {
    const reducer = createGameReducer(eulerBundle.scenario, eulerBundle.world)
    const state = createInitialGameState(eulerBundle.world)
    expect(replayGame([{ type: 'SKIP_REPLAY_TRUTH' }], state, reducer)).toBe(state)
    expect(eulerBundle.scenario.experiencePlan.truthAdvanceMode).toBe('PLAYER_PACED')
  })

  it('keeps every guided path inside the P0 movement budget', () => {
    expect(eulerBundle.world.passages.every(({ durationMs }) => durationMs >= 2_600 && durationMs <= 4_200)).toBe(true)
  })
})
