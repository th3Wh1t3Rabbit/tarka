import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState, terminalIsPowered } from '../../src/adventure/reducer'
import { displayCommandSentence } from '../../src/adventure/sentence'
import { clickWalkPoint, recordsOfficeHotspots, WALK_Y_MAX, WALK_Y_MIN } from '../../src/adventure/scenes'
import { MISC_CABINET_ART, OFFICIAL_CABINET_ART, snapGameToScenePixel } from '../../src/adventure/renderContract'
import { artStackOrder } from '../../src/adventure/sceneComposition'

function box(polygon: string) {
  const points = polygon.split(' ').map((pair) => pair.split(',').map(Number))
  const xs = points.map(([x]) => x ?? 0)
  const ys = points.map(([, y]) => y ?? 0)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function contains(outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}

describe('player-facing surface corrections', () => {
  it('keeps each hotspot on its object instead of a wall-sized rectangle', () => {
    const boxes = Object.fromEntries(recordsOfficeHotspots.map((hotspot) => [hotspot.id, box(hotspot.polygon)]))
    expect(boxes['filing-drawers']).toMatchObject({ x: 48, y: 136, w: 100, h: 110 })
    expect(boxes['historical-clock']!.y).toBeLessThan(80)
    expect(boxes['historical-clock']!.h).toBeLessThan(90)
    expect(boxes['office-globe']!.w).toBeLessThanOrEqual(50)
    expect(boxes['office-globe']!.x).toBeGreaterThan(370)
    expect(boxes['office-globe']!.x + boxes['office-globe']!.w).toBeLessThan(450)
    expect(boxes['window']!.x).toBe(808)
    expect(boxes['window']!.y).toBe(32)
    expect(boxes['mr-index']!.h).toBeLessThanOrEqual(160)
    expect(contains(boxes['official-case-file-cabinet']!, boxes['disorderly-stack-of-confidential-files']!)).toBe(true)
    expect(contains(boxes['miscellaneous-drawer-cabinet']!, boxes['miscellaneous-catch-all-contents']!)).toBe(true)
    for (const hotspot of recordsOfficeHotspots) {
      const area = boxes[hotspot.id]!.w * boxes[hotspot.id]!.h
      expect(area).toBeLessThan(160 * 160)
    }
    expect(OFFICIAL_CABINET_ART).toEqual({ x: 610, y: 158, width: 112, height: 134 })
    expect(MISC_CABINET_ART).toEqual({ x: 730, y: 164, width: 108, height: 130 })
  })

  it('keeps Rook feet in a 15px band just below the wall-floor line', () => {
    expect(WALK_Y_MAX - WALK_Y_MIN).toBe(25)
    expect(WALK_Y_MAX).toBe(365)
    const fresh = () => createInitialAdventureState({ skipIntro: true })
    expect(terminalIsPowered(fresh())).toBe(false)
    expect(terminalIsPowered({ inventory: ['approved-stamped-terminal-authorization-form'] })).toBe(true)
    const picked = adventureReducer(adventureReducer({ ...fresh(), reducedAnimation: true }, { type: 'SELECT_VERB', verb: 'PICK_UP' }), { type: 'INTERACT', targetId: 'blank-authorization-form' })
    expect(picked.inventory).toContain('blank-terminal-authorization-form')
    expect(picked.phase).toBe('FORM_HELD')
    const high = adventureReducer(fresh(), { type: 'WALK_TO', point: { x: 400, y: 10 } })
    const low = adventureReducer(fresh(), { type: 'WALK_TO', point: { x: 400, y: 400 } })
    expect(high.walk?.to.y).toBe(WALK_Y_MIN)
    expect(low.walk?.to.y).toBe(WALK_Y_MAX)
    const inside = adventureReducer({ ...fresh(), rookPosition: { x: 300, y: 348 }, walk: null }, { type: 'WALK_TO', point: { x: 520, y: 340 } })
    expect(inside.walk?.to).toEqual({ x: 520, y: 340 })
    expect(inside.walk?.path).toEqual([{ x: 300, y: 348 }, { x: 520, y: 340 }])
    const aimed = clickWalkPoint(100, 340, 960, 360)
    expect(aimed.y).toBe(350)
    const stood = adventureReducer(fresh(), { type: 'WALK_TO', point: aimed })
    expect(stood.walk?.to.y).toBe(350)
    for (const hotspot of recordsOfficeHotspots) {
      expect(hotspot.walkTo.y).toBeGreaterThanOrEqual(WALK_Y_MIN)
      expect(hotspot.walkTo.y).toBeLessThanOrEqual(WALK_Y_MAX)
    }
  })

  it('shows an inventory item name in the command bar only while that item is hovered', () => {
    const state = createInitialAdventureState({ skipIntro: true })
    expect(displayCommandSentence(state, null)).toBe('Walk to')
    expect(displayCommandSentence(state, 'Euler case file')).toBe('Euler case file')
    expect(displayCommandSentence({ ...state, selectedVerb: 'LOOK_AT' }, 'loose feather pen')).toBe('loose feather pen')
  })

  it('hides the system cursor across the play frame and fills inventory slots with art', () => {
    const css = readFileSync('src/styles/a0.css', 'utf8')
    expect(css).toContain('.a0-frame, .a0-frame * { cursor: none !important; }')
    expect(css).toContain('.cross-cursor { position: absolute; z-index: 1100;')
    expect(css).toContain('.character.walking { animation: none; }')
    expect(css).toContain('2px 0 0 #071014, -2px 0 0 #071014')
    expect(css).toContain('.nonblocking-speech.overhead-line button { position: absolute; inset: 0;')
    expect(css).toContain('.talk-advance-catch { position: absolute; inset: 0; z-index: 28;')
    expect(readFileSync('src/app/App.tsx', 'utf8')).toContain("state.speech?.returnTo === 'DIALOGUE' && <button type=\"button\" className=\"talk-advance-catch\"")
    expect(snapGameToScenePixel(100.4, 2)).toBe(100)
    expect(snapGameToScenePixel(101, 5)).toBe(101.2)
    expect(css).toContain('.inventory-slot img { width: calc(24px * var(--a0-scale, 1)); height: calc(24px * var(--a0-scale, 1)); max-width: none; max-height: none; object-fit: contain;')
    expect(css).not.toContain('.inventory-slot span')
    expect(css).toContain('.dialogue-panel { position: absolute; z-index: 31; left: 0; right: 0; top: 66.6666666667%; height: 33.3333333333%; display: flex; flex-direction: column; align-items: flex-start;')
    expect(css).toContain(".dialogue-panel button { width: auto; min-height: 0; border: 0; background: transparent; color: var(--a0-cyan); cursor: pointer; text-align: left; padding: 0; font: 700 1.25em 'SFMono-Regular', Consolas, monospace; letter-spacing: .08em; }")
    expect(css).toContain('.contrast-hotspots .hotspot-polygons polygon:not(.walk-region) { fill: none;')
    expect(css).toContain('.scene-art { position: absolute; inset: 0; z-index: 1; isolation: isolate;')
    expect(css).toContain('.character.rook { z-index: 8; }')
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).toContain('zIndex: isRook ? 8 : placement?.zIndex ?? depthAt(scene, position.y)')
    expect(app).toContain('cursor_hover_green.png')
    const order = artStackOrder([
      { id: 'rook', z: 0 },
      { id: 'desk', z: 1 },
      { id: 'arthur', z: 9 },
      { id: 'mug', z: 4 },
    ])
    expect(order.map((item) => item.id)).toEqual(['mug', 'arthur', 'desk', 'rook'])
  })
})
