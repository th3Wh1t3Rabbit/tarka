import { describe, expect, it } from 'vitest'
import { hotspots, inventoryItems } from '../../src/adventure/content'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { VERBS, type AdventureAction, type AdventureState, type HotspotId, type InventoryItemId, type PuzzlePhase, type VerbId } from '../../src/adventure/types'

const phases: PuzzlePhase[] = ['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED', 'COMPLETE']
const itemIds = Object.keys(inventoryItems) as InventoryItemId[]
const vhs = /VHS|videotape|doesn.t play them/i
const sourceLeak = /^\s*["“][\s\S]*["”]\s*$|\.provisional-/

const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
const speechText = (state: AdventureState) => [
  ...(state.speech?.lines ?? []),
  ...(state.nonblockingSpeech?.lines ?? []),
  ...(state.activeSequence?.pendingSpeech ?? []),
]

function fixture(phase: PuzzlePhase, collected: boolean): AdventureState {
  return {
    ...createInitialAdventureState({ skipIntro: true, accessibility: { instantText: true, reducedAnimation: true } }),
    phase,
    authorizationState: phase === 'COMPLETE' ? 'APPROVED' : 'PENDING',
    inventory: [...itemIds],
    caseFileDrawer: collected ? 'OPEN' : 'CLOSED',
    miscDrawer: collected ? 'OPEN' : 'CLOSED',
    caseStack: collected ? 'SEARCHED_EULER_REMOVED' : 'UNSEARCHED',
    miscContents: collected ? 'COLLECTED_GUM_REMAINS' : 'UNCOLLECTED',
  }
}

function settle(start: AdventureState) {
  let state = start
  const observed = [] as ReturnType<typeof speechText>
  for (let guard = 0; guard < 400; guard += 1) {
    observed.push(...speechText(state))
    if (state.walk) { state = send(state, { type: 'WALK_TICK', delta: 100_000 }); continue }
    if (state.speech) { state = send(state, { type: 'ADVANCE_SPEECH' }); continue }
    if (state.nonblockingSpeech) { state = send(state, { type: 'ADVANCE_SPEECH', channel: 'NONBLOCKING' }); continue }
    if (state.activeSequence) { state = send(state, { type: 'ADVANCE_SEQUENCE' }); continue }
    if (state.dialogueOpen) { state = send(state, { type: 'CLOSE_DIALOGUE' }); continue }
    return { state, observed }
  }
  throw new Error(`route did not settle: ${start.phase}/${start.selectedVerb}/${start.selectedItemId}`)
}

function world(start: AdventureState, verb: VerbId, targetId: HotspotId, itemId: InventoryItemId | null) {
  let state = send(start, { type: 'SELECT_VERB', verb })
  if (itemId) state = send(state, { type: 'SELECT_ITEM', itemId })
  state = send(state, { type: 'INTERACT', targetId })
  return settle(state)
}

function inventory(start: AdventureState, verb: VerbId, itemId: InventoryItemId) {
  return settle(send(send(start, { type: 'SELECT_VERB', verb }), { type: 'ACT_ON_ITEM', itemId }))
}

function assertSanitary(label: string, lines: ReturnType<typeof speechText>, selectedItem: InventoryItemId | null) {
  for (const line of lines) {
    expect(line.text, label).not.toMatch(sourceLeak)
    expect(line.copyKey ?? '', label).not.toContain('.provisional-')
    if (vhs.test(line.text)) expect(selectedItem, label).toBe('sharknado-2-vhs')
  }
}

describe('S17-P2-R3 permanent full reducer/router matrix', () => {
  it('settles all hotspot/verb/phase/drawer-state routes twice with clean selection and scoped copy', () => {
    let routes = 0
    for (const phase of phases) for (const collected of [false, true]) for (const target of hotspots) for (const verb of VERBS) {
      let state = fixture(phase, collected)
      for (let repeat = 0; repeat < 2; repeat += 1) {
        const result = world(state, verb, target.id, null)
        assertSanitary(`${phase}:${collected}:${target.id}:${verb}:repeat-${repeat}`, result.observed, null)
        expect(result.state.selectedVerb).toBeNull()
        expect(result.state.selectedItemId).toBeNull()
        expect(result.state.walk).toBeNull()
        expect(result.state.activeSequence).toBeNull()
        state = result.state
        routes += 1
      }
    }
    expect(hotspots).toHaveLength(27)
    expect(VERBS).toHaveLength(9)
    expect(routes).toBe(6_804)
  })

  it('settles every selected-item USE/GIVE world route in all phases and both drawer states', () => {
    let routes = 0
    for (const phase of phases) for (const collected of [false, true]) for (const target of hotspots) {
      for (const verb of ['USE', 'GIVE'] as const) for (const itemId of itemIds) {
        const result = world(fixture(phase, collected), verb, target.id, itemId)
        assertSanitary(`${phase}:${collected}:${itemId}:${verb}:${target.id}`, result.observed, itemId)
        expect(result.state.selectedVerb).toBeNull()
        expect(result.state.selectedItemId).toBeNull()
        expect(result.state.walk).toBeNull()
        expect(result.state.activeSequence).toBeNull()
        routes += 1
      }
    }
    expect(itemIds).toHaveLength(15)
    expect(routes).toBe(11_340)
  })

  it('covers every inventory verb and every ordered item pair in all phases', () => {
    let directRoutes = 0
    let pairRoutes = 0
    for (const phase of phases) {
      for (const itemId of itemIds) for (const verb of VERBS) {
        const result = inventory(fixture(phase, true), verb, itemId)
        assertSanitary(`${phase}:inventory:${verb}:${itemId}`, result.observed, itemId)
        if (verb !== 'USE' && verb !== 'GIVE') {
          expect(result.state.selectedVerb).toBeNull()
          expect(result.state.selectedItemId).toBeNull()
        }
        directRoutes += 1
      }
      for (const source of itemIds) for (const target of itemIds) if (source !== target) {
        let state = send(fixture(phase, true), { type: 'SELECT_VERB', verb: 'USE' })
        state = send(state, { type: 'ACT_ON_ITEM', itemId: source })
        const result = settle(send(state, { type: 'ACT_ON_ITEM', itemId: target }))
        assertSanitary(`${phase}:pair:${source}:${target}`, result.observed, source)
        expect(result.state.selectedVerb).toBeNull()
        expect(result.state.selectedItemId).toBeNull()
        pairRoutes += 1
      }
    }
    expect(directRoutes).toBe(945)
    expect(pairRoutes).toBe(1_470)
  })
})
