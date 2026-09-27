import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { spawnSync } from 'node:child_process'

const parent = '688606e44dfea9a65134d95533edcb563a41631d'
const binaryExtensions = new Set(['.avif', '.gif', '.ico', '.jpeg', '.jpg', '.mp3', '.ogg', '.otf', '.png', '.ttf', '.wav', '.webm', '.webp', '.woff', '.woff2'])
const run = args => {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim().split('\n').filter(Boolean)
}
const sha256 = value => createHash('sha256').update(value).digest('hex')
const changed = run(['diff', '--name-only', parent, '--'])
const untracked = run(['ls-files', '--others', '--exclude-standard'])
const intended = [...new Set([...changed, ...untracked.filter(path => path.startsWith('review/s16-r2/') || path.startsWith('docs/review/s16-r2/') || path.startsWith('scripts/s16-r2/') || path === 'src/app/terminalAudio.ts' || path === 'tests/unit/s16-terminal-audio.test.ts')])]
const binaryChanges = intended.filter(path => binaryExtensions.has(extname(path).toLowerCase()))
const unauthorized = binaryChanges.filter(path => !path.startsWith('review/s16-r2/SCREENSHOTS/'))
const packageHash = sha256(readFileSync('package.json'))
const lockHash = sha256(readFileSync('package-lock.json'))
const parentPackageHash = sha256(Buffer.from(spawnSync('git', ['show', `${parent}:package.json`]).stdout))
const parentLockHash = sha256(Buffer.from(spawnSync('git', ['show', `${parent}:package-lock.json`]).stdout))
if (packageHash !== parentPackageHash || lockHash !== parentLockHash) throw new Error('Dependency manifest or lockfile changed from the required R1 parent')
if (unauthorized.length) throw new Error(`Unauthorized S16-R2 static binary changes: ${unauthorized.join(', ')}`)
const expectedAudio = {
  'public/audio/background-main.ogg': '8baa21d286f8371dd3a233e14264ec8fb0f6e727a53f7446306c96660eb6dcfd',
  'public/audio/background-terminal.ogg': 'e5ed7b7d320761a694193d7edc00f0ffe640ef87a43ac0e02f9097806f18a5f4',
  'public/audio/degauss-sfx.mp3': '03f2bae5ec4a4536b021698c62204822d77c227746f87a11f07292c1533ac9f7',
}
for (const [path, expected] of Object.entries(expectedAudio)) if (sha256(readFileSync(path)) !== expected) throw new Error(`Original audio hash changed: ${path}`)
console.log(JSON.stringify({ status: 'PASS', base: parent, intendedPaths: intended.length, reviewScreenshots: binaryChanges.length, unauthorizedStaticBinaries: 0, packageHash, lockHash, audioHashes: expectedAudio }))
