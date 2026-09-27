import { describe, expect, it } from 'vitest'
import { deflateSync, inflateSync } from 'node:zlib'
import { comparePngAgainstDeclared, measurePng } from '../../../src/controller/foundation/pixel-intake/png-measure.mjs'
import { crc32Bytes } from '../../../src/controller/foundation/pixel-intake/crc32.mjs'
import { INTAKE_SAFETY_CAPS } from '../../../src/controller/foundation/pixel-intake/safety-caps.mjs'
import { buildPng } from './helpers.mjs'

const idatChunk = (payload) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(payload.length)
  const body = Buffer.concat([Buffer.from('IDAT', 'ascii'), payload])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32Bytes(body))
  return Buffer.concat([len, body, crc])
}

const codeOf = (fn) => {
  try {
    fn()
  } catch (error) {
    return error.code ?? String(error)
  }
  return 'NO_THROW'
}

const opaque = () => [200, 100, 50, 255]
const clear = () => [0, 0, 0, 0]

describe('PNG producer: valid images and bounds', () => {
  it('decodes a valid RGBA image with exact accounting', () => {
    const png = buildPng({ width: 4, height: 3, pixel: opaque })
    const m = measurePng(png)
    expect({ width: m.width, height: m.height, channels: m.channels }).toEqual({ width: 4, height: 3, channels: 'RGBA' })
    expect(m.hasNonzeroAlpha).toBe(true)
    expect(m.fullyTransparent).toBe(false)
    expect(m.contentBounds).toEqual({ x: 0, y: 0, width: 4, height: 3 })
    expect(m.nonzeroAlphaPixels).toBe(12)
    expect(m.pixelCount).toBe(12)
    expect(m.decodedBytes).toBe(48)
    expect(m.idatBytes).toBeGreaterThan(0)
  })

  it('measures center bounds excluding transparent margins', () => {
    const png = buildPng({ width: 8, height: 8, pixel: (x, y) => (x >= 2 && x <= 5 && y >= 3 && y <= 4 ? opaque() : clear()) })
    expect(measurePng(png).contentBounds).toEqual({ x: 2, y: 3, width: 4, height: 2 })
  })

  it('measures content touching each canvas edge', () => {
    expect(measurePng(buildPng({ width: 5, height: 5, pixel: (x, y) => (x === 0 && y === 2 ? opaque() : clear()) })).contentBounds).toEqual({ x: 0, y: 2, width: 1, height: 1 })
    expect(measurePng(buildPng({ width: 5, height: 5, pixel: (x, y) => (x === 4 && y === 2 ? opaque() : clear()) })).contentBounds).toEqual({ x: 4, y: 2, width: 1, height: 1 })
    expect(measurePng(buildPng({ width: 5, height: 5, pixel: (x, y) => (x === 2 && y === 0 ? opaque() : clear()) })).contentBounds).toEqual({ x: 2, y: 0, width: 1, height: 1 })
    expect(measurePng(buildPng({ width: 5, height: 5, pixel: (x, y) => (x === 2 && y === 4 ? opaque() : clear()) })).contentBounds).toEqual({ x: 2, y: 4, width: 1, height: 1 })
  })

  it('measures one-pixel content anywhere', () => {
    const m = measurePng(buildPng({ width: 9, height: 7, pixel: (x, y) => (x === 6 && y === 5 ? [1, 2, 3, 4] : clear()) }))
    expect(m.contentBounds).toEqual({ x: 6, y: 5, width: 1, height: 1 })
    expect(m.nonzeroAlphaPixels).toBe(1)
  })

  it('handles fully transparent images explicitly', () => {
    const m = measurePng(buildPng({ width: 6, height: 6, pixel: clear }))
    expect(m.fullyTransparent).toBe(true)
    expect(m.hasNonzeroAlpha).toBe(false)
    expect(m.contentBounds).toBeNull()
    expect(m.nonzeroAlphaPixels).toBe(0)
  })

  it('decodes all five PNG filter types exactly', () => {
    const pixel = (x, y) => [(x * 37 + y * 91) & 0xff, (x * 11 + y * 57) & 0xff, (x + y) & 0xff, 200]
    for (let filter = 0; filter <= 4; filter++) {
      const m = measurePng(buildPng({ width: 7, height: 5, pixel, filter }))
      expect(m.contentBounds).toEqual({ x: 0, y: 0, width: 7, height: 5 })
      expect(m.nonzeroAlphaPixels).toBe(35)
    }
    const mixed = measurePng(buildPng({ width: 6, height: 5, pixel, filter: (y) => y }))
    expect(mixed.nonzeroAlphaPixels).toBe(30)
  })

  it('skips unknown ancillary chunks after CRC verification', () => {
    const png = buildPng({ width: 2, height: 2, pixel: opaque, ancillary: [['uNKm', Buffer.from('meta')] ] })
    expect(measurePng(png).pixelCount).toBe(4)
  })
})

describe('PNG producer: declared-versus-measured comparison', () => {
  it('reports dimension mismatches exactly', () => {
    const m = measurePng(buildPng({ width: 4, height: 4, pixel: opaque }))
    expect(comparePngAgainstDeclared(m, { width: 5, height: 4, channels: 'RGBA', transparentBounds: { x: 0, y: 0, width: 4, height: 4 } })).toEqual([
      { field: 'dimensions', declared: '5x4', measured: '4x4' },
    ])
    expect(comparePngAgainstDeclared(m, { width: 4, height: 4, channels: 'RGBA', transparentBounds: { x: 0, y: 0, width: 4, height: 4 } })).toEqual([])
  })

  it('reports bound mismatches exactly', () => {
    const m = measurePng(buildPng({ width: 8, height: 8, pixel: (x, y) => (x === 1 && y === 1 ? opaque() : clear()) }))
    const bad = comparePngAgainstDeclared(m, { width: 8, height: 8, channels: 'RGBA', transparentBounds: { x: 0, y: 0, width: 8, height: 8 } })
    expect(bad).toEqual([{ field: 'transparentBounds', declared: { x: 0, y: 0, width: 8, height: 8 }, measured: { x: 1, y: 1, width: 1, height: 1 } }])
    expect(comparePngAgainstDeclared(m, { width: 8, height: 8, channels: 'RGBA', transparentBounds: { x: 1, y: 1, width: 1, height: 1 } })).toEqual([])
  })

  it('compares fully transparent bounds as null', () => {
    const m = measurePng(buildPng({ width: 3, height: 3, pixel: clear }))
    expect(comparePngAgainstDeclared(m, { width: 3, height: 3, channels: 'RGBA', transparentBounds: null })).toEqual([])
  })
})

describe('PNG producer: explicit rejections', () => {
  it('rejects RGB, palette, and other unsupported color forms', () => {
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, colorType: 2 })))).toBe('PNG_UNSUPPORTED_COLOR_TYPE')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, colorType: 3 })))).toBe('PNG_UNSUPPORTED_COLOR_TYPE')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, colorType: 0 })))).toBe('PNG_UNSUPPORTED_COLOR_TYPE')
  })
  it('rejects unsupported bit depths', () => {
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, bitDepth: 16 })))).toBe('PNG_UNSUPPORTED_BIT_DEPTH')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, bitDepth: 1 })))).toBe('PNG_UNSUPPORTED_BIT_DEPTH')
  })
  it('rejects interlaced images', () => {
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, interlace: 1 })))).toBe('PNG_INTERLACE_NOT_SUPPORTED')
  })
  it('rejects corrupt chunk CRCs', () => {
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, badCrc: 'IDAT' })))).toBe('PNG_CRC_MISMATCH')
  })
  it('rejects truncated chunk streams', () => {
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, truncate: true })))).toMatch(/PNG_TRUNCATED_CHUNK|PNG_MISSING_IEND/)
  })
  it('rejects inflated-length mismatches', () => {
    // Container declares 2x2; IDAT carries one row fewer (spliced from 2x1).
    const donor = buildPng({ width: 2, height: 1, pixel: opaque })
    const host = buildPng({ width: 2, height: 2, pixel: opaque })
    const idatOf = (png) => {
      const at = png.indexOf(Buffer.from('IDAT', 'ascii')) - 4
      const len = png.readUInt32BE(at)
      return { at, len, bytes: png.subarray(at, at + 12 + len) }
    }
    const donorIdat = idatOf(donor)
    const hostIdat = idatOf(host)
    const spliced = Buffer.concat([host.subarray(0, hostIdat.at), donorIdat.bytes, host.subarray(hostIdat.at + 12 + hostIdat.len)])
    expect(codeOf(() => measurePng(spliced))).toBe('PNG_INFLATED_LENGTH_MISMATCH')
  })
  it('rejects bad signatures, missing chunks, trailing bytes, and forbidden chunks', () => {
    expect(codeOf(() => measurePng(Buffer.from('GSvQJVMR12345678', 'ascii')))).toBe('PNG_BAD_SIGNATURE')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, missingIend: true })))).toBe('PNG_MISSING_IEND')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, missingIdat: true })))).toBe('PNG_MISSING_IDAT')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, trailing: true })))).toBe('PNG_TRAILING_BYTES')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, plte: true })))).toBe('PNG_FORBIDDEN_CHUNK_FOR_RGBA')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, trns: true })))).toBe('PNG_FORBIDDEN_CHUNK_FOR_RGBA')
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, ancillary: [['FAKE', Buffer.alloc(4)]] })))).toBe('PNG_UNKNOWN_CRITICAL_CHUNK')
  })
  it('rejects unknown filter bytes', () => {
    // Re-encode the IDAT payload with filter byte 9 on row 0, valid CRCs.
    const png = buildPng({ width: 2, height: 1, pixel: opaque })
    const at = png.indexOf(Buffer.from('IDAT', 'ascii')) - 4
    const len = png.readUInt32BE(at)
    const raw = Buffer.from(png.subarray(at + 8, at + 8 + len))
    const inflated = Buffer.from(inflateSync(raw))
    inflated[0] = 9
    const fixed = Buffer.concat([png.subarray(0, at), idatChunk(deflateSync(inflated)), png.subarray(at + 12 + len)])
    expect(codeOf(() => measurePng(fixed))).toBe('PNG_UNKNOWN_FILTER')
  })
})

describe('PNG producer: bounds caps', () => {
  it('rejects out-of-bounds dimensions at IHDR', () => {
    const w = INTAKE_SAFETY_CAPS.MAX_PNG_WIDTH + 1
    expect(codeOf(() => measurePng(buildPng({ width: w, height: 1, pixel: null })))).toBe('PNG_DIMENSIONS_OUT_OF_BOUNDS')
  })
  it('rejects pixel-count overflow at IHDR', () => {
    // 4096 x 2049 exceeds the 8M pixel cap with no pixel data rendered.
    expect(codeOf(() => measurePng(buildPng({ width: 4096, height: 2049, pixel: null })))).toBe('PNG_PIXEL_COUNT_LIMIT')
  })
})

describe('PNG producer: determinism', () => {
  it('produces identical measurements for identical bytes', () => {
    const pixel = (x, y) => [(x * 13 + y * 7) & 0xff, x & 0xff, y & 0xff, (x + y) % 3 === 0 ? 0 : 255]
    const a = measurePng(buildPng({ width: 11, height: 9, pixel, filter: 4 }))
    const b = measurePng(buildPng({ width: 11, height: 9, pixel, filter: 4 }))
    expect(a).toEqual(b)
  })
})
