import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { productionComposition, productionCompositionBody } from '../../src/adventure/layout6Production'
import { layoutPixelBox, readDefaultLayout, renderHeight } from '../../src/adventure/sceneComposition'
import { ABSENT_NO_HOTSPOT, NON_HOTSPOT_SET_DRESSING, STRUCTURAL_HOTSPOTS, STRUCTURAL_INVENTORY, structuralOwners } from '../../src/adventure/structuralRegister'

const LAYOUT6_GEOMETRY = [
  ['arthur', 206, 75, 160, 48, true, 0],
  ['arthur-stamp', 205, 124, 220, 10, true, 0],
  ['bg-painting-city-bridge', 188, 36, 10, 76, true, 0.05],
  ['bg-plaque-employee-of-the-month', 153, 71, 20, 30, true, 0.1],
  ['bg-plaque-preserve-serve-remember', 268, 75, 30, 27, true, 0],
  ['bg-poster-be-the-change', 6, 12, 40, 55, true, 0.1],
  ['bg-poster-think-outside-the-box', 63, 12, 50, 40, true, 0],
  ['bg-print-building', 270, 37, 60, 25, true, 0],
  ['bg-sign-records-office', 328, 42, 70, 70, true, 0],
  ['bg-sign-you-are-not-a-number', 445, 107, 80, 32, true, 0],
  ['bg-wall-clock', 137, 18, 90, 37, true, 0.1],
  ['blank-form', 14, 128, 120, 12, true, 0],
  ['books-tall', 90, 134, 110, 16, false, 0],
  ['desk', 172, 123, 170, 107, true, 0],
  ['dispenser', 3, 104, 110, 36, true, 0],
  ['globe', 117, 81, 190, 23, true, 0],
  ['lamp', 181, 100, 180, 22, true, 0],
  ['misc-cabinet', 303, 104, 130, 50, true, 0],
  ['mug', 245, 116, 200, 14, true, 0],
  ['official-cabinet', 371, 102, 140, 50, true, 0],
  ['penstand', 260, 118, 210, 12, true, 0],
  ['rook', 52, 90, 230, 48, true, 0],
  ['shelf', 104, 105, 100, 48, true, 0],
  ['terminal', 347, 105, 150, 36, true, 0],
] as const

describe('S12-P2A Layout6 production binding', () => {
  it('reproduces Layout6 entity geometry and seals one content hash', () => {
    const composition = productionComposition
    expect(composition.entities).toHaveLength(24)
    const form = composition.entities.find((item) => item.id === 'blank-form')
    expect(form).toMatchObject({ x: 14, y: 128, z: 120, renderWidth: 12, visible: true })
    for (const [id, x, y, z, renderWidth, visible, blur] of LAYOUT6_GEOMETRY) {
      const entity = composition.entities.find((item) => item.id === id)
      expect(entity, id).toMatchObject({ x, y, z, renderWidth, visible, blur })
      expect(renderHeight(entity!)).toBeGreaterThan(0)
    }
    const digest = createHash('sha256').update(productionCompositionBody(composition)).digest('hex')
    expect(digest).toBe(composition.contentSha256)
    const library = JSON.parse(readFileSync('tests/fixtures/s12-p2-layout6-library.json', 'utf8')) as { versions: { id: string; composition: { entities: typeof composition.entities } }[] }
    expect(createHash('sha256').update(readFileSync('tests/fixtures/s12-p2-layout6-library.json')).digest('hex')).toBe('15892c771a479941923c6b3f7fd800cf81345d756c46d9946600093b7e67ed5c')
    const saved = library.versions.find((version) => version.id === 'layout-1790118912943-nbarbu')!.composition.entities
    expect(saved.map((item) => [item.id, item.x, item.y, item.z, item.renderWidth, item.visible, item.blur, item.state])).toEqual(composition.entities.map((item) => [item.id, item.x, item.y, item.z, item.renderWidth, item.visible, item.blur, item.state]))
  })

  it('keeps production geometry when a development library default changes', () => {
    const production = productionComposition.entities.map((item) => layoutPixelBox(item, 1))
    const shifted = readDefaultLayout({
      getItem: () => JSON.stringify({ versions: [], defaultVersionId: null }),
      setItem: () => undefined,
      removeItem: () => undefined,
    })
    expect(shifted).toBeNull()
    expect(productionComposition.entities.map((item) => layoutPixelBox(item, 1))).toEqual(production)
    expect(productionComposition.entities.map((item) => layoutPixelBox(item, 2)).every((box) => Number.isInteger(box.left) && Number.isInteger(box.top))).toBe(true)
    expect(productionComposition.entities.map((item) => layoutPixelBox(item, 4)).every((box) => Number.isInteger(box.width))).toBe(true)
  })

  it('maps each W and I identity once and leaves absent identities without a runtime owner', () => {
    expect(STRUCTURAL_HOTSPOTS.map((row) => row.r55Id)).toEqual(Array.from({ length: 24 }, (_, index) => `W${String(index + 1).padStart(2, '0')}`))
    expect(STRUCTURAL_INVENTORY.map((row) => row.r55Id)).toEqual(Array.from({ length: 14 }, (_, index) => `I${String(index + 1).padStart(2, '0')}`))
    expect(structuralOwners().size).toBe(STRUCTURAL_HOTSPOTS.filter((row) => row.runtimeId).length)
    expect(ABSENT_NO_HOTSPOT).toEqual(['TROPHY_IMAGE', 'ENTRY_OR_EXIT_DOOR'])
    expect(NON_HOTSPOT_SET_DRESSING).toContain('DESK_SURFACE')
    expect(STRUCTURAL_HOTSPOTS.find((row) => row.r55Id === 'W20')?.runtimeId).toBe('window')
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).toContain('import.meta.env.DEV ? readDefaultLayout() ?? productionComposition : productionComposition')
    expect(app).not.toContain('readDefaultLayout() : null')
  })
})
