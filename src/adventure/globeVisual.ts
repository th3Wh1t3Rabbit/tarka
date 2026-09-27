export type GlobePose = 'IDLE' | 'PUSH' | 'PULL'
export type GlobeLevel = 0 | 1 | 2 | 3
export interface GlobeTimelineEntry { phase: number; dwellMs: number; surface: 'sharp' | 'soft' | 'full' }
export type GlobeDecayStage = 'REST' | 'LEVEL_3' | 'LEVEL_2' | 'LEVEL_1' | 'TRICKLE' | 'FINAL_HOLD'
export interface GlobeSnapshot {
  phase: number
  surface: GlobeTimelineEntry['surface'] | 'idle'
  decayStage: GlobeDecayStage
  source: string
  complete: boolean
}
export interface GlobeTimelineCursor extends GlobeSnapshot {
  /** The exact frame phase visible to the player. */
  visiblePhase: number
  /** Destination-independent physical angle retained across schedule changes. */
  angularPhase: number
  /** Timeline-authored phase before direction and held-angle projection. */
  timelinePhase: number
  /** Stable identity for the currently visible timeline entry. */
  entryIdentity: string
  entryIndex: number
  elapsedWithinEntryMs: number
  dwellDurationMs: number
  fractionalDwellProgress: number
}

const ROOT = '/art-packs/production/files/production/ambience/globe-life/frames'

const GLOBE_FRAME_SOURCES = [
  `${ROOT}/globe_idle.png`,
  `${ROOT}/globe_settle.png`,
  ...Array.from({ length: 24 }, (_, phase) => sourceFor('PULL', phase, 'sharp')),
  ...Array.from({ length: 24 }, (_, phase) => sourceFor('PULL', phase, 'soft')),
  ...Array.from({ length: 24 }, (_, phase) => sourceFor('PULL', phase, 'full')),
]
const retainedGlobeImages: HTMLImageElement[] = []

const LEVEL_1_TAIL = [80,80,82,84,87,91,96,102,109,117,125,135,145,157,169,182,196,211,227,244,261,280,300,320]
const LEVEL_2_TAIL = [40,40,40,41,42,43,44,45,47,49,51,53,56,58,61,64,68,71,75,79,83,88,93,97,103,108,113,119,125,131,138,144,151,158,166,173,181,189,197,205,214,223,232,241,250,260,270,280]
const LEVEL_3_SOFT = [22,22,22,22,22,23,23,23,23,24,24,25,25,26,26,27,28,28,29,30,31,32,33,33,35,36,37,38,39,40,42,43,44,46,47,49,50,52,53,55,57,59,60,62,64,66,68,70]

function steps(count: number, dwellMs: number, surface: GlobeTimelineEntry['surface'], startIndex = 0): GlobeTimelineEntry[] {
  return Array.from({ length: count }, (_, index) => ({ phase: (startIndex + index) % 24, dwellMs, surface }))
}

export function globeTimeline(_pose: Exclude<GlobePose, 'IDLE'>, level: Exclude<GlobeLevel, 0>): GlobeTimelineEntry[] {
  if (level === 1) return [...steps(84, 70, 'sharp'), ...LEVEL_1_TAIL.map((dwellMs, index) => ({ phase: (84 + index) % 24, dwellMs, surface: 'sharp' as const }))]
  if (level === 2) return [...steps(96, 35, 'sharp'), ...LEVEL_2_TAIL.map((dwellMs, index) => ({ phase: (96 + index) % 24, dwellMs, surface: 'sharp' as const }))]
  const top = Array.from({ length: 168 }, (_, index): GlobeTimelineEntry => ({
    phase: index % 24,
    dwellMs: 20,
    surface: index < 6 ? 'sharp' : index < 12 ? 'soft' : 'full',
  }))
  const firstTail = LEVEL_3_SOFT.map((dwellMs, index): GlobeTimelineEntry => ({
    phase: (168 + index) % 24,
    dwellMs,
    surface: dwellMs < 35 ? 'full' : dwellMs < 70 ? 'soft' : 'sharp',
  }))
  const finalTail = LEVEL_1_TAIL.map((dwellMs, index): GlobeTimelineEntry => ({ phase: (216 + index) % 24, dwellMs, surface: 'sharp' }))
  return [...top, ...firstTail, ...finalTail]
}

function phaseForPose(pose: Exclude<GlobePose, 'IDLE'>, phase: number) { return pose === 'PUSH' ? (24 - phase) % 24 : phase }

export function globeTimelineTotalMs(level: Exclude<GlobeLevel, 0>) {
  return globeTimeline('PUSH', level).reduce((total, entry) => total + entry.dwellMs, 0)
}

function sourceFor(_pose: Exclude<GlobePose, 'IDLE'>, phase: number, surface: GlobeTimelineEntry['surface']) {
  if (surface === 'full') return `${ROOT}/globe_spin_left__blur_full_${String(phase).padStart(2, '0')}.png`
  if (surface === 'soft') return `${ROOT}/globe_spin_left__blur_soft_${String(phase).padStart(2, '0')}.png`
  if (phase === 0) return `${ROOT}/globe_idle.png`
  if (phase === 1) return `${ROOT}/globe_spin_left.png`
  return `${ROOT}/globe_spin_left__phase_${String(phase).padStart(2, '0')}.png`
}

/**
 * Decode the complete 296 KB globe bank before interaction. Retaining the image
 * objects avoids Android discarding decoded frames between fast source swaps.
 */
export function preloadGlobeFrames() {
  if (typeof Image === 'undefined' || retainedGlobeImages.length > 0) return
  for (const source of new Set(GLOBE_FRAME_SOURCES)) {
    const image = new Image()
    image.decoding = 'async'
    image.src = source
    retainedGlobeImages.push(image)
    void image.decode().catch(() => undefined)
  }
}

export function globeFrameSources() {
  return [...new Set(GLOBE_FRAME_SOURCES)]
}

function decayStage(level: Exclude<GlobeLevel, 0>, entry: GlobeTimelineEntry, index: number, complete: boolean): GlobeDecayStage {
  if (complete) return 'FINAL_HOLD'
  if (entry.dwellMs >= 80) return 'TRICKLE'
  if (level === 3 && entry.surface === 'full') return 'LEVEL_3'
  if ((level === 3 && entry.surface === 'soft') || (level === 2 && index < 96)) return 'LEVEL_2'
  return 'LEVEL_1'
}

/** The single authoritative timeline cursor used by renderer, reducer and evidence. */
export function globeTimelineCursor(pose: GlobePose, level: GlobeLevel, elapsedMs: number, startPhase = 0): GlobeTimelineCursor {
  if (pose === 'IDLE' || level === 0) return { phase: startPhase % 24, visiblePhase: startPhase % 24, angularPhase: startPhase % 24, timelinePhase: 0, entryIdentity: 'IDLE', entryIndex: 0, elapsedWithinEntryMs: 0, dwellDurationMs: 0, fractionalDwellProgress: 0, surface: 'idle', decayStage: 'REST', source: `${ROOT}/globe_idle.png`, complete: true }
  const timeline = globeTimeline(pose, level)
  const total = globeTimelineTotalMs(level)
  const complete = elapsedMs >= total
  if (complete) {
    const signedEntryCount = pose === 'PUSH' ? -timeline.length : timeline.length
    const phase = (startPhase + signedEntryCount % 24 + 24) % 24
    const last = timeline.at(-1)!
    return { phase, visiblePhase: phase, angularPhase: phase, timelinePhase: last.phase, entryIdentity: `${pose}:L${level}:FINAL_HOLD`, entryIndex: timeline.length, elapsedWithinEntryMs: last.dwellMs, dwellDurationMs: last.dwellMs, fractionalDwellProgress: 1, surface: 'sharp', decayStage: 'FINAL_HOLD', source: sourceFor(pose, phase, 'sharp'), complete: true }
  }
  let remaining = Math.max(0, Math.min(elapsedMs, Math.max(0, total - 1)))
  let entry = timeline.at(-1)!
  let index = timeline.length - 1
  for (let candidateIndex = 0; candidateIndex < timeline.length; candidateIndex += 1) {
    const candidate = timeline[candidateIndex]!
    entry = candidate
    index = candidateIndex
    if (remaining < candidate.dwellMs) break
    remaining -= candidate.dwellMs
  }
  const relative = phaseForPose(pose, entry.phase)
  const phase = (startPhase + relative) % 24
  return { phase, visiblePhase: phase, angularPhase: phase, timelinePhase: entry.phase, entryIdentity: `${pose}:L${level}:E${index}`, entryIndex: index, elapsedWithinEntryMs: remaining, dwellDurationMs: entry.dwellMs, fractionalDwellProgress: entry.dwellMs === 0 ? 0 : remaining / entry.dwellMs, surface: entry.surface, decayStage: decayStage(level, entry, index, false), source: sourceFor(pose, phase, entry.surface), complete: false }
}

/** Backwards-compatible snapshot projection of the authoritative cursor. */
export function globeSnapshotAt(pose: GlobePose, level: GlobeLevel, elapsedMs: number, startPhase = 0): GlobeSnapshot {
  return globeTimelineCursor(pose, level, elapsedMs, startPhase)
}

export function globeFrameAt(pose: GlobePose, level: GlobeLevel, elapsedMs: number, startPhase = 0): string {
  return globeSnapshotAt(pose, level, elapsedMs, startPhase).source
}

export function globeFrame(pose: GlobePose, level: GlobeLevel, startPhase = 0): string {
  return globeFrameAt(pose, level, 0, startPhase)
}

export function globeSettleFrame() {
  return `${ROOT}/globe_settle.png`
}

export interface GlobeBox { x: number; y: number; width: number; height: number }

/** Logical 480×180 placement, kept above Rook's head at the globe contact. */
export const GLOBE_LOGICAL_BOX: GlobeBox = { x: 198, y: 18, width: 16, height: 24 }

export function globeGameBox(rookTop: number): GlobeBox {
  const box = { x: GLOBE_LOGICAL_BOX.x * 2, y: GLOBE_LOGICAL_BOX.y * 2, width: GLOBE_LOGICAL_BOX.width * 2, height: GLOBE_LOGICAL_BOX.height * 2 }
  const bottom = box.y + box.height
  if (bottom > rookTop) box.y = Math.max(0, rookTop - box.height)
  return box
}
