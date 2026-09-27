import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { loadArtPack, loadArtPackIndex, loadCharacterAnimationCatalog } from '../adventure/artPack'
import { publicSpeaker, publicObjectName, contentText } from '../controller/content/adapter'
import { dialogueTopicsForState, inventoryItems, isVisibleFrom, PHASE_ORDER } from '../adventure/content'
import { loadAcceptedFirstBreachRecord, type FirstBreachRecord } from '../adventure/evidence'
import { adventureReducer, canSkipOpening, createInitialAdventureState, currentSpeechLine, phaseReached, revealedSpeaker, speakerTurnOwner, terminalCanOpen, terminalIsAuthorized, terminalIsPowered } from '../adventure/reducer'
import { controlClass, facingPair, interfaceTreatment, worldDialogueAllowed } from '../adventure/controlPolicy'
import { clickWalkPoint, getSceneDefinition, layoutPropHotspots } from '../adventure/scenes'
import { displayCommandSentence } from '../adventure/sentence'
import { VERBS, type AdventureState, type AnimationArt, type ArtAsset, type ArtPackAssetDiagnostic, type ArtPackDiagnostics, type ArtPackIndex, type ArtPackManifest, type Hotspot, type Point, type PropArt, type SceneId, type VerbId } from '../adventure/types'
import { semanticCatalogDiagnostics, type CharacterAnimationCatalog } from '../adventure/semanticCatalog'
import { loadPerformanceProfile, PERFORMANCE_INTENTIONS, validatePerformanceProfile, type PerformanceIntention, type PerformanceProfile } from '../adventure/performanceCatalog'
import { PerformancePortrait } from './PerformancePortrait'
import { CaseTerminalWorkbench } from './CaseTerminalWorkbench'
import { GameDialoguePresentation } from './GameDialoguePresentation'
import { useFullDeliveryClamp } from './useFullDeliveryClamp'
import { useIntegerViewportScale } from '../controller/foundation/useIntegerViewportScale'
import { loadFrozenFixture, syntheticFixture } from '../investigation/fixture'
import type { CaseFixture } from '../investigation/contracts'
import { investigationBase, synchronizeOfficeMilestones } from '../investigation/officeSync'
import { commitInvestigationSave } from '../adventure/durableStores'
import { commitPlacedPaint, placedImageIdentity, visiblePlacedImage, type PlacedPaint } from '../adventure/placedImageCache'
import { investigationReducer, restoreInvestigation, type Command, type InvestigationState } from '../investigation/state'
import { idleIntentsAt, STAGE_MARKS } from '../controller/mission/performance'
import { globeFrame, globeFrameAt, globeGameBox, globeTimelineCursor, preloadGlobeFrames } from '../adventure/globeVisual'
import { gameBoxStyle, MISC_CABINET_ART, OFFICIAL_CABINET_ART, snapGameToScenePixel } from '../adventure/renderContract'
import { windowGameBox } from '../adventure/interactionGeometry'
import { productionComposition } from '../adventure/layout7Production'
import { artStackOrder, arthurPlacementFromLayout, layoutEntitySrc, layoutHotspotPixels, layoutHotspotWalkTo, layoutPaintZ, layoutPixelBox, PERSISTENT_MISC_JUNK_OVERLAY, readDefaultLayout, type CompositionEntity, type SceneComposition } from '../adventure/sceneComposition'
import { ambientClip, animationClips, clipById, MUG_STEAM_FPS, mugSteamFrame, resolveActorCue, type CueSheet } from '../adventure/animationCues'
import { devToolActive } from '../adventure/developmentTools'
import { effectiveReadingDisplay } from '../adventure/speechDisplayPolicy'

const R55ReviewHarness = import.meta.env.DEV
  ? lazy(() => import('../story/r55/R55ReviewHarness').then((mod) => ({ default: mod.R55ReviewHarness })))
  : null
const MissionReviewHarness = import.meta.env.DEV
  ? lazy(() => import('./MissionHarness').then((mod) => ({ default: mod.MissionHarness })))
  : null
import { buildRuntimeSession } from '../adventure/runtimeSession'
import { useSemanticTimers } from './useSemanticTimers'
import { bindDialogueAdvanceTimer, bindFocusTimer, bindGlobeTimer, bindIdleTimer, bindNonblockingClearTimer, bindOpeningStageTimer, bindReplacementTimer, bindSequenceTimer, bindSpeechRevealTimer, bindTerminalPresentationTimer, bindWalkTimer } from './semanticTimerController'
import { TarkaCreditsScreen, TarkaTitleScreen } from './LaunchScreen'
import { clearProductionGameplayPersistence, initialProductionNavigationState, productionNavigationReducer } from './productionNavigation'
import { S14CompletionScreen, S14EndingSequence } from './S14Ending'
import type { SideLeadCompletion } from '../story/r55/production'
import { cabinetTransitionPlan } from './cabinetTransitionPolicy'

const cabinetTransitionFrames = (itemId: string, source: string, target: string) => cabinetTransitionPlan(itemId, source, target).frames
import { BackgroundMusicControl, PlaybackControls } from './BackgroundMusicControl'
import { backgroundMusic, type BackgroundMusicScene } from './backgroundMusic'
import { authoredPerformanceClip, characterPoseClipId, inspectInteractionDeliveryKey, rookReadsSmallNote } from './characterVisual'
import { readDialoguePreferences, writeDialoguePreferences } from '../adventure/dialoguePreferences'
import { renderedAnimationPolicy } from './renderedAnimationPolicy'
import { clipFacingPolicy } from './characterFacingPolicy'
import { TALK_CADENCES, type TalkCadenceActor } from './talkCadence'
import { speechMotionWindowMs } from './speechMotion'

const BARK_1_AFTER_S = 75
const BARK_2_AFTER_S = 165
const HERO_HOTSPOTS = ['office-globe', 'window', 'coffee-mug', 'desk-lamp', 'tall-books', 'book-shelf', 'arthur-stamp'] as const

const VERB_LABELS: Record<VerbId, string> = { GIVE: 'GIVE', PICK_UP: 'PICK UP', USE: 'USE', OPEN: 'OPEN', LOOK_AT: 'LOOK AT', PUSH: 'PUSH', CLOSE: 'CLOSE', TALK_TO: 'TALK TO', PULL: 'PULL' }
const VERB_FACE: Record<VerbId, string> = { GIVE: 'Give', PICK_UP: 'Pick up', USE: 'Use', OPEN: 'Open', LOOK_AT: 'Look at', PUSH: 'Push', CLOSE: 'Close', TALK_TO: 'Talk to', PULL: 'Pull' }
const DRAWER_CONTROL_VERBS = new Set<VerbId>(['OPEN', 'CLOSE', 'PUSH', 'PULL'])
const DRAWER_CONTENT_PARENTS = {
  'disorderly-stack-of-confidential-files': 'official-case-file-cabinet',
  'miscellaneous-catch-all-contents': 'miscellaneous-drawer-cabinet',
} as const

function IntroSkipConfirmation({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { cancelRef.current?.focus() }, [])
  const cancel = () => {
    onCancel()
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="intro-skip-button"]')?.focus())
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
      return
    }
    if (event.key !== 'Tab') return
    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement as HTMLElement)
    const next = event.shiftKey ? (current <= 0 ? buttons.length - 1 : current - 1) : (current < 0 || current === buttons.length - 1 ? 0 : current + 1)
    event.preventDefault()
    buttons[next]!.focus()
  }
  return <div className="intro-skip-shield" data-testid="intro-skip-confirmation" role="presentation" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
    <div ref={dialogRef} className="intro-skip-dialog" role="dialog" aria-modal="true" aria-labelledby="intro-skip-title" aria-describedby="intro-skip-description" onKeyDown={onKeyDown}>
      <strong id="intro-skip-title">SKIP THE INTRO?</strong>
      <p id="intro-skip-description">Jump to Arthur's final instructions? You will still need to complete the authorization puzzle.</p>
      <div>
        <button type="button" onClick={onConfirm}>Yes, I'm super bored</button>
        <button ref={cancelRef} type="button" onClick={cancel}>No, I'm fully engaged</button>
      </div>
    </div>
  </div>
}

/**
 * Open-drawer contents intentionally sit above the cabinet hotspot. Route a
 * drawer-control verb to the drawer beneath that overlap while preserving
 * LOOK/PICK UP/TALK interactions on the contents themselves.
 */
function drawerInteractionTarget(hotspot: Hotspot, verb: VerbId | null) {
  if (!verb || !DRAWER_CONTROL_VERBS.has(verb)) return hotspot.id
  return DRAWER_CONTENT_PARENTS[hotspot.id as keyof typeof DRAWER_CONTENT_PARENTS] ?? hotspot.id
}

function browserStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}
function readSavedInvestigation(fixture: CaseFixture, storageKey: string | null): InvestigationState {
  let saved: string | null = null
  try { if (storageKey) saved = browserStorage()?.getItem(storageKey) ?? null } catch { /* Storage unavailable; start from the fixture. */ }
  return restoreInvestigation(fixture, saved)
}

function AssetImage({ asset, alt, className, testId, style }: { asset: ArtAsset; alt: string; className?: string; testId?: string; style?: React.CSSProperties }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [visibleSrc, setVisibleSrc] = useState(asset.src)
  useEffect(() => {
    if (asset.src === visibleSrc) return
    let current = true
    const image = new Image()
    image.src = asset.src
    const commit = () => { if (current) { setVisibleSrc(asset.src); setFailedSrc(null) } }
    const fail = () => { if (current) setFailedSrc(asset.src) }
    if (typeof image.decode === 'function') void image.decode().then(commit, fail)
    else { image.onload = commit; image.onerror = fail }
    return () => { current = false; image.onload = null; image.onerror = null }
  }, [asset.src, visibleSrc])
  if (failedSrc === visibleSrc) return <span className={`asset-fallback ${className ?? ''}`} data-testid={testId} role="img" aria-label={`${alt}, missing asset fallback`} style={style}>{alt}</span>
  return <img className={className} data-testid={testId} data-requested-src={asset.src} data-rendered-src={visibleSrc} data-decode-failed={failedSrc === asset.src} src={visibleSrc} width={asset.width} height={asset.height} alt={alt} draggable={false} style={style} onError={() => setFailedSrc(visibleSrc)} />
}

const renderedImageDecode = new Map<string, Promise<void>>()
function decodeRenderedImage(src: string) {
  const existing = renderedImageDecode.get(src)
  if (existing) return existing
  const pending = new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'sync'
    image.src = src
    if (typeof image.decode === 'function') void image.decode().then(resolve, reject)
    else { image.onload = () => resolve(); image.onerror = () => reject(new Error(`Could not decode ${src}`)) }
  }).catch((error) => { renderedImageDecode.delete(src); throw error })
  renderedImageDecode.set(src, pending)
  return pending
}

async function preloadRenderedCharacterImages(manifest: ArtPackManifest, profile: PerformanceProfile) {
  const manifestSources = Object.values(manifest.characters).flatMap((character) => Object.values(character.animations).flatMap((animation) => animation?.frames.map((frame) => frame.src) ?? []))
  const authoredSources = animationClips().filter((clip) => clip.actorId === 'rook' || clip.actorId === 'arthur').flatMap((clip) => clip.frames)
  const performanceSources = Object.values(profile.characters).flatMap((clips) => clips.flatMap((clip) => clip.frames.map((frame) => frame.asset.src)))
  await Promise.allSettled([...new Set([...manifestSources, ...authoredSources, ...performanceSources])].map(decodeRenderedImage))
}

function AnimatedImage({ animation, active, reduced, alt, className, testId, phase = 0, policyIdentity = 'default' }: { animation: AnimationArt; active: boolean; reduced: boolean; alt: string; className?: string; testId?: string; phase?: number; policyIdentity?: string }) {
  const resetFrame = animation.frames.length ? phase % animation.frames.length : 0
  const identity = `${policyIdentity}::${active ? 'active' : 'still'}::${animation.loop ? 'loop' : 'hold'}::${reduced ? 'reduced' : 'motion'}`
  const [cursor, setCursor] = useState({ identity, frame: resetFrame })
  const frame = cursor.identity === identity ? cursor.frame : resetFrame
  const variableDurations = animation.frameDurationsMs?.length === animation.frames.length ? animation.frameDurationsMs : null
  const currentDurationMs = variableDurations?.[frame] ?? 1000 / animation.fps
  useEffect(() => {
    if (!active || reduced || animation.frames.length < 2) return
    if (!animation.loop && frame >= animation.frames.length - 1) return
    const timer = window.setTimeout(() => setCursor((current) => {
      const index = current.identity === identity ? current.frame : resetFrame
      return { identity, frame: animation.loop ? (index + 1) % animation.frames.length : Math.min(index + 1, animation.frames.length - 1) }
    }), currentDurationMs)
    return () => window.clearTimeout(timer)
  }, [active, animation.frames.length, animation.loop, currentDurationMs, frame, identity, reduced, resetFrame])
  const rendered = animation.frames[frame] ?? animation.frames[0]!
  // Keep one image node alive across every cel and speaker handoff. The actual
  // renderer URLs are decoded before the room is exposed, so AssetImage can
  // swap a ready frame without a blank replacement node between paints.
  return <span className={`animation-frame ${className ?? ''}`} data-animation-frames={animation.frames.length} data-frame-index={frame} data-frame-duration-ms={Math.round(currentDurationMs)} data-policy-identity={identity} data-requested-src={rendered.src} data-testid={testId}><AssetImage asset={rendered} alt={alt} /></span>
}

function hotspotBounds(hotspot: Hotspot) { const points = hotspot.polygon.split(' ').map((pair) => pair.split(',').map(Number)); const xs = points.map(([x]) => x ?? 0); const ys = points.map(([, y]) => y ?? 0); const left = Math.min(...xs); const top = Math.min(...ys); const right = Math.max(...xs); const bottom = Math.max(...ys); return { left: `${left / 9.6}%`, top: `${top / 3.6}%`, width: `${(right - left) / 9.6}%`, height: `${(bottom - top) / 3.6}%` } }

function talkAnimation(closed: AnimationArt, open: AnimationArt, actor: TalkCadenceActor): AnimationArt {
  const cadence = TALK_CADENCES[actor]
  const pair = [closed.frames[0]!, open.frames[0]!] as const
  return {
    frames: cadence.framePattern.map((index) => pair[index]),
    frameWidth: closed.frameWidth,
    frameHeight: closed.frameHeight,
    fps: 8,
    loop: true,
    frameDurationsMs: [...cadence.frameDurationsMs],
  }
}

function useSpeechMotion(state: AdventureState, character: 'ROOK' | 'MR_INDEX') {
  const active = state.speech ?? state.nonblockingSpeech
  const line = active?.lines[active.lineIndex] ?? null
  const ownsLine = line?.speaker === character
  const display = line ? effectiveReadingDisplay(line, state.dialogueDisplay, state.instantText) : 'FULL'
  const key = ownsLine && line && active ? `${state.speech ? 'blocking' : 'optional'}:${active.lineIndex}:${line.copyKey ?? line.text}` : 'none'
  const durationMs = line ? speechMotionWindowMs(line.text, state.dialoguePace) : 0
  const fullWindow = ownsLine && display === 'FULL'
  const [closedKey, setClosedKey] = useState<string | null>(null)
  useEffect(() => {
    if (!fullWindow) return
    const timer = window.setTimeout(() => setClosedKey(key), durationMs)
    return () => window.clearTimeout(timer)
  }, [durationMs, fullWindow, key])
  if (!ownsLine || !line || !active) return false
  if (display === 'TYPED') return active.visibleCharacters < line.text.length
  return closedKey !== key
}
function depthAt(scene: ArtPackManifest['scenes'][SceneId], y: number) {
  const band = scene.depthBands.find((entry) => y >= entry.minY && y <= entry.maxY)
  if (band) return band.zIndex
  const nearest = scene.depthBands.reduce((best, entry) => entry.maxY > best.maxY ? entry : best)
  return y > nearest.maxY ? nearest.zIndex : 4
}

function exchangeArthurX(state: AdventureState, manifest: ArtPackManifest) {
  return state.runtimeSession.arthurCenterX ?? manifest.scenes['records-office'].characterAnchors.mrIndex?.x ?? 416
}

/** Preserve the readable inspect silhouette briefly, then release it once. */
function useInspectLeadIn(key: string | null, reducedAnimation: boolean, durationMs = 450) {
  const [expiredKey, setExpiredKey] = useState<string | null>(null)
  const active = Boolean(key && !reducedAnimation && expiredKey !== key)
  useEffect(() => {
    if (!key || reducedAnimation) return
    const timer = window.setTimeout(() => setExpiredKey(key), durationMs)
    return () => window.clearTimeout(timer)
  }, [durationMs, key, reducedAnimation])
  return active
}

function Character({ manifest, state, character, scale, placement = null, cueSheet = null }: { manifest: ArtPackManifest; state: AdventureState; character: 'ROOK' | 'MR_INDEX'; scale: number; placement?: { position: Point; zIndex: number; room?: { x: number; y: number; width: number; height: number } } | null; cueSheet?: CueSheet | null }) {
  const activeSpeech = state.speech ?? state.nonblockingSpeech
  const spoken = activeSpeech?.lines[activeSpeech.lineIndex] ?? null
  const speechOwner = speakerTurnOwner(state)
  const characterExchange = Boolean(state.speech?.lines.some(line => line.speaker === 'ROOK') && state.speech?.lines.some(line => line.speaker === 'MR_INDEX'))
  const exchange = Boolean(state.dialogueOpen || state.speech?.returnTo === 'DIALOGUE' || characterExchange)
  const talking = useSpeechMotion(state, character); const isRook = character === 'ROOK'; const art = isRook ? manifest.characters.rook : manifest.characters.mrIndex
  const caseFileSequence = isRook && state.activeSequence?.id === 'SEQUENCE.CASEFILE_COLLECTION'
  const caseFileSearchTalking = caseFileSequence && state.activeSequence?.currentActionId === 'search-dialogue' && spoken?.speaker === 'ROOK'
  const caseFileReading = caseFileSequence && state.activeSequence?.currentActionId === 'recite-file'
  // One inspect entrance belongs to the interaction, not to every bubble. The
  // transcript grows once per line, so subtracting lineIndex produces a stable
  // identity across the whole delivery while still changing on a later repeat.
  const inspectionDeliveryKey = isRook && state.rookPose === 'INSPECT' && spoken?.speaker === 'ROOK' && !caseFileReading
    ? inspectInteractionDeliveryKey({
        channel: activeSpeech === state.speech ? 'blocking' : 'optional',
        transcriptLength: state.transcript.length,
        lineIndex: activeSpeech?.lineIndex ?? 0,
        interactionId: state.lastInteractionId,
      })
    : null
  const inspectLeadIn = useInspectLeadIn(inspectionDeliveryKey, state.reducedAnimation)
  const expectedActorId = isRook ? 'rook' : 'arthur'
  const ownedClip = (id: string | null) => {
    const selected = id ? clipById(id) : null
    return selected?.actorId === expectedActorId ? selected : null
  }
  // Arthur-only reactions are still addressed to Rook. Do not require a
  // mixed-speaker block before turning him toward the player character (the
  // feather-pen pickup warning is the canonical single-speaker case).
  const turnToRook = !isRook && (exchange || spoken?.speaker === 'MR_INDEX')
  const holdTalk = Boolean(spoken && spoken.speaker === character)
  const holdListen = exchange && !holdTalk && !state.walk
  const walking = isRook && Boolean(state.walk)
  const animationName = walking ? 'walkEast' : inspectLeadIn ? 'inspect' : isRook && state.rookPose === 'REACH' ? 'reach' : isRook && state.rookPose === 'USE_GIVE' ? 'useGive' : !isRook && state.mrIndexPose === 'STAMP' ? 'stamp' : !isRook && state.mrIndexPose === 'DOCUMENT' ? 'document' : talking ? 'talk' : 'idle'
  const directed = resolveActorCue({ walking, speechReturn: state.speech?.returnTo ?? state.nonblockingSpeech?.returnTo ?? null, lineIndex: state.speech?.lineIndex ?? state.nonblockingSpeech?.lineIndex ?? 0, lastInteractionId: state.lastInteractionId, deliveryKey: spoken?.copyKey ?? null }, isRook ? 'rook' : 'arthur', cueSheet)
  const poseClipId = characterPoseClipId(character, state)
  const poseClip = !directed && (!inspectionDeliveryKey || inspectLeadIn) ? ownedClip(caseFileSearchTalking ? 'rook.reach.talk' : poseClipId) : null
  const stampClip = !directed && poseClipId === 'arthur.stamp' ? ownedClip(poseClipId) : null
  const documentClip = !directed && poseClipId === 'arthur.document' ? ownedClip(poseClipId) : null
  const receiveClip = !directed && poseClipId === 'arthur.receive' ? ownedClip(poseClipId) : null
  const principalCueId = !directed ? authoredPerformanceClip(spoken, character, talking) : null
  const principalClip = ownedClip(principalCueId)
  const noteReading = isRook
    && state.lastInteractionId === 'INTERACTION.ITEM.look-fictional-token-note'
    && state.piggyNoteReadState === 'UNREAD'
    && rookReadsSmallNote(spoken)
  const noteReadSource = noteReading ? ownedClip('rook.note-read') : null
  const noteReadClip = noteReadSource
    ? { ...noteReadSource, frames: talking ? noteReadSource.frames : noteReadSource.frames.slice(0, 1) }
    : null
  const scolding = !isRook && state.arthurPointHold
  const pointClip = scolding && holdTalk && !directed && !stampClip && !documentClip && !receiveClip && !principalClip ? ownedClip('arthur.point') : null
  const listenClip = pointClip ? null : turnToRook && !holdTalk && !directed && !stampClip && !documentClip && !receiveClip && !principalClip ? clipById('arthur.listen') : holdListen && !directed && !stampClip && !documentClip && !receiveClip && !principalClip ? clipById(isRook ? 'rook.idle.still' : 'arthur.listen') : null
  const ambient = !exchange && !turnToRook && !directed && !noteReadClip && !stampClip && !documentClip && !receiveClip && !principalClip && !walking && !talking && (isRook ? state.rookPose === 'IDLE' : state.mrIndexPose === 'IDLE') ? ambientClip(isRook ? 'rook' : 'arthur', state.inactiveSeconds) : null
  const posed = !walking && talking ? talkAnimation(art.animations.talkClosed!, art.animations.talkOpen!, character) : art.animations[animationName]!
  const played = noteReadClip ? { id: noteReadClip.id, frames: noteReadClip.frames, width: noteReadClip.width, height: noteReadClip.height, fps: noteReadClip.defaultFps, loop: talking, active: talking, frameDurationsMs: noteReadClip.frameDurationsMs } : directed ? { id: directed.clip.id, frames: directed.clip.frames, width: directed.clip.width, height: directed.clip.height, fps: directed.cue.fps, loop: directed.cue.mode === 'LOOP', active: directed.cue.mode !== 'HOLD' && directed.clip.frames.length > 1, frameDurationsMs: directed.clip.frameDurationsMs } : stampClip ? { id: stampClip.id, frames: stampClip.frames, width: stampClip.width, height: stampClip.height, fps: stampClip.defaultFps, loop: false, active: true, frameDurationsMs: stampClip.frameDurationsMs } : principalClip ? { id: principalClip.id, frames: principalClip.frames, width: principalClip.width, height: principalClip.height, fps: principalClip.defaultFps, loop: false, active: principalClip.frames.length > 1, frameDurationsMs: principalClip.frameDurationsMs } : documentClip ? { id: documentClip.id, frames: talking ? documentClip.frames : documentClip.frames.slice(0, 1), width: documentClip.width, height: documentClip.height, fps: documentClip.defaultFps, loop: talking, active: talking, frameDurationsMs: documentClip.frameDurationsMs } : receiveClip ? { id: receiveClip.id, frames: receiveClip.frames, width: receiveClip.width, height: receiveClip.height, fps: receiveClip.defaultFps, loop: false, active: true, frameDurationsMs: receiveClip.frameDurationsMs } : pointClip ? { id: pointClip.id, frames: pointClip.frames, width: pointClip.width, height: pointClip.height, fps: pointClip.defaultFps, loop: true, active: true, frameDurationsMs: pointClip.frameDurationsMs } : poseClip ? { id: poseClip.id, frames: poseClip.frames, width: poseClip.width, height: poseClip.height, fps: poseClip.defaultFps, loop: poseClip.id === 'rook.case-file' || poseClip.id === 'rook.reach.talk' ? talking : state.rookPose === 'REACH' && !state.terminalEntryPending, active: poseClip.id === 'rook.reach.talk' ? talking : true, frameDurationsMs: poseClip.frameDurationsMs } : listenClip ? { id: listenClip.id, frames: isRook ? listenClip.frames : [listenClip.frames[0]!], width: listenClip.width, height: listenClip.height, fps: 1, loop: false, active: false, frameDurationsMs: listenClip.frameDurationsMs } : ambient ? { id: ambient.id, frames: ambient.frames, width: ambient.width, height: ambient.height, fps: ambient.defaultFps, loop: false, active: ambient.frames.length > 1, frameDurationsMs: ambient.frameDurationsMs } : null
  const baseFrames = played ? played.frames : posed.frames.map((frame) => frame.src)
  const effectiveClipId = played?.id ?? `${isRook ? 'rook' : 'arthur'}.${animationName}`
  const visualSpeechOwner = noteReadClip || principalClip ? speechOwner : talking ? speechOwner : 'NONE'
  const basePolicy = renderedAnimationPolicy({ actor: character, speakerOwner: visualSpeechOwner, clipId: effectiveClipId, frames: baseFrames, active: played?.active ?? (walking || talking), loop: played?.loop ?? posed.loop })
  const animation = played ? { frames: basePolicy.frames.map((src) => ({ src, width: played.width, height: played.height })), frameWidth: played.width, frameHeight: played.height, fps: played.fps, loop: basePolicy.loop, ...(played.frameDurationsMs ? { frameDurationsMs: played.frameDurationsMs } : {}) } : { ...posed, frames: basePolicy.frames.map((src) => posed.frames.find((frame) => frame.src === src) ?? posed.frames[0]!), loop: basePolicy.loop }
  const scene = manifest.scenes['records-office']; const position = isRook ? state.rookPosition : placement?.position ?? scene.characterAnchors.mrIndex!
  const snappedX = snapGameToScenePixel(position.x, scale)
  const snappedY = snapGameToScenePixel(position.y, scale)
  const style = placement?.room ? { left: placement.room.x * scale, top: placement.room.y * scale, width: placement.room.width * scale, height: placement.room.height * scale, zIndex: isRook ? 8 : placement.zIndex } : { left: `${(snappedX - art.anchor.x * art.scale) / 9.6}%`, top: `${(snappedY - art.anchor.y * art.scale) / 3.6}%`, width: `${animation.frameWidth * art.scale / 9.6}%`, height: `${animation.frameHeight * art.scale / 3.6}%`, zIndex: isRook ? 8 : placement?.zIndex ?? depthAt(scene, position.y) }
  // Keep the pair mutually oriented for the entire exchange. Re-evaluating this
  // only from the current speaker made Rook repeatedly snap toward the camera
  // between Arthur's adjacent form-review lines.
  const talkingToArthur = Boolean(exchange || state.dialogueOpen || state.speech?.returnTo === 'DIALOGUE' || spoken?.speaker === 'MR_INDEX')
  const rookConverses = isRook && talkingToArthur && !walking
  const arthurTurns = !isRook && Boolean(turnToRook || talkingToArthur)
  const paired = rookConverses || arthurTurns ? facingPair(state.rookPosition.x, exchangeArthurX(state, manifest)) : null
  const facing = isRook ? (rookConverses && paired ? paired.rookFacing : state.rookFacing) : (arthurTurns && paired ? paired.mrIndexFacing : state.mrIndexFacing)
  const facingPolicy = clipFacingPolicy(character, effectiveClipId, facing)
  const mirrorHorizontal = facingPolicy.mirrorHorizontal
  const performanceActor = isRook ? 'ROOK' : 'ARTHUR'
  const speechIntentions = state.speech?.performance.intentions[performanceActor] ?? state.nonblockingSpeech?.performance.intentions[performanceActor]
  const sequenceIntention = state.activeSequence?.currentActorIntentions[performanceActor]
  const mouth = talking ? 'FACE:TALK' : ''
  const semanticLabel = [sequenceIntention, Object.entries(speechIntentions ?? {}).map(([track, intention]) => `${track}:${intention}`).join(' · '), mouth].filter(Boolean).join(' · ') || 'IDLE'
  return <div className={`character ${isRook ? 'rook' : 'mr-index'} ${talking ? 'talking' : ''} ${walking ? 'walking' : ''} ${mirrorHorizontal ? 'mirrored-horizontal' : ''}`} style={style} data-testid={`${isRook ? 'rook' : 'mr-index'}-sprite`} data-talking={talking} data-animation={animationName} data-cue={noteReadClip?.id ?? directed?.cue.clipId ?? principalCueId ?? poseClip?.id ?? pointClip?.id ?? documentClip?.id ?? stampClip?.id ?? ''} data-performance={semanticLabel} data-facing={facing} data-native-facing={facingPolicy.nativeFacing} data-mirror-rule={facingPolicy.rule} data-mirrored={mirrorHorizontal}>
    <AnimatedImage animation={animation} phase={talking ? 0 : isRook ? 0 : 2} active={basePolicy.active} policyIdentity={`${basePolicy.identity}::${state.activeSequence?.currentActionId ?? ''}`} reduced={state.reducedAnimation} alt={`${publicObjectName({id:isRook?'ROOK':'mr-index',name:'Rook'},!isRook)} character`} className="pixel-art-frame" testId={`${isRook ? 'rook' : 'mr-index'}-animation`} />
    <small className="semantic-performance-label" aria-hidden="true">{semanticLabel}</small>
  </div>
}

function propState(propId: string, prop: PropArt, state: AdventureState) {
  if (propId === 'pneumaticTube' || propId === 'dispatchPlunger' || propId === 'recordCanister') return prop.default
  if (propId === 'nansenTerminal' && terminalIsPowered(state)) return prop.states.unlocked ?? prop.default
  return prop.default
}

function usePlacedImage(src: string, width: number, height: number, blur: number) {
  const identity = placedImageIdentity({ src, width, height, blur })
  const [paint, setPaint] = useState<PlacedPaint | null>(null)
  const [failedIdentity, setFailedIdentity] = useState<string | null>(null)
  useEffect(() => {
    if (blur <= 0 || width < 1 || height < 1) return
    let cancel = false
    const image = new Image()
    image.onload = () => {
      if (cancel) return
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width))
      canvas.height = Math.max(1, Math.round(height))
      const context = canvas.getContext('2d')
      if (!context) { setFailedIdentity(identity); return }
      context.imageSmoothingEnabled = false
      context.filter = `blur(${blur}px)`
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const url = canvas.toDataURL()
      setPaint((previous) => commitPlacedPaint(identity, previous, { identity, url }))
      setFailedIdentity((current) => current === identity ? null : current)
    }
    image.onerror = () => { if (!cancel) setFailedIdentity(identity) }
    image.src = src
    return () => { cancel = true }
  }, [identity, src, width, height, blur])
  return visiblePlacedImage({ src, width, height, blur }, paint, failedIdentity)
}

function useTransitionFrame(itemId: string, target: string, reduced: boolean) {
  const [frame, setFrame] = useState(target)
  const previous = useRef(target)
  useEffect(() => {
    const transition = cabinetTransitionFrames(itemId, previous.current, target)
    if (transition.length === 0 || reduced || previous.current === target) { previous.current = target; setFrame(target); return }
    const wasClosed = previous.current.endsWith('/cabinet_closed.png')
    const isClosed = target.endsWith('/cabinet_closed.png')
    if (wasClosed === isClosed) { previous.current = target; setFrame(target); return }
    let cancelled = false
    const opening = !isClosed
    const frames = opening ? [...transition, target] : [...transition].reverse().concat(target)
    const images = frames.map((src) => { const image = new Image(); image.src = src; return image })
    Promise.all(images.map((image) => typeof image.decode === 'function' ? image.decode() : new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject }))).then(() => {
      if (cancelled) return
      let index = 0
      const advance = () => {
        if (cancelled) return
        setFrame(frames[index] ?? target)
        index += 1
        if (index < frames.length) window.setTimeout(advance, 70)
        else previous.current = target
      }
      advance()
    }, () => { /* retain the last decoded frame; never flash through a missing/background frame */ })
    return () => { cancelled = true }
  }, [itemId, reduced, target])
  return frame
}

const PlacedLayoutSprite = memo(function PlacedLayoutSprite({ item, src, scale, zIndex, reduced, foot }: { item: CompositionEntity; src: string; scale: number; zIndex: number; reduced: boolean; foot?: { width: number; height: number } | undefined }) {
  const box = layoutPixelBox(item, scale)
  const height = foot ? Math.max(1, Math.round(box.width * foot.height / foot.width)) : box.height
  const top = foot ? box.top + box.height - height : box.top
  const blur = item.id.startsWith('bg-') ? item.blur * scale : 0
  const transitionFrame = useTransitionFrame(item.id, src, reduced)
  const painted = usePlacedImage(transitionFrame, box.width, height, blur)
  const showPersistentMiscJunk = item.id === 'misc-cabinet'
    && transitionFrame === src
    && src.endsWith('/cabinet_open__drawer_04_open.png')
  const junk = PERSISTENT_MISC_JUNK_OVERLAY
  return <>
    <img className="layout-locked-sprite" data-testid={`layout-${item.id}`} data-blur={item.blur} data-frame-src={transitionFrame} alt="" src={painted} draggable={false} style={{ left: box.left, top, width: box.width, height, zIndex, transform: item.mirror ? 'translateZ(0) scaleX(-1)' : 'translateZ(0)' }} />
    {showPersistentMiscJunk && <svg className="layout-locked-sprite pixel-art" data-testid="misc-drawer-junk" data-frame-src={junk.src} data-persistence="always-while-open" aria-hidden="true" viewBox={`0 0 ${junk.sourceWidth} ${junk.sourceHeight}`} preserveAspectRatio="none" shapeRendering="crispEdges" style={{ left: box.left, top: box.top + box.height * junk.offsetY / junk.sourceHeight, width: box.width, height: box.height, zIndex: zIndex + 1, pointerEvents: 'none' }}>
      {junk.pixelRuns.map((run) => <rect key={`${run.x}:${run.y}:${run.width}:${run.color}`} x={run.x} y={run.y} width={run.width} height="1" fill={run.color} />)}
    </svg>}
  </>
})

function PublishedLayoutArt({ layout, state, scale, children }: { layout: SceneComposition; state: AdventureState; scale: number; children?: React.ReactNode }) {
  const ordered = artStackOrder(layout.entities.filter((item) => item.visible))
  const arthurZ = layoutPaintZ(ordered, 'arthur')
  const [steamMs, setSteamMs] = useState(0)
  useEffect(() => {
    if (state.reducedAnimation) return
    const timer = window.setInterval(() => setSteamMs((value) => value + 1000 / MUG_STEAM_FPS), 1000 / MUG_STEAM_FPS)
    return () => window.clearInterval(timer)
  }, [state.reducedAnimation])
  const formOnTable = (state.phase === 'START' || state.phase === 'PEN_HELD') && !state.inventory.includes('blank-terminal-authorization-form')
  const globeMs = state.globeElapsedMs
  const flags = { caseOpen: state.caseFileDrawer === 'OPEN', caseUnsearched: state.caseStack === 'UNSEARCHED', miscOpen: state.miscDrawer === 'OPEN', miscUncollected: state.miscContents === 'UNCOLLECTED', terminalOn: terminalIsPowered(state), penTaken: phaseReached(state, 'PEN_HELD'), steamSrc: state.reducedAnimation ? null : mugSteamFrame(steamMs), globeSrc: state.reducedAnimation ? globeFrame(state.globePose, state.globeLevel, state.globeStartPhase) : globeFrameAt(state.globePose, state.globeLevel, globeMs, state.globeStartPhase), lampPower: state.lampPower }
  const stampOwner = state.activeSequence?.currentPropOwners.DESK_STAMP
  const stampInUse = stampOwner === 'ARTHUR_IN_USE' || (!stampOwner && state.mrIndexPose === 'STAMP')
  const sprites = ordered.filter((item) => item.id !== 'rook' && item.id !== 'arthur' && !(item.id === 'blank-form' && !formOnTable) && !(item.id === 'arthur-stamp' && stampInUse))
  const paint = (item: CompositionEntity) => <PlacedLayoutSprite key={item.id} item={item} src={layoutEntitySrc(item, flags)} scale={scale} zIndex={layoutPaintZ(ordered, item.id)} reduced={state.reducedAnimation} foot={item.id === 'penstand' && flags.penTaken ? { width: 24, height: 7 } : undefined} />
  const globeCursor = globeTimelineCursor(state.globePose, state.globeLevel, state.globeElapsedMs, state.globeStartPhase)
  return <><span hidden data-testid="globe-timeline-cursor" data-visible-phase={globeCursor.visiblePhase} data-angular-phase={globeCursor.angularPhase} data-timeline-phase={globeCursor.timelinePhase} data-entry={globeCursor.entryIdentity} data-entry-index={globeCursor.entryIndex} data-entry-elapsed={globeCursor.elapsedWithinEntryMs} data-entry-dwell={globeCursor.dwellDurationMs} data-entry-progress={globeCursor.fractionalDwellProgress}/>{sprites.filter((item) => layoutPaintZ(ordered, item.id) < arthurZ).map(paint)}{children}{sprites.filter((item) => layoutPaintZ(ordered, item.id) >= arthurZ).map(paint)}</>
}

function Scene({ manifest, state, dispatch, scale, onCaseInteraction, cueSheet = null, layout = null }: { manifest: ArtPackManifest; state: AdventureState; dispatch: React.Dispatch<Parameters<typeof adventureReducer>[1]>; scale: number; onCaseInteraction: (hotspot: Hotspot) => boolean; cueSheet?: CueSheet | null; layout?: SceneComposition | null }) {
  const arthurArt = manifest.characters.mrIndex; const arthurPlacement = layout ? arthurPlacementFromLayout(layout, arthurArt.anchor, arthurArt.scale) : null
  const definition = getSceneDefinition('records-office'); const scene = manifest.scenes['records-office']; const penTaken = phaseReached(state, 'PEN_HELD'); const formOnTable = (state.phase === 'START' || state.phase === 'PEN_HELD') && !state.inventory.includes('blank-terminal-authorization-form'); const visibleHotspots = definition.hotspots.filter(({ visibleFrom }) => isVisibleFrom(visibleFrom, state.phase))
    .filter(({ id }) => id !== 'disorderly-stack-of-confidential-files' || state.caseFileDrawer === 'OPEN')
    .filter(({ id }) => id !== 'miscellaneous-catch-all-contents' || state.miscDrawer === 'OPEN')
  const walkToEmpty = (event: React.MouseEvent<HTMLDivElement>) => { const target = event.target instanceof Element ? event.target : null; if (target?.closest('.hotspot-button') || state.speech || state.dialogueOpen || state.activeSequence) return; const rect = event.currentTarget.getBoundingClientRect(); dispatch({ type: 'WALK_TO', point: clickWalkPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height) }) }
  const formPaperOwner = state.activeSequence?.currentPropOwners.FORM_PAPER ?? (state.inventory.includes('approved-stamped-terminal-authorization-form') ? 'ROOK_APPROVED_INVENTORY' : state.inventory.includes('signed-terminal-authorization-form-with-doodles') ? 'ROOK_INVENTORY' : 'NONE')
  const deskStampOwner = state.activeSequence?.currentPropOwners.DESK_STAMP ?? (state.mrIndexPose === 'STAMP' ? 'ARTHUR_IN_USE' : 'DESK')
  return <div className={`adventure-scene ${state.highContrastHotspots ? 'contrast-hotspots' : ''} ${state.reviewHotspots ? 'review-hotspots' : ''}`} data-testid="records-office" data-opening-stage={state.openingStage} data-lamp-power={state.lampPower} data-form-paper-owner={formPaperOwner} data-desk-stamp-owner={deskStampOwner} data-desk-stamp-visible={deskStampOwner === 'DESK'} data-terminal-powered={terminalIsPowered(state)} data-terminal-authorized={terminalIsAuthorized(state)} data-terminal-can-open={terminalCanOpen(state)} data-live-layout={layout ? '1' : '0'} data-hotspot-total={definition.hotspots.length} data-walk-region={definition.walkRegion.id} inert={interfaceTreatment(state) !== 'ACTIVE' ? true : undefined} onClick={walkToEmpty} onContextMenu={(event) => { event.preventDefault(); dispatch({ type: 'CANCEL_SELECTION' }) }}>
    <div className="scene-art" data-testid="scene-art">
    <AssetImage asset={scene.background} alt="Records Office" className="scene-background pixel-art" />
    {scene.midgroundLayers.map((layer) => <AssetImage key={layer.id} asset={layer.asset} alt="" className="scene-layer pixel-art" style={{ zIndex: layer.depth }} />)}
    <div className="provisional-ribbon">{manifest.status === 'LEAD_SELECTED' ? 'LEAD-SELECTED ART PACK // A1 REVIEW' : 'PROVISIONAL ART HARNESS // NOT FINAL ART'}</div>
    {layout ? <PublishedLayoutArt layout={layout} state={state} scale={scale}><Character manifest={manifest} state={state} character="MR_INDEX" scale={scale} placement={arthurPlacement} cueSheet={cueSheet} /></PublishedLayoutArt> : <>
    {scene.propPlacements.map((placement) => { if (placement.propId === 'pneumaticTube' || placement.propId === 'dispatchPlunger' || placement.propId === 'recordCanister') return null; const prop = manifest.props[placement.propId]!; const asset = propState(placement.propId, prop, state); const band = scene.depthBands.find(({ id }) => id === placement.depthBand); const style = { left: `${(placement.x - asset.width) / 9.6}%`, top: `${(placement.y - asset.height * 2) / 3.6}%`, width: `${asset.width * 2 / 9.6}%`, height: `${asset.height * 2 / 3.6}%`, zIndex: band?.zIndex ?? 4 }; return <span className={`manifest-prop prop-${placement.propId}`} style={style} data-prop={placement.propId} data-depth-band={placement.depthBand} key={placement.propId}><AssetImage asset={asset} alt={`Provisional ${placement.propId}`} className="pixel-art" /></span> })}
    {manifest.id === 'production' ? <img className="pixel-art production-prop" alt="" data-testid="production-globe" data-globe-pose={state.globePose} data-globe-level={state.globeLevel} data-globe-decay={state.globeDecayStage} src={state.reducedAnimation ? globeFrame(state.globePose, state.globeLevel, state.globeStartPhase) : globeFrameAt(state.globePose, state.globeLevel, state.globeElapsedMs, state.globeStartPhase)} style={{ ...gameBoxStyle(globeGameBox(state.rookPosition.y - manifest.characters.rook.anchor.y * manifest.characters.rook.scale)), zIndex: 5 }} /> : <span className="globe-placeholder" role="img" aria-label="Office globe placeholder; production asset not installed">GLOBE<br/>PLACEHOLDER</span>}
    {manifest.id === 'production' && <img className="pixel-art production-prop" alt="" data-testid="official-cabinet-art" src={`/art-packs/production/files/production/furniture/cabinet-contents/frames/${state.caseFileDrawer === 'OPEN' ? 'cabinet_open__drawer_02_filed_open.png' : 'cabinet_closed.png'}`} style={{ ...gameBoxStyle(OFFICIAL_CABINET_ART), zIndex: 4 }} />}
    {manifest.id === 'production' && <img className="pixel-art production-prop" alt="" data-testid="misc-cabinet-art" src={`/art-packs/production/files/production/furniture/upper-drawer/frames/${state.miscDrawer === 'OPEN' ? 'cabinet_open.png' : 'cabinet_closed.png'}`} style={{ ...gameBoxStyle(MISC_CABINET_ART), zIndex: 4 }} />}
    <Character manifest={manifest} state={state} character="MR_INDEX" scale={scale} placement={arthurPlacement} cueSheet={cueSheet} />
    </>}
    {scene.foregroundLayers.map((layer) => <AssetImage key={layer.id} asset={layer.asset} alt="" className="scene-layer foreground-layer pixel-art" style={{ zIndex: layer.depth }} />)}</div>
    {state.openingStage !== 'ARTHUR_PAPER' && <Character manifest={manifest} state={state} character="ROOK" scale={scale} cueSheet={cueSheet} />}
    <svg className="hotspot-polygons" viewBox="0 0 960 360" aria-hidden="true"><polygon className="walk-region" points={definition.walkRegion.polygon} />{visibleHotspots.map((hotspot) => <polygon key={hotspot.id} points={hotspot.polygon} data-hotspot-polygon={hotspot.id} />)}</svg>
    {[...visibleHotspots.filter((hotspot) => !(hotspot.id === 'pen-stand' && penTaken) && !(hotspot.id === 'blank-authorization-form' && !formOnTable) && (!layout || (hotspot.id !== 'filing-drawers' && hotspot.id !== 'historical-clock'))), ...(layout ? layoutPropHotspots.filter((hotspot) => layoutHotspotPixels(layout, hotspot.id, scale) && !(hotspot.id === 'blank-authorization-form' && !formOnTable) && !(hotspot.id === 'pen-stand' && penTaken)) : [])].map((hotspot) => { const placed = layout ? layoutHotspotPixels(layout, hotspot.id, scale) : null; if (layout && !placed && hotspot.id !== 'window') return null; const windowPlate = windowGameBox(scale); const walkTo = layout ? layoutHotspotWalkTo(layout, hotspot.id, state.rookPosition.x) : null; const targetId = drawerInteractionTarget(hotspot, state.selectedVerb); return <button key={hotspot.id} type="button" className="hotspot-button" style={placed ?? (hotspot.id === 'window' ? windowPlate : hotspotBounds(hotspot))} data-testid={`hotspot-${hotspot.id}`} aria-label={hotspot.id==='mr-index'?contentText('lane_a.hotspot.mr-index.aria',publicObjectName(hotspot,true)):hotspot.ariaLabel} onPointerEnter={() => dispatch({ type: 'HOVER_HOTSPOT', hotspotId: targetId })} onPointerLeave={() => dispatch({ type: 'HOVER_HOTSPOT', hotspotId: null })} onFocus={() => dispatch({ type: 'HOVER_HOTSPOT', hotspotId: targetId })} onBlur={() => dispatch({ type: 'HOVER_HOTSPOT', hotspotId: null })} onClick={(event) => { event.stopPropagation(); if (state.speech || state.dialogueOpen || state.activeSequence || onCaseInteraction(hotspot)) return; dispatch(state.selectedVerb ? { type: 'INTERACT', targetId } : { type: 'WALK_TO', point: walkTo ?? hotspot.walkTo }) }} /> })}
  </div>
}

function performanceData(state: NonNullable<AdventureState['speech']>) { return Object.entries(state.performance.intentions).flatMap(([actor, tracks]) => Object.entries(tracks ?? {}).map(([track, value]) => `${actor}:${track}:${value}`)).join('|') }
function overheadStyle(manifest: ArtPackManifest, state: AdventureState, speaker: string, layout: SceneComposition | null): React.CSSProperties {
  if (speaker === 'TERMINAL') {
    const terminal = state.runtimeSession.targets['nansen-terminal']
    const position = terminal?.visible ? { x: terminal.centerX, y: terminal.centerY - 35 } : { x: 306, y: 86 }
    return { left: `${position.x / 9.6}%`, top: `${Math.max(18, position.y) / 5.4}%` }
  }
  const arthur = speaker === 'MR_INDEX'
  const art = arthur ? manifest.characters.mrIndex : manifest.characters.rook
  const placed = arthur && layout ? arthurPlacementFromLayout(layout, art.anchor, art.scale) : null
  const position = placed?.position ?? (arthur ? manifest.scenes['records-office'].characterAnchors.mrIndex! : state.rookPosition)
  const headY = Math.max(18, position.y - art.anchor.y * art.scale)
  return { left: `${position.x / 9.6}%`, top: `${headY / 5.4}%` }
}
export function SpeechPanel({ state, dispatch, manifest, layout = null }: { state: AdventureState; dispatch: React.Dispatch<Parameters<typeof adventureReducer>[1]>; manifest: ArtPackManifest; layout?: SceneComposition | null }) { const line = currentSpeechLine(state); if (!line || !state.speech) return null; return <>{state.introSkipUsed && line.copyKey === 'OPEN-077' && <span className="sr-only" role="status" aria-live="polite" data-testid="intro-skip-announcement">Intro skipped. Arthur's final instructions begin.</span>}<GameDialoguePresentation line={line} visibleCharacters={state.speech.visibleCharacters} mode={state.dialoguePresentation} reducedMotion={state.reducedAnimation} crossedCueIds={state.speech.performance.crossedCueIds} performance={performanceData(state.speech)} afterLineHold={state.speech.performance.afterLineHold} lineIndex={state.speech.lineIndex} style={overheadStyle(manifest, state, line.speaker, layout)} onAdvance={() => dispatch({ type: 'ADVANCE_SPEECH' })}/></> }
function NonblockingSpeechDelivery({ state, dispatch, manifest, layout, active }: { state: AdventureState; dispatch: React.Dispatch<Parameters<typeof adventureReducer>[1]>; manifest: ArtPackManifest; layout: SceneComposition | null; active: NonNullable<AdventureState['nonblockingSpeech']> }) {
  const line = active.lines[active.lineIndex]!
  const desiredStyle = overheadStyle(manifest, state, line.speaker, layout)
  const { nodeRef, measureRef, clampStyle, fullDeliveryWidth } = useFullDeliveryClamp(line.text, desiredStyle.left)
  const revealing = active.visibleCharacters < line.text.length
  return <aside ref={nodeRef} className="nonblocking-speech overhead-line" data-testid="nonblocking-speech" data-speaker={line.speaker} data-copy-key={line.sourceCopyKey ?? line.copyKey} data-delivery-key={line.copyKey} data-display-policy={effectiveReadingDisplay(line, state.dialogueDisplay, state.instantText)} data-revealing={revealing ? 'true' : 'false'} data-crossed-cues={active.performance.crossedCueIds.join(',')} data-performance={performanceData(active)} data-full-delivery-width={fullDeliveryWidth} aria-label={`${publicSpeaker(line.speaker)}: ${line.sourceText ?? line.text}`} style={{ ...desiredStyle, ...clampStyle }}><span ref={measureRef} className="full-delivery-measure" aria-hidden="true">{line.text}</span><strong className="sr-only">{publicSpeaker(line.speaker)}</strong><span aria-hidden="true">{line.text.slice(0, active.visibleCharacters)}</span><span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{publicSpeaker(line.speaker)}: {line.text}</span><button onClick={() => dispatch({ type: 'ADVANCE_SPEECH', channel: 'NONBLOCKING' })} onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') event.preventDefault() }}>{revealing ? 'REVEAL OPTIONAL LINE' : 'NEXT OPTIONAL LINE'}</button></aside>
}
function NonblockingSpeechPanel({ state, dispatch, manifest, layout = null }: { state: AdventureState; dispatch: React.Dispatch<Parameters<typeof adventureReducer>[1]>; manifest: ArtPackManifest; layout?: SceneComposition | null }) {
  const active = state.nonblockingSpeech
  if (!active || state.speech) return null
  return <NonblockingSpeechDelivery state={state} dispatch={dispatch} manifest={manifest} layout={layout} active={active}/>
}
function ActiveSequencePanel({ state }: { state: AdventureState }) { const sequence = state.activeSequence; if (!sequence) return null; return <aside className="active-sequence" data-testid="active-sequence" data-sequence={sequence.id} data-action-index={sequence.actionIndex} data-action-id={sequence.currentActionId ?? ''} data-status={sequence.status} data-selected-verb={sequence.selectedVerb ?? ''} data-actor-intentions={Object.entries(sequence.currentActorIntentions).map(([actor, intention]) => `${actor}:${intention}`).join(',')} data-contact={sequence.currentSemanticContact ?? ''} data-physical-pose={sequence.currentPhysicalPoseClass ?? ''} data-form-paper-owner={sequence.currentPropOwners.FORM_PAPER ?? ''} data-desk-stamp-owner={sequence.currentPropOwners.DESK_STAMP ?? ''} data-mutation-applied={sequence.stateChangeOccurred} data-stage={sequence.currentStage ?? sequence.waitingSpeechStage ?? ''} data-focus-return={sequence.focusReturnTarget}><span aria-hidden="true">{sequence.id.replace('SEQUENCE.', '').replaceAll('_', ' ')}</span><strong aria-hidden="true">{sequence.currentCaptionIntention ?? sequence.currentSemanticContact ?? 'READY'}</strong>{sequence.currentCaptionIntention && <span className="sr-only" role="status" aria-live="polite">{sequence.currentCaptionIntention}</span>}</aside> }
function DialoguePanel({ state, dispatch }: { state: AdventureState; dispatch: React.Dispatch<Parameters<typeof adventureReducer>[1]> }) { if (!state.dialogueOpen || state.speech) return null; const topics = dialogueTopicsForState(state); return <section className="dialogue-panel" data-testid="dialogue-panel" role="dialog" aria-modal="true" aria-labelledby="dialogue-title"><p id="dialogue-title">TALK TO {publicSpeaker('archivist',true)}</p><span className="sr-only" role="status" aria-live="polite">{state.dialogueAnnouncement}</span>{topics.map((topic, index) => <button autoFocus={index === 0} key={topic.id} data-testid={`dialogue-${topic.id}`} onClick={() => dispatch({ type: 'CHOOSE_DIALOGUE_TOPIC', topicId: topic.id })}>{topic.label}</button>)}</section> }
function Transcript({ state }: { state: AdventureState }) { return <details className="dialogue-transcript" data-testid="dialogue-transcript"><summary>TRANSCRIPT · {state.transcript.length} LINES</summary><ol>{state.transcript.map((entry) => <li key={entry.sequence}><strong>{publicSpeaker(entry.speaker)}:</strong> {entry.text}<small>{entry.channel}</small></li>)}</ol></details> }
function EvidenceDrawer({ state, dispatch, record }: { state: AdventureState; dispatch: React.Dispatch<Parameters<typeof adventureReducer>[1]>; record: FirstBreachRecord }) { if (!state.recordArchived) return null; return <aside className={`evidence-drawer ${state.evidenceDrawerOpen ? 'open' : ''}`} data-testid="evidence-drawer"><button className="evidence-tab" data-testid="toggle-evidence" onClick={() => dispatch({ type: 'TOGGLE_EVIDENCE_DRAWER' })}>RECORDS 1</button>{state.evidenceDrawerOpen && <article data-testid="first-breach-record"><span>FACTUAL RECORD // {record.proofGrade}</span><h2>{record.title}</h2><strong>{record.displayTime}</strong><p>{record.displayAmount}</p><details><summary>EXACT / PROVIDER DETAILS</summary><p>{record.exactClaim}</p><dl><dt>SOURCE</dt><dd>{record.source}</dd><dt>PRECISION</dt><dd>{record.precision}</dd><dt>TRANSACTION</dt><dd><code>{record.transactionHash}</code></dd><dt>TIME CLASS</dt><dd>{record.temporalClass}</dd><dt>ACCEPTED CUTOFF</dt><dd>{record.historicalCutoffUtc}</dd></dl></details><small>THE OFFICE PUZZLE IS FICTIONAL FRAMING. ONLY THIS RECORD ENTERS EVIDENCE.</small></article>}</aside> }
function CompletionCard({ manifest }: { manifest: ArtPackManifest }) { return <section className="a0-completion" data-testid="authorization-complete"><span>TERMINAL AUTHORIZED.</span><h1>AUTHORIZATION COMPLETE</h1><strong>{manifest.status === 'LEAD_SELECTED' ? 'ART PACK ACTIVE' : 'ART PACK PENDING'}</strong></section> }

function dimensions(value: ArtPackAssetDiagnostic['declaredDimensions']) { return value ? `${value.width}×${value.height}` : '—' }
function fingerprint(value: string | null) { return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : '—' }
function ArtPackDiagnosticsPanel({ diagnostics }: { diagnostics: ArtPackDiagnostics }) {
  const slots = [...diagnostics.requiredSlots, ...diagnostics.optionalSlots]
  const complete = diagnostics.disposition === 'COMPLETE_PLACEHOLDER' || diagnostics.disposition === 'COMPLETE_LEAD_SELECTED'
  const summary = complete
    ? 'REQUIRED SLOTS COMPLETE'
    : diagnostics.disposition === 'EMPTY_INHERITING_PLACEHOLDER'
      ? 'ZERO CANDIDATE ASSETS INSTALLED // PLACEHOLDER INHERITED'
      : diagnostics.disposition === 'LEAD_SELECTED_WITH_OPTIONAL_OMISSIONS'
        ? `CANDIDATE ACTIVE // REQUIRED SLOTS PASS // ${diagnostics.invalidSlots.length} OPTIONAL ASSET(S) OMITTED`
        : `CANDIDATE NOT ACTIVE // ${diagnostics.invalidSlots.length} INVALID REQUIRED/DECLARED SLOT(S)`
  return <section className="art-diagnostics" data-testid="art-pack-diagnostics" aria-labelledby="art-diagnostics-title"><header><div><span>PACK INTEGRITY</span><h2 id="art-diagnostics-title">{diagnostics.disposition}</h2></div><dl><dt>REQUESTED</dt><dd>{diagnostics.requestedPackId}</dd><dt>INDEX</dt><dd>{diagnostics.indexEntry ? `${diagnostics.indexEntry.id} / ${diagnostics.indexEntry.status}` : 'NOT FOUND'}</dd><dt>MANIFEST</dt><dd>{diagnostics.manifestIdentity ? `${diagnostics.manifestIdentity.id} / ${diagnostics.manifestIdentity.status}` : 'NOT LOADED'}</dd><dt>LOADED</dt><dd>{diagnostics.loadedPackId} / {diagnostics.loadedPackStatus}</dd><dt>CONSISTENCY</dt><dd>{diagnostics.indexManifestConsistent ? 'PASS' : 'FAIL'}</dd><dt>FALLBACK</dt><dd>{diagnostics.placeholderInheritance ? 'PLACEHOLDER INHERITED' : diagnostics.fallbackActive ? 'ACTIVE' : 'NONE'}</dd></dl><strong data-testid="art-slot-summary">{summary}</strong></header><div className="diagnostic-table-wrap"><table><caption>Required and optional semantic asset diagnostics</caption><thead><tr><th>SLOT</th><th>PATH</th><th>TYPE</th><th>DECLARED</th><th>ACTUAL</th><th>CONTRACT</th><th>SHA-256</th><th>STATUS</th></tr></thead><tbody>{slots.map((slot) => <tr key={slot.semanticSlot} data-slot={slot.semanticSlot} data-slot-status={slot.status} data-fingerprint={slot.contentFingerprint ?? undefined}><th scope="row">{slot.semanticSlot}</th><td>{slot.sourcePath ?? '—'}</td><td>{slot.requirement}</td><td>{dimensions(slot.declaredDimensions)}</td><td>{dimensions(slot.actualDimensions)}</td><td>{dimensions(slot.expectedDimensions)}</td><td><code title={slot.contentFingerprint ?? undefined}>{fingerprint(slot.contentFingerprint)}</code></td><td><strong>{slot.status}</strong><small>{slot.detail}</small></td></tr>)}</tbody></table></div></section>
}

function publicArtStatus(diagnostics: ArtPackDiagnostics) { return diagnostics.disposition === 'EMPTY_INHERITING_PLACEHOLDER' ? 'AUDITION_EMPTY' : diagnostics.loadedPackStatus }
function ReviewPanel({ state, dispatch, packId, setPackId, packIndex, diagnostics }: { state: AdventureState; dispatch: React.Dispatch<Parameters<typeof adventureReducer>[1]>; packId: string; setPackId: (id: string) => void; packIndex: ArtPackIndex; diagnostics: ArtPackDiagnostics }) { return <aside className="a0-review" data-testid="review-mode"><strong>G6P-A1-R2 REVIEW</strong><span>PHASE {state.phase}</span><span>VERB {state.selectedVerb ?? 'WALK_TO'}</span><span>ITEM {state.selectedItemId ?? 'NONE'}</span><span>ART {publicArtStatus(diagnostics)}</span><span>INTEGRITY {diagnostics.disposition}</span><span>LOADED {diagnostics.loadedPackId}</span><label>STATE<select aria-label="Jump to puzzle state" value={state.phase} onChange={(event) => dispatch({ type: 'REVIEW_JUMP', phase: event.target.value as AdventureState['phase'] })}>{PHASE_ORDER.map((phase) => <option key={phase}>{phase}</option>)}</select></label><label>ART PACK<select aria-label="Art pack" value={packId} onChange={(event) => setPackId(event.target.value)}>{packIndex.packs.map((pack) => <option value={pack.id} key={pack.id}>{pack.label}</option>)}</select></label><button onClick={() => dispatch({ type: 'TOGGLE_REVIEW_HOTSPOTS' })}>HOTSPOTS {state.reviewHotspots ? 'ON' : 'OFF'}</button><button onClick={() => dispatch({ type: 'REVIEW_TALKING' })}>TALKING STATE</button><button onClick={() => dispatch({ type: 'RESET' })}>RESET WITH INTRO</button></aside> }

function ArtLab({ manifest, semanticCatalog, performanceProfile, packIndex, packId, setPackId, diagnostics }: { manifest: ArtPackManifest; semanticCatalog: CharacterAnimationCatalog; performanceProfile: PerformanceProfile; packIndex: ArtPackIndex; packId: string; setPackId: (id: string) => void; diagnostics: ArtPackDiagnostics }) {
  const [intention, setIntention] = useState<PerformanceIntention>('IDLE')
  const [sceneId, setSceneId] = useState<SceneId>('records-office')
  const [mode, setMode] = useState<'idle' | 'walk' | 'talk' | 'props'>('walk')
  const [nearest, setNearest] = useState(true)
  const [geometry, setGeometry] = useState(true)
  const scene = manifest.scenes[sceneId]
  const definition = getSceneDefinition(sceneId)
  const rook = manifest.characters.rook
  const rookAnimation = mode === 'talk' ? talkAnimation(rook.animations.talkClosed!, rook.animations.talkOpen!, 'ROOK') : mode === 'walk' ? rook.animations.walkEast! : rook.animations.idle!
  const semanticRows = semanticCatalogDiagnostics(semanticCatalog)
  const semanticComplete = manifest.status !== 'LEAD_SELECTED' || (performanceProfile.status === 'LEAD_REVIEWED' && validatePerformanceProfile(performanceProfile))
  const semanticPreviewFrame = semanticCatalog.characters.rook['idle.neutral'].frames[0]
  const semanticPreviewAsset = semanticPreviewFrame ? semanticCatalog.assets[semanticPreviewFrame.assetSlot] : undefined
  const legacyComplete = diagnostics.disposition === 'COMPLETE_PLACEHOLDER' || diagnostics.disposition === 'COMPLETE_LEAD_SELECTED'
  return <main className={`art-lab ${nearest ? 'nearest' : 'smooth'}`} data-testid="art-lab">
    <header><div><span>HIDDEN REVIEW ROUTE</span><h1>ART LAB // MANIFEST v2 + SEMANTIC v1</h1><p>{diagnostics.indexEntry?.label ?? diagnostics.requestedPackId} · {diagnostics.disposition}</p></div><label>PACK<select aria-label="Art Lab pack" value={packId} onChange={(event) => setPackId(event.target.value)}>{packIndex.packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.label}</option>)}</select></label><label>SCENE<select aria-label="Art Lab scene" value={sceneId} onChange={(event) => setSceneId(event.target.value as SceneId)}><option value="records-office">Records Office</option><option value="blank-shell">Blank fixture</option></select></label></header>
    <nav><button aria-pressed={mode === 'idle'} onClick={() => setMode('idle')}>IDLE</button><button aria-pressed={mode === 'walk'} onClick={() => setMode('walk')}>WALK LOOP</button><button aria-pressed={mode === 'talk'} onClick={() => setMode('talk')}>TALK LOOP</button><button aria-pressed={mode === 'props'} onClick={() => setMode('props')}>PROP STATES</button><button aria-pressed={nearest} onClick={() => setNearest(!nearest)}>NEAREST {nearest ? 'ON' : 'OFF'}</button><button aria-pressed={geometry} onClick={() => setGeometry(!geometry)}>GEOMETRY {geometry ? 'ON' : 'OFF'}</button></nav>
    <section className="lab-scene" data-scene={sceneId}><AssetImage asset={scene.background} alt={`${definition.label} background`} />{scene.midgroundLayers.map((layer) => <AssetImage asset={layer.asset} alt="" key={layer.id} />)}{geometry && <svg viewBox="0 0 960 360"><polygon className="lab-walk" points={definition.walkRegion.polygon}/>{definition.hotspots.map((hotspot) => <polygon key={hotspot.id} points={hotspot.polygon}/>)}</svg>}</section>
    <section className="lab-assets">
      <article><h2>ROOK // {mode}</h2><AnimatedImage key={mode} animation={rookAnimation} active={mode === 'walk' || mode === 'talk'} reduced={false} alt="Rook animation preview" testId="art-lab-rook"/><small>{rookAnimation.frames.length} frame(s) · {rookAnimation.fps} FPS · mirror west {String(rook.mirrorHorizontal)}</small></article>
      <article><h2>ARCHIVIST // INTERNAL ID</h2><AnimatedImage key={mode} animation={mode === 'talk' ? talkAnimation(manifest.characters.mrIndex.animations.talkClosed!, manifest.characters.mrIndex.animations.talkOpen!, 'MR_INDEX') : manifest.characters.mrIndex.animations.idle!} active={mode === 'talk'} reduced={false} alt={`${publicObjectName({id:'archivist',name:'Archivist'},true)} animation preview`}/><small>{publicObjectName({id:'archivist',name:'Archivist'},true)} — binding public name; internal/art IDs unchanged</small></article>
      <article data-testid="semantic-render-preview"><h2>SEMANTIC SIDE-CAR RENDER</h2>{semanticPreviewAsset ? <AssetImage asset={semanticPreviewAsset} alt="Rook semantic idle preview"/> : <span>OPTIONAL_UNINSTALLED</span>}<small>{semanticCatalog.packId} // {semanticPreviewFrame?.assetSlot ?? 'missing'}</small></article>
      <article className="lab-props"><h2>PROP STATES</h2>{Object.entries(manifest.props).flatMap(([id, prop]) => [[`${id}:default`, prop.default] as const, ...Object.entries(prop.states).map(([state, asset]) => [`${id}:${state}`, asset] as const)]).map(([label, asset]) => <span key={label}><AssetImage asset={asset} alt={label}/><small>{label}</small></span>)}</article>
      <article className="lab-inventory"><h2>INVENTORY</h2>{Object.entries(manifest.inventory).map(([id, asset]) => <span key={id}><AssetImage asset={asset} alt={id}/><small>{id}</small></span>)}</article>
    </section>
    <section data-testid="s7-r2a-placeholder-contract" aria-label="S7 R2A placeholder interaction and staging contract"><h2>INTERACTION / STAGING PLACEHOLDER CONTRACT</h2><p>Production art remains late-bound. Every sequence completes through generic IDLE / TALK / LISTEN / USE or static text fallback.</p><p>HERO HOTSPOTS: {HERO_HOTSPOTS.join(' · ')}</p><p>SEMANTIC MARKS: {STAGE_MARKS.join(' · ')}</p></section>
    <section className="art-diagnostics" data-testid="semantic-catalog-diagnostics"><header><div><span>PLACEHOLDER/FUTURE-ART SEAM</span><h2>SEMANTIC CATALOG v1</h2></div><strong>{semanticRows.length} SEMANTIC STATES</strong></header><div className="diagnostic-table-wrap"><table><thead><tr><th>ID</th><th>RESOLUTION</th><th>ASSET SLOT</th><th>MIRROR</th><th>SEQUENCE</th><th>ANCHOR</th><th>REDUCED MOTION</th><th>STATUS</th></tr></thead><tbody>{semanticRows.map((row) => <tr key={row.semanticId}><th>{row.semanticId}</th><td>{row.resolution}</td><td>{row.resolvedAssetSlots.join(', ')}</td><td>{row.mirror}</td><td>{row.sequence}</td><td>{row.anchor.x},{row.anchor.y}</td><td>{row.reducedMotion}</td><td>{row.status}</td></tr>)}</tbody></table></div></section>
    <ArtPackDiagnosticsPanel diagnostics={diagnostics}/>
    <section aria-label="Late-bound performance capabilities"><h2>CAPABILITY PREVIEW — PRODUCTION ART {performanceProfile.status}</h2><p>The 69-row catalog above is a placeholder demo, not a production delivery requirement. Missing intentions fall back to idle; variable clips and static speech are allowed.</p><label>Performance intention<select aria-label="Performance intention" value={intention} onChange={(event) => setIntention(event.target.value as PerformanceIntention)}>{PERFORMANCE_INTENTIONS.map((value) => <option key={value}>{value}</option>)}</select></label><PerformancePortrait key={intention} profile={performanceProfile} character="rook" request={{ intention, facing: 'LEFT' }} revealing={intention === 'SPEAK'}/><PerformancePortrait key={`archivist:${intention}`} profile={performanceProfile} character="archivist" request={{ intention }} revealing={intention === 'SPEAK'}/></section>
    <footer><span>NATIVE {manifest.nativeResolution.width}×{manifest.nativeResolution.height}</span><span>BROWSER {manifest.browserResolution.width}×{manifest.browserResolution.height}</span><span>{manifest.scalingMode}</span><span>{legacyComplete && semanticComplete ? 'REQUIRED SLOTS COMPLETE' : 'CANDIDATE NOT COMPLETE'}</span><span>{definition.playable ? 'PLAYABLE SCENE' : 'NONPLAYABLE PORTABILITY FIXTURE'}</span></footer>
  </main>
}

function AnimationDirectorHost() {
  const [Comp, setComp] = useState<React.ComponentType | null>(null)
  useEffect(() => { void import('./AnimationDirector').then((mod) => setComp(() => mod.AnimationDirector)) }, [])
  return Comp ? <Comp /> : <main data-testid="animation-director-loading">Loading animation director</main>
}

function ArtLayoutHost() {
  const [Comp, setComp] = useState<React.ComponentType | null>(null)
  useEffect(() => { void import('./ArtLayoutWorkbench').then((mod) => setComp(() => mod.ArtLayoutWorkbench)) }, [])
  return Comp ? <Comp /> : <main data-testid="art-layout-loading">Loading art layout</main>
}

function DetailReviewHost() {
  const [Comp, setComp] = useState<React.ComponentType | null>(null)
  useEffect(() => { void import('./DetailReview').then((mod) => setComp(() => mod.DetailReview)) }, [])
  return Comp ? <Comp /> : <main data-testid="detail-review-loading">Loading detail review</main>
}

function ProductionGame({ onComplete = () => undefined }: { onComplete?: (status: SideLeadCompletion) => void }) {
  const integerScale = useIntegerViewportScale()
  const privateReviewTools = import.meta.env.VITE_TARKA_REVIEW_TOOLS === '1'
  const query = useMemo(() => new URLSearchParams(window.location.search), []); const reviewMode = import.meta.env.DEV && query.get('review') === '1'; const artLabMode = import.meta.env.DEV && (query.get('artLab') === '1' || query.get('artCompare') === '1'); const missionMode = import.meta.env.DEV && query.get('mission') === '1'; const [packId, setPackId] = useState(query.get('artPack') ?? 'production')
  const [loaded, setLoaded] = useState<{ manifest: ArtPackManifest; semanticCatalog: CharacterAnimationCatalog; performanceProfile: PerformanceProfile; record: FirstBreachRecord; packIndex: ArtPackIndex; diagnostics: ArtPackDiagnostics } | null>(null)
  const devLayout = useMemo(() => (import.meta.env.DEV ? readDefaultLayout() ?? productionComposition : productionComposition), [])
  const runtimeSession = useMemo(() => buildRuntimeSession(devLayout), [devLayout])
  // The shipped game is driven by the approved script bindings. The mutable
  // director sheet belongs to the review tool only; loading it into ordinary
  // development gameplay can silently override the approved finite reactions.
  const cueSheet = useMemo<CueSheet | null>(() => null, [])
  const timerSession = useSemanticTimers()
  const timers = timerSession.owner
  const clock = timerSession.clock
  const [state, dispatch] = useReducer(adventureReducer, undefined, () => createInitialAdventureState({ skipIntro: reviewMode || artLabMode || query.get('skipIntro') === '1', session: runtimeSession, dialogue: readDialoguePreferences(browserStorage()) })); const cursorRef = useRef<HTMLSpanElement | null>(null); const [hoveredInventoryId, setHoveredInventoryId] = useState<string | null>(null)
  const [fixture, setFixture] = useState<CaseFixture | null>(null)
  const [caseState, setCaseState] = useState<InvestigationState | null>(null)
  const terminalOpen = state.worldQuiescent && !state.terminalEntryPending && terminalCanOpen(state)
  const semanticPaused = state.worldQuiescent || state.introSkipConfirmationOpen
  const [caseError, setCaseError] = useState<string | null>(null)
  const [endingStatus, setEndingStatus] = useState<SideLeadCompletion | null>(null)
  const [pendingEndingStatus, setPendingEndingStatus] = useState<SideLeadCompletion | null>(null)
  const musicScene: BackgroundMusicScene = pendingEndingStatus || endingStatus ? 'CASE_CLOSED' : terminalOpen ? 'TERMINAL' : 'OFFICE'
  useEffect(() => { void backgroundMusic.setScene(musicScene) }, [musicScene])
  const blockingFocus = useRef<HTMLElement | null>(null)
  const hadBlockingSpeech = useRef(false)
  useEffect(() => {
    let current = true
    loadFrozenFixture().then((frozen) => {
      if (!current) return
      const nextFixture = reviewMode && query.get('caseFixture') === 'synthetic' ? syntheticFixture(frozen) : frozen
      const key = `trace-case-v1:${nextFixture.id}:${nextFixture.records.map(({ provenance }) => provenance.normalizedSha256).join(':')}`
      setFixture(nextFixture)
      setCaseState(readSavedInvestigation(nextFixture, key))
    }).catch(() => { if (current) setCaseError('Frozen investigation corpus unavailable. The accepted opening puzzle remains playable.') })
    return () => { current = false }
  }, [query, reviewMode])
  const storageKey = fixture ? `trace-case-v1:${fixture.id}:${fixture.records.map(({ provenance }) => provenance.normalizedSha256).join(':')}` : null
  useEffect(() => { if (caseState && storageKey && fixture) commitInvestigationSave(browserStorage(), storageKey, fixture, caseState) }, [caseState, storageKey, fixture])
  useEffect(() => {
    if (!fixture) return
    const office = { phase: state.phase, inventory: state.inventory, piggyNoteReadState: state.piggyNoteReadState }
    // Post-commit boundary. The helper is idempotent, so a repeated effect does not append commands.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronization is committed after render, not during it
    setCaseState((previous) => {
      if (!previous) return previous
      const synced = synchronizeOfficeMilestones(fixture, previous, office)
      return synced === previous ? previous : synced
    })
  }, [fixture, state.phase, state.inventory, state.piggyNoteReadState])
  useEffect(() => {
    if (!caseState) return
    const milestone = caseState.complete ? 'PROOF_COMPLETE' : caseState.exactConvergenceVerified || caseState.s13VerifiedRecordId ? 'EXACT_RECEIPT' : caseState.s13FilterStage >= 4 ? 'AFTER_Q2' : caseState.s13FilterStage >= 2 ? 'AFTER_Q1' : 'BEFORE_Q1'
    const brcg = caseState.sideLead.resolved ? 'RESOLVED' : caseState.sideLead.noteDiscovered ? 'UNTESTED' : 'UNREAD'
    dispatch({ type: 'SYNC_INVESTIGATION_CONTEXT', milestone, brcg })
  }, [caseState])
  useEffect(() => {
    if (!pendingEndingStatus || !state.returnExchangePlayed || state.speech) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the ending starts only after the office exchange has visibly completed
    setEndingStatus(pendingEndingStatus)
    setPendingEndingStatus(null)
  }, [pendingEndingStatus, state.returnExchangePlayed, state.speech])
  const sendCase = (command: Command) => {
    if (!fixture || state.phase !== 'COMPLETE') return
    setCaseState((previous) => investigationReducer(fixture, synchronizeOfficeMilestones(fixture, investigationBase(fixture, previous), state), command))
  }
  const onCaseInteraction = () => false
  useEffect(() => { let current = true; Promise.all([loadArtPackIndex(), loadAcceptedFirstBreachRecord()]).then(async ([packIndex, record]) => { const result = await loadArtPack(packId, packIndex); const semanticCatalog = await loadCharacterAnimationCatalog(result.manifest.id, result.manifest.status); const performanceProfile = await loadPerformanceProfile(result.manifest.id, result.manifest.status === 'LEAD_SELECTED', semanticCatalog); await preloadRenderedCharacterImages(result.manifest, performanceProfile); if (current) setLoaded({ performanceProfile, manifest: result.manifest, semanticCatalog, record, packIndex, diagnostics: result.diagnostics }) }); return () => { current = false } }, [packId])
  useEffect(() => { if (loaded?.manifest.id === 'production') preloadGlobeFrames() }, [loaded?.manifest.id])
  useEffect(() => { if (import.meta.env.DEV) (window as Window & { __TRACE_TIMER_SESSION__?: number }).__TRACE_TIMER_SESSION__ = timerSession.id }, [timerSession])
  useEffect(() => writeDialoguePreferences(browserStorage(), { mode: state.dialogueMode, pace: state.dialoguePace, display: state.dialogueDisplay }), [state.dialogueMode, state.dialoguePace, state.dialogueDisplay])
  useEffect(() => { timers.invalidateAll() }, [state.lifecycleEpoch, semanticPaused, timers])
  useEffect(() => () => timers.invalidateAll(), [timers])
  useEffect(() => bindWalkTimer(timers, clock, state.walk, semanticPaused, dispatch), [state.walk, semanticPaused, timers, clock, dispatch])
  useEffect(() => bindGlobeTimer(timers, clock, {
    globeMotion: state.globeMotion,
    worldQuiescent: semanticPaused,
  }, dispatch), [state.globeMotion, state.lifecycleEpoch, semanticPaused, timers, clock, dispatch])
  useEffect(() => bindTerminalPresentationTimer(timers, clock, state.terminalEntryPending, state.introSkipConfirmationOpen || Boolean(state.intentReplacement || state.walk || state.activeSequence || state.phase !== 'COMPLETE'), dispatch), [state.terminalEntryPending, state.introSkipConfirmationOpen, state.intentReplacement, state.walk, state.activeSequence, state.phase, timers, clock, dispatch])
  const terminalWasOpen = useRef(false)
  const terminalLandingReset = useRef(false)
  useLayoutEffect(() => {
    const wasOpen = terminalWasOpen.current
    if (terminalOpen && fixture && !terminalLandingReset.current) {
      terminalLandingReset.current = true
      setCaseState((previous) => {
        if (!previous || (previous.section === 'CASE' && previous.s16RecordContext === null)) return previous
        let landing = previous
        if (landing.s16RecordContext) landing = investigationReducer(fixture, landing, { type: 'S16_CLOSE_RECORD' })
        if (landing.section !== 'CASE') landing = investigationReducer(fixture, landing, { type: 'SECTION', section: 'CASE' })
        return landing
      })
    }
    if (!terminalOpen) terminalLandingReset.current = false
    if (wasOpen && !terminalOpen) (document.querySelector<HTMLElement>('[data-testid="hotspot-nansen-terminal"]') ?? document.querySelector<HTMLElement>('[data-testid="verb-give"]'))?.focus()
    terminalWasOpen.current = terminalOpen
  }, [fixture, terminalOpen])
  useEffect(() => bindReplacementTimer(timers, clock, state.intentReplacement?.id, semanticPaused, dispatch), [state.intentReplacement?.id, semanticPaused, timers, clock, dispatch])
  useEffect(() => bindSequenceTimer(timers, clock, state.activeSequence, state.reducedAnimation, semanticPaused, dispatch), [state.activeSequence, state.reducedAnimation, semanticPaused, timers, clock, dispatch])
  useEffect(() => bindSpeechRevealTimer(timers, clock, state.speech, state.nonblockingSpeech, state.instantText, semanticPaused, dispatch, state.dialoguePace, state.dialogueDisplay), [state.instantText, state.speech, state.nonblockingSpeech, state.dialoguePace, state.dialogueDisplay, semanticPaused, timers, clock, dispatch])
  useEffect(() => bindNonblockingClearTimer(timers, clock, state.speech, state.nonblockingSpeech, semanticPaused, dispatch, state.dialogueMode, state.dialoguePace, state.dialogueDisplay, state.instantText), [state.nonblockingSpeech, state.speech, state.dialogueMode, state.dialoguePace, state.dialogueDisplay, state.instantText, semanticPaused, timers, clock, dispatch])
  useEffect(() => bindOpeningStageTimer(timers, clock, state.openingStage, state.reducedAnimation, semanticPaused, dispatch), [state.openingStage, state.reducedAnimation, semanticPaused, timers, clock, dispatch])
  useEffect(() => bindDialogueAdvanceTimer(timers, clock, { speech: state.speech, dialogueMode: state.dialogueMode, dialoguePace: state.dialoguePace, dialogueDisplay: state.dialogueDisplay, instantText: state.instantText, worldQuiescent: semanticPaused }, dispatch), [state.speech, state.dialogueMode, state.dialoguePace, state.dialogueDisplay, state.instantText, semanticPaused, timers, clock, dispatch])
  useEffect(() => bindIdleTimer(timers, clock, semanticPaused, terminalOpen, () => typeof document !== 'undefined' && !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus()), dispatch), [terminalOpen, semanticPaused, timers, clock, dispatch])
  const barkFired = state.barksFired
  useEffect(() => {
    if (!state.introComplete || state.phase === 'COMPLETE' || barkFired >= 2 || terminalOpen || state.introSkipConfirmationOpen) return
    if (typeof document !== 'undefined' && (document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus()))) return
    const threshold = barkFired === 0 ? BARK_1_AFTER_S : BARK_2_AFTER_S
    if (state.inactiveSeconds < threshold) return
    dispatch({ type: 'PLAY_FORM_BARK' })
  }, [state.inactiveSeconds, barkFired, state.introComplete, state.phase, state.introSkipConfirmationOpen, terminalOpen])
  useEffect(() => bindFocusTimer(timers, clock, state.speech, state.dialogueOpen, state.focusReturnTarget, {
    query: (selector) => selector === '[data-testid="hotspot-nansen-terminal"]' ? document.querySelector<HTMLElement>('[data-testid="hotspot-nansen-terminal"]') : selector === '[data-testid="verb-give"]' ? document.querySelector<HTMLElement>('[data-testid="verb-give"]') : document.querySelector<HTMLElement>(selector),
    active: () => document.activeElement instanceof HTMLElement ? document.activeElement : null,
  }, blockingFocus, hadBlockingSpeech), [state.dialogueOpen, state.focusReturnTarget, state.speech, timers, clock])
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (terminalOpen || state.introSkipConfirmationOpen || event.repeat) return
    if (event.key === ' ' && (state.speech || state.nonblockingSpeech)) {
      event.preventDefault()
      dispatch({ type: 'ADVANCE_SPEECH', channel: state.speech ? 'BLOCKING' : 'NONBLOCKING' })
      return
    }
    if (event.key === 'Enter' && (state.speech || state.nonblockingSpeech)) {
      const target = event.target instanceof Element ? event.target : null
      const onForeignControl = Boolean(target?.closest('button, a, select, input, textarea') && !target.closest('[data-testid="speech-panel"], [data-testid="nonblocking-speech"], [data-testid="talk-advance-catch"]'))
      if (!onForeignControl) {
        event.preventDefault()
        dispatch({ type: 'ADVANCE_SPEECH', channel: state.speech ? 'BLOCKING' : 'NONBLOCKING' })
        return
      }
    }
    if (event.key === 'Escape') { event.preventDefault(); dispatch(state.dialogueOpen ? { type: 'CLOSE_DIALOGUE' } : { type: 'CANCEL_SELECTION' }); return }
    const index = Number(event.key) - 1
    if (index >= 0 && index < VERBS.length && !state.speech && !state.dialogueOpen && !state.nonblockingSpeech) { event.preventDefault(); dispatch({ type: 'SELECT_VERB', verb: VERBS[index]! }) }
  }, [state.dialogueOpen, state.introSkipConfirmationOpen, state.nonblockingSpeech, state.speech, terminalOpen]); useEffect(() => { window.addEventListener('keydown', onKeyDown, true); return () => window.removeEventListener('keydown', onKeyDown, true) }, [onKeyDown])
  if (import.meta.env.DEV && devToolActive(true, query, 'r55Review') && R55ReviewHarness) return <Suspense fallback={null}><R55ReviewHarness /></Suspense>
  if (import.meta.env.DEV && devToolActive(true, query, 'detailReview')) return <DetailReviewHost />
  if (import.meta.env.DEV && devToolActive(true, query, 'artLayout')) return <ArtLayoutHost />
  if ((import.meta.env.DEV || privateReviewTools) && devToolActive(true, query, 'animDirector')) return <AnimationDirectorHost />
  if (!loaded || loaded.diagnostics.requestedPackId !== packId) return <main className="a0-loading" data-testid="art-pack-loading">VALIDATING ART PACK…</main>
  if (missionMode && MissionReviewHarness) return <Suspense fallback={null}><MissionReviewHarness catalog={loaded.semanticCatalog} reducedMotion={state.reducedAnimation}/></Suspense>
  if (artLabMode) return <ArtLab manifest={loaded.manifest} semanticCatalog={loaded.semanticCatalog} performanceProfile={loaded.performanceProfile} packIndex={loaded.packIndex} packId={packId} setPackId={setPackId} diagnostics={loaded.diagnostics}/>
  const presentedCase = terminalOpen && fixture && caseState ? synchronizeOfficeMilestones(fixture, caseState, state) : caseState
  if (endingStatus) return <S14EndingSequence onComplete={() => onComplete(endingStatus)}/>
  if (!worldDialogueAllowed(terminalOpen) && fixture && presentedCase && state.phase === 'COMPLETE') return <><CaseTerminalWorkbench profile={loaded.performanceProfile} fixture={fixture} state={presentedCase} send={sendCase} reviewSurfaces={reviewMode} chromeSrc={loaded.manifest.id === 'production' ? '/art-packs/production/files/included/core-v2.1/terminal/frame_on_480x270.png' : null} cursorSrc={loaded.manifest.cursor.crosshair.src} onClose={() => { dispatch({ type: 'CLOSE_TERMINAL' }); if (presentedCase.sideLead.resolved && !presentedCase.complete) window.requestAnimationFrame(() => dispatch({ type: 'PLAY_BRCG_PAYOFF' })); if (presentedCase.complete && !fixture.s13) dispatch({ type: 'RETURN_FROM_COMPLETED_CASE' }) }} onCloseCase={() => { const status: SideLeadCompletion = presentedCase.sideLead.resolved ? 'RESOLVED' : presentedCase.sideLead.noteDiscovered ? 'BRCG_UNRESOLVED' : state.inventory.includes('fictional-token-note') ? 'NOTE_UNRESOLVED' : 'UNDISCOVERED'; dispatch({ type: 'CLOSE_TERMINAL' }); dispatch({ type: 'RETURN_FROM_COMPLETED_CASE', brcgResolved: status === 'RESOLVED' }); setPendingEndingStatus(status) }}/><PlaybackControls state={state} dispatch={dispatch}/></>
  const hoveredInventoryName = hoveredInventoryId && hoveredInventoryId in inventoryItems ? inventoryItems[hoveredInventoryId as keyof typeof inventoryItems].name : null
  const commandSentence = displayCommandSentence(state, hoveredInventoryName)
  const idleIntents = idleIntentsAt(state.inactiveSeconds, state.reducedAnimation, Boolean(state.speech || state.nonblockingSpeech || state.dialogueOpen || state.walk || state.activeSequence))
  const objective = !state.introComplete ? 'Listen.'
    : state.phase === 'START' ? 'Get an authorization form.'
      : state.phase === 'FORM_HELD' ? 'Find something to write with.'
        : state.phase === 'PEN_HELD' ? 'Get an authorization form.'
          : state.phase === 'FORM_AND_PEN' ? 'Complete the form.'
            : state.phase === 'FORM_COMPLETED' ? 'Give Arthur the form.'
              : state.phase === 'FORM_SUBMITTED' ? 'Wait for approval.'
                : !state.inventory.includes('euler-case-file') ? 'Collect the Euler case file.' : 'Use the authorized terminal.'
  const globeSnapshot = globeTimelineCursor(state.globePose, state.globeLevel, state.globeElapsedMs, state.globeStartPhase)
  return <><main className={`a0-shell ${state.reducedAnimation ? 'reduced-animation' : ''}`} data-review={reviewMode ? '1' : '0'} style={{ ['--a0-scale' as string]: integerScale }} data-testid="a0-shell" data-phase={state.phase} data-dialogue-mode={state.dialogueMode} data-dialogue-pace={state.dialoguePace} data-intro-complete={state.introComplete} data-art-pack={packId} data-art-status={publicArtStatus(loaded.diagnostics)} data-art-disposition={loaded.diagnostics.disposition} data-loaded-art-pack={loaded.diagnostics.loadedPackId} data-talking={revealedSpeaker(state)} data-inactive-seconds={state.inactiveSeconds} data-case-drawer={state.caseFileDrawer} data-misc-drawer={state.miscDrawer} data-case-stack={state.caseStack} data-misc-contents={state.miscContents} data-note-read={state.piggyNoteReadState} data-globe-level={state.globeLevel} data-globe-pose={state.globePose} data-globe-motion={state.globeMotion} data-globe-elapsed={state.globeElapsedMs} data-globe-revision={state.globeRevision} data-globe-start-phase={state.globeStartPhase} data-globe-window={state.globeBoostRemainingMs} data-globe-phase={globeSnapshot.phase} data-globe-surface={globeSnapshot.surface} data-globe-decay={state.globeDecayStage} data-globe-source={globeSnapshot.source} data-control-class={controlClass(state)} data-interface-treatment={interfaceTreatment(state)} data-replacement-id={state.intentReplacement?.id ?? ''} data-idle-intents={idleIntents.map((intent) => `${intent.actor}:${intent.cue}`).join(',')}><div className="a0-frame" data-integer-scale={integerScale} data-skip-confirmation={state.introSkipConfirmationOpen ? 'true' : 'false'} style={{ width: 480 * integerScale, height: 270 * integerScale, maxWidth: 'none', flexShrink: 0 }} onPointerMove={(event) => { const node = cursorRef.current; if (!node) return; const rect = event.currentTarget.getBoundingClientRect(); node.style.visibility = 'visible'; node.style.left = `${Math.round(event.clientX - rect.left)}px`; node.style.top = `${Math.round(event.clientY - rect.top)}px` }} onPointerLeave={() => { const node = cursorRef.current; if (node) node.style.visibility = 'hidden' }}><Scene manifest={loaded.manifest} state={state} dispatch={dispatch} scale={integerScale} onCaseInteraction={onCaseInteraction} cueSheet={cueSheet} layout={devLayout}/><span ref={cursorRef} className={`cross-cursor ${loaded.manifest.cursor.crosshair.width === 13 ? 'cursor-13' : ''}`} data-cursor={state.hoveredHotspotId && interfaceTreatment(state) === 'ACTIVE' && loaded.manifest.id === 'production' ? 'hotspot' : 'cross'} aria-hidden="true"><img className="pixel-art" src={state.hoveredHotspotId && interfaceTreatment(state) === 'ACTIVE' && loaded.manifest.id === 'production' ? '/art-packs/production/files/included/core-v2.1/ui/cursor_hover_green.png' : loaded.manifest.cursor.crosshair.src} alt="" /></span>{state.intentReplacement && <span className="sr-only" role="status" aria-live="assertive" data-replacement-id={state.intentReplacement.id} data-testid="intent-announcement" key={state.intentReplacement.id}>{state.intentReplacement.text}</span>}{interfaceTreatment(state) === 'BLACKOUT' && <span className="sr-only" role="status" data-testid="control-unavailable">Player control is temporarily unavailable.</span>}<div className={`adventure-interface-band${interfaceTreatment(state) === 'BLACKOUT' ? ' interface-blackout' : ''}`} data-testid="adventure-interface-band" data-logical-width="480" data-logical-height="90" data-logical-top="180" inert={interfaceTreatment(state) === 'BLACKOUT' || state.introSkipConfirmationOpen ? true : undefined}><div className="command-sentence" data-testid="command-sentence" aria-live="polite">{state.introComplete ? commandSentence : 'Listen'}</div><section className={`adventure-controls ${interfaceTreatment(state) === 'INERT_VISIBLE' ? 'dimmed' : ''}`} aria-label="Adventure controls" inert={interfaceTreatment(state) !== 'ACTIVE' ? true : undefined} onClick={(event) => { if (event.target === event.currentTarget) dispatch({ type: 'CANCEL_SELECTION' }) }}><div className="verb-grid" data-testid="verb-grid">{VERBS.map((verb, index) => <button key={verb} data-testid={`verb-${verb.toLowerCase().replace('_', '-')}`} aria-label={`${VERB_LABELS[verb]} ${index + 1}`} aria-pressed={state.selectedVerb === verb} onClick={() => dispatch({ type: 'SELECT_VERB', verb })}><span aria-hidden="true">{VERB_FACE[verb]}</span><kbd aria-hidden="true">{index + 1}</kbd></button>)}</div><div className="inventory-panel" data-testid="inventory"><header><strong>INVENTORY</strong><small>{state.inventory.length}/10</small></header><div className="inventory-slots">{Array.from({ length: 10 }, (_, index) => { const itemId = state.inventory[index]; if (!itemId) return <button type="button" className="inventory-slot empty" key={index} aria-label={`Empty inventory slot ${index + 1}`} onClick={() => dispatch({ type: 'CANCEL_SELECTION' })}/>; const item = inventoryItems[itemId]; return <button className={`inventory-slot ${state.selectedItemId === itemId ? 'selected' : ''}`} aria-pressed={state.selectedItemId === itemId} data-testid={`inventory-${itemId}`} key={itemId} aria-label={item.name} onPointerEnter={() => setHoveredInventoryId(itemId)} onPointerLeave={() => setHoveredInventoryId((current) => current === itemId ? null : current)} onFocus={() => setHoveredInventoryId(itemId)} onBlur={() => setHoveredInventoryId((current) => current === itemId ? null : current)} onClick={() => dispatch({ type: 'ACT_ON_ITEM', itemId })}><AssetImage asset={loaded.manifest.inventory[itemId]} alt="" className="pixel-art"/></button> })}</div></div><div className="objective-card"><span>{state.introComplete ? 'CASE 01 // EULER' : 'OPENING'}</span><strong>{objective}</strong>{state.archivedEvidenceIds.length > 0 && <small>RECORDS {state.archivedEvidenceIds.length}/1</small>}</div></section></div>{canSkipOpening(state) && !state.introSkipConfirmationOpen && <button type="button" className="intro-skip-button" data-testid="intro-skip-button" onClick={() => dispatch({ type: 'OPEN_INTRO_SKIP_CONFIRMATION' })}>SKIP INTRO &gt;&gt;&gt;</button>}{state.introSkipConfirmationOpen && <IntroSkipConfirmation onCancel={() => dispatch({ type: 'CANCEL_INTRO_SKIP_CONFIRMATION' })} onConfirm={() => dispatch({ type: 'SKIP_OPENING_TO_INSTRUCTIONS' })}/>} {state.speech && <button type="button" className="talk-advance-catch" data-testid="talk-advance-catch" aria-label="Advance dialogue" onClick={() => dispatch({ type: 'ADVANCE_SPEECH' })} />}<ActiveSequencePanel state={state}/><SpeechPanel state={state} dispatch={dispatch} manifest={loaded.manifest} layout={devLayout}/><NonblockingSpeechPanel state={state} dispatch={dispatch} manifest={loaded.manifest} layout={devLayout}/><DialoguePanel state={state} dispatch={dispatch}/>{reviewMode && <Transcript state={state}/>}<EvidenceDrawer state={state} dispatch={dispatch} record={loaded.record}/>{state.phase === 'COMPLETE' && !state.speech && <>{!caseState && <CompletionCard manifest={loaded.manifest}/>}{state.returnExchangePlayed && !state.returnTagPlayed && <button data-testid="optional-return-tag" disabled={Boolean(state.speech || state.dialogueOpen || state.walk || state.activeSequence || state.worldQuiescent)} onClick={() => dispatch({ type: 'PLAY_RETURN_TAG' })}>PLAY OPTIONAL RETURN TAG</button>}{caseError && <p role="alert">{caseError}</p>}</>}{reviewMode && <nav className="office-hints" aria-label="Ask Arthur for a hint">{(['METHOD_HINT','CASE_HINT','DIRECT_HINT'] as const).map((tier)=><button key={tier} disabled={Boolean(state.speech||state.dialogueOpen||state.walk||state.activeSequence||state.worldQuiescent||state.terminalEntryPending)} onClick={()=>dispatch({type:'REQUEST_HINT',tier})}>{tier.replace('_',' ')}</button>)}</nav>}{reviewMode && <ReviewPanel state={state} dispatch={dispatch} packId={packId} setPackId={setPackId} packIndex={loaded.packIndex} diagnostics={loaded.diagnostics}/>}</div></main><PlaybackControls state={state} dispatch={dispatch}/></>
}

function developmentEntryRequested(query: URLSearchParams) {
  if (!import.meta.env.DEV) return import.meta.env.VITE_TARKA_REVIEW_TOOLS === '1' && devToolActive(true, query, 'animDirector')
  return query.get('review') === '1'
    || query.get('skipIntro') === '1'
    || query.get('artLab') === '1'
    || query.get('artCompare') === '1'
    || query.get('mission') === '1'
    || (['r55Review', 'detailReview', 'artLayout', 'animDirector'] as const).some((tool) => devToolActive(true, query, tool))
}

export function App() {
  const scale = useIntegerViewportScale()
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const [navigation, navigate] = useReducer(productionNavigationReducer, initialProductionNavigationState)
  const playRef = useRef<HTMLButtonElement | null>(null)
  const creditsRef = useRef<HTMLButtonElement | null>(null)
  const devEntry = developmentEntryRequested(query)
  const [devBypassTitle, setDevBypassTitle] = useState(devEntry)

  useEffect(() => {
    if (navigation.screen !== 'TITLE') return
    if (navigation.titleFocus === 'CREDITS') creditsRef.current?.focus()
    if (navigation.titleFocus === 'PLAY') playRef.current?.focus()
  }, [navigation.screen, navigation.titleFocus])

  if (devBypassTitle && navigation.screen === 'TITLE') return <ProductionGame onComplete={(status) => navigate({ type: 'COMPLETE', status })} />
  const freshRun = () => {
    clearProductionGameplayPersistence(browserStorage())
    void backgroundMusic.startFresh()
    navigate({ type: 'PLAY' })
  }
  if (navigation.screen === 'CREDITS') return <TarkaCreditsScreen scale={scale} onReturn={() => navigate({ type: 'RETURN_FROM_CREDITS' })} />
  if (navigation.screen === 'TITLE') return <TarkaTitleScreen scale={scale} playRef={playRef} creditsRef={creditsRef} onPlay={freshRun} onCredits={() => navigate({ type: 'OPEN_CREDITS', from: 'TITLE' })} />
  if (navigation.screen === 'COMPLETION') return <><S14CompletionScreen status={navigation.completionStatus} onPlayAgain={() => { clearProductionGameplayPersistence(browserStorage()); if (devEntry) window.history.replaceState(null, '', '/'); setDevBypassTitle(false); backgroundMusic.stopAndReset(); void backgroundMusic.startFresh(); navigate({ type: 'PLAY_AGAIN' }) }} onMainMenu={() => { clearProductionGameplayPersistence(browserStorage()); setDevBypassTitle(false); backgroundMusic.stopAndReset(); navigate({ type: 'MAIN_MENU' }) }} onCredits={() => navigate({ type: 'OPEN_CREDITS', from: 'COMPLETION' })}/><BackgroundMusicControl /></>
  return <ProductionGame key={`fresh-run-${navigation.freshRunEpoch}`} onComplete={(status) => navigate({ type: 'COMPLETE', status })} />
}
