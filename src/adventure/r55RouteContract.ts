import type { HotspotId, InventoryItemId, PuzzlePhase, SpeechLine, VerbId } from './types'
import type { R55SourceEventKey } from '../story/r55/production'
import { R55_SOURCE_SLICE_INVENTORY, r55SpeechBySourceSlice } from '../story/r55/production'

export interface R55RouteDescriptor {
  routeId: string
  ownerKind: 'world-object' | 'inventory-item' | 'arthur-item' | 'state-transition'
  ownerId: HotspotId | InventoryItemId | 'lamp' | 'globe'
  input: { verb: VerbId; targetId?: HotspotId; itemId?: InventoryItemId | null }
  state: string
  eventKey: R55SourceEventKey
  nodeIndices: readonly number[]
  exerciseId: string
}

const route = (descriptor: R55RouteDescriptor) => descriptor

/**
 * Routes whose grouped source events must be sliced by the actual player owner.
 * Runtime resolution and the executable verifier both consume these descriptors.
 */
export const R55_EXACT_ROUTES = {
  cityPickUse: route({ routeId: 'r55.background.city-bridge.pick-use', ownerKind: 'world-object', ownerId: 'wall-city-bridge', input: { verb: 'PICK_UP', targetId: 'wall-city-bridge', itemId: null }, state: 'ANY', eventKey: 'COPY.BACKGROUND:PICK UP / USE', nodeIndices: [0], exerciseId: 's14-r3-route:background-city-pick-use' }),
  recordsPickUse: route({ routeId: 'r55.background.records-sign.pick-use', ownerKind: 'world-object', ownerId: 'wall-records-sign', input: { verb: 'PICK_UP', targetId: 'wall-records-sign', itemId: null }, state: 'ANY', eventKey: 'COPY.BACKGROUND:PICK UP / USE', nodeIndices: [1], exerciseId: 's14-r3-route:background-records-pick-use' }),
  stanchionPickUse: route({ routeId: 'r55.background.stanchion.pick-use', ownerKind: 'world-object', ownerId: 'wall-not-a-number', input: { verb: 'PICK_UP', targetId: 'wall-not-a-number', itemId: null }, state: 'ANY', eventKey: 'COPY.BACKGROUND:PICK UP / USE', nodeIndices: [2], exerciseId: 's14-r3-route:background-stanchion-pick-use' }),
  preserveShort: route({ routeId: 'r55.background.preserve.short-refusal', ownerKind: 'world-object', ownerId: 'wall-preserve', input: { verb: 'PICK_UP', targetId: 'wall-preserve', itemId: null }, state: 'ANY', eventKey: 'COPY.BACKGROUND:PICK UP / USE / GIVE', nodeIndices: [0], exerciseId: 's14-r3-route:background-preserve-short' }),
  preserveVault: route({ routeId: 'r55.background.preserve.vault-gag', ownerKind: 'world-object', ownerId: 'wall-preserve', input: { verb: 'OPEN', targetId: 'wall-preserve', itemId: null }, state: 'ANY', eventKey: 'COPY.BACKGROUND:OPEN / PULL', nodeIndices: [0, 1], exerciseId: 's14-r3-route:background-preserve-vault' }),
  employeeRemoval: route({ routeId: 'r55.background.employee.removal', ownerKind: 'world-object', ownerId: 'wall-employee', input: { verb: 'PICK_UP', targetId: 'wall-employee', itemId: null }, state: 'ANY', eventKey: 'COPY.BACKGROUND:PICK UP / removal attempt', nodeIndices: [0], exerciseId: 's14-r3-route:background-employee-removal' }),
  unreachableWall: route({ routeId: 'r55.background.building.unreachable', ownerKind: 'world-object', ownerId: 'wall-building', input: { verb: 'USE', targetId: 'wall-building', itemId: null }, state: 'ANY', eventKey: 'COPY.BACKGROUND:Global rules', nodeIndices: [0], exerciseId: 's14-r3-route:background-unreachable' }),
  lampOff: route({ routeId: 'r55.background.lamp.first-off', ownerKind: 'state-transition', ownerId: 'lamp', input: { verb: 'USE', targetId: 'desk-lamp', itemId: null }, state: 'ON_AND_OFF_LINE_UNSEEN', eventKey: 'COPY.BACKGROUND:First `USE`: ON → OFF', nodeIndices: [0], exerciseId: 's14-r3-route:lamp-first-off' }),
  lampOn: route({ routeId: 'r55.background.lamp.first-on', ownerKind: 'state-transition', ownerId: 'lamp', input: { verb: 'USE', targetId: 'desk-lamp', itemId: null }, state: 'OFF_AND_ON_LINE_UNSEEN', eventKey: 'COPY.BACKGROUND:First later `USE`: OFF → ON', nodeIndices: [0], exerciseId: 's14-r3-route:lamp-first-on' }),
  globeSpeed1: route({ routeId: 'r55.background.globe.speed-1', ownerKind: 'state-transition', ownerId: 'globe', input: { verb: 'PUSH', targetId: 'office-globe', itemId: null }, state: 'LEVEL_0_AND_MILESTONE_UNSEEN', eventKey: 'COPY.BACKGROUND:First global reach of speed 1', nodeIndices: [0], exerciseId: 's14-r3-route:globe-speed-1' }),
  globeSpeed2: route({ routeId: 'r55.background.globe.speed-2', ownerKind: 'state-transition', ownerId: 'globe', input: { verb: 'PUSH', targetId: 'office-globe', itemId: null }, state: 'LEVEL_1_AND_MILESTONE_UNSEEN', eventKey: 'COPY.BACKGROUND:First global reach of speed 2', nodeIndices: [0], exerciseId: 's14-r3-route:globe-speed-2' }),
  globeMaximum: route({ routeId: 'r55.background.globe.maximum', ownerKind: 'state-transition', ownerId: 'globe', input: { verb: 'PUSH', targetId: 'office-globe', itemId: null }, state: 'LEVEL_2_AND_MILESTONE_UNSEEN', eventKey: 'COPY.BACKGROUND:First global reach of maximum speed', nodeIndices: [0], exerciseId: 's14-r3-route:globe-maximum' }),
  globeMaximumRepeat: route({ routeId: 'r55.background.globe.maximum-repeat', ownerKind: 'state-transition', ownerId: 'globe', input: { verb: 'PUSH', targetId: 'office-globe', itemId: null }, state: 'LEVEL_3_SAME_DIRECTION', eventKey: 'COPY.BACKGROUND:Further compatible acceleration at maximum', nodeIndices: [0], exerciseId: 's14-r3-route:globe-maximum-repeat' }),
  globeReversal: route({ routeId: 'r55.background.globe.reversal', ownerKind: 'state-transition', ownerId: 'globe', input: { verb: 'PULL', targetId: 'office-globe', itemId: null }, state: 'NON_IDLE_OPPOSITE_DIRECTION', eventKey: 'COPY.BACKGROUND:Actual reversal', nodeIndices: [0], exerciseId: 's14-r3-route:globe-reversal' }),
} as const satisfies Record<string, R55RouteDescriptor>

export type R55ExactRouteId = keyof typeof R55_EXACT_ROUTES

export function speechForExactRoute(routeId: R55ExactRouteId): SpeechLine[] {
  const descriptor = R55_EXACT_ROUTES[routeId]
  const sourceSliceIds = descriptor.nodeIndices.map(index => {
    const slice = R55_SOURCE_SLICE_INVENTORY.find(candidate => candidate.eventKey === descriptor.eventKey && candidate.startIndex <= index && index < candidate.endIndex)
    if (!slice) throw new Error(`R55 exact route index is outside its authenticated source slice: ${descriptor.routeId}[${index}]`)
    return slice.routeId
  })
  return [...new Set(sourceSliceIds)].flatMap(sourceSliceId => r55SpeechBySourceSlice(sourceSliceId))
}

export interface RouteStateFixture {
  phase?: PuzzlePhase
  lampPower?: 'ON' | 'OFF'
  lampSpeech?: 0 | 1 | 2
  globePose?: 'IDLE' | 'PUSH' | 'PULL'
  globeLevel?: 0 | 1 | 2 | 3
  globeMilestones?: number
}
