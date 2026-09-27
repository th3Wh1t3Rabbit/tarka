#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const failures = []
const text = (file) => readFileSync(path.join(root, file), 'utf8')
const manifest = JSON.parse(text('public/art-packs/placeholder/manifest.json'))
const manifestSchema = JSON.parse(text('public/art-packs/manifest.schema.json'))
const index = JSON.parse(text('public/art-packs/index.json'))
const packageJson = JSON.parse(text('package.json'))
const app = text('src/app/App.tsx'); const artPack = text('src/adventure/artPack.ts'); const content = text('src/adventure/content.ts'); const scenes = text('src/adventure/scenes.ts'); const readme = text('README.md'); const architecture = text('docs/ARCHITECTURE.md'); const health = text('scripts/g6p-presentation-health.mjs'); const verification = text('scripts/run-g6p-a1-final-verification.mjs'); const packager = text('scripts/package-g6p-a1-delivery.mjs'); const integrityTests = `${text('tests/unit/art-pack-integrity.test.ts')}\n${text('tests/e2e/art-pack-integrity.spec.ts')}`
const distText = walk(path.join(root, 'dist')).filter((file) => /\.(?:js|css|json|html|md)$/.test(file)).map((file) => readFileSync(file, 'utf8')).join('\n')

for (const dependency of ['three', '@react-three/fiber', '@types/three']) if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) failures.push(`retired dependency remains: ${dependency}`)
for (const file of ['src/game/render/VaultScene.tsx', 'src/app/G6LegacyApp.tsx', 'src/styles/legacy-g6.css', 'docs/G6_SHARED_CONTRACTS.md']) if (existsSync(path.join(root, file))) failures.push(`retired active file remains: ${file}`)
if (/(?:@react-three|from ['"]three|GUIDED_PROBE_3D|WebGLRenderer|vault-canvas)/.test(distText)) failures.push('ordinary public build contains retired 3D material')
if (/<canvas|document\.createElement\(['"]canvas/.test(distText)) failures.push('ordinary public build requires canvas')
if (existsSync(path.join(root, 'dist/scenarios/euler-2023-false-exit/world.json'))) failures.push('retired world presentation was copied into public build')
if (/React Three Fiber|ENTER THE VAULT|Mouse movement: bounded camera look/.test(`${readme}\n${architecture}`)) failures.push('public documentation describes retired controls or renderer')
if (manifest.schemaVersion !== '2.0.0' || manifest.nativeResolution?.width !== 480 || manifest.nativeResolution?.height !== 270 || manifest.scalingMode !== 'NEAREST_NEIGHBOR') failures.push('manifest v2 native/scaling contract drifted')
if (!manifest.scenes?.['records-office'] || !manifest.scenes?.['blank-shell']) failures.push('multi-scene art pack is incomplete')
if (manifest.characters?.rook?.animations?.walkEast?.frames?.length < 2 || manifest.characters.rook.animations.walkEast.frames.length > 4) failures.push('Rook walk is not a two-to-four-frame cycle')
if (manifest.characters?.rook?.animations?.talkClosed?.frames?.length !== 1 || manifest.characters?.rook?.animations?.talkOpen?.frames?.length !== 1) failures.push('Rook talk does not provide two states')
if (/polygon|walkTo/.test(JSON.stringify(manifest))) failures.push('art manifest contains gameplay geometry')
if ((scenes.match(/id: '/g) ?? []).length < 12 || !scenes.includes("playable: false")) failures.push('scene definitions do not prove ten hotspots plus blank fixture')
for (const line of ['Where am I—and why do I taste envelope glue?', 'Records Office. You were misfiled.', 'Find the First Breach record.']) if (!content.includes(line)) failures.push(`Lead-authored opening line missing: ${line}`)
if (app.includes('RECORDS 0/1') || !app.includes('state.archivedEvidenceIds.length > 0')) failures.push('startup evidence checklist is not hidden')
if (!app.includes('data-hotspot-total={definition.hotspots.length}')) failures.push('hotspot health source is not the scene definition')
if (index.packs?.length !== 4 || index.packs.filter(({ status }) => status === 'AUDITION_EMPTY').length !== 3) failures.push('three empty audition slots are required')
for (const pack of index.packs ?? []) if (!existsSync(path.join(root, 'public/art-packs', pack.id, 'manifest.json'))) failures.push(`missing installed pack descriptor: ${pack.id}`)
for (const asset of assets(manifest)) {
  const assetFile = path.join(root, 'public', asset.src.replace(/^\//, ''))
  if (!existsSync(assetFile)) { failures.push(`missing manifest asset: ${asset.src}`); continue }
  const source = readFileSync(assetFile, 'utf8')
  const rootTag = source.match(/<svg\b[^>]*>/i)?.[0] ?? ''
  if (!new RegExp(`\\bwidth=["']${asset.width}["']`).test(rootTag) || !new RegExp(`\\bheight=["']${asset.height}["']`).test(rootTag)) failures.push(`decoded-size declaration mismatch: ${asset.src}`)
}
if (!text('ART_DROP/README.md').includes('480×270') || !text('ART_DROP/README.md').includes('rook-walk-2')) failures.push('ART_DROP guidance is incomplete')
for (const token of ['MISSING', 'DECODE_FAILED', 'DIMENSION_MISMATCH', 'DUPLICATE_CONTENT', 'INVALID_INDEX_MANIFEST_MISMATCH', 'EMPTY_INHERITING_PLACEHOLDER', 'INHERITED_PLACEHOLDER']) if (!artPack.includes(token)) failures.push(`structured art-pack diagnostic missing: ${token}`)
for (const token of ['exactKeys', 'segments.every', "bounded(animation.fps", 'new Set(animation.frames', 'expectedPlacements']) if (!artPack.includes(token)) failures.push(`hardened art-pack integrity rule missing: ${token}`)
for (const token of ['crypto.subtle.digest', 'response.arrayBuffer', 'FileReader', 'markDuplicateContent']) if (!artPack.includes(token)) failures.push(`exact-byte content identity implementation missing: ${token}`)
for (const token of ['data-slot-status', 'data-fingerprint', 'SHA-256', 'CANDIDATE NOT ACTIVE', 'ZERO CANDIDATE ASSETS INSTALLED', 'indexManifestConsistent']) if (!app.includes(token)) failures.push(`Art Lab diagnostic surface missing: ${token}`)
for (const token of ['overlapCount', 'diagnosticOverlapCount', 'minimumLabelFontPx', 'actualDimensionsPresent', 'fingerprintsPresent', 'requiredRowsPass', 'contentIdentityNegativeControl', 'duplicateControlHealthy']) if (!health.includes(token)) failures.push(`presentation health does not measure ${token}`)
for (const token of ['missing file', 'decode failure', 'DIMENSION_MISMATCH', 'identity mismatch', 'absent optional layers', 'path-distinct but content-identical', 'identical fetched bytes', 'installed optional Rook walk frames', 'width: 1280, height: 720', 'width: 1920, height: 1080']) if (!integrityTests.includes(token)) failures.push(`adversarial integrity coverage missing: ${token}`)
for (const token of ['--porcelain=v1', '--untracked-files=normal', 'Refusing to verify a dirty repository']) if (!verification.includes(token)) failures.push(`verification identity guard missing: ${token}`)
for (const token of ['pack.threads=1', 'utimesSync', 'fixedTimestamp', 'archiveEntries', 'reproducibility-check.zip', 'Consecutive deterministic archive builds']) if (!packager.includes(token)) failures.push(`reproducible packaging guard missing: ${token}`)
if (artPack.includes('URL.createObjectURL')) failures.push('art probe uses CSP-blocked blob decoding')
const schemaSourcePattern = manifestSchema.$defs?.asset?.properties?.src?.pattern ?? ''
if (!schemaSourcePattern.includes('[A-Za-z0-9._/-]*') || !manifestSchema.properties?.props || manifestSchema.properties.props.additionalProperties !== false || manifestSchema.properties.inventory.additionalProperties !== false) failures.push('published manifest schema does not reject noncanonical paths or unsupported resources')
const contentHash = (asset) => createHash('sha256').update(readFileSync(path.join(root, 'public', asset.src.replace(/^\//, '')))).digest('hex')
const walkHashes = manifest.characters.rook.animations.walkEast.frames.map(contentHash)
if (new Set(walkHashes).size !== walkHashes.length) failures.push('placeholder Rook walk frames have duplicate fetched bytes')
for (const [label, character] of [['Rook', manifest.characters.rook], ['Mr. Index', manifest.characters.mrIndex]]) if (contentHash(character.animations.talkClosed.frames[0]) === contentHash(character.animations.talkOpen.frames[0])) failures.push(`placeholder ${label} talk states have duplicate fetched bytes`)

if (failures.length) { process.stderr.write(`${failures.join('\n')}\n`); process.exitCode = 1 } else process.stdout.write('PASS: A1-R2 exact-byte animation identity, art-ready shell, opening, v2 art contract, dependency retirement, geometry, and scope boundaries are intact.\n')

function walk(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => { const target = path.join(directory, entry.name); return entry.isDirectory() ? walk(target) : [target] }) }
function assets(value) { if (Array.isArray(value)) return value.flatMap(assets); if (!value || typeof value !== 'object') return []; if (typeof value.src === 'string' && typeof value.width === 'number') return [value]; return Object.values(value).flatMap(assets) }
