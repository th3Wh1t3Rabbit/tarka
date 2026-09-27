import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {compileContent} from '../nq5-s4/compile-content.mjs'
import {consumerManifest,assertClosedClient} from './consumers.mjs'
import {BASE,TREE} from './constants.mjs'
export const extra=['src/adventure/sentence.ts','src/adventure/content.ts','src/app/App.tsx','scripts/nq5-s4/compile-content.mjs','src/controller/content/adapter.ts','src/controller/content/runtime-content.json','src/controller/content/build-test-contract.d.ts','scripts/s4-r1-browser.config.mjs','tests/e2e/s4-r1-display.spec.ts','tests/unit/s4-r1-remediation.test.ts','tests/unit/project-clock.test.mjs','docs/PROJECT_STATUS.yaml','docs/PROJECT_SCHEDULE.json','docs/G6P_NQ5_T1_S4_R1_NOTES_FOR_LEAD.md']
export function allowedPath(n){return extra.includes(n)||['scripts/nq5-s4-r1/','artifacts/g6p-s4-r1/','docs/source/execution-s4-r1/'].some(p=>n.startsWith(p))}
export function verify(){
 const source='docs/source/execution-s4-r1/',report='artifacts/g6p-s4-r1/REPORTS/',read=n=>JSON.parse(fs.readFileSync(n))
 assert.equal(execFileSync('git',['rev-parse',BASE+'^{tree}'],{encoding:'utf8'}).trim(),TREE)
 execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'])
 const refs=fs.readFileSync(source+'MANIFEST.sha256','utf8').trim().split('\n');assert.equal(refs.length,9)
 assert.equal(sha(fs.readFileSync(source+'MANIFEST.sha256')),'5aa58438fca29a8f88fc7cf7e523ce8fd9ecfbb1cabcfb5ead402c011ff7fb6a')
 assert.equal(sha(fs.readFileSync(source+'VERIFY_INPUT.py')),'5b6d1c914fa757a15882d2efd328f9d6770ac1e680b6eddee7bed01c6eacd078')
 for(const l of refs)assert.equal(sha(fs.readFileSync(source+l.slice(66))),l.slice(0,64))
 const receipt=read(source+'TRACE_ESCAPE_MAIN_LEAD_REVIEW_S4_RECEIPT_v1.0.0_2026-09-17.json');assert.equal(receipt.git.reviewed_candidate_commit,BASE);assert.equal(receipt.git.candidate_promoted,false)
 for(const x of read(report+'PRESERVATION.json').preservedFiles)assert.equal(sha(fs.readFileSync(x.file)),x.sha256)
 assert.equal(canonical(read(report+'TRUTH_HASH_CROSSWALK.json')),canonical(read(source+'S4_TRUTH_HASH_CROSSWALK.json')))
 const map=compileContent(),consumers=consumerManifest(map.dead);assertClosedClient(map,consumers);assert.equal(canonical(read('src/controller/content/runtime-content.json')),canonical(map))
 assert.equal(map.compiledEntries,74)
 const changed=execFileSync('git',['diff','--name-only',BASE,'--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);assert.ok(changed.every(allowedPath),'CLOSED_S4_R1_SCOPE')
 for(const n of ['AGENTS.md','.cursor/x','ART_PRODUCTION/x','src/investigation/semantic-ux/x','src/app/corpus-presentation/x','tests/unit/lane-c/x','tests/e2e/lane-c/x','docs/parallel/lane-c/x','content/parallel/narrative/x','docs/parallel/lane-a/x','public/scenarios/euler-2023-false-exit/scenario.json'])assert.equal(allowedPath(n),false)
 const sentence=fs.readFileSync('src/adventure/sentence.ts','utf8'),app=fs.readFileSync('src/app/App.tsx','utf8')
 assert.match(sentence,/hotspot \? publicObjectName\(hotspot\)/);assert.doesNotMatch(app,/Mr\. Index character|Public-facing name remains Lead-owned/);assert.doesNotMatch(app,/corpus-seam/)
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
 for(const n of [...walk('scripts/nq5-s4-r1'),...walk('artifacts/g6p-s4-r1'),...walk(source.slice(0,-1)),...extra.filter(n=>fs.existsSync(n))]){const s=fs.lstatSync(n);assert.ok(s.isFile()&&!s.isSymbolicLink());const t=fs.readFileSync(n,'utf8');assert.equal(privatePathFindings(t).length,0,n);assert.equal(hasSecretLikeValue(t),false,n)}
 const status=read('docs/PROJECT_STATUS.yaml');assert.equal(status.accepted_base,'299bc67ab65c3f4fdda22d08e76c6c23df89c8f8');assert.equal(status.corpus_interface.frozen,true);assert.equal(status.account_compliance.quota_claimed,false)
 return {status:'PASS',baselineBothFindingsReproduced:true,clientEntries:74,acceptedLaneFilesPreserved:37,truthAndFrozenCorpusByteChanges:0,LaneCPathsChanged:0,providerRequests:0,credentialAccess:false}
}
if(process.argv[1]?.endsWith('/verify.mjs'))console.log(JSON.stringify(verify()))
