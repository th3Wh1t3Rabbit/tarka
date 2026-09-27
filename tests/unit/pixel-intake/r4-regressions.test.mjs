import { mkdtempSync, rmSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { admitZipArchive, extractAdmittedMember } from '../../../src/controller/foundation/pixel-intake/zip-admission.mjs'
import { renderPacket, runIntake } from '../../../src/controller/foundation/pixel-intake/intake-runner.mjs'
import { buildPng, buildZip, makeAssetEntry, makeIndex, UB } from './helpers.mjs'

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
  const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-r4-'))
  tempRoots.push(dir)
  const file = path.join(dir, name)
  writeFileSync(file, bytes)
  return file
}

afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true })
})

describe('R19: canonical bit-3 local CRC/size values', () => {
  it('1. bit-3 zeros + exact signed descriptor passes and round-trips', () => {
    const data = UB('zero-placeholder-stream')
    const zip = buildZip([{ name: 's.bin', data, method: 8, flags: 0x08, localCrc: 0, localComp: 0, localUncomp: 0, descriptor: true }])
    const admitted = admitZipArchive(zip)
    expect(extractAdmittedMember(zip, admitted.members[0]).equals(data)).toBe(true)
  })
  it('2. bit-3 exact-central values + exact signed descriptor passes', () => {
    const data = UB('exact-central-values')
    const zip = buildZip([{ name: 's.bin', data, method: 8, flags: 0x08, descriptor: true }])
    const admitted = admitZipArchive(zip)
    expect(extractAdmittedMember(zip, admitted.members[0]).equals(data)).toBe(true)
  })
  it('3. contradictory local CRC rejects with field detail', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('x'), method: 8, flags: 0x08, localCrc: 0x12345678, descriptor: true }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH')
    expect(detailOf(() => admitZipArchive(zip))).toContain('field=crc32')
  })
  it('4. contradictory local compressed size rejects with field detail', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('0123456789abcdef'), method: 8, flags: 0x08, localComp: 1234, descriptor: true }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH')
    expect(detailOf(() => admitZipArchive(zip))).toContain('field=compressedSize')
  })
  it('5. contradictory local uncompressed size rejects with field detail', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('0123456789abcdef'), method: 8, flags: 0x08, localUncomp: 5678, descriptor: true }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH')
    expect(detailOf(() => admitZipArchive(zip))).toContain('field=uncompressedSize')
  })
  it('6. local compressed-size ZIP64 sentinel rejects as ZIP64', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('x'), method: 8, flags: 0x08, localComp: 0xffffffff, descriptor: true }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP64_NOT_SUPPORTED')
  })
  it('7. local uncompressed-size ZIP64 sentinel rejects as ZIP64', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('x'), method: 8, flags: 0x08, localUncomp: 0xffffffff, descriptor: true }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP64_NOT_SUPPORTED')
  })
  it('does not reject CRC32 0xffffffff when central agrees exactly', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('x'), method: 8, flags: 0x08, crc: 0xffffffff, localCrc: 0xffffffff, descriptor: true }])
    // Admission passes the CRC rule (exact equality); extraction then fails
    // honestly on the real CRC, proving no silent pass-through.
    const admitted = admitZipArchive(zip)
    expect(codeOf(() => extractAdmittedMember(zip, admitted.members[0]))).toBe('ZIP_CRC_MISMATCH')
  })
})

describe('R20: local/central version-needed identity', () => {
  it('8. version disagreement rejects with the exact version code', () => {
    const zip = buildZip([{ name: 'v.bin', data: UB('x'), method: 0, localVersion: 99 }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_LOCAL_CENTRAL_VERSION_MISMATCH')
    expect(detailOf(() => admitZipArchive(zip))).toContain('local=99 central=20')
  })
  it('matching versions still admit', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'v.bin', data: UB('x'), method: 0, localVersion: 20 }])))).toBe('NO_THROW')
  })
})

describe('R21: central per-entry ZIP64 sentinel closure', () => {
  it('9. central compressed-size sentinel rejects', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('x'), method: 0 }])
    expect(codeOf(() => admitZipArchive(sentinelCentral(zip, { compSize: 0xffffffff })))).toBe('ZIP64_NOT_SUPPORTED')
  })
  it('9. central uncompressed-size sentinel rejects', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('x'), method: 0 }])
    expect(codeOf(() => admitZipArchive(sentinelCentral(zip, { uncompSize: 0xffffffff })))).toBe('ZIP64_NOT_SUPPORTED')
  })
  it('9. central local-offset sentinel rejects', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('x'), method: 0 }])
    expect(codeOf(() => admitZipArchive(sentinelCentral(zip, { localOffset: 0xffffffff })))).toBe('ZIP64_NOT_SUPPORTED')
  })
  it('9. central disk-start sentinel rejects', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('x'), method: 0 }])
    expect(codeOf(() => admitZipArchive(sentinelCentral(zip, { diskStart: 0xffff })))).toBe('ZIP64_NOT_SUPPORTED')
  })
})

// Rewrites one central-directory field of the single entry, keeping every
// other byte (including EOCD consistency) intact. All fields little-endian.
function sentinelCentral(zip, { compSize, uncompSize, localOffset, diskStart }) {
  const out = Buffer.from(zip)
  const eocd = out.length - 22
  const centralOffset = out.readUInt32LE(eocd + 16)
  if (compSize !== undefined) out.writeUInt32LE(compSize >>> 0, centralOffset + 20)
  if (uncompSize !== undefined) out.writeUInt32LE(uncompSize >>> 0, centralOffset + 24)
  if (localOffset !== undefined) out.writeUInt32LE(localOffset >>> 0, centralOffset + 42)
  if (diskStart !== undefined) out.writeUInt16LE(diskStart, centralOffset + 34)
  return out
}

describe('R19–R21 runner: the complete malformed-local-header fixture', () => {
  it('10. MAIN malformed fixture holds and never safeArchive-PASSes', async () => {
    const png = buildPng({ width: 4, height: 4, pixel: opaque })
    const entry = makeAssetEntry({ id: 'M', assetPath: 'art/m.png', bytes: png, width: 4, height: 4, bounds: { x: 0, y: 0, width: 4, height: 4 } })
    const index = makeIndex({ assets: [entry] })
    const archive = await writeTempArchive(buildZip([
      { name: 'index.json', data: Buffer.from(JSON.stringify(index), 'utf8'), method: 0 },
      {
        name: 'art/m.png',
        data: png,
        method: 8,
        flags: 0x08,
        localVersion: 99,
        localCrc: 0x12345678,
        localComp: 0xffffffff,
        localUncomp: 0xffffffff,
        descriptor: true,
      },
    ]))
    const packet = await runIntake(archive)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('ZIP_LOCAL_CENTRAL_VERSION_MISMATCH')
    expect(packet.reviewPacket).toBeNull()
    expect(renderPacket(packet)).not.toContain('"safeArchive":{"status":"PASS"')
  })
})
