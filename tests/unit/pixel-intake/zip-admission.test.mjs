import { describe, expect, it } from 'vitest'
import { admitZipArchive, extractAdmittedMember } from '../../../src/controller/foundation/pixel-intake/zip-admission.mjs'
import { crc32Bytes } from '../../../src/controller/foundation/pixel-intake/crc32.mjs'
import { INTAKE_SAFETY_CAPS } from '../../../src/controller/foundation/pixel-intake/safety-caps.mjs'
import { UB, buildZip } from './helpers.mjs'

const codeOf = (fn) => {
  try {
    fn()
  } catch (error) {
    return error.code ?? String(error)
  }
  return 'NO_THROW'
}

describe('CRC-32 vectors', () => {
  it('matches standard IEEE vectors', () => {
    expect(crc32Bytes(Buffer.alloc(0))).toBe(0x00000000)
    expect(crc32Bytes(Buffer.from('123456789', 'ascii'))).toBe(0xcbf43926)
    expect(crc32Bytes(Buffer.from('hello', 'ascii'))).toBe(0x3610a686)
  })
})

describe('ZIP admission: valid archives', () => {
  it('admits a valid minimal organized pack and round-trips bytes', () => {
    const index = Buffer.from('{"schemaVersion":"1.0.0"}', 'utf8')
    const art = Buffer.from('fake-png-bytes-0123456789', 'utf8')
    const zip = buildZip([
      { name: 'art/', data: Buffer.alloc(0), method: 0, dir: true },
      { name: 'index.json', data: index, method: 0 },
      { name: 'art/a.png', data: art, method: 8 },
    ])
    const admitted = admitZipArchive(zip)
    expect(admitted.memberCount).toBe(3)
    expect(admitted.members.map((m) => m.path)).toEqual(['art/', 'index.json', 'art/a.png'])
    expect(extractAdmittedMember(zip, admitted.members[0])).toBeNull()
    expect(extractAdmittedMember(zip, admitted.members[1]).equals(index)).toBe(true)
    expect(extractAdmittedMember(zip, admitted.members[2]).equals(art)).toBe(true)
  })

  it('accepts data-descriptor archives via central-directory authority', () => {
    const data = Buffer.from('streamed-bytes', 'utf8')
    const zip = buildZip([{ name: 's.bin', data, method: 8, flags: 0x08, descriptor: true }])
    const admitted = admitZipArchive(zip)
    expect(extractAdmittedMember(zip, admitted.members[0]).equals(data)).toBe(true)
  })
})

describe('ZIP admission: hostile paths', () => {
  it('rejects parent traversal', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: '../evil', data: UB('x'), method: 0 }])))).toBe('ZIP_TRAVERSAL')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a/../../evil', data: UB('x'), method: 0 }])))).toBe('ZIP_TRAVERSAL')
  })
  it('rejects absolute paths', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: '/abs', data: UB('x'), method: 0 }])))).toBe('ZIP_ABSOLUTE_PATH')
  })
  it('rejects backslash ambiguity', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a\\b', data: UB('x'), method: 0 }])))).toBe('ZIP_BACKSLASH_AMBIGUITY')
  })
  it('rejects duplicate exact names', () => {
    const zip = buildZip([
      { name: 'same.txt', data: UB('one'), method: 0 },
      { name: 'same.txt', data: UB('two'), method: 0 },
    ])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_DUPLICATE_EXACT_NAME')
  })
  it('rejects normalized file/directory collisions', () => {
    const zip = buildZip([
      { name: 'd', data: UB('file'), method: 0 },
      { name: 'd/', data: Buffer.alloc(0), method: 0, dir: true },
    ])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_NORMALIZED_DUPLICATE')
  })
  it('rejects file-over-file prefix conflicts', () => {
    const zip = buildZip([
      { name: 'a', data: UB('file'), method: 0 },
      { name: 'a/b', data: UB('nested'), method: 0 },
    ])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_PATH_PREFIX_CONFLICT')
  })
  it('rejects case-fold collisions', () => {
    const zip = buildZip([
      { name: 'ReadMe.txt', data: UB('one'), method: 0 },
      { name: 'readme.txt', data: UB('two'), method: 0 },
    ])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_CASE_FOLD_COLLISION')
  })
  it('rejects dot segments, empty names, NULs, and invalid encodings', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a/./b', data: UB('x'), method: 0 }])))).toBe('ZIP_DOT_SEGMENT')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a//b', data: UB('x'), method: 0 }])))).toBe('ZIP_DOT_SEGMENT')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: '', data: UB('x'), method: 0 }])))).toBe('ZIP_EMPTY_PATH')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: Buffer.from([0x61, 0x00]), data: UB('x'), method: 0 }])))).toBe('ZIP_NUL_IN_PATH')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: Buffer.from([0xff, 0xfe]), data: UB('x'), method: 0 }])))).toBe('ZIP_INVALID_PATH_ENCODING')
  })
  it('rejects overlong paths at the cap boundary', () => {
    const ok = `p/${'n'.repeat(236)}` // 238 chars total
    expect(ok.length).toBeLessThanOrEqual(INTAKE_SAFETY_CAPS.MAX_PATH_CHARS)
    expect(codeOf(() => admitZipArchive(buildZip([{ name: ok, data: UB('x'), method: 0 }])))).toBe('NO_THROW')
    const over = `p/${'n'.repeat(239)}` // 241 chars total
    expect(codeOf(() => admitZipArchive(buildZip([{ name: over, data: UB('x'), method: 0 }])))).toBe('ZIP_PATH_TOO_LONG')
  })
})

describe('ZIP admission: special members and methods', () => {
  it('rejects symlinks and special members', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'link', data: UB('tgt'), method: 0, unixMode: 0o120777 }])))).toBe('ZIP_SYMLINK_MEMBER')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'fifo', data: UB('x'), method: 0, unixMode: 0o10777 }])))).toBe('ZIP_SPECIAL_MEMBER')
  })
  it('rejects encrypted members', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'e.bin', data: UB('x'), method: 0, flags: 0x01 }])))).toBe('ZIP_ENCRYPTED_MEMBER')
  })
  it('rejects unsupported methods', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'b.bin', data: UB('x'), method: 12 }])))).toBe('ZIP_UNSUPPORTED_METHOD')
  })
  it('rejects unsupported versions', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'v.bin', data: UB('x'), method: 0, versionNeeded: 99 }])))).toBe('ZIP_UNSUPPORTED_VERSION')
  })
  it('rejects directories carrying data', () => {
    const zip = buildZip([{ name: 'd/', data: UB('x'), method: 0, dir: true }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_DIRECTORY_WITH_DATA')
  })
})

describe('ZIP admission: structural integrity', () => {
  it('rejects multi-disk archives', () => {
    const zip = buildZip([{ name: 'a', data: UB('x'), method: 0 }], { eocdDisk: 1 })
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_MULTI_DISK')
  })
  it('rejects ZIP64 markers explicitly', () => {
    const zip = buildZip([{ name: 'a', data: UB('x'), method: 0 }], { appendZip64Locator: true })
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP64_NOT_SUPPORTED')
    const extra = buildZip([{ name: 'a', data: UB('x'), method: 0, extraCentral: Buffer.from([0x01, 0x00, 0x00, 0x00]) }])
    expect(codeOf(() => admitZipArchive(extra))).toBe('ZIP64_NOT_SUPPORTED')
  })
  it('rejects missing EOCD', () => {
    expect(codeOf(() => admitZipArchive(Buffer.from('not-a-zip-at-all-padding!!', 'utf8')))).toBe('ZIP_EOCD_NOT_FOUND')
  })
  it('rejects local/central identity mismatches', () => {
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', localName: 'b', data: UB('x'), method: 0 }])))).toBe('ZIP_LOCAL_CENTRAL_NAME_MISMATCH')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', localMethod: 8, data: UB('x'), method: 0 }])))).toBe('ZIP_LOCAL_CENTRAL_METHOD_MISMATCH')
    expect(codeOf(() => admitZipArchive(buildZip([{ name: 'a', localFlags: 0x08, data: UB('x'), method: 0, flags: 0 }])))).toBe('ZIP_LOCAL_CENTRAL_FLAG_MISMATCH')
  })
  it('detects CRC mismatch at extraction', () => {
    const zip = buildZip([{ name: 'c.bin', data: UB('payload'), method: 0, crc: 0xdeadbeef }])
    const admitted = admitZipArchive(zip)
    expect(codeOf(() => extractAdmittedMember(zip, admitted.members[0]))).toBe('ZIP_CRC_MISMATCH')
  })
  it('detects size lies at extraction', () => {
    const zip = buildZip([{ name: 's.bin', data: UB('short'), method: 0, uncompSize: 500 }])
    const admitted = admitZipArchive(zip)
    expect(codeOf(() => extractAdmittedMember(zip, admitted.members[0]))).toBe('ZIP_SIZE_MISMATCH')
  })
  it('rejects corrupt deflate streams', () => {
    const zip = buildZip([{ name: 'z.bin', data: UB('unused'), method: 8, deflatedData: Buffer.from([0xff, 0xff, 0xff]), compSize: 3, uncompSize: 3 }])
    const admitted = admitZipArchive(zip)
    expect(codeOf(() => extractAdmittedMember(zip, admitted.members[0]))).toMatch(/ZIP_INFLATE_FAILED|ZIP_CRC_MISMATCH|ZIP_SIZE_MISMATCH/)
  })
})

describe('ZIP admission: safety caps', () => {
  it('enforces the member-count cap', () => {
    const members = Array.from({ length: INTAKE_SAFETY_CAPS.MAX_MEMBERS + 1 }, (_, i) => ({ name: `f${i}.t`, data: UB('x'), method: 0 }))
    expect(codeOf(() => admitZipArchive(buildZip(members)))).toBe('ZIP_MEMBER_COUNT_LIMIT')
    const boundary = Array.from({ length: INTAKE_SAFETY_CAPS.MAX_MEMBERS }, (_, i) => ({ name: `g${i}.t`, data: UB('x'), method: 0 }))
    expect(codeOf(() => admitZipArchive(buildZip(boundary)))).toBe('NO_THROW')
  }, 30000)
  it('enforces the per-member size cap', () => {
    const over = INTAKE_SAFETY_CAPS.MAX_MEMBER_UNCOMPRESSED_BYTES + 1
    const zip = buildZip([{ name: 'big.bin', data: UB('x'), method: 0, compSize: 1, uncompSize: over }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_MEMBER_SIZE_LIMIT')
  })
  it('admits and extracts an exactly-16MiB member', () => {
    // Deterministic incompressible payload: passes the ratio cap honestly.
    const size = INTAKE_SAFETY_CAPS.MAX_MEMBER_UNCOMPRESSED_BYTES
    const data = Buffer.alloc(size)
    let seed = 0x12345678
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      data[i] = (seed >>> 24) & 0xff
    }
    const zip = buildZip([{ name: 'edge.bin', data, method: 8 }])
    const admitted = admitZipArchive(zip)
    expect(extractAdmittedMember(zip, admitted.members[0]).equals(data)).toBe(true)
  }, 60000)
  it('enforces the aggregate-size cap from central sizes', () => {
    // 33 members x exactly 16 MiB declared each (real 164 KiB stored bytes
    // each, ratio exactly 100): every member passes member/ratio caps while
    // the 528 MiB aggregate exceeds the 512 MiB cap.
    const each = INTAKE_SAFETY_CAPS.MAX_MEMBER_UNCOMPRESSED_BYTES
    const members = Array.from({ length: 33 }, (_, i) => ({ name: `a${i}.bin`, data: Buffer.alloc(167773, i), method: 0, uncompSize: each }))
    expect(codeOf(() => admitZipArchive(buildZip(members)))).toBe('ZIP_AGGREGATE_SIZE_LIMIT')
  })
  it('enforces the expansion-ratio cap', () => {
    const zip = buildZip([{ name: 'bomb.bin', data: UB('0123456789'), method: 0, compSize: 10, uncompSize: 10 * (INTAKE_SAFETY_CAPS.MAX_EXPANSION_RATIO + 1) }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_EXPANSION_RATIO_LIMIT')
    const edge = buildZip([{ name: 'ok.bin', data: UB('0123456789'), method: 0, compSize: 10, uncompSize: 10 * INTAKE_SAFETY_CAPS.MAX_EXPANSION_RATIO }])
    expect(codeOf(() => admitZipArchive(edge))).toBe('NO_THROW')
  })
  it('enforces the archive-bytes cap first', () => {
    const tiny = { ...INTAKE_SAFETY_CAPS, MAX_ARCHIVE_BYTES: 64 }
    expect(codeOf(() => admitZipArchive(Buffer.alloc(65, 1), tiny))).toBe('ZIP_ARCHIVE_SIZE_LIMIT')
  })
  it('rejects impossible zero-compressed nonzero-output sizes', () => {
    const zip = buildZip([{ name: 'imp.bin', data: Buffer.alloc(0), method: 0, compSize: 0, uncompSize: 5 }])
    expect(codeOf(() => admitZipArchive(zip))).toBe('ZIP_IMPOSSIBLE_SIZES')
  })
})
