import { describe, expect, it } from 'vitest'
import { createGameReducer, createInitialGameState, replayGame } from '../../src/game/domain/reducer'
import type { GameAction, GameState } from '../../src/game/domain/types'
import { eulerBundle } from '../../src/game/scenario/euler'

const reducer = createGameReducer(eulerBundle.scenario, eulerBundle.world)
const initial = createInitialGameState(eulerBundle.world)
const run = (state: GameState, ...actions: GameAction[]) => replayGame(actions, state, reducer)
const arrive = (state: GameState) => run(state, { type: 'ADVANCE_TRAVEL', delta: 1 })

function reachIndex() {
  let state = run(initial, { type: 'ENTER_VAULT' }, { type: 'OPENING_COMPLETE' }, { type: 'START_TRAVEL', pathId: 'approach-record' })
  state = arrive(state)
  expect(state.discoveredEvidence).toEqual([])
  state = run(state, { type: 'ROUTE_SCAN' })
  expect(state.discoveredEvidence).toEqual([])
  state = run(state, { type: 'OPEN_CASE_INDEX' })
  return arrive(state)
}

function investigate(state: GameState, index: 0 | 1) {
  const branch = eulerBundle.scenario.branches[index]
  state = run(state, { type: 'CHOOSE_BRANCH', branch: branch.id })
  state = arrive(state)
  expect(state.discoveredEvidence).not.toContain(branch.evidenceId)
  state = run(state, { type: 'ANALYZE_BRANCH' })
  expect(state.discoveredEvidence).toEqual(expect.arrayContaining(branch.discoveryEvidenceIds))
  if (index === 0) {
    state = run(state, { type: 'UNWIND_TRAIL' })
    state = arrive(state)
  }
  state = run(state, { type: 'COMPLETE_BRANCH' }, { type: 'REWIND' })
  return arrive(state)
}

function reachHypothesis(order: readonly [0 | 1, 0 | 1]) {
  let state = investigate(reachIndex(), order[0])
  state = investigate(state, order[1])
  return run(state, { type: 'BRING_RECORDS_TOGETHER' })
}

function testHypothesis(state: GameState, hypothesisId: string) {
  state = run(state, { type: 'SELECT_HYPOTHESIS', hypothesisId }, { type: 'SWEEP_FORWARD' })
  return arrive(state)
}

function reachCaseAssembly(hypothesisId: string) {
  let state = testHypothesis(reachHypothesis([0, 1]), hypothesisId)
  state = run(state, { type: 'CONTINUE_AFTER_HYPOTHESIS' })
  state = arrive(state)
  return run(state, { type: 'BUILD_CASE' })
}

describe('G6 Euler truth and evidence timing', () => {
  it('does not acquire any critical record before its explicit action', () => {
    const index = reachIndex()
    expect(index.discoveredEvidence).toEqual([])
    let branch = run(index, { type: 'CHOOSE_BRANCH', branch: 'first-breach' })
    branch = arrive(branch)
    expect(branch.discoveredEvidence).toEqual([])
    branch = run(branch, { type: 'ANALYZE_BRANCH' })
    expect(branch.discoveredEvidence).toEqual(expect.arrayContaining(['EXACT_EARLY_NET', 'STATE_EARLY_ENGINE']))
  })

  it('treats both breach branches as true and creates contradiction only after a falsified hypothesis', () => {
    const hypothesis = reachHypothesis([1, 0])
    expect(hypothesis.contradictionCollected).toBe(false)
    const confirmed = testHypothesis(hypothesis, 'FIRST_TRAIL_JOINS_SECOND_ROUTE')
    expect(confirmed.hypothesisOutcome).toBe('CONFIRMED')
    expect(confirmed.contradictionCollected).toBe(false)
    const falsified = testHypothesis(reachHypothesis([0, 1]), 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE')
    expect(falsified.hypothesisOutcome).toBe('FALSIFIED')
    expect(falsified.contradictionCollected).toBe(true)
  })

  it('tests both symmetrical hypotheses with the same 11:38 convergence record', () => {
    for (const option of eulerBundle.scenario.experiencePlan.hypothesis.options) {
      const state = testHypothesis(reachHypothesis([0, 1]), option.id)
      expect(state.discoveredEvidence).toContain('EXACT_CONVERGENCE')
      expect(state.archivedEvidence).toContain('EXACT_CONVERGENCE')
    }
  })

  it('rejects context in a decisive case slot and accepts only amount, receiver, and link', () => {
    let state = reachCaseAssembly('FIRST_TRAIL_JOINS_SECOND_ROUTE')
    state = run(state, { type: 'SELECT_CASE_RECORD', slot: 'LINK', evidenceId: 'CONTEXT_SECONDARY' })
    expect(state.caseAssembly.LINK).toBeNull()
    expect(state.caseAssemblyMessage).toBe("THAT RECORD DOESN'T CLOSE THE TRAIL.")
    for (const slot of eulerBundle.scenario.experiencePlan.caseAssembly.slots) state = run(state, { type: 'SELECT_CASE_RECORD', slot: slot.id, evidenceId: slot.requiredEvidenceId })
    state = run(state, { type: 'VERIFY_CASE' })
    expect(state.beat).toBe('TRUTH_ENGINE')
  })

  it('requires player-paced Truth Engine advancement and forbids first-run skip', () => {
    let state = reachCaseAssembly('FIRST_TRAIL_JOINS_SECOND_ROUTE')
    for (const slot of eulerBundle.scenario.experiencePlan.caseAssembly.slots) state = run(state, { type: 'SELECT_CASE_RECORD', slot: slot.id, evidenceId: slot.requiredEvidenceId })
    state = run(state, { type: 'VERIFY_CASE' })
    expect(state.truthStep).toBe(0)
    expect(run(state, { type: 'SKIP_REPLAY_TRUTH' })).toBe(state)
    expect(run(state, { type: 'COMPLETE_TRUTH_ENGINE' })).toBe(state)
    for (let step = 0; step < eulerBundle.scenario.truthTimeline.length; step += 1) state = run(state, { type: 'ADVANCE_TRUTH_ENGINE' })
    state = run(state, { type: 'COMPLETE_TRUTH_ENGINE' })
    expect(state).toMatchObject({ beat: 'COMPLETE', complete: true, completedOnce: true })

    state = run(state, { type: 'RESET' })
    state = { ...state, beat: 'TRUTH_ENGINE', activeInteractable: 'truth-continue' }
    expect(run(state, { type: 'SKIP_REPLAY_TRUTH' })).toMatchObject({ truthStep: eulerBundle.scenario.truthTimeline.length })
  })

  it('lets a direct solver complete without a contradiction fragment', () => {
    let state = reachCaseAssembly('FIRST_TRAIL_JOINS_SECOND_ROUTE')
    for (const slot of eulerBundle.scenario.experiencePlan.caseAssembly.slots) state = run(state, { type: 'SELECT_CASE_RECORD', slot: slot.id, evidenceId: slot.requiredEvidenceId })
    state = run(state, { type: 'VERIFY_CASE' })
    for (let step = 0; step < eulerBundle.scenario.truthTimeline.length; step += 1) state = run(state, { type: 'ADVANCE_TRUTH_ENGINE' })
    state = run(state, { type: 'COMPLETE_TRUTH_ENGINE' })
    expect(state.complete).toBe(true)
    expect(state.contradictionCollected).toBe(false)
  })
})
