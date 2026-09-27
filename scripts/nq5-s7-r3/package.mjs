import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const BASE = '6be0515e141e8ea8761f913c2c8cd59e8cd44033'
const BASE_TREE = '9abc03974a1ce1f8c2f4011891ad3dcb0c1ff518'
const NAME = 'TRACE_ESCAPE_G6P_NQ5_T1_S7_R3_EXACT_CONTENT_PERFORMANCE_AND_PRINCIPAL_REVIEW_WORKBENCH_DELIVERY_v1.0.0.zip'
const root = process.cwd()
const [primaryFlag, primaryRoot, outputFlag, outputDirectory] = process.argv.slice(2)
assert.equal(primaryFlag, '--primary-reference-root')
assert.equal(outputFlag, '--output-directory')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const run = (command, args, cwd = root, environment = process.env) => execFileSync(command, args, { cwd, env: environment, encoding: command === 'git' || command === 'node' ? 'utf8' : undefined, maxBuffer: 128_000_000 })
const git = (...args) => String(run('git', args)).trim()
const primaryMetadata = () => ({ head: String(run('git', ['rev-parse', 'HEAD'], primaryRoot)).trim(), status: String(run('git', ['status', '--porcelain=v1', '--untracked-files=no'], primaryRoot)).trim() })
const beforePrimary = primaryMetadata()
assert.deepEqual(beforePrimary, { head: '0f52131c9f56f49128e7a413396331917e687a1f', status: 'M AGENTS.md' })

const candidate = { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), parent: git('rev-parse', 'HEAD^') }
assert.equal(candidate.parent, BASE)
assert.equal(git('rev-parse', BASE + '^{tree}'), BASE_TREE)
assert.equal(git('rev-list', '--count', BASE + '..HEAD'), '1')
assert.equal(git('rev-list', '--merges', BASE + '..HEAD'), '')
assert.equal(git('diff', '--name-only', 'HEAD'), '')
assert.equal(git('rev-parse', 'HEAD:AGENTS.md'), git('rev-parse', BASE + ':AGENTS.md'))

const exactPaths = new Set([
  'package.json', 'scripts/s7-r3-browser.config.mjs',
  'src/adventure/content.ts', 'src/adventure/reducer.ts', 'src/adventure/types.ts',
  'src/app/App.tsx', 'src/app/CaseTerminalWorkbench.tsx', 'src/controller/content/adapter.ts',
  'src/controller/content/lead-shell.ts', 'src/controller/content/s7-r3.ts', 'src/controller/foundation/blueprint.ts',
  'src/controller/interaction/spec.ts', 'src/controller/mission/performance.ts', 'src/investigation/state.ts',
  'tests/e2e/s5-integration.spec.ts', 'tests/e2e/s7-r3-runtime.spec.ts',
  'tests/unit/g6p-a2u.test.ts', 'tests/unit/s4-content.test.ts', 'tests/unit/s7-r1-mission-choreography.test.ts',
  'tests/unit/s7-r2a-interaction-performance.test.ts', 'tests/unit/s7-r3-exact-content-performance.test.ts',
  'content/parallel/narrative/S7_R2B_CLAIM_BOUNDARY_AUDIT.json', 'content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json',
  'content/parallel/narrative/S7_R2B_INTERACTION_MATRIX.json', 'content/parallel/narrative/S7_R2B_LINE_LENGTH_REPORT.json',
  'content/parallel/narrative/S7_R2B_RUNTIME_SELECTION_MAP.json', 'content/parallel/narrative/S7_R2B_SEMANTIC_INTENTS.json',
  'content/parallel/narrative/S7_R2B_SOURCE_LINE_LEDGER.json', 'docs/parallel/lane-a/TE_IFACE_CONTENT_v1.2.0.json',
])
const allowed = (file) => exactPaths.has(file) || file.startsWith('scripts/nq5-s7-r3/') || file.startsWith('docs/source/execution-s7-r3/') || file.startsWith('artifacts/g6p-s7-r3/') || file.startsWith('artifacts/principal-review/')
const changed = git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean)
assert.ok(changed.length > 0 && changed.every(allowed))
for (const protectedPath of ['tests/unit/parallel/narrative-contract', 'docs/parallel/lane-c', 'public/scenarios/euler-2023-false-exit', 'src/controller/content/runtime-content.json', 'artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json']) assert.equal(git('diff', '--name-only', BASE, 'HEAD', '--', protectedPath), '')
for (const directory of ['content/parallel/narrative', 'docs/parallel/lane-a']) {
  const nonAdditions = git('diff', '--name-status', BASE, 'HEAD', '--', directory).split('\n').filter(Boolean).filter((line) => !line.startsWith('A\t'))
  assert.deepEqual(nonAdditions, [])
}

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

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 's7-r3-delivery-'))
const payload = path.join(temporary, 'payload')
const recovery = path.join(temporary, 'recovery')
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

const bundlePath = path.join(temporary, 's7-r3-incremental.bundle')
run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundlePath, 'HEAD', '^' + BASE])
const bundle = fs.readFileSync(bundlePath)
const sourceDiff = execFileSync('git', ['diff', '--binary', BASE, 'HEAD'], { cwd: root, maxBuffer: 128_000_000 })
put('GIT/trace-escape-s7-r3-incremental.bundle', bundle)
put('SOURCE_DIFF.patch', sourceDiff)
put('EVIDENCE/CHANGED_PATHS.json', { schemaVersion: '1.0.0', status: 'PASS', base: BASE, candidate, linearCommits: [candidate.commit], merges: 0, paths: changed.map((file) => ({ file, sha256: sha(execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, maxBuffer: 128_000_000 })) })), productionPaths: changed.filter((file) => file.startsWith('src/')) })
addTree('artifacts/g6p-s7-r3/REPORTS', 'REPORTS')
addTree('artifacts/g6p-s7-r3/LOGS', 'LOGS')
addTree('artifacts/g6p-s7-r3/INPUTS', 'INPUTS')
addTree('artifacts/principal-review', 'PRINCIPAL_REVIEW_WORKBENCH')
addTree('docs/source/execution-s7-r3', 'SOURCE_SCOPE')

const validation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r3/REPORTS/VALIDATION_SUMMARY.json', 'utf8'))
const preservation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r3/REPORTS/PRESERVATION_AND_NO_EFFECTS.json', 'utf8'))
assert.equal(validation.status, 'PASS')
assert.equal(preservation.status, 'PASS')
const manifest = { schemaVersion: '1.0.0', status: 'DELIVERED_PENDING_MAIN_LEAD_REVIEW', candidate, reviewedBase: BASE, reviewedTree: BASE_TREE, incrementalPrerequisite: BASE, productionChanges: changed.filter((file) => file.startsWith('src/')).length, currentDescendantUnitAndAcquisitionTests: 2371, focusedUnitTests: 18, uniqueBrowserChecks: 13, performanceBindings: 28, rendererRiskLines: 13, semanticViews: 25, boundedNoMatchViews: 7, LaneAPASS: false, sourcePromoted: false, productionArtApproved: false, publicTitleBound: false, contentLock: false, externalRequests: 0, credentialAccess: false, pixelArchiveAccess: false, release: false, mission02: false, bundleSha256: sha(bundle), sourceDiffSha256: sha(sourceDiff) }
put('DELIVERY_MANIFEST.json', manifest)
put('00_READ_ME_FIRST.md', `S7-R3 ${manifest.status}. This offline delivery recovers one exact linear child of prerequisite ${BASE}. Run node VERIFY_DELIVERY.mjs after safe extraction. It contains the exact v1.2 content files, runtime seam closure, 28-cue semantic performance layer, deterministic static Principal Review Workbench, local-only evidence-sea audit, validation logs, stopped-attempt record, scope-variance disclosure, and two same-agent self-reviews. Direct, Curious, and Mistaken journeys pass. The accepted v1.1 files, frozen corpus, accepted blueprint bytes, Lane C material, primary protected AGENTS.md, and production Pixel boundary remain unchanged. Two unchanged historical phase-only tests are explicitly not applicable to the integrated descendant; direct v1.1 validation and 2,371 current unit/acquisition tests pass. Nothing here is independent MAIN/Lead acceptance, source promotion, production art approval, public-title/content lock, release, or Mission 02 authorization. The incremental Git bundle requires the stated base; the final ZIP SHA-256 is the external trust root.\n`)
put('LEAD_HANDOFF.md', `# Lead handoff — S7-R3\n\nStatus: ${manifest.status}.\n\n## Review first\n\n1. Open PRINCIPAL_REVIEW_WORKBENCH/index.html through a static local server.\n2. Review REPORTS/SELF_REVIEW_IMPLEMENTATION_FIDELITY.json, REPORTS/SELF_REVIEW_BOUNDARY_ACCESSIBILITY.json, and REPORTS/SCOPE_VARIANCE.json.\n3. Use the Workbench comment book for stable anchored notes; export JSON or Markdown locally.\n4. Verify DELIVERY_MANIFEST.json and run node VERIFY_DELIVERY.mjs.\n\n## Decision summary\n\n- Exact S7-R2B content is integrated without creative rewriting.\n- All seven specified runtime seams are closed.\n- The Incident DAI card is distinct; legacy Incident remains unchanged.\n- Twenty-eight semantic performance cues cover all six required tracks; production art remains unbound.\n- Current local evidence is sufficient; zero new provider requests were issued.\n- Review-only concepts E-01 through E-04 are absent from the normal production build.\n- Direct, Curious, and Mistaken journeys pass, including explicit post-case return dialogue and focus restoration.\n\nCandidate commit: ${candidate.commit}\nCandidate tree: ${candidate.tree}\nDirect parent: ${candidate.parent}\n`)

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
assert.ok(sourceDiff.equals(execFileSync('git', ['diff', '--binary', BASE, 'HEAD'], { cwd: recovery, maxBuffer: 128_000_000 })))
fs.symlinkSync(path.join(root, 'node_modules'), path.join(recovery, 'node_modules'), 'dir')
const environment = { ...process.env, PATH: path.join(root, 'node_modules/.bin') + path.delimiter + process.env.PATH, CI: '1', NO_COLOR: '1' }
run('node', ['scripts/nq5-s7-r3/generate.mjs'], recovery, environment)
run('node', ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/s7-r3-exact-content-performance.test.ts', '--maxWorkers=1'], recovery, environment)
run('node', ['scripts/nq5-s7-r3/verify-workbench-determinism.mjs'], recovery, environment)

for (const name of names) fs.utimesSync(path.join(payload, name), new Date('2000-01-01T00:00:00Z'), new Date('2000-01-01T00:00:00Z'))
const firstZip = path.join(temporary, 'first.zip')
const secondZip = path.join(temporary, 'second.zip')
run('zip', ['-X', '-q', firstZip, ...names], payload)
run('zip', ['-X', '-q', secondZip, ...names], payload)
assert.equal(sha(fs.readFileSync(firstZip)), sha(fs.readFileSync(secondZip)))
assert.deepEqual(primaryMetadata(), beforePrimary)
assert.equal(git('diff', '--name-only', 'HEAD'), '')
fs.mkdirSync(outputDirectory, { recursive: true })
const destination = path.join(outputDirectory, NAME)
fs.copyFileSync(firstZip, destination, fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({ status: manifest.status, archive: destination, sha256: sha(fs.readFileSync(destination)), bytes: fs.statSync(destination).size, members: names.length, candidate, freshRecovery: true, deterministicZip: true, primaryPreserved: true }, null, 2))
