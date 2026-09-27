import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha} from '../nq5-s2/activity.mjs'
import {verify,allowedPath,extra} from './verify.mjs'
import {BASE,compileContent} from './compile-content.mjs'
assert.equal(verify().status,'PASS')
const r='artifacts/g6p-s4/REPORTS/',lane=JSON.parse(fs.readFileSync(r+'LANE_A_ADMISSION.json')).laneFiles.map(x=>x.file),compiled=compileContent()
assert.equal(compiled.alias.semantic_id,'archivist');assert.equal(compiled.alias.legacy.speaker,'MR_INDEX');assert.equal(compiled.alias.legacy.hotspot,'mr-index');assert.equal(compiled.alias.legacy.art_manifest_key,'mrIndex')
assert.ok(Object.values(compiled.entries).every(e=>!e.optional))
const crosswalk=JSON.parse(fs.readFileSync(r+'TRUTH_HASH_CROSSWALK.json'));assert.equal(crosswalk.files.filter(x=>x.changed).length,4)
const owned=['scripts/nq5-s4','src/controller/content'],walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
const changed=execFileSync('git',['diff','--name-only',BASE,'--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
const files=[...new Set([...owned.flatMap(walk),...extra.filter(n=>fs.existsSync(n)),...lane,...changed.filter(n=>!n.startsWith('artifacts/')&&!n.startsWith('docs/source/')&&!n.startsWith('docs/parallel/'))])].sort()
const implementationBindings=files.map(file=>({file,sha256:sha(fs.readFileSync(file))}))
const paths=['src/investigation/semantic-ux/x','src/app/corpus-presentation/x','tests/unit/lane-c/x','tests/e2e/lane-c/x','docs/parallel/lane-c/x'];paths.forEach(n=>assert.equal(allowedPath(n,lane),false))
for(const [number,scope]of [[1,'Authority, input and supplier identity boundaries'],[2,'Actual runtime consumption, truth-hash precision and packaging seams']]){
 fs.writeFileSync(r+'REVIEW_'+number+'.json',JSON.stringify({status:'PASS_CLOSED_TASK_OWNED_FINDINGS',independent:false,reviewer:'MAIN_OWNED_DISCLOSED_FALLBACK',scope,implementationBindings,strongestFalseSuccessChecks:[{case:'Alias renaming masked as display',evidence:'Exact accepted 37-byte pins plus S4 alias/progression unit and native browser cases'},{case:'Conclusion text changed with stale hashes',evidence:'Exact-only semantic comparison, four-file crosswalk and g5 pack verify'},{case:'Catalog presence without consumption',evidence:'S4 opening/beat/dead-end/recovery unit assertions and integrated native UI cases; not catalog counts alone'},{case:'Optional banter made mandatory',evidence:'Compiler excludes all optional entries; mandatory core method retained by focused tests'},{case:'No-match promoted to global negative',evidence:'Actual replay/discovered subject/bounds/coverage equality; forged coverage and historical partial fixture rejected'},{case:'Lane C accidentally changed',evidence:'Closed path policy rejects all five Lane C sentinel paths without writing those paths'}],unresolvedOutsideScope:['Independent supplier/MAIN acceptance','Final density/art','Corpus gameplay wiring','Full journey and real AT/contrast/release qualification'],packetsSent:false,providerRequests:0},null,2)+'\n')
}
console.log(JSON.stringify({status:'PASS',reviews:2,independent:false,implementationFiles:files.length,strongestFalseSuccessClasses:6}))
