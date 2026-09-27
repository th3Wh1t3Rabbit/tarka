import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const BASE = 'd0ad6cc17604cd3c79b7a873ceaeeab060da5e1b'
const BASE_TREE = '7b0c7729e87934b38a169a901bbd70cc0e0801a2'
const PRIMARY_HEAD = '0f52131c9f56f49128e7a413396331917e687a1f'
const REGISTRY_DIGEST = 'cc5dff67cc0b255edcc00a7c3c8789a9ca6f0c777ff29b20792daba5c35e67fe'
const NAME = 'TRACE_ESCAPE_G6P_NQ5_T1_S7_R3_R3_REVISION_REGISTRY_TIMESTAMP_AND_CANONICAL_COMMENT_IDENTITY_COMPLETION_DELIVERY_v1.0.0.zip'
const CONTROLLER = '/path/to/local-user/Downloads/TRACE_ESCAPE_MAIN_TO_CODEX_G6P_NQ5_T1_S7_R3_R3_REVISION_REGISTRY_TIMESTAMP_AND_CANONICAL_COMMENT_IDENTITY_COMPLETION_PROMPT_v1.0.0_2026-09-19.txt'
const root = process.cwd()
const [primaryFlag, primaryRoot, outputFlag, outputDirectory] = process.argv.slice(2)
assert.equal(primaryFlag, '--primary-reference-root')
assert.equal(outputFlag, '--output-directory')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const run = (command, args, cwd = root, environment = process.env) => execFileSync(command, args, { cwd, env: environment, encoding: ['git', 'node', 'npm'].includes(command) ? 'utf8' : undefined, maxBuffer: 256_000_000 })
const git = (...args) => String(run('git', args)).trim()
const primaryMetadata = () => ({ head: String(run('git', ['rev-parse', 'HEAD'], primaryRoot)).trim(), status: String(run('git', ['status', '--porcelain=v1', '--untracked-files=no'], primaryRoot)).trim() })
const primaryBefore = primaryMetadata()
assert.deepEqual(primaryBefore, { head: PRIMARY_HEAD, status: 'M AGENTS.md' })

const candidate = { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), parent: git('rev-parse', 'HEAD^') }
assert.equal(candidate.parent, BASE)
assert.equal(git('rev-parse', BASE + '^{tree}'), BASE_TREE)
assert.equal(git('rev-list', '--count', BASE + '..HEAD'), '1')
assert.equal(git('rev-list', '--merges', BASE + '..HEAD'), '')
assert.equal(git('diff', '--name-only', 'HEAD'), '')
assert.equal(git('rev-parse', 'HEAD:AGENTS.md'), git('rev-parse', BASE + ':AGENTS.md'))
const changed = git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean)
const exactAllowed = new Set([
  'package.json',
  'tests/e2e/s7-r3-runtime.spec.ts',
  'tests/unit/s7-r3-r2-review-integrity.test.mjs',
  'tests/unit/s7-r3-r3-review-registry.test.mjs',
])
const allowed = (file) => exactAllowed.has(file) || file.startsWith('scripts/nq5-s7-r3/') || file.startsWith('artifacts/g6p-s7-r3-r3/') || file.startsWith('artifacts/principal-review/')
assert.ok(changed.length > 0 && changed.every(allowed))
assert.equal(changed.filter((file) => file.startsWith('src/')).length, 0)
for (const protectedPath of ['AGENTS.md', 'content/parallel/narrative', 'docs/parallel/lane-a', 'docs/parallel/lane-c', 'public/scenarios/euler-2023-false-exit', 'src', 'tests/unit/parallel/narrative-contract', 'tests/unit/s4-r1-remediation.test.ts']) assert.equal(git('diff', '--name-only', BASE, 'HEAD', '--', protectedPath), '')
assert.equal(sha(fs.readFileSync(CONTROLLER)), '8873957c54a04e9049d643a1c272b06614110e6a93ea32c516b304ad7823249a')

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 's7-r3-r3-delivery-'))
const payload = path.join(temporary, 'payload')
const recovery = path.join(temporary, 'recovery')
const bundlePath = path.join(temporary, 's7-r3-r3-incremental.bundle')
const authorityArchiveDirectory = path.dirname(root)
const authorityArchives = fs.readdirSync(authorityArchiveDirectory).filter((name) => name.endsWith('.zip') && fs.statSync(path.join(authorityArchiveDirectory, name)).isFile()).sort()
assert.ok(authorityArchives.length >= 8)
for (const name of authorityArchives) fs.symlinkSync(fs.realpathSync(path.join(authorityArchiveDirectory, name)), path.join(temporary, name))
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
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : entry.isFile() ? [path.join(directory, entry.name)] : [])
  for (const file of walk(source).sort()) put(prefix + '/' + path.relative(source, file).split(path.sep).join('/'), fs.readFileSync(file))
}

run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundlePath, 'HEAD', '^' + BASE])
const bundle = fs.readFileSync(bundlePath)
const sourceDiff = execFileSync('git', ['diff', '--binary', BASE, 'HEAD'], { cwd: root, maxBuffer: 256_000_000 })
put('GIT/trace-escape-s7-r3-r3-incremental.bundle', bundle)
put('SOURCE_DIFF.patch', sourceDiff)
put('INPUTS/CONTROLLER_PROMPT.txt', fs.readFileSync(CONTROLLER))
const leadNotes = `Exact candidate commit: ${candidate.commit}\nExact candidate tree: ${candidate.tree}\nExact candidate parent: ${candidate.parent}\n\n${fs.readFileSync('artifacts/g6p-s7-r3-r3/LEAD_NOTES.md', 'utf8')}`
put('LEAD_NOTES.md', leadNotes)
addTree('artifacts/g6p-s7-r3-r3/REPORTS', 'REPORTS')
addTree('artifacts/g6p-s7-r3-r3/LOGS', 'LOGS')
addTree('artifacts/principal-review', 'PRINCIPAL_REVIEW_WORKBENCH')
put('EVIDENCE/CHANGED_PATHS.json', { schemaVersion: '1.0.0', status: 'PASS', base: BASE, candidate, linearCommits: [candidate.commit], merges: 0, productionPaths: [], paths: changed.map((file) => ({ file, sha256: sha(execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, maxBuffer: 256_000_000 })) })) })
const currentValidation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r3-r3/REPORTS/CURRENT_INTEGRATED_VALIDATION.json', 'utf8'))
const historicalValidation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r3-r3/REPORTS/EXACT_V1_1_HISTORICAL_VALIDATION.json', 'utf8'))
const ownership = JSON.parse(fs.readFileSync('artifacts/principal-review/ANCHOR_CLASSIFICATION_VALIDATION.json', 'utf8'))
const registry = JSON.parse(fs.readFileSync('artifacts/principal-review/ACCEPTED_REVISION_REGISTRY_REPORT.json', 'utf8'))
assert.equal(currentValidation.status, 'PASS')
assert.equal(historicalValidation.status, 'PASS')
assert.equal(ownership.status, 'PASS')
assert.equal(ownership.classifications, 235)
assert.equal(registry.status, 'PASS')
assert.equal(registry.registryDigest, REGISTRY_DIGEST)
const manifest = {
  schemaVersion: '1.0.0', status: 'DELIVERED_PENDING_MAIN_LEAD_REVIEW', candidate,
  reviewedBase: BASE, reviewedTree: BASE_TREE, incrementalPrerequisite: BASE,
  changedPaths: changed.length, productionPathsChanged: 0,
  currentIntegrated: { files: 69, tests: 2425, status: 'PASS' },
  acceptedCarryForward: { files: 68, tests: 2387, status: 'PASS' },
  historicalV11: { laneTests: 25, s4Tests: 3, status: 'PASS' },
  focusedUnitTests: 52, currentBrowserChecks: 9, preservedBrowserChecks: 11, acquisitionTests: 107,
  reviewAnchors: 235, workbenchFiles: 31, acceptedRevisionRegistryEntries: 4, registryDigest: REGISTRY_DIGEST,
  providerRequests: 0, credentialAccess: false, productionPixelAccess: false, sourcePromoted: false,
  productionArtApproved: false, publicTitleBound: false, contentLock: false, release: false, mission02: false,
  bundleSha256: sha(bundle), sourceDiffSha256: sha(sourceDiff),
}
put('DELIVERY_MANIFEST.json', manifest)
put('00_READ_ME_FIRST.md', `S7-R3-R3 ${manifest.status}. This offline delivery recovers one exact linear child of prerequisite ${BASE}. Run node VERIFY_DELIVERY.mjs after safe extraction. Current validation is 69/69 files and 2425/2425 tests; exact historical validation is 25/25 unchanged Lane checks plus 3/3 unchanged S4 checks. The accepted revision registry digest is ${REGISTRY_DIGEST}. No production source or accepted content changed.\n`)

const seal = () => {
  const names = [...members.keys(), 'VERIFY_DELIVERY.mjs', 'MANIFEST.sha256'].sort()
  const pins = Object.fromEntries([...members].map(([name, bytes]) => [name, sha(bytes)]))
  const verifier = `import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';const root=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),names=${JSON.stringify(names)},pins=${JSON.stringify(pins)},expected=${JSON.stringify(manifest)};const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name),s=fs.lstatSync(p);if(s.isSymbolicLink()||(!s.isDirectory()&&(!s.isFile()||s.nlink!==1)))throw Error('NONREGULAR');return s.isDirectory()?walk(p):[path.relative(root,p).split(path.sep).join('/')]});if(JSON.stringify(walk(root).sort())!==JSON.stringify(names))throw Error('EXACT_MEMBERS');for(const[n,h]of Object.entries(pins))if(sha(fs.readFileSync(path.join(root,n)))!==h)throw Error('PIN:'+n);if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'DELIVERY_MANIFEST.json'),'utf8')))!==JSON.stringify(expected))throw Error('MANIFEST');const seen=new Set;for(const line of fs.readFileSync(path.join(root,'MANIFEST.sha256'),'utf8').trim().split('\\n')){const h=line.slice(0,64),n=line.slice(66);if(seen.has(n)||sha(fs.readFileSync(path.join(root,n)))!==h)throw Error('HASH:'+n);seen.add(n)}if(seen.size!==names.length-1)throw Error('HASH_COUNT');console.log(JSON.stringify({status:'PASS',members:names.length,candidate:expected.candidate,terminalStatus:expected.status}));\n`
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
run('npm', ['test', '--silent'], recovery, environment)
run('npm', ['run', 'test:historical-v1.1', '--silent'], recovery, environment)
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
console.log(JSON.stringify({ status: manifest.status, archive: destination, sha256: sha(fs.readFileSync(destination)), bytes: fs.statSync(destination).size, members: names.length, candidate, freshRecovery: true, currentAndHistoricalCommandsPassed: true, deterministicZip: true, primaryPreserved: true }, null, 2))
