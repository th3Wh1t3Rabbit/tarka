import { PRODUCTION_WINDOW_LAYOUT } from './productionWindowLayout'

/** Per-target stand offsets. 14 remains the default, not a universal distance. */
export const DEFAULT_APPROACH_GAP = 14
export const DEFAULT_LOOK_RANGE = 150

const WINDOW_TOP = 14
const CABINET_GAP = 3
const VIEWPORT_RIGHT_MARGIN = 7

/** Derive the window from the sealed production furniture and stanchion art. */
export function deriveWindowRoom() {
  const { cabinets, stanchion, roomWidth } = PRODUCTION_WINDOW_LAYOUT
  const left = Math.max(...cabinets.map(entity => entity.x + entity.renderWidth)) + CABINET_GAP
  const right = roomWidth - VIEWPORT_RIGHT_MARGIN
  const stanchionVisualMidpoint = Math.round(stanchion.y + (stanchion.renderWidth * stanchion.sourceHeight / stanchion.sourceWidth) / 2)
  return { x: left, y: WINDOW_TOP, width: right - left, height: stanchionVisualMidpoint - WINDOW_TOP }
}

/** One derived room-plate owner for W20. Render, walk, and look geometry consume it. */
export const WINDOW_TARGET = {
  id: 'window' as const,
  room: deriveWindowRoom(),
  approachLeft: 16,
  approachRight: 16,
  lookRange: 160,
}

export function windowGameBox(scale: number) {
  const room = WINDOW_TARGET.room
  return { left: room.x * scale, top: room.y * scale, width: room.width * scale, height: room.height * scale }
}

const OVERRIDES: Record<string, { left: number; right: number; look: number }> = {
  'mr-index': { left: 22, right: 22, look: 120 },
  // The terminal is an operated surface, not a wall observation. Rook's foot
  // marker belongs directly beside the kiosk before the entry reach begins.
  'nansen-terminal': { left: 8, right: 8, look: 140 },
  // Drawer inspection and pickup share a close, hand-reach approach. This
  // avoids the old observation-only gap that left Rook visibly too far away.
  'official-case-file-cabinet': { left: 8, right: 8, look: 150 },
  'disorderly-stack-of-confidential-files': { left: 8, right: 8, look: 150 },
  'miscellaneous-drawer-cabinet': { left: 8, right: 8, look: 150 },
  'miscellaneous-catch-all-contents': { left: 8, right: 8, look: 150 },
  'request-dispenser': { left: 10, right: 10, look: 120 },
  'blank-authorization-form': { left: 12, right: 12, look: 100 },
  'pen-stand': { left: 12, right: 12, look: 100 },
  window: { left: WINDOW_TARGET.approachLeft, right: WINDOW_TARGET.approachRight, look: WINDOW_TARGET.lookRange },
}

export function targetApproach(id: string) {
  return OVERRIDES[id] ?? { left: DEFAULT_APPROACH_GAP, right: DEFAULT_APPROACH_GAP, look: DEFAULT_LOOK_RANGE }
}
