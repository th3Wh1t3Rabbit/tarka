// Synthetic fixture builders for Pixel intake tests. Everything is generated
// in memory; no production Pixel bytes exist anywhere in this suite.
import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { deflateRawSync, deflateSync } from 'node:zlib'
import { crc32Bytes } from '../../../src/controller/foundation/pixel-intake/crc32.mjs'
import {
  capabilityContentSha256,
  clipDefinitionSha256,
} from '../../../src/controller/foundation/pixel-identity.mjs'

function u16(n) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}

function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0)
  return b
}

// ---- Minimal ZIP writer -------------------------------------------------
// member: { name, data?, method?, flags?, crc?, compSize?, uncompSize?,
//   localName?, localMethod?, localFlags?, localCrc?, localComp?, localUncomp?,
//   extraCentral?, extraLocal?, unixMode?, madeBy?, versionNeeded?, comment?,
//   dir?, externalAttrs?, descriptor?, descriptorBytes?, padAfter? }
// options: eocd*/appendZip64Locator/mutate/preamble/trailerGap/centralOrder
export function buildZip(members, options = {}) {
  const chunks = []
  const central = []
  const preamble = options.preamble ?? Buffer.alloc(0)
  if (preamble.length > 0) chunks.push(preamble)
  let offset = preamble.length
  for (const m of members) {
    const recordStart = offset
    const nameBytes = Buffer.isBuffer(m.name) ? m.name : Buffer.from(m.name, 'utf8')
    const data = m.data ?? Buffer.alloc(0)
    const method = m.method ?? 8
    const deflated = m.deflatedData !== undefined ? m.deflatedData : method === 0 ? data : method === 8 ? deflateRawSync(data) : data
    // Optional undeclared trailing bytes inside the compressed region
    // (adversarial: exactly-one-stream enforcement must reject these).
    const payload = m.trailingBytes ? Buffer.concat([deflated, m.trailingBytes]) : deflated
    const crc = m.crc ?? crc32Bytes(data)
    const compSize = m.compSize ?? payload.length
    const uncompSize = m.uncompSize ?? data.length
    const flags = m.flags ?? 0
    const extraLocal = m.extraLocal ?? Buffer.alloc(0)
    const localName = m.localName !== undefined ? (Buffer.isBuffer(m.localName) ? m.localName : Buffer.from(m.localName, 'utf8')) : nameBytes
    const localMethod = m.localMethod ?? method
    const localFlags = m.localFlags ?? flags
    const local = Buffer.concat([
      u32(0x04034b50), u16(m.localVersion ?? 20), u16(localFlags), u16(localMethod),
      u16(0), u16(0), u32(m.localCrc ?? crc), u32(m.localComp ?? compSize), u32(m.localUncomp ?? uncompSize),
      u16(localName.length), u16(extraLocal.length), localName, extraLocal,
    ])
    chunks.push(local, payload)
    // Optional data descriptor immediately after the payload (bit-3 members).
    if (m.descriptor === true) {
      const desc = Buffer.alloc(16)
      desc.writeUInt32LE(0x08074b50, 0)
      desc.writeUInt32LE(crc >>> 0, 4)
      desc.writeUInt32LE(compSize >>> 0, 8)
      desc.writeUInt32LE(uncompSize >>> 0, 12)
      chunks.push(desc)
      offset += desc.length
    } else if (typeof m.descriptor === 'object' && m.descriptor !== null) {
      const d = m.descriptor
      const body = Buffer.alloc(12)
      body.writeUInt32LE((d.crc ?? crc) >>> 0, 0)
      body.writeUInt32LE((d.comp ?? compSize) >>> 0, 4)
      body.writeUInt32LE((d.uncomp ?? uncompSize) >>> 0, 8)
      const desc = d.signed === false ? body : Buffer.concat([Buffer.from([0x08, 0x07, 0x4b, 0x50]), body])
      chunks.push(desc)
      offset += desc.length
    } else if (Buffer.isBuffer(m.descriptorBytes)) {
      chunks.push(m.descriptorBytes)
      offset += m.descriptorBytes.length
    }
    if (m.padAfter) {
      chunks.push(m.padAfter)
      offset += m.padAfter.length
    }
    const madeBy = m.madeBy ?? (m.unixMode !== undefined ? 0x0300 : 0x0000)
    const externalAttrs = m.externalAttrs ?? (m.unixMode !== undefined ? (m.unixMode << 16) >>> 0 : m.dir ? 0x10 : 0)
    const extraCentral = m.extraCentral ?? Buffer.alloc(0)
    const comment = m.comment ? Buffer.from(m.comment, 'utf8') : Buffer.alloc(0)
    central.push(Buffer.concat([
      u32(0x02014b50), u16(madeBy), u16(m.versionNeeded ?? 20), u16(flags), u16(method),
      u16(0), u16(0), u32(crc), u32(compSize), u32(uncompSize),
      u16(nameBytes.length), u16(extraCentral.length), u16(comment.length),
      u16(0), u16(0), u32(externalAttrs), u32(recordStart),
      nameBytes, extraCentral, comment,
    ]))
    offset += local.length + payload.length
  }
  const trailerGap = options.trailerGap ?? Buffer.alloc(0)
  if (trailerGap.length > 0) {
    chunks.push(trailerGap)
    offset += trailerGap.length
  }
  const centralStart = offset
  const orderedCentral = options.centralOrder ? options.centralOrder.map((i) => central[i]) : central
  const centralBytes = Buffer.concat(orderedCentral)
  offset += centralBytes.length
  const count = options.eocdCount ?? members.length
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(options.eocdDisk ?? 0), u16(options.eocdCentralDisk ?? 0),
    u16(options.eocdThisDisk ?? count), u16(count),
    u32(options.eocdCentralSize ?? centralBytes.length),
    u32(options.eocdCentralOffset ?? centralStart),
    u16(0),
  ])
  let out = Buffer.concat([...chunks, centralBytes, eocd])
  if (options.appendZip64Locator) {
    out = Buffer.concat([out, u32(0x07064b50), Buffer.alloc(16, 0)])
  }
  if (options.mutate) options.mutate(out)
  return out
}

export const UB = (s) => Buffer.from(s, 'utf8');

// Poll-based temp-residue assertion: parallel test workers share os.tmpdir,
// so a snapshot can catch another worker's short-lived runner directory.
// Polling until no NEW directory remains distinguishes our leaks (which
// persist and fail) from concurrent churn (which vanishes within milliseconds).
export async function expectNoNewTempDirs(before, { prefix = 'trace-pixel-intake-', timeoutMs = 8000 } = {}) {
  const start = Date.now()
  let extra = []
  for (;;) {
    extra = readdirSync(tmpdir()).filter((n) => n.startsWith(prefix) && !before.includes(n))
    if (extra.length === 0) return
    if (Date.now() - start > timeoutMs) break
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error(`TEMP_RESIDUE: ${extra.join(',')}`)
}

// ---- Minimal PNG writer (RGBA8 default) ---------------------------------
// pixel(x, y) -> [r,g,b,a]. Rows are truly filter-encoded so every PNG
// filter type (0-4) exercises the decoder exactly.

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32Bytes(body))
  return Buffer.concat([len, body, crc])
}

function paethEncode(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

export function encodePngScanlines(width, height, pixel, filter = 0) {
  const rows = []
  let previous = Buffer.alloc(width * 4, 0)
  for (let y = 0; y < height; y++) {
    const raw = Buffer.alloc(width * 4)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y)
      raw[x * 4] = r
      raw[x * 4 + 1] = g
      raw[x * 4 + 2] = b
      raw[x * 4 + 3] = a
    }
    const f = typeof filter === 'function' ? filter(y) : filter
    const out = Buffer.alloc(width * 4)
    for (let i = 0; i < raw.length; i++) {
      const a = i >= 4 ? raw[i - 4] : 0
      const b = previous[i]
      const c = i >= 4 ? previous[i - 4] : 0
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paethEncode(a, b, c)
      out[i] = (raw[i] - pred) & 0xff
    }
    rows.push(Buffer.concat([Buffer.from([f]), out]))
    previous = raw
  }
  return Buffer.concat(rows)
}
export function buildPng({ width, height, pixel, filter = 0, bitDepth = 8, colorType = 6, interlace = 0, ancillary = [], plte = false, trns = false, badCrc = null, truncate = false, trailing = false, missingIend = false, missingIdat = false, rawIdat = null, ihdrPayload = null, splitIdat = false, noncontiguousIdat = false, duplicateIhdr = false }) {
  const out = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])]
  const ihdr = ihdrPayload ?? (() => {
    const b = Buffer.alloc(13)
    b.writeUInt32BE(width, 0)
    b.writeUInt32BE(height, 4)
    b[8] = bitDepth
    b[9] = colorType
    b[10] = 0
    b[11] = 0
    b[12] = interlace
    return b
  })()
  out.push(pngChunk('IHDR', ihdr))
  if (plte) out.push(pngChunk('PLTE', Buffer.alloc(12, 7)))
  if (trns) out.push(pngChunk('tRNS', Buffer.alloc(4, 9)))
  for (const [type, data] of ancillary) out.push(pngChunk(type, data))
  if (!missingIdat) {
    const payload = pixel === null ? (rawIdat ?? Buffer.alloc(0)) : deflateSync(encodePngScanlines(width, height, pixel, filter))
    if (splitIdat || noncontiguousIdat) {
      const half = Math.ceil(payload.length / 2)
      out.push(pngChunk('IDAT', payload.subarray(0, half)))
      if (noncontiguousIdat) out.push(pngChunk('tEXt', Buffer.from('between')))
      out.push(pngChunk('IDAT', payload.subarray(half)))
    } else {
      out.push(pngChunk('IDAT', payload))
    }
  }
  if (duplicateIhdr) out.push(pngChunk('IHDR', out[1].subarray(8, 21)))
  if (!missingIend) out.push(pngChunk('IEND', Buffer.alloc(0)))
  let bytes = Buffer.concat(out)
  if (badCrc) {
    const at = bytes.indexOf(Buffer.from(badCrc, 'ascii'))
    bytes = Buffer.concat([bytes.subarray(0, at + 8), Buffer.from([0xff]), bytes.subarray(at + 9)])
  }
  if (truncate) bytes = bytes.subarray(0, bytes.length - 7)
  if (trailing) bytes = Buffer.concat([bytes, Buffer.from([1, 2, 3, 4])])
  return bytes
}

// ---- Minimal intake-index builder ----------------------------------------
export function makeAssetEntry({ id, assetPath, bytes, width, height, bounds }) {
  return {
    id,
    path: assetPath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    version: 'TEST_VERSION',
    kind: 'PROP',
    width,
    height,
    channels: 'RGBA',
    exclusiveFootBaseline: null,
    anchor: { x: 0, y: 0 },
    transparentBounds: bounds,
    paletteId: 'TEST_PALETTE',
    materialShadingId: 'TEST_SHADING',
    provenance: 'SYNTHETIC_TEST_ONLY',
    license: 'SYNTHETIC_TEST_ONLY',
    previewEvidence: ['TEST_PREVIEW'],
    approvalReceiptId: null,
    derivativeOf: null,
    bakedText: false,
    bakedEvidence: false,
  }
}

export function makeIndex({ archiveId = 'TEST_ARCHIVE', assets, clips = null, capabilities = null }) {
  const clipList = clips ?? assets.map((a, i) => ({
    id: `TEST_CLIP_${i}`,
    version: 'TEST_VERSION',
    sha256: '0'.repeat(64),
    frames: [{ order: 0, assetId: a.id, durationMs: 200, hold: true }],
    loop: false,
    cancellation: 'IMMEDIATE',
    entrance: 'TEST_IDLE',
    exit: 'TEST_IDLE',
    facing: 'FRONT',
    mirrorAllowed: false,
    staticFallback: a.id,
    contacts: [],
    ownershipEvents: [],
    frontHandOcclusion: 'NONE',
    paletteId: a.paletteId,
    materialShadingId: a.materialShadingId,
    approvalReceiptId: null,
  }))
  for (const c of clipList) c.sha256 = clipDefinitionSha256(c, assets)
  const capList = capabilities ?? assets.map((a, i) => ({
    id: `TEST_CAP_${i}`,
    required: i === 0,
    clipIds: [`TEST_CLIP_${i}`],
    staticAssetId: a.id,
    semanticFallback: 'SYNTHETIC_FALLBACK',
    contentIdentity: '0'.repeat(64),
  }))
  for (const c of capList) c.contentIdentity = capabilityContentSha256(c, assets, clipList)
  return {
    schemaVersion: '1.0.0',
    archiveId,
    version: 'TEST_VERSION',
    manifestAuthority: 'AUTHORITATIVE_INDEX',
    assets,
    clips: clipList,
    capabilities: capList,
    approvalReceipts: [],
  }
}
