import type { CameraMode, MissionStage } from '../scenario/contracts'

export type Beat = MissionStage
export type BranchId = string
export type EvidenceId = string
export type Lens = 'NONE' | 'ROUTE_SCAN' | 'STATE_ECHO' | 'TRANSFER_MAP' | 'RECORD_SWEEP'
export type TravelStatus = 'IDLE' | 'TRAVELING' | 'ARRIVED'
export type TravelControl = 'GUIDED_CLICK' | 'HELD_KEY'

export interface LogicalNavigationState {
  currentNodeId: string
  activePathId: string | null
  travelProgress: number
  travelStatus: TravelStatus
  travelControl: TravelControl | null
  facingHint: 'FORWARD' | 'LEFT' | 'RIGHT' | 'RETURN'
}

export interface ChronoSnapshot {
  beat: Beat
  scenarioTime: number
  navigation: LogicalNavigationState
  activeInteractable: string | null
}

export interface RewindableSnapshot extends ChronoSnapshot {
  activeLens: Lens
}

export interface TimeAnchor {
  id: 'case-index-anchor'
  label: string
  snapshot: RewindableSnapshot
}

export interface GameState extends ChronoSnapshot {
  entered: boolean
  activeLens: Lens
  cameraMode: CameraMode
  discoveredEvidence: EvidenceId[]
  archivedEvidence: EvidenceId[]
  branchOrder: BranchId[]
  exploredBranches: BranchId[]
  currentBranchId: BranchId | null
  branchRecordRevealed: boolean
  contradictionCollected: boolean
  timeAnchors: TimeAnchor[]
  indexSnapshot: RewindableSnapshot | null
  hypothesisId: string | null
  hypothesisOutcome: 'CONFIRMED' | 'FALSIFIED' | null
  caseAssembly: Record<'AMOUNT' | 'RECEIVER' | 'LINK', string | null>
  caseAssemblyMessage: string | null
  truthStep: number
  complete: boolean
  completedOnce: boolean
  captions: boolean
  muted: boolean
  reducedMotion: boolean
  quality: 'high' | 'low'
  eventLog: GameAction[]
}

export type GameAction =
  | { type: 'ENTER_VAULT' }
  | { type: 'OPENING_COMPLETE' }
  | { type: 'START_TRAVEL'; pathId: string; control?: TravelControl }
  | { type: 'ADVANCE_TRAVEL'; delta: number }
  | { type: 'ROUTE_SCAN' }
  | { type: 'OPEN_CASE_INDEX' }
  | { type: 'CHOOSE_BRANCH'; branch: BranchId }
  | { type: 'ANALYZE_BRANCH' }
  | { type: 'UNWIND_TRAIL' }
  | { type: 'COMPLETE_BRANCH' }
  | { type: 'REWIND' }
  | { type: 'BRING_RECORDS_TOGETHER' }
  | { type: 'SELECT_HYPOTHESIS'; hypothesisId: string }
  | { type: 'SWEEP_FORWARD' }
  | { type: 'CONTINUE_AFTER_HYPOTHESIS' }
  | { type: 'BUILD_CASE' }
  | { type: 'SELECT_CASE_RECORD'; slot: 'AMOUNT' | 'RECEIVER' | 'LINK'; evidenceId: string }
  | { type: 'VERIFY_CASE' }
  | { type: 'ADVANCE_TRUTH_ENGINE' }
  | { type: 'COMPLETE_TRUTH_ENGINE' }
  | { type: 'SKIP_REPLAY_TRUTH' }
  | { type: 'TOGGLE_CAPTIONS' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_REDUCED_MOTION' }
  | { type: 'TOGGLE_QUALITY' }
  | { type: 'RESET' }
