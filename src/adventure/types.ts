export const VERBS = ['GIVE', 'PICK_UP', 'USE', 'OPEN', 'LOOK_AT', 'PUSH', 'CLOSE', 'TALK_TO', 'PULL'] as const
export type VerbId = typeof VERBS[number]
export type PuzzlePhase = 'START' | 'FORM_HELD' | 'PEN_HELD' | 'FORM_AND_PEN' | 'FORM_COMPLETED' | 'FORM_SUBMITTED' | 'COMPLETE'
export type HotspotId = 'mr-index' | 'request-dispenser' | 'pen-stand' | 'official-case-file-cabinet' | 'miscellaneous-drawer-cabinet' | 'disorderly-stack-of-confidential-files' | 'miscellaneous-catch-all-contents' | 'nansen-terminal' | 'filing-drawers' | 'historical-clock' | 'office-globe' | 'window' | 'coffee-mug' | 'desk-lamp' | 'tall-books' | 'book-shelf' | 'arthur-stamp' | 'blank-authorization-form' | 'wall-clock' | 'wall-be-the-change' | 'wall-think-outside' | 'wall-employee' | 'wall-city-bridge' | 'wall-building' | 'wall-preserve' | 'wall-records-sign' | 'wall-not-a-number'
export type InventoryItemId = 'blank-terminal-authorization-form' | 'loose-feather-pen' | 'signed-terminal-authorization-form-with-doodles' | 'broken-feather-pen' | 'approved-stamped-terminal-authorization-form' | 'euler-case-file' | 'rubber-band' | 'rubiks-cube' | 'sharknado-2-vhs' | 'piggy-bank-intact' | 'small-toolbox-closed' | 'small-toolbox-open-empty' | 'hammer' | 'nails' | 'fictional-token-note'
export type SceneId = 'records-office' | 'blank-shell'
export interface Point { x: number; y: number }
export interface Hotspot { id: HotspotId; name: string; polygon: string; walkTo: Point; tags: string[]; visibleFrom: PuzzlePhase; ariaLabel: string }
export interface SceneDefinition { id: SceneId; label: string; playable: boolean; walkRegion: { id: string; polygon: string }; hotspotGeometryId: string; hotspots: Hotspot[]; hooks: { onEnter: string; onExit: string } }
export interface InventoryItem { id: InventoryItemId; name: string; description: string; assetSlot: string }
export type ControlClass = 'PLAYER_CONTROLLED' | 'WALK_PENDING_REPLACEABLE' | 'BLOCKING_ACTION' | 'BLOCKING_WORLD_DIALOGUE' | 'BLOCKING_CUTSCENE' | 'NONBLOCKING_SELF_TALK'
export type InterfaceTreatment = 'ACTIVE' | 'INERT_VISIBLE' | 'BLACKOUT'
export interface IntentReplacementEvent { id: number; copyKey: string; text: string }
export type SpeechActor = 'ROOK' | 'MR_INDEX' | 'TERMINAL' | 'SYSTEM'
export type PerformanceActor = 'ROOK' | 'ARTHUR' | 'TERMINAL' | 'SYSTEM'
export type PerformanceTrackId = 'FACE' | 'GAZE' | 'BODY' | 'PROP' | 'VOICE_TEXT' | 'TIME'
export interface R55PerformanceCue {
  cueId: string
  actor: 'rook' | 'arthur' | null
  intent: string
  selectedClip: string | null
  /** Defaults to LINE_START. AFTER_SPEECH keeps the normal talking pose until the voiced delivery ends. */
  activation?: 'LINE_START' | 'AFTER_SPEECH'
  fallback: boolean
  fallbackReason: string | null
  supportedTrack: PerformanceTrackId | null
}
export interface R55SpeechSource {
  eventKey: string
  nodeId: string
  ledgerId: string
  source: { path: string; byteStart: number; byteEnd: number; lineStart: number; lineEnd: number }
  sourceHashes: { memberSha256: string; rawSha256: string; displaySha256: string }
}
export interface SpeechEmphasis { start: number; end: number }
export interface FinalScriptSpeechSource { eventKey: string; sourceRecordId: string; sourceNodeId: string; sourceOrder: number; effectiveAction: string; source: string }
export interface SpeechLine { speaker: SpeechActor; text: string; copyKey?: string; sourceText?: string; sourceCopyKey?: string; r55Source?: R55SpeechSource; finalScriptSource?: FinalScriptSpeechSource; performanceCues?: readonly R55PerformanceCue[]; emphasis?: readonly SpeechEmphasis[]; deliveryParts?: readonly string[]; literalMarkup?: boolean; beatBeforeMs?: number; beatAfterMs?: number; authority?: 'PRINCIPAL_PLAYTEST_1_FEEDBACK' | 'FINAL_SCRIPT_RECONCILIATION' | 'PRINCIPAL_S17_DELTA' | 'FINAL_APPROVED_FALLBACK_CONTRACT' }
export type DialogueMode = 'AUTO' | 'MANUAL'
export type DialoguePace = 'SLOW' | 'NORMAL' | 'FAST'
export type DialogueDisplay = 'FULL' | 'TYPED'
export type OpeningStage = 'ARTHUR_PAPER' | 'ROOK_ENTERING' | 'DIALOGUE' | 'COMPLETE'
export type RookPose = 'IDLE' | 'INSPECT' | 'REACH' | 'USE_GIVE'
export type MrIndexPose = 'IDLE' | 'STAMP' | 'DOCUMENT' | 'RECEIVE'
export type PhysicalPoseClass = 'EMPTY_HAND_REACH' | 'ITEM_REACH' | 'PAPER_REACH' | 'DOCUMENT_REVIEW' | 'STAMP_USE' | 'IDLE' | 'NO_REACH'
export type PhysicalPropKey = 'FORM_PAPER' | 'DESK_STAMP'
export type PhysicalPropOwner = 'ROOK_INVENTORY' | 'ROOK_VISIBLE' | 'ARTHUR_VISIBLE' | 'ROOK_APPROVED_INVENTORY' | 'DESK' | 'ARTHUR_IN_USE'
export type AuthorizationState = 'PENDING' | 'APPROVED'
export type SequenceSpeechStage =
  | 'FORM_REVIEW'
  | 'POST_STAMP_AUTHORIZATION'
  | 'BLOCKED_REPRIMAND'
  | 'CASEFILE_SEARCH'
  | 'CASEFILE_RECITATION'
  | 'DRAWER_RUBBER_BAND'
  | 'DRAWER_RUBIKS_CUBE'
  | 'DRAWER_VHS'
  | 'DRAWER_PIGGY_BANK'
  | 'DRAWER_TOOLBOX'
  | 'PRESERVE_PRE_REACH'
  | 'PRESERVE_POST_REACH'
export interface PhysicalPoseDirective {
  actor?: 'ROOK' | 'ARTHUR'
  poseClass: PhysicalPoseClass
  releaseActors?: readonly ('ROOK' | 'ARTHUR')[]
  propOwners?: Partial<Record<PhysicalPropKey, PhysicalPropOwner>>
}
export interface LivePerformanceState {
  copyKey: string | null
  actor: PerformanceActor
  crossedCueIds: string[]
  intentions: Partial<Record<PerformanceActor, Partial<Record<PerformanceTrackId, string>>>>
  activeActor: PerformanceActor
  afterLineHold: boolean
  reducedMotion: boolean
}
export interface SpeechState { lines: SpeechLine[]; lineIndex: number; visibleCharacters: number; returnTo: 'SCENE' | 'DIALOGUE' | 'INTRO'; performance: LivePerformanceState; control?: ControlClass }
export interface TranscriptEntry extends SpeechLine { channel: 'BLOCKING' | 'NONBLOCKING'; sequence: number }
export interface SequenceEvent {
  sequenceId: string
  actionId: string
  actor: 'ROOK' | 'ARTHUR' | null
  receiver: 'ROOK' | 'ARTHUR' | null
  semanticIntention: string | null
  receiverIntention: string | null
  selectedVerb: VerbId | null
  poseClass: PhysicalPoseClass | null
  semanticContact: string | null
  visiblePropOwner: PhysicalPropOwner | null
  mutationTiming: 'NONE' | 'CONTACT' | 'HANDOFF' | 'APPROVAL_COMMIT' | 'RETURN'
  mutationApplied: boolean
  inventoryBefore: InventoryItemId[]
  inventoryAfter: InventoryItemId[]
  phaseBefore: PuzzlePhase
  phaseAfter: PuzzlePhase
}
export interface ActiveSequenceState {
  id: string
  originInteractionId: string
  selectedVerb: VerbId | null
  actionIndex: number
  status: 'READY' | 'ACTION_ACTIVE' | 'WAITING_FOR_SPEECH'
  reservedParticipants: Array<'ROOK' | 'ARTHUR'>
  reservedProps: string[]
  currentStage: string | null
  currentActionId: string | null
  currentSemanticContact: string | null
  currentPhysicalPoseClass: PhysicalPoseClass | null
  currentPropOwners: Partial<Record<PhysicalPropKey, PhysicalPropOwner>>
  currentActorIntentions: Partial<Record<'ROOK' | 'ARTHUR', string>>
  currentCaptionIntention: string | null
  currentSoundIntention: string | null
  pendingStateChangeRule: string
  stateChangeOccurred: boolean
  handoverOccurred: boolean
  focusReturnTarget: HotspotId
  pendingSpeech: SpeechLine[]
  waitingSpeechStage: SequenceSpeechStage | null
  completedSpeechStages: SequenceSpeechStage[]
}
export interface PendingInteraction { verb: VerbId; targetId: HotspotId; itemId: InventoryItemId | null }
export interface WalkState { from: Point; to: Point; path: Point[]; segmentIndex: number; segmentProgress: number; pendingInteraction: PendingInteraction | null; replacementAnnounced?: boolean }
export interface RuntimeTargetGeometry {
  centerX: number
  centerY: number
  left: number
  width: number
  footY: number
  visible: boolean
  approachLeft?: number
  approachRight?: number
  lookRange?: number
}

/** Immutable scene geometry for one play session. The reducer never reloads it from the browser. */
export interface RuntimeSessionConfig {
  layoutHash: string | null
  arthurCenterX: number | null
  targets: Readonly<Record<string, RuntimeTargetGeometry>>
}

export interface AdventureState {
  sceneId: SceneId; introComplete: boolean; openingStage: OpeningStage; introSkipConfirmationOpen: boolean; introSkipUsed: boolean; dialogueMode: DialogueMode; dialoguePace: DialoguePace; dialogueDisplay: DialogueDisplay; phase: PuzzlePhase; authorizationState: AuthorizationState; selectedVerb: VerbId | null; selectedItemId: InventoryItemId | null; hoveredHotspotId: HotspotId | null; inventory: InventoryItemId[]; rookPosition: Point; rookFacing: 'LEFT' | 'RIGHT'; rookPose: RookPose; mrIndexPose: MrIndexPose; arthurPointHold: boolean; walk: WalkState | null; activeSequence: ActiveSequenceState | null; focusReturnTarget: HotspotId | null; speech: SpeechState | null; nonblockingSpeech: SpeechState | null; transcript: TranscriptEntry[]; dialogueOpen: boolean; exhaustedTopics: string[]; dialogueAnnouncement: string; interactionRepeats: Record<string, number>; lastInteractionId: string | null; lastSequenceId: string | null; lastSemanticContact: string | null; sequenceEvents: SequenceEvent[]; lastSoundIntent: string | null; returnExchangePlayed: boolean; returnTagPlayed: boolean; brcgPayoffPlayed: boolean; evidenceDrawerOpen: boolean; recordArchived: boolean; archivedEvidenceIds: string[]; reducedAnimation: boolean; instantText: boolean; highContrastHotspots: boolean; reviewHotspots: boolean; barksFired: number; inactiveSeconds: number; caseFileDrawer: DrawerOpenState; miscDrawer: DrawerOpenState; caseStack: CaseStackState; miscContents: MiscContentsState; piggyNoteReadState: PiggyNoteReadState; investigationMilestone: InvestigationMilestone; brcgInvestigationState: BrcgInvestigationState; dialoguePresentation: 'FULLSCREEN_CRT' | 'DOCKED_OVERLAY' | 'PLAIN_LIST'; mrIndexFacing: 'LEFT' | 'RIGHT'; intentReplacement: IntentReplacementEvent | null; intentReplacementSeq: number; terminalEntryPending: boolean; worldQuiescent: boolean; globePose: 'IDLE' | 'PUSH' | 'PULL'; globeMotion: 'IDLE' | 'SPINNING' | 'FINAL_HOLD'; globeLevel: 0 | 1 | 2 | 3; globeMilestones: number; globeRevision: number; globeElapsedMs: number; globeBoostRemainingMs: number; globeStartPhase: number; globeDecayStage: 'REST' | 'LEVEL_3' | 'LEVEL_2' | 'LEVEL_1' | 'TRICKLE' | 'FINAL_HOLD'; lampPower: 'ON' | 'OFF'; lampSpeech: 0 | 1 | 2; runtimeSession: RuntimeSessionConfig; lifecycleEpoch: number
}
export interface InteractionRuleHandover { contact: string; removeItems: InventoryItemId[]; nextPhase: PuzzlePhase }
export type DrawerId = 'caseFileDrawer' | 'miscDrawer'
export type DrawerOpenState = 'OPEN' | 'CLOSED'
export type CaseStackState = 'UNSEARCHED' | 'SEARCHED_EULER_REMOVED'
export type MiscContentsState = 'UNCOLLECTED' | 'COLLECTED_GUM_REMAINS'
// R4: explicit piggy-note read milestone. Acquiring the note and queuing the
// reading leave UNREAD; only the final required acknowledgment of the
// note-reading speech sets BACK_READ.
export type PiggyNoteReadState = 'UNREAD' | 'BACK_READ'
export type InvestigationMilestone = 'BEFORE_Q1' | 'AFTER_Q1' | 'AFTER_Q2' | 'EXACT_RECEIPT' | 'PROOF_COMPLETE'
export type BrcgInvestigationState = 'UNREAD' | 'UNTESTED' | 'RESOLVED'
export interface DrawerRequirement { drawer: DrawerId; is: DrawerOpenState }
export interface ContactGrant { contact: string; addItems: InventoryItemId[] }
export interface InteractionRule { id: string; verb: VerbId; targetId: HotspotId; itemId?: InventoryItemId; phase: PuzzlePhase | 'ANY'; nextPhase: PuzzlePhase | null; removeItem?: InventoryItemId; removeItems?: InventoryItemId[]; addItem?: InventoryItemId; addItems?: InventoryItemId[]; handover?: InteractionRuleHandover; speech: SpeechLine[]; evidenceId?: string; requiresDrawer?: DrawerRequirement; requiresStack?: CaseStackState; requiresMisc?: MiscContentsState; setCaseFileDrawer?: DrawerOpenState; setMiscDrawer?: DrawerOpenState; contactGrants?: ContactGrant[]; drawerStateAfter?: { caseStack?: CaseStackState; miscContents?: MiscContentsState } }
// Inventory-level rules (item-on-item combines and single-item transformations such as
// opening the toolbox). Matched order-independently in ACT_ON_ITEM; phases lists the
// exact phases where the rule may fire ('ANY' = every phase). nextPhase null keeps phase.
export interface ItemRule { id: string; verb: VerbId; itemId: InventoryItemId; targetItemId?: InventoryItemId; phases: PuzzlePhase | 'ANY' | readonly PuzzlePhase[]; nextPhase: PuzzlePhase | null; removeItems: InventoryItemId[]; addItems: InventoryItemId[]; speech: SpeechLine[] }
// Explicit lossless refusals checked before useful rules. No mutation, no phase change.
export interface BlockedInteraction { verb: VerbId; targetId: HotspotId; itemId: InventoryItemId; copyKey: string; text: string; speech?: SpeechLine[] }
export interface DialogueTopic { id: string; label: string; lines: SpeechLine[]; closes?: boolean }
export interface ArtAsset { src: string; width: number; height: number }
export interface AnimationArt { frames: ArtAsset[]; frameWidth: number; frameHeight: number; fps: number; loop: boolean; mirrorHorizontal?: boolean; frameDurationsMs?: number[] }
export interface CharacterArt { anchor: Point; scale: number; mirrorHorizontal: boolean; animations: Record<string, AnimationArt> }
export interface ArtLayer { id: string; asset: ArtAsset; depth: number }
export interface DepthBand { id: string; minY: number; maxY: number; zIndex: number }
export interface PropPlacement { propId: string; x: number; y: number; depthBand: string }
export interface SceneArt { background: ArtAsset; midgroundLayers: ArtLayer[]; foregroundLayers: ArtLayer[]; walkRegionId: string; hotspotGeometryId: string; depthBands: DepthBand[]; propPlacements: PropPlacement[]; characterAnchors: Record<string, Point> }
export interface PropArt { default: ArtAsset; states: Record<string, ArtAsset> }
export type ArtPackStatus = 'PROVISIONAL_PLACEHOLDER' | 'LEAD_SELECTED'
export type ArtMode = 'LOW_RES_ILLUSTRATED' | 'PIXEL_INSPIRED' | 'HIGH_RES_ILLUSTRATED_DOWNSAMPLED'
export interface ArtPackManifest {
  schemaVersion: '2.0.0'; id: string; label: string; status: ArtPackStatus; artMode: ArtMode; nativeResolution: { width: 480; height: 270; sceneHeight: 180; interfaceHeight: 90 }; browserResolution: { width: 960; height: 540; sceneHeight: 360; interfaceHeight: 180 }; scalingMode: 'NEAREST_NEIGHBOR'; palette: string[]; scenes: Record<SceneId, SceneArt>; characters: { rook: CharacterArt; mrIndex: CharacterArt }; props: Record<string, PropArt>; inventory: Record<InventoryItemId, ArtAsset>; cursor: { crosshair: ArtAsset }
}
export interface ArtPackIndexEntry { id: string; label: string; status: ArtPackStatus | 'AUDITION_EMPTY' }
export interface ArtPackIndex { schemaVersion: '1.0.0'; packs: ArtPackIndexEntry[] }
export type ArtPackAssetStatus = 'PASS' | 'INHERITED_PLACEHOLDER' | 'OPTIONAL_ABSENT' | 'MISSING' | 'DECODE_FAILED' | 'DIMENSION_MISMATCH' | 'DUPLICATE_CONTENT' | 'INVALID'
export type ArtPackDisposition = 'COMPLETE_PLACEHOLDER' | 'EMPTY_INHERITING_PLACEHOLDER' | 'COMPLETE_LEAD_SELECTED' | 'LEAD_SELECTED_WITH_OPTIONAL_OMISSIONS' | 'MISSING_USING_FALLBACK' | 'INVALID_REQUIRED_ASSETS' | 'INVALID_INDEX_MANIFEST_MISMATCH' | 'INVALID_MANIFEST'
export interface ArtPackAssetDiagnostic {
  semanticSlot: string
  sourcePath: string | null
  requirement: 'REQUIRED' | 'OPTIONAL'
  declaredDimensions: { width: number; height: number } | null
  expectedDimensions: { width: number; height: number }
  renderBox: { width: number; height: number }
  fitPolicy: 'NEAREST_EXACT' | 'NEAREST_CONTAIN'
  pixelScaling: 'NEAREST_NEIGHBOR'
  actualDimensions: { width: number; height: number } | null
  contentFingerprint: string | null
  status: ArtPackAssetStatus
  detail: string
}
export interface ArtPackDiagnostics {
  requestedPackId: string
  indexEntry: ArtPackIndexEntry | null
  manifestIdentity: { id: string; label: string; status: string } | null
  loadedPackId: string
  loadedPackStatus: ArtPackStatus
  placeholderInheritance: boolean
  fallbackActive: boolean
  indexManifestConsistent: boolean
  requiredSlots: ArtPackAssetDiagnostic[]
  optionalSlots: ArtPackAssetDiagnostic[]
  invalidSlots: string[]
  candidateAssetsInstalled: number
  disposition: ArtPackDisposition
}
export interface LoadedArtPack { manifest: ArtPackManifest; diagnostics: ArtPackDiagnostics; packIndex: ArtPackIndex }
export type AssetProbeResult =
  | { status: 'LOADED'; width: number; height: number; contentFingerprint: string; detail?: string }
  | { status: 'MISSING' | 'DECODE_FAILED'; detail?: string }
export type AssetProbe = (asset: ArtAsset) => Promise<AssetProbeResult>
export type AdventureAction =
  | { type: 'BEGIN_ROOK_ENTRY' } | { type: 'OPEN_INTRO_SKIP_CONFIRMATION' } | { type: 'CANCEL_INTRO_SKIP_CONFIRMATION' } | { type: 'SKIP_OPENING_TO_INSTRUCTIONS' } | { type: 'SET_DIALOGUE_MODE'; mode: DialogueMode } | { type: 'SET_DIALOGUE_PACE'; pace: DialoguePace } | { type: 'SET_DIALOGUE_DISPLAY'; display: DialogueDisplay } | { type: 'GLOBE_TICK'; deltaMs: number }
  | { type: 'REQUEST_HINT'; tier: 'METHOD_HINT' | 'CASE_HINT' | 'DIRECT_HINT' } | { type: 'SELECT_VERB'; verb: VerbId } | { type: 'SELECT_ITEM'; itemId: InventoryItemId } | { type: 'ACT_ON_ITEM'; itemId: InventoryItemId } | { type: 'HOVER_HOTSPOT'; hotspotId: HotspotId | null } | { type: 'WALK_TO'; point: Point; pendingInteraction?: PendingInteraction | null } | { type: 'WALK_TICK'; delta: number } | { type: 'INTERACT'; targetId: HotspotId } | { type: 'ADVANCE_SEQUENCE' } | { type: 'CANCEL_SELECTION' } | { type: 'REVEAL_TICK'; characters: number; channel?: 'BLOCKING' | 'NONBLOCKING' } | { type: 'REVEAL_FULL'; channel?: 'BLOCKING' | 'NONBLOCKING' } | { type: 'ADVANCE_SPEECH'; channel?: 'BLOCKING' | 'NONBLOCKING' } | { type: 'CHOOSE_DIALOGUE_TOPIC'; topicId: string } | { type: 'CLOSE_DIALOGUE' } | { type: 'RETURN_FROM_COMPLETED_CASE'; brcgResolved?: boolean } | { type: 'PLAY_RETURN_TAG' } | { type: 'PLAY_BRCG_PAYOFF' } | { type: 'SYNC_INVESTIGATION_CONTEXT'; milestone: InvestigationMilestone; brcg: BrcgInvestigationState } | { type: 'TOGGLE_EVIDENCE_DRAWER' } | { type: 'TOGGLE_REDUCED_ANIMATION' } | { type: 'TOGGLE_INSTANT_TEXT' } | { type: 'SET_DIALOGUE_PRESENTATION'; mode: 'FULLSCREEN_CRT' | 'DOCKED_OVERLAY' | 'PLAIN_LIST' } | { type: 'TOGGLE_HOTSPOT_CONTRAST' } | { type: 'TOGGLE_REVIEW_HOTSPOTS' } | { type: 'REVIEW_JUMP'; phase: PuzzlePhase } | { type: 'REVIEW_TALKING' } | { type: 'PLAY_FORM_BARK' } | { type: 'IDLE_TICK'; foreground: boolean } | { type: 'APPLY_CONTROL_FIXTURE'; fixture: 'PREBRIEF_EVIDENCE_SEA' | 'VOLUNTARY_EARLY_EXIT' | 'POST_RESULT_SELF_TALK' | 'POST_SOLVE_STAGED' | 'ROOK_BLOCKING_BEAT' } | { type: 'ENTER_TERMINAL' } | { type: 'REQUEST_TERMINAL_ENTRY' } | { type: 'ACK_TERMINAL_PRESENTATION' } | { type: 'CLOSE_TERMINAL' } | { type: 'ACK_INTENT_REPLACEMENT'; id: number } | { type: 'RESET' }
