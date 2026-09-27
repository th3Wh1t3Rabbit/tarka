import { sceneDefinitions } from './scenes'
import { renderContractFailure, slotRenderContract, type RenderContract } from './renderContract'
import { createPlaceholderSemanticCatalog, validateSemanticCatalog, type CharacterAnimationCatalog } from './semanticCatalog'
import type {
  AnimationArt,
  ArtAsset,
  ArtPackAssetDiagnostic,
  ArtPackDiagnostics,
  ArtPackIndex,
  ArtPackIndexEntry,
  ArtPackManifest,
  AssetProbe,
  CharacterArt,
  InventoryItemId,
  LoadedArtPack,
  PropArt,
  SceneArt,
} from './types'

const inventorySlots: InventoryItemId[] = ['blank-terminal-authorization-form', 'loose-feather-pen', 'signed-terminal-authorization-form-with-doodles', 'broken-feather-pen', 'approved-stamped-terminal-authorization-form', 'euler-case-file', 'rubber-band', 'rubiks-cube', 'sharknado-2-vhs', 'piggy-bank-intact', 'small-toolbox-closed', 'small-toolbox-open-empty', 'hammer', 'nails', 'fictional-token-note']
const requiredProps = ['requestDispenser', 'penStand', 'nansenTerminal'] as const
const propDimensions: Record<(typeof requiredProps)[number], { width: number; height: number }> = {
  requestDispenser: { width: 47, height: 70 },
  penStand: { width: 24, height: 32 },
  nansenTerminal: { width: 56, height: 107 },
}
const requiredPropStates: Record<(typeof requiredProps)[number], string[]> = {
  requestDispenser: [],
  penStand: [],
  nansenTerminal: ['unlocked'],
}
const characterDimensions = { rook: { width: 48, height: 88 }, mrIndex: { width: 58, height: 89 } } as const
const requiredAnimations = { rook: ['idle', 'walkEast', 'talkClosed', 'talkOpen', 'inspect', 'useGive'], mrIndex: ['idle', 'talkClosed', 'talkOpen', 'stamp'] } as const

interface SlotInput {
  semanticSlot: string
  asset: ArtAsset | null
  requirement: 'REQUIRED' | 'OPTIONAL'
  expectedDimensions: { width: number; height: number }
  animationDimensions?: { width: number; height: number }
  contract: RenderContract | null
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function positive(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function dimensionsEqual(left: { width: number; height: number }, right: { width: number; height: number }) {
  return left.width === right.width && left.height === right.height
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

function bounded(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isAsset(value: unknown, packId: string): value is ArtAsset {
  const asset = record(value)
  if (!asset) return false
  const prefix = `/art-packs/${packId}/`
  if (typeof asset.src !== 'string' || !asset.src.startsWith(prefix) || !/^\/art-packs\/[a-z0-9-]+\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(asset.src)) return false
  const relative = asset.src.slice(prefix.length)
  const segments = relative.split('/')
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..') && positive(asset.width) && positive(asset.height)
}

function isAnimation(value: unknown, packId: string, name: string): value is AnimationArt {
  const animation = record(value)
  const walk = name === 'walkEast'; const timedSpeech = name === 'talkClosed' || name === 'talkOpen'; const frameMinimum = walk ? 2 : 1; const frameMaximum = walk ? 4 : 1
  if (!animation || !Array.isArray(animation.frames) || animation.frames.length < frameMinimum || animation.frames.length > frameMaximum || !animation.frames.every((frame) => isAsset(frame, packId)) || !positive(animation.frameWidth) || !positive(animation.frameHeight) || typeof animation.loop !== 'boolean' || (animation.mirrorHorizontal !== undefined && typeof animation.mirrorHorizontal !== 'boolean')) return false
  if (!bounded(animation.fps, walk || timedSpeech ? 6 : 0.1, walk || timedSpeech ? 10 : 24)) return false
  return !walk || new Set(animation.frames.map((frame) => (frame as ArtAsset).src)).size === animation.frames.length
}

function isCharacter(value: unknown, packId: string, characterId: keyof typeof characterDimensions, names: readonly string[]): value is CharacterArt {
  const character = record(value); const anchor = record(character?.anchor); const animations = record(character?.animations)
  const dimensions = characterDimensions[characterId]
  if (!character || !anchor || !animations || !bounded(anchor.x, 0, dimensions.width) || !bounded(anchor.y, 0, dimensions.height) || !bounded(character.scale, 0.5, 4) || typeof character.mirrorHorizontal !== 'boolean' || !exactKeys(animations, names)) return false
  return names.every((name) => isAnimation(animations[name], packId, name))
}

function isProp(value: unknown, packId: string): value is PropArt {
  const prop = record(value); const states = record(prop?.states)
  return Boolean(prop && states && isAsset(prop.default, packId) && Object.values(states).every((asset) => isAsset(asset, packId)))
}

function isScene(value: unknown, packId: string, sceneId: 'records-office' | 'blank-shell'): value is SceneArt {
  const scene = record(value)
  if (!scene || !isAsset(scene.background, packId) || !Array.isArray(scene.midgroundLayers) || !Array.isArray(scene.foregroundLayers) || !Array.isArray(scene.depthBands) || !Array.isArray(scene.propPlacements) || !record(scene.characterAnchors)) return false
  const layers = [...scene.midgroundLayers, ...scene.foregroundLayers]
  const layersValid = layers.every((layer) => { const item = record(layer); return item && typeof item.id === 'string' && item.id.length > 0 && bounded(item.depth, 1, 20) && isAsset(item.asset, packId) }) && new Set(layers.map((layer) => record(layer)?.id)).size === layers.length
  const bandsValid = scene.depthBands.length > 0 && scene.depthBands.every((band) => { const item = record(band); return item && typeof item.id === 'string' && item.id.length > 0 && bounded(item.minY, 0, 360) && bounded(item.maxY, 0, 360) && Number(item.minY) <= Number(item.maxY) && Number.isInteger(item.zIndex) && bounded(item.zIndex, 1, 20) }) && new Set(scene.depthBands.map((band) => record(band)?.id)).size === scene.depthBands.length
  const depthBandIds = new Set(scene.depthBands.map((band) => record(band)?.id))
  const placementIds = scene.propPlacements.map((placement) => String(record(placement)?.propId))
  const expectedPlacements = sceneId === 'records-office' ? requiredProps : []
  const placementsValid = exactKeys(Object.fromEntries(placementIds.map((id) => [id, true])), expectedPlacements) && placementIds.length === expectedPlacements.length && scene.propPlacements.every((placement) => { const item = record(placement); return item && requiredProps.includes(String(item.propId) as (typeof requiredProps)[number]) && bounded(item.x, 0, 960) && bounded(item.y, 0, 360) && typeof item.depthBand === 'string' && depthBandIds.has(item.depthBand) })
  const anchors = record(scene.characterAnchors); const rookStart = record(anchors?.rookStart); const mrIndex = record(anchors?.mrIndex)
  const anchorsValid = anchors && exactKeys(anchors, ['rookStart', 'mrIndex']) && rookStart && mrIndex && bounded(rookStart.x, 0, 960) && bounded(rookStart.y, 0, 360) && bounded(mrIndex.x, 0, 960) && bounded(mrIndex.y, 0, 360)
  return Boolean(layersValid && bandsValid && placementsValid && anchorsValid && scene.walkRegionId === sceneDefinitions[sceneId].walkRegion.id && scene.hotspotGeometryId === sceneDefinitions[sceneId].hotspotGeometryId)
}

export function validateArtPackManifest(value: unknown): value is ArtPackManifest {
  const manifest = record(value)
  if (!manifest || manifest.schemaVersion !== '2.0.0' || typeof manifest.id !== 'string' || !/^[a-z0-9-]+$/.test(manifest.id) || typeof manifest.label !== 'string') return false
  if (manifest.status !== 'PROVISIONAL_PLACEHOLDER' && manifest.status !== 'LEAD_SELECTED') return false
  if (!['LOW_RES_ILLUSTRATED', 'PIXEL_INSPIRED', 'HIGH_RES_ILLUSTRATED_DOWNSAMPLED'].includes(String(manifest.artMode)) || manifest.scalingMode !== 'NEAREST_NEIGHBOR') return false
  const native = record(manifest.nativeResolution); const browser = record(manifest.browserResolution); const scenes = record(manifest.scenes); const characters = record(manifest.characters); const props = record(manifest.props); const inventory = record(manifest.inventory); const cursor = record(manifest.cursor)
  if (!native || native.width !== 480 || native.height !== 270 || native.sceneHeight !== 180 || native.interfaceHeight !== 90 || !browser || browser.width !== 960 || browser.height !== 540 || browser.sceneHeight !== 360 || browser.interfaceHeight !== 180) return false
  if (!Array.isArray(manifest.palette) || manifest.palette.length < 4 || !manifest.palette.every((color) => typeof color === 'string')) return false
  const packId = manifest.id
  if (!scenes || !exactKeys(scenes, ['records-office', 'blank-shell']) || !isScene(scenes['records-office'], packId, 'records-office') || !isScene(scenes['blank-shell'], packId, 'blank-shell')) return false
  if (!characters || !exactKeys(characters, ['rook', 'mrIndex']) || !isCharacter(characters.rook, packId, 'rook', requiredAnimations.rook) || !isCharacter(characters.mrIndex, packId, 'mrIndex', requiredAnimations.mrIndex)) return false
  if (!props || !requiredProps.every((id) => {
    const prop = record(props[id])
    const states = record(prop?.states)
    return isProp(props[id], packId) && states && exactKeys(states, requiredPropStates[id]) && requiredPropStates[id].every((state) => Boolean(states[state]))
  }) || !exactKeys(props, requiredProps)) return false
  if (!inventory || !exactKeys(inventory, inventorySlots) || !inventorySlots.every((id) => isAsset(inventory[id], packId)) || !cursor || !exactKeys(cursor, ['crosshair']) || !isAsset(cursor.crosshair, packId)) return false
  return true
}

export function validateArtPackIndex(value: unknown): value is ArtPackIndex {
  const index = record(value)
  if (index?.schemaVersion !== '1.0.0' || !Array.isArray(index.packs) || index.packs.length < 4) return false
  const ids = index.packs.map((pack) => record(pack)?.id)
  return ids.includes('placeholder') && new Set(ids).size === ids.length && index.packs.every((pack) => { const item = record(pack); return item && typeof item.id === 'string' && /^[a-z0-9-]+$/.test(item.id) && typeof item.label === 'string' && ['PROVISIONAL_PLACEHOLDER', 'LEAD_SELECTED', 'AUDITION_EMPTY'].includes(String(item.status)) })
}

function collectManifestSlots(manifest: ArtPackManifest): SlotInput[] {
  const slots: SlotInput[] = []
  for (const sceneId of ['records-office', 'blank-shell'] as const) {
    const scene = manifest.scenes[sceneId]
    const sceneContract = slotRenderContract({ packId: manifest.id, kind: 'background', asset: scene.background, placeholder: { width: 480, height: 180 } })
    slots.push({ semanticSlot: `scenes.${sceneId}.background`, asset: scene.background, requirement: 'REQUIRED', expectedDimensions: sceneContract?.renderBox ?? { width: 480, height: 180 }, contract: sceneContract })
    for (const layerType of ['midgroundLayers', 'foregroundLayers'] as const) {
      const layers = scene[layerType]
      const layerContract = slotRenderContract({ packId: manifest.id, kind: 'layer', asset: null, placeholder: { width: 480, height: 180 } })
      if (layers.length === 0) slots.push({ semanticSlot: `scenes.${sceneId}.${layerType}`, asset: null, requirement: 'OPTIONAL', expectedDimensions: layerContract?.renderBox ?? { width: 480, height: 180 }, contract: layerContract })
      for (const layer of layers) slots.push({ semanticSlot: `scenes.${sceneId}.${layerType}.${layer.id}`, asset: layer.asset, requirement: 'OPTIONAL', expectedDimensions: layerContract?.renderBox ?? { width: 480, height: 180 }, contract: layerContract })
    }
  }
  for (const characterId of ['rook', 'mrIndex'] as const) {
    const character = manifest.characters[characterId]
    const expected = characterDimensions[characterId]
    for (const animationId of requiredAnimations[characterId]) {
      const animation = character.animations[animationId]!
      const family = { width: animation.frameWidth, height: animation.frameHeight }
      const characterContract = slotRenderContract({ packId: manifest.id, kind: 'character', asset: animation.frames[0] ?? null, family, placeholder: expected })
      animation.frames.forEach((asset, index) => slots.push({ semanticSlot: `characters.${characterId}.${animationId}.frame${index + 1}`, asset, requirement: animationId === 'walkEast' && index >= 2 ? 'OPTIONAL' : 'REQUIRED', expectedDimensions: characterContract?.renderBox ?? expected, animationDimensions: family, contract: characterContract }))
      if (animationId === 'walkEast') for (let index = animation.frames.length; index < 4; index += 1) slots.push({ semanticSlot: `characters.${characterId}.${animationId}.frame${index + 1}`, asset: null, requirement: 'OPTIONAL', expectedDimensions: expected, animationDimensions: family, contract: characterContract })
    }
  }
  for (const propId of requiredProps) {
    const prop = manifest.props[propId]!
    const propContract = (asset: ArtAsset) => slotRenderContract({ packId: manifest.id, kind: 'prop', asset, placeholder: propDimensions[propId] })
    const propDefault = propContract(prop.default)
    slots.push({ semanticSlot: `props.${propId}.default`, asset: prop.default, requirement: 'REQUIRED', expectedDimensions: propDefault?.renderBox ?? propDimensions[propId], contract: propDefault })
    for (const state of requiredPropStates[propId]) {
      const stateContract = propContract(prop.states[state]!)
      slots.push({ semanticSlot: `props.${propId}.${state}`, asset: prop.states[state]!, requirement: 'REQUIRED', expectedDimensions: stateContract?.renderBox ?? propDimensions[propId], contract: stateContract })
    }
  }
  for (const itemId of inventorySlots) {
    const item = manifest.inventory[itemId]
    const inventoryContract = slotRenderContract({ packId: manifest.id, kind: 'inventory', asset: item, placeholder: { width: 32, height: 24 } })
    slots.push({ semanticSlot: `inventory.${itemId}`, asset: item, requirement: 'REQUIRED', expectedDimensions: inventoryContract?.renderBox ?? { width: 32, height: 24 }, contract: inventoryContract })
  }
  const cursorContract = slotRenderContract({ packId: manifest.id, kind: 'cursor', asset: manifest.cursor.crosshair, placeholder: { width: 16, height: 16 } })
  slots.push({ semanticSlot: 'cursor.crosshair', asset: manifest.cursor.crosshair, requirement: 'REQUIRED', expectedDimensions: cursorContract?.renderBox ?? { width: 16, height: 16 }, contract: cursorContract })
  return slots
}

async function inspectSlot(slot: SlotInput, probe: AssetProbe): Promise<ArtPackAssetDiagnostic> {
  const contractFields = { renderBox: slot.contract?.renderBox ?? { width: 0, height: 0 }, fitPolicy: slot.contract?.fitPolicy ?? 'NEAREST_EXACT' as const, pixelScaling: slot.contract?.pixelScaling ?? 'NEAREST_NEIGHBOR' as const }
  if (!slot.asset) return { semanticSlot: slot.semanticSlot, sourcePath: null, requirement: slot.requirement, declaredDimensions: null, expectedDimensions: slot.expectedDimensions, ...contractFields, actualDimensions: null, contentFingerprint: null, status: 'OPTIONAL_ABSENT', detail: 'Optional slot is not installed.' }
  const declared = { width: slot.asset.width, height: slot.asset.height }
  const result = await probe(slot.asset)
  const actual = result.status === 'LOADED' ? { width: result.width, height: result.height } : null
  const contentFingerprint = result.status === 'LOADED' ? result.contentFingerprint : null
  let status: ArtPackAssetDiagnostic['status'] = 'PASS'; let detail = 'Decoded bytes match the manifest. The render box is a separate nearest-neighbor contract.'
  const contractError = result.status === 'LOADED' ? renderContractFailure(slot.contract, declared, actual) : slot.contract ? null : 'Render contract is missing.'
  if (result.status === 'MISSING') { status = 'MISSING'; detail = result.detail ?? 'Resource does not exist.' }
  else if (result.status === 'DECODE_FAILED') { status = 'DECODE_FAILED'; detail = result.detail ?? 'Resource could not be decoded as an image.' }
  else if (!/^[a-f0-9]{64}$/.test(contentFingerprint ?? '')) { status = 'INVALID'; detail = 'Fetched resource has no valid lowercase SHA-256 content fingerprint.' }
  else if (!slot.contract) { status = 'INVALID'; detail = 'Render contract is missing.' }
  else if (contractError) { status = 'DIMENSION_MISMATCH'; detail = contractError }
  else if (slot.animationDimensions && !dimensionsEqual(declared, slot.animationDimensions)) { status = 'DIMENSION_MISMATCH'; detail = `Frame declares ${declared.width}x${declared.height}; animation family declares ${slot.animationDimensions.width}x${slot.animationDimensions.height}.` }
  return { semanticSlot: slot.semanticSlot, sourcePath: slot.asset.src, requirement: slot.requirement, declaredDimensions: declared, expectedDimensions: slot.expectedDimensions, ...contractFields, actualDimensions: actual, contentFingerprint, status, detail }
}

function invalidTemplateSlots(placeholder: ArtPackManifest, status: 'MISSING' | 'INVALID') {
  return collectManifestSlots(placeholder).map<ArtPackAssetDiagnostic>((slot) => ({ semanticSlot: slot.semanticSlot, sourcePath: null, requirement: slot.requirement, declaredDimensions: null, expectedDimensions: slot.expectedDimensions, renderBox: slot.contract?.renderBox ?? { width: 0, height: 0 }, fitPolicy: slot.contract?.fitPolicy ?? 'NEAREST_EXACT', pixelScaling: slot.contract?.pixelScaling ?? 'NEAREST_NEIGHBOR', actualDimensions: null, contentFingerprint: null, status: slot.requirement === 'OPTIONAL' ? 'OPTIONAL_ABSENT' : status, detail: status === 'MISSING' ? 'Candidate manifest or asset is missing.' : 'Candidate metadata is invalid and was not activated.' }))
}

function sanitizeOptionalFailures(manifest: ArtPackManifest, diagnostics: ArtPackAssetDiagnostic[]) {
  const copy = structuredClone(manifest)
  const invalidSources = new Set(diagnostics.filter(({ requirement, status, sourcePath }) => requirement === 'OPTIONAL' && !['PASS', 'OPTIONAL_ABSENT'].includes(status) && sourcePath).map(({ sourcePath }) => sourcePath))
  for (const scene of Object.values(copy.scenes)) {
    scene.midgroundLayers = scene.midgroundLayers.filter(({ asset }) => !invalidSources.has(asset.src))
    scene.foregroundLayers = scene.foregroundLayers.filter(({ asset }) => !invalidSources.has(asset.src))
  }
  for (const character of Object.values(copy.characters)) {
    const walk = character.animations.walkEast
    if (walk) walk.frames = walk.frames.filter((asset, index) => index < 2 || !invalidSources.has(asset.src))
  }
  return copy
}

function manifestIdentity(value: unknown) {
  const item = record(value)
  return item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.status === 'string' ? { id: item.id, label: item.label, status: item.status } : null
}

export async function inspectArtPackCandidate(requestedPackId: string, indexEntry: ArtPackIndexEntry | null, value: unknown, probe: AssetProbe, placeholderTemplate: ArtPackManifest): Promise<{ manifest: ArtPackManifest | null; diagnostics: ArtPackDiagnostics }> {
  const identity = manifestIdentity(value)
  const structuralValid = validateArtPackManifest(value)
  const consistent = Boolean(structuralValid && indexEntry && indexEntry.id === requestedPackId && value.id === requestedPackId && indexEntry.label === value.label && indexEntry.status === value.status)
  if (!structuralValid) {
    const slots = invalidTemplateSlots(placeholderTemplate, 'INVALID')
    return { manifest: null, diagnostics: { requestedPackId, indexEntry, manifestIdentity: identity, loadedPackId: 'placeholder', loadedPackStatus: 'PROVISIONAL_PLACEHOLDER', placeholderInheritance: false, fallbackActive: true, indexManifestConsistent: false, requiredSlots: slots.filter(({ requirement }) => requirement === 'REQUIRED'), optionalSlots: slots.filter(({ requirement }) => requirement === 'OPTIONAL'), invalidSlots: slots.filter(({ status }) => status === 'INVALID').map(({ semanticSlot }) => semanticSlot), candidateAssetsInstalled: 0, disposition: 'INVALID_MANIFEST' } }
  }
  const inputs = collectManifestSlots(value)
  if (!consistent) {
    const slots = inputs.map<ArtPackAssetDiagnostic>((slot) => ({ semanticSlot: slot.semanticSlot, sourcePath: slot.asset?.src ?? null, requirement: slot.requirement, declaredDimensions: slot.asset ? { width: slot.asset.width, height: slot.asset.height } : null, expectedDimensions: slot.expectedDimensions, renderBox: slot.contract?.renderBox ?? { width: 0, height: 0 }, fitPolicy: slot.contract?.fitPolicy ?? 'NEAREST_EXACT', pixelScaling: slot.contract?.pixelScaling ?? 'NEAREST_NEIGHBOR', actualDimensions: null, contentFingerprint: null, status: slot.asset ? 'INVALID' : 'OPTIONAL_ABSENT', detail: 'Index and manifest identity or status disagree; candidate assets were not activated.' }))
    return { manifest: null, diagnostics: { requestedPackId, indexEntry, manifestIdentity: identity, loadedPackId: 'placeholder', loadedPackStatus: 'PROVISIONAL_PLACEHOLDER', placeholderInheritance: false, fallbackActive: true, indexManifestConsistent: false, requiredSlots: slots.filter(({ requirement }) => requirement === 'REQUIRED'), optionalSlots: slots.filter(({ requirement }) => requirement === 'OPTIONAL'), invalidSlots: slots.filter(({ status }) => status === 'INVALID').map(({ semanticSlot }) => semanticSlot), candidateAssetsInstalled: new Set(inputs.flatMap(({ asset }) => asset ? [asset.src] : [])).size, disposition: 'INVALID_INDEX_MANIFEST_MISMATCH' } }
  }
  const slots = await Promise.all(inputs.map((slot) => inspectSlot(slot, probe)))
  for (const characterId of ['rook', 'mrIndex'] as const) {
    const closed = value.characters[characterId].animations.talkClosed!.frames[0]!.src
    const open = value.characters[characterId].animations.talkOpen!.frames[0]!.src
    if (closed === open) {
      const talkOpen = slots.find(({ semanticSlot }) => semanticSlot === `characters.${characterId}.talkOpen.frame1`)
      if (talkOpen) { talkOpen.status = 'INVALID'; talkOpen.detail = 'Talk-open and talk-closed states must reference distinct assets.' }
    }
  }
  const markDuplicateContent = (semanticSlots: string[], description: string) => {
    const candidates = semanticSlots.map((semanticSlot) => slots.find((slot) => slot.semanticSlot === semanticSlot)).filter((slot): slot is ArtPackAssetDiagnostic => Boolean(slot && slot.status === 'PASS' && slot.contentFingerprint))
    const groups = new Map<string, ArtPackAssetDiagnostic[]>()
    for (const slot of candidates) groups.set(slot.contentFingerprint!, [...(groups.get(slot.contentFingerprint!) ?? []), slot])
    for (const duplicates of groups.values()) if (duplicates.length > 1) for (const slot of duplicates) {
      slot.status = 'DUPLICATE_CONTENT'
      slot.detail = description
    }
  }
  markDuplicateContent(value.characters.rook.animations.walkEast!.frames.map((_, index) => `characters.rook.walkEast.frame${index + 1}`), 'Rook walk frames must contain pairwise distinct fetched bytes.')
  markDuplicateContent(['characters.rook.talkClosed.frame1', 'characters.rook.talkOpen.frame1'], 'Rook talk-closed and talk-open states must contain distinct fetched bytes.')
  markDuplicateContent(['characters.mrIndex.talkClosed.frame1', 'characters.mrIndex.talkOpen.frame1'], 'Mr. Index talk-closed and talk-open states must contain distinct fetched bytes.')
  // Optional walk slots may be absent, but once installed they participate in
  // the same pairwise identity contract as the two required walk frames.
  // Duplicate installed walk content therefore invalidates the whole candidate.
  const requiredInvalid = slots.filter(({ requirement, status }) => (requirement === 'REQUIRED' && status !== 'PASS') || status === 'DUPLICATE_CONTENT')
  const optionalInvalid = slots.filter(({ requirement, status }) => requirement === 'OPTIONAL' && !['PASS', 'OPTIONAL_ABSENT', 'DUPLICATE_CONTENT'].includes(status))
  const disposition = requiredInvalid.length > 0
    ? 'INVALID_REQUIRED_ASSETS'
    : optionalInvalid.length > 0
      ? value.status === 'LEAD_SELECTED' ? 'LEAD_SELECTED_WITH_OPTIONAL_OMISSIONS' : 'INVALID_REQUIRED_ASSETS'
      : value.status === 'LEAD_SELECTED'
        ? 'COMPLETE_LEAD_SELECTED'
        : 'COMPLETE_PLACEHOLDER'
  return {
    manifest: requiredInvalid.length > 0 ? null : sanitizeOptionalFailures(value, slots),
    diagnostics: {
      requestedPackId,
      indexEntry,
      manifestIdentity: identity,
      loadedPackId: requiredInvalid.length > 0 ? 'placeholder' : value.id,
      loadedPackStatus: requiredInvalid.length > 0 ? 'PROVISIONAL_PLACEHOLDER' : value.status,
      placeholderInheritance: false,
      fallbackActive: requiredInvalid.length > 0 || optionalInvalid.length > 0,
      indexManifestConsistent: true,
      requiredSlots: slots.filter(({ requirement }) => requirement === 'REQUIRED'),
      optionalSlots: slots.filter(({ requirement }) => requirement === 'OPTIONAL'),
      invalidSlots: [...requiredInvalid, ...optionalInvalid].map(({ semanticSlot }) => semanticSlot),
      candidateAssetsInstalled: new Set(inputs.flatMap(({ asset }) => asset ? [asset.src] : [])).size,
      disposition,
    },
  }
}

export async function browserAssetProbe(asset: ArtAsset) {
  try {
    const response = await fetch(asset.src, { cache: 'no-store' })
    if (!response.ok) return { status: 'MISSING' as const, detail: `HTTP ${response.status}` }
    const bytes = await response.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const contentFingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const contentType = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream'
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener('load', () => resolve(String(reader.result)), { once: true })
      reader.addEventListener('error', () => reject(reader.error), { once: true })
      reader.readAsDataURL(new Blob([bytes], { type: contentType }))
    })
    const image = new Image()
    try {
      // A CSP-allowed data URL decodes the exact fetched bytes used above for
      // the fingerprint, rather than issuing a second potentially divergent request.
      image.src = dataUrl
      await image.decode()
      return { status: 'LOADED' as const, width: image.naturalWidth, height: image.naturalHeight, contentFingerprint }
    } catch {
      return { status: 'DECODE_FAILED' as const, detail: 'Browser image decode failed.' }
    }
  } catch {
    return { status: 'MISSING' as const, detail: 'Local resource fetch failed.' }
  }
}

export async function loadArtPackIndex(): Promise<ArtPackIndex> {
  const response = await fetch('/art-packs/index.json', { cache: 'no-store' })
  const value: unknown = await response.json()
  if (!response.ok || !validateArtPackIndex(value)) throw new Error('Art pack index is invalid')
  return value
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<unknown>
}

async function loadValidatedPlaceholder(packIndex: ArtPackIndex, probe: AssetProbe) {
  const entry = packIndex.packs.find(({ id }) => id === 'placeholder') ?? null
  const value = await fetchJson('/art-packs/placeholder/manifest.json')
  if (!validateArtPackManifest(value)) throw new Error('Placeholder art pack metadata is invalid')
  const result = await inspectArtPackCandidate('placeholder', entry, value, probe, value)
  if (!result.manifest || result.diagnostics.disposition !== 'COMPLETE_PLACEHOLDER') throw new Error('Placeholder art pack assets are invalid')
  return result
}

function inheritedDiagnostics(requestedPackId: string, indexEntry: ArtPackIndexEntry, identity: { id: string; label: string; status: string }, placeholder: Awaited<ReturnType<typeof loadValidatedPlaceholder>>): ArtPackDiagnostics {
  const inherit = (slot: ArtPackAssetDiagnostic): ArtPackAssetDiagnostic => slot.status === 'PASS' ? { ...slot, status: 'INHERITED_PLACEHOLDER', detail: 'Empty audition slot explicitly inherits this validated placeholder asset.' } : slot
  return { requestedPackId, indexEntry, manifestIdentity: identity, loadedPackId: 'placeholder', loadedPackStatus: 'PROVISIONAL_PLACEHOLDER', placeholderInheritance: true, fallbackActive: true, indexManifestConsistent: true, requiredSlots: placeholder.diagnostics.requiredSlots.map(inherit), optionalSlots: placeholder.diagnostics.optionalSlots.map(inherit), invalidSlots: [], candidateAssetsInstalled: 0, disposition: 'EMPTY_INHERITING_PLACEHOLDER' }
}

export async function loadArtPack(packId: string, packIndex?: ArtPackIndex, probe: AssetProbe = browserAssetProbe): Promise<LoadedArtPack> {
  const index = packIndex ?? await loadArtPackIndex()
  const placeholder = await loadValidatedPlaceholder(index, probe)
  const entry = index.packs.find(({ id }) => id === packId) ?? null
  if (!entry) {
    const slots = invalidTemplateSlots(placeholder.manifest!, 'MISSING')
    return { manifest: placeholder.manifest!, packIndex: index, diagnostics: { requestedPackId: packId, indexEntry: null, manifestIdentity: null, loadedPackId: 'placeholder', loadedPackStatus: 'PROVISIONAL_PLACEHOLDER', placeholderInheritance: false, fallbackActive: true, indexManifestConsistent: false, requiredSlots: slots.filter(({ requirement }) => requirement === 'REQUIRED'), optionalSlots: slots.filter(({ requirement }) => requirement === 'OPTIONAL'), invalidSlots: slots.filter(({ status }) => status === 'MISSING').map(({ semanticSlot }) => semanticSlot), candidateAssetsInstalled: 0, disposition: 'MISSING_USING_FALLBACK' } }
  }
  let value: unknown
  try { value = await fetchJson(`/art-packs/${packId}/manifest.json`) } catch {
    const slots = invalidTemplateSlots(placeholder.manifest!, 'MISSING')
    return { manifest: placeholder.manifest!, packIndex: index, diagnostics: { requestedPackId: packId, indexEntry: entry, manifestIdentity: null, loadedPackId: 'placeholder', loadedPackStatus: 'PROVISIONAL_PLACEHOLDER', placeholderInheritance: false, fallbackActive: true, indexManifestConsistent: false, requiredSlots: slots.filter(({ requirement }) => requirement === 'REQUIRED'), optionalSlots: slots.filter(({ requirement }) => requirement === 'OPTIONAL'), invalidSlots: slots.filter(({ status }) => status === 'MISSING').map(({ semanticSlot }) => semanticSlot), candidateAssetsInstalled: 0, disposition: 'MISSING_USING_FALLBACK' } }
  }
  const identity = manifestIdentity(value)
  if (entry.status === 'AUDITION_EMPTY') {
    const descriptor = record(value)
    const valid = descriptor?.schemaVersion === '2.0.0-slot' && descriptor.id === entry.id && descriptor.label === entry.label && descriptor.status === 'AUDITION_EMPTY' && descriptor.inherits === 'placeholder'
    if (valid && identity) return { manifest: placeholder.manifest!, packIndex: index, diagnostics: inheritedDiagnostics(packId, entry, identity, placeholder) }
    const result = await inspectArtPackCandidate(packId, entry, value, probe, placeholder.manifest!)
    return { manifest: placeholder.manifest!, packIndex: index, diagnostics: { ...result.diagnostics, loadedPackId: 'placeholder', loadedPackStatus: 'PROVISIONAL_PLACEHOLDER', fallbackActive: true, disposition: 'INVALID_INDEX_MANIFEST_MISMATCH' } }
  }
  const result = await inspectArtPackCandidate(packId, entry, value, probe, placeholder.manifest!)
  const manifest = result.manifest ?? placeholder.manifest!
  return { manifest, packIndex: index, diagnostics: { ...result.diagnostics, loadedPackId: result.manifest?.id ?? 'placeholder', loadedPackStatus: result.manifest?.status ?? 'PROVISIONAL_PLACEHOLDER', fallbackActive: result.diagnostics.fallbackActive || !result.manifest } }
}

/**
 * Sidecar loader for the v1 semantic animation interface. Production packs
 * may install semantic-catalog.json without changing scenes or mission code;
 * absent/invalid sidecars resolve to the complete provisional catalog.
 */
export async function loadCharacterAnimationCatalog(packId: string, status: ArtPackManifest['status'], probe: AssetProbe = browserAssetProbe): Promise<CharacterAnimationCatalog> {
  if (packId !== 'placeholder') {
    try {
      const candidate = await fetchJson(`/art-packs/${packId}/semantic-catalog.json`)
      if (validateSemanticCatalog(candidate as CharacterAnimationCatalog) && (candidate as CharacterAnimationCatalog).packId === packId && (candidate as CharacterAnimationCatalog).packStatus === status) {
        const catalog = candidate as CharacterAnimationCatalog
        const probes = await Promise.all(Object.values(catalog.assets).map(async (asset) => ({ asset, result: await probe(asset) })))
        const validAssets = probes.every(({ asset, result }) => result.status === 'LOADED' && result.width === asset.width && result.height === asset.height && /^[a-f0-9]{64}$/.test(result.contentFingerprint))
        if (validAssets) {
          const verified = structuredClone(catalog)
          const verifiedAssetFingerprints: Record<string, string> = {}
          for (const [slot, asset] of Object.entries(catalog.assets)) {
            const loadedProbe = probes.find((item) => item.asset.src === asset.src)
            if (loadedProbe?.result.status === 'LOADED') {
              verifiedAssetFingerprints[slot] = loadedProbe.result.contentFingerprint
            }
          }
          verified.verifiedAssetFingerprints = verifiedAssetFingerprints
          return verified
        }
      }
    } catch { /* Declared placeholder fallback is the safe seam. */ }
  }
  return createPlaceholderSemanticCatalog()
}
