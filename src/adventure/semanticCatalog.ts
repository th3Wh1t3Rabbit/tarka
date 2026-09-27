import type { ArtAsset, ArtPackStatus, Point } from './types'

export const ROOK_ANIMATION_IDS = [
  'idle.neutral', 'idle.blink', 'idle.shift', 'idle.eyebrow_raise',
  'walk.contact_a', 'walk.passing_a', 'walk.contact_b', 'walk.passing_b', 'walk.stop_settle',
  'talk.neutral.closed', 'talk.neutral.open', 'talk.emphasis.closed', 'talk.emphasis.open', 'talk.smirk',
  'listen.attentive', 'inspect.lean', 'inspect.hold_item', 'use.reach', 'use.press', 'use.pull',
  'pickup.down', 'pickup.up', 'give.offer', 'read.document', 'hold.key_item',
  'react.confused', 'react.annoyed', 'react.surprised', 'react.camera_glance', 'react.questioning_shrug',
  'react.triumphant', 'react.thinking', 'react.embarrassed', 'react.proud', 'react.startled',
  'micro.foot_tap_a', 'micro.foot_tap_b',
] as const

export const ARCHIVIST_ANIMATION_IDS = [
  'idle.neutral', 'idle.blink', 'idle.shift', 'talk.neutral.closed', 'talk.neutral.open',
  'talk.emphasis.open', 'listen.attentive', 'gesture.explain', 'gesture.point', 'gesture.present',
  'work.stamp_ready', 'work.stamp_down', 'work.stamp_up', 'work.adjust_glasses',
  'work.check_document', 'work.terminal_glance', 'react.skeptical', 'react.annoyed',
  'react.surprised', 'react.startled', 'react.camera_glance', 'react.smug', 'react.resigned', 'react.pleased',
] as const

export const REACTION_OVERLAY_IDS = [
  'reaction.exclaim', 'reaction.question', 'reaction.ellipsis', 'reaction.sweat',
  'reaction.idea', 'reaction.irritation', 'reaction.sparkle', 'reaction.motion_lines',
] as const

export const ROOK_WALK_SEQUENCE: readonly RookAnimationId[] = ['walk.contact_a', 'walk.passing_a', 'walk.contact_b', 'walk.passing_b']

export type CharacterId = 'rook' | 'archivist'
export type RookAnimationId = typeof ROOK_ANIMATION_IDS[number]
export type ArchivistAnimationId = typeof ARCHIVIST_ANIMATION_IDS[number]
export type CharacterAnimationId = RookAnimationId | ArchivistAnimationId
export type ReactionOverlayId = typeof REACTION_OVERLAY_IDS[number]
export type Facing = 'LEFT' | 'RIGHT' | 'FRONT'
export type SequenceMode = 'LOOP' | 'PING_PONG' | 'ONCE' | 'HOLD_LAST'
export type CatalogResolution = 'DIRECT' | 'FALLBACK' | 'OPTIONAL_UNINSTALLED'

export interface SemanticFrame {
  assetSlot: string
  durationMs: number
  contentTag: string
}

export interface SemanticAnimation {
  id: CharacterAnimationId
  frames: SemanticFrame[]
  mode: SequenceMode
  anchor: Point
  mirrorHorizontal: boolean
  sourceFacing: Facing
  priority: number
  returnTo: CharacterAnimationId | null
  reducedMotion: CharacterAnimationId
  fallback: CharacterAnimationId | null
  resolution: CatalogResolution
  frontFacing: boolean
}

export interface ReactionOverlay {
  id: ReactionOverlayId
  frames: SemanticFrame[]
  mode: SequenceMode
  anchorOffset: Point
  reducedMotionFrame: number
  resolution: CatalogResolution
}

export interface CharacterAnimationCatalog {
  schemaVersion: '1.0.0'
  packId: string
  packStatus: ArtPackStatus
  assets: Record<string, ArtAsset>
  verifiedAssetFingerprints?: Record<string, string>
  characters: {
    rook: Record<RookAnimationId, SemanticAnimation>
    archivist: Record<ArchivistAnimationId, SemanticAnimation>
  }
  overlays: Record<ReactionOverlayId, ReactionOverlay>
}

export interface SemanticCatalogDiagnostic {
  semanticId: string
  resolvedAssetSlots: string[]
  resolution: CatalogResolution
  mirror: 'PERMITTED' | 'FORBIDDEN'
  sequence: string
  anchor: Point
  reducedMotion: string
  status: 'PASS' | 'MISSING' | 'INVALID'
}

const ROOK_SLOT: Record<string, string> = {
  'idle.neutral': 'characters.rook.animations.idle.frame1',
  'walk.contact_a': 'characters.rook.animations.walkEast.frame1',
  'walk.passing_a': 'characters.rook.animations.walkEast.frame2',
  'walk.contact_b': 'characters.rook.animations.walkEast.frame1',
  'walk.passing_b': 'characters.rook.animations.walkEast.frame2',
  'talk.neutral.closed': 'characters.rook.animations.talkClosed.frame1',
  'talk.neutral.open': 'characters.rook.animations.talkOpen.frame1',
  'inspect.lean': 'characters.rook.animations.inspect.frame1',
  'use.reach': 'characters.rook.animations.useGive.frame1',
  'give.offer': 'characters.rook.animations.useGive.frame1',
}

const ARCHIVIST_SLOT: Record<string, string> = {
  'idle.neutral': 'characters.mrIndex.animations.idle.frame1',
  'talk.neutral.closed': 'characters.mrIndex.animations.talkClosed.frame1',
  'talk.neutral.open': 'characters.mrIndex.animations.talkOpen.frame1',
  'work.stamp_down': 'characters.mrIndex.animations.stamp.frame1',
}

function semanticAnimation(character: CharacterId, id: CharacterAnimationId, directSlot: string | undefined): SemanticAnimation {
  const fallbackId = id === 'react.camera_glance' ? null : 'idle.neutral'
  const fallbackSlot = character === 'rook' ? ROOK_SLOT['idle.neutral']! : ARCHIVIST_SLOT['idle.neutral']!
  const walk = id.startsWith('walk.')
  const talk = id.startsWith('talk.')
  const micro = id.startsWith('micro.') || id === 'idle.blink' || id === 'idle.eyebrow_raise'
  const frontFacing = id === 'react.camera_glance'
  return {
    id,
    frames: frontFacing && !directSlot ? [] : [{ assetSlot: directSlot ?? fallbackSlot, durationMs: walk ? 120 : talk ? 150 : 240, contentTag: directSlot ? `${character}:${id}` : `${character}:placeholder-fallback` }],
    mode: micro ? 'PING_PONG' : walk || talk ? 'LOOP' : 'HOLD_LAST',
    anchor: character === 'rook' ? { x: 24, y: 86 } : { x: 29, y: 87 },
    mirrorHorizontal: !frontFacing && (character === 'rook' ? walk || talk : false),
    sourceFacing: frontFacing ? 'FRONT' : character === 'rook' ? 'RIGHT' : 'LEFT',
    priority: walk ? 50 : talk ? 60 : id.startsWith('react.') ? 80 : micro ? 20 : 40,
    returnTo: id === 'idle.neutral' ? null : (character === 'rook' ? 'idle.neutral' : 'idle.neutral'),
    reducedMotion: id,
    fallback: fallbackId,
    resolution: directSlot ? 'DIRECT' : frontFacing ? 'OPTIONAL_UNINSTALLED' : 'FALLBACK',
    frontFacing,
  }
}

export function createPlaceholderSemanticCatalog(packId = 'placeholder', packStatus: ArtPackStatus = 'PROVISIONAL_PLACEHOLDER'): CharacterAnimationCatalog {
  const rook = Object.fromEntries(ROOK_ANIMATION_IDS.map((id) => [id, semanticAnimation('rook', id, ROOK_SLOT[id])])) as Record<RookAnimationId, SemanticAnimation>
  const archivist = Object.fromEntries(ARCHIVIST_ANIMATION_IDS.map((id) => [id, semanticAnimation('archivist', id, ARCHIVIST_SLOT[id])])) as Record<ArchivistAnimationId, SemanticAnimation>
  // Four semantic phases stay distinct in tests and diagnostics even while the
  // provisional pack safely reuses two visible placeholder drawings.
  rook['walk.contact_b'].frames[0]!.contentTag = 'rook:walk.contact_b:required-distinct-production'
  rook['walk.passing_b'].frames[0]!.contentTag = 'rook:walk.passing_b:required-distinct-production'
  const overlays = Object.fromEntries(REACTION_OVERLAY_IDS.map((id) => [id, {
    id,
    frames: [{ assetSlot: `overlays.${id}.frame1`, durationMs: 180, contentTag: `${id}:placeholder` }, { assetSlot: `overlays.${id}.frame2`, durationMs: 180, contentTag: `${id}:placeholder:bob` }],
    mode: 'PING_PONG' as const,
    anchorOffset: { x: 18, y: -74 },
    reducedMotionFrame: 0,
    resolution: 'DIRECT' as const,
  }])) as Record<ReactionOverlayId, ReactionOverlay>
  const assets: Record<string, ArtAsset> = {}
  const rookFiles: Record<string, string> = { 'idle.neutral': 'rook.svg', 'walk.contact_a': 'rook-walk.svg', 'walk.passing_a': 'rook-walk-2.svg', 'walk.contact_b': 'rook-walk.svg', 'walk.passing_b': 'rook-walk-2.svg', 'talk.neutral.closed': 'rook.svg', 'talk.neutral.open': 'rook-talk-open.svg', 'inspect.lean': 'rook-inspect.svg', 'use.reach': 'rook-use-give.svg', 'give.offer': 'rook-use-give.svg' }
  for (const [id, slot] of Object.entries(ROOK_SLOT)) assets[slot] = { src: `/art-packs/${packId}/characters/${rookFiles[id] ?? 'rook.svg'}`, width: 48, height: 88 }
  const archivistFiles: Record<string, string> = { 'idle.neutral': 'mr-index.svg', 'talk.neutral.closed': 'mr-index.svg', 'talk.neutral.open': 'mr-index-talk-open.svg', 'work.stamp_down': 'mr-index-stamp.svg' }
  for (const [id, slot] of Object.entries(ARCHIVIST_SLOT)) assets[slot] = { src: `/art-packs/${packId}/characters/${archivistFiles[id] ?? 'mr-index.svg'}`, width: 58, height: 89 }
  for (const id of REACTION_OVERLAY_IDS) {
    const filename = id.replace('reaction.', '').replaceAll('_', '-')
    assets[`overlays.${id}.frame1`] = { src: `/art-packs/${packId}/overlays/${filename}.svg`, width: 24, height: 24 }
    assets[`overlays.${id}.frame2`] = { src: `/art-packs/${packId}/overlays/${filename}.svg`, width: 24, height: 24 }
  }
  return { schemaVersion: '1.0.0', packId, packStatus, assets, characters: { rook, archivist }, overlays }
}

export function validateSemanticCatalog(catalog: CharacterAnimationCatalog) {
  if (catalog.schemaVersion !== '1.0.0') return false
  if (!/^[a-z0-9-]+$/.test(catalog.packId) || !['PROVISIONAL_PLACEHOLDER', 'LEAD_SELECTED'].includes(catalog.packStatus)) return false
  if (Object.keys(catalog.characters.rook).length !== ROOK_ANIMATION_IDS.length || Object.keys(catalog.characters.archivist).length !== ARCHIVIST_ANIMATION_IDS.length || Object.keys(catalog.overlays).length !== REACTION_OVERLAY_IDS.length) return false
  if (!ROOK_ANIMATION_IDS.every((id) => catalog.characters.rook[id]?.id === id)) return false
  if (!ARCHIVIST_ANIMATION_IDS.every((id) => catalog.characters.archivist[id]?.id === id)) return false
  if (!REACTION_OVERLAY_IDS.every((id) => catalog.overlays[id]?.id === id)) return false
  if (!catalog.assets || !Object.entries(catalog.assets).every(([slot, asset]) => {
    const prefix = `/art-packs/${catalog.packId}/`
    const relative = asset.src.startsWith(prefix) ? asset.src.slice(prefix.length) : ''
    const segments = relative.split('/')
    return /^[A-Za-z][A-Za-z0-9_.-]+$/.test(slot) && /^\/art-packs\/[a-z0-9-]+\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(asset.src) && segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..') && asset.width > 0 && asset.height > 0
  })) return false
  const animations = [...Object.values(catalog.characters.rook), ...Object.values(catalog.characters.archivist)]
  if (!animations.every((animation) => (animation.frames.length > 0 || animation.resolution === 'OPTIONAL_UNINSTALLED') && animation.frames.every((frame) => Boolean(catalog.assets[frame.assetSlot]) && Number.isFinite(frame.durationMs) && frame.durationMs > 0))) return false
  if (!Object.values(catalog.overlays).every((overlay) => overlay.frames.every((frame) => Boolean(catalog.assets[frame.assetSlot])))) return false
  const cameraPoses = [catalog.characters.rook['react.camera_glance'], catalog.characters.archivist['react.camera_glance']]
  return cameraPoses.every((pose) => pose.frontFacing && !pose.mirrorHorizontal && pose.fallback === null)
}

export function semanticCatalogDiagnostics(catalog: CharacterAnimationCatalog): SemanticCatalogDiagnostic[] {
  const characterRows = (Object.entries(catalog.characters) as [CharacterId, Record<string, SemanticAnimation>][]).flatMap(([characterId, entries]) => Object.values(entries).map((entry) => ({
    semanticId: `characters.${characterId}.${entry.id}`,
    resolvedAssetSlots: entry.frames.map(({ assetSlot }) => assetSlot),
    resolution: entry.resolution,
    mirror: entry.mirrorHorizontal ? 'PERMITTED' as const : 'FORBIDDEN' as const,
    sequence: `${entry.mode} · ${entry.frames.map(({ durationMs }) => `${durationMs}ms`).join(', ')}`,
    anchor: entry.anchor,
    reducedMotion: entry.reducedMotion,
    status: entry.resolution === 'OPTIONAL_UNINSTALLED' ? 'MISSING' as const : 'PASS' as const,
  })))
  const overlayRows = Object.values(catalog.overlays).map((entry) => ({
    semanticId: entry.id,
    resolvedAssetSlots: entry.frames.map(({ assetSlot }) => assetSlot),
    resolution: entry.resolution,
    mirror: 'FORBIDDEN' as const,
    sequence: `${entry.mode} · ${entry.frames.map(({ durationMs }) => `${durationMs}ms`).join(', ')}`,
    anchor: entry.anchorOffset,
    reducedMotion: `frame${entry.reducedMotionFrame + 1}`,
    status: 'PASS' as const,
  }))
  return [...characterRows, ...overlayRows]
}

export function productionCatalogIsComplete(catalog: CharacterAnimationCatalog) {
  if (catalog.packStatus !== 'LEAD_SELECTED' || !validateSemanticCatalog(catalog)) return false
  if (!semanticCatalogDiagnostics(catalog).every(({ resolution, status }) => resolution === 'DIRECT' && status === 'PASS')) return false
  const fingerprints = catalog.verifiedAssetFingerprints
  if (!fingerprints || Object.keys(catalog.assets).some((slot) => !/^[a-f0-9]{64}$/.test(fingerprints[slot] ?? ''))) return false
  const animationFingerprint = (character: CharacterId, id: string) => {
    const entry = (catalog.characters[character] as Record<string, SemanticAnimation>)[id]
    return entry?.frames[0] ? fingerprints[entry.frames[0].assetSlot] : undefined
  }
  const walk = ROOK_WALK_SEQUENCE.map((id) => animationFingerprint('rook', id))
  if (walk.some((value) => !value) || new Set(walk).size !== ROOK_WALK_SEQUENCE.length) return false
  for (const character of ['rook', 'archivist'] as const) {
    if (animationFingerprint(character, 'talk.neutral.closed') === animationFingerprint(character, 'talk.neutral.open')) return false
  }
  return true
}
