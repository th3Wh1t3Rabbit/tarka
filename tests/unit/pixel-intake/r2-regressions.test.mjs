import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { admitZipArchive } from '../../../src/controller/foundation/pixel-intake/zip-admission.mjs'
import { measurePng } from '../../../src/controller/foundation/pixel-intake/png-measure.mjs'
import { crc32Bytes } from '../../../src/controller/foundation/pixel-intake/crc32.mjs'
import { readBoundedBytes, renderPacket, runIntake } from '../../../src/controller/foundation/pixel-intake/intake-runner.mjs'
import { buildPng, buildZip, encodePngScanlines, expectNoNewTempDirs, UB } from './helpers.mjs'

const codeOf = (fn) => {
  try {
    fn()
  } catch (error) {
    return error.code ?? String(error)
  }
  return 'NO_THROW'
}

const opaque = () => [200, 100, 50, 255]
const tempRoots = []

async function writeTempArchive(bytes, name = 'pack.zip') {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-r2-'))
  tempRoots.push(dir)
  const file = path.join(dir, name)
  writeFileSync(file, bytes)
  return file
}

afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true })
})

describe('R9: strict general-purpose flag subset', () => {
  it('rejects traditional encryption bit 0', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'e.bin', data: UB('x'), method: 0, flags: 0x01 }])))).toBe('ZIP_ENCRYPTED_MEMBER')
  })
  it('rejects strong-encryption bit 6 alone', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'e.bin', data: UB('x'), method: 0, flags: 0x0040 }])))).toBe('ZIP_ENCRYPTED_MEMBER')
  })
  it('rejects masked-header bit 13 alone', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'e.bin', data: UB('x'), method: 0, flags: 0x2000 }])))).toBe('ZIP_ENCRYPTED_MEMBER')
  })
  it('rejects patched-data bit 5', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'p.bin', data: UB('x'), method: 8, flags: 0x0020 }])))).toBe('ZIP_UNSUPPORTED_FLAGS')
  })
  it('rejects reserved high bits such as 0x4000', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'r.bin', data: UB('x'), method: 0, flags: 0x4000 }])))).toBe('ZIP_UNSUPPORTED_FLAGS')
  })
  it('admits valid stored/data-descriptor/UTF-8 combinations', () => {
    for (const flags of [0x00, 0x0800]) {
      expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', data: UB('x'), method: 0, flags }])))).toBe('NO_THROW')
    }
    // Bit-3 members require their exact descriptor under the canonical rules.
    for (const flags of [0x08, 0x0808]) {
      expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', data: UB('x'), method: 0, flags, descriptor: true }])))).toBe('NO_THROW')
    }
  })
  it('admits valid deflated option-bit combinations and preserves equality', () => {
    for (const flags of [0x00, 0x02, 0x04, 0x06, 0x0800]) {
      expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', data: UB('xyz'), method: 8, flags }])))).toBe('NO_THROW')
    }
    for (const flags of [0x08, 0x080e]) {
      expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', data: UB('xyz'), method: 8, flags, descriptor: true }])))).toBe('NO_THROW')
    }
  })
  it('rejects deflate-only option bits on stored members', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', data: UB('x'), method: 0, flags: 0x02 }])))).toBe('ZIP_UNSUPPORTED_FLAGS')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', data: UB('x'), method: 0, flags: 0x04 }])))).toBe('ZIP_UNSUPPORTED_FLAGS')
  })
})

describe('R10: case-folded normalized file/directory closure', () => {
  it('rejects file A + directory a/', () => {
    expect(codeOf(() => admitZipArchive(buildZip([
      { name: 'A', data: UB('file'), method: 0 },
      { name: 'a/', data: Buffer.alloc(0), method: 0, dir: true },
    ])))).toBe('ZIP_CASE_FOLD_COLLISION')
  })
  it('rejects directory a/ + file A (central-entry order)', () => {
    expect(codeOf(() => admitZipArchive(buildZip([
      { name: 'a/', data: Buffer.alloc(0), method: 0, dir: true },
      { name: 'A', data: UB('file'), method: 0 },
    ])))).toBe('ZIP_CASE_FOLD_COLLISION')
  })
  it('rejects the nested pattern file d/A + directory d/a/', () => {
    expect(codeOf(() => admitZipArchive(buildZip([
      { name: 'd/A', data: UB('file'), method: 0 },
      { name: 'd/a/', data: Buffer.alloc(0), method: 0, dir: true },
    ])))).toBe('ZIP_CASE_FOLD_COLLISION')
  })
  it('still admits safe directory nesting regardless of order', () => {
    const forward = buildZip([
      { name: 'a/', data: Buffer.alloc(0), method: 0, dir: true },
      { name: 'a/b/', data: Buffer.alloc(0), method: 0, dir: true },
    ])
    const reverse = buildZip([
      { name: 'a/b/', data: Buffer.alloc(0), method: 0, dir: true },
      { name: 'a/', data: Buffer.alloc(0), method: 0, dir: true },
    ])
    expect(codeOf(() => admitZipArchive(forward))).toBe('NO_THROW')
    expect(codeOf(() => admitZipArchive(reverse))).toBe('NO_THROW')
  })
  it('runner holds deterministically with no temp residue', async () => {
    const archive = await writeTempArchive(buildZip([
      { name: 'index.json', data: Buffer.from('{}', 'utf8'), method: 0 },
      { name: 'A', data: UB('file'), method: 0 },
      { name: 'a/', data: Buffer.alloc(0), method: 0, dir: true },
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
    expect(packet.hold.code).toBe('ZIP_CASE_FOLD_COLLISION')
    await expectNoNewTempDirs(before)
  })
})

describe('R11: exactly one complete zlib stream across IDAT', () => {
  const streamFor = () => deflateSync(encodePngScanlines(2, 2, opaque))
  it('rejects one valid stream followed by one arbitrary byte', () => {
    const png = buildPng({ width: 2, height: 2, pixel: null, rawIdat: Buffer.concat([streamFor(), Buffer.from([0x00])]) })
    expect(codeOf(() => measurePng(png))).toBe('PNG_TRAILING_COMPRESSED_DATA')
  })
  it('rejects one valid stream followed by junk bytes', () => {
    const png = buildPng({ width: 2, height: 2, pixel: null, rawIdat: Buffer.concat([streamFor(), Buffer.from('junkjunkjunk')]) })
    expect(codeOf(() => measurePng(png))).toBe('PNG_TRAILING_COMPRESSED_DATA')
  })
  it('rejects one valid stream followed by a second complete zlib stream', () => {
    const stream = streamFor()
    const png = buildPng({ width: 2, height: 2, pixel: null, rawIdat: Buffer.concat([stream, stream]) })
    expect(codeOf(() => measurePng(png))).toBe('PNG_TRAILING_COMPRESSED_DATA')
  })
  it('preserves valid single and contiguous split IDAT decode', () => {
    expect(measurePng(buildPng({ width: 2, height: 2, pixel: opaque })).pixelCount).toBe(4)
    expect(measurePng(buildPng({ width: 2, height: 2, pixel: opaque, splitIdat: true })).pixelCount).toBe(4)
  })
})

describe('R12: static-PNG structure closure', () => {
  it.each([['acTL'], ['fcTL'], ['fdAT']])('rejects APNG chunk %s anywhere', (type) => {
    const png = buildPng({ width: 2, height: 2, pixel: opaque, ancillary: [[type, Buffer.from([0, 0, 0, 1])]] })
    expect(codeOf(() => measurePng(png))).toBe('PNG_ANIMATION_NOT_SUPPORTED')
  })
  it('rejects lowercase reserved (third) type bytes', () => {
    const png = buildPng({ width: 2, height: 2, pixel: opaque, ancillary: [['abcd', Buffer.alloc(2)]] })
    expect(codeOf(() => measurePng(png))).toBe('PNG_INVALID_CHUNK_TYPE')
  })
  it('rejects non-letter type bytes', () => {
    const png = buildPng({ width: 2, height: 2, pixel: opaque, ancillary: [['AB12', Buffer.alloc(2)]] })
    expect(codeOf(() => measurePng(png))).toBe('PNG_INVALID_CHUNK_TYPE')
  })
  it('continues to pass valid unknown ancillary chunks', () => {
    expect(measurePng(buildPng({ width: 2, height: 2, pixel: opaque, ancillary: [['uNKm', Buffer.from('meta')]] })).pixelCount).toBe(4)
  })
})

function fakeHandle({ size, isFile = true, chunks = [], failOn = null, calls = [] }) {
  const handle = {
    stat: async () => {
      calls.push('stat')
      if (failOn === 'stat') throw Object.assign(new Error('boom'), { code: 'EIO' })
      return { isFile: () => isFile, size }
    },
    read: async (buf, offset, length, position) => {
      calls.push(`read@${position}:${length}`)
      if (failOn === 'read') throw Object.assign(new Error('boom'), { code: 'EIO' })
      const src = Buffer.concat(chunks)
      const n = Math.max(0, Math.min(length, src.length - position))
      if (n <= 0) return { bytesRead: 0, buffer: buf }
      src.copy(buf, offset, position, position + n)
      return { bytesRead: n, buffer: buf }
    },
    close: async () => {
      calls.push('close')
      if (failOn === 'close') throw Object.assign(new Error('boom'), { code: 'EIO' })
    },
  }
  return { calls, handle }
}

describe('R13: bounded single-handle archive read', () => {
  it('reads ordinary files through one handle within the cap', async () => {
    const { readBoundedBytes } = await import('../../../src/controller/foundation/pixel-intake/intake-runner.mjs')
    const { calls, handle } = fakeHandle({ size: 5, chunks: [Buffer.from('hello')] })
    const result = await readBoundedBytes(handle, 64)
    expect(result).toEqual({ body: Buffer.from('hello'), overCap: false, grewAfterMetadata: false, currentSize: 5 })
    expect(calls[0]).toBe('read@0:65')
  })
  it('holds initially over-cap files without body reads', async () => {
    const { calls, handle } = fakeHandle({ size: 2048, chunks: [Buffer.alloc(2048, 3)] })
    let opened = 0
    const packet = await runIntake('/fake/big.zip', {
      caps: { ...(await import('../../../src/controller/foundation/pixel-intake/safety-caps.mjs')).INTAKE_SAFETY_CAPS, MAX_ARCHIVE_BYTES: 64 },
      openFile: async () => {
        opened++
        return handle
      },
    })
    expect(opened).toBe(1)
    expect(calls).toEqual(['stat', 'close'])
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('ZIP_ARCHIVE_SIZE_LIMIT')
    expect(packet.archive.sha256).toBeNull()
    expect(packet.archive.bytes).toBe(2048)
  })
  it('holds when the file grows between metadata and read', async () => {
    const big = Buffer.alloc(200, 7)
    const { calls, handle } = fakeHandle({ size: 10, chunks: [big] })
    let opened = 0
    const packet = await runIntake('/fake/grew.zip', {
      caps: { ...(await import('../../../src/controller/foundation/pixel-intake/safety-caps.mjs')).INTAKE_SAFETY_CAPS, MAX_ARCHIVE_BYTES: 64 },
      openFile: async () => {
        opened++
        return handle
      },
    })
    expect(opened).toBe(1)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('ZIP_ARCHIVE_SIZE_LIMIT')
    expect(packet.hold.detail).toContain('size-changed-after-metadata')
    expect(packet.archive.sha256).toBeNull()
    expect(calls[0]).toBe('stat')
    expect(calls[calls.length - 1]).toBe('close')
    expect(calls.filter((c) => c.startsWith('read@'))).toHaveLength(1)
  })
  it('uses one handle for metadata and bytes on the success path', async () => {
    const body = Buffer.from('tiny')
    const { calls, handle } = fakeHandle({ size: body.length, chunks: [body] })
    const { readBoundedBytes } = await import('../../../src/controller/foundation/pixel-intake/intake-runner.mjs')
    const result = await readBoundedBytes(handle, 64)
    expect(result.body.equals(body)).toBe(true)
    expect(calls.filter((c) => c === 'stat')).toHaveLength(0)
    await handle.close()
    expect(calls[calls.length - 1]).toBe('close')
  })
  it('keeps operational open failures as errors, not HOLD findings', async () => {
    await expect(runIntake('/fake/missing.zip', {
      openFile: async () => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' })
      },
    })).rejects.toThrow('INTAKE_READ_FAILED')
  })
  it('CLI exits 2 on genuine open failures', () => {
    const run = spawnSync(process.execPath, ['scripts/pixel-intake.mjs', '/definitely/not/here.zip'], { encoding: 'utf8' })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('INTAKE_READ_FAILED')
  })
  it('zero-byte and non-file identity semantics remain exact', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-r2-'))
    tempRoots.push(dir)
    const { writeFileSync: write } = await import('node:fs')
    const empty = path.join(dir, 'empty.zip')
    write(empty, Buffer.alloc(0))
    const emptyPacket = await runIntake(empty)
    expect(emptyPacket.archive.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(emptyPacket.archive.hashAvailable).toBe(true)
    const dirPacket = await runIntake(dir)
    expect(dirPacket.archive.sha256).toBeNull()
    expect(dirPacket.archive.bytes).toBeNull()
  })
})
