import { createHash } from 'node:crypto'
import { createWriteStream, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve('.')
const logs = resolve('review/s15-r5/LOGS')
mkdirSync(logs, { recursive: true })

async function run(name, command, args, env = {}) {
  const log = createWriteStream(resolve(logs, `${name}.log`))
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env } })
  child.stdout.on('data', chunk => { process.stdout.write(chunk); log.write(chunk) })
  child.stderr.on('data', chunk => { process.stderr.write(chunk); log.write(chunk) })
  const code = await new Promise((resolveCode, reject) => {
    child.on('error', reject)
    child.on('close', resolveCode)
  })
  log.end()
  if (code !== 0) throw new Error(`${name} failed with exit ${code}`)
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}
function hashes(dir) {
  return Object.fromEntries(walk(dir).sort().map(path => [relative(dir, path), createHash('sha256').update(readFileSync(path)).digest('hex')]))
}

await run('00-transmission-verifier', 'python3', ['/tmp/s15-r5-transmission/VERIFY_TRANSMISSION.py'])
await run('01-script-export-first', 'node', ['scripts/s15-r5/export-script-review.mjs'])
const exportDir = resolve('review/s15-r5/SCRIPT_EXPORT/TARKA_SCRIPT_REVIEW_v1.1.0')
const first = hashes(exportDir)
await run('02-script-export-replay', 'node', ['scripts/s15-r5/export-script-review.mjs'])
const second = hashes(exportDir)
if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('SCRIPT_EXPORT_NOT_BYTE_IDENTICAL')
writeFileSync(resolve(logs, '03-script-export-byte-identity.log'), `PASS_BYTE_IDENTICAL ${Object.keys(first).length} files\n`)

await run('04-focused-unit', 'npx', ['vitest', 'run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', 'tests/unit/s15-r5-truthful-closure.test.ts'])
await run('05-focused-browser', 'npx', ['playwright', 'test', '--workers=1', 'tests/e2e/s15-r5-truthful-closure.spec.ts'], { PLAYWRIGHT_PORT: '4177' })
await run('06-canonical-unit', 'npm', ['test'])
await run('07-canonical-browser', 'npm', ['run', 'test:e2e'], { PLAYWRIGHT_PORT: '4177' })
await run('08-typecheck', 'npm', ['run', 'typecheck'])

const changed = (await new Promise((resolveText, reject) => {
  const child = spawn('git', ['diff', '--name-only', 'HEAD'], { cwd: root })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.on('error', reject)
  child.on('close', code => code === 0 ? resolveText(output) : reject(new Error('git diff failed')))
})).trim().split('\n').filter(path => /\.(?:ts|tsx|mjs)$/.test(path))
if (changed.length) await run('09-changed-scope-lint', 'npx', ['eslint', '--max-warnings=0', ...changed])
else writeFileSync(resolve(logs, '09-changed-scope-lint.log'), 'PASS_NO_CHANGED_LINT_PATHS\n')

await run('10-production-build', 'npm', ['run', 'build'])
const dist = walk(resolve('dist'))
const maps = dist.filter(path => path.endsWith('.map'))
const forbidden = /(?:\/home\/al|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|api[_-]?key\s*[:=]|secret\s*[:=])/i
const contaminated = dist.filter(path => /\.(?:js|map|html|css)$/.test(path) && forbidden.test(readFileSync(path, 'utf8')))
if (contaminated.length) throw new Error(`BUILT_OUTPUT_SCAN_FAILED ${contaminated.join(',')}`)
writeFileSync(resolve(logs, '11-built-output-scan.log'), `DIST_FILE_COUNT=${dist.length}\nSOURCE_MAP_COUNT=${maps.length}\nPASS: no private paths or obvious secret tokens\n`)

await run('12-blocked-network', 'npx', ['playwright', 'test', '--workers=1', 'tests/e2e/s15-r5-truthful-closure.spec.ts', '--grep', 'ordinary-network-journey'], { PLAYWRIGHT_PORT: '4177' })
await run('13-secret-scan', 'npm', ['run', 'secret:scan'])
await run('14-secret-history-scan', 'npm', ['run', 'secret:scan-history'])
await run('15-real-mutations', 'node', ['scripts/s15-r5/run-mutations.mjs'])

const mutation = JSON.parse(readFileSync(resolve('review/s15-r5/MUTATIONS/MUTATION_RESULTS.json'), 'utf8'))
const receipt = {
  schema: 'tarka.s15-r5.qualification.v1',
  status: mutation.total === 12 && mutation.caught === 12 && mutation.cleanTeardown ? 'PASS' : 'BLOCKED',
  port: 4177,
  userAuthorizedAlternatePort: true,
  scriptExportByteIdentical: true,
  mutationTotal: mutation.total,
  mutationCaught: mutation.caught,
  providerRequests: 0,
  externalRequests: 0,
  externalWebSockets: 0,
  bugbot: 'BUGBOT_UNAVAILABLE',
  s16: 'S16_READ_ONLY_READY_NOT_STARTED',
  principalPlaytest2: 'PRINCIPAL_PLAYTEST_2_NOT_AUTHORIZED',
  reviewStatus: 'PENDING_CHATGPT_MAIN_LEAD_REVIEW',
  generatedAt: new Date().toISOString(),
}
writeFileSync(resolve('review/s15-r5/QUALIFICATION.json'), `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt))
