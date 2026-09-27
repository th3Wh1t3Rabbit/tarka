import type { ArtAsset, Point } from './types'
import type { CharacterAnimationCatalog, CharacterId, Facing, SequenceMode } from './semanticCatalog'
import { browserAssetProbe } from './artPack'

export const PERFORMANCE_INTENTIONS = ['IDLE', 'LOCOMOTION', 'SPEAK', 'LISTEN', 'INSPECT', 'USE', 'GIVE', 'PICK_UP', 'READ', 'REACT', 'GESTURE', 'WORK'] as const
export type PerformanceIntention = typeof PERFORMANCE_INTENTIONS[number]
export interface PerformanceRequest { intention: PerformanceIntention; variant?: string; facing?: Facing }
export interface PerformanceClip {
  id: string
  intention: PerformanceIntention
  variant?: string
  frames: { asset: ArtAsset; durationMs: number }[]
  mode: SequenceMode
  sourceFacing: Facing
  mirror: boolean
  anchor: Point
  priority: number
  interruptible: boolean
  reducedFrame: number
  settledFrame: number
}
export interface PerformanceProfile {
  schemaVersion: '1.0.0-capabilities'
  packId: string
  status: 'PLACEHOLDER' | 'UNBOUND' | 'LEAD_REVIEWED'
  characters: Record<CharacterId, PerformanceClip[]>
  fallbackIntention: 'IDLE'
}
const DEMO_IDS: Record<PerformanceIntention, string> = { IDLE: 'idle.neutral', LOCOMOTION: 'walk.contact_a', SPEAK: 'talk.neutral.closed', LISTEN: 'listen.attentive', INSPECT: 'inspect.lean', USE: 'use.reach', GIVE: 'give.offer', PICK_UP: 'pickup.down', READ: 'read.document', REACT: 'react.confused', GESTURE: 'gesture.explain', WORK: 'work.stamp_down' }

/** The old inventory is a demo adapter, never a production completeness rule. */
export function placeholderPerformanceProfile(catalog: CharacterAnimationCatalog): PerformanceProfile {
  const characters = Object.fromEntries((['rook', 'archivist'] as const).map((character) => {
    const entries = catalog.characters[character] as Record<string, typeof catalog.characters.rook['idle.neutral']>
    return [character, PERFORMANCE_INTENTIONS.map((intention) => {
      const sequence = entries[DEMO_IDS[intention]] ?? entries['idle.neutral']!
      const frames = intention === 'SPEAK' ? [entries['talk.neutral.closed']!, entries['talk.neutral.open']!].flatMap((item) => item.frames) : intention === 'LOCOMOTION' && character === 'rook' ? ['walk.contact_a', 'walk.passing_a', 'walk.contact_b', 'walk.passing_b'].flatMap((id) => entries[id]!.frames) : sequence.frames
      return { id: `demo.${character}.${intention}`, intention, frames: frames.map((frame) => ({ asset: catalog.assets[frame.assetSlot]!, durationMs: frame.durationMs })), mode: intention === 'SPEAK' || intention === 'LOCOMOTION' ? 'LOOP' as const : sequence.mode, sourceFacing: sequence.sourceFacing, mirror: sequence.mirrorHorizontal, anchor: sequence.anchor, priority: sequence.priority, interruptible: true, reducedFrame: 0, settledFrame: 0 }
    })]
  })) as PerformanceProfile['characters']
  return { schemaVersion: '1.0.0-capabilities', packId: catalog.packId, status: 'PLACEHOLDER', characters, fallbackIntention: 'IDLE' }
}
export function resolvePerformance(profile: PerformanceProfile, character: CharacterId, request: PerformanceRequest) {
  const clips = profile.characters[character]
  return clips.find((clip) => clip.intention === request.intention && clip.variant === request.variant) ?? clips.find((clip) => clip.intention === request.intention && !clip.variant) ?? clips.find((clip) => clip.intention === profile.fallbackIntention)!
}
export function performanceFrame(clip: PerformanceClip, elapsedMs: number, revealing: boolean, reduced: boolean) {
  if (reduced) return clip.reducedFrame
  if (clip.intention === 'SPEAK' && !revealing) return clip.settledFrame
  const order = clip.mode === 'PING_PONG' && clip.frames.length > 2 ? [...clip.frames.keys(), ...[...clip.frames.keys()].slice(1, -1).reverse()] : [...clip.frames.keys()]
  const total = order.reduce((sum, index) => sum + clip.frames[index]!.durationMs, 0)
  let remainder = clip.mode === 'LOOP' || clip.mode === 'PING_PONG' ? elapsedMs % total : Math.min(elapsedMs, total - 1)
  for (const index of order) { if (remainder < clip.frames[index]!.durationMs) return index; remainder -= clip.frames[index]!.durationMs }
  return clip.frames.length - 1
}
export function validatePerformanceProfile(value: PerformanceProfile) {
  try {
  if (value.fallbackIntention !== 'IDLE') return false
  if (!(['rook', 'archivist'] as const).every((character) => value.characters[character].every((clip) => /^[a-zA-Z0-9._-]+$/.test(clip.id) && ['LOOP', 'ONCE', 'PING_PONG', 'HOLD_LAST'].includes(clip.mode) && ['LEFT', 'RIGHT', 'FRONT'].includes(clip.sourceFacing) && typeof clip.mirror === 'boolean' && typeof clip.interruptible === 'boolean' && Number.isFinite(clip.priority) && Number.isFinite(clip.anchor.x) && Number.isFinite(clip.anchor.y)))) return false
  if (value?.schemaVersion !== '1.0.0-capabilities' || !/^[a-z0-9-]+$/.test(value.packId) || !['PLACEHOLDER', 'UNBOUND', 'LEAD_REVIEWED'].includes(value.status)) return false
  return (['rook', 'archivist'] as const).every((character) => Array.isArray(value.characters?.[character]) && value.characters[character].some((clip) => clip.intention === 'IDLE') && new Set(value.characters[character].map((clip) => clip.id)).size === value.characters[character].length && value.characters[character].every((clip) => PERFORMANCE_INTENTIONS.includes(clip.intention) && clip.frames.length > 0 && clip.frames.every(({ asset, durationMs }) => asset.src.startsWith(`/art-packs/${value.packId}/`) && !asset.src.split('/').some((part) => part === '..' || part === '.') && !/[?%#\\]/.test(asset.src) && Number.isFinite(durationMs) && durationMs > 0 && asset.width > 0 && asset.height > 0) && [clip.reducedFrame, clip.settledFrame].every((index) => Number.isInteger(index) && index >= 0 && index < clip.frames.length)))
  } catch { return false }
}

/** Optional capability binding, not the old demo's completeness rule. */
export async function loadPerformanceProfile(packId: string, reviewed: boolean, demo: CharacterAnimationCatalog, probe = browserAssetProbe): Promise<PerformanceProfile> {
  const fallback = placeholderPerformanceProfile(demo)
  if (!reviewed) return { ...fallback, status: packId === 'placeholder' ? 'PLACEHOLDER' : 'UNBOUND' }
  try {
    const response = await fetch(`/art-packs/${packId}/performance-profile.json`)
    if (response.ok) {
      const profile = await response.json() as PerformanceProfile
      if (profile.packId === packId && profile.status === 'LEAD_REVIEWED' && validatePerformanceProfile(profile)) {
        const assets = [...new Map(Object.values(profile.characters).flatMap((clips) => clips.flatMap((clip) => clip.frames.map(({ asset }) => [asset.src, asset] as const)))).values()]
        const results = await Promise.all(assets.map(async (asset) => ({ asset, result: await probe(asset) })))
        if (results.every(({ asset, result }) => result.status === 'LOADED' && result.width === asset.width && result.height === asset.height && /^[a-f0-9]{64}$/.test(result.contentFingerprint))) return profile
      }
    }
  } catch { /* Unavailable reviewed capabilities stay unbound. */ }
  return { ...fallback, status: 'UNBOUND' }
}

export interface LogicalPropPresentation { logicalState: string; visualClipId: string | null; immediateSwapPermitted: true }
export function logicalPropPresentation(logicalState: string, visualClipId: string | null = null): LogicalPropPresentation { return { logicalState, visualClipId, immediateSwapPermitted: true } }
