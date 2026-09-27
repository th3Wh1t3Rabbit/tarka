import { windowGameBox } from './interactionGeometry'
import type { Hotspot, HotspotId, SceneDefinition, SceneId } from './types'

/** Near edge stays at 365. The far edge is 5px closer than 330. */
export const WALK_Y_MIN = 340
export const WALK_Y_MAX = 365
/** Visible shoes sit above the frame bottom, so a click is aimed 10px lower. */
export const CLICK_Y_OFFSET = 10

export function clickWalkPoint(localX: number, localY: number, width: number, height: number) {
  return { x: (localX / width) * 960, y: (localY / height) * 360 + CLICK_Y_OFFSET }
}

function rect(x: number, y: number, width: number, height: number) {
  const right = x + width
  const bottom = y + height
  return `${x},${y} ${right},${y} ${right},${bottom} ${x},${bottom}`
}

export const recordsOfficeHotspots: Hotspot[] = [
  { id: 'filing-drawers', name: 'filing drawers', polygon: rect(48, 136, 100, 110), walkTo: { x: 170, y: 341 }, tags: ['archive', 'immovable'], visibleFrom: 'START', ariaLabel: 'Filing drawers' },
  { id: 'historical-clock', name: 'historical clock', polygon: rect(280, 50, 62, 76), walkTo: { x: 265, y: WALK_Y_MIN }, tags: ['clock', 'fixed'], visibleFrom: 'START', ariaLabel: 'Historical clock' },
  { id: 'office-globe', name: 'office globe', polygon: rect(390, 30, 44, 60), walkTo: { x: 430, y: WALK_Y_MIN }, tags: ['optional', 'placeholder-only'], visibleFrom: 'START', ariaLabel: 'Office globe, optional placeholder hotspot' },
  { id: 'request-dispenser', name: 'form dispenser', polygon: rect(315, 164, 68, 128), walkTo: { x: 350, y: 355 }, tags: ['paper', 'machine'], visibleFrom: 'START', ariaLabel: 'Authorization form dispenser' },
  { id: 'pen-stand', name: 'historical-looking feather pen', polygon: rect(406, 232, 58, 78), walkTo: { x: 430, y: 362 }, tags: ['stationery'], visibleFrom: 'START', ariaLabel: 'Historical-looking feather pen in the inkwell' },
  { id: 'mr-index', name: 'Mr. Index', polygon: rect(492, 163, 58, 150), walkTo: { x: 416, y: WALK_Y_MAX }, tags: ['person', 'clerk'], visibleFrom: 'START', ariaLabel: 'Arthur behind the counter' },
  { id: 'official-case-file-cabinet', name: 'office cabinet', polygon: rect(639, 169, 64, 117), walkTo: { x: 662, y: WALK_Y_MAX }, tags: ['archive', 'furniture'], visibleFrom: 'START', ariaLabel: 'Office cabinet' },
  { id: 'disorderly-stack-of-confidential-files', name: 'disorderly stack of confidential files', polygon: rect(643, 173, 56, 32), walkTo: { x: 666, y: WALK_Y_MAX }, tags: ['archive', 'contents'], visibleFrom: 'START', ariaLabel: 'Disorderly stack of confidential files' },
  { id: 'miscellaneous-drawer-cabinet', name: 'office cabinet', polygon: rect(758, 175, 62, 114), walkTo: { x: 786, y: WALK_Y_MAX }, tags: ['archive', 'container'], visibleFrom: 'START', ariaLabel: 'Office cabinet' },
  { id: 'miscellaneous-catch-all-contents', name: 'miscellaneous catch-all contents', polygon: rect(764, 179, 50, 30), walkTo: { x: 784, y: WALK_Y_MAX }, tags: ['archive', 'contents'], visibleFrom: 'START', ariaLabel: 'Miscellaneous catch-all contents' },
  { id: 'nansen-terminal', name: 'Nansen™ terminal', polygon: rect(860, 154, 80, 146), walkTo: { x: 870, y: WALK_Y_MAX }, tags: ['terminal', 'record'], visibleFrom: 'START', ariaLabel: 'Nansen™ terminal' },
  { id: 'window', name: 'window', polygon: rect(windowGameBox(2).left, windowGameBox(2).top, windowGameBox(2).width, windowGameBox(2).height), walkTo: { x: windowGameBox(2).left + windowGameBox(2).width / 2, y: WALK_Y_MIN }, tags: ['decor', 'plate'], visibleFrom: 'START', ariaLabel: 'Window' },
]

export const sceneDefinitions: Record<SceneId, SceneDefinition> = {
  'records-office': { id: 'records-office', label: 'Records Office', playable: true, walkRegion: { id: 'records-office-walk-v1', polygon: `28,${WALK_Y_MIN} 930,${WALK_Y_MIN} 930,${WALK_Y_MAX} 28,${WALK_Y_MAX}` }, hotspotGeometryId: 'records-office-hotspots-v1', hotspots: recordsOfficeHotspots, hooks: { onEnter: 'records-office:entered', onExit: 'records-office:exited' } },
  'blank-shell': { id: 'blank-shell', label: 'Blank portability fixture', playable: false, walkRegion: { id: 'blank-shell-walk-v1', polygon: `40,${WALK_Y_MIN} 920,${WALK_Y_MIN} 920,${WALK_Y_MAX} 40,${WALK_Y_MAX}` }, hotspotGeometryId: 'blank-shell-hotspots-v1', hotspots: [], hooks: { onEnter: 'blank-shell:entered', onExit: 'blank-shell:exited' } },
}

function propHotspot(id: HotspotId, name: string, ariaLabel: string): Hotspot {
  return { id, name, polygon: rect(0, 0, 8, 8), walkTo: { x: 480, y: WALK_Y_MIN }, tags: ['layout'], visibleFrom: 'START', ariaLabel }
}

/** Hover targets for placed layout art. The live scene positions these on the pictures. */
export const layoutPropHotspots: Hotspot[] = [
  propHotspot('coffee-mug', 'coffee mug', 'Coffee mug'),
  propHotspot('desk-lamp', 'desk lamp', 'Desk lamp'),
  propHotspot('tall-books', 'tall books', 'Tall books'),
  propHotspot('book-shelf', 'crowded book shelf', 'Crowded book shelf'),
  propHotspot('arthur-stamp', "Arthur's stamp", "Arthur's stamp"),
  propHotspot('blank-authorization-form', 'blank authorization form', 'Blank authorization form'),
  propHotspot('wall-clock', 'historical clock', 'Historical clock'),
  propHotspot('wall-be-the-change', 'office poster', 'Office poster'),
  propHotspot('wall-think-outside', "'motivational' poster", "'Motivational' poster"),
  propHotspot('wall-employee', 'framed workplace acknowledgement', 'Framed workplace acknowledgement'),
  propHotspot('wall-city-bridge', 'scenic painting', 'Scenic painting'),
  propHotspot('wall-building', 'architectural drawing', 'Architectural drawing'),
  propHotspot('wall-preserve', 'oddly mounted frame', 'Oddly mounted frame'),
  propHotspot('wall-records-sign', 'Records Office sign', 'Records Office sign'),
  propHotspot('wall-not-a-number', 'stanchion sign', 'Stanchion sign'),
]

export const hotspots = [...sceneDefinitions['records-office'].hotspots, ...layoutPropHotspots]
export function getSceneDefinition(sceneId: SceneId) { return sceneDefinitions[sceneId] }
export function enterScene(sceneId: SceneId) { return { sceneId, event: sceneDefinitions[sceneId].hooks.onEnter } as const }
export function exitScene(sceneId: SceneId) { return { sceneId, event: sceneDefinitions[sceneId].hooks.onExit } as const }
