import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  INCOMPATIBLE_USE_FALLBACK_BAG,
  INVENTORY_TALK_FALLBACK_BAG,
  deadEndSpeech,
  inventoryItems,
  inventorySpeechForState,
} from '../../src/adventure/content'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureState, HotspotId, InventoryItemId, SpeechLine, VerbId } from '../../src/adventure/types'

const itemIds = Object.keys(inventoryItems) as InventoryItemId[]
const vhsPhrases = [
  'It doesn’t look like that can play VHS tapes...',
  'which may be the first piece of good news today.',
  'The terminal investigates crimes. It doesn’t play them.',
]
const dormantContainerLine = 'Whatever is inside... that is not getting it out.'
const base = (inventory: InventoryItemId[] = itemIds): AdventureState => ({
  ...createInitialAdventureState({ skipIntro: true, accessibility: { instantText: true, reducedAnimation: true } }),
  phase: 'COMPLETE', inventory, speech: null, nonblockingSpeech: null, activeSequence: null, walk: null,
})
const lines = (state: AdventureState): readonly SpeechLine[] => state.speech?.lines ?? state.nonblockingSpeech?.lines ?? []
const text = (speech: readonly SpeechLine[]) => speech.map(line => line.text).join(' ')
const fallbackUse = (speech: readonly SpeechLine[]) => speech.length === 1 && speech[0]?.authority === 'FINAL_APPROVED_FALLBACK_CONTRACT' && speech[0].copyKey?.startsWith('FALLBACK.USE.INCOMPATIBLE.V1.')
const fallbackTalk = (speech: readonly SpeechLine[]) => speech.length > 0 && speech.every(line => line.authority === 'FINAL_APPROVED_FALLBACK_CONTRACT' && line.copyKey?.startsWith('FALLBACK.TALK.INVENTORY.V1.'))
const semanticState = (state: AdventureState) => ({
  phase: state.phase, inventory: state.inventory, authorizationState: state.authorizationState,
  investigationMilestone: state.investigationMilestone, brcgInvestigationState: state.brcgInvestigationState,
  piggyNoteReadState: state.piggyNoteReadState, caseFileDrawer: state.caseFileDrawer, miscDrawer: state.miscDrawer,
  caseStack: state.caseStack, miscContents: state.miscContents, lampPower: state.lampPower,
  globeLevel: state.globeLevel, globePose: state.globePose,
})

function inventoryAction(state: AdventureState, verb: VerbId, itemId: InventoryItemId): AdventureState {
  return adventureReducer(adventureReducer(state, { type: 'SELECT_VERB', verb }), { type: 'ACT_ON_ITEM', itemId })
}
function pairUse(first: InventoryItemId, second: InventoryItemId, phase: AdventureState['phase'] = 'COMPLETE'): AdventureState {
  let state = { ...base([first, second]), phase }
  state = inventoryAction(state, 'USE', first)
  return adventureReducer(state, { type: 'ACT_ON_ITEM', itemId: second })
}
function worldUse(itemId: InventoryItemId | null, targetId: HotspotId, state = base()): AdventureState {
  let next = adventureReducer(state, { type: 'SELECT_VERB', verb: 'USE' })
  if (itemId) next = adventureReducer(next, { type: 'ACT_ON_ITEM', itemId })
  next = adventureReducer(next, { type: 'INTERACT', targetId })
  if (next.walk) next = adventureReducer(next, { type: 'WALK_TICK', delta: 10_000 })
  return next
}

describe('S17-P2-R2 exhaustive item and world routing matrix', () => {
  it('emits the complete machine-readable routing observation when evidence mode is enabled', () => {
    if (process.env.S17_P2_R2_WRITE_EVIDENCE !== '1') return
    const inventory = itemIds.map(itemId => ({
      itemId,
      talk: inventorySpeechForState(itemId, 'TALK_TO').map(line => ({ copyKey: line.copyKey, authority: line.authority, text: line.text })),
      bareUse: inventorySpeechForState(itemId, 'USE').map(line => ({ copyKey: line.copyKey, authority: line.authority, text: line.text })),
    }))
    const orderedPairs = itemIds.flatMap(first => itemIds.filter(second => second !== first).map(second => {
      const before = base([first, second])
      const result = pairUse(first, second)
      return { first, second, lastInteractionId: result.lastInteractionId, semanticStatePreserved: JSON.stringify(semanticState(result)) === JSON.stringify(semanticState(before)), inventoryAfter: result.inventory, lines: lines(result).map(line => ({ copyKey: line.copyKey, authority: line.authority, text: line.text })) }
    }))
    const terminal = itemIds.map(itemId => ({ itemId, lines: deadEndSpeech('USE', 'nansen-terminal', itemId).map(line => ({ copyKey: line.copyKey, authority: line.authority, text: line.text, sourceEvent: line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey })) }))
    const targets: HotspotId[] = ['wall-be-the-change', 'desk-lamp', 'office-globe', 'nansen-terminal']
    const world = targets.flatMap(targetId => ([null, 'sharknado-2-vhs', 'loose-feather-pen', 'approved-stamped-terminal-authorization-form'] as const).map(itemId => {
      const before = base()
      const result = worldUse(itemId, targetId, before)
      return { targetId, itemId, semanticStatePreserved: JSON.stringify(semanticState(result)) === JSON.stringify(semanticState(before)), lines: lines(result).map(line => ({ copyKey: line.copyKey, authority: line.authority, text: line.text })) }
    }))
    const report = { schemaVersion: '1.0.0', counts: { items: itemIds.length, inventoryRoutes: inventory.length * 2, orderedPairs: orderedPairs.length, terminalRoutes: terminal.length, representativeWorldRoutes: world.length }, inventory, orderedPairs, terminal, world }
    const directory = resolve('review/s17-p2-r2')
    mkdirSync(directory, { recursive: true })
    writeFileSync(resolve(directory, 'ROUTING_MATRIX.json'), `${JSON.stringify(report, null, 2)}\n`)
  })

  it('binds all 15 inventory TALK_TO routes and bare USE owners without VHS leakage', () => {
    expect(itemIds).toHaveLength(15)
    expect(new Set(INCOMPATIBLE_USE_FALLBACK_BAG)).toHaveLength(5)
    expect(new Set(INVENTORY_TALK_FALLBACK_BAG)).toHaveLength(4)
    for (const itemId of itemIds) {
      const talked = inventoryAction(base(), 'TALK_TO', itemId)
      if (itemId === 'piggy-bank-intact') expect(lines(talked)[0]?.r55Source?.eventKey ?? lines(talked)[0]?.finalScriptSource?.eventKey, itemId).toBe('COPY.A2_A4:`TALK TO PIGGY BANK`')
      else expect(fallbackTalk(lines(talked)), itemId).toBe(true)
      expect(text(lines(talked)), itemId).not.toContain(dormantContainerLine)
      expect(vhsPhrases.some(phrase => text(lines(talked)).includes(phrase)), itemId).toBe(false)

      const bareUse = inventorySpeechForState(itemId, 'USE')
      if (itemId === 'sharknado-2-vhs') expect(bareUse[0]?.r55Source?.eventKey ?? bareUse[0]?.finalScriptSource?.eventKey, itemId).toBe('COPY.INVENTORY:Invalid USE elsewhere')
      else expect(fallbackUse(bareUse), itemId).toBe(true)
    }
  })

  it('covers every ordered item-item USE pair, preserving state for generic and explicit no-op routes', () => {
    let routes = 0
    for (const first of itemIds) for (const second of itemIds) {
      if (first === second) continue
      routes += 1
      const before = base([first, second])
      const result = pairUse(first, second)
      const isPiggySmash = new Set([first, second]).has('hammer') && new Set([first, second]).has('piggy-bank-intact')
      const isBrokenSigned = new Set([first, second]).has('broken-feather-pen') && new Set([first, second]).has('signed-terminal-authorization-form-with-doodles')
      if (first === 'small-toolbox-closed') {
        expect(result.lastInteractionId, `${first}:${second}`).toBe('INTERACTION.ITEM.use-toolbox')
        expect(result.inventory, `${first}:${second}`).not.toContain('small-toolbox-closed')
        expect(result.inventory, `${first}:${second}`).toEqual(expect.arrayContaining(['small-toolbox-open-empty', 'hammer', 'nails']))
      } else if (first === 'small-toolbox-open-empty') {
        expect(result.lastInteractionId, `${first}:${second}`).toBe('INTERACTION.ITEM.use-toolbox-open')
        expect(semanticState(result), `${first}:${second}`).toEqual(semanticState(before))
      } else if (isPiggySmash) {
        expect(result.lastInteractionId, `${first}:${second}`).toBe('INTERACTION.ITEM.smash-piggy')
        expect(result.inventory, `${first}:${second}`).not.toContain('piggy-bank-intact')
        expect(result.inventory, `${first}:${second}`).toContain('fictional-token-note')
      } else {
        expect(semanticState(result), `${first}:${second}`).toEqual(semanticState(before))
        if (isBrokenSigned) expect(lines(result).map(line => line.copyKey), `${first}:${second}`).toEqual(['S17.P11.BROKEN_PEN_SIGNED_FORM'])
        else expect(fallbackUse(lines(result)), `${first}:${second}`).toBe(true)
      }
      if (!isPiggySmash && first !== 'small-toolbox-closed' && first !== 'small-toolbox-open-empty') {
        expect(text(lines(result)), `${first}:${second}`).not.toContain(dormantContainerLine)
        expect(vhsPhrases.some(phrase => text(lines(result)).includes(phrase)), `${first}:${second}`).toBe(false)
      }
    }
    expect(routes).toBe(210)
  })

  it('keeps both phase-bound and single-item custom routes ahead of generic fallback', () => {
    for (const [first, second] of [['blank-terminal-authorization-form', 'loose-feather-pen'], ['loose-feather-pen', 'blank-terminal-authorization-form']] as const) {
      const result = pairUse(first, second, 'FORM_AND_PEN')
      expect(result.lastInteractionId).toBe('INTERACTION.ITEM.combine-form-pen')
      expect(result.phase).toBe('FORM_COMPLETED')
      expect(result.inventory).toEqual(expect.arrayContaining(['signed-terminal-authorization-form-with-doodles', 'broken-feather-pen']))
    }
    const toolbox = inventoryAction(base(['small-toolbox-closed']), 'USE', 'small-toolbox-closed')
    expect(toolbox.lastInteractionId).toBe('INTERACTION.ITEM.use-toolbox')
    expect(toolbox.inventory).toEqual(expect.arrayContaining(['small-toolbox-open-empty', 'hammer', 'nails']))
  })

  it('classifies every item-to-terminal route and limits VHS and intact-pen copy to their owners', () => {
    for (const itemId of itemIds) {
      const routed = deadEndSpeech('USE', 'nansen-terminal', itemId)
      const routeText = text(routed)
      if (itemId === 'sharknado-2-vhs') {
        expect(routed[0]?.r55Source?.eventKey ?? routed[0]?.finalScriptSource?.eventKey, itemId).toBe('COPY.INVENTORY:USE with Case Terminal')
        expect(vhsPhrases.some(phrase => routeText.includes(phrase)), itemId).toBe(true)
      } else if (itemId === 'loose-feather-pen') {
        expect(routed[0]?.r55Source?.eventKey ?? routed[0]?.finalScriptSource?.eventKey, itemId).toBe('COPY.A1:USE with an incompatible target')
        expect(vhsPhrases.some(phrase => routeText.includes(phrase)), itemId).toBe(false)
      } else {
        expect(fallbackUse(routed), itemId).toBe(true)
        expect(vhsPhrases.some(phrase => routeText.includes(phrase)), itemId).toBe(false)
      }
    }
  })

  it('separates bare world USE from selected VHS, intact pen, and non-VHS items without hidden mutation', () => {
    const targets: HotspotId[] = ['wall-be-the-change', 'desk-lamp', 'office-globe', 'nansen-terminal']
    for (const targetId of targets) {
      const untouched = base()
      const bare = worldUse(null, targetId, untouched)
      expect(vhsPhrases.some(phrase => text(lines(bare)).includes(phrase)), `bare:${targetId}`).toBe(false)

      const vhs = worldUse('sharknado-2-vhs', targetId, untouched)
      expect(vhsPhrases.some(phrase => text(lines(vhs)).includes(phrase)), `vhs:${targetId}`).toBe(true)

      const pen = worldUse('loose-feather-pen', targetId, untouched)
      expect(pen["inventory"], `pen:${targetId}`).toEqual(untouched.inventory)
      expect(pen.lampPower, `pen:${targetId}`).toBe(untouched.lampPower)
      expect(pen.globeLevel, `pen:${targetId}`).toBe(untouched.globeLevel)
      expect(lines(pen)[0]?.r55Source?.eventKey ?? lines(pen)[0]?.finalScriptSource?.eventKey, `pen:${targetId}`).toBe('COPY.A1:USE with an incompatible target')

      const form = worldUse('approved-stamped-terminal-authorization-form', targetId, untouched)
      expect(fallbackUse(lines(form)), `form:${targetId}`).toBe(true)
      expect(semanticState(form), `form:${targetId}`).toEqual(semanticState(untouched))
    }
  })

  it('does not reinterpret selected-item cabinet actions as the preauthorization bare-cabinet block', () => {
    const preauth = { ...base(['approved-stamped-terminal-authorization-form']), phase: 'START' as const, authorizationState: 'PENDING' as const }
    const result = worldUse('approved-stamped-terminal-authorization-form', 'official-case-file-cabinet', preauth)
    expect(result.lastSequenceId).not.toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(fallbackUse(lines(result))).toBe(true)
    expect(semanticState(result)).toEqual(semanticState(preauth))
  })
})
