import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const BASE = 'ff50ed46eededfc87493336f093f0eae172ea38d'
const TREE = '3820b861536cfc95a79146570fd6cac799632637'
const NAME = 'TRACE_ESCAPE_G6P_NQ5_T1_S7_R2A_INTERACTION_PERFORMANCE_SHELL_DELIVERY_v1.0.0.zip'
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
assert.equal(git('rev-parse', BASE + '^{tree}'), TREE)
assert.equal(git('rev-list', '--merges', BASE + '..HEAD'), '')
assert.equal(git('diff', '--name-only', 'HEAD'), '')
assert.equal(git('rev-parse', 'HEAD:AGENTS.md'), git('rev-parse', BASE + ':AGENTS.md'))

const exactPaths = new Set([
  'scripts/s7-r2a-browser.config.mjs',
  'src/adventure/content.ts', 'src/adventure/reducer.ts', 'src/adventure/scenes.ts', 'src/adventure/types.ts',
  'src/app/App.tsx', 'src/app/CaseTerminalWorkbench.tsx', 'src/controller/content/adapter.ts',
  'src/controller/content/lead-shell.ts', 'src/controller/interaction/spec.ts', 'src/controller/mission/performance.ts',
  'src/investigation/state.ts', 'src/styles/a0.css',
  'tests/e2e/s4-content.spec.ts', 'tests/e2e/s4-r2-surfaces.spec.ts', 'tests/e2e/s7-r2a-shell.spec.ts',
  'tests/fixtures/s2/browser-helpers.ts', 'tests/unit/g6p-a0.test.ts', 'tests/unit/g6p-a2u.test.ts',
  'tests/unit/s3-lane-b-contract.test.ts', 'tests/unit/s4-content.test.ts', 'tests/unit/s7-r1-mission-choreography.test.ts',
  'tests/unit/s7-r2a-interaction-performance.test.ts',
])
const allowed = (file) => exactPaths.has(file) || file.startsWith('scripts/nq5-s7-r2a/') || file.startsWith('docs/source/execution-s7-r2a/') || file.startsWith('artifacts/g6p-s7-r2a/')
const changed = git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean)
assert.ok(changed.length > 0 && changed.every(allowed))
for (const protectedPath of ['content/parallel/narrative', 'docs/parallel/lane-a', 'tests/unit/parallel/narrative-contract', 'docs/parallel/lane-c', 'public/scenarios/euler-2023-false-exit', 'src/controller/content/runtime-content.json', 'artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json']) assert.equal(git('diff', '--name-only', BASE, 'HEAD', '--', protectedPath), '')

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 's7-r2a-delivery-'))
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

const bundlePath = path.join(temporary, 's7-r2a-incremental.bundle')
run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundlePath, 'HEAD', '^' + BASE])
const bundle = fs.readFileSync(bundlePath)
const sourceDiff = execFileSync('git', ['diff', '--binary', BASE, 'HEAD'], { cwd: root, maxBuffer: 128_000_000 })
put('GIT/trace-escape-s7-r2a-incremental.bundle', bundle)
put('SOURCE_DIFF.patch', sourceDiff)
put('EVIDENCE/CHANGED_PATHS.json', { schemaVersion: '1.0.0', status: 'PASS', base: BASE, candidate, linearCommits: [candidate.commit], merges: 0, paths: changed.map((file) => ({ file, sha256: sha(execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, maxBuffer: 128_000_000 })) })), productionPaths: changed.filter((file) => file.startsWith('src/')) })
addTree('artifacts/g6p-s7-r2a/REPORTS', 'REPORTS')
addTree('artifacts/g6p-s7-r2a/LOGS', 'LOGS')
addTree('docs/source/execution-s7-r2a', 'SOURCE_INPUT')

const validation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r2a/REPORTS/VALIDATION_SUMMARY.json', 'utf8'))
const preservation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r2a/REPORTS/PRESERVATION_AND_NO_EFFECTS.json', 'utf8'))
assert.equal(validation.status, 'PASS')
assert.equal(preservation.status, 'PASS')
const manifest = { schemaVersion: '1.0.0', status: 'DELIVERED_PENDING_MAIN_LEAD_REVIEW', candidate, reviewedBase: BASE, reviewedTree: TREE, incrementalPrerequisite: BASE, productionChanges: changed.filter((file) => file.startsWith('src/')).length, unitAcquisitionTests: validation.unitAcquisitionTests, uniqueBrowserChecks: validation.uniqueBrowserChecks, heroHotspots: 9, verbs: 9, cartesianInteractions: 81, requiredProgressionRules: 11, semanticViews: 25, boundedNoMatchViews: 7, exactFixtureRecords: 6, LaneAPASS: false, sourcePromoted: false, productionArtApproved: false, publicTitleBound: false, contentLock: false, externalRequests: 0, credentialAccess: false, pixelArchiveAccess: false, release: false, mission02: false, bundleSha256: sha(bundle), sourceDiffSha256: sha(sourceDiff) }
put('DELIVERY_MANIFEST.json', manifest)
put('00_READ_ME_FIRST.md', `S7-R2A ${manifest.status}. This lean offline delivery recovers one exact linear candidate from prerequisite ${BASE}. Run node VERIFY_DELIVERY.mjs after safe extraction. The bundle contains the closed 9×9 interaction contract, Lead-authored dialogue/performance shell, named hint milestones, terminal dependency evidence, all validation/stopped-attempt logs, and two disclosed same-agent self-reviews. The accepted Lane A implementation identity, frozen runtime-content map, recursive blueprint, Lane C material, and corpus remain unchanged. One compatibility note is explicit: CARD.INCIDENT preserves the accepted recursive-blueprint predicate set instead of silently adding an asset filter. One predeclaration-process variance is also disclosed for a public-label-only legacy browser assertion. Nothing here is independent MAIN acceptance, source promotion, production art approval, title/content lock, release, or Mission 02 authorization. The incremental Git bundle requires the stated base; the final ZIP SHA-256 is the external trust root.\n`)

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
const environment = { ...process.env, PATH: path.join(root, 'node_modules/.bin') + path.delimiter + process.env.PATH, NODE_OPTIONS: '--require ' + path.join(root, 'scripts/nq5-r2/hold.cjs'), CI: '1', NO_COLOR: '1' }
run('node', ['--loader', './scripts/nq5-s5/ts-loader.mjs', 'scripts/nq5-s7-r2a/generate.mjs', path.join(temporary, 'fresh-reports')], recovery, environment)
run('node', ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/s7-r2a-interaction-performance.test.ts', '--maxWorkers=1'], recovery, environment)

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
