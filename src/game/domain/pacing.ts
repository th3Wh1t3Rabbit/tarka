import type { Beat } from './types'

export const normalBeatDwellMs: Record<Beat, number> = {
  ENTRY: 0,
  OPENING: 3_200,
  APPROACH: 420,
  CASE_INDEX: 420,
  BRANCH: 420,
  RETURN: 420,
  SYNTHESIS: 420,
  HYPOTHESIS: 420,
  HYPOTHESIS_TEST: 5_400,
  DEEP_TRACE: 420,
  RECEIVING_POINT: 420,
  CASE_ASSEMBLY: 0,
  TRUTH_ENGINE: 0,
  COMPLETE: 0,
}

export const reducedMotionDwellMs = 40
export const normalTruthStepDwellMs = 900
export const reducedMotionTruthStepDwellMs = 120

export function getBeatDwellMs(beat: Beat, reducedMotion: boolean) {
  return reducedMotion ? reducedMotionDwellMs : normalBeatDwellMs[beat]
}

export function getTruthStepDwellMs(reducedMotion: boolean) {
  return reducedMotion ? reducedMotionTruthStepDwellMs : normalTruthStepDwellMs
}
