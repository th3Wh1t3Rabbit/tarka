// Safe ZIP admission parser for Pixel archive intake.
// Treats the input as hostile: parses and validates the full archive from the
// central directory before any member is extracted. Central-directory values
// are authoritative for offsets and sizes; local headers are verified for
// identity. Supported subset: stored (0) and deflated (8) members, no
// encryption, no multi-disk, no ZIP64, no data-descriptor reliance.
// Node standard library only (node:zlib for inflate).
import { inflateRawSync } from 'node:zlib'
import { crc32Bytes } from './crc32.mjs'
import { INTAKE_SAFETY_CAPS } from './safety-caps.mjs'

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
const SIG_EOCD64_LOCATOR = 0x07064b50
const METHOD_STORED = 0
const METHOD_DEFLATED = 8
const FLAG_ENCRYPTED = 0x0001
const FLAG_DATA_DESCRIPTOR = 0x0008
// Supported general-purpose flag subset (exact):
// - stored (0): bit 3 (data descriptor), bit 11 (UTF-8 names) only;
// - deflated (8): bits 1-2 (deflate options), bit 3, bit 11 only.
// Encryption-adjacent bits always report ZIP_ENCRYPTED_MEMBER, even when
// bit 0 is absent; every other disallowed bit reports ZIP_UNSUPPORTED_FLAGS.
const FLAG_BITS_1_2 = 0x0002 | 0x0004
const FLAG_BIT_3 = 0x0008
const FLAG_UTF8 = 0x0800
const FLAG_STRONG_ENCRYPTION = 0x0040
const FLAG_MASKED_HEADERS = 0x2000
const FLAG_PATCHED_DATA = 0x0020
const ENCRYPTION_BITS = FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION | FLAG_MASKED_HEADERS
const EXTRA_ZIP64 = 0x0001
const MAX_VERSION_NEEDED = 45

export class ZipAdmissionError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'ZipAdmissionError'
    this.code = code
  }
}

const fail = (code, detail) => {
  throw new ZipAdmissionError(code, detail)
}

function bounds(bytes, offset, length, code) {
  if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) fail(code, `offset=${offset} length=${length} total=${bytes.length}`)
}

const u16 = (bytes, offset) => {
  bounds(bytes, offset, 2, 'ZIP_TRUNCATED')
  return bytes[offset] | (bytes[offset + 1] << 8)
}

const u32 = (bytes, offset) => {
  bounds(bytes, offset, 4, 'ZIP_TRUNCATED')
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

const utf8 = (bytes) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    fail('ZIP_INVALID_PATH_ENCODING')
  }
}

function locateEocd(bytes) {
  // End-of-central-directory record with comment: scan the last 64 KiB + 22.
  const tail = Math.max(0, bytes.length - 65535 - 22)
  for (let at = bytes.length - 22; at >= tail; at--) {
    if (u32(bytes, at) !== SIG_EOCD) continue
    const disk = u16(bytes, at + 4)
    const centralDisk = u16(bytes, at + 6)
    const entriesThisDisk = u16(bytes, at + 8)
    const entriesTotal = u16(bytes, at + 10)
    const centralSize = u32(bytes, at + 12)
    const centralOffset = u32(bytes, at + 16)
    const commentLength = u16(bytes, at + 20)
    if (at + 22 + commentLength !== bytes.length) continue
    if (centralOffset + centralSize !== at && !(centralSize === 0 && centralOffset === at)) continue
    return { disk, centralDisk, entriesThisDisk, entriesTotal, centralSize, centralOffset }
  }
  fail('ZIP_EOCD_NOT_FOUND')
}

function hasZip64Locator(bytes) {
  const tail = Math.max(0, bytes.length - 65535 - 42)
  for (let at = bytes.length - 4; at >= tail; at--) {
    if (u32(bytes, at) === SIG_EOCD64_LOCATOR) return true
  }
  return false
}

function checkExtraFields(bytes, offset, length) {
  let at = offset
  const end = offset + length
  while (at < end) {
    bounds(bytes, at, 4, 'ZIP_TRUNCATED_EXTRA')
    const id = u16(bytes, at)
    const size = u16(bytes, at + 2)
    if (id === EXTRA_ZIP64) fail('ZIP64_NOT_SUPPORTED', 'zip64 extra field')
    // Declared payload must fit inside the extra-field region itself, not
    // merely inside the file: otherwise one field overruns its neighbors.
    if (size > end - (at + 4)) fail('ZIP_TRUNCATED_EXTRA', `id=${id} size=${size}`)
    bounds(bytes, at + 4, size, 'ZIP_TRUNCATED_EXTRA')
    at += 4 + size
  }
  if (at !== end) fail('ZIP_MALFORMED_EXTRA', 'overrun')
}

// Unix file-type bits from the external-attributes high word.
function unixFileType(externalAttrs, madeBy) {
  if ((madeBy >>> 8) !== 3) return 'UNKNOWN'
  const mode = (externalAttrs >>> 16) & 0o170000
  if (mode === 0o120000) return 'SYMLINK'
  if (mode === 0o040000) return 'DIRECTORY'
  if (mode === 0o100000 || mode === 0) return 'REGULAR'
  return 'SPECIAL'
}

function validatePath(name, caps) {
  if (name.length === 0) fail('ZIP_EMPTY_PATH')
  // Decoded-character cap plus UTF-8 byte cap: a path that decodes short
  // can still exceed filesystem component limits when multibyte. Both
  // bounds report deterministically.
  const byteLength = Buffer.byteLength(name, 'utf8')
  if (name.length > caps.MAX_PATH_CHARS || byteLength > caps.MAX_PATH_BYTES) {
    fail('ZIP_PATH_TOO_LONG', `chars=${name.length} bytes=${byteLength}`)
  }
  if (name.includes('\0')) fail('ZIP_NUL_IN_PATH')
  if (name.includes('\\')) fail('ZIP_BACKSLASH_AMBIGUITY')
  if (name.startsWith('/')) fail('ZIP_ABSOLUTE_PATH')
  const directory = name.endsWith('/')
  const body = directory ? name.slice(0, -1) : name
  if (body.length === 0) fail('ZIP_EMPTY_PATH')
  for (const segment of body.split('/')) {
    if (segment === '' || segment === '.') fail('ZIP_DOT_SEGMENT', segment === '' ? 'empty segment' : 'dot segment')
    if (segment === '..') fail('ZIP_TRAVERSAL')
  }
  return { directory }
}

function admitCentralEntry(bytes, at, index, caps, seenExact, seenFolded) {
  if (u32(bytes, at) !== SIG_CENTRAL) fail('ZIP_CENTRAL_SIGNATURE', `index=${index}`)
  const madeBy = u16(bytes, at + 4)
  const versionNeeded = u16(bytes, at + 6)
  const flags = u16(bytes, at + 8)
  const method = u16(bytes, at + 10)
  const crc = u32(bytes, at + 16)
  const compSize = u32(bytes, at + 20)
  const uncompSize = u32(bytes, at + 24)
  const nameLen = u16(bytes, at + 28)
  const extraLen = u16(bytes, at + 30)
  const commentLen = u16(bytes, at + 32)
  const diskStart = u16(bytes, at + 34)
  const externalAttrs = u32(bytes, at + 38)
  const localOffset = u32(bytes, at + 42)
  if (versionNeeded > MAX_VERSION_NEEDED) fail('ZIP_UNSUPPORTED_VERSION', `needed=${versionNeeded}`)
  // Central per-entry ZIP64 sentinels reject before offset/size use, with
  // ZIP64 semantics rather than a downstream bound or multi-disk code.
  if (compSize === 0xffffffff || uncompSize === 0xffffffff || localOffset === 0xffffffff || diskStart === 0xffff) {
    fail('ZIP64_NOT_SUPPORTED', `index=${index} central-sentinel`)
  }
  if (flags & ENCRYPTION_BITS) fail('ZIP_ENCRYPTED_MEMBER', `index=${index} flags=0x${flags.toString(16).padStart(4, '0')}`)
  const allowedFlags = method === METHOD_DEFLATED ? FLAG_BITS_1_2 | FLAG_BIT_3 | FLAG_UTF8 : FLAG_BIT_3 | FLAG_UTF8
  if (flags & ~allowedFlags) fail('ZIP_UNSUPPORTED_FLAGS', `index=${index} flags=0x${flags.toString(16).padStart(4, '0')}`)
  if (method !== METHOD_STORED && method !== METHOD_DEFLATED) fail('ZIP_UNSUPPORTED_METHOD', `method=${method}`)
  if (diskStart !== 0) fail('ZIP_MULTI_DISK', `index=${index}`)
  bounds(bytes, at + 46, nameLen, 'ZIP_TRUNCATED_NAME')
  const nameBytes = bytes.subarray(at + 46, at + 46 + nameLen)
  const name = utf8(nameBytes)
  const { directory } = validatePath(name, caps)
  checkExtraFields(bytes, at + 46 + nameLen, extraLen)
  bounds(bytes, at + 46 + nameLen + extraLen, commentLen, 'ZIP_TRUNCATED_COMMENT')
  const fileType = unixFileType(externalAttrs, madeBy)
  if (fileType === 'SYMLINK') fail('ZIP_SYMLINK_MEMBER', name)
  if (fileType === 'SPECIAL') fail('ZIP_SPECIAL_MEMBER', name)
  if (fileType === 'DIRECTORY' && !directory) fail('ZIP_DIRECTORY_WITHOUT_SLASH', name)
  if (directory && (compSize !== 0 || uncompSize !== 0)) fail('ZIP_DIRECTORY_WITH_DATA', name)
  if (directory && (flags & FLAG_DATA_DESCRIPTOR)) {
    fail('ZIP_DATA_DESCRIPTOR_MISMATCH', `${name} directory-with-descriptor-bit`)
  }
  if (seenExact.has(name)) fail('ZIP_DUPLICATE_EXACT_NAME', name)
  const folded = name.toLowerCase()
  if (seenFolded.has(folded)) fail('ZIP_CASE_FOLD_COLLISION', name)
  seenExact.add(name)
  seenFolded.add(folded)
  // Local-header identity check (central values stay authoritative for offsets).
  bounds(bytes, localOffset, 30, 'ZIP_BAD_LOCAL_OFFSET')
  if (u32(bytes, localOffset) !== SIG_LOCAL) fail('ZIP_LOCAL_SIGNATURE', name)
  const localNameLen = u16(bytes, localOffset + 26)
  const localExtraLen = u16(bytes, localOffset + 28)
  bounds(bytes, localOffset + 30, localNameLen, 'ZIP_TRUNCATED_LOCAL_NAME')
  const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameLen)
  if (localName.length !== nameBytes.length || !localName.every((b, i) => b === nameBytes[i])) fail('ZIP_LOCAL_CENTRAL_NAME_MISMATCH', name)
  if (u16(bytes, localOffset + 8) !== method) fail('ZIP_LOCAL_CENTRAL_METHOD_MISMATCH', name)
  const localFlags = u16(bytes, localOffset + 6)
  const dataOffset = localOffset + 30 + localNameLen + localExtraLen
  bounds(bytes, dataOffset, compSize, 'ZIP_TRUNCATED_MEMBER_DATA')
  // Local extra fields are validated with the same bounded parser as central
  // extras: malformed local extras and any ZIP64 extra field reject here.
  checkExtraFields(bytes, localOffset + 30 + localNameLen, localExtraLen)
  // Local/central identity. Version, flags, method, and filename bytes must
  // match exactly. CRC/sizes: exact equality when bit 3 is clear; under
  // bit 3 each field admits the ordinary zero placeholder or the exact
  // central value. A 0xffffffff local size is a ZIP64 sentinel and rejects
  // even without a ZIP64 extra field (CRC32 itself is not a size sentinel:
  // 0xffffffff passes only via exact central equality).
  const localVersion = u16(bytes, localOffset + 4)
  if (localVersion !== versionNeeded) fail('ZIP_LOCAL_CENTRAL_VERSION_MISMATCH', `${name} local=${localVersion} central=${versionNeeded}`)
  if (localFlags !== flags) fail('ZIP_LOCAL_CENTRAL_FLAG_MISMATCH', name)
  const localCrc = u32(bytes, localOffset + 14)
  const localComp = u32(bytes, localOffset + 18)
  const localUncomp = u32(bytes, localOffset + 22)
  if (flags & FLAG_DATA_DESCRIPTOR) {
    if (localCrc !== crc && localCrc !== 0) fail('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH', `${name} field=crc32`)
    for (const [field, local, central] of [['compressedSize', localComp, compSize], ['uncompressedSize', localUncomp, uncompSize]]) {
      if (local === central || local === 0) continue
      if (local === 0xffffffff) fail('ZIP64_NOT_SUPPORTED', `${name} local-${field}-sentinel`)
      fail('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH', `${name} field=${field}`)
    }
  } else {
    if (localCrc !== crc) fail('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH', `${name} field=crc32`)
    if (localComp !== compSize) fail('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH', `${name} field=compressedSize`)
    if (localUncomp !== uncompSize) fail('ZIP_LOCAL_CENTRAL_IDENTITY_MISMATCH', `${name} field=uncompressedSize`)
  }
  return {
    index,
    path: name,
    directory,
    method,
    flags,
    crc32: crc,
    compressedSize: compSize,
    uncompressedSize: uncompSize,
    externalAttrs,
    localDataOffset: dataOffset,
    localStart: localOffset,
    dataEnd: dataOffset + compSize,
    recordEnd: null,
    descriptorForm: null,
  }
}

const DESCRIPTOR_SIGNATURE = 0x08074b50

// Validates one bit-3 data descriptor immediately after the compressed-data
// region and returns [recordEnd, form]. Only the ordinary non-ZIP64 forms
// are supported: 12 bytes unsigned, or 16 bytes with the 0x08074b50
// signature. Descriptor fields must exactly equal central values.
function parseDataDescriptor(member, bytes, centralOffset, localStarts) {
  const { path: name, dataEnd, crc32, compressedSize, uncompressedSize } = member
  // Abutting next record means no descriptor was written at all.
  if (localStarts.has(dataEnd)) fail('ZIP_DATA_DESCRIPTOR_MISSING', name)
  if (dataEnd === centralOffset) fail('ZIP_DATA_DESCRIPTOR_MISSING', `${name} abuts-central-directory`)
  if (dataEnd + 12 > centralOffset) fail('ZIP_DATA_DESCRIPTOR_TRUNCATED', name)
  const signed = u32(bytes, dataEnd) === DESCRIPTOR_SIGNATURE
  const length = signed ? 16 : 12
  if (dataEnd + length > centralOffset) fail('ZIP_DATA_DESCRIPTOR_TRUNCATED', name)
  const base = signed ? dataEnd + 4 : dataEnd
  const dCrc = u32(bytes, base)
  const dComp = u32(bytes, base + 4)
  const dUncomp = u32(bytes, base + 8)
  if (dCrc !== crc32 || dComp !== compressedSize || dUncomp !== uncompressedSize) {
    fail('ZIP_DATA_DESCRIPTOR_MISMATCH', name)
  }
  return [dataEnd + length, signed ? 'signed-16' : 'unsigned-12']
}

// Assigns exact local record extents. Bit-3 members consume their validated
// descriptor; all others end at their compressed data.
function assignRecordEnds(members, bytes, centralOffset) {
  const localStarts = new Set(members.map((m) => m.localStart))
  for (const m of members) {
    if (m.flags & FLAG_DATA_DESCRIPTOR) {
      const [recordEnd, form] = parseDataDescriptor(m, bytes, centralOffset, localStarts)
      m.recordEnd = recordEnd
      m.descriptorForm = form
    } else {
      m.recordEnd = m.dataEnd
      m.descriptorForm = null
    }
    if (m.recordEnd > centralOffset) fail('ZIP_LOCAL_RECORD_LAYOUT_MISMATCH', `${m.path} overlaps-central-directory`)
  }
}

// Enforces the canonical prefix: local records sorted by offset must start
// at byte 0, chain exactly end-to-start with no gaps/overlaps/duplicates,
// and end exactly at the central directory.
function enforceContiguity(members, centralOffset) {
  if (members.length === 0) {
    if (centralOffset !== 0) fail('ZIP_UNCLAIMED_LOCAL_BYTES', `no-local-records centralOffset=${centralOffset}`)
    return
  }
  const sorted = [...members].sort((a, b) => a.localStart - b.localStart)
  if (sorted[0].localStart !== 0) fail('ZIP_UNCLAIMED_LOCAL_BYTES', `first-local-start=${sorted[0].localStart}`)
  let prevEnd = null
  for (const m of sorted) {
    if (prevEnd !== null && m.localStart !== prevEnd) {
      fail('ZIP_LOCAL_RECORD_LAYOUT_MISMATCH', `${m.path} expected-start=${prevEnd} actual-start=${m.localStart}`)
    }
    prevEnd = m.recordEnd
  }
  if (prevEnd !== centralOffset) fail('ZIP_UNCLAIMED_LOCAL_BYTES', `final-record-end=${prevEnd} centralOffset=${centralOffset}`)
}

function enforcePathLayout(members) {
  // Normalized duplicates: same path modulo the directory trailing slash
  // (a file and a directory cannot share one extraction target). The rule
  // runs in the exact namespace (ZIP_NORMALIZED_DUPLICATE) and again in
  // the case-folded namespace (ZIP_CASE_FOLD_COLLISION), so one normalized
  // extraction target is never both a file and a directory on any host.
  const stripped = new Map()
  const foldedStripped = new Map()
  for (const m of members) {
    const key = m.directory ? m.path.slice(0, -1) : m.path
    if (stripped.has(key)) fail('ZIP_NORMALIZED_DUPLICATE', m.path)
    stripped.set(key, m.path)
    const folded = key.toLowerCase()
    if (foldedStripped.has(folded)) fail('ZIP_CASE_FOLD_COLLISION', m.path)
    foldedStripped.set(folded, m.path)
  }
  // Prefix conflicts: a regular file may not be an ancestor of ANY other
  // member. File-over-file collides on write; file-over-directory breaks
  // extraction (ENOTDIR). Both reject here at admission, before any temp
  // tree exists. The rule also runs in the case-folded namespace so the
  // verdict never depends on host filesystem case sensitivity. Directory
  // ancestors are always safe (nesting), so only file ancestors conflict.
  const scan = (targetOf, ancestorOf, reportPath) => {
    for (const member of members) {
      const target = targetOf(member)
      const parts = target.split('/')
      for (let i = 1; i < parts.length; i++) {
        if (ancestorOf(parts.slice(0, i).join('/'))) fail('ZIP_PATH_PREFIX_CONFLICT', reportPath(member))
      }
    }
  }
  const files = new Set(members.filter((m) => !m.directory).map((m) => m.path))
  scan((m) => (m.directory ? m.path.slice(0, -1) : m.path), (p) => files.has(p), (m) => m.path)
  const foldedFiles = new Set(members.filter((m) => !m.directory).map((m) => m.path.toLowerCase()))
  scan((m) => (m.directory ? m.path.slice(0, -1) : m.path).toLowerCase(), (p) => foldedFiles.has(p), (m) => m.path)
}

function enforceSizeCaps(members, caps) {
  let total = 0
  for (const m of members) {
    if (m.uncompressedSize > caps.MAX_MEMBER_UNCOMPRESSED_BYTES) fail('ZIP_MEMBER_SIZE_LIMIT', `${m.path} uncompressed=${m.uncompressedSize}`)
    total += m.uncompressedSize
    if (total > caps.MAX_TOTAL_UNCOMPRESSED_BYTES) fail('ZIP_AGGREGATE_SIZE_LIMIT', `total>${caps.MAX_TOTAL_UNCOMPRESSED_BYTES}`)
    if (!m.directory && m.uncompressedSize > 0) {
      if (m.compressedSize === 0) fail('ZIP_IMPOSSIBLE_SIZES', m.path)
      if (m.uncompressedSize / m.compressedSize > caps.MAX_EXPANSION_RATIO) fail('ZIP_EXPANSION_RATIO_LIMIT', m.path)
    }
  }
  return total
}

export function admitZipArchive(input, caps = INTAKE_SAFETY_CAPS) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input)
  if (bytes.length > caps.MAX_ARCHIVE_BYTES) fail('ZIP_ARCHIVE_SIZE_LIMIT', `bytes=${bytes.length}`)
  if (bytes.length < 22) fail('ZIP_TOO_SMALL')
  // ZIP64 indicators are rejected before EOCD parsing so the diagnostic is
  // exact even when the locator itself breaks EOCD consistency.
  if (hasZip64Locator(bytes)) fail('ZIP64_NOT_SUPPORTED', 'end-of-central-directory-64 locator present')
  const eocd = locateEocd(bytes)
  if (eocd.disk !== 0 || eocd.centralDisk !== 0 || eocd.entriesThisDisk !== eocd.entriesTotal) fail('ZIP_MULTI_DISK')
  if (eocd.entriesTotal === 0xffff || eocd.centralSize === 0xffffffff || eocd.centralOffset === 0xffffffff) {
    fail('ZIP64_NOT_SUPPORTED')
  }
  if (eocd.entriesTotal > caps.MAX_MEMBERS) fail('ZIP_MEMBER_COUNT_LIMIT', `members=${eocd.entriesTotal}`)
  bounds(bytes, eocd.centralOffset, eocd.centralSize, 'ZIP_TRUNCATED_CENTRAL')
  const members = []
  const seenExact = new Set()
  const seenFolded = new Set()
  let at = eocd.centralOffset
  for (let i = 0; i < eocd.entriesTotal; i++) {
    const member = admitCentralEntry(bytes, at, i, caps, seenExact, seenFolded)
    members.push(member)
    const nameLen = u16(bytes, at + 28)
    const extraLen = u16(bytes, at + 30)
    const commentLen = u16(bytes, at + 32)
    at += 46 + nameLen + extraLen + commentLen
  }
  if (at !== eocd.centralOffset + eocd.centralSize) fail('ZIP_CENTRAL_SIZE_MISMATCH')
  // Canonical local topology: exact record extents (with validated data
  // descriptors), then byte-0 start, exact chaining, and exact central
  // abutment. Structural before semantic: layout precedes path/size checks.
  assignRecordEnds(members, bytes, eocd.centralOffset)
  enforceContiguity(members, eocd.centralOffset)
  enforcePathLayout(members)
  const totalUncompressed = enforceSizeCaps(members, caps)
  const totalCompressed = members.reduce((sum, m) => sum + m.compressedSize, 0)
  return Object.freeze({
    memberCount: members.length,
    totalCompressed,
    totalUncompressed,
    members: Object.freeze(members.map((m) => Object.freeze({ ...m }))),
  })
}

export function extractAdmittedMember(input, member, caps = INTAKE_SAFETY_CAPS) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input)
  if (member.directory) return null
  bounds(bytes, member.localDataOffset, member.compressedSize, 'ZIP_TRUNCATED_MEMBER_DATA')
  const compressed = bytes.subarray(member.localDataOffset, member.localDataOffset + member.compressedSize)
  let out
  if (member.method === METHOD_STORED) {
    out = Buffer.from(compressed)
  } else if (member.method === METHOD_DEFLATED) {
    try {
      // The compressed region must contain exactly one complete raw-DEFLATE
      // stream: trailing bytes or a second stream reject deterministically.
      const result = inflateRawSync(compressed, { maxOutputLength: Math.min(member.uncompressedSize, caps.MAX_MEMBER_UNCOMPRESSED_BYTES) + 1, info: true })
      if (result.engine.bytesWritten !== member.compressedSize) {
        fail('ZIP_TRAILING_COMPRESSED_DATA', `${member.path} consumed=${result.engine.bytesWritten} compressed=${member.compressedSize}`)
      }
      out = result.buffer
    } catch (error) {
      if (error instanceof ZipAdmissionError) throw error
      fail('ZIP_INFLATE_FAILED', `${member.path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    fail('ZIP_UNSUPPORTED_METHOD', `method=${member.method}`)
  }
  if (out.length !== member.uncompressedSize) fail('ZIP_SIZE_MISMATCH', `${member.path} got=${out.length} want=${member.uncompressedSize}`)
  if (crc32Bytes(out) !== member.crc32) fail('ZIP_CRC_MISMATCH', member.path)
  return out
}
