import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { admitZipArchive } from '../../../src/controller/foundation/pixel-intake/zip-admission.mjs'
import { measurePng } from '../../../src/controller/foundation/pixel-intake/png-measure.mjs'
import { classifyExtractionError, renderPacket, runIntake } from '../../../src/controller/foundation/pixel-intake/intake-runner.mjs'
import { INTAKE_SAFETY_CAPS } from '../../../src/controller/foundation/pixel-intake/safety-caps.mjs'
import { buildPng, buildZip, expectNoNewTempDirs, makeAssetEntry, makeIndex, UB } from './helpers.mjs'

const codeOf = (fn) => {
  try {
    fn()
  } catch (error) {
    return error.code ?? String(error)
  }
  return 'NO_THROW'
}

const detailOf = (fn) => {
  try {
    fn()
  } catch (error) {
    return String(error.message ?? error)
  }
  return 'NO_THROW'
}

const opaque = () => [200, 100, 50, 255]
const tempRoots = []

async function writeTempArchive(bytes, name = 'pack.zip') {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-r1-'))
  tempRoots.push(dir)
  const file = path.join(dir, name)
  writeFileSync(file, bytes)
  return file
}

afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true })
})

describe('R1: archive path-layout prefix closure', () => {
  it('rejects file a + file a/b', () => {
    expect(codeOf(() => admitZipArchive(buildZip([
      { name: 'a', data: UB('file'), method: 0 },
      { name: 'a/b', data: UB('nested'), method: 0 },
    ])))).toBe('ZIP_PATH_PREFIX_CONFLICT')
  })
  it('rejects file a + directory a/b/ in both central-entry orders', () => {
    const forward = buildZip([
      { name: 'a', data: UB('file'), method: 0 },
      { name: 'a/b/', data: Buffer.alloc(0), method: 0, dir: true },
    ])
    const reverse = buildZip([
      { name: 'a/b/', data: Buffer.alloc(0), method: 0, dir: true },
      { name: 'a', data: UB('file'), method: 0 },
    ])
    expect(codeOf(() => admitZipArchive(forward))).toBe('ZIP_PATH_PREFIX_CONFLICT')
    expect(codeOf(() => admitZipArchive(reverse))).toBe('ZIP_PATH_PREFIX_CONFLICT')
  })
  it('rejects case-folded prefix conflicts independent of host case sensitivity', () => {
    expect(codeOf(() => admitZipArchive(buildZip([
      { name: 'A', data: UB('file'), method: 0 },
      { name: 'a/b.png', data: UB('nested'), method: 0 },
    ])))).toBe('ZIP_PATH_PREFIX_CONFLICT')
  })
  it('runner returns HOLD_WITH_EVIDENCE with no throw and no temp residue', async () => {
    const index = makeIndex({ assets: [] })
    const archive = await writeTempArchive(buildZip([
      { name: 'index.json', data: Buffer.from(JSON.stringify(index), 'utf8'), method: 0 },
      { name: 'a', data: UB('file'), method: 0 },
      { name: 'a/b/', data: Buffer.alloc(0), method: 0, dir: true },
    ]))
    const before = readdirSync(os.tmpdir()).filter((n) => n.startsWith('trace-pixel-intake-'))
    let packet = null
    let threw = null
    try {
      packet = await runIntake(archive)
    } catch (error) {
      threw = error
    }
    expect(threw).toBeNull()
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('ZIP_PATH_PREFIX_CONFLICT')
    await expectNoNewTempDirs(before)
  })
})

describe('R2: complete local/central identity validation', () => {
  it('rejects local CRC disagreement when bit 3 is clear', () => {
    const zip = buildZip([{ name: 'c.bin', data: UB('payload'), method: 0, localCrc: 0x12345678 }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH')
    expect(detailOf(() => admitZipArchive(zip))).toContain('field=crc32')
  })
  it('rejects local compressed-size disagreement when bit 3 is clear', () => {
    const zip = buildZip([{ name: 'c.bin', data: UB('payload'), method: 0, localComp: 999 }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH')
    expect(detailOf(() => admitZipArchive(zip))).toContain('field=compressedSize')
  })
  it('rejects local uncompressed-size disagreement when bit 3 is clear', () => {
    const zip = buildZip([{ name: 'c.bin', data: UB('payload'), method: 0, localUncomp: 999 }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH')
    expect(detailOf(() => admitZipArchive(zip))).toContain('field=uncompressedSize')
  })
  it('requires exact general-purpose flag equality (no silent divergence)', () => {
    // EFS-style single-bit divergence with identical names/methods/sizes.
    const zip = buildZip([{ name: 'f.bin', data: UB('x'), method: 0, localFlags: 0x0800 }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_CENTRAL_FLAG_MISMATCH')
  })
  it('still admits zero/placeholder local CRC-sizes when bit 3 is set', () => {
    const data = Buffer.from('streamed-bytes', 'utf8')
    const zip = buildZip([{ name: 's.bin', data, method: 8, flags: 0x08, localCrc: 0, localComp: 0, localUncomp: 0, descriptor: true }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('NO_THROW')
  })
})

describe('R3: local extra-field validation and ZIP64 closure', () => {
  it('rejects a local-only ZIP64 extra field', () => {
    const zip = buildZip([{ name: 'z.bin', data: UB('x'), method: 0, extraLocal: Buffer.from([0x01, 0x00, 0x00, 0x00]) }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP64_NOT_SUPPORTED')
  })
  it('rejects malformed local extras', () => {
    // Extra claims 9 payload bytes but carries 1.
    const zip = buildZip([{ name: 'm.bin', data: UB('x'), method: 0, extraLocal: Buffer.from([0x99, 0x99, 0x09, 0x00, 0x00]) }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_TRUNCATED_EXTRA')
  })
})

describe('R4: strict authoritative-index UTF-8', () => {
  it('records invalid UTF-8 as a deterministic candidate failure', async () => {
    const bad = Buffer.concat([Buffer.from('{"a":"', 'utf8'), Buffer.from([0xff, 0xfe]), Buffer.from('"}', 'utf8')])
    const archive = await writeTempArchive(buildZip([{ name: 'index.json', data: bad, method: 0 }]))
    const packet = await runIntake(archive)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('INTAKE_INDEX_MISSING')
    expect(packet.validators.indexLocation.candidates).toEqual([{ path: 'index.json', valid: false, failure: 'INDEX_UTF8_INVALID' }])
  })
  it('preserves deterministic diagnostics with mixed candidates', async () => {
    const png = buildPng({ width: 2, height: 2, pixel: opaque })
    const entry = makeAssetEntry({ id: 'M', assetPath: 'art/m.png', bytes: png, width: 2, height: 2, bounds: { x: 0, y: 0, width: 2, height: 2 } })
    const good = JSON.stringify(makeIndex({ assets: [entry] }))
    const bad = Buffer.concat([Buffer.from('{"b":"', 'utf8'), Buffer.from([0xff]), Buffer.from('"}', 'utf8')])
    const archive = await writeTempArchive(buildZip([
      { name: 'notes.json', data: bad, method: 0 },
      { name: 'index.json', data: Buffer.from(good, 'utf8'), method: 0 },
      { name: 'art/m.png', data: png, method: 0 },
    ]))
    const packet = await runIntake(archive)
    // The stray notes.json is undeclared, so the member set honestly holds —
    // while the candidate diagnostics still record both outcomes exactly.
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('INTAKE_MEMBER_SET_MISMATCH')
    expect(packet.validators.indexLocation.status).toBe('FOUND')
    expect(packet.validators.indexLocation.candidates).toEqual([
      { path: 'index.json', valid: true, failure: null },
      { path: 'notes.json', valid: false, failure: 'INDEX_UTF8_INVALID' },
    ])
  })
})

describe('R5: PNG structural uniqueness and order', () => {
  it('rejects a duplicate later IHDR', () => {
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, duplicateIhdr: true })))).toBe('PNG_DUPLICATE_IHDR')
  })
  it('rejects noncontiguous IDAT sequences', () => {
    expect(codeOf(() => measurePng(buildPng({ width: 2, height: 2, pixel: opaque, noncontiguousIdat: true })))).toBe('PNG_NONCONTIGUOUS_IDAT')
  })
  it('still accepts contiguous split IDAT sequences', () => {
    expect(measurePng(buildPng({ width: 2, height: 2, pixel: opaque, splitIdat: true })).pixelCount).toBe(4)
  })
})

describe('R6: truthful archive identity on pre-read holds', () => {
  it('emits null hash with reason and preserved byte count for oversized files', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-r1-'))
    tempRoots.push(dir)
    const file = path.join(dir, 'big.zip')
    writeFileSync(file, Buffer.alloc(2048, 3))
    const packet = await runIntake(file, { caps: { ...INTAKE_SAFETY_CAPS, MAX_ARCHIVE_BYTES: 64 } })
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('ZIP_ARCHIVE_SIZE_LIMIT')
    expect(packet.archive.sha256).toBeNull()
    expect(packet.archive.hashAvailable).toBe(false)
    expect(packet.archive.hashUnavailableReason).toBe('ZIP_ARCHIVE_SIZE_LIMIT')
    expect(packet.archive.bytes).toBe(2048)
  })
  it('never reads an over-cap file merely to hash it', async () => {
    // The fake fails any read with EIO: reaching HOLD proves the body path
    // was never touched (works for any process user, unlike chmod games,
    // which are now obsolete — the single handle opens before metadata).
    const failingRead = {
      stat: async () => ({ isFile: () => true, size: 2048 }),
      read: async () => {
        throw Object.assign(new Error('must not read'), { code: 'EIO' })
      },
      close: async () => {},
    }
    const calls = []
    const tracked = {
      stat: async (...args) => {
        calls.push('stat')
        return failingRead.stat(...args)
      },
      read: async (...args) => {
        calls.push('read')
        return failingRead.read(...args)
      },
      close: async (...args) => {
        calls.push('close')
        return failingRead.close(...args)
      },
    }
    const packet = await runIntake('/fake/big.zip', {
      caps: { ...INTAKE_SAFETY_CAPS, MAX_ARCHIVE_BYTES: 64 },
      openFile: async () => tracked,
    })
    expect(calls).toEqual(['stat', 'close'])
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('ZIP_ARCHIVE_SIZE_LIMIT')
    expect(packet.archive.sha256).toBeNull()
    expect(packet.archive.hashAvailable).toBe(false)
    expect(packet.archive.bytes).toBe(2048)
  })
  it('emits null hash with reason for non-file inputs', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-r1-'))
    tempRoots.push(dir)
    const packet = await runIntake(dir)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('INTAKE_NOT_A_FILE')
    expect(packet.archive.sha256).toBeNull()
    expect(packet.archive.bytes).toBeNull()
    expect(packet.archive.hashUnavailableReason).toBe('INTAKE_NOT_A_FILE')
  })
  it('still emits the true empty hash for a genuinely zero-byte artifact', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-r1-'))
    tempRoots.push(dir)
    const file = path.join(dir, 'empty.zip')
    writeFileSync(file, Buffer.alloc(0))
    const packet = await runIntake(file)
    expect(packet.archive.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(packet.archive.hashAvailable).toBe(true)
    expect(packet.hold.code).toBe('ZIP_TOO_SMALL')
  })
  it('bumps tool and packet schema patch versions', async () => {
    const { INTAKE_TOOL_VERSION, INTAKE_PACKET_SCHEMA } = await import('../../../src/controller/foundation/pixel-intake/intake-runner.mjs')
    expect(INTAKE_TOOL_VERSION).toBe('1.0.1')
    expect(INTAKE_PACKET_SCHEMA).toBe('TRACE-PIXEL-INTAKE-PACKET@1.0.1')
  })
})

describe('R7: review-packet status honesty', () => {
  async function readyPacket() {
    const png = buildPng({ width: 2, height: 2, pixel: opaque })
    const entry = makeAssetEntry({ id: 'R7', assetPath: 'art/r.png', bytes: png, width: 2, height: 2, bounds: { x: 0, y: 0, width: 2, height: 2 } })
    const archive = await writeTempArchive(buildZip([
      { name: 'index.json', data: Buffer.from(JSON.stringify(makeIndex({ assets: [entry] })), 'utf8'), method: 0 },
      { name: 'art/r.png', data: png, method: 0 },
    ]))
    return runIntake(archive)
  }
  it('pins the exact non-PASS review classes on a READY packet', async () => {
    const packet = await readyPacket()
    expect(packet.status).toBe('ADMISSION_READY_FOR_MAIN_REVIEW')
    const evidence = packet.reviewPacket.evidence
    expect(evidence.licenseProvenance).toEqual({ status: 'MISSING', reportSha256: null, externalBinding: null })
    expect(evidence.sequenceContactFitFallback).toEqual({ status: 'MISSING', reportSha256: null, externalBinding: null })
    expect(evidence.externalPrincipalProvenance).toEqual({ status: 'MISSING', reportSha256: null, externalBinding: null })
    expect(evidence.realizationEquivalence.status).toBe('PASS')
  })
  it('proves no packet can appear fully review-complete from declarations alone', async () => {
    const packet = await readyPacket()
    const evidence = packet.reviewPacket.evidence
    expect(Object.values(evidence).every((e) => e.status === 'PASS')).toBe(false)
    expect(packet.reviewPacket.status).toBe('PREPARED_NOT_SENT')
  })
  it('keeps schema-level observations in preliminary diagnostics, not PASS classes', async () => {
    const packet = await readyPacket()
    expect(packet.preliminary.licenseDeclarations).toEqual({ present: true, assets: 1, legalValidityEstablished: false })
    expect(packet.preliminary.contactSchemaFit.visualFitEstablished).toBe(false)
  })
})

describe('R8: error semantics and packet determinism', () => {
  it('maps structural extraction failures to HOLD and keeps operational failures operational', async () => {
    const { classifyExtractionError } = await import('../../../src/controller/foundation/pixel-intake/intake-runner.mjs')
    for (const code of ['ENOTDIR', 'EEXIST', 'EISDIR']) {
      expect(classifyExtractionError(Object.assign(new Error('x'), { code }))).toBe('INTAKE_EXTRACTION_REFUSED')
    }
    for (const code of ['EACCES', 'EPERM', 'ENOSPC', 'ENOENT', null, undefined]) {
      expect(classifyExtractionError(code === null || code === undefined ? new Error('x') : Object.assign(new Error('x'), { code }))).toBeNull()
    }
  })
  it('returns byte-identical HOLD packets for identical hostile inputs', async () => {
    const bytes = buildZip([{ name: '../evil', data: UB('x'), method: 0 }])
    const first = await writeTempArchive(Buffer.from(bytes), 'pack.zip')
    const second = await writeTempArchive(Buffer.from(bytes), 'pack.zip')
    const a = renderPacket(await runIntake(first))
    const b = renderPacket(await runIntake(second))
    expect(a).toBe(b)
    expect(JSON.parse(a).hold.code).toBe('ZIP_TRAVERSAL')
  })
  it('emits no temp paths, PIDs, timestamps, or platform paths in canonical output', async () => {
    const archive = await writeTempArchive(buildZip([{ name: '../evil', data: UB('x'), method: 0 }]))
    const text = renderPacket(await runIntake(archive))
    expect(text).not.toContain(os.tmpdir())
    expect(text).not.toContain('trace-pixel-intake-')
    expect(text).not.toContain('"pid"')
    expect(text).not.toContain('timestamp')
    expect(JSON.parse(text).archive.hashAvailable).toBe(true)
  })
})
