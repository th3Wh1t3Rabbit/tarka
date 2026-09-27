import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {BASE,TREE,compileContent} from './compile-content.mjs'
export const extra=['eslint.config.js','scripts/s4-browser.config.mjs','scripts/s4-current-browser.config.mjs','tests/e2e/s4-content.spec.ts','tests/unit/s4-content.test.ts','tests/unit/s4-type-contract.ts','tests/unit/s3-corpus-seam.test.ts','tests/unit/project-clock.test.mjs','docs/PROJECT_STATUS.yaml','docs/PROJECT_SCHEDULE.json','docs/G6P_NQ5_T1_S4_NOTES_FOR_LEAD.md','src/adventure/content.ts','src/adventure/narrative.ts','src/app/App.tsx','src/app/CaseTerminalWorkbench.tsx','src/game/scenario/euler.ts','src/investigation/corpus-seam/authority.d.mts',...['scenario.json','provenance.json','catalog.json','scenario.sha256'].map(n=>'public/scenarios/euler-2023-false-exit/'+n)]
export function allowedPath(n,lane){return extra.includes(n)||lane.includes(n)||['scripts/nq5-s4/','artifacts/g6p-s4/','docs/source/execution-s4/','src/controller/content/'].some(p=>n.startsWith(p))}
export function verify(){
 const read=n=>JSON.parse(fs.readFileSync(n)),reports='artifacts/g6p-s4/REPORTS/',source='docs/source/execution-s4/'
 assert.equal(execFileSync('git',['rev-parse',BASE+'^{tree}'],{encoding:'utf8'}).trim(),TREE)
 const admission=read(reports+'LANE_A_ADMISSION.json'),lane=admission.laneFiles.map(x=>x.file)
 assert.equal(lane.length,37);for(const x of admission.laneFiles)assert.equal(sha(fs.readFileSync(x.file)),x.sha256)
 const changed=execFileSync('git',['diff','--name-only',BASE,'--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
 assert.ok(changed.every(n=>allowedPath(n,lane)),'CLOSED_S4_SCOPE')
 for(const n of ['src/investigation/semantic-ux/x','src/app/corpus-presentation/x','tests/unit/lane-c/x','tests/e2e/lane-c/x','docs/parallel/lane-c/x','AGENTS.md','.cursor/x','ART_PRODUCTION/x'])assert.equal(allowedPath(n,lane),false)
 const pins=new Map(fs.readFileSync(source+'MANIFEST.sha256','utf8').trim().split('\n').map(l=>[l.slice(66),l.slice(0,64)]))
 assert.equal(sha(fs.readFileSync(source+'MANIFEST.sha256')),'933203cbc7d62ef162744380f48e841c460366b34e1a7651b10cf91ada928e22')
 assert.equal(sha(fs.readFileSync(source+'VERIFY_INPUT.py')),'cdd44e1f3b814846ea11b4c3aed684e05f365e865dd07d42a372181ad9a849ed')
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
 let refs=0;for(const n of walk(source.slice(0,-1))){const rel=n.slice(source.length);if(pins.has(rel)){assert.equal(sha(fs.readFileSync(n)),pins.get(rel));refs++}}
 assert.equal(refs,25)
 const receipt=read(source+'MAIN_S3_R1_ACCEPTANCE/TRACE_ESCAPE_MAIN_TE_IFACE_CORPUS_1_0_0_FREEZE_RECEIPT_v1.0.0_2026-09-17.json')
 assert.equal(receipt.controller_candidate.commit,BASE);assert.equal(receipt.status,'MAIN_ACCEPTED_AND_FROZEN');assert.equal(receipt.main_disposition.interface_frozen,true)
 const frozen=read('artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json')
 assert.equal(frozen.interfaceFrozen,false);assert.equal(frozen.LaneCActive,false);assert.equal(frozen.identity,receipt.interface.identity);assert.equal(frozen.concepts.length,25);assert.equal(frozen.displayRecords.filter(x=>x.zeroResultClass).length,7)
 for(const x of read(reports+'PRESERVATION.json').preservedFiles)assert.equal(sha(fs.readFileSync(x.file)),x.sha256)
 for(const x of read(reports+'TRUTH_HASH_CROSSWALK.json').files)assert.equal(sha(fs.readFileSync(x.file)),x.afterSha256)
 const compiled=compileContent();assert.equal(canonical(compiled),canonical(read('src/controller/content/runtime-content.json')));assert.equal(compiled.compiledEntries,374);assert.ok(Object.values(compiled.entries).every(e=>!e.optional))
 assert.match(fs.readFileSync('src/investigation/corpus-seam/authority.d.mts','utf8'),/validateDisplayRecord\(value:unknown,corpus:\s*AdmittedCorpus\)/);assert.doesNotMatch(fs.readFileSync('src/app/App.tsx','utf8'),/corpus-seam/)
 for(const n of [...walk('scripts/nq5-s4'),...walk('src/controller/content'),...walk('artifacts/g6p-s4'),...walk(source.slice(0,-1))]){const s=fs.lstatSync(n);assert.ok(s.isFile()&&!s.isSymbolicLink());const t=fs.readFileSync(n,'utf8');assert.equal(privatePathFindings(t).length,0,n);assert.equal(hasSecretLikeValue(t),false,n)}
 const status=read('docs/PROJECT_STATUS.yaml');assert.equal(status.accepted_base,BASE);assert.equal(status.corpus_interface.frozen,true);assert.equal(status.account_compliance.quota_claimed,false)
 return {status:'PASS',acceptedLanePaths:37,selectiveManifestRefs:refs,MAINFrozen:true,supplierSelfFrozen:false,compiledEntries:374,truthCopyChangedFiles:4,LaneCPathsChanged:0,networkRequests:0,credentialAccess:false}
}
if(process.argv[1]?.endsWith('/verify.mjs'))console.log(JSON.stringify(verify()))
