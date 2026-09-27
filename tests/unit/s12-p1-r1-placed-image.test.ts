import { describe, expect, it } from 'vitest'
import { commitPlacedPaint, placedImageIdentity, visiblePlacedImage } from '../../src/adventure/placedImageCache'

const image = (src: string, blur = 1) => ({ src, width: 24, height: 32, blur })

describe('S12-P1-R1 placed image cache', () => {
  it('shows a paint only for the current source, size, and blur', () => {
    const current = image('/mug.png', 2)
    const identity = placedImageIdentity(current)
    const paint = { identity, url: 'data:mug' }
    expect(visiblePlacedImage(current, paint, null)).toBe('data:mug')
    expect(visiblePlacedImage(image('/lamp.png', 2), paint, null)).toBe('/lamp.png')
    expect(visiblePlacedImage({ ...current, blur: 4 }, paint, null)).toBe('/mug.png')
    expect(visiblePlacedImage({ ...current, width: 12 }, paint, null)).toBe('/mug.png')
  })

  it('ignores a late A or B result after C is current and drops a failed decode', () => {
    const c = placedImageIdentity(image('/c.png'))
    const a = { identity: placedImageIdentity(image('/a.png')), url: 'data:a' }
    const b = { identity: placedImageIdentity(image('/b.png')), url: 'data:b' }
    expect(commitPlacedPaint(c, null, a)).toBeNull()
    expect(commitPlacedPaint(c, { identity: c, url: 'data:c' }, b)?.url).toBe('data:c')
    expect(visiblePlacedImage(image('/c.png'), { identity: c, url: 'data:c' }, c)).toBe('/c.png')
  })

  it('does not include Rook position in the image identity', () => {
    const left = placedImageIdentity(image('/pen.png'))
    const right = placedImageIdentity(image('/pen.png'))
    expect(left).toBe(right)
    expect(left).not.toContain('rook')
  })
})
