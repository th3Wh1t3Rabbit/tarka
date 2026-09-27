import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { spawnSync } from 'node:child_process'

const parent = '6955ffcfb7c6aa04e7d2c56278997c343e69b1a2'
const binaryExtensions = new Set(['.avif', '.gif', '.ico', '.jpeg', '.jpg', '.mp3', '.ogg', '.otf', '.png', '.ttf', '.wav', '.webm', '.webp', '.woff', '.woff2'])
const run = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim().split('\n').filter(Boolean)
}
const changed = run(['diff', '--name-only', parent, '--'])
const untracked = run(['ls-files', '--others', '--exclude-standard'])
const intended = [...new Set([...changed, ...untracked.filter(path => path.startsWith('review/s16/') || path.startsWith('scripts/s16/') || path === 'src/app/S16Terminal.tsx' || path === 'src/investigation/s16.ts' || path === 'tests/e2e/s16-guided-terminal.spec.ts' || path === 'tests/unit/s16-guided-terminal.test.ts')])]
const binaryChanges = intended.filter(path => binaryExtensions.has(extname(path).toLowerCase()))
const unauthorized = binaryChanges.filter(path => !path.startsWith('review/s16/SCREENSHOTS/'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const packageHash = sha256(readFileSync('package.json'))
const lockHash = sha256(readFileSync('package-lock.json'))
const parentPackageHash = sha256(Buffer.from(spawnSync('git', ['show', `${parent}:package.json`]).stdout))
const parentLockHash = sha256(Buffer.from(spawnSync('git', ['show', `${parent}:package-lock.json`]).stdout))
if (packageHash !== parentPackageHash || lockHash !== parentLockHash) throw new Error('Dependency manifest or lockfile changed from the required parent')
if (unauthorized.length) throw new Error(`Unauthorized static binary changes: ${unauthorized.join(', ')}`)
console.log(JSON.stringify({ status: 'PASS', intendedPaths: intended.length, reviewScreenshots: binaryChanges.length, unauthorizedStaticBinaries: 0, packageHash, lockHash }))
