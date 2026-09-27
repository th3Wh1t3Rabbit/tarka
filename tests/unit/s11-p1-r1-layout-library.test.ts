import { describe, expect, it } from 'vitest'
import { CROP_BLUR_MAX, CROP_BLUR_STEP, artStackOrder, importComposition, layoutEntitySrc, layoutGameBox, layoutHotspotPixels, layoutHotspotWalkTo, layoutPaintZ, layoutPixelBox, layoutStackZ, paintOrderFromFront, readDefaultLayout, readLayoutLibrary, referenceComposition, removeLayoutVersion, saveLayoutVersion, setDefaultLayoutVersion, snapCropBlur, withCatalogEntities, type LayoutStore } from '../../src/adventure/sceneComposition'

function memoryStore(): LayoutStore {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

describe('layout versions and crop blur', () => {
  it('snaps crop blur to 0.05 steps and stops at 0.40', () => {
    expect(CROP_BLUR_STEP).toBe(0.05)
    expect(CROP_BLUR_MAX).toBe(0.4)
    expect(snapCropBlur(0)).toBe(0)
    expect(snapCropBlur(0.02)).toBe(0)
    expect(snapCropBlur(0.05)).toBe(0.05)
    expect(snapCropBlur(0.07)).toBe(0.05)
    expect(snapCropBlur(0.35)).toBe(0.35)
    expect(snapCropBlur(0.4)).toBe(0.4)
    expect(snapCropBlur(0.5)).toBe(0.4)
    expect(snapCropBlur(8)).toBe(0.4)
  })

  it('keeps a chosen saved version as the live-scene default, including blur', () => {
    const storage = memoryStore()
    const composition = referenceComposition()
    const clock = composition.entities.find((item) => item.id === 'bg-wall-clock')!
    clock.blur = 0.15
    const sign = composition.entities.find((item) => item.id === 'bg-sign-records-office')!
    sign.blur = 0.05
    const first = saveLayoutVersion(storage, 'Soft clock', composition, false)
    expect(first.error).toBeNull()
    expect(readDefaultLayout(storage)).toBeNull()
    const secondComposition = referenceComposition()
    secondComposition.entities.find((item) => item.id === 'bg-wall-clock')!.blur = 0.3
    const second = saveLayoutVersion(storage, 'Stronger clock', secondComposition, false)
    expect(second.error).toBeNull()
    const chosen = second.library.versions.find((version) => version.name === 'Stronger clock')!
    const library = setDefaultLayoutVersion(storage, chosen.id)
    expect(library.defaultVersionId).toBe(chosen.id)
    const live = readDefaultLayout(storage)
    expect(live?.entities.find((item) => item.id === 'bg-wall-clock')?.blur).toBe(0.3)
    expect(live?.entities.find((item) => item.id === 'bg-sign-records-office')?.blur).toBe(0)
    const other = first.library.versions.find((version) => version.name === 'Soft clock')!
    setDefaultLayoutVersion(storage, other.id)
    expect(readDefaultLayout(storage)?.entities.find((item) => item.id === 'bg-wall-clock')?.blur).toBe(0.15)
    const cleared = removeLayoutVersion(storage, other.id)
    expect(cleared.defaultVersionId).toBeNull()
    expect(readDefaultLayout(storage)).toBeNull()
    expect(readLayoutLibrary(storage).versions.map((version) => version.name)).toEqual(['Stronger clock'])
  })

  it('places the saved desk in front of Arthur and keeps Rook in front of both', () => {
    const composition = referenceComposition()
    const ordered = artStackOrder(composition.entities.filter((item) => item.visible))
    const ids = ordered.map((item) => item.id)
    expect(ids.indexOf('desk')).toBeGreaterThan(ids.indexOf('arthur'))
    expect(ids.at(-1)).toBe('rook')
    expect(layoutStackZ(ordered, 'desk')).toBeGreaterThan(layoutStackZ(ordered, 'arthur'))
    expect(layoutPaintZ(ordered, 'desk')).toBeGreaterThan(layoutPaintZ(ordered, 'arthur'))
    const caseCabinet = composition.entities.find((item) => item.id === 'official-cabinet')!
    const center = layoutHotspotWalkTo(composition, 'official-case-file-cabinet')!
    const fromLeft = layoutHotspotWalkTo(composition, 'official-case-file-cabinet', center.x - 200)!
    const fromRight = layoutHotspotWalkTo(composition, 'official-case-file-cabinet', center.x + 200)!
    expect(fromLeft.x).toBeLessThan(center.x)
    expect(fromRight.x).toBeGreaterThan(center.x)
    expect(fromLeft.x).toBeLessThan(caseCabinet.x * 2)
    expect(layoutStackZ(ordered, 'rook')).toBe(ordered.length)
    const desk = composition.entities.find((item) => item.id === 'desk')!
    expect(layoutGameBox(desk)).toMatchObject({ x: desk.x * 2, y: desk.y * 2, width: desk.renderWidth * 2 })
    expect(layoutPixelBox(desk, 5)).toEqual({ left: desk.x * 5, top: desk.y * 5, width: desk.renderWidth * 5, height: layoutGameBox(desk).height / 2 * 5 })
    const saved = referenceComposition()
    const mug = saved.entities.find((item) => item.id === 'mug')!
    mug.x = 245
    saved.entities = saved.entities.filter((item) => item.id !== 'arthur-stamp')
    const merged = withCatalogEntities(saved)
    expect(merged.entities.find((item) => item.id === 'mug')!.x).toBe(245)
    expect(merged.entities.find((item) => item.id === 'arthur-stamp')!.visible).toBe(false)
    const dragged = paintOrderFromFront(['mug', 'globe', 'desk', 'arthur', 'rook'])
    expect(dragged).toEqual(['arthur', 'desk', 'globe', 'mug', 'rook'])
    const layered = dragged.map((id, index) => ({ id, z: (index + 1) * 10 }))
    expect(artStackOrder(layered).map((item) => item.id)).toEqual(['arthur', 'desk', 'globe', 'mug', 'rook'])
    const moved = referenceComposition()
    const dispenser = moved.entities.find((item) => item.id === 'dispenser')!
    dispenser.x = 3
    dispenser.y = 104
    const hotspot = layoutHotspotPixels(moved, 'request-dispenser', 5)
    expect(hotspot).toEqual({ left: 15, top: 520, width: dispenser.renderWidth * 5, height: Math.round(layoutGameBox(dispenser).height / 2 * 5) })
    expect(layoutHotspotPixels(moved, 'window', 5)).toBeNull()
    const cabinet = composition.entities.find((item) => item.id === 'official-cabinet')!
    expect(layoutEntitySrc(cabinet, { caseOpen: false, caseUnsearched: true, miscOpen: false, terminalOn: false })).toBe(cabinet.states.closed)
    expect(layoutEntitySrc(cabinet, { caseOpen: true, caseUnsearched: true, miscOpen: false, terminalOn: false })).toBe(cabinet.states.filed)
    const terminal = composition.entities.find((item) => item.id === 'terminal')!
    terminal.src = terminal.states.on!
    expect(layoutEntitySrc(terminal, { caseOpen: false, caseUnsearched: true, miscOpen: false, terminalOn: false })).toContain('kiosk_off.png')
    expect(layoutEntitySrc(terminal, { caseOpen: false, caseUnsearched: true, miscOpen: false, terminalOn: true })).toContain('kiosk_on.png')
  })

  it('round-trips blur through the composition import', () => {
    const composition = referenceComposition()
    composition.entities.find((item) => item.id === 'bg-wall-clock')!.blur = 0.2
    const imported = importComposition(JSON.parse(JSON.stringify(composition)))
    expect(imported.error).toBeNull()
    expect(imported.composition?.entities.find((item) => item.id === 'bg-wall-clock')?.blur).toBe(0.2)
    expect(imported.composition?.entities.find((item) => item.id === 'desk')?.blur).toBe(0)
  })
})
