import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureState, HotspotId, VerbId } from '../../src/adventure/types'

const fresh = (): AdventureState => ({ ...createInitialAdventureState({ skipIntro: true }), instantText: true, reducedAnimation: true })
const act = (state: AdventureState, verb: VerbId, targetId: HotspotId) => adventureReducer(adventureReducer(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId })

describe('S12-P2-R4 form and dispenser owners', () => {
  it('W04 grants I01 once and W03 never does, for every input verb that reaches the reducer', () => {
    for (const verb of ['PICK_UP', 'PULL'] as const) {
      const taken = act(fresh(), verb, 'blank-authorization-form')
      expect(taken.phase).toBe('FORM_HELD')
      expect(taken.inventory).toEqual(['blank-terminal-authorization-form'])
      const again = act(taken, verb, 'blank-authorization-form')
      expect(again.inventory.filter((id) => id === 'blank-terminal-authorization-form')).toHaveLength(1)
      expect(again.phase).toBe('FORM_HELD')
    }
    for (const verb of ['PICK_UP', 'PULL', 'USE'] as const) {
      const machine = act(fresh(), verb, 'request-dispenser')
      expect(machine.phase).toBe('START')
      expect(machine.inventory).toEqual([])
    }
  })

  it('a review jump back to START can take the sheet once and does not stack a second copy from W03', () => {
    const held = act(fresh(), 'PICK_UP', 'blank-authorization-form')
    const reset = adventureReducer(held, { type: 'REVIEW_JUMP', phase: 'START' })
    expect(reset.inventory).not.toContain('blank-terminal-authorization-form')
    const again = act(reset, 'PICK_UP', 'blank-authorization-form')
    expect(again.inventory.filter((id) => id === 'blank-terminal-authorization-form')).toHaveLength(1)
    const machine = act(again, 'PULL', 'request-dispenser')
    expect(machine.inventory.filter((id) => id === 'blank-terminal-authorization-form')).toHaveLength(1)
    expect(machine.phase).toBe('FORM_HELD')
  })
})
