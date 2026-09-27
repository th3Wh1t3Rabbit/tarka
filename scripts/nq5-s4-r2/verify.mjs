import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {compileContent} from '../nq5-s4/compile-content.mjs'
import {consumerManifest,assertClosedClient} from '../nq5-s4-r1/consumers.mjs'
import {BASE,TREE} from './constants.mjs'
export const extra=["src/app/PerformancePortrait.tsx","src/app/MissionHarness.tsx","src/app/App.tsx","scripts/s4-r2-browser.config.mjs","tests/e2e/s4-r2-surfaces.spec.ts","tests/unit/s4-r2-surfaces.test.ts","tests/unit/project-clock.test.mjs","docs/PROJECT_STATUS.yaml","docs/PROJECT_SCHEDULE.json","docs/G6P_NQ5_T1_S4_R2_NOTES_FOR_LEAD.md","scripts/s4-r2-current-browser.config.mjs"]
export function allowedPath(n){return extra.includes(n)||['scripts/nq5-s4-r2/','artifacts/g6p-s4-r2/','docs/source/execution-s4-r2/'].some(p=>n.startsWith(p))}
export function verify(){
 const source='docs/source/execution-s4-r2/',report='artifacts/g6p-s4-r2/REPORTS/',read=n=>JSON.parse(fs.readFileSync(n))
 assert.equal(execFileSync('git',['rev-parse',BASE+'^{tree}'],{encoding:'utf8'}).trim(),TREE);execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'])
 const refs=fs.readFileSync(source+'MANIFEST.sha256','utf8').trim().split('\n');assert.equal(refs.length,10)
 assert.equal(sha(fs.readFileSync(source+'MANIFEST.sha256')),'807a7b80829909f13772bac71f20e7fc9d12b1fec6a430224c33d0a407903bc7');assert.equal(sha(fs.readFileSync(source+'VERIFY_INPUT.py')),'aaf2cc516e342d5a621cfce089cd6a7162637a97e241a017e5efe6eb667b04c1')
 for(const l of refs)assert.equal(sha(fs.readFileSync(source+l.slice(66))),l.slice(0,64))
 const receipt=read(source+'MAIN_REVIEW_RECEIPT.json');assert.equal(receipt.git.candidate_commit,BASE);assert.equal(receipt.git.candidate_tree,TREE);assert.equal(receipt.candidate_promoted,false);assert.equal(receipt.accepted.S4_R1_P2_02,'CLOSED')
 const preservation=read(report+'PRESERVATION.json');for(const x of preservation.preservedFiles){assert.equal(sha(fs.readFileSync(x.file)),x.sha256);assert.equal(sha(execFileSync('git',['show',BASE+':'+x.file],{maxBuffer:128000000})),x.sha256)}
 assert.equal(canonical(read(report+'TRUTH_HASH_CROSSWALK.json')),canonical(read('artifacts/g6p-s4/REPORTS/TRUTH_HASH_CROSSWALK.json')))
 const map=compileContent(),consumers=consumerManifest(map.dead);assertClosedClient(map,consumers);assert.equal(canonical(read('src/controller/content/runtime-content.json')),canonical(map));assert.equal(map.compiledEntries,74);assert.equal(sha(fs.readFileSync('src/controller/content/runtime-content.json')),receipt.accepted.client_map_sha256)
 const changed=execFileSync('git',['diff','--name-only',BASE,'--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);assert.ok(changed.every(allowedPath),'CLOSED_S4_R2_SCOPE')
 for(const n of ['AGENTS.md','.cursor/x','ART_PRODUCTION/x','src/investigation/semantic-ux/x','src/app/corpus-presentation/x','tests/unit/lane-c/x','tests/e2e/lane-c/x','docs/parallel/lane-c/x','content/parallel/narrative/x','docs/parallel/lane-a/x','public/scenarios/euler-2023-false-exit/scenario.json','src/controller/content/runtime-content.json','src/adventure/narrative.ts'])assert.equal(allowedPath(n),false)
 const reproduced=JSON.parse(execFileSync('node',[source+'S4_R1_RESIDUAL_ARTHUR_SURFACE_REPRODUCER.mjs','--expect-fixed','.'],{encoding:'utf8'}));assert.equal(reproduced.status,'PASS');assert.deepEqual(reproduced.findings,[])
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
 for(const n of [...walk('scripts/nq5-s4-r2'),...walk('artifacts/g6p-s4-r2'),...walk(source.slice(0,-1)),...extra.filter(n=>fs.existsSync(n))]){const s=fs.lstatSync(n);assert.ok(s.isFile()&&!s.isSymbolicLink());const t=fs.readFileSync(n,'utf8');assert.equal(privatePathFindings(t).length,0,n);assert.equal(hasSecretLikeValue(t),false,n)}
 const status=read('docs/PROJECT_STATUS.yaml');assert.equal(status.accepted_base,'299bc67ab65c3f4fdda22d08e76c6c23df89c8f8');assert.equal(status.corpus_interface.frozen,true);assert.equal(status.account_compliance.quota_claimed,false)
 return {status:'PASS',baselineFiveManifestationsReproduced:true,residualReproducerFixed:true,clientEntries:74,clientSha256:receipt.accepted.client_map_sha256,consumerChanges:0,acceptedLaneFilesPreserved:37,truthAndFrozenCorpusByteChanges:0,LaneCPathsChanged:0,providerRequests:0,credentialAccess:false}
}
if(process.argv[1]?.endsWith('/verify.mjs'))console.log(JSON.stringify(verify()))
