import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const BASE = 'e1e586a700a6b30ed9125d2d52d76e9e2e9c4c0b'
const BASE_TREE = 'f69d71efc8104b6dfaa0301bcef5b1cc98b428a4'
const PRIMARY_HEAD = '0f52131c9f56f49128e7a413396331917e687a1f'
const NAME = 'TRACE_ESCAPE_G6P_NQ5_T1_S7_R3_R2_CURRENT_VALIDATION_AND_PRINCIPAL_REVIEW_INTEGRITY_COMPLETION_DELIVERY_v1.0.0.zip'
const CONTROLLER = '/path/to/local-user/Downloads/TRACE_ESCAPE_MAIN_TO_CODEX_G6P_NQ5_T1_S7_R3_R2_CURRENT_VALIDATION_AND_PRINCIPAL_REVIEW_INTEGRITY_COMPLETION_PROMPT_v1.0.0_2026-09-19.txt'
const root = process.cwd()
const [primaryFlag, primaryRoot, outputFlag, outputDirectory] = process.argv.slice(2)
assert.equal(primaryFlag, '--primary-reference-root')
assert.equal(outputFlag, '--output-directory')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const run = (command, args, cwd = root, environment = process.env) => execFileSync(command, args, { cwd, env: environment, encoding: command === 'git' || command === 'node' || command === 'npm' ? 'utf8' : undefined, maxBuffer: 256_000_000 })
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
const exactAllowed = new Set(['package.json', 'tests/e2e/s7-r3-runtime.spec.ts', 'tests/unit/s7-r3-r2-review-integrity.test.mjs'])
const allowed = (file) => exactAllowed.has(file) || file.startsWith('scripts/nq5-s7-r3/') || file.startsWith('artifacts/g6p-s7-r3-r2/') || file.startsWith('artifacts/principal-review/')
assert.ok(changed.length > 0 && changed.every(allowed))
assert.equal(changed.filter((file) => file.startsWith('src/')).length, 0)
for (const protectedPath of ['AGENTS.md','content/parallel/narrative','docs/parallel/lane-a','docs/parallel/lane-c','public/scenarios/euler-2023-false-exit','src','tests/unit/parallel/narrative-contract','tests/unit/s4-r1-remediation.test.ts']) assert.equal(git('diff', '--name-only', BASE, 'HEAD', '--', protectedPath), '')
assert.equal(sha(fs.readFileSync(CONTROLLER)), 'b28914e6a5f286edb08f17594ebc7b277421f712f8cb24e2f2d6b557de3f50df')
const v12 = {
  'content/parallel/narrative/S7_R2B_CLAIM_BOUNDARY_AUDIT.json':'8cc73e4f2a9eb73c48307a49cd155794843590a3bff65cfbf0661b5f51ed1fe6',
  'content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json':'24fbc0221056f7aaf8aa64862b97ed7c6a1e24f82d7230866b49189d41611953',
  'content/parallel/narrative/S7_R2B_INTERACTION_MATRIX.json':'877f500e51d53218c7af2b855934c37a8af76a6fe752844aff500e4d46908a8d',
  'content/parallel/narrative/S7_R2B_LINE_LENGTH_REPORT.json':'a88870fbb5c985a0d44e41919f191b0473938c0a88d78a6f00410475ad07c4a6',
  'content/parallel/narrative/S7_R2B_RUNTIME_SELECTION_MAP.json':'664e774b787b83aa9dc196d7be5bbc28977e376c7acf7fc95407df43f32ce1c4',
  'content/parallel/narrative/S7_R2B_SEMANTIC_INTENTS.json':'e8eb03344e8e23cea6e3d1bc27c8fba84ab9df0bcd6380a4c4eafcfcef63d5aa',
  'content/parallel/narrative/S7_R2B_SOURCE_LINE_LEDGER.json':'73c711c0826f35afd9981ab8b6388d11132a0fa8d725bac5c4c1007d80e41809',
  'docs/parallel/lane-a/TE_IFACE_CONTENT_v1.2.0.json':'afcec0c5b761e282e65c02a355d7e6e61625c4ace01cdc5a52324ed910ef8d0a',
}
for (const [file, expected] of Object.entries(v12)) assert.equal(sha(fs.readFileSync(file)), expected)

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 's7-r3-r2-delivery-'))
const payload = path.join(temporary, 'payload')
const recovery = path.join(temporary, 'recovery')
const bundlePath = path.join(temporary, 's7-r3-r2-incremental.bundle')
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
put('GIT/trace-escape-s7-r3-r2-incremental.bundle', bundle)
put('SOURCE_DIFF.patch', sourceDiff)
put('INPUTS/CONTROLLER_PROMPT.txt', fs.readFileSync(CONTROLLER))
put('LEAD_NOTES.md', fs.readFileSync('artifacts/g6p-s7-r3-r2/LEAD_NOTES.md'))
addTree('artifacts/g6p-s7-r3-r2/REPORTS', 'REPORTS')
addTree('artifacts/g6p-s7-r3-r2/LOGS', 'LOGS')
addTree('artifacts/principal-review', 'PRINCIPAL_REVIEW_WORKBENCH')
put('EVIDENCE/CHANGED_PATHS.json', { schemaVersion:'1.0.0',status:'PASS',base:BASE,candidate,linearCommits:[candidate.commit],merges:0,productionPaths:[],paths:changed.map((file)=>({file,sha256:sha(execFileSync('git',['show','HEAD:'+file],{cwd:root,maxBuffer:256_000_000}))})) })
const currentValidation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r3-r2/REPORTS/CURRENT_INTEGRATED_VALIDATION.json','utf8'))
const historicalValidation = JSON.parse(fs.readFileSync('artifacts/g6p-s7-r3-r2/REPORTS/EXACT_V1_1_HISTORICAL_VALIDATION.json','utf8'))
const ownership = JSON.parse(fs.readFileSync('artifacts/principal-review/ANCHOR_CLASSIFICATION_VALIDATION.json','utf8'))
assert.equal(currentValidation.status,'PASS');assert.equal(historicalValidation.status,'PASS');assert.equal(ownership.status,'PASS');assert.equal(ownership.classifications,235)
const manifest = { schemaVersion:'1.0.0',status:'DELIVERED_PENDING_MAIN_LEAD_REVIEW',candidate,reviewedBase:BASE,reviewedTree:BASE_TREE,incrementalPrerequisite:BASE,changedPaths:changed.length,productionPathsChanged:0,currentIntegrated:{files:68,tests:2387,status:'PASS'},historicalV11:{laneTests:25,s4Tests:3,status:'PASS'},focusedUnitTests:52,acquisitionTests:107,browserChecks:17,reviewAnchors:235,workbenchFiles:23,providerRequests:0,credentialAccess:false,productionPixelAccess:false,sourcePromoted:false,productionArtApproved:false,publicTitleBound:false,contentLock:false,release:false,mission02:false,bundleSha256:sha(bundle),sourceDiffSha256:sha(sourceDiff) }
put('DELIVERY_MANIFEST.json',manifest)
put('00_READ_ME_FIRST.md',`S7-R3-R2 ${manifest.status}. This offline delivery recovers one exact linear child of prerequisite ${BASE}. Run node VERIFY_DELIVERY.mjs after safe extraction. The ordinary current suite is green at 68/68 files and 2387/2387 tests. A mandatory isolated historical command reconstructs exact v1.1 authority and passes 25/25 unchanged Lane checks plus 3/3 unchanged S4 checks. All 235 anchors have explicit ACT/GLOBAL ownership. Review-book import is closed-shape and atomic; prior revisions compare per item as SAME, CHANGED, MISSING, or NEW, with no migration without explicit selection. No production source, accepted v1.1/v1.2 authority, provider, credential, private configuration, production Pixel, game state, title, content lock, release, or Mission 02 authority changed.\n`)

const seal = () => {
  const names = [...members.keys(), 'VERIFY_DELIVERY.mjs', 'MANIFEST.sha256'].sort()
  const pins = Object.fromEntries([...members].map(([name, bytes]) => [name, sha(bytes)]))
  const verifier = `import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';const root=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),names=${JSON.stringify(names)},pins=${JSON.stringify(pins)},expected=${JSON.stringify(manifest)};const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name),s=fs.lstatSync(p);if(s.isSymbolicLink()||(!s.isDirectory()&&(!s.isFile()||s.nlink!==1)))throw Error('NONREGULAR');return s.isDirectory()?walk(p):[path.relative(root,p).split(path.sep).join('/')]});if(JSON.stringify(walk(root).sort())!==JSON.stringify(names))throw Error('EXACT_MEMBERS');for(const[n,h]of Object.entries(pins))if(sha(fs.readFileSync(path.join(root,n)))!==h)throw Error('PIN:'+n);if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'DELIVERY_MANIFEST.json'),'utf8')))!==JSON.stringify(expected))throw Error('MANIFEST');const seen=new Set;for(const line of fs.readFileSync(path.join(root,'MANIFEST.sha256'),'utf8').trim().split('\\n')){const h=line.slice(0,64),n=line.slice(66);if(seen.has(n)||sha(fs.readFileSync(path.join(root,n)))!==h)throw Error('HASH:'+n);seen.add(n)}if(seen.size!==names.length-1)throw Error('HASH_COUNT');console.log(JSON.stringify({status:'PASS',members:names.length,candidate:expected.candidate,terminalStatus:expected.status}));\n`
  put('VERIFY_DELIVERY.mjs', verifier)
  put('MANIFEST.sha256', [...members].sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>sha(bytes)+'  '+name).join('\n')+'\n')
  return names
}
const names = seal()
run('node',['VERIFY_DELIVERY.mjs'],payload)

fs.mkdirSync(recovery)
run('git',['init','--quiet'],recovery)
fs.mkdirSync(path.join(recovery,'.git/objects/info'),{recursive:true})
fs.writeFileSync(path.join(recovery,'.git/objects/info/alternates'),git('rev-parse','--path-format=absolute','--git-path','objects')+'\n')
run('git',['bundle','verify',bundlePath],recovery)
run('git',['fetch','--quiet',bundlePath,'HEAD:refs/heads/candidate'],recovery)
run('git',['checkout','--quiet','candidate'],recovery)
assert.equal(String(run('git',['rev-parse','HEAD'],recovery)).trim(),candidate.commit)
run('git',['fsck','--full','--strict'],recovery)
assert.ok(sourceDiff.equals(execFileSync('git',['diff','--binary',BASE,'HEAD'],{cwd:recovery,maxBuffer:256_000_000})))
fs.symlinkSync(path.join(root,'node_modules'),path.join(recovery,'node_modules'),'dir')
const environment={...process.env,PATH:path.join(root,'node_modules/.bin')+path.delimiter+process.env.PATH,CI:'1',NO_COLOR:'1'}
run('npm',['run','typecheck','--silent'],recovery,environment)
run('npm',['test','--silent'],recovery,environment)
run('npm',['run','test:historical-v1.1','--silent'],recovery,environment)
run('node',['scripts/nq5-s7-r3/verify-workbench-determinism.mjs'],recovery,environment)
for(const name of names)fs.utimesSync(path.join(payload,name),new Date('2000-01-01T00:00:00Z'),new Date('2000-01-01T00:00:00Z'))
const firstZip=path.join(temporary,'first.zip'),secondZip=path.join(temporary,'second.zip')
run('zip',['-X','-q',firstZip,...names],payload);run('zip',['-X','-q',secondZip,...names],payload)
assert.equal(sha(fs.readFileSync(firstZip)),sha(fs.readFileSync(secondZip)))
assert.deepEqual(primaryMetadata(),primaryBefore);assert.equal(git('diff','--name-only','HEAD'),'')
fs.mkdirSync(outputDirectory,{recursive:true})
const destination=path.join(outputDirectory,NAME);fs.copyFileSync(firstZip,destination,fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({status:manifest.status,archive:destination,sha256:sha(fs.readFileSync(destination)),bytes:fs.statSync(destination).size,members:names.length,candidate,freshRecovery:true,currentAndHistoricalCommandsPassed:true,deterministicZip:true,primaryPreserved:true},null,2))
