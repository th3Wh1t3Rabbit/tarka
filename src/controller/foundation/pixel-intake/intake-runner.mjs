// Pixel archive intake runner: the smallest rigorous offline path from an
// untrusted production ZIP to a deterministic, review-only intake packet.
// Pipeline: bounded read -> structural ZIP admission -> private-temp
// extraction -> authoritative-index location -> member-set comparison ->
// byte verification (existing validators) -> PNG decode-and-measure ->
// deterministic packet. Never activates, selects, or copies into production.
// Node standard library only.
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { admitZipArchive, extractAdmittedMember, ZipAdmissionError } from './zip-admission.mjs'
import { comparePngAgainstDeclared, measurePng, PngMeasureError } from './png-measure.mjs'
import { canonicalize, canonicalJson } from './canonical-json.mjs'
import { INTAKE_SAFETY_CAPS } from './safety-caps.mjs'
import { validateIntake, verifyIntakeBytes } from '../contracts.mjs'
import { PIXEL_REVIEW_CLASSES, validatePixelReviewPacket } from '../pixel-review.mjs'

export const INTAKE_TOOL_VERSION = '1.0.1'
export const INTAKE_PACKET_SCHEMA = 'TRACE-PIXEL-INTAKE-PACKET@1.0.1'
export const ACCEPTED_CONTROLLER_BASE = Object.freeze({
  commit: '2704b2afacd0448d5337638a6a3122760e491829',
  tree: '20b3f61a7e573dff1cbdacb2ade9a3c55aa4ec43',
})

const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex')
const reportHashOf = (value) => sha256Hex(Buffer.from(canonicalize(value), 'utf8'))

function holdPacket(skeleton, code, detail) {
  skeleton.status = 'HOLD_WITH_EVIDENCE'
  skeleton.hold = { code, detail: detail ?? '' }
  return skeleton
}

function baseSkeleton(archivePath, archiveBytes, identity, caps = INTAKE_SAFETY_CAPS) {
  // identity: { bytes, sha256, hashAvailable, hashUnavailableReason }.
  // The packet must never claim a hash that was not computed over the input
  // artifact: unavailable hashes serialize as null with an exact reason.
  const known = identity ?? {
    bytes: archiveBytes.length,
    sha256: sha256Hex(archiveBytes),
    hashAvailable: true,
    hashUnavailableReason: null,
  }
  return {
    tool: { name: 'trace-pixel-intake', version: INTAKE_TOOL_VERSION, packetSchema: INTAKE_PACKET_SCHEMA },
    acceptedControllerBase: { ...ACCEPTED_CONTROLLER_BASE },
    archive: { filename: path.basename(archivePath), ...known },
    admission: { verdict: 'PENDING', code: null, memberCount: 0, totalCompressed: 0, totalUncompressed: 0 },
    inventory: [],
    index: null,
    memberSet: { declared: [], missing: [], extra: [], undeclaredDirectories: [], match: false },
    memberSha256: {},
    png: [],
    validators: {},
    capabilities: [],
    // The exact caps applied to this run, including deterministic test
    // overrides — never unconditionally the module defaults.
    safetyCaps: { values: { ...caps }, results: 'see admission/packet diagnostics' },
    status: 'HOLD_WITH_EVIDENCE',
    hold: null,
    reviewPacket: null,
    notes: [],
  }
}

export function classifyExtractionError(error) {
  // In a freshly created private temp tree, ENOTDIR/EEXIST/EISDIR can only
  // arise from archive structure (a layout case admission missed), so they
  // map to a deterministic HOLD. All other I/O failures stay operational
  // (CLI exit 2) and must never be masked as intake findings.
  const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : null
  // ENAMETOOLONG is structural here by construction: admitted paths already
  // satisfy both character and byte caps, so an overlong name at extraction
  // can only mean a missed structural case, never an operational surprise.
  if (code === 'ENOTDIR' || code === 'EEXIST' || code === 'EISDIR' || code === 'ENAMETOOLONG') {
    return 'INTAKE_EXTRACTION_REFUSED'
  }
  return null
}

// Bounded single-handle body read. Reads at most cap+1 bytes so growth past
// the cap is detected without retaining an over-cap body. Returns the exact
// body, or an over-cap marker after one same-handle re-stat for diagnostics.
export async function readBoundedBytes(handle, cap) {
  const buf = Buffer.alloc(cap + 1)
  let offset = 0
  for (;;) {
    const { bytesRead } = await handle.read(buf, offset, buf.length - offset, offset)
    if (bytesRead === 0) break
    offset += bytesRead
    if (offset > cap) {
      // Reaching here means the content exceeds what metadata admitted, so
      // the file changed after the metadata check. Re-stat on the same
      // handle for a deterministic diagnostic; the over-cap body is dropped.
      const restat = await handle.stat()
      return { body: null, overCap: true, grewAfterMetadata: true, currentSize: restat.size }
    }
  }
  return { body: buf.subarray(0, offset), overCap: false, grewAfterMetadata: false, currentSize: offset }
}

async function writeAdmittedMembers(tempDir, archiveBytes, admission, caps) {
  const written = []
  for (const member of admission.members) {
    const target = path.join(tempDir, member.path)
    const relative = path.relative(tempDir, target)
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new ZipAdmissionError('ZIP_TEMP_ESCAPE', member.path)
    }
    try {
      if (member.directory) {
        await fs.mkdir(target, { recursive: true })
        written.push(member.path)
        continue
      }
      await fs.mkdir(path.dirname(target), { recursive: true })
      let exists = false
      try {
        await fs.lstat(target)
        exists = true
      } catch {
        exists = false
      }
      if (exists) throw new ZipAdmissionError('ZIP_TEMP_OVERWRITE_REFUSED', member.path)
      const data = extractAdmittedMember(archiveBytes, member, caps)
      await fs.writeFile(target, data, { flag: 'wx', mode: 0o600 })
      written.push(member.path)
    } catch (error) {
      if (error instanceof ZipAdmissionError) throw error
      const mapped = classifyExtractionError(error)
      if (mapped !== null) throw new ZipAdmissionError(mapped, `${error.code}:${member.path}`)
      throw error
    }
  }
  return written
}

async function locateIndexCandidate(packet, tempDir, regularPaths) {
  const jsonPaths = regularPaths.filter((p) => p.endsWith('.json')).sort()
  const attempts = []
  let found = null
  for (const rel of jsonPaths) {
    let parsed = null
    let failure = null
    try {
      // Fatal decoding: invalid UTF-8 bytes must never become U+FFFD text
      // that could pass as a valid authoritative index.
      const raw = await fs.readFile(path.join(tempDir, rel))
      let text
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(raw)
      } catch {
        failure = 'INDEX_UTF8_INVALID'
        attempts.push({ path: rel, valid: false, failure })
        continue
      }
      parsed = JSON.parse(text)
    } catch (error) {
      failure = `JSON_PARSE:${error instanceof Error ? error.message : String(error)}`
    }
    if (failure === null) {
      try {
        validateIntake(parsed)
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error)
      }
    }
    attempts.push({ path: rel, valid: failure === null, failure })
    if (failure === null) {
      if (found !== null) {
        packet.notes.push('ambiguous-authoritative-index')
        return { status: 'AMBIGUOUS', attempts }
      }
      found = { path: rel, index: parsed }
    }
  }
  if (found === null) return { status: 'MISSING', attempts }
  return { status: 'FOUND', ...found, attempts }
}

function buildReviewSection({ archiveSha256, indexSha256, classes }) {
  // Binds each PASS class to the hash of its canonical evidence subsection.
  // externalPrincipalProvenance is always MISSING: tooling cannot authenticate
  // Principal identity, so the S6 gate honestly stays on HOLD.
  const evidence = {}
  for (const name of PIXEL_REVIEW_CLASSES) {
    const entry = classes[name]
    evidence[name] = { status: entry.status, reportSha256: entry.report, externalBinding: null }
  }
  const packet = {
    schemaVersion: '1.0.0',
    status: 'PREPARED_NOT_SENT',
    archiveSha256,
    indexSha256,
    evidence,
    requestedAuthority: 'MAIN_INDEPENDENT_REVIEW_ONLY',
  }
  const gate = validatePixelReviewPacket(packet)
  return { packet, gate }
}

export async function runIntake(archivePath, options = {}) {
  const caps = options.caps ?? INTAKE_SAFETY_CAPS
  // Deterministic test seam: substitutes only the file opener (production
  // default opens the real path once). All metadata and bytes below come
  // from that single handle.
  const openFile = options.openFile ?? ((p, flags) => fs.open(p, flags))
  let archiveBytes
  let handle = null
  try {
    handle = await openFile(archivePath, 'r')
    const stat = await handle.stat()
    if (!stat.isFile()) {
      return holdPacket(
        baseSkeleton(archivePath, Buffer.alloc(0), { bytes: null, sha256: null, hashAvailable: false, hashUnavailableReason: 'INTAKE_NOT_A_FILE' }, caps),
        'INTAKE_NOT_A_FILE',
        archivePath,
      )
    }
    if (stat.size > caps.MAX_ARCHIVE_BYTES) {
      return holdPacket(
        baseSkeleton(archivePath, Buffer.alloc(0), {
          bytes: stat.size,
          sha256: null,
          hashAvailable: false,
          hashUnavailableReason: 'ZIP_ARCHIVE_SIZE_LIMIT',
        }, caps),
        'ZIP_ARCHIVE_SIZE_LIMIT',
        `bytes=${stat.size}`,
      )
    }
    const read = await readBoundedBytes(handle, caps.MAX_ARCHIVE_BYTES)
    if (read.overCap) {
      return holdPacket(
        baseSkeleton(archivePath, Buffer.alloc(0), {
          // Report the same-handle observed current size, not the stale
          // initial size: the file changed after the first metadata check.
          bytes: read.currentSize,
          sha256: null,
          hashAvailable: false,
          hashUnavailableReason: 'ZIP_ARCHIVE_SIZE_LIMIT',
        }, caps),
        'ZIP_ARCHIVE_SIZE_LIMIT',
        `size-changed-after-metadata current=${read.currentSize}`,
      )
    }
    archiveBytes = read.body
  } catch (error) {
    throw new Error(`INTAKE_READ_FAILED: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (handle !== null) await handle.close()
  }
  const packet = baseSkeleton(archivePath, archiveBytes, undefined, caps)
  let admission
  try {
    admission = admitZipArchive(archiveBytes, caps)
  } catch (error) {
    if (error instanceof ZipAdmissionError) return holdPacket(packet, error.code, error.message)
    throw error
  }
  packet.admission = {
    verdict: 'ADMITTED_STRUCTURE',
    code: null,
    memberCount: admission.memberCount,
    totalCompressed: admission.totalCompressed,
    totalUncompressed: admission.totalUncompressed,
  }
  packet.inventory = admission.members.map((m) => ({
    path: m.path,
    directory: m.directory,
    method: m.method,
    compressedSize: m.compressedSize,
    uncompressedSize: m.uncompressedSize,
    crc32: m.crc32.toString(16).padStart(8, '0'),
  }))
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trace-pixel-intake-'))
  try {
    try {
      await writeAdmittedMembers(tempDir, archiveBytes, admission, caps)
    } catch (error) {
      if (error instanceof ZipAdmissionError || error instanceof PngMeasureError) return holdPacket(packet, error.code, error.message)
      throw error
    }
    const regularPaths = admission.members.filter((m) => !m.directory).map((m) => m.path).sort()
    const located = await locateIndexCandidate(packet, tempDir, regularPaths)
    packet.validators.indexLocation = {
      candidates: located.attempts,
      status: located.status,
    }
    if (located.status !== 'FOUND') {
      return holdPacket(packet, located.status === 'AMBIGUOUS' ? 'INTAKE_AMBIGUOUS_INDEX' : 'INTAKE_INDEX_MISSING', `jsonCandidates=${located.attempts.length}`)
    }
    const indexBytes = await fs.readFile(path.join(tempDir, located.path))
    const indexSha256 = sha256Hex(indexBytes)
    const index = located.index
    packet.index = { path: located.path, sha256: indexSha256, archiveId: index.archiveId, version: index.version }
    packet.validators.validateIntake = { invoked: true, result: 'PASS' }
    // Member-set comparison: regular files must equal declared assets + index.
    const declared = new Set([...index.assets.map((a) => a.path), located.path])
    const actual = new Set(regularPaths)
    const missing = [...declared].filter((p) => !actual.has(p)).sort()
    const extra = [...actual].filter((p) => !declared.has(p)).sort()
    const fileParents = new Set()
    for (const file of actual) {
      const parts = file.split('/')
      for (let i = 1; i < parts.length; i++) fileParents.add(`${parts.slice(0, i).join('/')}/`)
    }
    const undeclaredDirectories = admission.members.filter((m) => m.directory && !fileParents.has(m.path)).map((m) => m.path).sort()
    packet.memberSet = {
      declared: [...declared].sort(),
      missing,
      extra,
      undeclaredDirectories,
      match: missing.length === 0 && extra.length === 0 && undeclaredDirectories.length === 0,
    }
    if (!packet.memberSet.match) {
      return holdPacket(packet, 'INTAKE_MEMBER_SET_MISMATCH', `missing=${missing.length} extra=${extra.length} undeclaredDirs=${undeclaredDirectories.length}`)
    }
    // Per-member hashes + existing byte verification over the exact inventory.
    const bytesByPath = {}
    for (const rel of regularPaths) {
      const data = await fs.readFile(path.join(tempDir, rel))
      bytesByPath[rel] = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      packet.memberSha256[rel] = sha256Hex(data)
    }
    try {
      await verifyIntakeBytes(index, Object.fromEntries(Object.entries(bytesByPath).filter(([p]) => index.assets.some((a) => a.path === p))))
      packet.validators.verifyIntakeBytes = { invoked: true, result: 'PASS' }
    } catch (error) {
      packet.validators.verifyIntakeBytes = { invoked: true, result: 'FAIL', code: error instanceof Error ? error.message : String(error) }
      return holdPacket(packet, 'INTAKE_BYTE_VERIFICATION_FAILED', error instanceof Error ? error.message : String(error))
    }
    // PNG decode-and-measure per declared asset.
    let pngFailures = 0
    for (const asset of index.assets) {
      const data = bytesByPath[asset.path]
      const entry = { path: asset.path, assetId: asset.id, measured: null, mismatches: [], error: null }
      try {
        const measured = measurePng(Buffer.from(data), caps)
        entry.measured = {
          width: measured.width,
          height: measured.height,
          channels: measured.channels,
          hasNonzeroAlpha: measured.hasNonzeroAlpha,
          fullyTransparent: measured.fullyTransparent,
          contentBounds: measured.contentBounds,
          nonzeroAlphaPixels: measured.nonzeroAlphaPixels,
          pixelCount: measured.pixelCount,
          decodedBytes: measured.decodedBytes,
          idatBytes: measured.idatBytes,
        }
        entry.mismatches = comparePngAgainstDeclared(measured, {
          width: asset.width,
          height: asset.height,
          channels: asset.channels,
          transparentBounds: asset.transparentBounds,
        })
        if (entry.mismatches.length > 0) pngFailures++
      } catch (error) {
        entry.error = error instanceof PngMeasureError ? error.code : error instanceof Error ? error.message : String(error)
        pngFailures++
      }
      packet.png.push(entry)
    }
    packet.validators.pngProducer = { invoked: true, assets: index.assets.length, failures: pngFailures, result: pngFailures === 0 ? 'PASS' : 'FAIL' }
    packet.capabilities = index.capabilities.map((c) => ({
      id: c.id,
      required: c.required,
      clipIds: [...c.clipIds],
      staticAssetId: c.staticAssetId,
      semanticFallback: c.semanticFallback,
      contentIdentityVerified: true,
    }))
    packet.validators.manifestIndexValidators = {
      applicable: false,
      reason: 'Manifest/index validators govern the manifest-v2 art-pack era, not intake archives; the intake contract validators above apply.',
    }
    if (pngFailures > 0) {
      return holdPacket(packet, 'INTAKE_PNG_MISMATCH', `failures=${pngFailures}`)
    }
    // S6 review section: bind each established class to its evidence hash.
    // licenseProvenance and sequenceContactFitFallback stay honestly
    // non-PASS: declarations exist, but legal/provenance validity and
    // visual/contact/sequence fit need human review. Their schema-level
    // observations live in `preliminary`, never as a false PASS.
    // realizationEquivalence retains PASS: exact content identities,
    // duplicate-required-content rejection, and byte verification together
    // establish distinct, exactly identified realizations (no human
    // judgment is required for that property).
    const preliminary = {
      licenseDeclarations: { present: true, assets: index.assets.length, legalValidityEstablished: false },
      contactSchemaFit: { contacts: index.clips.reduce((n, c) => n + c.contacts.length, 0), ownershipEvents: index.clips.reduce((n, c) => n + c.ownershipEvents.length, 0), visualFitEstablished: false },
    }
    packet.preliminary = preliminary;
    const classes = {
      safeArchive: { status: 'PASS', report: reportHashOf(packet.admission) },
      manifestMembers: { status: 'PASS', report: reportHashOf({ index: packet.index, memberSet: packet.memberSet }) },
      assetBytesAndDecodedMetadata: { status: 'PASS', report: reportHashOf({ memberSha256: packet.memberSha256, png: packet.png }) },
      clipDefinitions: { status: 'PASS', report: reportHashOf({ clips: index.clips.length, validateIntake: 'PASS' }) },
      realizationEquivalence: { status: 'PASS', report: reportHashOf({ capabilities: packet.capabilities }) },
      licenseProvenance: { status: 'MISSING', report: null },
      sequenceContactFitFallback: { status: 'MISSING', report: null },
      externalPrincipalProvenance: { status: 'MISSING', report: null },
    }
    const { packet: reviewPacket, gate } = buildReviewSection({ archiveSha256: packet.archive.sha256, indexSha256, classes })
    packet.reviewPacket = reviewPacket
    packet.validators.reviewPacketSelfCheck = { invoked: true, gate: gate.status, holds: gate.holds }
    packet.notes.push('review-only packet; no activation, selection, production copy, or approval claim')
    packet.status = 'ADMISSION_READY_FOR_MAIN_REVIEW'
    packet.hold = null
    return packet
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

export function renderPacket(packet) {
  return canonicalJson(packet)
}
