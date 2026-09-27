import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { deadEndSpeech } from '../../src/adventure/content'
import { deriveWindowRoom, WINDOW_TARGET } from '../../src/adventure/interactionGeometry'
import { productionComposition } from '../../src/adventure/layout7Production'
import { PRODUCTION_PHYSICAL_CHOREOGRAPHY, completePhysicalCoverage } from '../../src/adventure/physicalChoreography'
import { PRODUCTION_WINDOW_LAYOUT } from '../../src/adventure/productionWindowLayout'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureAction, AdventureState, HotspotId, VerbId } from '../../src/adventure/types'

const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
function begin(state: AdventureState, verb: VerbId, targetId: HotspotId) {
  let next = send(send({ ...state, speech: null, nonblockingSpeech: null }, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId })
  if (next.walk) next = send(next, { type: 'WALK_TICK', delta: 10_000 })
  return next
}
function finish(state: AdventureState) {
  let next = state
  for (let guard = 0; next.activeSequence && guard < 20; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  if (next.activeSequence) throw Error('sequence did not finish')
  return next
}
function toContact(state: AdventureState, contact: string) {
  let next = state
  for (let guard = 0; next.activeSequence && next.lastSemanticContact !== contact && guard < 20; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  return next
}
const complete = (): AdventureState => ({ ...createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } }), phase: 'COMPLETE' })

describe('S15-R5 truthful room interaction closure', () => {
  it('R5-01a mutates miscellaneous OPEN only at empty-hand contact and stays silent', () => {
    let state = begin(complete(), 'OPEN', 'miscellaneous-drawer-cabinet')
    expect(state).toMatchObject({ miscDrawer: 'CLOSED', rookPose: 'IDLE', speech: null, nonblockingSpeech: null })
    expect(state.activeSequence?.pendingStateChangeRule).toBe('required.open-misc-drawer')
    const repeated = send(state, { type: 'INTERACT', targetId: 'miscellaneous-drawer-cabinet' })
    expect(repeated).toEqual(state)
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state).toMatchObject({ miscDrawer: 'CLOSED', rookPose: 'REACH' })
    state = toContact(state, 'CONTACT.DRAWER.MISC.OPEN')
    expect(state).toMatchObject({ miscDrawer: 'OPEN', lastSemanticContact: 'CONTACT.DRAWER.MISC.OPEN', rookPose: 'REACH' })
    state = finish(state)
    expect(state).toMatchObject({ miscDrawer: 'OPEN', speech: null, nonblockingSpeech: null, rookPose: 'IDLE' })
  })

  it('R5-01b mutates case CLOSE only at contact and never emits the dead-end close line', () => {
    let state = begin({ ...complete(), caseFileDrawer: 'OPEN' }, 'CLOSE', 'official-case-file-cabinet')
    expect(state.caseFileDrawer).toBe('OPEN')
    state = toContact(state, 'CONTACT.DRAWER.CASE.CLOSED')
    expect(state.caseFileDrawer).toBe('CLOSED')
    state = finish(state)
    expect(state.speech ?? state.nonblockingSpeech).toBeNull()
    expect(deadEndSpeech('CLOSE', 'official-case-file-cabinet', null, { ...state, caseFileDrawer: 'CLOSED' }).map(line => line.text)).toEqual(['It’s already closed.'])
  })

  it('R5-01c gives all twelve successful drawer variants one silent contact mutation owner', () => {
    const rows = PRODUCTION_PHYSICAL_CHOREOGRAPHY.filter(row => row.routeId.startsWith('required.') && row.routeId.includes('drawer') && row.classification === 'EMPTY_HAND_CONTACT')
    expect(rows).toHaveLength(12)
    expect(rows.every(row => row.poseClass === 'EMPTY_HAND_REACH' && row.contactId?.startsWith('CONTACT.DRAWER.') && row.postContactSpeechOwner === 'SILENT_STATE_CHANGE')).toBe(true)
  })

  it('R5-02a toggles the lamp after empty-hand contact and publishes speech afterward', () => {
    let state = begin(complete(), 'USE', 'desk-lamp')
    expect(state).toMatchObject({ lampPower: 'ON', lampSpeech: 0, nonblockingSpeech: null })
    state = send(send(state, { type: 'ADVANCE_SEQUENCE' }), { type: 'ADVANCE_SEQUENCE' })
    expect(state).toMatchObject({ lampPower: 'ON', rookPose: 'REACH' })
    state = toContact(state, 'CONTACT.LAMP.TOGGLE')
    expect(state).toMatchObject({ lampPower: 'OFF', lampSpeech: 1, lastSemanticContact: 'CONTACT.LAMP.TOGGLE' })
    expect(state.nonblockingSpeech).toBeNull()
    state = finish(state)
    expect(state.nonblockingSpeech?.lines.length).toBeGreaterThan(0)
  })

  it('R5-02b drives globe PUSH/PULL/USE through registered empty-hand contacts', () => {
    for (const verb of ['PUSH', 'PULL', 'USE'] as const) {
      const route = PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.routeId === `dynamic.globe.${verb.toLowerCase()}`)!
      let state = begin(complete(), verb, 'office-globe')
      expect(state.globeMotion).toBe('IDLE')
      state = toContact(state, route.contactId!)
      expect(state).toMatchObject({ globeMotion: 'SPINNING', lastSemanticContact: route.contactId, rookPose: 'REACH' })
    }
  })

  it('R5-02c exposes complete typed classifications without a test-owned route duplicate', () => {
    const coverage = completePhysicalCoverage({ phase: 'COMPLETE' })
    expect(coverage).toHaveLength(189)
    expect(new Set(PRODUCTION_PHYSICAL_CHOREOGRAPHY.map(row => row.classification))).toEqual(new Set(['EMPTY_HAND_CONTACT', 'ITEM_CONTACT', 'PAPER_HANDOFF']))
    expect(PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.routeId === 'required.give-form')).toMatchObject({ classification: 'PAPER_HANDOFF', poseClass: 'PAPER_REACH' })
    expect(PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.routeId === 'required.pickup-case-stack')).toMatchObject({ classification: 'ITEM_CONTACT', poseClass: 'EMPTY_HAND_REACH', animation: { clipId: 'rook.reach.neutral' } })
  })

  it('R5-03 derives the window from cabinet, viewport, and stanchion geometry', () => {
    const cabinetRight = Math.max(...productionComposition.entities.filter(row => row.hotspotId?.includes('drawer-cabinet') || row.hotspotId === 'official-case-file-cabinet').map(row => row.x + row.renderWidth))
    const stanchion = productionComposition.entities.find(row => row.id === 'bg-sign-you-are-not-a-number')!
    const projectedCabinets = productionComposition.entities.filter(row => PRODUCTION_WINDOW_LAYOUT.cabinets.some(cabinet => cabinet.id === row.id)).map(row => ({ id: row.id, x: row.x, renderWidth: row.renderWidth }))
    expect(PRODUCTION_WINDOW_LAYOUT).toEqual({ roomWidth: productionComposition.room.width, cabinets: projectedCabinets, stanchion: { id: stanchion.id, x: stanchion.x, y: stanchion.y, sourceWidth: stanchion.sourceWidth, sourceHeight: stanchion.sourceHeight, renderWidth: stanchion.renderWidth } })
    expect(deriveWindowRoom()).toEqual(WINDOW_TARGET.room)
    expect(WINDOW_TARGET.room).toEqual({ x: cabinetRight + 3, y: 14, width: 480 - 7 - (cabinetRight + 3), height: Math.round(stanchion.y + (stanchion.renderWidth * stanchion.sourceHeight / stanchion.sourceWidth) / 2) - 14 })
    expect(WINDOW_TARGET.room).toEqual({ x: 424, y: 14, width: 49, height: 106 })
  })

  it('R5-03b keeps the stanchion above the shared window overlap', () => {
    const css = readFileSync('src/styles/a0.css', 'utf8')
    expect(css).toMatch(/hotspot-wall-not-a-number[^}]*z-index:\s*31\s*!important/)
  })

  it('R5-04 reserves full delivery text and recomputes one shared clamp owner', () => {
    const presentation = readFileSync('src/app/GameDialoguePresentation.tsx', 'utf8')
    const clamp = readFileSync('src/app/useFullDeliveryClamp.ts', 'utf8')
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(presentation).toContain('className="full-delivery-measure"')
    expect(clamp).toContain('fullDelivery.scrollWidth')
    expect(presentation).not.toContain('visibleDelivery(line, visibleCharacters).getBoundingClientRect')
    expect(clamp).toContain('new ResizeObserver(recompute)')
    expect(clamp).toContain('fonts.ready.then(recompute)')
    expect(clamp).toContain("fonts.addEventListener?.('loadingdone', recompute)")
    expect(app).toContain('useFullDeliveryClamp(line.text, desiredStyle.left)')
  })

  it('R5-05 refuses broad unbound evidence and declares all twelve mutation probes', () => {
    const requirements = JSON.parse(readFileSync('scripts/s15-r5/requirements.json', 'utf8')) as { requirements: Array<{ id: string; testId: string; expectedObservation: string }>; mutations: Array<{ id: string; targetTestId: string }> }
    expect(new Set(requirements.requirements.map(row => row.id)).size).toBe(requirements.requirements.length)
    expect(requirements.requirements.every(row => row.testId.startsWith('s15-r5:') && row.expectedObservation.length > 12)).toBe(true)
    expect(requirements.mutations).toHaveLength(12)
    expect(requirements.mutations.every(row => row.targetTestId.startsWith('s15-r5:'))).toBe(true)
    expect(JSON.stringify(requirements.requirements)).not.toMatch(/GATE_EXIT|broad suite boolean/i)
  })

  it('R5-06 binds complete route registers and backward-compatible delivery IDs', () => {
    const exporter = readFileSync('scripts/s15-r5/export-script-review.mjs', 'utf8')
    expect(exporter).toContain('TARKA_DELIVERY_ID_COMPATIBILITY.csv')
    expect(exporter).toContain('R55_ACTUAL_ACTION_MATRIX')
    expect(exporter).toContain('TERMINAL_PENDING_S16')
    expect(exporter).toContain('hotspots.flatMap')
    expect(exporter).toContain('inventoryItems')
    expect(exporter).toContain('one_line_fit')
  })
})
