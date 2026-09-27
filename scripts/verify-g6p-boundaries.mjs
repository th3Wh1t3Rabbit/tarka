#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const failures = []
const app = readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8')
const distText = readdirSync(path.join(root, 'dist/assets')).filter((name) => name.endsWith('.js')).map((name) => readFileSync(path.join(root, 'dist/assets', name), 'utf8')).join('\n')
const distCss = readdirSync(path.join(root, 'dist/assets')).filter((name) => name.endsWith('.css')).map((name) => readFileSync(path.join(root, 'dist/assets', name), 'utf8')).join('\n')
const manifest = JSON.parse(readFileSync(path.join(root, 'public/art-packs/placeholder/manifest.json'), 'utf8'))
const scenario = JSON.parse(readFileSync(path.join(root, 'public/scenarios/euler-2023-false-exit/scenario.json'), 'utf8'))
const early = scenario.evidence.find(({ id }) => id === 'EXACT_EARLY_NET')

if (/VaultScene|G6LegacyApp|@react-three|from ['"]three/.test(app)) failures.push('ordinary App imports a retired renderer')
if (/GUIDED_PROBE_3D|THREE\.Clock|WebGLRenderer/.test(distText)) failures.push('production bundle contains retired 3D presentation code')
if (/\.vault-canvas|\.truth-engine|\.app-shell/.test(distCss)) failures.push('production CSS contains retired presentation selectors')
if (existsSync(path.join(root, 'src/acquisition/config/g6-alchemy-atomic-allowance.json'))) failures.push('active Alchemy allowance remains installed')
if (manifest.status !== 'PROVISIONAL_PLACEHOLDER') failures.push('placeholder pack is not honestly labeled')
if (manifest.logicalFrame.width !== 960 || manifest.logicalFrame.height !== 540 || manifest.logicalFrame.sceneHeight !== 360) failures.push('logical frame contract changed')
for (const group of [manifest.backgrounds, manifest.characters.rook, manifest.characters.mrIndex, manifest.props, manifest.inventory, manifest.cursor]) {
  for (const asset of Object.values(group)) {
    if (!asset?.src) continue
    if (!existsSync(path.join(root, 'public', asset.src.replace(/^\//, '')))) failures.push(`missing manifest asset ${asset.src}`)
  }
}
if (!early || early.observedAtUtc !== '2023-03-13T08:50:59Z' || early.facts.assetAmounts[0]?.amount !== '8877507.3483067') failures.push('accepted First Breach record drifted')
if (!app.includes('THE OFFICE PUZZLE IS FICTIONAL FRAMING')) failures.push('fictional/factual boundary label is missing')
if (!app.includes('PROVISIONAL ART HARNESS // NOT FINAL ART')) failures.push('placeholder honesty label is missing')
if (!app.includes('FIND THE FIRST BREACH RECORD.')) failures.push('bounded A0 objective is missing')
for (const required of ['rook.walk', 'rook.inspect', 'rook.useGive', 'mrIndex.stamp']) if (!app.includes(required)) failures.push(`active renderer does not consume ${required}`)
for (const stale of ['VISUAL_REVIEW_GUIDE.md', 'WHAT_CHANGED_FROM_G5.md', 'ART_DIRECTION_CHANGELOG.md']) if (existsSync(path.join(root, 'PRINCIPAL_PREVIEW', stale))) failures.push(`stale G6 preview guide remains: ${stale}`)
if (failures.length) { process.stderr.write(`${failures.join('\n')}\n`); process.exitCode = 1 } else process.stdout.write('PASS: point-and-click primary, retired-renderer quarantine, art harness, and First Breach truth boundary are intact.\n')
