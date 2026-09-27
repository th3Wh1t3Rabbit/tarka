import { describe, expect, it } from 'vitest'
import { blockedInteractions, deadEndSpeech, hotspots, inventoryItems, inventorySpeechForState, itemRules } from '../../src/adventure/content'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { finalSpeechByEvent } from '../../src/story/s17/finalScript'
import type { AdventureState, InventoryItemId, SpeechLine } from '../../src/adventure/types'

const itemIds = Object.keys(inventoryItems) as InventoryItemId[]
const texts = (lines: readonly SpeechLine[]) => lines.map(line => line.text)
const keys = (lines: readonly SpeechLine[]) => lines.map(line => line.copyKey ?? line.finalScriptSource?.sourceNodeId)
const base = (): AdventureState => ({
  ...createInitialAdventureState({ skipIntro: true, accessibility: { instantText: true, reducedAnimation: true } }),
  phase: 'COMPLETE',
  inventory: [...itemIds],
})

describe('S17-P2-R3 runtime sanitation invariants', () => {
  it('binds closed-toolbox OPEN and direct USE to the same exact seven-bubble authority', () => {
    const approved = finalSpeechByEvent('COPY.A2_A4:`OPEN` or `USE` toolbox')
    const open = itemRules.find(rule => rule.id === 'open-toolbox')!
    const use = itemRules.find(rule => rule.id === 'use-toolbox')!
    expect(approved).toHaveLength(7)
    expect(keys(open.speech)).toEqual(keys(approved))
    expect(texts(open.speech)).toEqual(texts(approved))
    expect(keys(use.speech)).toEqual(keys(approved))
    expect(texts(use.speech)).toEqual(texts(approved))
  })

  it('keeps the represented open-empty toolbox state while restoring the approved pink-clip close copy', () => {
    const state = base()
    const before = [...state.inventory]
    const speech = inventorySpeechForState('small-toolbox-open-empty', 'CLOSE', state)
    expect(texts(speech)).toEqual([
      'Closed tight.',
      'The little pink plastic clips snapped right into place.',
    ])
    expect(state.inventory).toEqual(before)
    expect(state.inventory).toContain('small-toolbox-open-empty')
  })

  it('uses the exact three-bubble broken-pen refusal for both blocked routes', () => {
    const approved = finalSpeechByEvent('COPY.A1:GIVE to Arthur or attempt to return/use with inkwell')
    expect(texts(approved)).toEqual([
      'Umm... I think I’ll hang onto this for now.',
      'I don’t want to upset Arthur.',
      'He already seems to have a bad case of the Mondays.',
    ])
    for (const blocked of blockedInteractions) {
      expect(texts(blocked.speech ?? [])).toEqual(texts(approved))
      expect(keys(blocked.speech ?? [])).toEqual(keys(approved))
    }
  })

  it('never lets selected-item GIVE borrow target-only ownership copy', () => {
    for (const itemId of itemIds) for (const target of hotspots) {
      const result = deadEndSpeech('GIVE', target.id, itemId, base())
      const copy = texts(result).join(' ')
      expect(copy, `${itemId} -> ${target.id}`).not.toBe('It’s not mine to give.')
      expect(copy, `${itemId} -> ${target.id}`).not.toMatch(/bolted to the desk/i)
      expect(result.length, `${itemId} -> ${target.id}`).toBeGreaterThan(0)
    }
  })

  it('keeps structural source quotes and provisional identities out of corrected live families', () => {
    const families: SpeechLine[][] = [
      ...(['OPEN', 'CLOSE', 'PUSH', 'PULL'] as const).map(verb => inventorySpeechForState('rubber-band', verb)),
      itemRules.find(rule => rule.id === 'use-toolbox')!.speech,
      itemRules.find(rule => rule.id === 'use-toolbox-open')!.speech,
      itemRules.find(rule => rule.id === 'open-toolbox-open')!.speech,
      ...blockedInteractions.map(blocked => blocked.speech ?? []),
    ]
    for (const line of families.flat()) {
      expect(line.copyKey ?? '', line.text).not.toContain('.provisional-')
      expect(line.text, line.copyKey).not.toMatch(/^“.*”$/s)
      expect(line.text, line.copyKey).not.toMatch(/^".*"$/s)
    }
  })

  it('clears or visibly replaces inventory selections without ghost interactions', () => {
    let state: AdventureState = { ...base(), selectedVerb: 'GIVE', selectedItemId: 'rubber-band' }
    state = adventureReducer(state, { type: 'ACT_ON_ITEM', itemId: 'rubber-band' })
    expect(state.selectedItemId).toBeNull()
    expect(state.speech).toBeNull()

    state = { ...base(), selectedVerb: 'GIVE', selectedItemId: 'rubber-band' }
    state = adventureReducer(state, { type: 'ACT_ON_ITEM', itemId: 'rubiks-cube' })
    expect(state.selectedItemId).toBe('rubiks-cube')
    expect(state.selectedVerb).toBe('GIVE')
    expect(state.speech).toBeNull()
    expect(state.lastInteractionId).toBeNull()

    state = { ...base(), selectedVerb: 'PICK_UP', selectedItemId: 'rubber-band' }
    state = adventureReducer(state, { type: 'ACT_ON_ITEM', itemId: 'rubiks-cube' })
    expect(state.selectedItemId).toBeNull()
    expect(state.selectedVerb).toBeNull()
  })
})
