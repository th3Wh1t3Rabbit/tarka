import type { LayoutStore } from './sceneComposition'
import { animationClips, builtinCues, type AnimationClip, type AnimationCue, type AnimationCategory, type CueMoment, type CueSheet } from './animationCues'
import { FINAL_SCRIPT_LINES } from '../story/s17/finalScript'

export const ANIMATION_REVIEW_WORKSPACE_KEY = 'trace-escape.animation-review-workspace.v3'
export const DEFAULT_BEAT_MS = 500
export const REVIEW_PROJECT_SCHEMA = 'trace-escape.animation-review-project.v3' as const

export type ReviewAvailability = 'CURRENT_GAME' | 'REVIEW_OPTION'
export interface PoseTalkControl {
  poseFrameIndex: number
  entryClipId?: string
  guidance: string
}

export type ReviewAnimationClip = AnimationClip & { reviewAvailability: ReviewAvailability; poseTalkControl?: PoseTalkControl }

const ROOK = '/art-packs/production/files/production/characters/rook/frames'
const ROOK_CORE = '/art-packs/production/files/production/characters/rook/latest-clean-v0.1.14/frames'
const ARTHUR_PRESENT = '/art-packs/production/files/production/characters/arthur/present-v0.1.1/frames'
const ARTHUR_POINT = '/art-packs/production/files/production/characters/arthur/pointing-v0.1.3/frames'
const ARTHUR_SLOUCH = '/art-packs/production/files/production/characters/arthur/slouch-v0.1.3/frames'
const ARTHUR_WALK = '/art-packs/production/files/production/characters/arthur/walk-v0.1.1/frames'
const ARTHUR_STAMP = '/art-packs/production/files/production/characters/arthur/stamp-life-v0.1.0/frames'
const ARTHUR_STAMP_POSE = '/art-packs/production/files/production/characters/arthur/stamp-v0.1.1/frames'

const POSE_TALK_CONTROLS: Record<string, PoseTalkControl> = {
  'rook.talk': { poseFrameIndex: 0, guidance: 'Hold the neutral closed-mouth pose, then run the standard talk loop.' },
  'rook.talk.think': { poseFrameIndex: 0, entryClipId: 'rook.think.raise', guidance: 'Raise the hand once, then keep it at the chin throughout the mouth cycle.' },
  'rook.talk.arms': { poseFrameIndex: 0, guidance: 'Keep the arms crossed throughout the mouth cycle.' },
  'rook.talk.document': { poseFrameIndex: 0, guidance: 'Keep the document-reading pose throughout the mouth cycle.' },
  'rook.talk.item': { poseFrameIndex: 0, guidance: 'Keep the key item held throughout the mouth cycle.' },
  'rook.talk.inspect': { poseFrameIndex: 0, guidance: 'Keep the inspected item held throughout the mouth cycle.' },
  'rook.talk.emphasis': { poseFrameIndex: 0, guidance: 'Use the matching emphatic closed/open drawings.' },
  'rook.talk.shrug': { poseFrameIndex: 0, guidance: 'Keep the shrug throughout the mouth cycle.' },
  'rook.talk.proud': { poseFrameIndex: 0, guidance: 'Keep the proud pose throughout the mouth cycle.' },
  'rook.talk.point': { poseFrameIndex: 0, guidance: 'Keep the triumphant point throughout the mouth cycle.' },
  'arthur.talk': { poseFrameIndex: 0, guidance: 'Hold the listening/closed-mouth pose, then run the same-rate closed/open speech window used by Rook.' },
  'arthur.point': { poseFrameIndex: 0, guidance: 'Keep the angry point and eyebrows throughout the mouth cycle.' },
  'arthur.document': { poseFrameIndex: 0, guidance: 'Keep the paper-holding pose throughout the mouth cycle.' },
  'arthur.document-adjust': { poseFrameIndex: 0, guidance: 'Keep paper ownership while playing the authored adjustment/talk sequence.' },
  'arthur.present': { poseFrameIndex: 0, guidance: 'Keep the presenting gesture throughout the mouth cycle.' },
  'arthur.sardonic': { poseFrameIndex: 0, guidance: 'Keep the sardonic pose throughout the mouth cycle.' },
  'arthur.slouch': { poseFrameIndex: 0, guidance: 'Keep the slouch throughout the mouth cycle.' },
  'arthur.stamp-talk': { poseFrameIndex: 0, guidance: 'Keep the stamp raised throughout the closed/open mouth cycle.' },
}

function frameLabels(frames: string[]) {
  return frames.map((path, index) => `${index + 1}. ${path.split('/').at(-1)?.replace(/\.png$/, '').replace(/^(rook_|archivist_)/, '').replaceAll('_', ' ') ?? `frame ${index + 1}`}`)
}

function reviewOption(id: string, actorId: string, label: string, frames: string[], category: AnimationCategory, intendedUse: string, defaultFps = 6): ReviewAnimationClip {
  return { id, actorId, label, frames, width: 48, height: 88, defaultFps, category, intendedUse, frameLabels: frameLabels(frames), reviewAvailability: 'REVIEW_OPTION' }
}

function reviewOnlyClips(): ReviewAnimationClip[] {
  return [
    reviewOption('rook.think.raise', 'rook', 'Raise hand to chin', [`${ROOK_CORE}/rook_idle_neutral_a.png`, `${ROOK}/rook_thinking_chin.png`], 'Speech & listening', 'Enter the thinking pose once, then hand off to a held-pose or talking segment.', 4),
    reviewOption('rook.think.hold', 'rook', 'Hold hand at chin', [`${ROOK}/rook_thinking_chin.png`], 'Speech & listening', 'Hold the thinking pose for a beat without cycling the arm.', 1),
    reviewOption('rook.listen', 'rook', 'Attentive listening', [`${ROOK}/rook_listening_attentive.png`, `${ROOK}/rook_listening_breath.png`], 'Speech & listening', 'A restrained listening loop; blink frames can be placed separately when desired.', 2),
    reviewOption('rook.talk.arms', 'rook', 'Talk — arms crossed', [`${ROOK}/rook_annoyed_arms_crossed.png`, `${ROOK}/rook_talk_arms_crossed.png`], 'Speech & listening', 'Talk while keeping the arms-crossed silhouette.', 8),
    reviewOption('rook.talk.document', 'rook', 'Talk — reading document', [`${ROOK}/rook_read_document.png`, `${ROOK}/rook_talk_read_document.png`], 'Props & paperwork', 'Talk while retaining the document-reading pose.', 8),
    reviewOption('rook.talk.item', 'rook', 'Talk — holding key item', [`${ROOK}/rook_hold_key_item.png`, `${ROOK}/rook_talk_hold_key_item.png`], 'Props & paperwork', 'Talk while the authored key-item pose remains held.', 8),
    reviewOption('rook.talk.inspect', 'rook', 'Talk — inspecting item', [`${ROOK}/rook_inspect_hold_item.png`, `${ROOK}/rook_talk_inspect_hold_item.png`], 'Actions & handoffs', 'Talk while retaining the inspected-item pose.', 8),
    reviewOption('rook.talk.emphasis', 'rook', 'Talk — emphasis', [`${ROOK}/rook_talk_emphasis_closed.png`, `${ROOK}/rook_talk_emphasis_open.png`], 'Speech & listening', 'An emphatic closed/open mouth cycle.', 8),
    reviewOption('rook.talk.shrug', 'rook', 'Talk — shrug', [`${ROOK}/rook_questioning_shrug.png`, `${ROOK}/rook_talk_shrug.png`], 'Reactions & camera', 'Talk while maintaining the questioning shrug.', 8),
    reviewOption('rook.talk.proud', 'rook', 'Talk — proud pose', [`${ROOK}/rook_proud_pose.png`, `${ROOK}/rook_talk_proud_pose.png`], 'Reactions & camera', 'Talk while maintaining the proud pose.', 8),
    reviewOption('rook.talk.point', 'rook', 'Talk — triumphant point', [`${ROOK}/rook_triumphant_point.png`, `${ROOK}/rook_talk_triumphant_point.png`], 'Reactions & camera', 'Talk while maintaining the triumphant point.', 8),
    reviewOption('rook.reaction.startled', 'rook', 'Startled backstep', [`${ROOK}/rook_startled_backstep_closed.png`, `${ROOK}/rook_startled_backstep.png`], 'Reactions & camera', 'A short startled reaction with optional mouth change.', 4),
    reviewOption('rook.reaction.surprised', 'rook', 'Surprised hands up', [`${ROOK}/rook_surprised_hands_up_closed.png`, `${ROOK}/rook_surprised_hands_up.png`], 'Reactions & camera', 'A surprised hands-up reaction with optional mouth change.', 4),
    reviewOption('rook.reaction.embarrassed', 'rook', 'Embarrassed scratch', [`${ROOK}/rook_embarrassed.png`, `${ROOK}/rook_embarrassed_scratch_b.png`], 'Reactions & camera', 'An embarrassed head-scratch sequence.', 4),
    reviewOption('rook.camera.wiggle', 'rook', 'Camera eyebrow wiggle', [`${ROOK}/rook_wiggle_quiet_base.png`, `${ROOK}/rook_wiggle_quiet_screen_right.png`, `${ROOK}/rook_wiggle_quiet_both_mid.png`, `${ROOK}/rook_wiggle_quiet_base.png`], 'Reactions & camera', 'A camera-facing eyebrow-wiggle review sequence.', 5),
    reviewOption('arthur.present', 'arthur', 'Present / explain', [`${ARTHUR_PRESENT}/archivist_gesture_present.png`, `${ARTHUR_PRESENT}/archivist_present_talk.png`], 'Speech & listening', 'Talk while Arthur keeps the authored presenting gesture.', 8),
    reviewOption('arthur.sardonic', 'arthur', 'Sardonic talk', [`${ARTHUR_POINT}/archivist_sardonic_closed.png`, `${ARTHUR_POINT}/archivist_talk_sardonic.png`], 'Reactions & camera', 'A restrained sardonic mouth cycle.', 8),
    reviewOption('arthur.slouch', 'arthur', 'Slouch talk', [`${ARTHUR_SLOUCH}/archivist_slouch.png`, `${ARTHUR_SLOUCH}/archivist_slouch_talk.png`], 'Reactions & camera', 'Talk while Arthur stays in the slouched pose.', 8),
    reviewOption('arthur.walk', 'arthur', 'Arthur walk', [`${ARTHUR_WALK}/archivist_walk_a.png`, `${ARTHUR_WALK}/archivist_walk_b.png`, `${ARTHUR_WALK}/archivist_walk_c.png`, `${ARTHUR_WALK}/archivist_walk_d.png`], 'Movement', 'Four-frame review walk cycle.', 8),
    reviewOption('arthur.stamp-talk', 'arthur', 'Talk with stamp raised', [`${ARTHUR_STAMP_POSE}/archivist_stamp_up.png`, `${ARTHUR_STAMP}/archivist_stamp_up_talk.png`], 'Props & paperwork', 'A review-only raised-stamp closed/open speaking cycle.', 6),
  ]
}

/** Full studio catalog. Review-only combinations are deliberately absent from the live-game registry. */
export function animationReviewClips(): ReviewAnimationClip[] {
  return [
    ...animationClips().map((item): ReviewAnimationClip => ({ ...item, reviewAvailability: 'CURRENT_GAME' })),
    ...reviewOnlyClips(),
  ].map((item) => {
    const poseTalkControl = POSE_TALK_CONTROLS[item.id]
    return poseTalkControl ? { ...item, poseTalkControl } : item
  })
}

export function reviewClipById(id: string) {
  return animationReviewClips().find((item) => item.id === id) ?? null
}

export type ReviewSegmentKind = 'SEQUENCE' | 'FRAME_HOLD'

export interface ReviewTimelineSegment {
  id: string
  kind: ReviewSegmentKind
  actorId: string
  clipId: string
  frameIndex: number
  durationMs: number
  fps: number
  mode: 'LOOP' | 'ONCE' | 'HOLD'
  note: string
}

export interface ReviewTimeline {
  momentId: string
  tracks: Record<string, ReviewTimelineSegment[]>
}

export interface AnimationReviewProject {
  schema: typeof REVIEW_PROJECT_SCHEMA
  id: string
  name: string
  source: {
    kind: 'CURRENT_GAME_SNAPSHOT'
    label: string
    snapshotVersion: number
    capturedAt: string
    clipCatalog: ReviewAnimationClip[]
  }
  baseSheet: CueSheet
  workingSheet: CueSheet
  timelines: ReviewTimeline[]
  createdAt: string
  updatedAt: string
}

export interface SavedReviewVersion {
  id: string
  name: string
  savedAt: string
  project: AnimationReviewProject
}

export interface AnimationReviewWorkspace {
  schema: 'trace-escape.animation-review-workspace.v3'
  draft: AnimationReviewProject
  versions: SavedReviewVersion[]
}

export interface ReviewProjectDiff {
  cueAdds: number
  cueChanges: number
  cueRemovals: number
  timelineTrackChanges: number
  changedMomentIds: string[]
}

const CURRENT_GAME_ROWS: ReadonlyArray<{ id: string; label: string; detail: string; actorId: string; clipId: string; mode?: AnimationCue['mode']; fps?: number }> = [
  { id: 'current:rook-idle', label: 'Current game · Rook idle', detail: 'Production idle owner before any review edits.', actorId: 'rook', clipId: 'rook.idle.breath', mode: 'LOOP', fps: 2 },
  { id: 'current:rook-walk', label: 'Current game · Rook walk', detail: 'Production four-frame room walk.', actorId: 'rook', clipId: 'rook.walk', mode: 'LOOP', fps: 8 },
  { id: 'current:rook-talk', label: 'Current game · Rook ordinary talk', detail: 'Production ordinary mouth cycle.', actorId: 'rook', clipId: 'rook.talk', mode: 'LOOP', fps: 8 },
  { id: 'current:rook-listen', label: 'Current game · Rook listening', detail: 'Production held/listening alternative.', actorId: 'rook', clipId: 'rook.idle.still', mode: 'HOLD' },
  { id: 'current:rook-reach', label: 'Current game · Rook empty-hand reach', detail: 'Production reach/contact pose.', actorId: 'rook', clipId: 'rook.reach.neutral', mode: 'HOLD' },
  { id: 'current:rook-inspect', label: 'Current game · Rook drawer inspect', detail: 'Production empty-hand lean used for drawer descriptions.', actorId: 'rook', clipId: 'rook.inspect-lean', mode: 'HOLD' },
  { id: 'current:rook-drawer', label: 'Current game · Rook drawer extraction', detail: 'Production extraction sequence, reserved for item contact.', actorId: 'rook', clipId: 'rook.drawer-extract', mode: 'ONCE' },
  { id: 'current:rook-give', label: 'Current game · Rook handoff', detail: 'Production give/paper reach pose.', actorId: 'rook', clipId: 'rook.give', mode: 'HOLD' },
  { id: 'current:arthur-idle', label: 'Current game · Arthur idle', detail: 'Production idle owner before any review edits.', actorId: 'arthur', clipId: 'arthur.idle.breath', mode: 'ONCE', fps: 2 },
  { id: 'current:arthur-listen', label: 'Current game · Arthur listening', detail: 'Production stable listening pose.', actorId: 'arthur', clipId: 'arthur.listen', mode: 'HOLD' },
  { id: 'current:arthur-talk', label: 'Current game · Arthur ordinary talk', detail: 'Continuity-locked clean mouth pair at the same rate as Rook.', actorId: 'arthur', clipId: 'arthur.talk', mode: 'LOOP', fps: 8 },
  { id: 'current:arthur-point', label: 'Current game · Arthur angry point', detail: 'Stable warning pose; same-rate mouth motion exists only during Arthur’s speaking window.', actorId: 'arthur', clipId: 'arthur.point', mode: 'LOOP', fps: 8 },
  { id: 'current:arthur-document', label: 'Current game · Arthur document hold/talk', detail: 'Production stable paper ownership with the shared eight-fps mouth rate.', actorId: 'arthur', clipId: 'arthur.document', mode: 'LOOP', fps: 8 },
  { id: 'current:arthur-receive', label: 'Current game · Arthur empty-hand receive', detail: 'Production form receive sequence.', actorId: 'arthur', clipId: 'arthur.receive', mode: 'ONCE', fps: 4 },
  { id: 'current:arthur-stamp', label: 'Current game · Arthur stamp', detail: 'Production stamp contact sequence.', actorId: 'arthur', clipId: 'arthur.stamp', mode: 'ONCE', fps: 6 },
  { id: 'current:arthur-glasses-adjust', label: 'Current game · Arthur adjusts glasses once', detail: 'Continuity-cleaned finite timing; never loops.', actorId: 'arthur', clipId: 'arthur.glasses-adjust', mode: 'ONCE', fps: 6 },
  { id: 'current:arthur-glasses-wiggle', label: 'Available accent · Arthur wiggles glasses', detail: 'Optional one-cycle dry-comedy accent; not bound as ambient life.', actorId: 'arthur', clipId: 'arthur.glasses-wiggle', mode: 'ONCE', fps: 6 },
  { id: 'current:arthur-you-incredulous', label: 'Current game · Arthur “You?!?” disbelief', detail: 'One authored spoken outburst, restrained glasses correction, camera take and held disbelief; never loops.', actorId: 'arthur', clipId: 'arthur.you-incredulous', mode: 'ONCE', fps: 8 },
  { id: 'current:arthur-camera-glance', label: 'Current game · Arthur looks to camera', detail: 'One finite look, blink, hold and return at an authored joke.', actorId: 'arthur', clipId: 'arthur.camera-glance', mode: 'ONCE', fps: 6 },
  { id: 'current:arthur-camera-talk', label: 'Current game · Arthur camera aside', detail: 'Finite camera-facing sentence with restrained mouth openings; never loops through the reading hold.', actorId: 'arthur', clipId: 'arthur.camera-talk', mode: 'ONCE', fps: 6 },
  { id: 'current:mug-steam', label: 'Current game · Mug steam', detail: 'Production steam sequence and rest owner.', actorId: 'mug', clipId: 'mug.steam', mode: 'LOOP', fps: 5 },
  { id: 'current:globe', label: 'Current game · Globe motion', detail: 'Production globe still/spin owner.', actorId: 'globe', clipId: 'globe.spin', mode: 'ONCE', fps: 8 },
]

export function currentGameReviewMoments(): CueMoment[] {
  return CURRENT_GAME_ROWS.map((row) => ({ id: row.id, group: 'Current game' as CueMoment['group'], label: row.label, detail: row.detail }))
}

function currentGameSheet(): CueSheet {
  const rows = CURRENT_GAME_ROWS.map((row): AnimationCue => {
    const selected = reviewClipById(row.clipId)!
    return { momentId: row.id, actorId: row.actorId, clipId: row.clipId, fps: Math.max(1, Math.round(row.fps ?? selected.defaultFps)), holdMs: 0, mode: row.mode ?? 'ONCE', beatBeforeMs: 0, beatAfterMs: 0, note: 'Imported from current production behavior.' }
  })
  const authored = FINAL_SCRIPT_LINES.flatMap((line): AnimationCue[] => (line.performanceCues ?? []).flatMap((cue) => {
    if (!cue.actor || !cue.selectedClip || !reviewClipById(cue.selectedClip)) return []
    const selected = reviewClipById(cue.selectedClip)!
    return [{ momentId: `delivery:${line.copyKey}`, actorId: cue.actor, clipId: cue.selectedClip, fps: Math.max(1, Math.round(selected.defaultFps)), holdMs: 0, mode: 'ONCE', beatBeforeMs: line.beatBeforeMs ?? 0, beatAfterMs: line.beatAfterMs ?? 0, note: `Imported authored cue: ${cue.intent}` }]
  }))
  const keyed = new Map<string, AnimationCue>()
  for (const cue of [...builtinCues(), ...rows, ...authored]) keyed.set(`${cue.momentId}::${cue.actorId}`, cue)
  return { cues: [...keyed.values()] }
}

function segmentForCue(cue: AnimationCue): ReviewTimelineSegment {
  const selected = reviewClipById(cue.clipId)!
  const sequenceMs = Math.ceil(selected.frames.length / Math.max(1, cue.fps) * 1000)
  return {
    id: `baseline:${cue.momentId}:${cue.actorId}`,
    kind: selected.frames.length === 1 ? 'FRAME_HOLD' : 'SEQUENCE',
    actorId: cue.actorId,
    clipId: cue.clipId,
    frameIndex: 0,
    durationMs: cue.mode === 'LOOP' ? Math.max(DEFAULT_BEAT_MS * 4, sequenceMs) : Math.max(DEFAULT_BEAT_MS, sequenceMs + cue.holdMs),
    fps: cue.fps,
    mode: cue.mode,
    note: 'Current-game starting point.',
  }
}

function timelinesFor(sheet: CueSheet): ReviewTimeline[] {
  const map = new Map<string, ReviewTimeline>()
  for (const cue of sheet.cues) {
    const timeline = map.get(cue.momentId) ?? { momentId: cue.momentId, tracks: {} }
    timeline.tracks[cue.actorId] = [segmentForCue(cue)]
    map.set(cue.momentId, timeline)
  }
  return [...map.values()]
}

function projectId() { return `animation-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

export function forkCurrentGameProject(now = new Date().toISOString()): AnimationReviewProject {
  const baseSheet = currentGameSheet()
  return {
    schema: REVIEW_PROJECT_SCHEMA,
    id: projectId(),
    name: 'Current game — review fork',
    source: { kind: 'CURRENT_GAME_SNAPSHOT', label: 'Current implemented game animation bindings plus separate review options', snapshotVersion: 3, capturedAt: now, clipCatalog: animationReviewClips() },
    baseSheet,
    workingSheet: { cues: baseSheet.cues.map((cue) => ({ ...cue })) },
    timelines: timelinesFor(baseSheet),
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeSegment(value: ReviewTimelineSegment): ReviewTimelineSegment | null {
  const selected = reviewClipById(value?.clipId)
  if (!selected || selected.actorId !== value.actorId || !['SEQUENCE', 'FRAME_HOLD'].includes(value.kind)) return null
  const durationMs = Math.min(60000, Math.max(50, Math.round(Number(value.durationMs) || DEFAULT_BEAT_MS)))
  const fps = Math.min(24, Math.max(1, Math.round(Number(value.fps) || selected.defaultFps || 1)))
  const frameIndex = Math.min(selected.frames.length - 1, Math.max(0, Math.round(Number(value.frameIndex) || 0)))
  return { id: String(value.id || `segment-${Date.now()}`), kind: value.kind, actorId: value.actorId, clipId: value.clipId, frameIndex, durationMs, fps, mode: ['LOOP', 'ONCE', 'HOLD'].includes(value.mode) ? value.mode : 'ONCE', note: String(value.note ?? '').trim() }
}

function validCue(cue: AnimationCue): cue is AnimationCue {
  return Boolean(cue?.momentId && cue.actorId && reviewClipById(cue.clipId) && cue.fps >= 1 && cue.fps <= 24 && cue.holdMs >= 0 && cue.holdMs <= 10000)
}

export function normalizeReviewProject(project: AnimationReviewProject): AnimationReviewProject | null {
  if (!project || project.schema !== REVIEW_PROJECT_SCHEMA || !project.source || !Array.isArray(project.source.clipCatalog) || !project.baseSheet || !project.workingSheet) return null
  const normalizeSheet = (sheet: CueSheet): CueSheet => ({ cues: Array.isArray(sheet.cues) ? sheet.cues.filter(validCue).map((cue) => ({ ...cue, fps: Math.round(cue.fps), holdMs: Math.round(cue.holdMs), beatBeforeMs: Math.round(cue.beatBeforeMs ?? 0), beatAfterMs: Math.round(cue.beatAfterMs ?? 0), note: cue.note?.trim() ?? '' })) : [] })
  const timelines = Array.isArray(project.timelines) ? project.timelines.flatMap((timeline) => {
    if (!timeline?.momentId || !timeline.tracks || typeof timeline.tracks !== 'object') return []
    const tracks = Object.fromEntries(Object.entries(timeline.tracks).map(([actorId, segments]) => [actorId, Array.isArray(segments) ? segments.flatMap((segment) => normalizeSegment(segment) ?? []) : []]))
    return [{ momentId: String(timeline.momentId), tracks }]
  }) : []
  return {
    ...project,
    id: String(project.id || projectId()),
    name: String(project.name || 'Imported animation review'),
    source: { ...project.source, label: 'Current implemented game animation bindings plus separate review options', clipCatalog: animationReviewClips() },
    baseSheet: normalizeSheet(project.baseSheet),
    workingSheet: normalizeSheet(project.workingSheet),
    timelines,
    updatedAt: String(project.updatedAt || new Date().toISOString()),
  }
}

export function readReviewWorkspace(storage: LayoutStore | null): AnimationReviewWorkspace {
  if (storage) {
    try {
      const parsed = JSON.parse(storage.getItem(ANIMATION_REVIEW_WORKSPACE_KEY) ?? 'null') as AnimationReviewWorkspace | null
      const draft = parsed?.draft ? normalizeReviewProject(parsed.draft) : null
      if (parsed?.schema === 'trace-escape.animation-review-workspace.v3' && draft) {
        const versions = Array.isArray(parsed.versions) ? parsed.versions.flatMap((version) => {
          const project = version?.project ? normalizeReviewProject(version.project) : null
          return project ? [{ id: String(version.id), name: String(version.name), savedAt: String(version.savedAt), project }] : []
        }) : []
        return { schema: 'trace-escape.animation-review-workspace.v3', draft, versions }
      }
    } catch { /* start from the current game snapshot */ }
  }
  return { schema: 'trace-escape.animation-review-workspace.v3', draft: forkCurrentGameProject(), versions: [] }
}

export function writeReviewDraft(storage: LayoutStore, workspace: AnimationReviewWorkspace, project: AnimationReviewProject): AnimationReviewWorkspace {
  const next = { ...workspace, draft: { ...project, updatedAt: new Date().toISOString() } }
  storage.setItem(ANIMATION_REVIEW_WORKSPACE_KEY, JSON.stringify(next))
  return next
}

export function saveReviewVersion(storage: LayoutStore, workspace: AnimationReviewWorkspace, project: AnimationReviewProject, name: string): AnimationReviewWorkspace {
  const now = new Date().toISOString()
  const version = { id: `review-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim() || `Review version ${workspace.versions.length + 1}`, savedAt: now, project: { ...project, name: name.trim() || project.name, updatedAt: now } }
  const next = { ...workspace, draft: version.project, versions: [...workspace.versions, version] }
  storage.setItem(ANIMATION_REVIEW_WORKSPACE_KEY, JSON.stringify(next))
  return next
}

export function removeReviewVersion(storage: LayoutStore, workspace: AnimationReviewWorkspace, versionId: string): AnimationReviewWorkspace {
  const next = { ...workspace, versions: workspace.versions.filter((version) => version.id !== versionId) }
  storage.setItem(ANIMATION_REVIEW_WORKSPACE_KEY, JSON.stringify(next))
  return next
}

function cueMap(sheet: CueSheet) { return new Map(sheet.cues.map((cue) => [`${cue.momentId}::${cue.actorId}`, JSON.stringify(cue)])) }
function timelineMap(project: AnimationReviewProject) { return new Map(project.timelines.flatMap((timeline) => Object.entries(timeline.tracks).map(([actorId, segments]) => [`${timeline.momentId}::${actorId}`, JSON.stringify(segments)]))) }

export function reviewProjectDiff(project: AnimationReviewProject): ReviewProjectDiff {
  const base = cueMap(project.baseSheet)
  const work = cueMap(project.workingSheet)
  const cueAdds = [...work.keys()].filter((key) => !base.has(key)).length
  const cueRemovals = [...base.keys()].filter((key) => !work.has(key)).length
  const cueChanges = [...work].filter(([key, value]) => base.has(key) && base.get(key) !== value).length
  const baseline = timelineMap({ ...project, timelines: timelinesFor(project.baseSheet) })
  const current = timelineMap(project)
  const timelineKeys = new Set([...baseline.keys(), ...current.keys()])
  const changedTimelineKeys = [...timelineKeys].filter((key) => baseline.get(key) !== current.get(key))
  return { cueAdds, cueChanges, cueRemovals, timelineTrackChanges: changedTimelineKeys.length, changedMomentIds: [...new Set([...work.keys(), ...base.keys(), ...changedTimelineKeys].filter((key) => base.get(key) !== work.get(key) || baseline.get(key) !== current.get(key)).map((key) => key.split('::')[0]!))].sort() }
}

export function timelineFor(project: AnimationReviewProject, momentId: string): ReviewTimeline {
  return project.timelines.find((timeline) => timeline.momentId === momentId) ?? { momentId, tracks: {} }
}

export function replaceTimeline(project: AnimationReviewProject, timeline: ReviewTimeline): AnimationReviewProject {
  return { ...project, timelines: [...project.timelines.filter((item) => item.momentId !== timeline.momentId), timeline], updatedAt: new Date().toISOString() }
}

/** Review equivalent of upsertCue. It accepts review-only options but never writes the live cue store. */
export function upsertReviewCue(sheet: CueSheet, cue: AnimationCue): CueSheet {
  const selected = reviewClipById(cue.clipId)
  if (!selected || selected.actorId !== cue.actorId) return sheet
  return { cues: [...sheet.cues.filter((item) => !(item.momentId === cue.momentId && item.actorId === cue.actorId)), cue] }
}
