import { describe, expect, it } from 'vitest'
import { createGameReducer, createInitialGameState, getRewindableSnapshot, replayGame } from '../../src/game/domain/reducer'
import type { GameAction, GameState } from '../../src/game/domain/types'
import { syntheticBundle } from '../../src/game/scenario/synthetic-compiled'

const reducer = createGameReducer(syntheticBundle.scenario, syntheticBundle.world)
const initial = createInitialGameState(syntheticBundle.world)
const run = (state: GameState, ...actions: GameAction[]) => replayGame(actions, state, reducer)
const arrive = (state: GameState) => run(state, { type: 'ADVANCE_TRAVEL', delta: 1 })

function reachIndex() {
  let state = run(initial, { type: 'ENTER_VAULT' }, { type: 'OPENING_COMPLETE' }, { type: 'START_TRAVEL', pathId: 'approach-record' })
  state = arrive(state)
  state = run(state, { type: 'ROUTE_SCAN' }, { type: 'OPEN_CASE_INDEX' })
  return arrive(state)
}

function branch(state: GameState, index: 0 | 1) {
  const config = syntheticBundle.scenario.branches[index]
  state = run(state, { type: 'CHOOSE_BRANCH', branch: config.id })
  state = arrive(state)
  state = run(state, { type: 'ANALYZE_BRANCH' })
  if (index === 0) {
    state = run(state, { type: 'UNWIND_TRAIL' })
    state = arrive(state)
  }
  state = run(state, { type: 'COMPLETE_BRANCH' }, { type: 'REWIND' })
  return arrive(state)
}

describe('renderer-independent mission domain', () => {
  it('stores logical navigation without presentation coordinates', () => {
    const state = createInitialGameState(syntheticBundle.world)
    expect(state.navigation).toEqual({ currentNodeId: 'entry-origin', activePathId: null, travelProgress: 0, travelStatus: 'IDLE', travelControl: null, facingHint: 'FORWARD' })
    expect(JSON.stringify(state)).not.toContain('playerLocation')
    expect(JSON.stringify(state.navigation)).not.toMatch(/position|\[\s*-?\d+\s*,\s*-?\d+/)
  })

  it('advances guided travel over multiple frames and changes stage only on arrival', () => {
    let state = run(initial, { type: 'ENTER_VAULT' }, { type: 'OPENING_COMPLETE' }, { type: 'START_TRAVEL', pathId: 'approach-record' })
    expect(state.navigation).toMatchObject({ currentNodeId: 'entry-origin', activePathId: 'approach-record', travelProgress: 0, travelStatus: 'TRAVELING' })
    state = run(state, { type: 'ADVANCE_TRAVEL', delta: 0.35 })
    expect(state.beat).toBe('APPROACH')
    expect(state.navigation).toMatchObject({ currentNodeId: 'entry-origin', travelProgress: 0.35, travelStatus: 'TRAVELING' })
    state = run(state, { type: 'ADVANCE_TRAVEL', delta: 0.65 })
    expect(state.navigation).toMatchObject({ currentNodeId: 'record-gate', travelStatus: 'IDLE' })
  })

  it('rejects invalid paths and never teleports', () => {
    const approach = run(initial, { type: 'ENTER_VAULT' }, { type: 'OPENING_COMPLETE' })
    expect(run(approach, { type: 'START_TRAVEL', pathId: 'sweep-forward' })).toBe(approach)
    expect(run(approach, { type: 'ADVANCE_TRAVEL', delta: 1 })).toBe(approach)
  })

  it('creates a logical Time Anchor and preserves records through either return', () => {
    const atIndex = reachIndex()
    expect(atIndex.timeAnchors).toHaveLength(1)
    expect(atIndex.timeAnchors[0]?.snapshot.navigation.currentNodeId).toBe('case-index')
    const returned = branch(atIndex, 0)
    expect(getRewindableSnapshot(returned)).toEqual(expect.objectContaining({ beat: 'CASE_INDEX', navigation: expect.objectContaining({ currentNodeId: 'case-index' }) }))
    expect(returned.archivedEvidence).toEqual(expect.arrayContaining(syntheticBundle.scenario.branches[0].discoveryEvidenceIds))
  })

  it.each([[0, 1], [1, 0]] as const)('supports branch order %s then %s without declaring either branch false', (first, second) => {
    let state = branch(reachIndex(), first)
    state = branch(state, second)
    expect(state.exploredBranches).toEqual([syntheticBundle.scenario.branches[first].id, syntheticBundle.scenario.branches[second].id])
    expect(state.contradictionCollected).toBe(false)
    expect(state.beat).toBe('CASE_INDEX')
  })
})
