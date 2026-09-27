import { ACCEPTED_EULER_SKELETON } from './acceptedEulerSkeleton'

export type JourneyStyle = 'DIRECT' | 'CURIOUS' | 'MISTAKEN'
export type MissionSkeletonStage = 'ONBOARDING' | 'FIRST_RECORD' | 'FORK' | 'HYPOTHESIS' | 'TEST' | 'CASE_ASSEMBLY' | 'COMPLETE'
export type AcceptedEvidenceId = 'EXACT_EARLY_NET' | 'STATE_EARLY_ENGINE' | 'CONTEXT_FIRST_ENGINE_ACTIVITY' | 'EXACT_MAIN_RECEIVER' | 'CONTEXT_SECONDARY' | 'EXACT_CONVERGENCE'
export type AssemblySlot = 'AMOUNT' | 'RECEIVER' | 'LINK'

export interface EulerMissionState {
  stage: MissionSkeletonStage
  journey: JourneyStyle
  inspectedBranches: string[]
  evidenceIds: AcceptedEvidenceId[]
  hypothesisId: string | null
  hypothesisResult: 'UNTESTED' | 'CONFIRMED' | 'FALSIFIED'
  recoveryCount: number
  assembly: Partial<Record<AssemblySlot, AcceptedEvidenceId>>
  objective: string
}

export type EulerMissionAction =
  | { type: 'BEGIN'; journey: JourneyStyle }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'ACQUIRE_FIRST_RECORD' }
  | { type: 'INSPECT_BRANCH'; branchId: 'first-breach' | 'second-breach' }
  | { type: 'SELECT_HYPOTHESIS'; hypothesisId: string }
  | { type: 'TEST_HYPOTHESIS' }
  | { type: 'ASSEMBLE'; slot: AssemblySlot; evidenceId: AcceptedEvidenceId }
  | { type: 'RESET' }

const REQUIRED_ASSEMBLY: Record<AssemblySlot, AcceptedEvidenceId> = {
  AMOUNT: 'EXACT_EARLY_NET', RECEIVER: 'EXACT_MAIN_RECEIVER', LINK: 'EXACT_CONVERGENCE',
}

const BRANCH_EVIDENCE: Record<'first-breach' | 'second-breach', AcceptedEvidenceId[]> = {
  'first-breach': ['EXACT_EARLY_NET', 'STATE_EARLY_ENGINE', 'CONTEXT_FIRST_ENGINE_ACTIVITY'],
  'second-breach': ['EXACT_MAIN_RECEIVER', 'CONTEXT_SECONDARY'],
}

export const EULER_MISSION_TRUTH = {
  scenarioId: ACCEPTED_EULER_SKELETON.scenarioId,
  title: ACCEPTED_EULER_SKELETON.title,
  question: ACCEPTED_EULER_SKELETON.question,
  historicalCutoffUtc: ACCEPTED_EULER_SKELETON.historicalCutoffUtc,
  provenance: ACCEPTED_EULER_SKELETON.provenance,
  networkPolicy: 'FROZEN_RECORD_ONLY' as const,
  conclusionBoundary: ACCEPTED_EULER_SKELETON.conclusionBoundary,
}

export function createEulerMissionState(journey: JourneyStyle = 'DIRECT'): EulerMissionState {
  return { stage: 'ONBOARDING', journey, inspectedBranches: [], evidenceIds: [], hypothesisId: null, hypothesisResult: 'UNTESTED', recoveryCount: 0, assembly: {}, objective: 'LEARN HOW TO READ THE RECORD.' }
}

function addEvidence(state: EulerMissionState, ids: AcceptedEvidenceId[]) {
  return [...new Set([...state.evidenceIds, ...ids])]
}

export function evidenceClass(id: AcceptedEvidenceId): 'EXACT' | 'CORROBORATING' | 'CONTEXTUAL' {
  return ACCEPTED_EULER_SKELETON.evidenceGrades[id]
}

export function eulerMissionReducer(state: EulerMissionState, action: EulerMissionAction): EulerMissionState {
  switch (action.type) {
    case 'BEGIN': return createEulerMissionState(action.journey)
    case 'COMPLETE_ONBOARDING': return state.stage === 'ONBOARDING' ? { ...state, stage: 'FIRST_RECORD', objective: 'FIND THE FIRST BREACH RECORD.' } : state
    case 'ACQUIRE_FIRST_RECORD': return state.stage === 'FIRST_RECORD' ? { ...state, stage: 'FORK', evidenceIds: addEvidence(state, ['EXACT_EARLY_NET']), objective: 'OPEN BOTH BREACH RECORDS.' } : state
    case 'INSPECT_BRANCH': {
      if (state.stage !== 'FORK') return state
      const inspectedBranches = [...new Set([...state.inspectedBranches, action.branchId])]
      const next = { ...state, inspectedBranches, evidenceIds: addEvidence(state, BRANCH_EVIDENCE[action.branchId]) }
      return inspectedBranches.length === 2 ? { ...next, stage: 'HYPOTHESIS', objective: ACCEPTED_EULER_SKELETON.hypothesisQuestion } : next
    }
    case 'SELECT_HYPOTHESIS': {
      if (state.stage !== 'HYPOTHESIS') return state
      const valid = ACCEPTED_EULER_SKELETON.hypothesisIds.some((id) => id === action.hypothesisId)
      return valid ? { ...state, hypothesisId: action.hypothesisId, hypothesisResult: 'UNTESTED', stage: 'TEST', objective: 'READ THE 11:38 RECORD.' } : state
    }
    case 'TEST_HYPOTHESIS': {
      if (state.stage !== 'TEST' || !state.hypothesisId) return state
      const confirmed = state.hypothesisId === 'FIRST_TRAIL_JOINS_SECOND_ROUTE'
      const tested = { ...state, evidenceIds: addEvidence(state, ['EXACT_CONVERGENCE']), hypothesisResult: confirmed ? 'CONFIRMED' as const : 'FALSIFIED' as const }
      return confirmed
        ? { ...tested, stage: 'CASE_ASSEMBLY', objective: 'BUILD THE CASE.' }
        : { ...tested, stage: 'HYPOTHESIS', recoveryCount: state.recoveryCount + 1, objective: 'THE FIRST ENGINE WAS NOT THE END. REVISE THE HYPOTHESIS.' }
    }
    case 'ASSEMBLE': {
      if (state.stage !== 'CASE_ASSEMBLY' || !state.evidenceIds.includes(action.evidenceId)) return state
      if (REQUIRED_ASSEMBLY[action.slot] !== action.evidenceId || evidenceClass(action.evidenceId) === 'CONTEXTUAL') return { ...state, objective: ACCEPTED_EULER_SKELETON.insufficientCopy }
      const assembly = { ...state.assembly, [action.slot]: action.evidenceId }
      const complete = (Object.keys(REQUIRED_ASSEMBLY) as AssemblySlot[]).every((slot) => assembly[slot] === REQUIRED_ASSEMBLY[slot])
      return complete ? { ...state, assembly, stage: 'COMPLETE', objective: ACCEPTED_EULER_SKELETON.completeObjective } : { ...state, assembly }
    }
    case 'RESET': return createEulerMissionState(state.journey)
  }
}

export function missionCanDeadlock(state: EulerMissionState) {
  if (state.stage === 'FORK') return false
  if (state.stage === 'HYPOTHESIS') return false
  if (state.stage === 'TEST') return state.hypothesisId === null
  if (state.stage === 'CASE_ASSEMBLY') return !(['EXACT_EARLY_NET', 'EXACT_MAIN_RECEIVER', 'EXACT_CONVERGENCE'] as AcceptedEvidenceId[]).every((id) => state.evidenceIds.includes(id))
  return false
}

export const EULER_ROUTE_MAP = {
  direct: ['ONBOARDING', 'FIRST_RECORD', 'FORK:first-breach', 'FORK:second-breach', 'HYPOTHESIS:confirmed', 'TEST', 'CASE_ASSEMBLY', 'COMPLETE'],
  curious: ['ONBOARDING', 'FIRST_RECORD', 'FORK:second-breach', 'FORK:first-breach', 'HYPOTHESIS:confirmed', 'TEST', 'CASE_ASSEMBLY', 'COMPLETE'],
  mistaken: ['ONBOARDING', 'FIRST_RECORD', 'FORK:first-breach', 'FORK:second-breach', 'HYPOTHESIS:falsified', 'RECOVERY', 'HYPOTHESIS:confirmed', 'TEST', 'CASE_ASSEMBLY', 'COMPLETE'],
}
