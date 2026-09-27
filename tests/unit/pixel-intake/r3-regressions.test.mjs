import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { admitZipArchive, extractAdmittedMember } from '../../../src/controller/foundation/pixel-intake/zip-admission.mjs'
import { classifyExtractionError, renderPacket, runIntake } from '../../../src/controller/foundation/pixel-intake/intake-runner.mjs'
import { INTAKE_SAFETY_CAPS } from '../../../src/controller/foundation/pixel-intake/safety-caps.mjs'
import { buildZip, expectNoNewTempDirs, UB } from './helpers.mjs'

const codeOf = (fn) => {
  try {
    fn()
  } catch (error) {
    return error.code ?? String(error)
  }
  return 'NO_THROW'
}

const tempRoots = []

async function writeTempArchive(bytes, name = 'pack.zip') {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-r3-'))
  tempRoots.push(dir)
  const file = path.join(dir, name)
  writeFileSync(file, bytes)
  return file
}

afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true })
})

describe('R15: exactly one raw-deflate stream per member', () => {
  it('rejects a valid raw stream followed by one byte', () => {
    const zip = buildZip([{ name: 't.bin', data: UB('stream-payload-bytes'), method: 8, trailingBytes: Buffer.from([0x00]) }])
    const admitted = admitZipArchive(zip)
    expect(codeOf(() => extractAdmittedMember(zip, admitted.members[0]))).toBe('ZIP_TRAILING_COMPRESSED_DATA')
  })
  it('rejects a valid raw stream followed by junk', () => {
    const zip = buildZip([{ name: 't.bin', data: UB('stream-payload-bytes'), method: 8, trailingBytes: Buffer.from('junkjunkjunk') }])
    const admitted = admitZipArchive(zip)
    expect(codeOf(() => extractAdmittedMember(zip, admitted.members[0]))).toBe('ZIP_TRAILING_COMPRESSED_DATA')
  })
  it('rejects a valid raw stream followed by a second complete stream', () => {
    const zip = buildZip([{ name: 't.bin', data: UB('first-stream-payload'), method: 8, trailingBytes: deflateRawSync(UB('second-stream')) }])
    const admitted = admitZipArchive(zip)
    expect(codeOf(() => extractAdmittedMember(zip, admitted.members[0]))).toBe('ZIP_TRAILING_COMPRESSED_DATA')
  })
  it('passes valid ordinary and empty deflated members', () => {
    const full = buildZip([{ name: 'ok.bin', data: UB('ordinary-deflated-content'), method: 8 }])
    const admitted = admitZipArchive(full)
    expect(extractAdmittedMember(full, admitted.members[0]).equals(UB('ordinary-deflated-content'))).toBe(true)
    const empty = buildZip([{ name: 'empty.bin', data: Buffer.alloc(0), method: 8 }])
    const admittedEmpty = admitZipArchive(empty)
    expect(extractAdmittedMember(empty, admittedEmpty.members[0]).length).toBe(0)
  })
  it('runner converts the structural rejection into deterministic HOLD', async () => {
    const archive = await writeTempArchive(buildZip([
      { name: 'index.json', data: Buffer.from('{}', 'utf8'), method: 0 },
      { name: 't.bin', data: UB('stream-payload-bytes'), method: 8, trailingBytes: Buffer.from([0x00]) },
    ]))
    const packet = await runIntake(archive)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('ZIP_TRAILING_COMPRESSED_DATA')
  })
})

describe('R16: canonical local-record topology and descriptors', () => {
  it('passes an ordinary archive with no preamble', () => {
    const zip = buildZip([
      { name: 'b.txt', data: UB('bravo'), method: 0 },
      { name: 'a.txt', data: UB('alpha'), method: 8 },
    ])
    expect(codeOf(() => admitZipArchive(zip))).toBe('NO_THROW')
  })
  it('rejects arbitrary preamble bytes', () => {
    const zip = buildZip([{ name: 'a', data: UB('x'), method: 0 }], { preamble: Buffer.from('SFX-STUB-BYTES!') })
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_UNCLAIMED_LOCAL_BYTES')
  })
  it('rejects gaps between local records', () => {
    const zip = buildZip([
      { name: 'a', data: UB('alpha'), method: 0, padAfter: Buffer.from('hidden-bytes') },
      { name: 'b', data: UB('beta'), method: 0 },
    ])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_RECORD_LAYOUT_MISMATCH')
  })
  it('rejects gaps before the central directory', () => {
    const zip = buildZip([{ name: 'a', data: UB('x'), method: 0 }], { trailerGap: Buffer.from('unclaimed') })
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_UNCLAIMED_LOCAL_BYTES')
  })
  it('rejects overlapping local records', () => {
    // Member B's central entry points inside A's data, where a planted
    // byte-exact local header for B satisfies every per-entry identity
    // check — so only the topology layer can catch the overlap.
    expect(codeOf(() => admitZipArchive(buildOverlappingPair()))).toBe('ZIP_LOCAL_RECORD_LAYOUT_MISMATCH')
  })
  it('passes bit-3 members with exact signed descriptors', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('streamed-signed'), method: 8, flags: 0x08, descriptor: true }])
    const admitted = admitZipArchive(zip)
    expect(admitted.members[0].descriptorForm).toBe('signed-16')
    expect(extractAdmittedMember(zip, admitted.members[0]).equals(UB('streamed-signed'))).toBe(true)
  })
  it('passes bit-3 members with exact unsigned descriptors', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('streamed-unsigned'), method: 8, flags: 0x08, descriptor: { signed: false } }])
    const admitted = admitZipArchive(zip)
    expect(admitted.members[0].descriptorForm).toBe('unsigned-12')
    expect(extractAdmittedMember(zip, admitted.members[0]).equals(UB('streamed-unsigned'))).toBe(true)
  })
  it('rejects bit-3 members with no descriptor', () => {
    // Two contiguous records: the first carries bit 3 but no descriptor.
    const zip = buildZip([
      { name: 'a', data: UB('alpha'), method: 8, flags: 0x08 },
      { name: 'b', data: UB('beta'), method: 0 },
    ])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_DATA_DESCRIPTOR_MISSING')
  })
  it('rejects bit-3 members with wrong descriptor values', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('streamed'), method: 8, flags: 0x08, descriptor: { crc: 0xdeadbeef } }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_DATA_DESCRIPTOR_MISMATCH')
  })
  it('rejects truncated descriptors', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('streamed'), method: 8, flags: 0x08, descriptorBytes: Buffer.alloc(5, 9) }], {})
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_DATA_DESCRIPTOR_TRUNCATED')
  })
  it('passes reversed central order over canonical physical topology', () => {
    const zip = buildZip(
      [
        { name: 'b.txt', data: UB('bravo'), method: 0 },
        { name: 'a.txt', data: UB('alpha'), method: 8 },
      ],
      { centralOrder: [1, 0] },
    )
    const admitted = admitZipArchive(zip)
    expect(admitted.members.map((m) => m.path)).toEqual(['a.txt', 'b.txt'])
    expect(extractAdmittedMember(zip, admitted.members[0]).equals(UB('alpha'))).toBe(true)
  })
})

import { crc32Bytes } from '../../../src/controller/foundation/pixel-intake/crc32.mjs'

// Builds an archive where member B's central entry points inside member A's
// data at a planted byte-exact local header for B. Every per-entry check
// (name, method, flags, CRC, sizes) passes there; only the topology layer
// sees that B's region overlaps A's.
function localHeader(name, crc, size) {
  const nb = Buffer.from(name, 'utf8')
  const fixed = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
  const lens = Buffer.alloc(12)
  lens.writeUInt32LE(crc >>> 0, 0)
  lens.writeUInt32LE(size >>> 0, 4)
  lens.writeUInt32LE(size >>> 0, 8)
  const counts = Buffer.from([0x01, 0x00, 0x00, 0x00])
  return Buffer.concat([fixed, lens, counts, nb])
}

function centralEntry(name, crc, size, localOffset) {
  const nb = Buffer.from(name, 'utf8')
  const h = Buffer.alloc(46)
  h.writeUInt32LE(0x02014b50, 0)
  h.writeUInt16LE(20, 6)
  h.writeUInt16LE(0, 8)
  h.writeUInt16LE(0, 10)
  h.writeUInt32LE(crc >>> 0, 16)
  h.writeUInt32LE(size >>> 0, 20)
  h.writeUInt32LE(size >>> 0, 24)
  h.writeUInt16LE(nb.length, 28)
  h.writeUInt32LE(localOffset >>> 0, 42)
  return Buffer.concat([h, nb])
}

function buildOverlappingPair() {
  const bData = Buffer.from('BBBB', 'utf8')
  const bCrc = crc32Bytes(bData)
  const plantedB = localHeader('b', bCrc, bData.length)
  const aPayload = Buffer.concat([Buffer.from('PP', 'utf8'), plantedB, bData])
  const aCrc = crc32Bytes(aPayload)
  const aHeader = localHeader('a', aCrc, aPayload.length)
  const bPlantedStart = aHeader.length + 2 // inside A's data, after 'PP'
  // A dead but well-formed second B record keeps the file otherwise ordinary.
  const bHeader = localHeader('b', bCrc, bData.length)
  const centralBytes = Buffer.concat([
    centralEntry('a', aCrc, aPayload.length, 0),
    centralEntry('b', bCrc, bData.length, bPlantedStart),
  ])
  const centralOffset = aHeader.length + aPayload.length + bHeader.length + bData.length
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(2, 8)
  eocd.writeUInt16LE(2, 10)
  eocd.writeUInt32LE(centralBytes.length, 12)
  eocd.writeUInt32LE(centralOffset, 16)
  return Buffer.concat([aHeader, aPayload, bHeader, bData, centralBytes, eocd])
}

describe('R17: pre-extraction path byte safety', () => {
  it('holds the 70-emoji single-segment case deterministically', async () => {
    const name = '😀'.repeat(70)
    expect([...name].length).toBe(70)
    expect(Buffer.byteLength(name, 'utf8')).toBe(280)
    const archive = await writeTempArchive(buildZip([{ name, data: UB('x'), method: 0 }]))
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
    expect(packet.hold.code).toBe('ZIP_PATH_TOO_LONG')
    expect(packet.hold.detail).toContain('chars=140')
    expect(packet.hold.detail).toContain('bytes=280')
    const { expectNoNewTempDirs } = await import('./helpers.mjs')
    await expectNoNewTempDirs(before)
  })
  it('maps ENAMETOOLONG to deterministic HOLD as defense in depth', async () => {
    const { classifyExtractionError } = await import('../../../src/controller/foundation/pixel-intake/intake-runner.mjs')
    expect(classifyExtractionError(Object.assign(new Error('x'), { code: 'ENAMETOOLONG' }))).toBe('INTAKE_EXTRACTION_REFUSED')
  })
  it('preserves ordinary ASCII and supported UTF-8 paths within both caps', () => {
    const utf = `café-${'☃'.repeat(20)}.txt`
    expect(Buffer.byteLength(utf, 'utf8')).toBeLessThanOrEqual(240)
    expect(codeOf(() => admitZipArchive(buildZip([{ name: utf, data: UB('x'), method: 0 }])))).toBe('NO_THROW')
  })
})

describe('R18: truthful bounded-read evidence', () => {
  it('reports the same-handle current size on growth, not the stale size', async () => {
    const { INTAKE_SAFETY_CAPS } = await import('../../../src/controller/foundation/pixel-intake/safety-caps.mjs')
    const big = Buffer.alloc(200, 7)
    // The file grows between the first fstat (10) and the re-stat (200):
    // the packet must report the observed current size, not the stale one.
    const sizes = [10, 200]
    const calls = []
    const handle = {
      stat: async () => {
        calls.push('stat')
        return { isFile: () => true, size: sizes.length > 1 ? sizes.shift() : sizes[0] }
      },
      read: async (buf, offset, length, position) => {
        calls.push(`read@${position}:${length}`)
        const n = Math.max(0, Math.min(length, big.length - position))
        if (n <= 0) return { bytesRead: 0, buffer: buf }
        big.copy(buf, offset, position, position + n)
        return { bytesRead: n, buffer: buf }
      },
      close: async () => {
        calls.push('close')
      },
    }
    let opened = 0
    const packet = await runIntake('/fake/grew.zip', {
      caps: { ...INTAKE_SAFETY_CAPS, MAX_ARCHIVE_BYTES: 64 },
      openFile: async () => {
        opened++
        return handle
      },
    })
    expect(opened).toBe(1)
    expect(packet.hold.code).toBe('ZIP_ARCHIVE_SIZE_LIMIT')
    expect(packet.archive.bytes).toBe(200)
    expect(packet.archive.sha256).toBeNull()
  })
  it('serializes the actual applied caps, including overrides', async () => {
    const { INTAKE_SAFETY_CAPS } = await import('../../../src/controller/foundation/pixel-intake/safety-caps.mjs')
    const archive = await writeTempArchive(buildZip([{ name: '../evil', data: UB('x'), method: 0 }]))
    const packet = await runIntake(archive, { caps: { ...INTAKE_SAFETY_CAPS, MAX_ARCHIVE_BYTES: 64 } })
    expect(packet.safetyCaps.values.MAX_ARCHIVE_BYTES).toBe(64)
    const plain = await runIntake(archive)
    expect(plain.safetyCaps.values.MAX_ARCHIVE_BYTES).toBe(INTAKE_SAFETY_CAPS.MAX_ARCHIVE_BYTES)
  })
})

describe('R15 runner conversion', () => {
  it('converts trailing-compressed-data rejection into deterministic HOLD', async () => {
    const archive = await writeTempArchive(buildZip([
      { name: 'index.json', data: Buffer.from('{}', 'utf8'), method: 0 },
      { name: 't.bin', data: UB('stream-payload-bytes'), method: 8, trailingBytes: Buffer.from([0x00]) },
    ]))
    const packet = await runIntake(archive)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('ZIP_TRAILING_COMPRESSED_DATA')
  })
})
