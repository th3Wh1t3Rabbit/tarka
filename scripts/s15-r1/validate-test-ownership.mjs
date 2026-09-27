import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const manifestPath = 'scripts/s15-r1/test-ownership.json'
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const allowed = new Set(['CURRENT_PRODUCTION_REQUIRED', 'HISTORICAL_SUPERSEDED', 'HISTORICAL_EXTERNAL_FIXTURE_DIAGNOSTIC'])
const discovered = ['tests/unit', 'tests/acquisition', 'tests/e2e'].flatMap(directory => readdirSync(directory)
  .filter(name => /\.(?:test|spec)\.(?:ts|tsx|mjs)$/.test(name))
  .map(name => join(directory, name))).sort()
const entries = manifest.classifications
const listed = entries.map(entry => entry.path).sort()
const duplicates = listed.filter((path, index) => path === listed[index - 1])
if (duplicates.length) throw new Error(`Duplicate classifications: ${duplicates.join(', ')}`)
if (JSON.stringify(discovered) !== JSON.stringify(listed)) throw new Error(`Unclassified or nonexistent tests\nDISCOVERED=${JSON.stringify(discovered)}\nLISTED=${JSON.stringify(listed)}`)
for (const entry of entries) {
  if (!allowed.has(entry.classification)) throw new Error(`Invalid classification: ${entry.path}`)
  if (entry.classification !== 'CURRENT_PRODUCTION_REQUIRED' && (entry.reason.trim().length < 40 || entry.authority.trim().length < 8)) throw new Error(`Non-current classification lacks precise authority reason: ${entry.path}`)
  if (entry.classification === 'CURRENT_PRODUCTION_REQUIRED') {
    const source = readFileSync(entry.path, 'utf8')
    for (const forbidden of ['/tmp/TRACE_ESCAPE', 'TEXT PACED', 'OPEN CASE TERMINAL']) if (source.includes(forbidden)) throw new Error(`Current test asserts transient or retired behavior (${forbidden}): ${entry.path}`)
  }
}
for (const path of manifest.protectedCurrentPaths) {
  const entry = entries.find(candidate => candidate.path === path)
  if (entry?.classification !== 'CURRENT_PRODUCTION_REQUIRED') throw new Error(`Protected current test was silently reclassified: ${path}`)
}
for (const owner of manifest.currentSourceOwners) {
  if (!owner.tests.length) throw new Error(`Current source owner has no test family: ${owner.owner}`)
  for (const path of owner.tests) if (!manifest.protectedCurrentPaths.includes(path)) throw new Error(`Source owner maps to a non-current test: ${owner.owner} -> ${path}`)
}
const currentUnit = entries.filter(entry => entry.classification === 'CURRENT_PRODUCTION_REQUIRED' && !entry.path.startsWith('tests/e2e/'))
const currentE2e = entries.filter(entry => entry.classification === 'CURRENT_PRODUCTION_REQUIRED' && entry.path.startsWith('tests/e2e/'))
if (currentUnit.length < manifest.minimumCurrentCounts.unitAcquisition || currentE2e.length < manifest.minimumCurrentCounts.e2e) throw new Error('Current suite count fell below the authority-backed floor')
const expectedScripts = {
  test: 'node scripts/s15-r1/run-owned-tests.mjs unit',
  'test:e2e': 'node scripts/s15-r1/run-owned-tests.mjs e2e',
  'test:historical': 'node scripts/s15-r1/run-owned-tests.mjs historical-unit',
  'test:e2e:historical': 'node scripts/s15-r1/run-owned-tests.mjs historical-e2e',
}
for (const [name, command] of Object.entries(expectedScripts)) if (packageJson.scripts[name] !== command) throw new Error(`package.json ${name} diverges from ownership manifest`)
const digest = createHash('sha256').update(entries.map(entry => `${entry.path}\0${entry.classification}\0${entry.authority}\0${entry.reason}`).join('\n')).digest('hex')
const receipt = { status: 'PASS', schemaVersion: manifest.schemaVersion, discovered: discovered.length, currentUnitAcquisition: currentUnit.length, currentE2e: currentE2e.length, historical: entries.length - currentUnit.length - currentE2e.length, classificationDigest: digest }
mkdirSync('artifacts/s15-r1/RECEIPTS', { recursive: true })
writeFileSync('artifacts/s15-r1/RECEIPTS/TEST_OWNERSHIP.json', `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt))
