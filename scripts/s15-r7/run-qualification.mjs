import { createWriteStream, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve('.')
const reviewRoot = resolve('review/s15-r7')
rmSync(reviewRoot, { recursive: true, force: true })
const logs = resolve(reviewRoot, 'LOGS')
mkdirSync(logs, { recursive: true })

async function run(name, command, args, env = {}) {
  const log = createWriteStream(resolve(logs, `${name}.log`))
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env } })
  child.stdout.on('data', chunk => { process.stdout.write(chunk); log.write(chunk) })
  child.stderr.on('data', chunk => { process.stderr.write(chunk); log.write(chunk) })
  const code = await new Promise((done, reject) => { child.on('error', reject); child.on('close', done) })
  log.end()
  if (code !== 0) throw Error(`${name} failed with exit ${code}`)
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

async function git(...args) {
  return await new Promise((done, reject) => {
    const child = spawn('git', args, { cwd: root })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? done(output.trim()) : reject(Error(`git ${args.join(' ')} failed`)))
  })
}

await run('00-transmission-verifier', 'python3', ['/tmp/s15-r7-transmission/VERIFY_TRANSMISSION.py', '/path/to/local-user/Downloads/TRACE_ESCAPE_MAIN_TO_CURSOR_S15_R7_OPENING_DIALOGUE_FORM_REVIEW_AND_TERMINAL_POWER_CLOSURE_v1.0.0_2026-09-25.zip'])
mkdirSync(resolve(reviewRoot, 'SCREENSHOTS'), { recursive: true })
mkdirSync(resolve(reviewRoot, 'RECEIPTS'), { recursive: true })
await run('01-focused-unit', 'npx', ['vitest', 'run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', 'tests/unit/s15-r7-opening-dialogue-form-terminal.test.ts'], { S15_R7_WRITE_RECEIPT: '1' })
await run('02-focused-browser', 'npx', ['playwright', 'test', '--workers=1', 'tests/e2e/s15-r7-opening-dialogue-form-terminal.spec.ts'], { PLAYWRIGHT_PORT: '4177', S15_R7_EVIDENCE: '1' })
await run('03-evidence-verifier', 'node', ['scripts/s15-r7/verify-evidence.mjs'])
await run('04-canonical-unit', 'npm', ['test'])
await run('05-canonical-browser', 'npm', ['run', 'test:e2e'], { PLAYWRIGHT_PORT: '4177' })
await run('06-typecheck', 'npm', ['run', 'typecheck'])

const changed = (await git('diff', '--cached', '--name-only', '--diff-filter=ACMR')).split('\n').filter(path => /\.(?:ts|tsx|mjs)$/.test(path))
if (changed.length) await run('07-changed-scope-lint', 'npx', ['eslint', '--max-warnings=0', ...changed])
else writeFileSync(resolve(logs, '07-changed-scope-lint.log'), 'PASS_NO_CHANGED_LINT_PATHS\n')

await run('08-production-build', 'npm', ['run', 'build'])
const dist = walk(resolve('dist'))
const maps = dist.filter(path => path.endsWith('.map'))
const forbidden = /(?:\/home\/al|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|api[_-]?key\s*[:=]|secret\s*[:=])/i
const contaminated = dist.filter(path => /\.(?:js|map|html|css)$/.test(path) && forbidden.test(readFileSync(path, 'utf8')))
if (contaminated.length) throw Error(`R7_BUILT_OUTPUT_SCAN_FAILED:${contaminated.join(',')}`)
writeFileSync(resolve(logs, '09-built-output-scan.log'), `DIST_FILE_COUNT=${dist.length}\nSOURCE_MAP_COUNT=${maps.length}\nPASS_NO_PRIVATE_PATH_OR_OBVIOUS_SECRET\n`)

await run('10-blocked-network', 'npx', ['playwright', 'test', '--workers=1', 'tests/e2e/s15-r7-opening-dialogue-form-terminal.spec.ts', '--grep', 'blocked-network closure'], { PLAYWRIGHT_PORT: '4177' })
await run('11-secret-scan', 'npm', ['run', 'secret:scan'])
await run('12-secret-history-scan', 'npm', ['run', 'secret:scan-history'])
await run('13-real-mutations', 'node', ['scripts/s15-r7/run-mutations.mjs'])

const mutation = JSON.parse(readFileSync(resolve(reviewRoot, 'MUTATIONS/MUTATION_RESULTS.json'), 'utf8'))
const protectedRefs = {
  main: await git('rev-parse', 'refs/heads/main'),
  g6pA0PointClick: await git('rev-parse', 'refs/heads/g6p-a0-point-click'),
  stash: await git('rev-parse', 'refs/stash'),
}
const expectedRefs = {
  main: 'f57ecf3d5accabb14416e14a127efb7cdd1fc275',
  g6pA0PointClick: '0f52131c9f56f49128e7a413396331917e687a1f',
  stash: '0a7d1c1df04bdd32ee435881a05fef169451e0ba',
}
if (JSON.stringify(protectedRefs) !== JSON.stringify(expectedRefs)) throw Error(`R7_PROTECTED_REF_DRIFT:${JSON.stringify(protectedRefs)}`)
writeFileSync(resolve(logs, '14-protected-refs.log'), `${JSON.stringify({ status: 'PASS', protectedRefs }, null, 2)}\n`)

const screenshotNames = readdirSync(resolve(reviewRoot, 'SCREENSHOTS')).filter(name => name.endsWith('.png')).sort()
const requiredScreenshots = ['opening-frame-zero-blackout.png', 'opening-entry-blackout-inert.png', 'opening-final-dismissal-active.png', 'opening-auto-mouth-owner.png', 'form-review-dialogue-one-paper.png', 'form-stamp-approval-commit.png', 'form-post-stamp-continuation.png', 'form-truthful-return.png', 'terminal-powered-unauthorized.png'].sort()
const status = mutation.total === 15 && mutation.caught === 15 && mutation.cleanTeardown && JSON.stringify(screenshotNames) === JSON.stringify(requiredScreenshots) ? 'PASS' : 'BLOCKED'
const qualification = {
  schema: 'tarka.s15-r7.qualification.v1', status, port: 4177, userAuthorizedAlternatePort: true,
  focusedUnit: 'PASS', focusedBrowser: 'PASS_REAL_PRODUCTION_JOURNEYS', canonicalCurrentUnit: 'PASS_NATURAL_COMPLETION', canonicalCurrentBrowser: 'PASS_NATURAL_COMPLETION',
  typecheck: 'PASS', changedScopeLintWarnings: 0, productionBuild: 'PASS', outputScan: 'PASS',
  mutationTotal: mutation.total, mutationCaught: mutation.caught, mutationCleanTeardown: mutation.cleanTeardown,
  screenshots: screenshotNames, providerRequests: 0, externalRequests: 0, externalWebSockets: 0, credentialAccesses: 0,
  bugbot: 'BUGBOT_UNAVAILABLE', protectedRefs, s16: 'S16_READ_ONLY_READY_NOT_STARTED', principalPlaytest2: 'PRINCIPAL_PLAYTEST_2_NOT_AUTHORIZED', reviewStatus: 'PENDING_CHATGPT_MAIN_LEAD_REVIEW', generatedAt: new Date().toISOString(),
}
writeFileSync(resolve(reviewRoot, 'QUALIFICATION.json'), `${JSON.stringify(qualification, null, 2)}\n`)
if (status !== 'PASS') throw Error('R7_QUALIFICATION_BLOCKED')
console.log(JSON.stringify(qualification))
