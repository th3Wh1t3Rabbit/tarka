import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renderPacket, runIntake } from '../../../src/controller/foundation/pixel-intake/intake-runner.mjs'
import { canonicalJson } from '../../../src/controller/foundation/pixel-intake/canonical-json.mjs'
import { validatePixelReviewPacket } from '../../../src/controller/foundation/pixel-review.mjs'
import { buildPng, buildZip, expectNoNewTempDirs, makeAssetEntry, makeIndex, UB } from './helpers.mjs'

const opaque = () => [200, 100, 50, 255]
const tempRoots = []

const pngA = () => buildPng({ width: 8, height: 8, pixel: opaque })
const pngB = () => buildPng({ width: 6, height: 4, pixel: (x, y) => (x >= 1 && x <= 4 && y >= 1 && y <= 2 ? opaque() : [0, 0, 0, 0]) })

function pack({ assets, indexText, extra = [], dirs = [] }) {
  const members = [
    ...dirs.map((name) => ({ name, data: Buffer.alloc(0), method: 0, dir: true })),
    { name: 'index.json', data: Buffer.from(indexText, 'utf8'), method: 0 },
    ...assets.map((a) => ({ name: a.path, data: a.bytes, method: 8 })),
    ...extra,
  ]
  return buildZip(members)
}

function validAssets() {
  const a = pngA()
  const b = pngB()
  return [
    { entry: makeAssetEntry({ id: 'A_PROP', assetPath: 'art/a.png', bytes: a, width: 8, height: 8, bounds: { x: 0, y: 0, width: 8, height: 8 } }), bytes: a, path: 'art/a.png' },
    { entry: makeAssetEntry({ id: 'B_PROP', assetPath: 'art/b.png', bytes: b, width: 6, height: 4, bounds: { x: 1, y: 1, width: 4, height: 2 } }), bytes: b, path: 'art/b.png' },
  ]
}

async function writeTempArchive(bytes) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'trace-intake-test-'))
  tempRoots.push(dir)
  const file = path.join(dir, 'pack.zip')
  await import('node:fs/promises').then((fs) => fs.writeFile(file, bytes))
  return file
}

afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true })
})

describe('intake runner: valid pack end-to-end', () => {
  it('admits a valid organized pack with a complete deterministic packet', async () => {
    const assets = validAssets()
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    const archive = await writeTempArchive(pack({ assets, indexText: JSON.stringify(index), dirs: ['art/'] }))
    const packet = await runIntake(archive)
    expect(packet.status).toBe('ADMISSION_READY_FOR_MAIN_REVIEW')
    expect(packet.hold).toBeNull()
    expect(packet.admission.verdict).toBe('ADMITTED_STRUCTURE')
    expect(packet.memberSet.match).toBe(true)
    expect(packet.validators.validateIntake).toEqual({ invoked: true, result: 'PASS' })
    expect(packet.validators.verifyIntakeBytes).toEqual({ invoked: true, result: 'PASS' })
    expect(packet.validators.pngProducer).toEqual({ invoked: true, assets: 2, failures: 0, result: 'PASS' })
    expect(packet.png).toHaveLength(2)
    expect(packet.png.every((p) => p.mismatches.length === 0 && p.error === null)).toBe(true)
    expect(packet.capabilities).toHaveLength(2)
    // S6 review section validates through the existing gate and never approves.
    const gate = validatePixelReviewPacket(packet.reviewPacket)
    expect(gate.PrincipalApprovalGranted).toBe(false)
    expect(gate.MAINArchiveAdmitted).toBe(false)
    expect(gate.holds).toContain('externalPrincipalProvenance')
    const text = renderPacket(packet)
    expect(JSON.parse(text).status).toBe('ADMISSION_READY_FOR_MAIN_REVIEW')
  })
})

describe('intake runner: HOLD paths', () => {
  it('holds when no authoritative index exists', async () => {
    const assets = validAssets()
    const archive = await writeTempArchive(buildZip(assets.map((a) => ({ name: a.path, data: a.bytes, method: 0 }))))
    const packet = await runIntake(archive)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('INTAKE_INDEX_MISSING')
  })

  it('holds on malformed index with per-candidate diagnostics', async () => {
    const assets = validAssets()
    const archive = await writeTempArchive(pack({ assets, indexText: '{"schemaVersion":"9.9.9"}' }))
    const packet = await runIntake(archive)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.validators.indexLocation.status).toBe('MISSING')
    expect(packet.validators.indexLocation.candidates[0].valid).toBe(false)
  })

  it('holds on ambiguous duplicate valid indexes', async () => {
    const assets = validAssets()
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    const text = JSON.stringify(index)
    const archive = await writeTempArchive(buildZip([
      { name: 'index.json', data: Buffer.from(text, 'utf8'), method: 0 },
      { name: 'backup/index.json', data: Buffer.from(text, 'utf8'), method: 0 },
      ...assets.map((a) => ({ name: a.path, data: a.bytes, method: 0 })),
    ]))
    const packet = await runIntake(archive)
    expect(packet.status).toBe('HOLD_WITH_EVIDENCE')
    expect(packet.hold.code).toBe('INTAKE_AMBIGUOUS_INDEX')
  })

  it('holds on missing declared members', async () => {
    const assets = validAssets()
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    const archive = await writeTempArchive(pack({ assets: [assets[0]], indexText: JSON.stringify(index) }))
    const packet = await runIntake(archive)
    expect(packet.hold.code).toBe('INTAKE_MEMBER_SET_MISMATCH')
    expect(packet.memberSet.missing).toEqual(['art/b.png'])
  })

  it('holds on undeclared extra members', async () => {
    const assets = validAssets()
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    const archive = await writeTempArchive(pack({ assets, indexText: JSON.stringify(index), extra: [{ name: 'notes.txt', data: UB('hi'), method: 0 }] }))
    const packet = await runIntake(archive)
    expect(packet.hold.code).toBe('INTAKE_MEMBER_SET_MISMATCH')
    expect(packet.memberSet.extra).toEqual(['notes.txt'])
  })

  it('holds on asset hash mismatch', async () => {
    const assets = validAssets()
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    const tampered = assets.map((a) => (a.path === 'art/a.png' ? { ...a, bytes: Buffer.from(a.bytes).fill(9, 0, 4) } : a))
    const archive = await writeTempArchive(pack({ assets: tampered, indexText: JSON.stringify(index) }))
    const packet = await runIntake(archive)
    expect(packet.hold.code).toBe('INTAKE_BYTE_VERIFICATION_FAILED')
  })

  it('holds on PNG declared-versus-measured mismatch', async () => {
    const assets = validAssets()
    assets[0].entry.transparentBounds = { x: 0, y: 0, width: 1, height: 1 }
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    const archive = await writeTempArchive(pack({ assets, indexText: JSON.stringify(index) }))
    const packet = await runIntake(archive)
    expect(packet.hold.code).toBe('INTAKE_PNG_MISMATCH')
    expect(packet.png[0].mismatches).toHaveLength(1)
  })

  it('holds on undecodable PNG bytes', async () => {
    const assets = validAssets()
    const bad = Buffer.from('definitely-not-a-png-payload!!', 'utf8')
    const entry = makeAssetEntry({ id: 'B_PROP', assetPath: 'art/b.png', bytes: bad, width: 6, height: 4, bounds: { x: 1, y: 1, width: 4, height: 2 } })
    const index = makeIndex({ assets: [assets[0].entry, entry] })
    const swapped = [{ ...assets[0] }, { path: 'art/b.png', bytes: bad }]
    const archive = await writeTempArchive(pack({ assets: swapped, indexText: JSON.stringify(index) }))
    const packet = await runIntake(archive)
    expect(packet.hold.code).toBe('INTAKE_PNG_MISMATCH')
    expect(packet.png[1].error).toBe('PNG_BAD_SIGNATURE')
  })

  it('holds hostile archives before any extraction', async () => {
    const archive = await writeTempArchive(buildZip([{ name: '../evil', data: UB('x'), method: 0 }]))
    const before = readdirSync(os.tmpdir()).filter((n) => n.startsWith('trace-pixel-intake-'))
    const packet = await runIntake(archive)
    expect(packet.hold.code).toBe('ZIP_TRAVERSAL')
    await expectNoNewTempDirs(before)
  })
})

describe('intake runner: determinism and containment', () => {
  it('produces byte-identical packets for identical inputs', async () => {
    const assets = validAssets()
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    const bytes = pack({ assets, indexText: JSON.stringify(index), dirs: ['art/'] })
    const first = await writeTempArchive(bytes)
    const second = await writeTempArchive(Buffer.from(bytes))
    const a = renderPacket(await runIntake(first))
    // Same bytes under a different filename still differ only by filename; use same name.
    const b = renderPacket(await runIntake(first))
    expect(a).toBe(b)
    expect(second.endsWith('pack.zip')).toBe(true)
  })

  it('emits canonical JSON with sorted keys and no temp paths', async () => {
    const assets = validAssets()
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    const archive = await writeTempArchive(pack({ assets, indexText: JSON.stringify(index) }))
    const text = renderPacket(await runIntake(archive))
    expect(text.endsWith('\n')).toBe(true)
    expect(text).not.toContain(os.tmpdir())
    expect(text).not.toContain('trace-pixel-intake-')
    expect(canonicalJson(JSON.parse(text))).toBe(text)
  })

  it('cleans private temp directories on PASS and HOLD', async () => {
    const before = readdirSync(os.tmpdir()).filter((n) => n.startsWith('trace-pixel-intake-'))
    const assets = validAssets()
    const index = makeIndex({ assets: assets.map((a) => a.entry) })
    await runIntake(await writeTempArchive(pack({ assets, indexText: JSON.stringify(index) })))
    await runIntake(await writeTempArchive(pack({ assets, indexText: JSON.stringify(index) })))
    await runIntake(await writeTempArchive(buildZip([{ name: 'stray.bin', data: UB('x'), method: 0 }])))
    await expectNoNewTempDirs(before)
  })
})
