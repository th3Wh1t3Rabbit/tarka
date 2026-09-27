import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'public/art-review/background-detail'
const expected = [
  'bg-poster-be-the-change.png',
  'bg-poster-think-outside-the-box.png',
  'bg-wall-clock.png',
  'bg-plaque-employee-of-the-month.png',
  'bg-painting-city-bridge.png',
  'bg-print-building.png',
  'bg-plaque-preserve-serve-remember.png',
  'bg-sign-records-office.png',
  'bg-sign-you-are-not-a-number.png',
]

describe('background detail crops', () => {
  it('saves each wall piece as its own RGBA crop and does not place it in the scene', () => {
    const files = readdirSync(dir).filter((name) => name.endsWith('.png')).sort()
    expect(files).toEqual([...expected].sort())
    for (const file of expected) {
      const bytes = readFileSync(`${dir}/${file}`)
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(bytes[25]).toBe(6)
      const width = bytes.readUInt32BE(16)
      const height = bytes.readUInt32BE(20)
      expect(width).toBeGreaterThan(40)
      expect(height).toBeGreaterThan(40)
      expect(width).toBeLessThan(400)
      expect(height).toBeLessThan(400)
    }
    const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8'))
    expect(index.placedInScene).toBe(false)
    expect(index.sourceSize).toEqual([1768, 663])
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).not.toContain('bg-poster-be-the-change')
    const review = readFileSync('src/app/DetailReview.tsx', 'utf8')
    for (const file of expected) expect(review).toContain(file)
    const workbench = readFileSync('src/app/ArtLayoutWorkbench.tsx', 'utf8')
    expect(workbench).toContain('DRAW HOTSPOT')
    expect(workbench).not.toContain('hotspot-polygons')
    expect(workbench).toContain('aria-label={`Blur ${item.label}`}')
    expect(workbench).toContain('step={CROP_BLUR_STEP}')
    expect(workbench).toContain('max={CROP_BLUR_MAX}')
    expect(workbench).toContain('Use ${version.name} as the game default')
    const composition = readFileSync('src/adventure/sceneComposition.ts', 'utf8')
    expect(composition).toContain('/art-review/background-detail/')
    expect(composition).not.toContain('/art-review/background-detail-blend/')
  })
})
