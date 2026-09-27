import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { R55_EXACT_ROUTES, speechForExactRoute } from '../../src/adventure/r55RouteContract'
import type { AdventureState, HotspotId, InventoryItemId, VerbId } from '../../src/adventure/types'

const ids = (state: AdventureState) => [...new Set((state.activeSequence?.pendingSpeech ?? state.speech?.lines ?? state.nonblockingSpeech?.lines ?? []).map(line => line.copyKey?.replace(/\.provisional-\d+$/, '')))]

function worldRoute(state: AdventureState, verb: VerbId, targetId: HotspotId, itemId: InventoryItemId | null = null) {
  let next: AdventureState = { ...state, nonblockingSpeech: null, speech: null, walk: null, selectedItemId: itemId }
  next = adventureReducer(next, { type: 'SELECT_VERB', verb })
  next = adventureReducer(next, { type: 'INTERACT', targetId })
  if (next.walk) next = adventureReducer(next, { type: 'WALK_TICK', delta: 10_000 })
  for (let guard = 0; next.activeSequence && next.activeSequence.id !== 'SEQUENCE.PRESERVE_REACH' && guard < 20; guard += 1) next = adventureReducer(next, { type: 'ADVANCE_SEQUENCE' })
  return next
}

describe('S14-R3 real route execution and background state closure', () => {
  it('binds each grouped wall slice to its rightful player route', () => {
    const fresh = createInitialAdventureState({ skipIntro: true })
    const cases = [
      ['cityPickUse', 'PICK_UP', 'wall-city-bridge'],
      ['recordsPickUse', 'USE', 'wall-records-sign'],
      ['stanchionPickUse', 'PICK_UP', 'wall-not-a-number'],
      ['preserveShort', 'PICK_UP', 'wall-preserve'],
      ['preserveVault', 'OPEN', 'wall-preserve'],
      ['employeeRemoval', 'PICK_UP', 'wall-employee'],
      ['unreachableWall', 'PUSH', 'wall-building'],
    ] as const
    for (const [routeId, verb, target] of cases) {
      const observed = ids(worldRoute(fresh, verb, target))
      const descriptor = R55_EXACT_ROUTES[routeId]
      expect(observed, descriptor.routeId).toEqual(speechForExactRoute(routeId).map(line => line.copyKey))
    }
  })

  it('observes Arthur rubber-band copy through the actual GIVE route', () => {
    let state: AdventureState = { ...createInitialAdventureState({ skipIntro: true }), inventory: ['rubber-band'], rookPosition: { x: 416, y: 365 } }
    state = adventureReducer(state, { type: 'SELECT_ITEM', itemId: 'rubber-band' })
    state = adventureReducer(state, { type: 'SELECT_VERB', verb: 'GIVE' })
    state = adventureReducer(state, { type: 'SELECT_ITEM', itemId: 'rubber-band' })
    state = adventureReducer(state, { type: 'INTERACT', targetId: 'mr-index' })
    if (state.walk) state = adventureReducer(state, { type: 'WALK_TICK', delta: 10_000 })
    expect(ids(state)).toEqual(['r55-d656ef1772b3cf9ad684'])
  })

  it('speaks each lamp transition once while every later USE still toggles power', () => {
    let state = createInitialAdventureState({ skipIntro: true })
    state = worldRoute(state, 'USE', 'desk-lamp')
    expect([state.lampPower, state.lampSpeech, ids(state)]).toEqual(['OFF', 1, speechForExactRoute('lampOff').map(line => line.copyKey)])
    state = worldRoute(state, 'USE', 'desk-lamp')
    expect([state.lampPower, state.lampSpeech, ids(state)]).toEqual(['ON', 2, speechForExactRoute('lampOn').map(line => line.copyKey)])
    state = worldRoute(state, 'USE', 'desk-lamp')
    expect([state.lampPower, state.lampSpeech, ids(state)]).toEqual(['OFF', 2, []])
    state = worldRoute(state, 'USE', 'desk-lamp')
    expect([state.lampPower, state.lampSpeech, ids(state)]).toEqual(['ON', 2, []])
    expect(createInitialAdventureState({ skipIntro: true })).toMatchObject({ lampPower: 'ON', lampSpeech: 0 })
  })

  it('shares PUSH and USE direction A, preserves milestones across reversals, and never replays them', () => {
    let state = createInitialAdventureState({ skipIntro: true })
    state = worldRoute(state, 'USE', 'office-globe')
    expect([state.globePose, state.globeLevel, ids(state)]).toEqual(['PUSH', 1, ['r55-3eebf664be6d0c78009c']])
    state = worldRoute(state, 'PULL', 'office-globe')
    expect([state.globePose, state.globeLevel, ids(state)]).toEqual(['PULL', 1, ['r55-3562a493e8a45d6b3d20']])
    state = worldRoute(state, 'PULL', 'office-globe')
    expect([state.globeLevel, ids(state)]).toEqual([2, ['r55-163ff107d34e448fbca9']])
    state = worldRoute(state, 'PUSH', 'office-globe')
    expect([state.globePose, state.globeLevel, ids(state)]).toEqual(['PUSH', 1, ['r55-3562a493e8a45d6b3d20']])
    state = worldRoute(state, 'USE', 'office-globe')
    expect([state.globeLevel, ids(state)]).toEqual([2, []])
    state = worldRoute(state, 'USE', 'office-globe')
    expect([state.globeLevel, ids(state)]).toEqual([3, ['r55-06f7c85f1a47a3c7bf5f']])
    state = worldRoute(state, 'PUSH', 'office-globe')
    expect([state.globeLevel, ids(state)]).toEqual([3, ['r55-638e390985f479a2ba54']])
    expect(createInitialAdventureState({ skipIntro: true })).toMatchObject({ globePose: 'IDLE', globeLevel: 0, globeMilestones: 0 })
  })
})
