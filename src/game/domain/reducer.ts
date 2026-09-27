import type { ScenarioManifest, WorldManifest, WorldPassage } from '../scenario/contracts'
import type { ChronoSnapshot, GameAction, GameState, LogicalNavigationState, RewindableSnapshot } from './types'

const emptyCaseAssembly = () => ({ AMOUNT: null, RECEIVER: null, LINK: null })

function idleNavigation(currentNodeId: string, facingHint: LogicalNavigationState['facingHint'] = 'FORWARD'): LogicalNavigationState {
  return { currentNodeId, activePathId: null, travelProgress: 0, travelStatus: 'IDLE', travelControl: null, facingHint }
}

export function createInitialGameState(world: WorldManifest): GameState {
  const entry = world.nodes.find(({ role }) => role === 'entry-origin')
  if (!entry) throw new Error('Compiled world is missing the entry-origin node')
  return {
    entered: false,
    beat: 'ENTRY',
    scenarioTime: 0,
    navigation: idleNavigation(entry.id),
    activeInteractable: 'enter-vault',
    activeLens: 'NONE',
    cameraMode: 'NAVIGATION',
    discoveredEvidence: [],
    archivedEvidence: [],
    branchOrder: [],
    exploredBranches: [],
    currentBranchId: null,
    branchRecordRevealed: false,
    contradictionCollected: false,
    timeAnchors: [],
    indexSnapshot: null,
    hypothesisId: null,
    hypothesisOutcome: null,
    caseAssembly: emptyCaseAssembly(),
    caseAssemblyMessage: null,
    truthStep: 0,
    complete: false,
    completedOnce: false,
    captions: true,
    muted: false,
    reducedMotion: false,
    quality: 'high',
    eventLog: [],
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function withEvent(state: GameState, action: GameAction, patch: Partial<GameState>): GameState {
  return { ...state, ...patch, eventLog: [...state.eventLog, action] }
}

function startTravel(state: GameState, action: GameAction, passage: WorldPassage): GameState {
  if (state.navigation.travelStatus === 'TRAVELING' || state.navigation.currentNodeId !== passage.from) return state
  return withEvent(state, action, {
    navigation: {
      currentNodeId: state.navigation.currentNodeId,
      activePathId: passage.id,
      travelProgress: 0,
      travelStatus: 'TRAVELING',
      travelControl: action.type === 'START_TRAVEL' ? action.control ?? 'GUIDED_CLICK' : 'GUIDED_CLICK',
      facingHint: passage.facingHint,
    },
    activeInteractable: null,
    cameraMode: passage.role === 'hypothesis-test' ? 'SIGNATURE_TRANSITION' : 'NAVIGATION',
  })
}

function indexPatch(state: GameState, scenario: ScenarioManifest, caseIndexNodeId: string): Partial<GameState> {
  const navigation = idleNavigation(caseIndexNodeId)
  const snapshot: RewindableSnapshot = {
    beat: 'CASE_INDEX',
    scenarioTime: state.scenarioTime,
    navigation,
    activeInteractable: state.exploredBranches.length === scenario.branches.length ? 'bring-records' : 'candidate-branches',
    activeLens: state.activeLens,
  }
  return {
    ...snapshot,
    currentBranchId: null,
    branchRecordRevealed: false,
    cameraMode: 'NAVIGATION',
    indexSnapshot: snapshot,
    timeAnchors: state.timeAnchors.length > 0 ? state.timeAnchors : [{ id: 'case-index-anchor', label: scenario.flow.anchorLabel, snapshot }],
  }
}

function arrive(state: GameState, action: GameAction, scenario: ScenarioManifest, passage: WorldPassage, roleByNodeId: Map<string, WorldManifest['nodes'][number]['role']>): GameState {
  const baseNavigation = idleNavigation(passage.to, passage.facingHint)
  const arrivalRole = roleByNodeId.get(passage.to)
  if (arrivalRole === 'case-index') return withEvent(state, action, { ...indexPatch(state, scenario, passage.to), navigation: baseNavigation })
  if (passage.role === 'branch') {
    return withEvent(state, action, { beat: 'BRANCH', navigation: baseNavigation, activeInteractable: 'analyze-branch', branchRecordRevealed: false, cameraMode: 'INSPECTION' })
  }
  if (passage.role === 'hypothesis-test') {
    const option = scenario.experiencePlan.hypothesis.options.find(({ id }) => id === state.hypothesisId)
    if (!option) return state
    const falsified = option.outcome === 'FALSIFIED'
    const evidenceId = scenario.experiencePlan.hypothesis.evidenceId
    return withEvent(state, action, {
      beat: 'HYPOTHESIS_TEST',
      navigation: baseNavigation,
      activeInteractable: 'continue-after-hypothesis',
      activeLens: 'RECORD_SWEEP',
      cameraMode: falsified ? 'SIGNATURE_TRANSITION' : 'INSPECTION',
      hypothesisOutcome: option.outcome,
      contradictionCollected: falsified,
      discoveredEvidence: unique([...state.discoveredEvidence, evidenceId]),
      archivedEvidence: unique([...state.archivedEvidence, evidenceId]),
    })
  }
  if (arrivalRole === 'protocol-subgraph') {
    return withEvent(state, action, { beat: 'DEEP_TRACE', navigation: baseNavigation, activeInteractable: 'complete-branch', cameraMode: 'INSPECTION' })
  }
  if (arrivalRole === 'receiving-point') {
    return withEvent(state, action, { beat: 'RECEIVING_POINT', navigation: baseNavigation, activeInteractable: 'build-case', cameraMode: 'INSPECTION' })
  }
  return withEvent(state, action, { beat: passage.arrivalStage, navigation: baseNavigation, activeInteractable: arrivalRole === 'record-gate' ? 'route-scan' : null })
}

export function createGameReducer(scenario: ScenarioManifest, world: WorldManifest) {
  const initial = createInitialGameState(world)
  const passages = new Map(world.passages.map((passage) => [passage.id, passage]))
  const branches = new Map(scenario.branches.map((branch) => [branch.id, branch]))
  const roleByNodeId = new Map(world.nodes.map((node) => [node.id, node.role]))
  const navigationPlan = scenario.experiencePlan.navigation
  const start = (state: GameState, action: GameAction, pathId: string) => {
    const passage = passages.get(pathId)
    return passage ? startTravel(state, action, passage) : state
  }
  return function reducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
      case 'RESET':
        return { ...initial, completedOnce: state.completedOnce || state.complete, captions: state.captions, muted: state.muted, reducedMotion: state.reducedMotion, quality: state.quality }
      case 'TOGGLE_CAPTIONS': return withEvent(state, action, { captions: !state.captions })
      case 'TOGGLE_MUTE': return withEvent(state, action, { muted: !state.muted })
      case 'TOGGLE_REDUCED_MOTION': return withEvent(state, action, { reducedMotion: !state.reducedMotion })
      case 'TOGGLE_QUALITY': return withEvent(state, action, { quality: state.quality === 'high' ? 'low' : 'high' })
      case 'ENTER_VAULT':
        if (state.beat !== 'ENTRY') return state
        return withEvent(state, action, { entered: true, beat: 'OPENING', activeInteractable: null })
      case 'OPENING_COMPLETE':
        if (state.beat !== 'OPENING') return state
        return withEvent(state, action, { beat: 'APPROACH', activeInteractable: 'follow-first-trail', scenarioTime: 1 })
      case 'START_TRAVEL':
        return start(state, action, action.pathId)
      case 'ADVANCE_TRAVEL': {
        if (state.navigation.travelStatus !== 'TRAVELING' || !state.navigation.activePathId || !Number.isFinite(action.delta) || action.delta <= 0) return state
        const passage = passages.get(state.navigation.activePathId)
        if (!passage) return state
        const travelProgress = Math.min(1, state.navigation.travelProgress + action.delta)
        if (travelProgress < 1) return { ...state, navigation: { ...state.navigation, travelProgress } }
        return arrive(state, action, scenario, passage, roleByNodeId)
      }
      case 'ROUTE_SCAN':
        if (state.beat !== 'APPROACH' || roleByNodeId.get(state.navigation.currentNodeId) !== 'record-gate') return state
        return withEvent(state, action, { activeLens: 'ROUTE_SCAN', activeInteractable: 'open-case-index', scenarioTime: 2 })
      case 'OPEN_CASE_INDEX':
        if (state.beat !== 'APPROACH' || state.activeLens !== 'ROUTE_SCAN') return state
        return start(state, action, scenario.experiencePlan.approachPathId)
      case 'CHOOSE_BRANCH': {
        if (state.beat !== 'CASE_INDEX' || state.exploredBranches.includes(action.branch) || state.branchOrder.includes(action.branch)) return state
        const branch = branches.get(action.branch)
        if (!branch) return state
        const started = start(state, action, branch.outboundPathId)
        return started === state ? state : { ...started, currentBranchId: branch.id, branchOrder: [...state.branchOrder, branch.id] }
      }
      case 'ANALYZE_BRANCH': {
        if (state.beat !== 'BRANCH' || !state.currentBranchId || state.branchRecordRevealed) return state
        const branch = branches.get(state.currentBranchId)
        if (!branch) return state
        return withEvent(state, action, {
          branchRecordRevealed: true,
          activeInteractable: 'complete-branch',
          activeLens: branch === scenario.branches[0] ? 'STATE_ECHO' : 'TRANSFER_MAP',
          discoveredEvidence: unique([...state.discoveredEvidence, ...branch.discoveryEvidenceIds]),
          archivedEvidence: unique([...state.archivedEvidence, ...branch.discoveryEvidenceIds]),
        })
      }
      case 'COMPLETE_BRANCH': {
        if (!['BRANCH', 'DEEP_TRACE'].includes(state.beat) || !state.currentBranchId || !state.branchRecordRevealed) return state
        const branch = branches.get(state.currentBranchId)
        if (!branch) return state
        return withEvent(state, action, { beat: 'RETURN', activeInteractable: 'rewind', exploredBranches: unique([...state.exploredBranches, branch.id]), cameraMode: 'NAVIGATION' })
      }
      case 'UNWIND_TRAIL':
        if (state.beat !== 'BRANCH' || state.currentBranchId !== navigationPlan.deepTraceBranchId || !state.branchRecordRevealed || navigationPlan.deepTracePathId === null) return state
        return start(state, action, navigationPlan.deepTracePathId)
      case 'REWIND': {
        if (state.beat !== 'RETURN' || !state.currentBranchId || !state.indexSnapshot) return state
        const branch = branches.get(state.currentBranchId)
        return branch ? start(state, action, branch.returnPathId) : state
      }
      case 'BRING_RECORDS_TOGETHER':
        if (state.beat !== 'CASE_INDEX' || state.exploredBranches.length !== scenario.branches.length) return state
        return withEvent(state, action, { beat: 'HYPOTHESIS', activeInteractable: 'sweep-forward', cameraMode: 'THEORY' })
      case 'SELECT_HYPOTHESIS':
        if (state.beat !== 'HYPOTHESIS' || !scenario.experiencePlan.hypothesis.options.some(({ id }) => id === action.hypothesisId)) return state
        return withEvent(state, action, { hypothesisId: action.hypothesisId, hypothesisOutcome: null })
      case 'SWEEP_FORWARD':
        if (state.beat !== 'HYPOTHESIS' || !state.hypothesisId) return state
        return start(state, action, navigationPlan.hypothesisTestPathId)
      case 'CONTINUE_AFTER_HYPOTHESIS':
        if (state.beat !== 'HYPOTHESIS_TEST' || !state.hypothesisOutcome) return state
        return start(state, action, navigationPlan.receivingPathId)
      case 'BUILD_CASE':
        if (state.beat !== 'RECEIVING_POINT') return state
        return withEvent(state, action, {
          beat: 'CASE_ASSEMBLY', activeInteractable: 'case-assembly', cameraMode: 'THEORY',
          discoveredEvidence: unique([...state.discoveredEvidence, scenario.flow.destinationEvidenceId]),
          archivedEvidence: unique([...state.archivedEvidence, scenario.flow.destinationEvidenceId]),
        })
      case 'SELECT_CASE_RECORD': {
        if (state.beat !== 'CASE_ASSEMBLY' || !state.discoveredEvidence.includes(action.evidenceId)) return state
        const contract = scenario.experiencePlan.caseAssembly
        if (contract.contextualEvidenceIds.includes(action.evidenceId)) return withEvent(state, action, { caseAssemblyMessage: contract.insufficientCopy })
        if (!contract.selectableEvidenceIds.includes(action.evidenceId)) return state
        return withEvent(state, action, { caseAssembly: { ...state.caseAssembly, [action.slot]: action.evidenceId }, caseAssemblyMessage: null })
      }
      case 'VERIFY_CASE': {
        if (state.beat !== 'CASE_ASSEMBLY') return state
        const valid = scenario.experiencePlan.caseAssembly.slots.every(({ id, requiredEvidenceId }) => state.caseAssembly[id] === requiredEvidenceId)
        if (!valid) return withEvent(state, action, { caseAssemblyMessage: scenario.experiencePlan.caseAssembly.insufficientCopy })
        return withEvent(state, action, { beat: 'TRUTH_ENGINE', activeInteractable: 'truth-continue', cameraMode: 'TRUTH_ENGINE', truthStep: 0 })
      }
      case 'ADVANCE_TRUTH_ENGINE':
        if (state.beat !== 'TRUTH_ENGINE' || state.truthStep >= scenario.truthTimeline.length) return state
        return withEvent(state, action, { truthStep: state.truthStep + 1 })
      case 'COMPLETE_TRUTH_ENGINE':
        if (state.beat !== 'TRUTH_ENGINE' || state.truthStep !== scenario.truthTimeline.length) return state
        return withEvent(state, action, { beat: 'COMPLETE', activeInteractable: 'replay-mission', complete: true, completedOnce: true })
      case 'SKIP_REPLAY_TRUTH':
        if (state.beat !== 'TRUTH_ENGINE' || !state.completedOnce) return state
        return withEvent(state, action, { truthStep: scenario.truthTimeline.length })
    }
  }
}

export function replayGame(actions: GameAction[], start: GameState, reducer: ReturnType<typeof createGameReducer>): GameState {
  return actions.reduce(reducer, start)
}

export function getChronoSnapshot(state: GameState): ChronoSnapshot {
  return { beat: state.beat, scenarioTime: state.scenarioTime, navigation: structuredClone(state.navigation), activeInteractable: state.activeInteractable }
}

export function getRewindableSnapshot(state: GameState): RewindableSnapshot {
  return { ...getChronoSnapshot(state), activeLens: state.activeLens }
}
