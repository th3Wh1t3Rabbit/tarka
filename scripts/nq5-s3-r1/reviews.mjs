import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sha} from '../nq5-s2/activity.mjs'
import * as seam from '../../src/investigation/corpus-seam/authority.mjs'
import {runAuthorityAdversarial} from './adversarial.mjs'
const read=n=>fs.readFileSync(n,'utf8'),json=n=>JSON.parse(read(n)),out='artifacts/g6p-s3-r1/REPORTS/'
const core=read('src/investigation/corpus-seam/authority.mjs'),generator=read('scripts/nq5-s3-r1/generate.mjs'),packager=read('scripts/nq5-s3-r1/package.mjs')
assert.ok(!/\bimport\b|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/.test(core))
assert.ok(core.includes('const corpora=new WeakMap(),synthetics=new WeakMap()'))
assert.ok(core.indexOf('const x=snapshot(value)')<core.indexOf('if(await digest(body)!==identity)'))
assert.ok(core.includes("if(await digest(body)!==identity)fail('S3_CANDIDATE_PINNED_IDENTITY')"))
assert.ok(core.includes('freeze(x)')&&core.includes('corpora.set(token,records)'))
assert.ok(core.includes("records=getCorpus(corpus),member=records.get(x.id)"))
assert.ok(core.includes('if(!member||!equal(x,member))'))
const cases=await runAuthorityAdversarial(seam,json(out+'TE_IFACE_CORPUS_FINAL_CANDIDATE.json'),json(out+'SYNTHETIC_SEMANTIC_FIXTURE.json'))
assert.equal(cases.resealedFalseSuccessRejections,54);assert.equal(cases.legitimateSubsetModes,3)
assert.ok(generator.indexOf("const seam=await import('./authority.mjs')")>generator.indexOf("n!=='TE_IFACE_CORPUS_FINAL_CANDIDATE.json'"))
assert.ok(generator.includes('await seam.admitFrozenCorpusCandidate(candidate)'))
assert.ok(packager.includes("BASE='38c673f7d031e19d8bd8574658ef876109b6fa7c'"))
assert.ok(packager.includes("acceptedControllerBase:'60c613d292099edb464210b9f03e07d6415c220e'"))
assert.ok(packager.includes("modes.get(n)==='100755'?0o755:0o644"))
assert.ok(packager.includes('objectsScanned')||packager.includes('textObjectsScanned:scanned'))
assert.ok(packager.includes("fs.constants.COPYFILE_EXCL"))
assert.ok(packager.includes("privatePathFindings(text).length||hasSecretLikeValue(text)"))
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
const files=[...walk('src/investigation/corpus-seam'),...walk('scripts/nq5-s3-r1'),...walk('docs/source/execution-s3-r1'),...walk('artifacts/g6p-s3-r1/LANE_C_PREPARED_NOT_SENT'),...walk(out.slice(0,-1)).filter(n=>!/REVIEW_[12]\.json$/.test(n)),...['docs/PROJECT_STATUS.yaml','docs/PROJECT_SCHEDULE.json','docs/G6P_NQ5_T1_S3_R1_NOTES_FOR_LEAD.md','scripts/s3-r1-browser.config.mjs','tests/unit/project-clock.test.mjs','tests/unit/s3-corpus-seam.test.ts','tests/unit/s3-r1-authority.test.mjs','tests/e2e/s3-r1-authority.spec.ts']].sort()
const implementationBindings=[...new Set(files)].map(file=>({file,sha256:sha(fs.readFileSync(file))}))
const reviews=[
 {focus:'Canonical authority and JSON/async/immutability boundary',findings:[{id:'S3-R1-P1-01',status:'CLOSED_IN_IMPLEMENTATION_PENDING_MAIN_REVIEW',evidence:'Pinned complete-candidate admission and exact private-map membership; 54 resealed/authority rejection checks; compiled supplied reproducer rejects nine cases; browser-native checks and immutable legitimate subset modes.'}],checks:['No IO or transport imports in browser core','Full JSON snapshot before asynchronous digest','Pinned full-candidate digest, concept/display/audit mapping','Nested canonical coverage and duplicate invariants','Private opaque token; caller changes cannot mutate accepted snapshot','Separate noncanonical synthetic token path'],limitations:'Cryptographic SHA-256 collision resistance, trusted native WebCrypto/runtime and trusted shipped verifier/code are assumptions. Exotic JSON domain rejects; this is not isolation from a hostile same-realm runtime or a MAIN freeze receipt.'},
 {focus:'Prepared packet, recovery, preservation, scope and claims',findings:[{id:'S3-R1-REVIEW-PACKET-IMPORT-ORDER',status:'CLOSED',evidence:'Packet generator verifies non-candidate shipped content before dynamic core/checker import; candidate admission precedes candidate byte pin. Six fully resealed packet mutations still reject at admission, plus one charter escalation rejects content pin.'}],checks:['Packet uses actual core and shared 54-case matrix','Charter and activation remain UNSENT/false','Accepted data, Euler, production and accounting byte preservation','Exact reviewed unpromoted S3 bundle prerequisite vs accepted controller base','Mode-preserving fresh materializer, strict fsck, exact binary diff','Incremental reconstructed text-object privacy scan; no full inherited-history packaging','Stopped attempts and legacy 28/17 browser baseline disclosed','Exclusive deterministic ZIP publication and ten checked outer policy rejections'],limitations:'Package execution/fresh totals are verified by package logs and final summary after commit, not preclaimed by this review. Two MAIN-owned review passes are fallback self-reviews, not independent lead approval; independent MAIN review is still required.'}
]
for(let i=0;i<reviews.length;i++)fs.writeFileSync(out+'REVIEW_'+(i+1)+'.json',JSON.stringify({schemaVersion:'1.0.0',status:'PASS_CLOSED_TASK_OWNED_FINDINGS',independent:false,reviewer:'MAIN_OWNED_DISCLOSED_FALLBACK',reviewedStart:'38c673f7d031e19d8bd8574658ef876109b6fa7c',...reviews[i],implementationBindings,interfaceFrozen:false,LaneCActive:false,packetsSent:false,networkRequests:0,credentialAccess:false},null,2)+'\n')
console.log(JSON.stringify({status:'PASS_CLOSED_TASK_OWNED_FINDINGS',boundedReviews:2,independent:false,boundFiles:implementationBindings.length,actualResealedChecks:54,closedTaskOwnedFindings:2,MAINAcceptance:false}))
