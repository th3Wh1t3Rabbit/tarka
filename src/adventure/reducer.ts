import { blockedInteractions, CASEFILE_SEQUENCE_SPEECH, deadEndSpeech, dialogueTopicsForState, DRAWER_SEQUENCE_SPEECH, FORM_SEQUENCE_SPEECH, hotspots, inventorySpeechForState, itemRules, PHASE_ORDER, usefulRules } from './content'
import { RECORDS_OFFICE_STEPS } from '../controller/mission/choreography'
import { livePerformanceAt, SCRIPTED_SEQUENCES, sequenceForRule } from '../controller/mission/performance'
import { ARTHUR_IDLE_FACING, INTENT_REPLACED_KEY, INTENT_REPLACED_TEXT, controlForOutcome, facingPair, openingWorldIsInert, requiresProximity, sameIntent } from './controlPolicy'
import { targetApproach } from './interactionGeometry'
import { accessibilityPreferences, type AccessibilityPreferences } from './persistencePolicy'
import { EMPTY_RUNTIME_SESSION, walkPointForTarget } from './runtimeSession'
import { WALK_Y_MAX, WALK_Y_MIN } from './scenes'
import { R55_BRCG_PAYOFF, R55_ENDING_BRCG, R55_ENDING_DEFAULT, R55_ENDING_UNIVERSAL, r55Speech, r55SpeechByEvent } from '../story/r55/production'
import { PRINCIPAL_OPENING } from '../story/s15r2/principalFeedback'
import { normalizeProductionDialogue } from './dialogueDelivery'
import { initialVisibleCharacters } from './speechDisplayPolicy'
import { physicalChoreographyFor, PRODUCTION_PHYSICAL_CHOREOGRAPHY, resolvePhysicalPose, routePoseDirective, scriptedPoseDirective, type PhysicalChoreographyContract } from './physicalChoreography'
import { globeSnapshotAt, globeTimeline, globeTimelineCursor, globeTimelineTotalMs } from './globeVisual'
import type { ActiveSequenceState, AdventureAction, AdventureState, ControlClass, HotspotId, InteractionRule, InventoryItemId, ItemRule, PendingInteraction, Point, PuzzlePhase, RuntimeSessionConfig, SequenceEvent, SpeechLine, SpeechState } from './types'

const ROOK_ENTRY = { x: -48, y: WALK_Y_MAX }
const ROOK_START = { x: 228, y: WALK_Y_MAX }
const OPENING_INSTRUCTION_KEYS = ['OPEN-077', 'OPEN-078', 'OPEN-079', 'OPEN-079::2', 'OPEN-079::3', 'OPEN-080'] as const
const OPENING_INSTRUCTION_START = PRINCIPAL_OPENING.findIndex((line) => line.copyKey === OPENING_INSTRUCTION_KEYS[0])
const OPENING_INSTRUCTION_TAIL = OPENING_INSTRUCTION_KEYS.map((copyKey) => PRINCIPAL_OPENING.find((line) => line.copyKey === copyKey))
if (OPENING_INSTRUCTION_START < 0 || OPENING_INSTRUCTION_TAIL.some((line) => !line)) throw new Error('OPENING_INSTRUCTION_LANDING_MISSING')
const EXACT_OPENING_INSTRUCTION_TAIL = OPENING_INSTRUCTION_TAIL as SpeechLine[]
const BARK_1_AFTER_S = 75
const BARK_2_AFTER_S = 165
const DRAWER_CLOSE_LOOK_TARGETS = new Set<HotspotId>([
  'official-case-file-cabinet',
  'disorderly-stack-of-confidential-files',
  'miscellaneous-drawer-cabinet',
  'miscellaneous-catch-all-contents',
])
const OPENING_WORLD_ACTIONS = new Set<AdventureAction['type']>([
  'REQUEST_HINT', 'SELECT_VERB', 'SELECT_ITEM', 'ACT_ON_ITEM', 'HOVER_HOTSPOT', 'WALK_TO', 'INTERACT',
  'CANCEL_SELECTION', 'CHOOSE_DIALOGUE_TOPIC', 'CLOSE_DIALOGUE', 'PLAY_FORM_BARK', 'IDLE_TICK',
  'REQUEST_TERMINAL_ENTRY', 'ENTER_TERMINAL', 'TOGGLE_EVIDENCE_DRAWER', 'PLAY_RETURN_TAG', 'PLAY_BRCG_PAYOFF',
])

export function createInitialAdventureState(options: { skipIntro?: boolean; session?: RuntimeSessionConfig; accessibility?: Partial<AccessibilityPreferences>; dialogue?: { mode: AdventureState['dialogueMode']; pace: AdventureState['dialoguePace']; display?: AdventureState['dialogueDisplay'] } } = {}): AdventureState {
  const introComplete = options.skipIntro === true
  const instantText = options.accessibility?.instantText ?? false
  const reducedAnimation = options.accessibility?.reducedAnimation ?? false
  const highContrastHotspots = options.accessibility?.highContrastHotspots ?? false
  const dialoguePresentation = options.accessibility?.dialoguePresentation ?? 'FULLSCREEN_CRT'
  return {
    sceneId: 'records-office',
    introComplete,
    openingStage: introComplete ? 'COMPLETE' : 'ARTHUR_PAPER',
    introSkipConfirmationOpen: false,
    introSkipUsed: false,
    dialogueMode: options.dialogue?.mode ?? 'AUTO',
    dialoguePace: options.dialogue?.pace ?? 'NORMAL',
    dialogueDisplay: options.dialogue?.display ?? 'FULL',
    phase: 'START',
    authorizationState: 'PENDING',
    selectedVerb: null,
    selectedItemId: null,
    hoveredHotspotId: null,
    inventory: [],
    rookPosition: introComplete ? ROOK_START : ROOK_ENTRY,
    rookFacing: 'RIGHT',
    mrIndexFacing: ARTHUR_IDLE_FACING,
    intentReplacement: null,
    intentReplacementSeq: 0,
    terminalEntryPending: false,
    worldQuiescent: false,
    globePose: 'IDLE',
    globeMotion: 'IDLE',
    globeLevel: 0,
    globeMilestones: 0,
    globeRevision: 0,
    globeElapsedMs: 0,
    globeBoostRemainingMs: 0,
    globeStartPhase: 0,
    globeDecayStage: 'REST',
    lampPower: 'ON',
    lampSpeech: 0,
    rookPose: 'IDLE',
    mrIndexPose: introComplete ? 'IDLE' : 'DOCUMENT',
    arthurPointHold: false,
    walk: null,
    activeSequence: null,
    focusReturnTarget: null,
    speech: null,
    nonblockingSpeech: null,
    transcript: [],
    dialogueOpen: false,
    exhaustedTopics: [],
    dialogueAnnouncement: '',
    interactionRepeats: {},
    lastInteractionId: null,
    lastSequenceId: null,
    lastSemanticContact: null,
    sequenceEvents: [],
    lastSoundIntent: null,
    returnExchangePlayed: false,
    returnTagPlayed: false,
    brcgPayoffPlayed: false,
    evidenceDrawerOpen: false,
    recordArchived: false,
    archivedEvidenceIds: [],
    reducedAnimation,
    instantText,
    highContrastHotspots,
    reviewHotspots: false,
    barksFired: 0,
    inactiveSeconds: 0,
    caseFileDrawer: 'CLOSED',
    miscDrawer: 'CLOSED',
    caseStack: 'UNSEARCHED',
    miscContents: 'UNCOLLECTED',
    piggyNoteReadState: 'UNREAD',
    investigationMilestone: 'BEFORE_Q1',
    brcgInvestigationState: 'UNREAD',
    dialoguePresentation,
    runtimeSession: options.session ?? EMPTY_RUNTIME_SESSION,
    lifecycleEpoch: 0,
  }
}

function transcriptEntries(lines: readonly SpeechLine[], channel: 'BLOCKING' | 'NONBLOCKING', start: number) {
  return lines.map((entry, index) => ({ ...entry, channel, sequence: start + index }))
}
function withCurrentTranscript(state: AdventureState, line: SpeechLine | undefined, channel: 'BLOCKING' | 'NONBLOCKING') {
  return line ? [...state.transcript, ...transcriptEntries([line], channel, state.transcript.length)] : state.transcript
}
function speech(lines: SpeechLine[], returnTo: SpeechState['returnTo'], instant = false, reducedMotion = false, control: ControlClass = 'BLOCKING_WORLD_DIALOGUE', display: AdventureState['dialogueDisplay'] = 'FULL'): SpeechState | null {
  const deliveries = normalizeProductionDialogue(lines).filter((line, index, all) => index === 0 || line.speaker !== all[index - 1]!.speaker || line.text !== all[index - 1]!.text)
  if (deliveries.length === 0) return null
  const visibleCharacters = initialVisibleCharacters(deliveries[0]!, display, instant)
  return { lines: deliveries, lineIndex: 0, visibleCharacters, returnTo, control, performance: performanceForLine(deliveries[0]!, visibleCharacters, reducedMotion) }
}

function performanceForLine(line: SpeechLine, visibleCharacters: number, reducedMotion: boolean) {
  return livePerformanceAt(line.copyKey, line.text, visibleCharacters, reducedMotion, line.speaker === 'MR_INDEX' ? 'ARTHUR' : line.speaker, line.performanceCues)
}
function emitReplacement(state: AdventureState): AdventureState {
  const id = state.intentReplacementSeq + 1
  const line = { speaker: 'SYSTEM' as const, copyKey: INTENT_REPLACED_KEY, text: INTENT_REPLACED_TEXT }
  return { ...state, intentReplacementSeq: id, intentReplacement: { id, copyKey: INTENT_REPLACED_KEY, text: INTENT_REPLACED_TEXT }, transcript: withCurrentTranscript(state, line, 'NONBLOCKING') }
}
function noteReplacement(state: AdventureState, previous: PendingInteraction | null): AdventureState {
  if (!previous) return state
  return emitReplacement(state)
}
function arthurStandX(state: AdventureState): number {
  return state.runtimeSession.arthurCenterX ?? hotspots.find((hotspot) => hotspot.id === 'mr-index')!.walkTo.x
}
function arthurConversationMark(state: AdventureState): Point {
  const target = state.runtimeSession.targets['mr-index']
  if (target?.visible) {
    const gap = target.approachRight ?? targetApproach('mr-index').right
    return clampWalk({ x: target.left + target.width + gap, y: state.rookPosition.y })
  }
  // Preserve two readable 48px silhouettes after Rook takes the pen, even in
  // reducer-only sessions that have not built the runtime layout map.
  return clampWalk({ x: arthurStandX(state) + 88, y: state.rookPosition.y })
}
function arthurDialogueStand(state: AdventureState): Point | null {
  const target = state.runtimeSession.targets['mr-index']
  const centerX = target?.visible ? target.centerX : arthurStandX(state)
  // A conversation may start remotely, but it may never leave both 48px
  // silhouettes occupying the same space. Keep the player's current side so
  // TALK TO does not make Rook cross through Arthur merely to establish room.
  if (Math.abs(state.rookPosition.x - centerX) >= 72) return null
  const x = target?.visible
    ? (state.rookPosition.x <= centerX
        ? target.left - Math.max(56, target.approachLeft ?? 0)
        : target.left + target.width + Math.max(56, target.approachRight ?? 0))
    : centerX + (state.rookPosition.x <= centerX ? -88 : 88)
  return clampWalk({ x, y: state.rookPosition.y })
}
function facingArthur(state: AdventureState): Pick<AdventureState, 'rookFacing' | 'mrIndexFacing'> {
  return facingPair(state.rookPosition.x, arthurStandX(state))
}
function mutualFacingForLines(state: AdventureState, lines: readonly SpeechLine[]) {
  const hasRook = lines.some(line => line.speaker === 'ROOK')
  const hasArthur = lines.some(line => line.speaker === 'MR_INDEX')
  return hasRook && hasArthur ? facingArthur(state) : {}
}
function approachPoint(state: AdventureState, hotspot: { id: string; walkTo: Point }, fromX: number): Point {
  const target = state.runtimeSession.targets[hotspot.id]
  if (!target?.visible) return hotspot.walkTo
  return walkPointForTarget(target, fromX)
}
const FORM_HANDOFF_EXTRA_GAP = 10
function interactionApproachPoint(state: AdventureState, hotspot: { id: string; walkTo: Point }, fromX: number, pending: PendingInteraction): Point {
  const point = approachPoint(state, hotspot, fromX)
  const formHandoff = pending.targetId === 'mr-index'
    && (pending.verb === 'GIVE' || pending.verb === 'USE')
    && pending.itemId === 'signed-terminal-authorization-form-with-doodles'
  if (!formHandoff) return point
  const targetX = objectCenterX(state, pending.targetId) ?? hotspot.walkTo.x
  return { ...point, x: point.x + (fromX <= targetX ? -FORM_HANDOFF_EXTRA_GAP : FORM_HANDOFF_EXTRA_GAP) }
}
function lookRangeFor(state: AdventureState, id: string) {
  return state.runtimeSession.targets[id]?.lookRange ?? targetApproach(id).look
}
function lookStand(from: Point, target: Point, range: number): Point | null {
  const dist = Math.hypot(target.x - from.x, target.y - from.y)
  if (dist <= range) return null
  const travel = dist - range
  return { x: from.x + ((target.x - from.x) / dist) * travel, y: from.y + ((target.y - from.y) / dist) * travel }
}
function faceToward(fromX: number, targetX: number): 'LEFT' | 'RIGHT' {
  return targetX < fromX ? 'LEFT' : 'RIGHT'
}
function facePoint(state: AdventureState, targetX: number): AdventureState {
  if (targetX === state.rookPosition.x) return state
  return { ...state, rookFacing: faceToward(state.rookPosition.x, targetX) }
}
function objectCenterX(state: AdventureState, targetId: string): number | null {
  const target = state.runtimeSession.targets[targetId]
  if (target?.visible) return target.centerX
  return hotspots.find((item) => item.id === targetId)?.walkTo.x ?? null
}
function faceObject(state: AdventureState, targetId: string | null | undefined): AdventureState {
  if (!targetId) return state
  const center = objectCenterX(state, targetId)
  if (center == null || center === state.rookPosition.x) return state
  return { ...state, rookFacing: faceToward(state.rookPosition.x, center) }
}
function watchCabinet(state: AdventureState): AdventureState {
  const pending = state.walk?.pendingInteraction?.targetId
  const moving = state.walk != null && state.walk.to.x !== state.rookPosition.x
  const faced = moving ? { ...state, rookFacing: faceToward(state.rookPosition.x, state.walk!.to.x) } : faceObject(state, pending)
  return faced
}
function closeDialogue(state: AdventureState): AdventureState {
  return { ...state, dialogueOpen: false, speech: null, mrIndexFacing: ARTHUR_IDLE_FACING }
}
function clampWalk(point: Point): Point {
  return { x: Math.max(28, Math.min(930, point.x)), y: Math.max(WALK_Y_MIN, Math.min(WALK_Y_MAX, point.y)) }
}
function startWalk(state: AdventureState, to: Point, pending: PendingInteraction | null): AdventureState {
  to = clampWalk(to)
  const previous = state.walk?.pendingInteraction ?? null
  const replaced = Boolean(previous && !sameIntent(previous, pending))
  const destinationOnlyTerminal = Boolean(state.walk && !previous && !state.walk.replacementAnnounced && pending?.verb === 'USE' && pending.targetId === 'nansen-terminal')
  const noted = replaced ? noteReplacement(state, previous) : destinationOnlyTerminal ? emitReplacement(state) : state
  const aimed = pending ? faceObject(noted, pending.targetId) : { ...noted, rookFacing: faceToward(state.rookPosition.x, to.x) }
  if (state.reducedAnimation) {
    const arrived = { ...aimed, rookPosition: to, walk: null, selectedVerb: null, selectedItemId: null, rookPose: 'IDLE' as const }
    return pending ? applyInteraction(arrived, pending) : arrived
  }
  return watchCabinet({
    ...aimed, selectedVerb: null, selectedItemId: null, rookPose: 'IDLE',
    walk: { from: state.rookPosition, to, path: walkPath(state.rookPosition, to), segmentIndex: 0, segmentProgress: 0, pendingInteraction: pending },
  })
}
function placeLines(state: AdventureState, lines: SpeechLine[], outcomeId: string): AdventureState {
  const control = controlForOutcome(outcomeId)
  const settled = { ...state, ...mutualFacingForLines(state, lines), selectedVerb: null, selectedItemId: null }
  if (control === 'NONBLOCKING_SELF_TALK') {
    return { ...settled, nonblockingSpeech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, control, state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'NONBLOCKING') }
  }
  return { ...settled, speech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, control, state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'BLOCKING') }
}

function inventoryForPhase(phase: PuzzlePhase): InventoryItemId[] {
  switch (phase) {
    case 'FORM_HELD': return ['blank-terminal-authorization-form']
    case 'PEN_HELD': return ['loose-feather-pen']
    case 'FORM_AND_PEN': return ['blank-terminal-authorization-form', 'loose-feather-pen']
    case 'FORM_COMPLETED': return ['signed-terminal-authorization-form-with-doodles', 'broken-feather-pen']
    case 'FORM_SUBMITTED': return ['broken-feather-pen']
    case 'COMPLETE': return ['broken-feather-pen', 'approved-stamped-terminal-authorization-form', 'euler-case-file']
    default: return []
  }
}

function ruleRemoves(rule: Pick<InteractionRule, 'removeItem' | 'removeItems'>): InventoryItemId[] {
  return [...(rule.removeItem ? [rule.removeItem] : []), ...(rule.removeItems ?? [])]
}
function ruleAdds(rule: Pick<InteractionRule, 'addItem' | 'addItems'>): InventoryItemId[] {
  return [...(rule.addItem ? [rule.addItem] : []), ...(rule.addItems ?? [])]
}
function applyRuleMutation(phase: PuzzlePhase, inventory: readonly InventoryItemId[], rule: InteractionRule | ItemRule, drawers: { caseFileDrawer: AdventureState['caseFileDrawer']; miscDrawer: AdventureState['miscDrawer'] }) {
  const removes = ruleRemoves(rule)
  const adds = ruleAdds(rule)
  const nextInventory = inventory.filter((id) => !removes.includes(id))
  for (const add of adds) if (!nextInventory.includes(add)) nextInventory.push(add)
  return { phase: 'nextPhase' in rule && rule.nextPhase ? rule.nextPhase : phase, inventory: nextInventory, caseFileDrawer: 'setCaseFileDrawer' in rule && rule.setCaseFileDrawer ? rule.setCaseFileDrawer : drawers.caseFileDrawer, miscDrawer: 'setMiscDrawer' in rule && rule.setMiscDrawer ? rule.setMiscDrawer : drawers.miscDrawer }
}
function itemRuleApplies(rule: ItemRule, phase: PuzzlePhase): boolean {
  const phases = rule.phases
  return phases === 'ANY' || phases === phase || (Array.isArray(phases) && phases.includes(phase))
}

function beginSequence(state: AdventureState, rule: InteractionRule, pendingSpeech: SpeechLine[], focusReturnTarget: HotspotId): AdventureState {
  const sequence = sequenceForRule(rule.id)
  if (!sequence) throw Error(`SEQUENCE_NOT_FOUND:${rule.id}`)
  const reservedParticipants = [...new Set(sequence.actions.map(({ actor }) => actor).filter((actor): actor is 'ROOK' | 'ARTHUR' => Boolean(actor)))]
  const activeSequence: ActiveSequenceState = {
    id: sequence.id, originInteractionId: `INTERACTION.REQUIRED.${rule.id}`, selectedVerb: rule.verb, actionIndex: -1, status: 'READY',
    reservedParticipants, reservedProps: [rule.targetId, ...(rule.itemId ? [rule.itemId] : [])], currentStage: null, currentActionId: null,
    currentSemanticContact: null, currentPhysicalPoseClass: null, currentPropOwners: {}, currentActorIntentions: {}, currentCaptionIntention: null, currentSoundIntention: null,
    pendingStateChangeRule: rule.id, stateChangeOccurred: false, handoverOccurred: false, focusReturnTarget, pendingSpeech,
    waitingSpeechStage: null, completedSpeechStages: [],
  }
  // A future mixed-speaker line must not turn Rook away from the object before
  // physical contact. The form exchange is the one scripted sequence whose
  // initial physical target is Arthur; drawer/case-file sequences retain the
  // object-facing direction established on arrival.
  const facing = sequence.id === 'SEQUENCE.FORM_REVIEW_RETURN' ? mutualFacingForLines(state, pendingSpeech) : {}
  return { ...state, ...facing, selectedVerb: null, selectedItemId: null, activeSequence, focusReturnTarget: null, speech: null, lastInteractionId: activeSequence.originInteractionId, lastSequenceId: sequence.id }
}

function beginPhysicalSequence(state: AdventureState, route: PhysicalChoreographyContract, pendingSpeech: SpeechLine[], focusReturnTarget: HotspotId): AdventureState {
  const sequence = SCRIPTED_SEQUENCES.find(({ id }) => id === 'SEQUENCE.PHYSICAL_CONTACT')
  if (!sequence || !route.contactId) throw Error(`PHYSICAL_SEQUENCE_CONTRACT_MISSING:${route.routeId}`)
  const required = route.routeId.startsWith('required.')
  const activeSequence: ActiveSequenceState = {
    id: sequence.id,
    originInteractionId: required ? `INTERACTION.REQUIRED.${route.routeId.slice('required.'.length)}` : `INTERACTION.DEAD_END.${route.verb}.${route.target}.${route.requiredItem ?? 'NONE'}`,
    selectedVerb: route.verb,
    actionIndex: -1,
    status: 'READY',
    reservedParticipants: ['ROOK'],
    reservedProps: [route.target, ...(route.requiredItem ? [route.requiredItem] : [])],
    currentStage: null,
    currentActionId: null,
    currentSemanticContact: null,
    currentPhysicalPoseClass: null,
    currentPropOwners: {},
    currentActorIntentions: {},
    currentCaptionIntention: null,
    currentSoundIntention: null,
    pendingStateChangeRule: route.routeId,
    stateChangeOccurred: false,
    handoverOccurred: false,
    focusReturnTarget,
    pendingSpeech,
    waitingSpeechStage: null,
    completedSpeechStages: [],
  }
  return { ...state, selectedVerb: null, selectedItemId: null, activeSequence, focusReturnTarget: null, speech: null, nonblockingSpeech: null, lastInteractionId: activeSequence.originInteractionId, lastSequenceId: sequence.id }
}

function beginPreserveSequence(state: AdventureState, pending: PendingInteraction, pendingSpeech: SpeechLine[]): AdventureState {
  const sequence = SCRIPTED_SEQUENCES.find(({ id }) => id === 'SEQUENCE.PRESERVE_REACH')
  if (!sequence || pendingSpeech.length < 2) throw Error('PRESERVE_SEQUENCE_CONTRACT_MISSING')
  const activeSequence: ActiveSequenceState = {
    id: sequence.id,
    originInteractionId: `INTERACTION.DEAD_END.${pending.verb}.${pending.targetId}.NONE`,
    selectedVerb: pending.verb,
    actionIndex: -1,
    status: 'READY',
    reservedParticipants: ['ROOK'],
    reservedProps: [pending.targetId],
    currentStage: null,
    currentActionId: null,
    currentSemanticContact: null,
    currentPhysicalPoseClass: null,
    currentPropOwners: {},
    currentActorIntentions: {},
    currentCaptionIntention: null,
    currentSoundIntention: null,
    pendingStateChangeRule: 'preserve-reach',
    stateChangeOccurred: false,
    handoverOccurred: false,
    focusReturnTarget: pending.targetId,
    pendingSpeech,
    waitingSpeechStage: null,
    completedSpeechStages: [],
  }
  return { ...state, selectedVerb: null, selectedItemId: null, activeSequence, focusReturnTarget: null, speech: null, nonblockingSpeech: null, rookPose: 'IDLE', lastInteractionId: activeSequence.originInteractionId, lastSequenceId: sequence.id }
}

function advancePreserveSequence(state: AdventureState): AdventureState {
  const active = state.activeSequence
  const sequence = SCRIPTED_SEQUENCES.find(({ id }) => id === 'SEQUENCE.PRESERVE_REACH')
  if (!active || !sequence) throw Error('ACTIVE_PRESERVE_SEQUENCE_CONTRACT_MISSING')
  const actionIndex = active.actionIndex + 1
  const scripted = sequence.actions[actionIndex]
  if (!scripted) throw Error('ACTIVE_SEQUENCE_ACTION_MISSING')
  const event: SequenceEvent = {
    sequenceId: sequence.id,
    actionId: scripted.id,
    actor: scripted.actor ?? null,
    receiver: scripted.receiver ?? null,
    semanticIntention: scripted.intention ?? null,
    receiverIntention: scripted.receiverIntention ?? null,
    selectedVerb: active.selectedVerb,
    poseClass: scripted.physicalPose?.poseClass ?? null,
    semanticContact: scripted.contact ?? null,
    visiblePropOwner: null,
    mutationTiming: 'NONE',
    mutationApplied: false,
    inventoryBefore: [...state.inventory],
    inventoryAfter: [...state.inventory],
    phaseBefore: state.phase,
    phaseAfter: state.phase,
  }
  const poses = resolvePhysicalPose(state, scripted.physicalPose ?? null)
  const advanced: ActiveSequenceState = {
    ...active,
    actionIndex,
    status: scripted.speechStage ? 'WAITING_FOR_SPEECH' : 'ACTION_ACTIVE',
    currentStage: scripted.mark ?? null,
    currentActionId: scripted.id,
    currentSemanticContact: scripted.contact ?? null,
    currentPhysicalPoseClass: scripted.physicalPose?.poseClass ?? null,
    currentPropOwners: scripted.physicalPose?.propOwners ?? active.currentPropOwners,
    currentActorIntentions: scripted.actor && scripted.intention ? { [scripted.actor]: scripted.intention } : {},
    currentCaptionIntention: scripted.caption ?? null,
    currentSoundIntention: scripted.sound ?? null,
    waitingSpeechStage: scripted.speechStage ?? null,
  }
  const base: AdventureState = {
    ...state,
    ...poses,
    activeSequence: advanced,
    sequenceEvents: [...state.sequenceEvents, event],
    lastSemanticContact: scripted.contact ?? state.lastSemanticContact,
  }
  if (scripted.speechStage) {
    if (active.completedSpeechStages.includes(scripted.speechStage)) throw Error(`SEQUENCE_SPEECH_REPLAY:${scripted.speechStage}`)
    const stageLines = scripted.speechStage === 'PRESERVE_PRE_REACH' ? active.pendingSpeech.slice(0, 1) : active.pendingSpeech.slice(1)
    const stagedSpeech = speech(stageLines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('PRESERVE_REACH'), state.dialogueDisplay)
    return { ...base, speech: stagedSpeech, transcript: withCurrentTranscript(base, stageLines[0], 'BLOCKING') }
  }
  if (actionIndex < sequence.actions.length - 1) return base
  return { ...base, activeSequence: null, focusReturnTarget: active.focusReturnTarget, speech: null, rookPose: 'IDLE' }
}

function advancePhysicalSequence(state: AdventureState): AdventureState {
  const active = state.activeSequence
  const sequence = SCRIPTED_SEQUENCES.find(({ id }) => id === 'SEQUENCE.PHYSICAL_CONTACT')
  const route = PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(({ routeId }) => routeId === active?.pendingStateChangeRule)
  if (!active || !sequence || !route || !route.contactId) throw Error('ACTIVE_PHYSICAL_SEQUENCE_CONTRACT_MISSING')
  const actionIndex = active.actionIndex + 1
  const scripted = sequence.actions[actionIndex]
  if (!scripted) throw Error('ACTIVE_SEQUENCE_ACTION_MISSING')
  const semanticContact = scripted.kind === 'CONTACT' ? route.contactId : null
  const atContact = !active.stateChangeOccurred && semanticContact === route.contactId
  const ruleId = route.routeId.startsWith('required.') ? route.routeId.slice('required.'.length) : null
  const rule = ruleId ? usefulRules.find(({ id }) => id === ruleId) : null
  if (ruleId && !rule) throw Error(`PHYSICAL_RULE_NOT_FOUND:${ruleId}`)
  const ruleMutation = atContact && rule ? applyRuleMutation(state.phase, state.inventory, rule, state) : null
  const dynamicGlobe = atContact && route.routeId.startsWith('dynamic.globe.') ? globeSpin(state, route.verb === 'PULL' ? 'PULL' : 'PUSH') : null
  const lampToggle = atContact && route.routeId === 'dynamic.lamp.use'
  const inventoryAfter = ruleMutation?.inventory ?? state.inventory
  const phaseAfter = ruleMutation?.phase ?? state.phase
  const physicalAction = scripted.actor === 'ROOK' && (scripted.kind === 'INTENTION' || scripted.kind === 'CONTACT')
  const poseClass = physicalAction ? route.poseClass : null
  const event: SequenceEvent = {
    sequenceId: sequence.id,
    actionId: scripted.id,
    actor: scripted.actor ?? null,
    receiver: null,
    semanticIntention: physicalAction ? route.verb : scripted.intention ?? null,
    receiverIntention: null,
    selectedVerb: route.verb,
    poseClass,
    semanticContact,
    visiblePropOwner: null,
    mutationTiming: atContact ? 'CONTACT' : 'NONE',
    mutationApplied: atContact,
    inventoryBefore: [...state.inventory],
    inventoryAfter: [...inventoryAfter],
    phaseBefore: state.phase,
    phaseAfter,
  }
  const nextArchived = atContact && rule?.evidenceId && !state.archivedEvidenceIds.includes(rule.evidenceId)
    ? [...state.archivedEvidenceIds, rule.evidenceId]
    : state.archivedEvidenceIds
  const advanced: ActiveSequenceState = {
    ...active,
    actionIndex,
    status: 'ACTION_ACTIVE',
    currentStage: scripted.mark ?? null,
    currentActionId: scripted.id,
    currentSemanticContact: semanticContact,
    currentPhysicalPoseClass: poseClass,
    currentPropOwners: active.currentPropOwners,
    currentActorIntentions: scripted.actor ? { [scripted.actor]: physicalAction ? route.verb : scripted.intention ?? 'IDLE' } : {},
    currentCaptionIntention: scripted.caption ?? null,
    currentSoundIntention: scripted.sound ?? null,
    stateChangeOccurred: active.stateChangeOccurred || atContact,
  }
  const directive = physicalAction ? routePoseDirective(route) : null
  const poses = resolvePhysicalPose(state, directive)
  const base: AdventureState = {
    ...state,
    phase: phaseAfter,
    inventory: inventoryAfter,
    caseFileDrawer: ruleMutation?.caseFileDrawer ?? state.caseFileDrawer,
    miscDrawer: ruleMutation?.miscDrawer ?? state.miscDrawer,
    ...(dynamicGlobe ?? {}),
    lampPower: lampToggle ? (state.lampPower === 'ON' ? 'OFF' : 'ON') : state.lampPower,
    lampSpeech: lampToggle ? Math.min(2, state.lampSpeech + 1) as 0 | 1 | 2 : state.lampSpeech,
    activeSequence: advanced,
    sequenceEvents: [...state.sequenceEvents, event],
    lastSemanticContact: semanticContact ?? state.lastSemanticContact,
    recordArchived: state.recordArchived || Boolean(atContact && rule?.evidenceId),
    archivedEvidenceIds: nextArchived,
    evidenceDrawerOpen: state.evidenceDrawerOpen || Boolean(atContact && rule?.evidenceId),
    ...poses,
  }
  if (actionIndex < sequence.actions.length - 1) return base
  const dynamic = route.routeId.startsWith('dynamic.')
  const nextSpeech = speech(active.pendingSpeech, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome(dynamic ? 'DEAD_END' : ruleId!), state.dialogueDisplay)
  const settled: AdventureState = {
    ...base,
    activeSequence: null,
    focusReturnTarget: active.focusReturnTarget,
    speech: dynamic ? null : nextSpeech,
    nonblockingSpeech: dynamic ? nextSpeech : null,
    transcript: withCurrentTranscript(base, active.pendingSpeech[0], dynamic ? 'NONBLOCKING' : 'BLOCKING'),
    rookPose: 'IDLE',
  }
  return !dynamic && (ruleId === 'take-pen' || ruleId === 'take-pen-2')
    ? startWalk(settled, arthurConversationMark(settled), null)
    : settled
}

function advanceSequence(state: AdventureState): AdventureState {
  const active = state.activeSequence
  if (!active) return state
  // Compatibility for reducer-only harnesses that drive sequences directly.
  // The production timer is disarmed while waiting, so real UI progression can
  // only resume through the speech controller in advanceSpeech.
  if (active.status === 'WAITING_FOR_SPEECH' && active.waitingSpeechStage) {
    const waitingSequence = SCRIPTED_SEQUENCES.find(({ id }) => id === active.id)
    const completed = active.completedSpeechStages.includes(active.waitingSpeechStage)
      ? active.completedSpeechStages
      : [...active.completedSpeechStages, active.waitingSpeechStage]
    if (waitingSequence && active.actionIndex === waitingSequence.actions.length - 1) return { ...state, speech: null, activeSequence: null, focusReturnTarget: active.focusReturnTarget, rookPose: 'IDLE', mrIndexPose: 'IDLE', arthurPointHold: false }
    return { ...state, speech: null, activeSequence: { ...active, status: 'ACTION_ACTIVE', waitingSpeechStage: null, completedSpeechStages: completed } }
  }
  if (active.id === 'SEQUENCE.CABINET_POLICY_BLOCK') return advanceCabinetPolicyBlock(state)
  if (active.id === 'SEQUENCE.PRESERVE_REACH') return advancePreserveSequence(state)
  if (active.id === 'SEQUENCE.PHYSICAL_CONTACT') return advancePhysicalSequence(state)
  const sequence = SCRIPTED_SEQUENCES.find(({ id }) => id === active.id)
  const rule = usefulRules.find(({ id }) => id === active.pendingStateChangeRule)
  if (!sequence || !rule) throw Error('ACTIVE_SEQUENCE_CONTRACT_MISSING')
  const route = PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(({ routeId }) => routeId === `required.${rule.id}`)
  if (!route) throw Error(`SCRIPTED_PHYSICAL_ROUTE_MISSING:${rule.id}`)
  const actionIndex = active.actionIndex + 1
  const scripted = sequence.actions[actionIndex]
  if (!scripted) throw Error('ACTIVE_SEQUENCE_ACTION_MISSING')
  const phaseBefore = state.phase
  const inventoryBefore = [...state.inventory]
  const atMutationContact = !active.stateChangeOccurred && scripted.contact === sequence.mutationContact
  const atHandoverContact = Boolean(rule.handover) && !active.handoverOccurred && scripted.contact === rule.handover!.contact
  const atApprovalContact = sequence.id === 'SEQUENCE.FORM_REVIEW_RETURN' && state.authorizationState === 'PENDING' && scripted.contact === 'CONTACT.FORM_STAMP'
  // Per-contact acquisition: each grant lands once at its own semantic contact
  // and never duplicates already-owned items, so interrupted and replayed
  // sequences converge instead of duplicating, skipping, or losing items.
  const contactAdds = (rule.contactGrants ?? []).filter((grant) => grant.contact === scripted.contact).flatMap((grant) => grant.addItems).filter((id) => !state.inventory.includes(id))
  const baseMutation = applyRuleMutation(state.phase, state.inventory, rule, state)
  const mutated = atHandoverContact
    ? { ...baseMutation, phase: rule.handover!.nextPhase, inventory: state.inventory.filter((id) => !rule.handover!.removeItems.includes(id)), caseStack: state.caseStack, miscContents: state.miscContents }
    : atMutationContact
      ? { ...baseMutation, inventory: [...baseMutation.inventory, ...contactAdds.filter((id) => !baseMutation.inventory.includes(id))], caseStack: rule.drawerStateAfter?.caseStack ?? state.caseStack, miscContents: rule.drawerStateAfter?.miscContents ?? state.miscContents }
      : { ...baseMutation, phase: state.phase, inventory: [...state.inventory, ...contactAdds], caseStack: state.caseStack, miscContents: state.miscContents }
  const archivedEvidenceIds = atMutationContact && rule.evidenceId && !state.archivedEvidenceIds.includes(rule.evidenceId)
    ? [...state.archivedEvidenceIds, rule.evidenceId] : state.archivedEvidenceIds
  const event: SequenceEvent = {
    sequenceId: sequence.id, actionId: scripted.id,
    actor: scripted.actor ?? null, receiver: scripted.receiver ?? null,
    semanticIntention: scripted.intention ?? null, receiverIntention: scripted.receiverIntention ?? null,
    selectedVerb: route.verb, poseClass: scripted.physicalPose?.poseClass ?? null,
    semanticContact: scripted.contact ?? null,
    visiblePropOwner: scripted.physicalPose?.propOwners?.FORM_PAPER ?? active.currentPropOwners.FORM_PAPER ?? null,
    mutationTiming: atApprovalContact ? 'APPROVAL_COMMIT' : atHandoverContact ? 'HANDOFF' : scripted.contact === 'CONTACT.FORM_RETURN' ? 'RETURN' : atMutationContact ? 'CONTACT' : 'NONE',
    mutationApplied: atMutationContact || atHandoverContact || atApprovalContact,
    inventoryBefore, inventoryAfter: [...mutated.inventory], phaseBefore, phaseAfter: mutated.phase,
  }
  const currentActorIntentions = {
    ...(scripted.actor && scripted.intention ? { [scripted.actor]: scripted.intention } : {}),
    ...(scripted.receiver && scripted.receiverIntention ? { [scripted.receiver]: scripted.receiverIntention } : {}),
  }
  const physicalDirective = scriptedPoseDirective(route, sequence.id, scripted.physicalPose)
  const poses = resolvePhysicalPose(state, physicalDirective)
  const advanced: ActiveSequenceState = {
    ...active, actionIndex, status: scripted.speechStage ? 'WAITING_FOR_SPEECH' : 'ACTION_ACTIVE', currentStage: scripted.mark ?? null,
    currentActionId: scripted.id, currentSemanticContact: scripted.contact ?? null,
    currentPhysicalPoseClass: physicalDirective?.poseClass ?? null,
    currentPropOwners: physicalDirective?.propOwners ?? active.currentPropOwners,
    currentActorIntentions,
    currentCaptionIntention: scripted.caption ?? null, currentSoundIntention: scripted.sound ?? null,
    stateChangeOccurred: active.stateChangeOccurred || atMutationContact,
    handoverOccurred: active.handoverOccurred || atHandoverContact,
    waitingSpeechStage: scripted.speechStage ?? null,
  }
  const base: AdventureState = {
    ...state, phase: mutated.phase, authorizationState: atApprovalContact ? 'APPROVED' : state.authorizationState, inventory: mutated.inventory, caseFileDrawer: mutated.caseFileDrawer, miscDrawer: mutated.miscDrawer, caseStack: mutated.caseStack, miscContents: mutated.miscContents, activeSequence: advanced,
    sequenceEvents: [...state.sequenceEvents, event], lastSemanticContact: scripted.contact ?? state.lastSemanticContact,
    lastSoundIntent: scripted.sound ?? state.lastSoundIntent,
    recordArchived: state.recordArchived || Boolean(atMutationContact && rule.evidenceId), archivedEvidenceIds,
    evidenceDrawerOpen: state.evidenceDrawerOpen || Boolean(atMutationContact && rule.evidenceId),
    ...poses,
    arthurPointHold: state.arthurPointHold || (sequence.id === 'SEQUENCE.TERMINAL_REPRIMAND' && scripted.actor === 'ARTHUR'),
  }
  if (scripted.speechStage) {
    if (active.completedSpeechStages.includes(scripted.speechStage)) throw Error(`SEQUENCE_SPEECH_REPLAY:${scripted.speechStage}`)
    const stageLines = scripted.speechStage === 'BLOCKED_REPRIMAND'
      ? active.pendingSpeech
      : scripted.speechStage in DRAWER_SEQUENCE_SPEECH
        ? [...DRAWER_SEQUENCE_SPEECH[scripted.speechStage as keyof typeof DRAWER_SEQUENCE_SPEECH]]
        : scripted.speechStage in CASEFILE_SEQUENCE_SPEECH
          ? [...CASEFILE_SEQUENCE_SPEECH[scripted.speechStage as keyof typeof CASEFILE_SEQUENCE_SPEECH]]
        : [...FORM_SEQUENCE_SPEECH[scripted.speechStage as keyof typeof FORM_SEQUENCE_SPEECH]]
    const stagedSpeech = speech(stageLines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome(rule.id), state.dialogueDisplay)
    return { ...base, ...(scripted.speechStage === 'BLOCKED_REPRIMAND' ? facingArthur(base) : {}), arthurPointHold: scripted.speechStage === 'BLOCKED_REPRIMAND' || base.arthurPointHold, speech: stagedSpeech, transcript: withCurrentTranscript(base, stageLines[0], 'BLOCKING') }
  }
  if (actionIndex < sequence.actions.length - 1) return base
  // A staged sequence already presented pendingSpeech at its dialogue action.
  // Re-queuing it at the final focus action was the source of the back-to-back
  // terminal reprimand replay reported during the Principal pass.
  const pendingAlreadyDelivered = active.completedSpeechStages.length > 0
  const nextSpeech = sequence.id === 'SEQUENCE.FORM_REVIEW_RETURN' || pendingAlreadyDelivered ? null : speech(active.pendingSpeech, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome(rule.id), state.dialogueDisplay)
  return {
    ...base, activeSequence: null, focusReturnTarget: active.focusReturnTarget, speech: nextSpeech,
    transcript: nextSpeech ? withCurrentTranscript(base, active.pendingSpeech[0], 'BLOCKING') : base.transcript, rookPose: 'IDLE', mrIndexPose: 'IDLE', arthurPointHold: false,
  }
}

const LOCKED_CABINETS = ['official-case-file-cabinet', 'miscellaneous-drawer-cabinet'] as const
function lockedCabinetAttempt(state: AdventureState, pending: PendingInteraction): boolean {
  if (state.phase === 'COMPLETE') return false
  if (pending.itemId) return false
  if (pending.verb !== 'OPEN' && pending.verb !== 'USE' && pending.verb !== 'PULL') return false
  return LOCKED_CABINETS.includes(pending.targetId as typeof LOCKED_CABINETS[number])
}
function beginCabinetPolicyBlock(state: AdventureState, targetId: HotspotId): AdventureState {
  const sequence = SCRIPTED_SEQUENCES.find(({ id }) => id === 'SEQUENCE.CABINET_POLICY_BLOCK')
  if (!sequence) throw Error('CABINET_POLICY_SEQUENCE_MISSING')
  const repeatKey = `cabinet-policy:${targetId}`
  const lines = r55SpeechByEvent((state.interactionRepeats[repeatKey] ?? 0) === 0 ? 'COPY.A1:First attempt' : 'COPY.A1:Repeat attempt')
  const activeSequence: ActiveSequenceState = {
    id: sequence.id, originInteractionId: `INTERACTION.BLOCKED.cabinet-policy.${targetId}`, selectedVerb: null, actionIndex: -1, status: 'READY',
    reservedParticipants: ['ROOK', 'ARTHUR'], reservedProps: [targetId], currentStage: null, currentActionId: null,
    currentSemanticContact: null, currentPhysicalPoseClass: null, currentPropOwners: {}, currentActorIntentions: {}, currentCaptionIntention: null, currentSoundIntention: null,
    pendingStateChangeRule: 'cabinet-policy-block', stateChangeOccurred: false, handoverOccurred: false, focusReturnTarget: targetId, pendingSpeech: lines,
    waitingSpeechStage: null, completedSpeechStages: [],
  }
  return { ...state, selectedVerb: null, selectedItemId: null, activeSequence, focusReturnTarget: null, speech: null, arthurPointHold: false, lastInteractionId: activeSequence.originInteractionId, lastSequenceId: sequence.id, interactionRepeats: { ...state.interactionRepeats, [repeatKey]: (state.interactionRepeats[repeatKey] ?? 0) + 1 } }
}
function advanceCabinetPolicyBlock(state: AdventureState): AdventureState {
  const active = state.activeSequence
  if (!active) return state
  const sequence = SCRIPTED_SEQUENCES.find(({ id }) => id === 'SEQUENCE.CABINET_POLICY_BLOCK')
  if (!sequence) throw Error('CABINET_POLICY_SEQUENCE_MISSING')
  const actionIndex = active.actionIndex + 1
  const scripted = sequence.actions[actionIndex]
  if (!scripted) throw Error('ACTIVE_SEQUENCE_ACTION_MISSING')
  const event: SequenceEvent = {
    sequenceId: sequence.id, actionId: scripted.id,
    actor: scripted.actor ?? null, receiver: scripted.receiver ?? null,
    semanticIntention: scripted.intention ?? null, receiverIntention: scripted.receiverIntention ?? null,
    selectedVerb: null, poseClass: scripted.physicalPose?.poseClass ?? null,
    semanticContact: scripted.contact ?? null, visiblePropOwner: scripted.physicalPose?.propOwners?.FORM_PAPER ?? null,
    mutationTiming: 'NONE', mutationApplied: false,
    inventoryBefore: [...state.inventory], inventoryAfter: [...state.inventory], phaseBefore: state.phase, phaseAfter: state.phase,
  }
  const captionLine = scripted.caption ? { speaker: 'ROOK' as const, text: scripted.caption } : undefined
  const advanced: ActiveSequenceState = {
    ...active, actionIndex, status: scripted.speechStage ? 'WAITING_FOR_SPEECH' : 'ACTION_ACTIVE', currentStage: scripted.mark ?? null,
    currentActionId: scripted.id,
    currentSemanticContact: scripted.contact ?? null,
    currentPhysicalPoseClass: scripted.physicalPose?.poseClass ?? null,
    currentPropOwners: scripted.physicalPose?.propOwners ?? active.currentPropOwners,
    currentActorIntentions: scripted.actor && scripted.intention ? { [scripted.actor]: scripted.intention } : {},
    currentCaptionIntention: scripted.caption ?? null, currentSoundIntention: scripted.sound ?? null,
    waitingSpeechStage: scripted.speechStage ?? null,
  }
  const poses = resolvePhysicalPose(state, scripted.physicalPose ?? null)
  const base: AdventureState = {
    ...state, activeSequence: advanced, sequenceEvents: [...state.sequenceEvents, event],
    lastSemanticContact: scripted.contact ?? state.lastSemanticContact,
    transcript: withCurrentTranscript(state, captionLine, 'NONBLOCKING'),
    caseFileDrawer: state.caseFileDrawer, miscDrawer: state.miscDrawer, caseStack: state.caseStack, miscContents: state.miscContents,
    inventory: state.inventory, phase: state.phase,
    ...poses,
    arthurPointHold: state.arthurPointHold || scripted.speechStage === 'BLOCKED_REPRIMAND',
  }
  if (scripted.speechStage === 'BLOCKED_REPRIMAND') {
    const nextSpeech = speech(active.pendingSpeech, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('CABINET_POLICY_BLOCK'), state.dialogueDisplay)
    return { ...base, ...facingArthur(base), speech: nextSpeech, transcript: withCurrentTranscript(base, active.pendingSpeech[0], 'BLOCKING') }
  }
  if (actionIndex < sequence.actions.length - 1) return base
  return { ...base, activeSequence: null, focusReturnTarget: active.focusReturnTarget, speech: null, rookPose: 'IDLE', mrIndexPose: 'IDLE', arthurPointHold: false }
}
function drawerConditionsMet(state: AdventureState, rule: Pick<InteractionRule, 'requiresDrawer' | 'requiresStack' | 'requiresMisc'>): boolean {
  if (rule.requiresDrawer && state[rule.requiresDrawer.drawer] !== rule.requiresDrawer.is) return false
  if (rule.requiresStack && state.caseStack !== rule.requiresStack) return false
  if (rule.requiresMisc && state.miscContents !== rule.requiresMisc) return false
  return true
}
// R4: LOOK AT the piggy note begins a player-paced in-place reading. The
// milestone stays UNREAD while speech is queued or mid-passage; only the final
// required acknowledgment (see advanceSpeech) may set BACK_READ. Late-bound
// Story placeholder copy; the item is reusable and nonconsumable.
function beginNoteRead(state: AdventureState): AdventureState {
  const lines = r55Speech('brcg.note')
  return { ...state, selectedVerb: null, selectedItemId: null, speech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('NOTE_READ'), state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'BLOCKING'), lastInteractionId: 'INTERACTION.ITEM.look-fictional-token-note', lastSequenceId: null, rookPose: 'IDLE' }
}
function isNoteReadSpeech(active: SpeechState): boolean {
  return active.lines.length > 0 && active.lines.every(line => line.copyKey?.startsWith('r55-')) && active.lines.some(line => line.text.includes('Bitcoin Roller Coaster Guy'))
}
export const GLOBE_LEVEL_1_PROMOTION_MS = 5000
export const GLOBE_LEVEL_2_PROMOTION_MS = 4000
function promotionWindow(level: 1 | 2 | 3) {
  return level === 1 ? GLOBE_LEVEL_1_PROMOTION_MS : level === 2 ? GLOBE_LEVEL_2_PROMOTION_MS : 0
}
function globeSpin(state: AdventureState, verb: 'PUSH' | 'PULL'): Pick<AdventureState, 'globePose' | 'globeMotion' | 'globeLevel' | 'globeMilestones' | 'globeRevision' | 'globeElapsedMs' | 'globeBoostRemainingMs' | 'globeStartPhase' | 'globeDecayStage'> {
  const reverse = state.globePose !== 'IDLE' && state.globePose !== verb
  const sameDirectionAtMaximum = state.globeMotion === 'SPINNING' && !reverse && state.globePose === verb && state.globeLevel === 3
  if (sameDirectionAtMaximum) return {
    globePose: state.globePose, globeMotion: state.globeMotion, globeLevel: state.globeLevel,
    globeMilestones: state.globeMilestones, globeRevision: state.globeRevision,
    globeElapsedMs: state.globeElapsedMs, globeBoostRemainingMs: state.globeBoostRemainingMs,
    globeStartPhase: state.globeStartPhase, globeDecayStage: state.globeDecayStage,
  }
  const moving = state.globePose !== 'IDLE' && state.globeLevel > 0
  const currentCursor = moving ? globeTimelineCursor(state.globePose, state.globeLevel, state.globeElapsedMs, state.globeStartPhase) : null
  const currentPhase = currentCursor?.angularPhase ?? state.globeStartPhase
  const boosted = state.globeMotion === 'SPINNING' && state.globeBoostRemainingMs > 0
  const level = (reverse ? 1 : boosted ? Math.min(3, state.globeLevel + 1) : 1) as 1 | 2 | 3
  const globeMilestones = reverse ? state.globeMilestones : state.globeMilestones | (1 << level)
  const preserveDwellProgress = state.globeMotion === 'SPINNING' && currentCursor && !currentCursor.complete
  const firstDestinationDwell = globeTimeline(verb, level)[0]!.dwellMs
  const globeElapsedMs = preserveDwellProgress ? currentCursor.fractionalDwellProgress * firstDestinationDwell : 0
  return { globePose: verb, globeMotion: 'SPINNING', globeLevel: level, globeMilestones, globeRevision: state.globeRevision + 1, globeElapsedMs, globeBoostRemainingMs: promotionWindow(level), globeStartPhase: currentPhase, globeDecayStage: level === 3 ? 'LEVEL_3' : level === 2 ? 'LEVEL_2' : 'LEVEL_1' }
}
function commitTerminalEntry(state: AdventureState): AdventureState {
  const authorized = terminalCanOpen(state) && !state.dialogueOpen && !state.speech && !state.activeSequence
  const settled = authorized ? { ...state, speech: null, nonblockingSpeech: null, dialogueOpen: false } : state
  return {
    ...settled,
    walk: null,
    selectedVerb: null,
    selectedItemId: null,
    mrIndexFacing: ARTHUR_IDLE_FACING,
    rookPose: authorized ? 'REACH' : state.rookPose,
    terminalEntryPending: authorized || state.terminalEntryPending,
    worldQuiescent: authorized || state.worldQuiescent,
    lastSemanticContact: authorized ? 'CONTACT.TERMINAL_ENTRY' : state.lastSemanticContact,
    lastInteractionId: authorized ? 'INTERACTION.TERMINAL_ENTRY' : state.lastInteractionId,
  }
}
function applyInteraction(state: AdventureState, pending: PendingInteraction): AdventureState {
  if (pending.targetId === 'mr-index' && pending.itemId && pending.verb === 'USE') return applyInteraction(state, { ...pending, verb: 'GIVE' })
  if (pending.verb === 'USE' && pending.targetId === 'nansen-terminal' && !pending.itemId && terminalCanOpen(state)) return commitTerminalEntry(state)
  if (pending.verb === 'TALK_TO' && pending.targetId === 'mr-index') {
    return { ...state, ...facingArthur(state), selectedVerb: null, selectedItemId: null, walk: null, dialogueOpen: true, speech: null }
  }

  if (pending.verb === 'LOOK_AT' && pending.itemId) {
    if (pending.itemId === 'fictional-token-note' && state.piggyNoteReadState === 'UNREAD') return beginNoteRead(state)
    return { ...placeLines(state, inventorySpeechForState(pending.itemId, pending.verb, state), 'ITEM.LOOK'), lastInteractionId: `INTERACTION.ITEM.look-${pending.itemId}` }
  }
  // S10-P1: before the existing stamp milestone, OPEN/USE/PULL on either
  // evidence cabinet walks and reaches, then blocks. Arthur speaks only after
  // that contact. The same milestone later resumes the normal drawer rules.
  if (lockedCabinetAttempt(state, pending)) return beginCabinetPolicyBlock(state, pending.targetId)
  if (!pending.itemId && pending.targetId === 'wall-preserve' && (pending.verb === 'USE' || pending.verb === 'OPEN' || pending.verb === 'PULL')) {
    return beginPreserveSequence(state, pending, deadEndSpeech(pending.verb, pending.targetId, null, state))
  }

  const blocked = blockedInteractions.find(({ verb, targetId, itemId }) => verb === pending.verb && targetId === pending.targetId && itemId === pending.itemId)
  if (blocked) {
    const lines = blocked.speech ?? [{ speaker: 'ROOK' as const, copyKey: blocked.copyKey, text: blocked.text }]
    return {
      ...state,
      selectedVerb: null,
      selectedItemId: null,
      lastInteractionId: `INTERACTION.BLOCKED.${pending.verb}.${pending.targetId}.${pending.itemId}`,
      nonblockingSpeech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('DEAD_END'), state.dialogueDisplay),
      transcript: withCurrentTranscript(state, lines[0], 'NONBLOCKING'),
    }
  }
  const dynamicPhysical = physicalChoreographyFor(pending, state)
  if (dynamicPhysical?.routeId.startsWith('dynamic.') && dynamicPhysical.contactId) {
    return beginPhysicalSequence(state, dynamicPhysical, deadEndSpeech(pending.verb, pending.targetId, pending.itemId, state), pending.targetId)
  }
  const rule = usefulRules.find((candidate) => candidate.verb === pending.verb && candidate.targetId === pending.targetId && (candidate.itemId ?? null) === pending.itemId && (candidate.phase === 'ANY' || candidate.phase === state.phase) && drawerConditionsMet(state, candidate))
  if (!rule) {
    const lines = deadEndSpeech(pending.verb, pending.targetId, pending.itemId, state)
    const globeVerb = !pending.itemId && pending.targetId === 'office-globe' && (pending.verb === 'PUSH' || pending.verb === 'PULL' || pending.verb === 'USE')
      ? (pending.verb === 'PULL' ? 'PULL' : 'PUSH') : null
    const spun = globeVerb ? globeSpin(state, globeVerb) : null
    const lampPower = !pending.itemId && pending.targetId === 'desk-lamp' && pending.verb === 'USE' ? (state.lampPower === 'ON' ? 'OFF' : 'ON') : state.lampPower
    const lampSpeech = !pending.itemId && pending.targetId === 'desk-lamp' && pending.verb === 'USE' ? (Math.min(2, state.lampSpeech + 1) as 0 | 1 | 2) : state.lampSpeech
    return {
      ...state,
      selectedVerb: null,
      selectedItemId: null,
      nonblockingSpeech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('DEAD_END'), state.dialogueDisplay),
      transcript: withCurrentTranscript(state, lines[0], 'NONBLOCKING'),
      interactionRepeats: { ...state.interactionRepeats, [`${pending.verb}:${pending.targetId}`]: (state.interactionRepeats[`${pending.verb}:${pending.targetId}`] ?? 0) + 1 },
      lastInteractionId: pending.targetId === 'mr-index' && pending.itemId && pending.verb === 'GIVE'
        ? `INTERACTION.ARTHUR.${pending.verb}.${pending.itemId}`
        : `INTERACTION.DEAD_END.${pending.verb}.${pending.targetId}.${pending.itemId ?? 'NONE'}`,
      lampPower,
      lampSpeech,
      ...(spun ?? {}),
    }
  }
  const contract = RECORDS_OFFICE_STEPS.find((step) => step.id === rule.id)
  if (!contract || contract.phaseBefore !== rule.phase || contract.phaseAfter !== (rule.nextPhase ?? null) || contract.verb !== rule.verb || contract.target !== rule.targetId || contract.requiredItem !== (rule.itemId ?? null) || JSON.stringify([...contract.removeItems].sort()) !== JSON.stringify([...ruleRemoves(rule)].sort()) || JSON.stringify([...contract.addItems].sort()) !== JSON.stringify([...ruleAdds(rule)].sort()) || (contract.handoverContact ?? null) !== (rule.handover?.contact ?? null) || JSON.stringify(contract.requiresDrawer ?? null) !== JSON.stringify(rule.requiresDrawer ?? null) || (contract.setCaseFileDrawer ?? null) !== (rule.setCaseFileDrawer ?? null) || (contract.setMiscDrawer ?? null) !== (rule.setMiscDrawer ?? null) || (contract.requiresStack ?? null) !== (rule.requiresStack ?? null) || (contract.requiresMisc ?? null) !== (rule.requiresMisc ?? null) || JSON.stringify([...contract.contactGrants].map((g) => [g.contact, ...g.addItems])) !== JSON.stringify([...(rule.contactGrants ?? [])].map((g) => [g.contact, ...g.addItems])) || (contract.drawerStateAfterCaseStack ?? null) !== (rule.drawerStateAfter?.caseStack ?? null) || (contract.drawerStateAfterMisc ?? null) !== (rule.drawerStateAfter?.miscContents ?? null)) throw Error('OFFICE_CHOREOGRAPHY_CONTRACT_DRIFT')

  const sequence = sequenceForRule(rule.id)
  const requiredLines = rule.speech
  if (sequence) {
    const contractTarget = hotspots.some(({ id }) => id === contract.focusDestination) ? contract.focusDestination as HotspotId : rule.targetId
    return beginSequence(state, rule, requiredLines, contractTarget)
  }
  const physical = physicalChoreographyFor(pending, state, rule.id)
  if (physical?.contactId) {
    const contractTarget = hotspots.some(({ id }) => id === contract.focusDestination) ? contract.focusDestination as HotspotId : rule.targetId
    return beginPhysicalSequence(state, physical, requiredLines, contractTarget)
  }
  const mutation = applyRuleMutation(state.phase, state.inventory, rule, state)
  const nextArchived = rule.evidenceId && !state.archivedEvidenceIds.includes(rule.evidenceId)
    ? [...state.archivedEvidenceIds, rule.evidenceId] : state.archivedEvidenceIds
  return {
    ...placeLines({
      ...state,
      phase: mutation.phase,
      inventory: mutation.inventory,
      caseFileDrawer: mutation.caseFileDrawer,
      miscDrawer: mutation.miscDrawer,
    }, requiredLines, rule.id),
    lastInteractionId: `INTERACTION.REQUIRED.${rule.id}`,
    lastSequenceId: null,
    lastSemanticContact: null,
    recordArchived: state.recordArchived || Boolean(rule.evidenceId),
    archivedEvidenceIds: nextArchived,
    evidenceDrawerOpen: state.evidenceDrawerOpen || Boolean(rule.evidenceId),
    rookPose: rule.verb === 'LOOK_AT' ? 'INSPECT' : rule.verb === 'USE' || rule.verb === 'GIVE' ? 'USE_GIVE' : 'IDLE',
    mrIndexPose: rule.id === 'stamp-request' ? 'STAMP' : 'IDLE',
  }
}

function arrive(state: AdventureState): AdventureState {
  if (!state.walk) return state
  const pending = state.walk.pendingInteraction
  const next = faceObject({ ...state, rookPosition: state.walk.to, walk: null }, pending?.targetId)
  if (state.openingStage === 'ROOK_ENTERING') {
    const opening = speech(PRINCIPAL_OPENING, 'INTRO', state.instantText, state.reducedAnimation, controlForOutcome('OPENING'), state.dialogueDisplay)
    return { ...next, ...facingArthur(next), openingStage: 'DIALOGUE', mrIndexPose: 'DOCUMENT', speech: opening, transcript: withCurrentTranscript(next, PRINCIPAL_OPENING[0], 'BLOCKING') }
  }
  return pending ? applyInteraction(next, pending) : next
}

function walkPath(from: Point, to: Point) {
  return pointDistance(from, to) <= 1 ? [to] : [from, to]
}

function advanceWalk(state: AdventureState, distance: number): AdventureState {
  if (!state.walk) return state
  let remaining = distance
  let segmentIndex = state.walk.segmentIndex
  let segmentProgress = state.walk.segmentProgress
  let position = state.rookPosition
  while (remaining > 0 && segmentIndex < state.walk.path.length - 1) {
    const from = state.walk.path[segmentIndex]!
    const to = state.walk.path[segmentIndex + 1]!
    const length = Math.max(1, pointDistance(from, to))
    const left = length * (1 - segmentProgress)
    if (remaining >= left) {
      remaining -= left; position = to; segmentIndex += 1; segmentProgress = 0
    } else {
      segmentProgress += remaining / length; remaining = 0
      position = { x: from.x + (to.x - from.x) * segmentProgress, y: from.y + (to.y - from.y) * segmentProgress }
    }
  }
  const walked = { ...state.walk, segmentIndex, segmentProgress }
  const stepped = segmentIndex >= state.walk.path.length - 1 ? arrive({ ...state, rookPosition: position, walk: walked }) : { ...state, rookPosition: position, walk: walked }
  return watchCabinet(stepped)
}

function advanceSpeech(state: AdventureState): AdventureState {
  if (!state.speech) return state
  const current = state.speech.lines[state.speech.lineIndex]!
  if (state.speech.visibleCharacters < current.text.length) {
    return { ...state, speech: { ...state.speech, visibleCharacters: current.text.length, performance: performanceForLine(current, current.text.length, state.reducedAnimation) } }
  }
  const nextIndex = state.speech.lineIndex + 1
  if (nextIndex < state.speech.lines.length) {
    const nextLine = state.speech.lines[nextIndex]!
    const visibleCharacters = initialVisibleCharacters(nextLine, state.dialogueDisplay, state.instantText)
    const openingPutAway = state.speech.returnTo === 'INTRO' && state.mrIndexPose === 'DOCUMENT' && nextLine.copyKey === 'OPEN-002'
    return { ...state, mrIndexPose: openingPutAway ? 'IDLE' : state.mrIndexPose, speech: { ...state.speech, lineIndex: nextIndex, visibleCharacters, performance: performanceForLine(nextLine, visibleCharacters, state.reducedAnimation) }, transcript: withCurrentTranscript(state, nextLine, 'BLOCKING') }
  }
  if (state.activeSequence?.status === 'WAITING_FOR_SPEECH' && state.activeSequence.waitingSpeechStage) {
    const sequence = SCRIPTED_SEQUENCES.find(({ id }) => id === state.activeSequence!.id)
    const isFinalScriptedAction = Boolean(sequence && state.activeSequence.actionIndex === sequence.actions.length - 1)
    const completed = state.activeSequence.completedSpeechStages.includes(state.activeSequence.waitingSpeechStage)
      ? state.activeSequence.completedSpeechStages
      : [...state.activeSequence.completedSpeechStages, state.activeSequence.waitingSpeechStage]
    if (isFinalScriptedAction) return {
      ...state,
      speech: null,
      activeSequence: null,
      focusReturnTarget: state.activeSequence.focusReturnTarget,
      rookPose: 'IDLE',
      mrIndexPose: 'IDLE',
      arthurPointHold: false,
    }
    return {
      ...state,
      speech: null,
      activeSequence: { ...state.activeSequence, status: 'ACTION_ACTIVE', waitingSpeechStage: null, completedSpeechStages: completed },
    }
  }
  // R4: the note-reading completion contact fires exactly here — the explicit
  // player acknowledgment of the final required line — and only while UNREAD.
  // Instant text reveals instantly but still requires every advancement.
  if (isNoteReadSpeech(state.speech) && state.piggyNoteReadState === 'UNREAD') {
    return { ...state, speech: null, focusReturnTarget: null, dialogueOpen: state.speech.returnTo === 'DIALOGUE', introComplete: state.introComplete || state.speech.returnTo === 'INTRO', rookPose: 'IDLE', mrIndexPose: 'IDLE', arthurPointHold: false, piggyNoteReadState: 'BACK_READ', lastSemanticContact: 'CONTACT.NOTE_BACK_COMPLETE' }
  }
  return { ...state, speech: null, focusReturnTarget: null, dialogueOpen: state.speech.returnTo === 'DIALOGUE', introComplete: state.introComplete || state.speech.returnTo === 'INTRO', openingStage: state.speech.returnTo === 'INTRO' ? 'COMPLETE' : state.openingStage, rookPose: 'IDLE', mrIndexPose: 'IDLE', arthurPointHold: false }
}

function advanceNonblockingSpeech(state: AdventureState): AdventureState {
  if (!state.nonblockingSpeech) return state
  const current = state.nonblockingSpeech.lines[state.nonblockingSpeech.lineIndex]!
  if (state.nonblockingSpeech.visibleCharacters < current.text.length) return { ...state, nonblockingSpeech: { ...state.nonblockingSpeech, visibleCharacters: current.text.length, performance: performanceForLine(current, current.text.length, state.reducedAnimation) } }
  const nextIndex = state.nonblockingSpeech.lineIndex + 1
  if (nextIndex < state.nonblockingSpeech.lines.length) {
    const nextLine = state.nonblockingSpeech.lines[nextIndex]!
    const visibleCharacters = initialVisibleCharacters(nextLine, state.dialogueDisplay, state.instantText)
    return { ...state, nonblockingSpeech: { ...state.nonblockingSpeech, lineIndex: nextIndex, visibleCharacters, performance: performanceForLine(nextLine, visibleCharacters, state.reducedAnimation) }, transcript: withCurrentTranscript(state, nextLine, 'NONBLOCKING') }
  }
  return { ...state, nonblockingSpeech: null, rookPose: 'IDLE' }
}

export function canSkipOpening(state: Pick<AdventureState, 'introComplete' | 'openingStage' | 'introSkipUsed' | 'speech'>) {
  if (state.introComplete || state.openingStage === 'COMPLETE' || state.introSkipUsed) return false
  if (state.speech?.returnTo !== 'INTRO') return true
  // Eligibility belongs to the effective delivery route currently being
  // presented. A source bubble can fan out into multiple delivery identities
  // (for example OPEN-019.delivery-1/2), so looking that delivery up in the
  // unsplit source array incorrectly hides Skip Intro on those lines.
  const landingIndex = state.speech.lines.findIndex((line) => line.copyKey === OPENING_INSTRUCTION_KEYS[0])
  return landingIndex >= 0 && state.speech.lineIndex >= 0 && state.speech.lineIndex < landingIndex
}

function skipOpeningToInstructions(state: AdventureState): AdventureState {
  if (!state.introSkipConfirmationOpen || !canSkipOpening(state)) return state
  const instructionSpeech = speech(EXACT_OPENING_INSTRUCTION_TAIL, 'INTRO', state.instantText, state.reducedAnimation, controlForOutcome('OPENING'), state.dialogueDisplay)
  return {
    ...state,
    introComplete: false,
    openingStage: 'DIALOGUE',
    introSkipConfirmationOpen: false,
    introSkipUsed: true,
    phase: 'START',
    authorizationState: 'PENDING',
    selectedVerb: null,
    selectedItemId: null,
    hoveredHotspotId: null,
    inventory: [],
    rookPosition: ROOK_START,
    rookFacing: 'RIGHT',
    mrIndexFacing: ARTHUR_IDLE_FACING,
    rookPose: 'IDLE',
    mrIndexPose: 'IDLE',
    arthurPointHold: false,
    walk: null,
    activeSequence: null,
    focusReturnTarget: null,
    speech: instructionSpeech,
    nonblockingSpeech: null,
    transcript: withCurrentTranscript(state, EXACT_OPENING_INSTRUCTION_TAIL[0], 'BLOCKING'),
    dialogueOpen: false,
    exhaustedTopics: [],
    dialogueAnnouncement: '',
    interactionRepeats: {},
    lastInteractionId: null,
    lastSequenceId: null,
    lastSemanticContact: null,
    sequenceEvents: [],
    lastSoundIntent: null,
    returnExchangePlayed: false,
    returnTagPlayed: false,
    brcgPayoffPlayed: false,
    evidenceDrawerOpen: false,
    recordArchived: false,
    archivedEvidenceIds: [],
    barksFired: 0,
    inactiveSeconds: 0,
    caseFileDrawer: 'CLOSED',
    miscDrawer: 'CLOSED',
    caseStack: 'UNSEARCHED',
    miscContents: 'UNCOLLECTED',
    piggyNoteReadState: 'UNREAD',
    investigationMilestone: 'BEFORE_Q1',
    brcgInvestigationState: 'UNREAD',
    intentReplacement: null,
    terminalEntryPending: false,
    worldQuiescent: false,
    globePose: 'IDLE',
    globeMotion: 'IDLE',
    globeLevel: 0,
    globeMilestones: 0,
    globeRevision: 0,
    globeElapsedMs: 0,
    globeBoostRemainingMs: 0,
    globeStartPhase: 0,
    globeDecayStage: 'REST',
    lampPower: 'ON',
    lampSpeech: 0,
    lifecycleEpoch: state.lifecycleEpoch + 1,
  }
}

function reduceAdventure(state: AdventureState, action: AdventureAction): AdventureState {
  if (openingWorldIsInert(state) && state.runtimeSession.layoutHash !== null && OPENING_WORLD_ACTIONS.has(action.type)) return state
  switch (action.type) {
    case 'OPEN_INTRO_SKIP_CONFIRMATION':
      if (!canSkipOpening(state)) return state
      return { ...state, introSkipConfirmationOpen: true, lifecycleEpoch: state.lifecycleEpoch + 1 }
    case 'CANCEL_INTRO_SKIP_CONFIRMATION':
      if (!state.introSkipConfirmationOpen) return state
      return { ...state, introSkipConfirmationOpen: false, lifecycleEpoch: state.lifecycleEpoch + 1 }
    case 'SKIP_OPENING_TO_INSTRUCTIONS':
      return skipOpeningToInstructions(state)
    case 'BEGIN_ROOK_ENTRY':
      if (state.openingStage !== 'ARTHUR_PAPER') return state
      return startWalk({ ...state, openingStage: 'ROOK_ENTERING', mrIndexPose: 'DOCUMENT' }, ROOK_START, null)
    case 'SET_DIALOGUE_MODE':
      return { ...state, dialogueMode: action.mode }
    case 'SET_DIALOGUE_PACE':
      return { ...state, dialoguePace: action.pace }
    case 'SET_DIALOGUE_DISPLAY': {
      if (action.display === state.dialogueDisplay) return state
      if (action.display === 'TYPED') return { ...state, dialogueDisplay: action.display }
      const reveal = (active: SpeechState | null) => {
        if (!active) return null
        const line = active.lines[active.lineIndex]!
        const visibleCharacters = initialVisibleCharacters(line, action.display, state.instantText)
        if (visibleCharacters <= active.visibleCharacters) return active
        return { ...active, visibleCharacters, performance: performanceForLine(line, visibleCharacters, state.reducedAnimation) }
      }
      return { ...state, dialogueDisplay: action.display, speech: reveal(state.speech), nonblockingSpeech: reveal(state.nonblockingSpeech) }
    }
    case 'GLOBE_TICK': {
      if (state.globeMotion !== 'SPINNING' || state.globeLevel === 0) return state
      const elapsed = state.globeElapsedMs + action.deltaMs
      const globeBoostRemainingMs = Math.max(0, state.globeBoostRemainingMs - action.deltaMs)
      const totalMs = globeTimelineTotalMs(state.globeLevel)
      const boundedElapsed = Math.min(elapsed, totalMs)
      const snapshot = globeSnapshotAt(state.globePose, state.globeLevel, boundedElapsed, state.globeStartPhase)
      if (elapsed >= totalMs) return { ...state, globeMotion: 'FINAL_HOLD', globeElapsedMs: totalMs, globeBoostRemainingMs: 0, globeDecayStage: 'FINAL_HOLD' }
      return { ...state, globeElapsedMs: boundedElapsed, globeBoostRemainingMs, globeDecayStage: snapshot.decayStage }
    }
    case 'REQUEST_HINT':
      if (state.speech || state.dialogueOpen || state.walk || state.activeSequence || state.worldQuiescent) return state
      { const lines = dialogueTopicsForState(state).find(topic => topic.id === (state.phase === 'COMPLETE' ? 'case-file' : 'form-reminder'))?.lines ?? r55SpeechByEvent('COPY.A1:Repeated explicit reminder'); return { ...placeLines(state, lines, 'OFFICE_HINT') } }
    case 'SELECT_VERB':
      if (state.speech || state.dialogueOpen || state.activeSequence || state.worldQuiescent) return state
      { const previous = state.walk?.pendingInteraction ?? null
        const noted = previous ? noteReplacement(state, previous) : state
        const announced = Boolean(previous) || Boolean(state.walk?.replacementAnnounced)
        return { ...noted, selectedVerb: action.verb, selectedItemId: null, walk: state.walk ? { ...state.walk, pendingInteraction: null, replacementAnnounced: announced } : null } }
    case 'SELECT_ITEM':
      if (state.speech || state.dialogueOpen || state.walk || state.activeSequence || state.worldQuiescent) return state
      if (!state.inventory.includes(action.itemId)) return state
      return { ...state, selectedItemId: action.itemId }
    case 'ACT_ON_ITEM': {
      if (state.speech || state.dialogueOpen || state.walk || state.activeSequence || state.worldQuiescent) return state
      if (!state.inventory.includes(action.itemId)) return state
      if ((state.selectedVerb === 'USE' || state.selectedVerb === 'GIVE') && state.selectedItemId === action.itemId) {
        return { ...state, selectedItemId: null }
      }
      if ((state.selectedVerb === 'USE' || state.selectedVerb === 'GIVE' || state.selectedVerb === 'OPEN') && state.selectedItemId && state.selectedItemId !== action.itemId) {
        const combined = itemRules.find((rule) => rule.verb === state.selectedVerb && itemRuleApplies(rule, state.phase) && ((rule.itemId === state.selectedItemId && rule.targetItemId === action.itemId) || (rule.itemId === action.itemId && rule.targetItemId === state.selectedItemId)))
        if (combined) {
          const mutation = applyRuleMutation(state.phase, state.inventory, combined, state)
          return { ...placeLines({ ...state, phase: mutation.phase, inventory: mutation.inventory }, combined.speech, combined.id), lastInteractionId: `INTERACTION.ITEM.${combined.id}`, lastSequenceId: null, lastSemanticContact: null, rookPose: 'IDLE' }
        }
        if (state.selectedVerb === 'USE') return { ...placeLines(state, inventorySpeechForState(state.selectedItemId, 'USE', state, action.itemId), 'ITEM.INVALID_USE'), lastInteractionId: `INTERACTION.ITEM.invalid-use-${state.selectedItemId}-${action.itemId}` }
      }
      if (state.selectedVerb === 'OPEN' && !state.selectedItemId) {
        const single = itemRules.find((rule) => rule.verb === 'OPEN' && !rule.targetItemId && rule.itemId === action.itemId && itemRuleApplies(rule, state.phase))
        if (single) {
          const mutation = applyRuleMutation(state.phase, state.inventory, single, state)
          return { ...placeLines({ ...state, phase: mutation.phase, inventory: mutation.inventory }, single.speech, single.id), lastInteractionId: `INTERACTION.ITEM.${single.id}`, lastSequenceId: null, lastSemanticContact: null, rookPose: 'IDLE' }
        }
      }
      if (state.selectedVerb === 'USE' && !state.selectedItemId) {
        const singleUse = itemRules.find((rule) => rule.verb === 'USE' && !rule.targetItemId && rule.itemId === action.itemId && itemRuleApplies(rule, state.phase))
        if (singleUse) {
          const mutation = applyRuleMutation(state.phase, state.inventory, singleUse, state)
          return { ...placeLines({ ...state, phase: mutation.phase, inventory: mutation.inventory }, singleUse.speech, singleUse.id), lastInteractionId: `INTERACTION.ITEM.${singleUse.id}`, lastSequenceId: null, lastSemanticContact: null, rookPose: 'IDLE' }
        }
      }
      if (state.selectedVerb === 'USE' || state.selectedVerb === 'GIVE') return { ...state, selectedItemId: action.itemId }
      if (action.itemId === 'fictional-token-note' && state.selectedVerb === 'LOOK_AT' && state.piggyNoteReadState === 'UNREAD' && state.lastInteractionId !== 'INTERACTION.ITEM.look-fictional-token-note') return beginNoteRead(state)
      if (state.selectedVerb === 'LOOK_AT' || state.selectedVerb === 'OPEN' || state.selectedVerb === 'CLOSE' || state.selectedVerb === 'PUSH' || state.selectedVerb === 'PULL' || state.selectedVerb === 'TALK_TO') {
        const verbId = state.selectedVerb === 'LOOK_AT' ? 'look' : state.selectedVerb.toLowerCase()
        // Inventory observations are verbal commentary, not physical world
        // inspections. Keep Rook neutral unless a bounded scripted passage
        // (for example the small note read) explicitly owns a prop pose.
        return { ...placeLines({ ...state, rookPose: 'IDLE' }, inventorySpeechForState(action.itemId, state.selectedVerb, state), 'ITEM.LOOK'), lastInteractionId: `INTERACTION.ITEM.${verbId}-${action.itemId}` }
      }
      // Clicking an already-owned inventory object with PICK UP (or with no
      // actionable combination verb) is a completed no-op, not a hidden armed
      // source item. Clear both halves of the command explicitly.
      return { ...state, selectedVerb: null, selectedItemId: null }
    }
    case 'HOVER_HOTSPOT':
      return { ...state, hoveredHotspotId: action.hotspotId }
    case 'WALK_TO': {
      if (state.activeSequence || state.speech || state.dialogueOpen || state.worldQuiescent) return state
      const to = clampWalk(action.point)
      return startWalk(state, to, action.pendingInteraction ?? null)
    }
    case 'WALK_TICK':
      if (state.worldQuiescent) return state
      return advanceWalk(state, action.delta)
    case 'INTERACT': {
      if (!state.selectedVerb || state.speech || state.dialogueOpen || state.activeSequence || state.worldQuiescent) return state
      const hotspot = hotspots.find(({ id }) => id === action.targetId)
      if (!hotspot) return state
      const pending: PendingInteraction = { verb: state.selectedVerb, targetId: action.targetId, itemId: state.selectedItemId }
      const committedState = state.nonblockingSpeech ? { ...state, nonblockingSpeech: null, lifecycleEpoch: state.lifecycleEpoch + 1 } : state
      if ((pending.verb === 'LOOK_AT' || pending.verb === 'TALK_TO') && !pending.itemId) {
        const live = committedState.runtimeSession.targets[hotspot.id]
        if (live && !live.visible) return { ...committedState, selectedVerb: null, selectedItemId: null }
        const center = live?.visible ? { x: live.centerX, y: live.centerY } : hotspot.walkTo
        const faced = facePoint(committedState, center.x)
        const closeDrawerLook = pending.verb === 'LOOK_AT' && DRAWER_CLOSE_LOOK_TARGETS.has(hotspot.id)
        const dialogueStand = pending.verb === 'TALK_TO' && pending.targetId === 'mr-index' ? arthurDialogueStand(committedState) : null
        const stand = dialogueStand ?? (closeDrawerLook
          ? approachPoint(committedState, hotspot, committedState.rookPosition.x)
          : lookStand(committedState.rookPosition, center, lookRangeFor(committedState, hotspot.id)))
        if (closeDrawerLook && stand && stand.x === committedState.rookPosition.x && stand.y === committedState.rookPosition.y) {
          const noted = faced.walk?.pendingInteraction ? noteReplacement(faced, faced.walk.pendingInteraction) : faced
          return applyInteraction({ ...noted, walk: null }, pending)
        }
        if (!stand) {
          const noted = faced.walk?.pendingInteraction ? noteReplacement(faced, faced.walk.pendingInteraction) : faced
          return applyInteraction({ ...noted, walk: null }, pending)
        }
        return startWalk(faced, stand, pending)
      }
      if (!requiresProximity(pending)) {
        const noted = committedState.walk?.pendingInteraction ? noteReplacement(committedState, committedState.walk.pendingInteraction) : committedState
        return applyInteraction({ ...noted, walk: null }, pending)
      }
      return startWalk(committedState, interactionApproachPoint(committedState, hotspot, committedState.rookPosition.x, pending), pending)
    }
    case 'ADVANCE_SEQUENCE':
      if (state.worldQuiescent) return state
      return advanceSequence(state)
    case 'PLAY_FORM_BARK': {
      // R1: eligibility thresholds are enforced here as well as in the host
      // effect, so hidden/unfocused time (never counted) cannot trigger a bark.
      const need = state.barksFired === 0 ? BARK_1_AFTER_S : BARK_2_AFTER_S
      if (state.inactiveSeconds < need) return state
      if (!state.introComplete || state.phase === 'COMPLETE' || state.barksFired >= 2 || state.speech || state.dialogueOpen || state.walk || state.activeSequence || state.nonblockingSpeech || state.worldQuiescent) return state
      const lines = r55SpeechByEvent('COPY.A1:9. Ambient reminders').slice(state.barksFired, state.barksFired + 1)
      return { ...state, barksFired: state.barksFired + 1, nonblockingSpeech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('FORM_BARK'), state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'NONBLOCKING') }
    }
    case 'IDLE_TICK': {
      if (!action.foreground || state.worldQuiescent) return state
      if (state.speech || state.nonblockingSpeech || state.dialogueOpen || state.walk || state.activeSequence) return state
      return { ...state, inactiveSeconds: state.inactiveSeconds + 1 }
    }
    case 'CANCEL_SELECTION':
      if (state.activeSequence) return state
      return { ...state, selectedVerb: null, selectedItemId: null, hoveredHotspotId: null, walk: state.walk ? { ...state.walk, pendingInteraction: null } : null }
    case 'REVEAL_TICK': {
      if (state.worldQuiescent) return state
      const key = action.channel === 'NONBLOCKING' ? 'nonblockingSpeech' : 'speech'
      const active = state[key]
      if (!active) return state
      const line = active.lines[active.lineIndex]!
      const visibleCharacters = Math.min(line.text.length, active.visibleCharacters + action.characters)
      return { ...state, [key]: { ...active, visibleCharacters, performance: performanceForLine(line, visibleCharacters, state.reducedAnimation) } }
    }
    case 'REVEAL_FULL': {
      if (state.worldQuiescent) return state
      const key = action.channel === 'NONBLOCKING' ? 'nonblockingSpeech' : 'speech'
      const active = state[key]
      if (!active) return state
      const line = active.lines[active.lineIndex]!
      return { ...state, [key]: { ...active, visibleCharacters: line.text.length, performance: performanceForLine(line, line.text.length, state.reducedAnimation) } }
    }
    case 'ADVANCE_SPEECH':
      if (state.worldQuiescent) return state
      return action.channel === 'NONBLOCKING' ? advanceNonblockingSpeech(state) : advanceSpeech(state)
    case 'CHOOSE_DIALOGUE_TOPIC': {
      const topic = dialogueTopicsForState(state).find(({ id }) => id === action.topicId)
      if (!topic) return state
      if (topic.closes) {
        const closed = closeDialogue(state)
        return {
          ...closed,
          focusReturnTarget: 'mr-index',
          lastInteractionId: `DIALOGUE.${topic.id}`,
          speech: speech(topic.lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('DIALOGUE_TOPIC'), state.dialogueDisplay),
          transcript: withCurrentTranscript(state, topic.lines[0], 'BLOCKING'),
        }
      }
      const exhaustedTopics = topic.id === 'form-reminder' || state.exhaustedTopics.includes(topic.id) ? state.exhaustedTopics : [...state.exhaustedTopics, topic.id]
      const topicsRemaining = dialogueTopicsForState({ ...state, exhaustedTopics }).filter((entry) => !entry.closes && entry.id !== 'form-reminder').length
      return {
        ...state,
        dialogueOpen: false,
        exhaustedTopics,
        dialogueAnnouncement: `Topic completed. ${topicsRemaining} topics remain.`,
        lastInteractionId: `DIALOGUE.${topic.id}`,
        speech: speech(topic.lines, 'DIALOGUE', state.instantText, state.reducedAnimation, controlForOutcome('DIALOGUE_TOPIC'), state.dialogueDisplay),
        transcript: withCurrentTranscript(state, topic.lines[0], 'BLOCKING'),
      }
    }
    case 'CLOSE_DIALOGUE':
      return closeDialogue(state)
    case 'RETURN_FROM_COMPLETED_CASE': {
      if (state.phase !== 'COMPLETE' || state.returnExchangePlayed) return state
      const lines = [...R55_ENDING_UNIVERSAL, ...(action.brcgResolved == null ? [] : action.brcgResolved ? R55_ENDING_BRCG : R55_ENDING_DEFAULT)]
      return { ...state, returnExchangePlayed: true, walk: null, speech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('RETURN_EXCHANGE'), state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'BLOCKING') }
    }
    case 'PLAY_RETURN_TAG': {
      if (!state.returnExchangePlayed || state.returnTagPlayed || state.speech || state.walk || state.activeSequence || state.dialogueOpen || state.worldQuiescent) return state
      const lines = r55SpeechByEvent('COPY.REPEAT:6. Re-entering the terminal')
      return { ...state, returnTagPlayed: true, speech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('RETURN_TAG'), state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'BLOCKING') }
    }
    case 'PLAY_BRCG_PAYOFF': {
      if (state.brcgPayoffPlayed || state.speech || state.walk || state.activeSequence || state.dialogueOpen || state.worldQuiescent) return state
      const lines = [...R55_BRCG_PAYOFF]
      return { ...state, brcgPayoffPlayed: true, speech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('RETURN_EXCHANGE'), state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'BLOCKING') }
    }
    case 'SYNC_INVESTIGATION_CONTEXT':
      if (state.investigationMilestone === action.milestone && state.brcgInvestigationState === action.brcg) return state
      return { ...state, investigationMilestone: action.milestone, brcgInvestigationState: action.brcg }
    case 'TOGGLE_EVIDENCE_DRAWER':
      return { ...state, evidenceDrawerOpen: !state.evidenceDrawerOpen }
    case 'TOGGLE_REDUCED_ANIMATION': {
      const reducedAnimation = !state.reducedAnimation
      if (reducedAnimation && state.walk) return arrive({ ...state, reducedAnimation })
      const speechState = state.speech ? { ...state.speech, performance: performanceForLine(state.speech.lines[state.speech.lineIndex]!, state.speech.visibleCharacters, reducedAnimation) } : null
      const nonblockingSpeech = state.nonblockingSpeech ? { ...state.nonblockingSpeech, performance: performanceForLine(state.nonblockingSpeech.lines[state.nonblockingSpeech.lineIndex]!, state.nonblockingSpeech.visibleCharacters, reducedAnimation) } : null
      return { ...state, reducedAnimation, speech: speechState, nonblockingSpeech }
    }
    case 'SET_DIALOGUE_PRESENTATION':
      return { ...state, dialoguePresentation: action.mode }
    case 'TOGGLE_INSTANT_TEXT': {
      const instantText = !state.instantText
      if (!instantText) return { ...state, instantText }
      const speechState = state.speech ? { ...state.speech, visibleCharacters: state.speech.lines[state.speech.lineIndex]!.text.length, performance: performanceForLine(state.speech.lines[state.speech.lineIndex]!, state.speech.lines[state.speech.lineIndex]!.text.length, state.reducedAnimation) } : null
      const nonblockingSpeech = state.nonblockingSpeech ? { ...state.nonblockingSpeech, visibleCharacters: state.nonblockingSpeech.lines[state.nonblockingSpeech.lineIndex]!.text.length, performance: performanceForLine(state.nonblockingSpeech.lines[state.nonblockingSpeech.lineIndex]!, state.nonblockingSpeech.lines[state.nonblockingSpeech.lineIndex]!.text.length, state.reducedAnimation) } : null
      return { ...state, instantText, speech: speechState, nonblockingSpeech }
    }
    case 'TOGGLE_HOTSPOT_CONTRAST':
      return { ...state, highContrastHotspots: !state.highContrastHotspots }
    case 'TOGGLE_REVIEW_HOTSPOTS':
      return { ...state, reviewHotspots: !state.reviewHotspots }
    case 'REVIEW_JUMP':
      return { ...createInitialAdventureState({ skipIntro: true, session: state.runtimeSession, accessibility: accessibilityPreferences(state), dialogue: { mode: state.dialogueMode, pace: state.dialoguePace, display: state.dialogueDisplay } }), phase: action.phase, authorizationState: action.phase === 'COMPLETE' ? 'APPROVED' : 'PENDING', inventory: inventoryForPhase(action.phase), recordArchived: false, archivedEvidenceIds: [], reviewHotspots: state.reviewHotspots, runtimeSession: state.runtimeSession, lifecycleEpoch: state.lifecycleEpoch + 1 }
    case 'REVIEW_TALKING':
      { const lines = [{ speaker: 'ROOK', text: 'Talking animation review.' }, { speaker: 'MR_INDEX', text: 'Talking animation review.' }] as SpeechLine[]; return { ...state, dialogueOpen: false, mrIndexFacing: ARTHUR_IDLE_FACING, speech: speech(lines, 'SCENE', false, state.reducedAnimation, controlForOutcome('REVIEW_TALKING'), state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'BLOCKING') } }
    case 'ACK_INTENT_REPLACEMENT':
      if (!state.intentReplacement || state.intentReplacement.id !== action.id) return state
      return { ...state, intentReplacement: null }
    case 'REQUEST_TERMINAL_ENTRY': {
      if (!terminalCanOpen(state) || state.speech || state.dialogueOpen || state.activeSequence || state.worldQuiescent || state.terminalEntryPending) return state
      const terminal = hotspots.find((hotspot) => hotspot.id === 'nansen-terminal')!
      const pending: PendingInteraction = { verb: 'USE', targetId: 'nansen-terminal', itemId: null }
      if (state.walk && sameIntent(state.walk.pendingInteraction, pending)) return state
      let base = state
      if (state.walk) {
        base = state.walk.pendingInteraction ? noteReplacement(state, state.walk.pendingInteraction) : emitReplacement(state)
        base = { ...base, walk: null }
      }
      const terminalPoint = approachPoint(base, terminal, base.rookPosition.x)
      if (!base.walk && base.rookPosition.x === terminalPoint.x && base.rookPosition.y === terminalPoint.y) return commitTerminalEntry(base)
      return startWalk(base, terminalPoint, pending)
    }
    case 'ACK_TERMINAL_PRESENTATION':
      if (!state.terminalEntryPending) return state
      return { ...state, terminalEntryPending: false, rookPose: 'IDLE' }
    case 'CLOSE_TERMINAL':
      return { ...state, worldQuiescent: false, terminalEntryPending: false, walk: null }
    case 'ENTER_TERMINAL':
      return commitTerminalEntry(state)
    case 'APPLY_CONTROL_FIXTURE': {
      if (action.fixture === 'POST_SOLVE_STAGED') {
        const lines = r55SpeechByEvent('COPY.END:3. Friendship and pizza continuation')
        return { ...state, walk: null, dialogueOpen: false, speech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome('POST_SOLVE_STAGED'), state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'BLOCKING') }
      }
      if (action.fixture === 'ROOK_BLOCKING_BEAT') {
        const lines = r55SpeechByEvent('COPY.BACKGROUND:Global rules')
        return { ...placeLines(state, lines, 'FIXTURE.ROOK_BLOCKING_BEAT') }
      }
      const eventKey = action.fixture === 'PREBRIEF_EVIDENCE_SEA' ? 'COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead' : action.fixture === 'VOLUNTARY_EARLY_EXIT' ? 'COPY.A1:6. Exit topic' : 'COPY.END:4.1 Default ending — BRCG not completed'
      const lines = r55SpeechByEvent(eventKey)
      return { ...state, nonblockingSpeech: speech(lines, 'SCENE', state.instantText, state.reducedAnimation, controlForOutcome(eventKey), state.dialogueDisplay), transcript: withCurrentTranscript(state, lines[0], 'NONBLOCKING') }
    }
    case 'RESET':
      return {
        ...createInitialAdventureState({ session: state.runtimeSession, accessibility: accessibilityPreferences(state), dialogue: { mode: state.dialogueMode, pace: state.dialoguePace, display: state.dialogueDisplay } }),
        runtimeSession: state.runtimeSession,
        lifecycleEpoch: state.lifecycleEpoch + 1,
      }
  }
}

const QUIET_ACTIONS: ReadonlySet<string> = new Set(['IDLE_TICK', 'PLAY_FORM_BARK', 'REVEAL_TICK', 'REVEAL_FULL', 'WALK_TICK', 'GLOBE_TICK', 'HOVER_HOTSPOT'])
export function adventureReducer(state: AdventureState, action: AdventureAction): AdventureState {
  if (state.introSkipConfirmationOpen && action.type !== 'CANCEL_INTRO_SKIP_CONFIRMATION' && action.type !== 'SKIP_OPENING_TO_INSTRUCTIONS') return state
  const next = reduceAdventure(state, action)
  if (QUIET_ACTIONS.has(action.type)) return next
  return { ...next, inactiveSeconds: 0 }
}

export function currentSpeechLine(state: AdventureState) {
  if (!state.speech) return null
  return state.speech.lines[state.speech.lineIndex] ?? null
}

/** One production owner for blocking/nonblocking speaker-turn mouth activity. */
export function speakerTurnOwner(state: Pick<AdventureState, 'speech' | 'nonblockingSpeech'>): SpeechLine['speaker'] | 'NONE' {
  const active = state.speech ?? state.nonblockingSpeech
  return active?.lines[active.lineIndex]?.speaker ?? 'NONE'
}
export function isTalking(state: AdventureState, speaker: 'ROOK' | 'MR_INDEX') {
  return speakerTurnOwner(state) === speaker
}
export function revealedSpeaker(state: AdventureState): SpeechLine['speaker'] | 'NONE' {
  return speakerTurnOwner(state)
}

export function phaseReached(state: AdventureState, phase: PuzzlePhase) {
  return PHASE_ORDER.indexOf(state.phase) >= PHASE_ORDER.indexOf(phase)
}

/** Latest Principal authority: the approved-form return receipt powers the terminal once. */
export function terminalIsPowered(state: Pick<AdventureState, 'inventory'>) {
  return state.inventory.includes('approved-stamped-terminal-authorization-form')
}
export function terminalIsAuthorized(state: Pick<AdventureState, 'authorizationState'>) {
  return state.authorizationState === 'APPROVED'
}
export function terminalCanOpen(state: Pick<AdventureState, 'authorizationState' | 'phase' | 'inventory'>) {
  return terminalIsPowered(state) && terminalIsAuthorized(state) && state.phase === 'COMPLETE'
}

export function interactionFor(state: AdventureState, targetId: HotspotId) {
  return state.selectedVerb ? { verb: state.selectedVerb, targetId, itemId: state.selectedItemId } : null
}

export function pointDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
