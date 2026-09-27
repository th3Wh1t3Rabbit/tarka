import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const BASE = '276e61c88acfe64b40ede07ccce1cc852746e9e6'
const BASE_TREE = '44b225120f422a3cde4f0e4db9deffff19dcb59b'
const PRIMARY_HEAD = '0f52131c9f56f49128e7a413396331917e687a1f'
const NAME = 'TRACE_ESCAPE_G6P_NQ5_T1_S7_R3_R1_RUNTIME_SEQUENCE_PERFORMANCE_AND_WORKBENCH_COMPLETION_DELIVERY_v1.0.0.zip'
const CONTROLLER = '/path/to/local-user/Downloads/TRACE_ESCAPE_MAIN_TO_CODEX_G6P_NQ5_T1_S7_R3_R1_RUNTIME_SEQUENCE_PERFORMANCE_AND_WORKBENCH_COMPLETION_PROMPT_v1.0.0_2026-09-19.txt'
const root = process.cwd()
const [primaryFlag, primaryRoot, outputFlag, outputDirectory] = process.argv.slice(2)
assert.equal(primaryFlag, '--primary-reference-root')
assert.equal(outputFlag, '--output-directory')

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const run = (command, args, cwd = root, environment = process.env) => execFileSync(command, args, {
  cwd,
  env: environment,
  encoding: command === 'git' || command === 'node' ? 'utf8' : undefined,
  maxBuffer: 256_000_000,
})
const git = (...args) => String(run('git', args)).trim()
const primaryMetadata = () => ({
  head: String(run('git', ['rev-parse', 'HEAD'], primaryRoot)).trim(),
  status: String(run('git', ['status', '--porcelain=v1', '--untracked-files=no'], primaryRoot)).trim(),
})

const primaryBefore = primaryMetadata()
assert.deepEqual(primaryBefore, { head: PRIMARY_HEAD, status: 'M AGENTS.md' })
const candidate = {
  commit: git('rev-parse', 'HEAD'),
  tree: git('rev-parse', 'HEAD^{tree}'),
  parent: git('rev-parse', 'HEAD^'),
}
assert.equal(candidate.parent, BASE)
assert.equal(git('rev-parse', BASE + '^{tree}'), BASE_TREE)
assert.equal(git('rev-list', '--count', BASE + '..HEAD'), '1')
assert.equal(git('rev-list', '--merges', BASE + '..HEAD'), '')
assert.equal(git('diff', '--name-only', 'HEAD'), '')
assert.equal(git('rev-parse', 'HEAD:AGENTS.md'), git('rev-parse', BASE + ':AGENTS.md'))

const changed = git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean)
const allowedExact = new Set([
  'package.json',
  'scripts/s7-r3-r1-browser.config.mjs',
  'src/adventure/reducer.ts',
  'src/adventure/types.ts',
  'src/app/App.tsx',
  'src/app/GameDialoguePresentation.tsx',
  'src/controller/content/s7-r3.ts',
  'src/controller/mission/performance.ts',
  'src/styles/a0.css',
  'tests/e2e/s7-r3-runtime.spec.ts',
  'tests/fixtures/s2/browser-helpers.ts',
  'tests/fixtures/s2/domain-helpers.ts',
  'tests/unit/g6p-a0.test.ts',
  'tests/unit/s7-r1-mission-choreography.test.ts',
  'tests/unit/s7-r2a-interaction-performance.test.ts',
  'tests/unit/s7-r3-exact-content-performance.test.ts',
])
const allowed = (file) => allowedExact.has(file)
  || file.startsWith('scripts/nq5-s7-r3/')
  || file.startsWith('artifacts/g6p-s7-r3-r1/')
  || file.startsWith('artifacts/principal-review/')
assert.ok(changed.length > 0 && changed.every(allowed))
for (const protectedPath of [
  'AGENTS.md',
  'content/parallel/narrative',
  'docs/parallel/lane-a',
  'docs/parallel/lane-c',
  'public/scenarios/euler-2023-false-exit',
  'src/controller/content/runtime-content.json',
  'artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json',
  'tests/unit/parallel/narrative-contract',
]) assert.equal(git('diff', '--name-only', BASE, 'HEAD', '--', protectedPath), '')

const exactHashes = {
  'content/parallel/narrative/S7_R2B_CLAIM_BOUNDARY_AUDIT.json': '8cc73e4f2a9eb73c48307a49cd155794843590a3bff65cfbf0661b5f51ed1fe6',
  'content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json': '24fbc0221056f7aaf8aa64862b97ed7c6a1e24f82d7230866b49189d41611953',
  'content/parallel/narrative/S7_R2B_INTERACTION_MATRIX.json': '877f500e51d53218c7af2b855934c37a8af76a6fe752844aff500e4d46908a8d',
  'content/parallel/narrative/S7_R2B_LINE_LENGTH_REPORT.json': 'a88870fbb5c985a0d44e41919f191b0473938c0a88d78a6f00410475ad07c4a6',
  'content/parallel/narrative/S7_R2B_RUNTIME_SELECTION_MAP.json': '664e774b787b83aa9dc196d7be5bbc28977e376c7acf7fc95407df43f32ce1c4',
  'content/parallel/narrative/S7_R2B_SEMANTIC_INTENTS.json': 'e8eb03344e8e23cea6e3d1bc27c8fba84ab9df0bcd6380a4c4eafcfcef63d5aa',
  'content/parallel/narrative/S7_R2B_SOURCE_LINE_LEDGER.json': '73c711c0826f35afd9981ab8b6388d11132a0fa8d725bac5c4c1007d80e41809',
  'docs/parallel/lane-a/TE_IFACE_CONTENT_v1.2.0.json': 'afcec0c5b761e282e65c02a355d7e6e61625c4ace01cdc5a52324ed910ef8d0a',
}
for (const [file, expected] of Object.entries(exactHashes)) assert.equal(sha(fs.readFileSync(file)), expected)
assert.equal(sha(fs.readFileSync(CONTROLLER)), 'ae614ad7ae4c8d949436bda97c462cbd7a63a3ffa0974bc55f260f8457908001')

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 's7-r3-r1-delivery-'))
const payload = path.join(temporary, 'payload')
const recovery = path.join(temporary, 'recovery')
const bundlePath = path.join(temporary, 's7-r3-r1-incremental.bundle')
fs.mkdirSync(payload)
const members = new Map()
const put = (name, value) => {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
  assert.ok(!members.has(name) && !name.startsWith('/') && !name.split('/').some((part) => ['', '.', '..'].includes(part)))
  const destination = path.join(payload, name)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, bytes, { flag: 'wx' })
  members.set(name, bytes)
}
const addTree = (source, prefix) => {
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? walk(path.join(directory, entry.name))
    : entry.isFile() ? [path.join(directory, entry.name)] : [])
  for (const file of walk(source).sort()) put(prefix + '/' + path.relative(source, file).split(path.sep).join('/'), fs.readFileSync(file))
}

run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundlePath, 'HEAD', '^' + BASE])
const bundle = fs.readFileSync(bundlePath)
const sourceDiff = execFileSync('git', ['diff', '--binary', BASE, 'HEAD'], { cwd: root, maxBuffer: 256_000_000 })
put('GIT/trace-escape-s7-r3-r1-incremental.bundle', bundle)
put('SOURCE_DIFF.patch', sourceDiff)
put('INPUTS/CONTROLLER_PROMPT.txt', fs.readFileSync(CONTROLLER))
put('LEAD_NOTES.md', fs.readFileSync('artifacts/g6p-s7-r3-r1/LEAD_NOTES.md'))
addTree('artifacts/g6p-s7-r3-r1/REPORTS', 'REPORTS')
addTree('artifacts/g6p-s7-r3-r1/LOGS', 'LOGS')
addTree('artifacts/g6p-s7-r3-r1/SCREENSHOTS', 'SCREENSHOTS')
addTree('artifacts/principal-review', 'PRINCIPAL_REVIEW_WORKBENCH')
put('EVIDENCE/CHANGED_PATHS.json', {
  schemaVersion: '1.0.0',
  status: 'PASS',
  base: BASE,
  candidate,
  linearCommits: [candidate.commit],
  merges: 0,
  paths: changed.map((file) => ({
    file,
    sha256: sha(execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, maxBuffer: 256_000_000 })),
  })),
})

const validation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r3-r1/REPORTS/VALIDATION_SUMMARY.json', 'utf8'))
const preservation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r3-r1/REPORTS/PRESERVATION_AND_NO_EFFECTS.json', 'utf8'))
assert.equal(validation.status, 'PASS_WITH_DISCLOSED_HISTORICAL_PHASE_ONLY_TESTS')
assert.equal(preservation.status, 'PASS')
const manifest = {
  schemaVersion: '1.0.0',
  status: 'DELIVERED_PENDING_MAIN_LEAD_REVIEW',
  candidate,
  reviewedBase: BASE,
  reviewedTree: BASE_TREE,
  incrementalPrerequisite: BASE,
  changedPaths: changed.length,
  focusedUnitTests: 41,
  acquisitionTests: 107,
  fullUnitTestsPassed: 2373,
  fullUnitTestsTotal: 2374,
  browserChecks: 15,
  workbenchFiles: 14,
  rendererScreenshots: 12,
  providerRequests: 0,
  credentialAccess: false,
  productionPixelAccess: false,
  sourcePromoted: false,
  productionArtApproved: false,
  publicTitleBound: false,
  contentLock: false,
  release: false,
  mission02: false,
  bundleSha256: sha(bundle),
  sourceDiffSha256: sha(sourceDiff),
}
put('DELIVERY_MANIFEST.json', manifest)
put('00_READ_ME_FIRST.md', `S7-R3-R1 ${manifest.status}. This offline delivery recovers one exact linear child of prerequisite ${BASE}. Run node VERIFY_DELIVERY.mjs after safe extraction. It contains the active-sequence runtime, phrase-level performance bindings, completed deterministic Principal Review Workbench, actual-renderer evidence, E-01 feasibility plan, reports, validation logs, screenshots, and two self-reviews. No provider requests, credential/private-config access, production Pixel access, source promotion, production art approval, public-title/content lock, release, or Mission 02 authorization occurred. The comprehensive historical run's two unchanged phase-only digest exceptions are disclosed; current focused/acquisition/browser/typecheck/lint/build/source/boundary/isolation/determinism gates pass. The incremental Git bundle requires the stated base; the final ZIP SHA-256 is the external trust root.\n`)

let verifier = ''
const seal = () => {
  const names = [...members.keys(), 'VERIFY_DELIVERY.mjs', 'MANIFEST.sha256'].sort()
  const pins = Object.fromEntries([...members].map(([name, bytes]) => [name, sha(bytes)]))
  verifier = `import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';const root=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),names=${JSON.stringify(names)},pins=${JSON.stringify(pins)},expected=${JSON.stringify(manifest)};const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name),s=fs.lstatSync(p);if(s.isSymbolicLink()||(!s.isDirectory()&&(!s.isFile()||s.nlink!==1)))throw Error('NONREGULAR');return s.isDirectory()?walk(p):[path.relative(root,p).split(path.sep).join('/')]});if(JSON.stringify(walk(root).sort())!==JSON.stringify(names))throw Error('EXACT_MEMBERS');for(const[n,h]of Object.entries(pins))if(sha(fs.readFileSync(path.join(root,n)))!==h)throw Error('PIN:'+n);if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'DELIVERY_MANIFEST.json'),'utf8')))!==JSON.stringify(expected))throw Error('MANIFEST');const seen=new Set;for(const line of fs.readFileSync(path.join(root,'MANIFEST.sha256'),'utf8').trim().split('\\n')){const h=line.slice(0,64),n=line.slice(66);if(seen.has(n)||sha(fs.readFileSync(path.join(root,n)))!==h)throw Error('HASH:'+n);seen.add(n)}if(seen.size!==names.length-1)throw Error('HASH_COUNT');console.log(JSON.stringify({status:'PASS',members:names.length,candidate:expected.candidate,terminalStatus:expected.status}));\n`
  put('VERIFY_DELIVERY.mjs', verifier)
  put('MANIFEST.sha256', [...members].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => sha(bytes) + '  ' + name).join('\n') + '\n')
  return names
}
const names = seal()
run('node', ['VERIFY_DELIVERY.mjs'], payload)

fs.mkdirSync(recovery)
run('git', ['init', '--quiet'], recovery)
fs.mkdirSync(path.join(recovery, '.git/objects/info'), { recursive: true })
fs.writeFileSync(path.join(recovery, '.git/objects/info/alternates'), git('rev-parse', '--path-format=absolute', '--git-path', 'objects') + '\n')
run('git', ['bundle', 'verify', bundlePath], recovery)
run('git', ['fetch', '--quiet', bundlePath, 'HEAD:refs/heads/candidate'], recovery)
run('git', ['checkout', '--quiet', 'candidate'], recovery)
assert.equal(String(run('git', ['rev-parse', 'HEAD'], recovery)).trim(), candidate.commit)
run('git', ['fsck', '--full', '--strict'], recovery)
assert.ok(sourceDiff.equals(execFileSync('git', ['diff', '--binary', BASE, 'HEAD'], { cwd: recovery, maxBuffer: 256_000_000 })))
fs.symlinkSync(path.join(root, 'node_modules'), path.join(recovery, 'node_modules'), 'dir')
const environment = { ...process.env, PATH: path.join(root, 'node_modules/.bin') + path.delimiter + process.env.PATH, CI: '1', NO_COLOR: '1' }
run('npm', ['run', 'typecheck', '--silent'], recovery, environment)
run('node', ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/s7-r3-exact-content-performance.test.ts', '--maxWorkers=1'], recovery, environment)
run('node', ['scripts/nq5-s7-r3/verify-workbench-determinism.mjs'], recovery, environment)

for (const name of names) fs.utimesSync(path.join(payload, name), new Date('2000-01-01T00:00:00Z'), new Date('2000-01-01T00:00:00Z'))
const firstZip = path.join(temporary, 'first.zip')
const secondZip = path.join(temporary, 'second.zip')
run('zip', ['-X', '-q', firstZip, ...names], payload)
run('zip', ['-X', '-q', secondZip, ...names], payload)
assert.equal(sha(fs.readFileSync(firstZip)), sha(fs.readFileSync(secondZip)))
assert.deepEqual(primaryMetadata(), primaryBefore)
assert.equal(git('diff', '--name-only', 'HEAD'), '')
fs.mkdirSync(outputDirectory, { recursive: true })
const destination = path.join(outputDirectory, NAME)
fs.copyFileSync(firstZip, destination, fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({
  status: manifest.status,
  archive: destination,
  sha256: sha(fs.readFileSync(destination)),
  bytes: fs.statSync(destination).size,
  members: names.length,
  candidate,
  freshRecovery: true,
  deterministicZip: true,
  primaryPreserved: true,
}, null, 2))
