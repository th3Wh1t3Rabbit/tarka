import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { artStackOrder, layoutPaintZ, layoutPixelBox, snapCropBlur } from '../../src/adventure/sceneComposition'
import { productionComposition } from '../../src/adventure/layout6Production'
import { placedImageIdentity } from '../../src/adventure/placedImageCache'
import { buildRuntimeSession } from '../../src/adventure/runtimeSession'

describe('S12-P2C stray UI removal and remaining stability', () => {
  it('removes the floating terminal button and the exit overlay', () => {
    const app = readFileSync('src/app/App.tsx', 'utf8')
    const css = readFileSync('src/styles/a0.css', 'utf8')
    expect(app).not.toContain('case-entry')
    expect(app).not.toContain('OPEN CASE TERMINAL')
    expect(app).not.toContain('exit-lit')
    expect(app).not.toContain('Breach Rotunda exit is lit')
    expect(css).not.toContain('.case-entry')
    expect(css).not.toContain('.exit-lit')
    expect(app).toContain('hotspot-nansen-terminal')
  })

  it('publishes the window plate and does not keep a rotunda exit target', () => {
    const session = buildRuntimeSession(productionComposition)
    expect(session.targets.window?.visible).toBe(true)
    expect(session.targets.window?.lookRange).toBeGreaterThan(0)
    expect(readFileSync('src/adventure/scenes.ts', 'utf8')).not.toContain('rotunda-exit')
    expect(readFileSync('src/adventure/layout6.production.json', 'utf8')).not.toContain('rotunda-exit')
    expect(readFileSync('src/app/App.tsx', 'utf8')).not.toContain('rotunda-exit')
  })

  it('matches Layout6 paint boxes at native, 2x, and 4x', () => {
    const live = productionComposition.entities
    for (const scale of [1, 2, 4]) {
      const left = live.map((item) => ({ id: item.id, ...layoutPixelBox(item, scale), blur: item.blur, src: item.src }))
      const right = productionComposition.entities.map((item) => ({ id: item.id, ...layoutPixelBox(item, scale), blur: item.blur, src: item.src }))
      expect(left).toEqual(right)
    }
  })

  it('keeps the desk in front of Arthur and blur on the 0.05 step', () => {
    const ordered = artStackOrder(productionComposition.entities.filter((item) => item.visible))
    expect(layoutPaintZ(ordered, 'desk')).toBeGreaterThan(layoutPaintZ(ordered, 'arthur'))
    for (let step = 0; step <= 8; step += 1) expect(snapCropBlur(step * 0.05)).toBeCloseTo(step * 0.05, 5)
    expect(snapCropBlur(0.41)).toBe(0.4)
    const identity = placedImageIdentity({ src: '/art.png', width: 20, height: 16, blur: 0.1 })
    expect(placedImageIdentity({ src: '/art.png', width: 20, height: 16, blur: 0.1 })).toBe(identity)
  })
})
