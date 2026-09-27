import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { usefulRules } from '../../src/adventure/content'
import { LAYOUT7_APPROVAL, productionComposition, productionCompositionBody } from '../../src/adventure/layout7Production'
import { productionComposition as layout6 } from '../../src/adventure/layout6Production'
import { getSceneDefinition } from '../../src/adventure/scenes'
import { layoutHotspotPixels, layoutPixelBox, readOnlyHotspots, renderHeight } from '../../src/adventure/sceneComposition'

const LAYOUT6_FILE = 'src/adventure/layout6.production.json'
const LAYOUT6_LIBRARY = 'tests/fixtures/s12-p2-layout6-library.json'
const DONOR = 'tests/fixtures/s12-layout7-principal-donor.json'

function boxContains(outer: { left: number; top: number; width: number; height: number }, x: number, y: number) {
  return x >= outer.left && x < outer.left + outer.width && y >= outer.top && y < outer.top + outer.height
}

describe('S12 Layout7 source binding', () => {
  it('seals Layout7 and keeps Layout6 byte-for-byte', () => {
    expect(createHash('sha256').update(readFileSync(LAYOUT6_FILE)).digest('hex')).toBe('7fe45fa19902b5b23c83b0ca382e945f00bc0e19b698a96ce0e7256b82976ad8')
    expect(createHash('sha256').update(readFileSync(LAYOUT6_LIBRARY)).digest('hex')).toBe('15892c771a479941923c6b3f7fd800cf81345d756c46d9946600093b7e67ed5c')
    expect(productionComposition.principalDisposition).toBe('PRINCIPAL_EXPORTED')
    expect(productionComposition.schema).toBe(layout6.schema)
    expect(productionComposition.parentCommit).toBe(layout6.parentCommit)
    expect(productionComposition.artArchiveSha256).toBe(layout6.artArchiveSha256)
    expect(productionComposition.topManifestSha256).toBe(layout6.topManifestSha256)
    expect(productionComposition.room).toEqual(layout6.room)
    expect(productionComposition.hotspots).toEqual(readOnlyHotspots())
    expect(createHash('sha256').update(productionCompositionBody()).digest('hex')).toBe(productionComposition.contentSha256)
    expect(LAYOUT7_APPROVAL).toEqual({
      name: 'SCENE_COMPOSITION_PRINCIPAL',
      versionId: 'layout-1790193367475-39rhwq',
      savedAt: '2026-09-23T19:56:07.475Z',
      inputSha256: '9245df2b66e359652ddbad36f548e39fff09e8003473b8936ded067c8481f3e3',
    })
  })

  it('changes exactly the seven admitted visual fields', () => {
    const before = new Map(layout6.entities.map((entity) => [entity.id, entity]))
    const after = new Map(productionComposition.entities.map((entity) => [entity.id, entity]))
    expect([...after.keys()]).toEqual([...before.keys()])
    const changed: string[] = []
    for (const [id, entity] of after) {
      const prior = before.get(id)!
      const fields = ['x', 'y', 'z', 'renderWidth', 'visible', 'blur', 'state', 'mirror', 'src', 'sourceWidth', 'sourceHeight'] as const
      for (const field of fields) {
        if (entity[field] !== prior[field]) changed.push(`${id}.${field}`)
      }
      expect(renderHeight(entity)).toBeGreaterThan(0)
    }
    expect(changed.sort()).toEqual(['arthur-stamp.y', 'blank-form.y', 'globe.x', 'lamp.y', 'terminal.renderWidth', 'terminal.x', 'terminal.y'])
    expect(after.get('terminal')).toMatchObject({ x: 346, y: 102, renderWidth: 38 })
    expect(before.get('terminal')!.renderWidth).toBe(36)
  })

  it('keeps W04 as the form owner and does not let the moved pictures steal a neighbor target', () => {
    expect(usefulRules.find((rule) => rule.id === 'take-form')).toMatchObject({ verb: 'PICK_UP', targetId: 'blank-authorization-form' })
    expect(usefulRules.find((rule) => rule.id === 'take-form-2')).toMatchObject({ verb: 'PICK_UP', targetId: 'blank-authorization-form' })
    expect(usefulRules.some((rule) => rule.targetId === 'request-dispenser' && rule.addItems?.includes('blank-terminal-authorization-form'))).toBe(false)
    const source = getSceneDefinition('records-office').hotspots
    expect(productionComposition.hotspots.map((hotspot) => [hotspot.id, hotspot.polygon, hotspot.walkTo.x, hotspot.walkTo.y])).toEqual(source.map((hotspot) => [hotspot.id, hotspot.polygon, hotspot.walkTo.x, hotspot.walkTo.y]))
    for (const id of ['blank-authorization-form', 'request-dispenser', 'office-globe', 'nansen-terminal']) {
      expect(layoutHotspotPixels(productionComposition, id, 2)).not.toBeNull()
    }
    const miscCabinet = layoutHotspotPixels(productionComposition, 'miscellaneous-drawer-cabinet', 2)!
    const miscContents = layoutHotspotPixels(productionComposition, 'miscellaneous-catch-all-contents', 2)!
    expect((miscContents.top - miscCabinet.top) / miscCabinet.height).toBeCloseTo(.63, 1)
    expect(miscContents.top + miscContents.height).toBeLessThanOrEqual(miscCabinet.top + miscCabinet.height)
    const terminal = layoutPixelBox(productionComposition.entities.find((entity) => entity.id === 'terminal')!, 2)
    for (const hotspot of source) {
      if (hotspot.id === 'nansen-terminal') continue
      const pixels = layoutHotspotPixels(productionComposition, hotspot.id, 2)
      if (!pixels) continue
      const centerX = pixels.left + pixels.width / 2
      const centerY = pixels.top + pixels.height / 2
      expect(boxContains(terminal, centerX, centerY), hotspot.id).toBe(false)
    }
  })

  it('matches the approved donor on every painted entity field', () => {
    expect(createHash('sha256').update(readFileSync(DONOR)).digest('hex')).toBe(LAYOUT7_APPROVAL.inputSha256)
    const donor = JSON.parse(readFileSync(DONOR, 'utf8')) as { entities: typeof productionComposition.entities }
    const painted = ['x', 'y', 'z', 'renderWidth', 'visible', 'blur', 'state', 'mirror', 'src'] as const
    expect(donor.entities.map((entity) => [entity.id, ...painted.map((field) => entity[field])])).toEqual(productionComposition.entities.map((entity) => [entity.id, ...painted.map((field) => entity[field])]))
  })
})
