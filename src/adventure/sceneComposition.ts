import { targetApproach } from './interactionGeometry'
import { getSceneDefinition, WALK_Y_MAX, WALK_Y_MIN } from './scenes'
import { aspectHeight } from './renderContract'

export const COMPOSITION_SCHEMA = 'trace-escape.scene-composition.v1'
export const ART_PARENT = 'c255ae577851fe34452acf21d674743494a0a067'
export const ART_ARCHIVE_SHA = 'a14a63ca0dac07d8fc1a5daa4f2e551bb231e2313c4f60a53ff95880263b9c55'
export const TOP_MANIFEST_SHA = '1e2a14dca463071e18154e2c0b503c52370e2ef8aedba7d9a99d00f49a8b9b68'

export interface CompositionEntity {
  id: string
  label: string
  runtimeAssetId: string
  src: string
  sourceWidth: number
  sourceHeight: number
  x: number
  y: number
  z: number
  renderWidth: number
  visible: boolean
  mirror: boolean
  mirrorAllowed: boolean
  state: string
  states: Record<string, string>
  hotspotId: string | null
  /** Room-pixel blur for a cropped wall piece. 0 is the sharp crop. */
  blur: number
}

export interface ReadOnlyHotspot {
  id: string
  polygon: string
  walkTo: { x: number; y: number }
  readOnly: true
}

export interface SceneComposition {
  schema: typeof COMPOSITION_SCHEMA
  parentCommit: string
  artArchiveSha256: string
  topManifestSha256: string
  room: { width: 480; height: 180 }
  interfaceBand: { width: 480; height: 90 }
  viewport: { width: 480; height: 270 }
  fitPolicy: 'NEAREST_CONTAIN'
  pixelScaling: 'NEAREST_NEIGHBOR'
  inventoryRenderBox: { width: 24; height: 24 }
  cursor: { width: 13; height: 13; hotspotX: 6; hotspotY: 6 }
  principalDisposition: 'PENDING_PRINCIPAL_PLACEMENT' | 'PRINCIPAL_EXPORTED'
  entities: CompositionEntity[]
  hotspots: ReadOnlyHotspot[]
  contentSha256: string
}

const PACK = '/art-packs/production/files'

export const CROP_BLUR_STEP = 0.05
export const CROP_BLUR_MAX = 0.4
export const LAYOUT_DRAFT_KEY = 'trace-escape.layout-draft.v1'
export const LAYOUT_LIBRARY_KEY = 'trace-escape.layout-library.v1'

export interface LayoutStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SavedLayoutVersion {
  id: string
  name: string
  savedAt: string
  composition: SceneComposition
}

export interface LayoutLibrary {
  versions: SavedLayoutVersion[]
  defaultVersionId: string | null
}

export function snapCropBlur(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  const steps = Math.round(value / CROP_BLUR_STEP)
  const snapped = Math.min(CROP_BLUR_MAX, Math.max(0, steps * CROP_BLUR_STEP))
  return Math.round(snapped * 100) / 100
}

function entity(partial: Omit<CompositionEntity, 'mirror' | 'blur'> & { mirror?: boolean; blur?: number }): CompositionEntity {
  return { ...partial, mirror: partial.mirror ?? false, blur: partial.id.startsWith('bg-') ? snapCropBlur(partial.blur ?? 0) : 0 }
}

export function layoutGameBox(item: CompositionEntity) {
  return { x: item.x * 2, y: item.y * 2, width: item.renderWidth * 2, height: renderHeight(item) * 2 }
}

/** Same pixels the art layout uses: room coordinate times the integer scene scale. */
export function layoutPixelBox(item: CompositionEntity, scale: number) {
  const height = renderHeight(item)
  return { left: Math.round(item.x * scale), top: Math.round(item.y * scale), width: Math.round(item.renderWidth * scale), height: Math.round(height * scale) }
}

const HOTSPOT_ENTITY: Record<string, string> = {
  'office-globe': 'globe',
  'request-dispenser': 'dispenser',
  'pen-stand': 'penstand',
  'mr-index': 'arthur',
  'official-case-file-cabinet': 'official-cabinet',
  'miscellaneous-drawer-cabinet': 'misc-cabinet',
  'nansen-terminal': 'terminal',
  'coffee-mug': 'mug',
  'desk-lamp': 'lamp',
  'tall-books': 'books-tall',
  'book-shelf': 'shelf',
  'arthur-stamp': 'arthur-stamp',
  'blank-authorization-form': 'blank-form',
  'wall-clock': 'bg-wall-clock',
  'wall-be-the-change': 'bg-poster-be-the-change',
  'wall-think-outside': 'bg-poster-think-outside-the-box',
  'wall-employee': 'bg-plaque-employee-of-the-month',
  'wall-city-bridge': 'bg-painting-city-bridge',
  'wall-building': 'bg-print-building',
  'wall-preserve': 'bg-plaque-preserve-serve-remember',
  'wall-records-sign': 'bg-sign-records-office',
  'wall-not-a-number': 'bg-sign-you-are-not-a-number',
}

/** Hotspot rectangle in scene pixels, following the placed picture instead of the old wall polygon. */
export function layoutHotspotPixels(layout: SceneComposition, hotspotId: string, scale: number) {
  const directId = HOTSPOT_ENTITY[hotspotId]
  const direct = directId ? layout.entities.find((item) => item.visible && item.id === directId) : layout.entities.find((item) => item.visible && item.hotspotId === hotspotId)
  if (direct) return layoutPixelBox(direct, scale)
  const parentId = hotspotId === 'disorderly-stack-of-confidential-files' ? 'official-cabinet' : hotspotId === 'miscellaneous-catch-all-contents' ? 'misc-cabinet' : null
  const parent = parentId ? layout.entities.find((item) => item.visible && item.id === parentId) : null
  if (!parent) return null
  const box = layoutPixelBox(parent, scale)
  // The two open fronts occupy different source-image bands. Keep the
  // selectable contents surface on the pixels of the protruding drawer rather
  // than inheriting one generic top-of-cabinet rectangle.
  const region = hotspotId === 'disorderly-stack-of-confidential-files'
    ? { x: 0, y: 0.25, width: 0.72, height: 0.32 }
    : { x: 0, y: 0.63, width: 0.76, height: 0.37 }
  return {
    left: Math.round(box.left + box.width * region.x),
    top: Math.round(box.top + box.height * region.y),
    width: Math.round(box.width * region.width),
    height: Math.round(box.height * region.height),
  }
}

/** Game pixels outside the picture, on the side Rook approached from. */
export const APPROACH_GAP = 14

/** Stand beside the picture, on the side he is already on. Never send him back past it. */
export function layoutHotspotWalkTo(layout: SceneComposition, hotspotId: string, fromX?: number) {
  const pixels = layoutHotspotPixels(layout, hotspotId, 2)
  if (!pixels) return null
  const foot = pixels.top + pixels.height
  const center = pixels.left + pixels.width / 2
  let x = center
  const approach = targetApproach(hotspotId)
  if (fromX != null && fromX <= center) {
    const stand = pixels.left - approach.left
    x = fromX < stand ? stand : fromX
  } else if (fromX != null) {
    const stand = pixels.left + pixels.width + approach.right
    x = fromX > stand ? stand : fromX
  }
  return { x: Math.min(920, Math.max(40, x)), y: Math.min(WALK_Y_MAX, Math.max(WALK_Y_MIN, foot)) }
}

export function layoutStackZ(ordered: readonly { id: string }[], id: string) {
  const index = ordered.findIndex((item) => item.id === id)
  return index < 0 ? 1 : index + 1
}

/** Desk paints over Arthur. Anything already in front of Arthur stays in front of the desk. */
export function layoutPaintZ(ordered: readonly { id: string }[], id: string) {
  const arthur = ordered.findIndex((item) => item.id === 'arthur')
  const index = ordered.findIndex((item) => item.id === id)
  if (index < 0) return 1
  if (id === 'desk' && arthur >= 0) return Math.max(index, arthur) + 2
  if (arthur >= 0 && index > arthur) return index + 2
  return index + 1
}

export function layoutAnchorPosition(item: CompositionEntity, anchor: { x: number; y: number }, artScale: number) {
  return { x: item.x * 2 + anchor.x * artScale, y: item.y * 2 + anchor.y * artScale }
}

export function layoutEntitySrc(item: CompositionEntity, flags: { caseOpen: boolean; caseUnsearched: boolean; miscOpen: boolean; miscUncollected?: boolean; terminalOn: boolean; globeSrc?: string; penTaken?: boolean; steamSrc?: string | null; lampPower?: 'ON' | 'OFF' }) {
  if (item.id === 'official-cabinet') {
    if (!flags.caseOpen) return item.states.closed ?? item.src
    // Taking Euler removes one file, not the rest of the drawer. Keep the
    // filed drawer-02 visual before and after the one-time acquisition.
    return item.states.filed ?? item.states.open ?? item.src
  }
  if (item.id === 'misc-cabinet') {
    if (!flags.miscOpen) return item.states.closed ?? item.src
    // Rook removes five useful objects, not every scrap in the catch-all.
    // The open drawer must therefore keep its junk-filled art and selectable
    // surface after collection, just as the official drawer keeps its files.
    return item.states.open ?? item.src
  }
  if (item.id === 'terminal') return flags.terminalOn ? item.states.on ?? `${PACK}/included/core-v2.1/terminal/kiosk_on.png` : `${PACK}/included/core-v2.1/terminal/kiosk_off.png`
  if (item.id === 'globe' && flags.globeSrc) return flags.globeSrc
  if (item.id === 'penstand' && flags.penTaken) return `${PACK}/included/core-v2.1/forms/inkstand.png`
  if (item.id === 'mug' && flags.steamSrc) return flags.steamSrc
  if (item.id === 'lamp' && flags.lampPower) return item.states[flags.lampPower === 'ON' ? 'on' : 'off'] ?? item.src
  return item.states[item.state] ?? item.src
}

/**
 * Existing approved junk pixels, re-used over the production drawer-04 art.
 * The donor sheet stores the junk at y=53..57; shifting the clipped pixels by
 * 18 source pixels places them in the open bottom-drawer tray at y=71..75.
 * No collected-state flag participates: the residual junk remains forever.
 */
export const PERSISTENT_MISC_JUNK_OVERLAY = {
  src: `${PACK}/included/core-v2.1/drawers/misc_open_junk.png`,
  sourceWidth: 80,
  sourceHeight: 96,
  crop: { left: 22, top: 53, width: 22, height: 5 },
  pixelRuns: [
    { x: 26, y: 53, width: 1, color: '#9e9071' }, { x: 40, y: 53, width: 1, color: '#9e9071' },
    { x: 23, y: 54, width: 3, color: '#c1b496' }, { x: 26, y: 54, width: 3, color: '#9e9071' },
    { x: 30, y: 54, width: 1, color: '#302b26' }, { x: 31, y: 54, width: 2, color: '#79a39d' },
    { x: 33, y: 54, width: 1, color: '#f7da8b' }, { x: 34, y: 54, width: 1, color: '#79a39d' },
    { x: 35, y: 54, width: 1, color: '#302b26' }, { x: 37, y: 54, width: 2, color: '#9e9071' },
    { x: 39, y: 54, width: 2, color: '#c1b496' }, { x: 41, y: 54, width: 2, color: '#9e9071' },
    { x: 23, y: 55, width: 1, color: '#c1b496' }, { x: 24, y: 55, width: 2, color: '#a99c80' },
    { x: 26, y: 55, width: 3, color: '#9e9071' }, { x: 30, y: 55, width: 2, color: '#302b26' },
    { x: 32, y: 55, width: 2, color: '#a99c80' }, { x: 34, y: 55, width: 1, color: '#2f5155' },
    { x: 35, y: 55, width: 1, color: '#302b26' }, { x: 37, y: 55, width: 4, color: '#9e9071' },
    { x: 41, y: 55, width: 1, color: '#302b26' }, { x: 42, y: 55, width: 1, color: '#9e9071' },
    { x: 22, y: 56, width: 1, color: '#f3e7c8' }, { x: 23, y: 56, width: 4, color: '#c1b496' },
    { x: 27, y: 56, width: 2, color: '#9e9071' }, { x: 29, y: 56, width: 1, color: '#f3e7c8' },
    { x: 30, y: 56, width: 2, color: '#302b26' }, { x: 32, y: 56, width: 2, color: '#a99c80' },
    { x: 34, y: 56, width: 1, color: '#2f5155' }, { x: 35, y: 56, width: 1, color: '#302b26' },
    { x: 36, y: 56, width: 1, color: '#a7b5a0' }, { x: 37, y: 56, width: 2, color: '#9e9071' },
    { x: 39, y: 56, width: 1, color: '#302b26' }, { x: 40, y: 56, width: 3, color: '#9e9071' },
    { x: 43, y: 56, width: 1, color: '#a7b5a0' }, { x: 22, y: 57, width: 3, color: '#d5ad50' },
    { x: 25, y: 57, width: 3, color: '#a99c80' }, { x: 28, y: 57, width: 1, color: '#9e9071' },
    { x: 29, y: 57, width: 1, color: '#f3e7c8' }, { x: 30, y: 57, width: 2, color: '#302b26' },
    { x: 32, y: 57, width: 2, color: '#a99c80' }, { x: 34, y: 57, width: 1, color: '#2f5155' },
    { x: 35, y: 57, width: 1, color: '#302b26' }, { x: 36, y: 57, width: 1, color: '#a7b5a0' },
    { x: 37, y: 57, width: 2, color: '#9e9071' }, { x: 39, y: 57, width: 5, color: '#a7b5a0' },
  ],
  offsetY: 18,
} as const

/** Front-to-back drag list becomes back-to-front z order. Rook stays the front layer. */
export function paintOrderFromFront(frontToBack: readonly string[]): string[] {
  const backToFront = [...frontToBack].reverse().filter((id, index, all) => all.indexOf(id) === index)
  const body = backToFront.filter((id) => id !== 'rook')
  return [...body, ...backToFront.filter((id) => id === 'rook')]
}

/** Rook is the front art layer. The desk paints in front of Arthur. Other art keeps its z. */
export function artStackOrder<T extends { id: string; z: number }>(items: readonly T[]): T[] {
  const rest = items.filter((item) => item.id !== 'rook').slice().sort((left, right) => left.z - right.z || left.id.localeCompare(right.id))
  const deskAt = rest.findIndex((item) => item.id === 'desk')
  const arthurAt = rest.findIndex((item) => item.id === 'arthur')
  if (deskAt >= 0 && arthurAt >= 0 && deskAt < arthurAt) {
    const [desk] = rest.splice(deskAt, 1)
    rest.splice(rest.findIndex((item) => item.id === 'arthur') + 1, 0, desk!)
  }
  return [...rest, ...items.filter((item) => item.id === 'rook')]
}

/** Adds catalog pieces that a saved layout does not have yet, switched off so existing coordinates stay put. */
export function withCatalogEntities(composition: SceneComposition): SceneComposition {
  const known = new Set(composition.entities.map((item) => item.id))
  const extras = referenceEntities().filter((item) => !known.has(item.id)).map((item) => ({ ...item, visible: false }))
  return extras.length === 0 ? composition : { ...composition, entities: [...composition.entities, ...extras] }
}

export function referenceEntities(): CompositionEntity[] {
  return [
    entity({ id: 'rook', label: 'Rook', runtimeAssetId: 'rook.idle', src: `${PACK}/production/characters/rook/latest-clean-v0.1.14/frames/rook_idle_neutral_a.png`, sourceWidth: 48, sourceHeight: 88, x: 80, y: 82, z: 6, renderWidth: 48, visible: true, mirrorAllowed: true, state: 'idle', states: { idle: `${PACK}/production/characters/rook/latest-clean-v0.1.14/frames/rook_idle_neutral_a.png`, walk: `${PACK}/production/characters/rook/latest-clean-v0.1.14/frames/rook_walk_1_contact_a.png`, talk: `${PACK}/production/characters/rook/latest-clean-v0.1.14/frames/rook_talk_neutral_open.png`, inspect: `${PACK}/production/characters/rook/latest-clean-v0.1.14/frames/rook_inspect_lean.png`, give: `${PACK}/production/characters/rook/latest-clean-v0.1.14/frames/rook_give_offer.png` }, hotspotId: null }),
    entity({ id: 'arthur', label: 'Arthur', runtimeAssetId: 'arthur.idle', src: `${PACK}/production/characters/arthur/coherent-core-v1.0.0/frames/archivist_idle_a.png`, sourceWidth: 48, sourceHeight: 88, x: 204, y: 74, z: 5, renderWidth: 48, visible: true, mirrorAllowed: true, state: 'idle', states: { idle: `${PACK}/production/characters/arthur/coherent-core-v1.0.0/frames/archivist_idle_a.png`, talk: `${PACK}/production/characters/arthur/coherent-core-v1.0.0/frames/archivist_talk_open.png`, listen: `${PACK}/production/characters/arthur/coherent-core-v1.0.0/frames/archivist_listening.png`, stamp: `${PACK}/production/characters/arthur/stamp-v0.1.1/frames/archivist_stamp_down.png`, paperwork: `${PACK}/production/characters/arthur/paperwork-coherent-v0.1.2/frames/archivist_document_hold.png` }, hotspotId: 'mr-index' }),
    entity({ id: 'terminal', label: 'Terminal kiosk', runtimeAssetId: 'terminal.kiosk', src: `${PACK}/included/core-v2.1/terminal/kiosk_off.png`, sourceWidth: 48, sourceHeight: 75, x: 120, y: 105, z: 4, renderWidth: 36, visible: true, mirrorAllowed: false, state: 'off', states: { off: `${PACK}/included/core-v2.1/terminal/kiosk_off.png`, on: `${PACK}/included/core-v2.1/terminal/kiosk_on.png`, chrome: `${PACK}/included/core-v2.1/terminal/frame_on_480x270.png` }, hotspotId: 'nansen-terminal' }),
    entity({ id: 'desk', label: 'Desk', runtimeAssetId: 'desk', src: `${PACK}/included/core-v2.1/room/desk.png`, sourceWidth: 96, sourceHeight: 36, x: 180, y: 129, z: 3, renderWidth: 88, visible: true, mirrorAllowed: false, state: 'default', states: { default: `${PACK}/included/core-v2.1/room/desk.png` }, hotspotId: null }),
    entity({ id: 'official-cabinet', label: 'Official cabinet', runtimeAssetId: 'cabinet.official.drawer-02-filed', src: `${PACK}/production/furniture/cabinet-contents/frames/cabinet_closed.png`, sourceWidth: 80, sourceHeight: 96, x: 310, y: 112, z: 4, renderWidth: 29, visible: true, mirrorAllowed: false, state: 'closed', states: { closed: `${PACK}/production/furniture/cabinet-contents/frames/cabinet_closed.png`, open: `${PACK}/production/furniture/cabinet-contents/frames/cabinet_open__drawer_02_filed_open.png`, filed: `${PACK}/production/furniture/cabinet-contents/frames/cabinet_open__drawer_02_filed_open.png`, empty: `${PACK}/production/furniture/cabinet-contents/frames/cabinet_open__drawer_02_filed_open.png` }, hotspotId: 'official-case-file-cabinet' }),
    entity({ id: 'misc-cabinet', label: 'Miscellaneous cabinet', runtimeAssetId: 'cabinet.misc.drawer-04', src: `${PACK}/production/furniture/lower-drawers/drawer-04/frames/cabinet_closed.png`, sourceWidth: 80, sourceHeight: 96, x: 339, y: 112, z: 4, renderWidth: 29, visible: true, mirrorAllowed: false, state: 'closed', states: { closed: `${PACK}/production/furniture/lower-drawers/drawer-04/frames/cabinet_closed.png`, open: `${PACK}/production/furniture/lower-drawers/drawer-04/frames/cabinet_open__drawer_04_open.png`, empty: `${PACK}/production/furniture/lower-drawers/drawer-04/frames/cabinet_open__drawer_04_open.png` }, hotspotId: 'miscellaneous-drawer-cabinet' }),
    entity({ id: 'dispenser', label: 'Form dispenser', runtimeAssetId: 'dispenser', src: `${PACK}/production/props/required-v1.0.1/frames/dispenser_idle_with_ticket.png`, sourceWidth: 47, sourceHeight: 70, x: 382, y: 112, z: 4, renderWidth: 31, visible: true, mirrorAllowed: false, state: 'idle', states: { idle: `${PACK}/production/props/required-v1.0.1/frames/dispenser_idle_with_ticket.png`, empty: `${PACK}/production/props/required-v1.0.1/frames/dispenser_empty.png` }, hotspotId: 'request-dispenser' }),
    entity({ id: 'blank-form', label: 'Blank authorization form', runtimeAssetId: 'form.blank', src: `${PACK}/included/core-v2.1/forms/ticket_blank.png`, sourceWidth: 20, sourceHeight: 26, x: 400, y: 120, z: 7, renderWidth: 16, visible: false, mirrorAllowed: false, state: 'blank', states: { blank: `${PACK}/included/core-v2.1/forms/ticket_blank.png` }, hotspotId: 'blank-authorization-form' }),
    entity({ id: 'penstand', label: 'Pen stand', runtimeAssetId: 'penstand', src: `${PACK}/production/props/required-v1.0.1/frames/penstand_idle.png`, sourceWidth: 24, sourceHeight: 32, x: 250, y: 128, z: 5, renderWidth: 12, visible: true, mirrorAllowed: false, state: 'idle', states: { idle: `${PACK}/production/props/required-v1.0.1/frames/penstand_idle.png` }, hotspotId: 'pen-stand' }),
    entity({ id: 'arthur-stamp', label: "Arthur's stamp", runtimeAssetId: 'stamp.world', src: `${PACK}/production/props/stamp/frames/stamp_world.png`, sourceWidth: 16, sourceHeight: 20, x: 230, y: 124, z: 6, renderWidth: 10, visible: false, mirrorAllowed: false, state: 'world', states: { world: `${PACK}/production/props/stamp/frames/stamp_world.png` }, hotspotId: null }),
    entity({ id: 'globe', label: 'Globe', runtimeAssetId: 'globe', src: `${PACK}/production/ambience/globe-life/frames/globe_idle.png`, sourceWidth: 32, sourceHeight: 48, x: 198, y: 18, z: 3, renderWidth: 16, visible: true, mirrorAllowed: false, state: 'idle', states: { idle: `${PACK}/production/ambience/globe-life/frames/globe_idle.png`, push: `${PACK}/production/ambience/globe-life/frames/globe_spin_right.png`, pull: `${PACK}/production/ambience/globe-life/frames/globe_spin_left.png`, settle: `${PACK}/production/ambience/globe-life/frames/globe_settle.png` }, hotspotId: 'office-globe' }),
    entity({ id: 'mug', label: 'Mug', runtimeAssetId: 'mug', src: `${PACK}/production/ambience/mug/frames/mug_idle.png`, sourceWidth: 24, sourceHeight: 32, x: 228, y: 132, z: 5, renderWidth: 14, visible: true, mirrorAllowed: false, state: 'idle', states: { idle: `${PACK}/production/ambience/mug/frames/mug_idle.png`, steam: `${PACK}/production/ambience/mug-steam/frames/mug_steam_a.png` }, hotspotId: null }),
    entity({ id: 'lamp', label: 'Lamp', runtimeAssetId: 'lamp', src: `${PACK}/production/ambience/lamp-switch/frames/lamp_off.png`, sourceWidth: 24, sourceHeight: 40, x: 168, y: 36, z: 2, renderWidth: 12, visible: false, mirrorAllowed: false, state: 'off', states: { off: `${PACK}/production/ambience/lamp-switch/frames/lamp_off.png`, on: `${PACK}/production/ambience/lamp-switch/frames/lamp_on.png` }, hotspotId: null }),
    entity({ id: 'shelf', label: 'Shelf', runtimeAssetId: 'shelf', src: `${PACK}/production/furniture/shelf-full/frames/shelf_full.png`, sourceWidth: 96, sourceHeight: 112, x: 16, y: 48, z: 2, renderWidth: 48, visible: false, mirrorAllowed: false, state: 'full', states: { full: `${PACK}/production/furniture/shelf-full/frames/shelf_full.png` }, hotspotId: null }),
    entity({ id: 'books-tall', label: 'Tall books', runtimeAssetId: 'books.tall', src: `${PACK}/production/furniture/bookstack-tall/frames/bookstack_tall.png`, sourceWidth: 32, sourceHeight: 40, x: 24, y: 70, z: 3, renderWidth: 16, visible: false, mirrorAllowed: false, state: 'tall', states: { tall: `${PACK}/production/furniture/bookstack-tall/frames/bookstack_tall.png`, short: `${PACK}/production/furniture/bookstack-short/frames/bookstack_short.png` }, hotspotId: null }),
    ...backgroundDetailEntities(),
  ]
}

function detail(id: string, label: string, file: string, sourceWidth: number, sourceHeight: number, x: number, y: number, renderWidth: number): CompositionEntity {
  const src = `/art-review/background-detail/${file}`
  return entity({ id, label, runtimeAssetId: id, src, sourceWidth, sourceHeight, x, y, z: 2, renderWidth, visible: true, mirrorAllowed: false, state: 'detail', states: { detail: src }, hotspotId: null })
}

function backgroundDetailEntities(): CompositionEntity[] {
  return [
    detail('bg-poster-be-the-change', 'Be the Change', 'bg-poster-be-the-change.png', 202, 158, 8, 14, 54),
    detail('bg-poster-think-outside-the-box', 'Think Outside the Box', 'bg-poster-think-outside-the-box.png', 142, 155, 66, 12, 40),
    detail('bg-wall-clock', 'Wall clock', 'bg-wall-clock.png', 134, 173, 140, 16, 36),
    detail('bg-plaque-employee-of-the-month', 'Employee of the Month', 'bg-plaque-employee-of-the-month.png', 111, 144, 142, 68, 30),
    detail('bg-painting-city-bridge', 'City bridge painting', 'bg-painting-city-bridge.png', 274, 251, 176, 36, 78),
    detail('bg-print-building', 'Building print', 'bg-print-building.png', 92, 134, 256, 34, 22),
    detail('bg-plaque-preserve-serve-remember', 'Preserve Serve Remember', 'bg-plaque-preserve-serve-remember.png', 100, 137, 256, 76, 22),
    detail('bg-sign-records-office', 'Records Office sign', 'bg-sign-records-office.png', 254, 218, 292, 38, 70),
    detail('bg-sign-you-are-not-a-number', 'You Are Not a Number', 'bg-sign-you-are-not-a-number.png', 111, 87, 432, 104, 32),
  ]
}

export function readOnlyHotspots(): ReadOnlyHotspot[] {
  return getSceneDefinition('records-office').hotspots.map((hotspot) => ({ id: hotspot.id, polygon: hotspot.polygon, walkTo: { ...hotspot.walkTo }, readOnly: true as const }))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sortValue(record[key])]))
  }
  return value
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(sortValue(value))
}

function integerBox(entity: CompositionEntity): string | null {
  if (!Number.isInteger(entity.x) || !Number.isInteger(entity.y) || !Number.isInteger(entity.z) || !Number.isInteger(entity.renderWidth)) return `${entity.id} coordinates must be integers`
  if (entity.renderWidth < 1) return `${entity.id} render width must be positive`
  if (entity.mirror && !entity.mirrorAllowed) return `${entity.id} cannot be mirrored`
  if (!entity.states[entity.state]) return `${entity.id} state is not declared`
  if (aspectHeight(entity.renderWidth, { width: entity.sourceWidth, height: entity.sourceHeight }) === null) return `${entity.id} aspect is invalid`
  return null
}

export function normalizeComposition(input: SceneComposition): { composition: SceneComposition; error: string | null } {
  const entities = [...input.entities].sort((left, right) => left.id.localeCompare(right.id)).map((item) => {
    const src = item.states[item.state] ?? item.src
    const blur = item.id.startsWith('bg-') ? snapCropBlur(Number(item.blur ?? 0)) : 0
    return { ...item, src, blur, renderWidth: item.renderWidth, y: item.y, x: item.x, z: item.z, mirror: item.mirrorAllowed ? item.mirror : false }
  })
  for (const item of entities) {
    const problem = integerBox(item)
    if (problem) return { composition: input, error: problem }
    if (aspectHeight(item.renderWidth, { width: item.sourceWidth, height: item.sourceHeight }) === null) return { composition: input, error: `${item.id} render height is not an integer` }
  }
  const hotspots = readOnlyHotspots()
  const composition: SceneComposition = {
    ...input,
    schema: COMPOSITION_SCHEMA,
    room: { width: 480, height: 180 },
    interfaceBand: { width: 480, height: 90 },
    viewport: { width: 480, height: 270 },
    fitPolicy: 'NEAREST_CONTAIN',
    pixelScaling: 'NEAREST_NEIGHBOR',
    inventoryRenderBox: { width: 24, height: 24 },
    cursor: { width: 13, height: 13, hotspotX: 6, hotspotY: 6 },
    entities,
    hotspots,
    contentSha256: '',
  }
  return { composition, error: null }
}

export function compositionBody(composition: SceneComposition) {
  const { contentSha256, ...body } = composition
  void contentSha256
  return canonicalJson(body)
}

export async function sealComposition(input: SceneComposition, sha256: (bytes: Uint8Array) => Promise<string>): Promise<{ composition: SceneComposition; error: string | null }> {
  const normalized = normalizeComposition(input)
  if (normalized.error) return normalized
  const contentSha256 = await sha256(new TextEncoder().encode(compositionBody(normalized.composition)))
  return { composition: { ...normalized.composition, contentSha256 }, error: null }
}

export function referenceComposition(): SceneComposition {
  return {
    schema: COMPOSITION_SCHEMA,
    parentCommit: ART_PARENT,
    artArchiveSha256: ART_ARCHIVE_SHA,
    topManifestSha256: TOP_MANIFEST_SHA,
    room: { width: 480, height: 180 },
    interfaceBand: { width: 480, height: 90 },
    viewport: { width: 480, height: 270 },
    fitPolicy: 'NEAREST_CONTAIN',
    pixelScaling: 'NEAREST_NEIGHBOR',
    inventoryRenderBox: { width: 24, height: 24 },
    cursor: { width: 13, height: 13, hotspotX: 6, hotspotY: 6 },
    principalDisposition: 'PENDING_PRINCIPAL_PLACEMENT',
    entities: referenceEntities(),
    hotspots: readOnlyHotspots(),
    contentSha256: '',
  }
}

export const LEGACY_LAYOUT6_MIGRATION = {
  id: 'S12-P2-R2-ROTUNDA-TO-WINDOW',
  librarySha256: '15892c771a479941923c6b3f7fd800cf81345d756c46d9946600093b7e67ed5c',
  versionId: 'layout-1790118912943-nbarbu',
  savedAt: '2026-09-22T23:15:12.943Z',
  beforeHotspotSha256: 'ef5c0da1aec1236ab0dad7ea145f7645e7065bb2b0bd0df7075d61a8763de41a',
} as const

const LEGACY_LAYOUT6_HOTSPOT_CANON = '[{"id":"filing-drawers","polygon":"48,136 148,136 148,246 48,246","x":170,"y":341},{"id":"historical-clock","polygon":"280,50 342,50 342,126 280,126","x":265,"y":335},{"id":"office-globe","polygon":"390,30 434,30 434,90 390,90","x":430,"y":335},{"id":"request-dispenser","polygon":"315,164 383,164 383,292 315,292","x":350,"y":355},{"id":"pen-stand","polygon":"406,232 464,232 464,310 406,310","x":430,"y":362},{"id":"mr-index","polygon":"492,163 550,163 550,313 492,313","x":416,"y":365},{"id":"official-case-file-cabinet","polygon":"639,169 703,169 703,286 639,286","x":662,"y":365},{"id":"disorderly-stack-of-confidential-files","polygon":"643,173 699,173 699,205 643,205","x":666,"y":365},{"id":"miscellaneous-drawer-cabinet","polygon":"758,175 820,175 820,289 758,289","x":786,"y":365},{"id":"miscellaneous-catch-all-contents","polygon":"764,179 814,179 814,209 764,209","x":784,"y":365},{"id":"nansen-terminal","polygon":"860,154 940,154 940,300 860,300","x":870,"y":365},{"id":"rotunda-exit","polygon":"895,214 953,214 953,299 895,299","x":78,"y":335}]'

function hotspotCanon(list: readonly { id: string; polygon: string; walkTo: { x: number; y: number } }[]) {
  return JSON.stringify(list.map((hotspot) => ({ id: hotspot.id, polygon: hotspot.polygon, x: hotspot.walkTo.x, y: hotspot.walkTo.y })))
}

export function importComposition(value: unknown, migration: { versionId: string; savedAt: string } | null = null): { composition: SceneComposition | null; error: string | null } {
  if (!value || typeof value !== 'object') return { composition: null, error: 'Composition is not an object' }
  const record = value as SceneComposition
  if (record.schema !== COMPOSITION_SCHEMA) return { composition: null, error: 'Schema is not the scene composition contract' }
  if (record.parentCommit !== ART_PARENT) return { composition: null, error: 'Parent commit does not match the accepted art child' }
  const live = readOnlyHotspots()
  const imported = record.hotspots ?? []
  const current = hotspotCanon(imported) === hotspotCanon(live)
  const legacy = migration?.versionId === LEGACY_LAYOUT6_MIGRATION.versionId && migration.savedAt === LEGACY_LAYOUT6_MIGRATION.savedAt && hotspotCanon(imported) === LEGACY_LAYOUT6_HOTSPOT_CANON
  if (!current && !legacy) return { composition: null, error: 'Hotspot geometry is read-only and does not match the controller' }
  const normalized = normalizeComposition({ ...record, hotspots: live })
  return normalized.error ? { composition: null, error: normalized.error } : { composition: normalized.composition, error: null }
}

export function renderHeight(item: CompositionEntity) {
  return aspectHeight(item.renderWidth, { width: item.sourceWidth, height: item.sourceHeight }) ?? item.sourceHeight
}

function browserStore(): LayoutStore | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

function emptyLibrary(): LayoutLibrary {
  return { versions: [], defaultVersionId: null }
}

export function readLayoutLibrary(storage: LayoutStore | null = browserStore()): LayoutLibrary {
  if (!storage) return emptyLibrary()
  try {
    const raw = storage.getItem(LAYOUT_LIBRARY_KEY)
    if (!raw) return emptyLibrary()
    const parsed = JSON.parse(raw) as LayoutLibrary
    const versions = Array.isArray(parsed.versions) ? parsed.versions.flatMap((version) => {
      const migration = version.id === LEGACY_LAYOUT6_MIGRATION.versionId && version.savedAt === LEGACY_LAYOUT6_MIGRATION.savedAt ? { versionId: version.id, savedAt: version.savedAt } : null
      const imported = importComposition(version.composition, migration)
      if (!imported.composition || !version.id || !version.name) return []
      return [{ id: version.id, name: version.name, savedAt: version.savedAt || '', composition: imported.composition }]
    }) : []
    const defaultVersionId = versions.some((version) => version.id === parsed.defaultVersionId) ? parsed.defaultVersionId : null
    return { versions, defaultVersionId }
  } catch { return emptyLibrary() }
}

function writeLayoutLibrary(storage: LayoutStore, library: LayoutLibrary) {
  storage.setItem(LAYOUT_LIBRARY_KEY, JSON.stringify(library))
}

export function readLayoutDraft(storage: LayoutStore | null = browserStore()): SceneComposition | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LAYOUT_DRAFT_KEY)
    if (!raw) return null
    return importComposition(JSON.parse(raw)).composition
  } catch { return null }
}

export function writeLayoutDraft(storage: LayoutStore | null, composition: SceneComposition) {
  if (!storage) return
  try { storage.setItem(LAYOUT_DRAFT_KEY, JSON.stringify(composition)) } catch { /* The draft is a convenience copy. */ }
}

export function saveLayoutVersion(storage: LayoutStore, name: string, composition: SceneComposition, makeDefault: boolean): { library: LayoutLibrary; error: string | null } {
  const normalized = normalizeComposition({ ...composition, hotspots: readOnlyHotspots(), principalDisposition: 'PENDING_PRINCIPAL_PLACEMENT' })
  const library = readLayoutLibrary(storage)
  if (normalized.error) return { library, error: normalized.error }
  const version: SavedLayoutVersion = {
    id: `layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `Version ${library.versions.length + 1}`,
    savedAt: new Date().toISOString(),
    composition: normalized.composition,
  }
  const next: LayoutLibrary = {
    versions: [...library.versions, version],
    defaultVersionId: makeDefault ? version.id : library.defaultVersionId,
  }
  writeLayoutLibrary(storage, next)
  return { library: next, error: null }
}

export function setDefaultLayoutVersion(storage: LayoutStore, versionId: string | null): LayoutLibrary {
  const library = readLayoutLibrary(storage)
  const defaultVersionId = versionId && library.versions.some((version) => version.id === versionId) ? versionId : null
  const next = { ...library, defaultVersionId }
  writeLayoutLibrary(storage, next)
  return next
}

export function removeLayoutVersion(storage: LayoutStore, versionId: string): LayoutLibrary {
  const library = readLayoutLibrary(storage)
  const next: LayoutLibrary = {
    versions: library.versions.filter((version) => version.id !== versionId),
    defaultVersionId: library.defaultVersionId === versionId ? null : library.defaultVersionId,
  }
  writeLayoutLibrary(storage, next)
  return next
}

export function readDefaultLayout(storage: LayoutStore | null = browserStore()): SceneComposition | null {
  const library = readLayoutLibrary(storage)
  return library.versions.find((version) => version.id === library.defaultVersionId)?.composition ?? null
}

export function arthurPlacementFromLayout(layout: SceneComposition, anchor: { x: number; y: number }, artScale: number) {
  const arthur = layout.entities.find((item) => item.id === 'arthur' && item.visible)
  if (!arthur) return null
  const ordered = artStackOrder(layout.entities.filter((item) => item.visible))
  return { position: layoutAnchorPosition(arthur, anchor, artScale), zIndex: layoutPaintZ(ordered, 'arthur'), room: { x: arthur.x, y: arthur.y, width: arthur.renderWidth, height: renderHeight(arthur) } }
}

export function defaultArthurPlacement(anchor: { x: number; y: number }, artScale: number, storage: LayoutStore | null = browserStore()) {
  const layout = readDefaultLayout(storage)
  if (!layout) return null
  return arthurPlacementFromLayout(layout, anchor, artScale)
}
