// Deterministic PNG decode-and-measure producer for Pixel archive intake.
// Validates structure, decodes scanlines, and measures content bounds using
// the intake contract coordinate convention (top-left origin, integer pixels,
// {x,y,width,height} with width/height as inclusive-span counts).
// Supported subset: bit depth 8, color type 6 (RGBA), standard compression
// and filter methods, non-interlaced. All other forms are explicitly
// rejected, never converted. Node standard library only.
import { inflateSync } from 'node:zlib'
import { crc32Bytes } from './crc32.mjs'
import { INTAKE_SAFETY_CAPS } from './safety-caps.mjs'

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const BYTES_PER_PIXEL_RGBA8 = 4

export class PngMeasureError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'PngMeasureError'
    this.code = code
  }
}

const fail = (code, detail) => {
  throw new PngMeasureError(code, detail)
}

function chunkTypeName(bytes) {
  return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
}

// APNG animation payloads: never part of the measured static image.
const APNG_CHUNK_TYPES = new Set(['acTL', 'fcTL', 'fdAT'])

function validateChunkType(type) {
  const bytes = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)]
  const letter = (b) => (b >= 65 && b <= 90) || (b >= 97 && b <= 122)
  if (!bytes.every(letter)) fail('PNG_INVALID_CHUNK_TYPE', type)
  // Reserved bit: the third type byte must be uppercase.
  if (!(bytes[2] >= 65 && bytes[2] <= 90)) fail('PNG_INVALID_CHUNK_TYPE', `${type} reserved-bit`)
}

function isCritical(typeBytes) {
  // Bit 5 of the first byte clear => uppercase => critical per PNG spec.
  return (typeBytes[0] & 32) === 0
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function unfilterRow(filter, current, previous, bpp) {
  const out = Buffer.alloc(current.length)
  for (let i = 0; i < current.length; i++) {
    const a = i >= bpp ? out[i - bpp] : 0
    const b = previous ? previous[i] : 0
    const c = previous && i >= bpp ? previous[i - bpp] : 0
    let value
    if (filter === 0) value = current[i]
    else if (filter === 1) value = current[i] + a
    else if (filter === 2) value = current[i] + b
    else if (filter === 3) value = current[i] + ((a + b) >> 1)
    else if (filter === 4) value = current[i] + paeth(a, b, c)
    else fail('PNG_UNKNOWN_FILTER', `filter=${filter}`)
    out[i] = value & 0xff
  }
  return out
}

export function decodePngRgba8(input, caps = INTAKE_SAFETY_CAPS) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input)
  if (bytes.length < 8 || !SIGNATURE.every((b, i) => bytes[i] === b)) fail('PNG_BAD_SIGNATURE')
  let at = 8
  let width = 0
  let height = 0
  let seenIhdr = false
  let seenIend = false
  let seenIdat = false
  let idatClosed = false
  const idatParts = []
  let idatBytes = 0
  const chunkCounts = {}
  const readChunk = () => {
    if (at + 8 > bytes.length) fail('PNG_TRUNCATED_CHUNK_HEADER')
    const length = bytes.readUInt32BE(at)
    if (length > caps.MAX_PNG_CHUNK_BYTES) fail('PNG_CHUNK_TOO_LONG', `length=${length}`)
    const type = bytes.subarray(at + 4, at + 8)
    if (at + 12 + length > bytes.length) fail('PNG_TRUNCATED_CHUNK', chunkTypeName(type))
    const data = bytes.subarray(at + 8, at + 8 + length)
    const stored = bytes.readUInt32BE(at + 8 + length)
    const computed = crc32Bytes(Buffer.concat([type, data]))
    if (stored !== computed) fail('PNG_CRC_MISMATCH', chunkTypeName(type))
    at += 12 + length
    return { type: chunkTypeName(type), typeBytes: Buffer.from(type), data }
  }
  for (;;) {
    if (at >= bytes.length) fail('PNG_MISSING_IEND')
    const chunk = readChunk()
    validateChunkType(chunk.type)
    if (APNG_CHUNK_TYPES.has(chunk.type)) fail('PNG_ANIMATION_NOT_SUPPORTED', chunk.type)
    chunkCounts[chunk.type] = (chunkCounts[chunk.type] ?? 0) + 1
    if (!seenIhdr) {
      if (chunk.type !== 'IHDR') fail('PNG_IHDR_NOT_FIRST', chunk.type)
      if (chunk.data.length !== 13) fail('PNG_BAD_IHDR_LENGTH')
      width = chunk.data.readUInt32BE(0)
      height = chunk.data.readUInt32BE(4)
      const bitDepth = chunk.data[8]
      const colorType = chunk.data[9]
      const compression = chunk.data[10]
      const filterMethod = chunk.data[11]
      const interlace = chunk.data[12]
      if (width < 1 || width > caps.MAX_PNG_WIDTH || height < 1 || height > caps.MAX_PNG_HEIGHT) {
        fail('PNG_DIMENSIONS_OUT_OF_BOUNDS', `${width}x${height}`)
      }
      if (width * height > caps.MAX_PNG_PIXELS) fail('PNG_PIXEL_COUNT_LIMIT', `${width}x${height}`)
      if (bitDepth !== 8) fail('PNG_UNSUPPORTED_BIT_DEPTH', `depth=${bitDepth}`)
      if (colorType !== 6) fail('PNG_UNSUPPORTED_COLOR_TYPE', `color=${colorType}`)
      if (compression !== 0) fail('PNG_UNSUPPORTED_COMPRESSION', `method=${compression}`)
      if (filterMethod !== 0) fail('PNG_UNSUPPORTED_FILTER_METHOD', `method=${filterMethod}`)
      if (interlace !== 0) fail('PNG_INTERLACE_NOT_SUPPORTED', `method=${interlace}`)
      seenIhdr = true
      continue
    }
    if (chunk.type === 'IEND') {
      if (chunk.data.length !== 0) fail('PNG_BAD_IEND_LENGTH')
      seenIend = true
      break
    }
    if (chunk.type === 'IHDR') fail('PNG_DUPLICATE_IHDR')
    if (chunk.type === 'IDAT') {
      if (idatClosed) fail('PNG_NONCONTIGUOUS_IDAT')
      seenIdat = true
      idatParts.push(chunk.data)
      idatBytes += chunk.data.length
      continue
    }
    // Any other chunk after IDAT started closes the contiguous IDAT run.
    if (seenIdat) idatClosed = true
    if (chunk.type === 'PLTE' || chunk.type === 'tRNS') fail('PNG_FORBIDDEN_CHUNK_FOR_RGBA', chunk.type)
    if (isCritical(chunk.typeBytes) && !['IHDR', 'IDAT', 'IEND'].includes(chunk.type)) {
      fail('PNG_UNKNOWN_CRITICAL_CHUNK', chunk.type)
    }
    // Unknown ancillary chunks are skipped (CRC already verified, length bounded).
  }
  if (!seenIend) fail('PNG_MISSING_IEND')
  if (at !== bytes.length) fail('PNG_TRAILING_BYTES', `trailing=${bytes.length - at}`)
  if (idatParts.length === 0) fail('PNG_MISSING_IDAT')
  const stride = width * BYTES_PER_PIXEL_RGBA8
  const expected = height * (1 + stride)
  const idatTotal = idatBytes
  let inflated
  try {
    // info:true exposes the engine's consumed-input count; the concatenated
    // IDAT payload must contain exactly one complete zlib stream, so any
    // trailing byte or second stream rejects deterministically.
    const result = inflateSync(Buffer.concat(idatParts), { maxOutputLength: expected + 1, info: true })
    if (result.engine.bytesWritten !== idatTotal) fail('PNG_TRAILING_COMPRESSED_DATA', `consumed=${result.engine.bytesWritten} idat=${idatTotal}`)
    inflated = result.buffer
  } catch (error) {
    if (error instanceof PngMeasureError) throw error
    fail('PNG_INFLATE_FAILED', error instanceof Error ? error.message : String(error))
  }
  if (inflated.length !== expected) fail('PNG_INFLATED_LENGTH_MISMATCH', `got=${inflated.length} want=${expected}`)
  const pixels = Buffer.alloc(width * height * BYTES_PER_PIXEL_RGBA8)
  let previous = null
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (1 + stride)]
    const row = inflated.subarray(y * (1 + stride) + 1, (y + 1) * (1 + stride))
    const out = unfilterRow(filter, row, previous, BYTES_PER_PIXEL_RGBA8)
    out.copy(pixels, y * stride)
    previous = out
  }
  return { width, height, pixels, idatBytes, chunkCounts }
}

export function measureRgbaContent(decoded) {
  const { width, height, pixels } = decoded
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let nonzeroAlphaPixels = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * BYTES_PER_PIXEL_RGBA8 + 3]
      if (alpha !== 0) {
        nonzeroAlphaPixels++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  const fullyTransparent = nonzeroAlphaPixels === 0
  return {
    width,
    height,
    channels: 'RGBA',
    hasNonzeroAlpha: !fullyTransparent,
    fullyTransparent,
    // Inclusive-span convention: width/height count painted pixels.
    contentBounds: fullyTransparent ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    nonzeroAlphaPixels,
    pixelCount: width * height,
    decodedBytes: pixels.length,
    idatBytes: decoded.idatBytes,
  }
}

export function measurePng(input, caps = INTAKE_SAFETY_CAPS) {
  return measureRgbaContent(decodePngRgba8(input, caps))
}

export function comparePngAgainstDeclared(measured, declared) {
  const mismatches = []
  if (measured.width !== declared.width || measured.height !== declared.height) {
    mismatches.push({ field: 'dimensions', declared: `${declared.width}x${declared.height}`, measured: `${measured.width}x${measured.height}` })
  }
  if (measured.channels !== declared.channels) {
    mismatches.push({ field: 'channels', declared: declared.channels, measured: measured.channels })
  }
  const declaredBounds = declared.transparentBounds ?? null
  const measuredBounds = measured.contentBounds
  const same =
    (declaredBounds === null && measuredBounds === null) ||
    (declaredBounds !== null &&
      measuredBounds !== null &&
      declaredBounds.x === measuredBounds.x &&
      declaredBounds.y === measuredBounds.y &&
      declaredBounds.width === measuredBounds.width &&
      declaredBounds.height === measuredBounds.height)
  if (!same) {
    mismatches.push({ field: 'transparentBounds', declared: declaredBounds, measured: measuredBounds })
  }
  return mismatches
}
