import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {canonical,sha,identity} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {compileFinal,syntheticFixture,launchContract,validateFinal,validateLaunch,BASE,BASE_TREE} from './corpus.mjs'
const read=n=>JSON.parse(fs.readFileSync(n)),report=n=>read('artifacts/g6p-s3/REPORTS/'+n)
assert.equal(execFileSync('git',['rev-parse',BASE+'^{tree}'],{encoding:'utf8'}).trim(),BASE_TREE)
execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'])
const input=read('docs/G6P_NQ5_T1_S2_CURATED_INPUT.json'),final=report('TE_IFACE_CORPUS_FINAL_CANDIDATE.json'),compatibility=final.compatibility
assert.equal(final.identity,'4c9d93c8b9b97503df4580ee72f8d19c7515a9ed29dad54d558cb258bd2c3e60')
validateFinal(final,input,compatibility)
assert.deepEqual(report('SYNTHETIC_SEMANTIC_FIXTURE.json'),syntheticFixture(final))
assert.deepEqual(report('LANE_C_LAUNCH_CONTRACT.json'),launchContract(final))
const admission=report('INPUT_ADMISSION.json')
assert.equal(admission.manifestSha256,'bdcdc21a33d26e4f3dfd7b726d83bd7bb286ca43f21823862a86ec79506f2b17')
assert.equal(admission.validatorSha256,'171c4b7a89b12e6238f6429e659809761119e2182efa54cad43f949a7b93a184')
for(const x of admission.retainedReferences)assert.equal(sha(fs.readFileSync('docs/source/execution-s3/'+x.file)),x.sha256)
assert.equal(sha(fs.readFileSync('docs/source/execution-s3/MANIFEST.sha256')),admission.manifestSha256)
assert.equal(sha(fs.readFileSync('docs/source/execution-s3/VERIFY_INPUT.py')),admission.validatorSha256)
const receipt=read('docs/source/execution-s3/MAIN_REVIEW/TRACE_ESCAPE_MAIN_LEAD_REVIEW_S2R1_AND_LANEB_TARGETED_REGRESSION_RECEIPT_v1.0.0_2026-09-17.json')
assert.equal(receipt.identity,'39a6dfc9d7031158569ab12b9e5f95347197aec62c825bbc27814596cc86aa26')
for(const x of compatibility.preservedBytes){const base=execFileSync('git',['show',BASE+':'+x.file]);assert.equal(sha(base),x.sha256);assert.ok(base.equals(fs.readFileSync(x.file)))}
assert.equal(final.displayRecords.filter(x=>x.zeroResultClass).length,7)
assert.equal(new Set(final.concepts.map(x=>x.id)).size,25)
for(const c of final.concepts){
 const d=final.displayRecords.filter(x=>x.conceptId===c.id),a=final.auditReferences.filter(x=>x.conceptId===c.id)
 assert.equal(d.length,1);assert.equal(a.length,1);assert.deepEqual(a[0].provenance,c.provenance);assert.deepEqual(a[0].publicPrivateDispositions,c.publicPrivateDispositions)
}
let rejections=0
const mutate=change=>{const x=structuredClone(final);change(x);const{identity:h,...body}=x;x.identity=identity(body);assert.throws(()=>validateFinal(x,input,compatibility));rejections++}
for(const change of [
 x=>{x.interface='TE-IFACE-CORPUS@1.0.0-rc1'},x=>{x.schemaVersion='1.0.0-rc1'},x=>{x.parentRCIdentity='0'.repeat(64)},
 x=>{x.interfaceFrozen=true},x=>{x.LaneCActive=true},x=>{x.concepts.pop()},x=>{x.concepts[1]=x.concepts[0]},
 x=>{x.displayRecords[0].zeroResultClass='NEGATIVE_EVIDENCE_SUPPORTED'},x=>{x.displayRecords[0].proofEligible=true},
 x=>{x.displayRecords[0].endpoint='SYNTHETIC_PROVIDER_FIELD'},x=>{delete x.auditReferences[0].provenance},
 x=>{x.displayRecords.reverse()},x=>{x.displayRecords[0].identity='0'.repeat(64)},x=>{x.runtimeProviderCalls=1},
 x=>{x.compatibility.B_F01='FIRST_RAW_ASSET'},x=>{x.compatibility.B_F02='POINTER_ONLY_TRUNCATED'}
])mutate(change)
for(const change of [x=>{x.ownedPaths.push('src/investigation/')},x=>{x.interfaceFrozen=true},x=>{x.LaneCActive=true},x=>{x.packetsSent=true},x=>{x.interfaceIdentity='0'.repeat(64)}]){
 const x=launchContract(final);change(x);const{identity:h,...body}=x;x.identity=identity(body);assert.throws(()=>validateLaunch(x,final));rejections++
}
const inventory=report('OVERLAY_ADMISSION_INVENTORY.json'),manifest=fs.readFileSync('docs/source/execution-s3/MANIFEST.sha256','utf8').trim().split('\n').filter(l=>l.slice(66).startsWith('LANE_B/TEST_OVERLAY/')).map(l=>({sha256:l.slice(0,64),file:l.slice(66)}))
assert.equal(inventory.decisions.length,26);assert.equal(inventory.adaptedPaths,4)
assert.deepEqual(inventory.decisions.map(({file,sha256})=>({file,sha256})),manifest)
for(const x of inventory.decisions)for(const t of x.targets)assert.equal(sha(fs.readFileSync(t.file)),t.sha256)
execFileSync(process.execPath,['artifacts/g6p-s3/LANE_C_PREPARED_NOT_SENT/VERIFY_LANE_C.mjs'],{stdio:'pipe'})
const changed=execFileSync('git',['diff','--name-only',BASE,'--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
const owned=['scripts/nq5-s3/','src/investigation/corpus-seam/','artifacts/g6p-s3/','docs/source/execution-s3/']
const extra=['docs/G6P_NQ5_T1_S3_NOTES_FOR_LEAD.md','docs/PROJECT_STATUS.yaml','docs/PROJECT_SCHEDULE.json','tests/unit/project-clock.test.mjs','scripts/s3-browser.config.mjs','scripts/s3-current-browser.config.mjs']
assert.ok(changed.every(n=>owned.some(p=>n.startsWith(p))||extra.includes(n)||/^tests\/(unit|e2e)\/s3-[\w.-]+$/.test(n)))
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])}
const current=[...owned.flatMap(p=>walk(p.slice(0,-1))),...changed]
for(const n of new Set(current)){const s=fs.lstatSync(n);assert.ok(s.isFile()&&!s.isSymbolicLink());const text=fs.readFileSync(n,'utf8');assert.equal(privatePathFindings(text).length,0,'private literal in '+n);assert.equal(hasSecretLikeValue(text),false,'secret marker in '+n)}
assert.equal(canonical(compileFinal(input,compatibility)),canonical(final))
console.log(JSON.stringify({status:'PASS',schemaSemanticMutationsRejected:rejections,acceptedConcepts:25,boundedNoMatch:7,unchangedEulerFiles:6,overlayPaths:26,adaptedOverlayPaths:4,interfaceIdentity:final.identity,interfaceFrozen:false,LaneCActive:false,runtimeProviderCalls:0,privacy:'PASS'}))
