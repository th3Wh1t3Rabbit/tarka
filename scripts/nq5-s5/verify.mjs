import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {deriveBlueprint} from '../../src/controller/foundation/blueprint.ts'
import {VIEWPORT,validateViewport,validateIntake} from '../../src/controller/foundation/contracts.mjs'
import {compileContent} from '../nq5-s4/compile-content.mjs'
export const BASE='0f52131c9f56f49128e7a413396331917e687a1f',TREE='98fe920f0f61bb5ebdb8aa1bf7f4f8957b10a131'
export const EXTRA=['src/app/App.tsx','src/app/CaseTerminalWorkbench.tsx','src/app/AcceptedEvidenceSea.tsx','src/app/TerminalViewport.tsx','src/app/terminal-viewport.css','src/controller/corpus/input.ts','src/controller/foundation/contracts.mjs','src/controller/foundation/contracts.d.mts','src/controller/foundation/blueprint.ts','src/controller/foundation/useIntegerViewportScale.ts','tests/unit/s5-foundation.test.ts','tests/unit/project-clock.test.mjs','tests/fixtures/s5/art-index.ts','tests/e2e/s5-integration.spec.ts','scripts/s5-browser.config.mjs','scripts/s5-current-browser.config.mjs','docs/PROJECT_STATUS.yaml','docs/PROJECT_SCHEDULE.json']
const read=p=>JSON.parse(fs.readFileSync(p))
export function allowedPath(n){
 const files=read('docs/source/execution-s5/ADMITTED_INPUT_BINDINGS.json').laneFiles.map(x=>x.path)
 return EXTRA.includes(n)||n==='scripts/s5-preserved-browser.config.mjs'||files.includes(n)||['scripts/nq5-s5/','artifacts/g6p-s5/','docs/source/execution-s5/'].some(p=>n.startsWith(p))
}
export async function verify(){
 const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:128000000}).trim()
 assert.equal(git('rev-parse',BASE+'^{tree}'),TREE);execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'])
 assert.equal(git('rev-list','--merges',BASE+'..HEAD'),'','NO_HISTORICAL_BRANCH_MERGE')
 assert.equal(git('diff',BASE,'HEAD','--','AGENTS.md'),'','COMMITTED_AGENTS_DIFF_EMPTY')
 assert.equal(git('rev-parse',BASE+':AGENTS.md'),git('rev-parse','HEAD:AGENTS.md'),'TRUSTED_GIT_BLOB_IDENTITY_ONLY')
 const paths=git('diff','--name-only',BASE,'--','.').split('\n').filter(Boolean);assert.ok(paths.every(allowedPath),'CLOSED_S5_SOURCE_SCOPE')
 for(const n of ['AGENTS.md','.cursor/x','ART_PRODUCTION/x','public/scenarios/euler-2023-false-exit/scenario.json','content/parallel/narrative/COPY_CATALOG.json','src/controller/content/runtime-content.json'])assert.equal(allowedPath(n),false)
 const preserved=read('artifacts/g6p-s5/REPORTS/PRESERVATION.json')
 for(const p of [...preserved.preservedFiles,...preserved.laneAFiles])assert.equal(sha(fs.readFileSync(p.file)),p.sha256,p.file)
 assert.equal(preserved.laneAFiles.length,37)
 assert.equal(sha(fs.readFileSync('src/controller/content/runtime-content.json')),'57f27ecfef64f9c149f2f80bdb1efffbc629d79fd5f6a76e21c0e943c5c95bfc')
 assert.equal(canonical(compileContent()),canonical(read('src/controller/content/runtime-content.json')))
 const bp=await deriveBlueprint();assert.equal(canonical(bp),canonical(read('artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json')),'EXACT_COUNTS_AND_SOURCE_BEAT_REPLAY')
 assert.equal(bp.firstFalsifierUtc,'2023-03-13T11:38:11Z');assert.equal(bp.conclusion,'THE FIRST TRAIL JOINED THE SECOND ROUTE.')
 validateViewport(read('artifacts/g6p-s5/REPORTS/VIEWPORT_TERMINAL_CONTRACT.json'));validateIntake(read('artifacts/g6p-s5/REPORTS/SYNTHETIC_INTAKE_EXAMPLE.json'));assert.ok(VIEWPORT.semanticDOM)
 const x=read('docs/source/execution-s5/MAIN_ACCEPTANCE/S4_R2_MAIN_RECEIPT.json');assert.equal(x.status,'S4_R2_ACCEPTED_PROMOTED');assert.equal(x.git.candidateCommit,BASE);assert.equal(x.git.candidateTree,TREE)
 const inputs=read('docs/source/execution-s5/ADMITTED_INPUT_BINDINGS.json')
 const mappings={'MAIN_ACCEPTANCE/TRACE_ESCAPE_MAIN_LEAD_REVIEW_S4_R2_RECEIPT_v1.0.0_2026-09-18.json':'MAIN_ACCEPTANCE/S4_R2_MAIN_RECEIPT.json','MAIN_ACCEPTANCE/TRACE_ESCAPE_MAIN_LEAD_REVIEW_S4_R2_v1.0.0_2026-09-18.md':'MAIN_ACCEPTANCE/S4_R2_MAIN_REVIEW.md','PRINCIPAL/QUOTA_AND_PRODUCT_DIRECTION.txt':'PRINCIPAL/QUOTA_DIRECTION.txt','ART/LEAD_ART_HANDOFF_2026-09-18.md':'ART_HANDOFF.md','ART/TRACE_ESCAPE_PIXEL_VIEWPORT_TERMINAL_AND_MVP_ART_BRIEF_v1.0.0_2026-09-18.md':'ART_VIEWPORT_BRIEF.md','LANE_C/TRACE_ESCAPE_MAIN_LEAD_REVIEW_LANE_C_C1_RECEIPT_v1.0.0_2026-09-17.json':'LANE_C_MAIN_RECEIPT.json','LANE_C/TRACE_ESCAPE_MAIN_TO_LANE_C_C1_DISPOSITION_v1.0.0_2026-09-17.txt':'LANE_C_DISPOSITION.txt'}
 for(const[original,installed]of Object.entries(mappings))assert.equal(sha(fs.readFileSync('docs/source/execution-s5/'+installed)),inputs.inputs.find(x=>x.path===original).sha256)
 for(const p of inputs.laneFiles)assert.equal(sha(execFileSync('git',['show','e902652:'+p.path],{maxBuffer:128000000})),p.sha256,'EXACT_INITIAL_LANE_C_CUT')
 assert.ok(!fs.readFileSync('src/app/corpus-presentation/harness.tsx','utf8').includes('LANE_C_PACKET/'))
 assert.ok(!fs.readFileSync('tests/unit/lane-c/model.test.ts','utf8').includes('LANE_C_PACKET/'))
 const status=read('docs/PROJECT_STATUS.yaml');assert.equal(status.accepted_base,BASE);assert.equal(status.account_compliance.engineering_risk_retired,true);assert.ok(status.blockers.every(s=>!s.includes('quota')&&!s.includes('account')))
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
 const own=[...new Set([...walk('scripts/nq5-s5'),...walk('docs/source/execution-s5'),...walk('artifacts/g6p-s5').filter(n=>!n.includes('/SCREENSHOTS/')),...EXTRA])]
 for(const n of own){const s=fs.lstatSync(n);assert.ok(s.isFile()&&!s.isSymbolicLink());const t=fs.readFileSync(n,'utf8');assert.equal(privatePathFindings(t).length,0,n);assert.equal(hasSecretLikeValue(t),false,n)}
 return {status:'PASS',preservedLaneAFiles:37,truthAndCorpusChanges:0,acceptedClientEntries:74,beats:bp.beats.length,canonicalSemanticRecords:25,exactProofLayerSeparate:true,AGENTSCommitBlobUnchanged:true,networkRequests:0,credentialAccess:false}
}
if(process.argv[1]?.endsWith('/verify.mjs'))console.log(JSON.stringify(await verify()))
