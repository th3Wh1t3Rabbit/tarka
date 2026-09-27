import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { inventoryItems, itemRules, usefulRules } from '../../src/adventure/content'
import { normalizeProductionDialogue, PROVISIONAL_DELIVERY_CHARACTER_LIMIT } from '../../src/adventure/dialogueDelivery'
import { WINDOW_TARGET } from '../../src/adventure/interactionGeometry'
import { productionComposition } from '../../src/adventure/layout7Production'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { hotspots } from '../../src/adventure/scenes'
import { dialogueAdvanceDelayMs, PRINCIPAL_OPENING } from '../../src/story/s15r2/principalFeedback'
import { facingPair } from '../../src/adventure/controlPolicy'
import type { AdventureState } from '../../src/adventure/types'

const send = (state: AdventureState, action: Parameters<typeof adventureReducer>[1]) => adventureReducer(state, action)
const drain = (state: AdventureState) => {
  let next = state
  for (let guard = 0; next.speech && guard < 500; guard += 1) { next = send(next, { type: 'REVEAL_FULL' }); next = send(next, { type: 'ADVANCE_SPEECH' }) }
  return next
}

describe('S15-R4 room presentation runtime closure', () => {
  it('binds the visible window plate and corrected public labels', () => {
    expect(WINDOW_TARGET.room).toEqual({ x: 424, y: 14, width: 49, height: 106 })
    expect(Object.fromEntries(hotspots.map(row => [row.id, row.name]))).toMatchObject({
      'wall-think-outside': "'motivational' poster", 'wall-not-a-number': 'stanchion sign', 'wall-employee': 'framed workplace acknowledgement',
    })
    expect(inventoryItems['signed-terminal-authorization-form-with-doodles'].name).toBe('scribbled authorization form')
    expect(inventoryItems['approved-stamped-terminal-authorization-form'].name).toBe('approved dinosaur-doodled authorization form')
  })

  it('uses compiler-owned one-line deliveries and bounded faster timing', () => {
    const owners = [PRINCIPAL_OPENING, ...usefulRules.map(rule => normalizeProductionDialogue(rule.speech)), ...itemRules.map(rule => normalizeProductionDialogue(rule.speech))].flat()
    expect(owners.every(line => line.text.length <= PROVISIONAL_DELIVERY_CHARACTER_LIMIT)).toBe(true)
    expect(owners.some(line => line.copyKey?.includes('.provisional-'))).toBe(false)
    expect(dialogueAdvanceDelayMs({ text: 'A short delivery.' }, 'FAST')).toBeLessThan(dialogueAdvanceDelayMs({ text: 'A short delivery.' }, 'NORMAL'))
    expect(dialogueAdvanceDelayMs({ text: 'A short delivery.' }, 'NORMAL')).toBeLessThan(2800)
  })

  it('holds Arthur point through cabinet response and releases only after the segment', () => {
    let state = createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    expect(state.mrIndexFacing).toBe(facingPair(state.rookPosition.x, state.runtimeSession.arthurCenterX ?? 416).mrIndexFacing)
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.rookPose).toBe('REACH')
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.arthurPointHold).toBe(false)
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.arthurPointHold).toBe(true)
    expect(state.mrIndexFacing).toBe(facingPair(state.rookPosition.x, state.runtimeSession.arthurCenterX ?? 416).mrIndexFacing)
    expect(state.activeSequence?.waitingSpeechStage).toBe('BLOCKED_REPRIMAND')
    expect(state.speech).not.toBeNull()
    expect(state.arthurPointHold).toBe(true)
    state = drain(state)
    expect(state.arthurPointHold).toBe(true)
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.activeSequence).toBeNull()
    expect(state.arthurPointHold).toBe(false)
  })

  it('holds Arthur point through the terminal reprimand and keeps form filling out of paper-offer pose', () => {
    let state = createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'USE' }), { type: 'INTERACT', targetId: 'nansen-terminal' })
    for (let guard = 0; state.activeSequence && !state.arthurPointHold && guard < 8; guard += 1) state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.arthurPointHold).toBe(true)
    expect(state.activeSequence?.waitingSpeechStage).toBe('BLOCKED_REPRIMAND')
    expect(state.arthurPointHold).toBe(true)
    state = drain(state)
    expect(state.arthurPointHold).toBe(true)
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.arthurPointHold).toBe(false)

    state = { ...createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } }), phase: 'FORM_AND_PEN', inventory: ['blank-terminal-authorization-form', 'loose-feather-pen'] }
    state = send(state, { type: 'SELECT_VERB', verb: 'USE' }); state = send(state, { type: 'SELECT_ITEM', itemId: 'blank-terminal-authorization-form' }); state = send(state, { type: 'ACT_ON_ITEM', itemId: 'loose-feather-pen' })
    expect(state.rookPose).toBe('IDLE')
  })

  it('binds the bottom miscellaneous drawer and its matching transition frames', () => {
    const cabinet = productionComposition.entities.find(entity => entity.id === 'misc-cabinet')!
    expect(cabinet.runtimeAssetId).toBe('cabinet.misc.drawer-04')
    expect(cabinet.states.closed).toContain('/lower-drawers/drawer-04/')
    expect(cabinet.states.open).toContain('/lower-drawers/drawer-04/frames/cabinet_open__drawer_04_open.png')
    for (let index = 1; index <= 6; index += 1) expect(readFileSync(`public/art-packs/production/files/production/furniture/lower-drawers/drawer-04/frames/cabinet_open__drawer_04_phase_${String(index).padStart(2, '0')}.png`).length).toBeGreaterThan(0)
  })

  it('keeps ordinary successful drawer actions out of fallback and paper-offer poses', () => {
    let state: AdventureState = { ...createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } }), phase: 'COMPLETE' }
    state = send(send(state, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    while (state.activeSequence) state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.caseFileDrawer).toBe('OPEN')
    expect(state.lastInteractionId).toBe('INTERACTION.REQUIRED.open-case-drawer')
    expect(state.rookPose).toBe('IDLE')
    expect(state.speech).toBeNull()
    expect(state.lastInteractionId).not.toContain('DEAD_END')
  })

  it('retains clamp, no-wrap, topic, font-token, preload, transition, and exporter ownership guards', () => {
    const app = readFileSync('src/app/App.tsx', 'utf8')
    const cabinetPolicy = readFileSync('src/app/cabinetTransitionPolicy.ts', 'utf8')
    const clamp = readFileSync('src/app/useFullDeliveryClamp.ts', 'utf8')
    const css = readFileSync('src/styles/a0.css', 'utf8')
    const exporter = readFileSync('scripts/s15-r4/export-script-review.mjs', 'utf8')
    expect(clamp).toContain('Math.max(margin + half')
    expect(css).toMatch(/\.speech-panel span[^}]*white-space: nowrap/)
    expect(css).toMatch(/\.dialogue-panel \{[^}]*overflow: hidden/)
    expect(css).toContain('--a0-dialogue-font')
    expect(css).not.toContain('@media (max-width: 700px), (max-height: 520px)')
    expect(app).toContain('visibleSrc')
    expect(app).toContain('image.decode()')
    expect(app).toContain('cabinetTransitionFrames')
    expect(cabinetPolicy).toContain('Array.from({ length: 6 }')
    expect(exporter).toContain("add('PRINCIPAL_OPENING'")
  })

  it('records the exact licensed Probly8 acquisition bytes for compatibility review', () => {
    const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
    expect(digest('public/fonts/Probly8.woff2')).toBe('6d26b7b349c7c4c1a47044971b29173f4e1d3dcb9059d275085d56036b350b47')
    expect(digest('public/fonts/Probly8_License.txt')).toBe('6b4a08658dfd7919e08a6a8f34afed0a1fcce07a9e12b60e18e013dfa9ecb8b2')
    expect(readFileSync('public/fonts/Probly8_License.txt', 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1')
  })
})
