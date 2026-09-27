import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const PARENT = 'e1e586a700a6b30ed9125d2d52d76e9e2e9c4c0b'
const V11 = '6be0515e141e8ea8761f913c2c8cd59e8cd44033'
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 128_000_000 })
const identity = JSON.parse(execFileSync('node', ['content/parallel/narrative/implementation-digest.mjs'], { cwd: root, encoding: 'utf8' }))
const v11Paths = [
  ...String(git('ls-tree', '-r', '--name-only', V11, '--', 'content/parallel/narrative', 'tests/unit/parallel/narrative-contract')).trim().split('\n').filter(Boolean),
  'docs/parallel/lane-a/01_REPOSITORY_COPY_INVENTORY.md',
  'docs/parallel/lane-a/NARRATIVE_AND_MISSION_CONTENT_BIBLE.md',
  'docs/parallel/lane-a/TE_IFACE_CONTENT_v1.1.0.json',
].sort()
for (const file of v11Paths) assert.equal(sha(fs.readFileSync(file)), sha(git('show', `${V11}:${file}`)), `V1_1_DRIFT:${file}`)
const v12 = {
  'content/parallel/narrative/S7_R2B_CLAIM_BOUNDARY_AUDIT.json': '8cc73e4f2a9eb73c48307a49cd155794843590a3bff65cfbf0661b5f51ed1fe6',
  'content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json': '24fbc0221056f7aaf8aa64862b97ed7c6a1e24f82d7230866b49189d41611953',
  'content/parallel/narrative/S7_R2B_INTERACTION_MATRIX.json': '877f500e51d53218c7af2b855934c37a8af76a6fe752844aff500e4d46908a8d',
  'content/parallel/narrative/S7_R2B_LINE_LENGTH_REPORT.json': 'a88870fbb5c985a0d44e41919f191b0473938c0a88d78a6f00410475ad07c4a6',
  'content/parallel/narrative/S7_R2B_RUNTIME_SELECTION_MAP.json': '664e774b787b83aa9dc196d7be5bbc28977e376c7acf7fc95407df43f32ce1c4',
  'content/parallel/narrative/S7_R2B_SEMANTIC_INTENTS.json': 'e8eb03344e8e23cea6e3d1bc27c8fba84ab9df0bcd6380a4c4eafcfcef63d5aa',
  'content/parallel/narrative/S7_R2B_SOURCE_LINE_LEDGER.json': '73c711c0826f35afd9981ab8b6388d11132a0fa8d725bac5c4c1007d80e41809',
  'docs/parallel/lane-a/TE_IFACE_CONTENT_v1.2.0.json': 'afcec0c5b761e282e65c02a355d7e6e61625c4ace01cdc5a52324ed910ef8d0a',
}
for (const [file, expected] of Object.entries(v12)) assert.equal(sha(fs.readFileSync(file)), expected, `V1_2_DRIFT:${file}`)
const acceptedRuntimePaths = ['src/adventure/reducer.ts','src/adventure/types.ts','src/app/App.tsx','src/app/GameDialoguePresentation.tsx','src/controller/content/s7-r3.ts','src/controller/mission/performance.ts','src/styles/a0.css']
for (const file of acceptedRuntimePaths) assert.equal(sha(fs.readFileSync(file)), sha(git('show', `${PARENT}:${file}`)), `R1_RUNTIME_DRIFT:${file}`)
const report = { schemaVersion:'1.0.0',status:'PASS',v11:{historicalImplementationIdentity:'84a081161b8b3e147021ad497af0862eaf3d7fe80b92f79de8ebe57e7711b46b',currentRecursiveIdentityWithAdditiveV12:identity.sha256,exactPreservedFiles:v11Paths.length},v12:{exactPreservedFiles:Object.entries(v12).map(([file,sha256])=>({file,sha256}))},acceptedR1Runtime:{parent:PARENT,exactPreservedPaths:acceptedRuntimePaths},productionContentChanged:false }
const [reportFlag, reportPath] = process.argv.slice(2)
if (reportFlag !== undefined) assert.equal(reportFlag, '--report')
if (reportPath) { fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive:true }); fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report,null,2)+'\n') }
console.log(JSON.stringify(report,null,2))
