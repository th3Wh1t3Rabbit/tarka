import type { LogicalNavigationState } from '../domain/types'
import type { CameraMode, PresentationProfile, WorldManifest } from '../scenario/contracts'

export interface ResolvedCamera {
  position: [number, number, number]
  target: [number, number, number]
}

export interface PresentationAdapter {
  readonly profile: PresentationProfile
  resolvePosition(navigation: LogicalNavigationState, world: WorldManifest): [number, number, number]
  resolveCamera(cameraMode: CameraMode, navigation: LogicalNavigationState, world: WorldManifest): ResolvedCamera
}

function nodePosition(world: WorldManifest, nodeId: string): [number, number, number] {
  const node = world.nodes.find(({ id }) => id === nodeId)
  if (!node) throw new Error(`Presentation node not found: ${nodeId}`)
  return [...node.presentation.position]
}

function nodeLandmark(world: WorldManifest, nodeId: string): [number, number, number] {
  const node = world.nodes.find(({ id }) => id === nodeId)
  if (!node) throw new Error(`Presentation landmark not found: ${nodeId}`)
  return [...node.presentation.cameraLandmark]
}

function interpolate(from: [number, number, number], to: [number, number, number], progress: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, progress))
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]
}

function spline(points: [[number, number, number], [number, number, number], [number, number, number]], progress: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, progress)); const oneMinus = 1 - t
  return [0, 1, 2].map((axis) => oneMinus * oneMinus * points[0][axis]! + 2 * oneMinus * t * points[1][axis]! + t * t * points[2][axis]!) as [number, number, number]
}

export const guidedProbe3dAdapter: PresentationAdapter = {
  profile: 'GUIDED_PROBE_3D',
  resolvePosition(navigation, world) {
    if (navigation.travelStatus !== 'TRAVELING' || !navigation.activePathId) return nodePosition(world, navigation.currentNodeId)
    const path = world.passages.find(({ id }) => id === navigation.activePathId)
    if (!path) throw new Error(`Presentation path not found: ${navigation.activePathId}`)
    return spline(path.presentation.spline, navigation.travelProgress)
  },
  resolveCamera(cameraMode, navigation, world) {
    const probe = this.resolvePosition(navigation, world)
    if (cameraMode === 'TRUTH_ENGINE') return { position: [0, 6.2, -2.4], target: [0, 0.5, -10] }
    const activePath = navigation.activePathId ? world.passages.find(({ id }) => id === navigation.activePathId) : null
    const landmark = activePath ? interpolate(nodeLandmark(world, activePath.from), nodeLandmark(world, activePath.to), navigation.travelProgress) : nodeLandmark(world, navigation.currentNodeId)
    const inspectionLift = cameraMode === 'INSPECTION' || cameraMode === 'THEORY' ? 3.6 : 4.2
    const distance = cameraMode === 'SIGNATURE_TRANSITION' ? 6.4 : 8.2
    return { position: [probe[0] * 0.32, inspectionLift, probe[2] + distance], target: [landmark[0], landmark[1], landmark[2]] }
  },
}

export const documentedPresentationFallbacks: readonly PresentationProfile[] = [
  'FIRST_PERSON_RAIL_3D',
  'ORTHOGRAPHIC_2_5D',
  'TOP_DOWN_VECTOR_2D',
]
