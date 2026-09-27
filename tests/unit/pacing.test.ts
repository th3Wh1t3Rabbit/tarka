import { describe, expect, it } from 'vitest'
import { getBeatDwellMs, getTruthStepDwellMs, normalBeatDwellMs, normalTruthStepDwellMs, reducedMotionDwellMs, reducedMotionTruthStepDwellMs } from '../../src/game/domain/pacing'
import { eulerBundle } from '../../src/game/scenario/euler'

describe('G6 pacing contract', () => {
  it('allows opening camera/probe response within ten seconds and avoids inert locks', () => {
    expect(normalBeatDwellMs.OPENING).toBeLessThan(10_000)
    for (const [stage, duration] of Object.entries(normalBeatDwellMs)) {
      if (stage !== 'OPENING' && stage !== 'HYPOTHESIS_TEST') expect(duration, stage).toBeLessThanOrEqual(2_500)
    }
  })

  it('keeps every guided path within the movement budget', () => {
    for (const path of eulerBundle.world.passages) {
      expect(path.durationMs, path.id).toBeGreaterThanOrEqual(2_000)
      expect(path.durationMs, path.id).toBeLessThanOrEqual(8_000)
    }
    expect(eulerBundle.world.passages.reduce((sum, path) => sum + path.durationMs, 0)).toBeLessThanOrEqual(90_000)
  })

  it('provides deterministic normal and reduced timing while Truth records remain input-paced', () => {
    expect(getBeatDwellMs('DEEP_TRACE', false)).toBe(normalBeatDwellMs.DEEP_TRACE)
    expect(getBeatDwellMs('DEEP_TRACE', true)).toBe(reducedMotionDwellMs)
    expect(getTruthStepDwellMs(false)).toBe(normalTruthStepDwellMs)
    expect(getTruthStepDwellMs(true)).toBe(reducedMotionTruthStepDwellMs)
    expect(eulerBundle.scenario.experiencePlan.truthAdvanceMode).toBe('PLAYER_PACED')
  })
})
