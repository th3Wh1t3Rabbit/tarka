import type { WorldDescription } from './model'

export function getWorldNode(world: WorldDescription, id: string) {
  const node = world.nodes.find((candidate) => candidate.id === id)
  if (!node) throw new Error(`World node not found: ${id}`)
  return node
}

export function getPassageSegments(world: WorldDescription) {
  return world.passages.map((passage) => {
    const from = getWorldNode(world, passage.from)
    const to = getWorldNode(world, passage.to)
    const dx = to.position[0] - from.position[0]
    const dy = to.position[1] - from.position[1]
    const dz = to.position[2] - from.position[2]
    const horizontalLength = Math.hypot(dx, dz)
    return {
      ...passage,
      center: [(from.position[0] + to.position[0]) / 2, (from.position[1] + to.position[1]) / 2, (from.position[2] + to.position[2]) / 2] as [number, number, number],
      length: Math.hypot(dx, dy, dz),
      rotationY: Math.atan2(dx, dz),
      rotationX: Math.atan2(-dy, horizontalLength),
    }
  })
}
