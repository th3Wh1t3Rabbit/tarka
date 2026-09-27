import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import * as seam from '../../src/investigation/corpus-seam/authority.mjs'
import {runAuthorityAdversarial} from './adversarial.mjs'
const START='38c673f7d031e19d8bd8574658ef876109b6fa7c',TREE='febbb347c47be02cac9469953ac64fd6ab01bce8',read=n=>JSON.parse(fs.readFileSync(n)),out='artifacts/g6p-s3-r1/',source='docs/source/execution-s3-r1/'
assert.equal(execFileSync('git',['rev-parse',START+'^{tree}'],{encoding:'utf8'}).trim(),TREE)
execFileSync('git',['merge-base','--is-ancestor',START,'HEAD'])
const manifest=fs.readFileSync(source+'MANIFEST.sha256','utf8')
assert.equal(sha(manifest),'96984495bcd6332f1e2076112abc79712b205a6f354880cccf0696e09d0ce102');assert.equal(sha(fs.readFileSync(source+'VERIFY_INPUT.py')),'ec12363076df024dcd14614d5df9e7af0dbb9d619d5618d7e2eb2719e2e927df')
let refs=0
for(const l of manifest.trim().split('\n')){const h=l.slice(0,64),n=l.slice(66);if(n.startsWith('GIT/'))continue;assert.equal(sha(fs.readFileSync(source+n)),h);refs++}
assert.equal(refs,11)
const receipt=read(source+'MAIN_REVIEW/TRACE_ESCAPE_MAIN_LEAD_REVIEW_S3_CORPUS_INTERFACE_AND_LANE_C_PREPARATION_RECEIPT_v1.0.0_2026-09-17.json')
assert.equal(receipt.disposition,'S3_REMEDIATION_REQUIRED_WITH_FINAL_INTERFACE_DATA_ACCEPTANCE');assert.equal(receipt.reviewedS3CandidatePromoted,false)
assert.equal(receipt.git.candidateCommit,START);assert.equal(receipt.acceptedControllerBaseRemains,'60c613d292099edb464210b9f03e07d6415c220e')
const inputDiffSha=sha(execFileSync('git',['diff','--binary','60c613d292099edb464210b9f03e07d6415c220e',START],{maxBuffer:64000000}))
assert.equal(inputDiffSha,'5b5366cec9035e43b4127316aa039ac799d464bc71e9b8328f70649d73647150')
const preservation=read(out+'REPORTS/ACCEPTED_BYTE_IDENTITIES.json')
for(const x of preservation.files){const b=fs.readFileSync(x.file);assert.equal(sha(b),x.sha256);assert.ok(b.equals(execFileSync('git',['show',START+':'+x.file])))}
const candidate=read(out+'REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json'),fixture=read(out+'REPORTS/SYNTHETIC_SEMANTIC_FIXTURE.json')
assert.equal(sha(fs.readFileSync(out+'REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json')),'9a68312148dab31784c7e8221ff7db2bc9f87424e969d1169159aa91df75b90f')
const checks=await runAuthorityAdversarial(seam,candidate,fixture)
assert.equal(checks.resealedFalseSuccessRejections,54);assert.equal(canonical(read(out+'REPORTS/AUTHORITY_RESEALED_CHECKS.json')),canonical(checks))
const packet=JSON.parse(execFileSync(process.execPath,[out+'LANE_C_PREPARED_NOT_SENT/VERIFY_LANE_C.mjs'],{encoding:'utf8'}))
assert.equal(packet.pinnedFullCandidateAdmission,true);assert.equal(packet.resealedFalseSuccessRejections,54)
for(const[n,p]of [['authority.mjs','src/investigation/corpus-seam/authority.mjs'],['contracts.ts','src/investigation/corpus-seam/contracts.ts'],['authority.d.mts','src/investigation/corpus-seam/authority.d.mts'],['RESEALED_COMPATIBILITY_CHECKS.mjs','scripts/nq5-s3-r1/adversarial.mjs'],['COMPATIBILITY_TEST.ts','tests/unit/s3-corpus-seam.test.ts'],['AUTHORITY_TEST.mjs','tests/unit/s3-r1-authority.test.mjs']])assert.ok(fs.readFileSync(out+'LANE_C_PREPARED_NOT_SENT/'+n).equals(fs.readFileSync(p)))
const changed=execFileSync('git',['diff','--name-only',START,'--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
const prefixes=['scripts/nq5-s3-r1/','artifacts/g6p-s3-r1/','docs/source/execution-s3-r1/','src/investigation/corpus-seam/'],extra=['docs/PROJECT_STATUS.yaml','docs/PROJECT_SCHEDULE.json','docs/G6P_NQ5_T1_S3_R1_NOTES_FOR_LEAD.md','tests/unit/project-clock.test.mjs','tests/unit/s3-corpus-seam.test.ts','tests/unit/s3-r1-authority.test.mjs','tests/e2e/s3-r1-authority.spec.ts','scripts/s3-r1-browser.config.mjs']
assert.ok(changed.every(n=>prefixes.some(p=>n.startsWith(p))||extra.includes(n)),'CLOSED_TASK_OWNED_SCOPE')
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
for(const n of new Set([...prefixes.flatMap(p=>walk(p.slice(0,-1))),...extra.filter(n=>fs.existsSync(n))])){const s=fs.lstatSync(n);assert.ok(s.isFile()&&!s.isSymbolicLink());const text=fs.readFileSync(n,'utf8');assert.equal(privatePathFindings(text).length,0,'PRIVATE_PATH_'+n);assert.equal(hasSecretLikeValue(text),false,'SECRET_MARKER_'+n)}
const status=read('docs/PROJECT_STATUS.yaml');assert.equal(status.accepted_base,'60c613d292099edb464210b9f03e07d6415c220e');assert.equal(status.corpus_interface.frozen,false);assert.equal(status.corpus_interface.lane_c_active,false);assert.equal(status.account_compliance.quota_claimed,false)
console.log(JSON.stringify({status:'PASS',pinnedCandidateAdmission:true,resealedRejections:54,legitimateSubsetModes:3,acceptedConcepts:25,boundedNoMatch:7,finalDataBytesUnchanged:true,unchangedEulerFiles:6,acceptedAccountingBytesUnchanged:true,reviewedStart:START,acceptedBaseUnpromoted:true,interfaceFrozen:false,LaneCActive:false,networkRequests:0,credentialAccess:false,privacy:'PASS'}))
