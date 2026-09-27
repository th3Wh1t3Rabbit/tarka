import { targetApproach, windowGameBox } from './interactionGeometry'
import { APPROACH_GAP, layoutHotspotPixels, type SceneComposition } from './sceneComposition'
import { hotspots, layoutPropHotspots, WALK_Y_MAX, WALK_Y_MIN } from './scenes'
import type { Point, RuntimeSessionConfig, RuntimeTargetGeometry } from './types'

export const EMPTY_RUNTIME_SESSION: RuntimeSessionConfig = {
  layoutHash: null,
  arthurCenterX: null,
  targets: {},
}

/** Geometry captured for one play session. Later browser-layout edits do not rewrite it. */
export function buildRuntimeSession(layout: SceneComposition | null): RuntimeSessionConfig {
  if (!layout) return EMPTY_RUNTIME_SESSION
  const ids = new Set<string>()
  for (const hotspot of [...hotspots, ...layoutPropHotspots]) ids.add(hotspot.id)
  for (const entity of layout.entities) if (entity.hotspotId) ids.add(entity.hotspotId)
  const targets: Record<string, RuntimeTargetGeometry> = {}
  for (const id of ids) {
    const pixels = layoutHotspotPixels(layout, id, 2)
    if (!pixels) continue
    const approach = targetApproach(id)
    targets[id] = {
      centerX: pixels.left + pixels.width / 2,
      centerY: pixels.top + pixels.height / 2,
      left: pixels.left,
      width: pixels.width,
      footY: Math.min(WALK_Y_MAX, Math.max(WALK_Y_MIN, pixels.top + pixels.height)),
      visible: true,
      approachLeft: approach.left,
      approachRight: approach.right,
      lookRange: approach.look,
    }
  }
  if (!targets.window) {
    const approach = targetApproach('window')
    const plate = windowGameBox(2)
    targets.window = {
      centerX: plate.left + plate.width / 2,
      centerY: plate.top + plate.height / 2,
      left: plate.left,
      width: plate.width,
      footY: Math.min(WALK_Y_MAX, Math.max(WALK_Y_MIN, plate.top + plate.height)),
      visible: true,
      approachLeft: approach.left,
      approachRight: approach.right,
      lookRange: approach.look,
    }
  }
  const arthur = layout.entities.find((item) => item.id === 'arthur' && item.visible)
  return {
    layoutHash: layout.contentSha256 || null,
    arthurCenterX: arthur ? (arthur.x + arthur.renderWidth / 2) * 2 : null,
    targets,
  }
}

/** Same stand rule as layoutHotspotWalkTo. The 14px gap is current WIP, not a final distance. */
export function walkPointForTarget(target: RuntimeTargetGeometry, fromX: number): Point {
  const gap = fromX <= target.centerX ? target.approachLeft ?? APPROACH_GAP : target.approachRight ?? APPROACH_GAP
  const stand = fromX <= target.centerX ? target.left - gap : target.left + target.width + gap
  const x = fromX <= target.centerX ? (fromX < stand ? stand : fromX) : (fromX > stand ? stand : fromX)
  return { x: Math.min(920, Math.max(40, x)), y: target.footY }
}
