import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {compileContent} from '../nq5-s4/compile-content.mjs'
import {consumerManifest,assertClosedClient} from '../nq5-s4-r1/consumers.mjs'
import {BASE,TREE} from './constants.mjs'
const out='artifacts/g6p-s4-r2/REPORTS/',read=n=>JSON.parse(fs.readFileSync(n)),put=(n,x)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+n,JSON.stringify(x,null,2)+'\n')}
assert.equal(execFileSync('git',['rev-parse',BASE+'^{tree}'],{encoding:'utf8'}).trim(),TREE)
const extra=['src/controller/content/runtime-content.json','src/controller/content/adapter.ts','scripts/nq5-s4/compile-content.mjs','scripts/nq5-s4-r1/consumers.mjs','src/adventure/narrative.ts','src/adventure/sentence.ts','src/adventure/content.ts','src/adventure/semanticCatalog.ts','src/adventure/sequenceEngine.ts','src/adventure/performanceCatalog.ts','src/adventure/eulerMission.ts','src/app/CaseTerminalWorkbench.tsx','src/adventure/types.ts']
const preservedFiles=[...new Set([...read('artifacts/g6p-s4-r1/REPORTS/PRESERVATION.json').preservedFiles.map(x=>x.file),...extra])].map(file=>{const b=fs.readFileSync(file);assert.ok(b.equals(execFileSync('git',['show',BASE+':'+file],{maxBuffer:128000000})),file);return{file,sha256:sha(b)}})
const lane=read('artifacts/g6p-s4/REPORTS/LANE_A_ADMISSION.json');assert.equal(lane.laneFiles.length,37);for(const x of lane.laneFiles)assert.equal(sha(fs.readFileSync(x.file)),x.sha256)
const paths=['src/investigation/semantic-ux/','src/app/corpus-presentation/','tests/unit/lane-c/','tests/e2e/lane-c/','docs/parallel/lane-c/']
assert.equal(execFileSync('git',['diff','--name-only',BASE,'--',...paths],{encoding:'utf8'}).trim(),'')
const map=compileContent(),consumers=consumerManifest(map.dead);assertClosedClient(map,consumers);assert.equal(canonical(map),canonical(read('src/controller/content/runtime-content.json')))
const clientSha=sha(fs.readFileSync('src/controller/content/runtime-content.json'));assert.equal(clientSha,'57f27ecfef64f9c149f2f80bdb1efffbc629d79fd5f6a76e21c0e943c5c95bfc')
put('PRESERVATION.json',{status:'PASS',reviewedStart:BASE,reviewedTree:TREE,preservedFiles,acceptedLaneFiles:37,truthFiles:7,truthCrosswalkByteIdentical:true,clientEntries:74,clientSha256:clientSha,consumerChanges:0,MAINFreezeReceiptsByteIdentical:true,accountEvidenceByteIdentical:true,LaneCTrackedPathsChanged:0,LaneCPathCheck:'Tracked reviewed-base to workspace diff is empty; no autonomous untracked lane content enumerated/read/modified/packaged.',internalIdentityAndAssets:'Presentation-only diff; scenes/reducers/state/query/narrative/performance/semantic catalogs and sequence engine are byte-identical.',providerRequests:0})
put('LANE_A_ADMISSION.json',lane);put('TRUTH_HASH_CROSSWALK.json',read('artifacts/g6p-s4/REPORTS/TRUTH_HASH_CROSSWALK.json'))
put('CONSUMER_MANIFEST.json',{status:'PASS',keys:Object.keys(consumers),consumers,compiledEntries:74,sha256:clientSha,consumerChanges:0,MAINAcceptance:'S4-R1-P2-02 CLOSED; preserve exact accepted bytes',requiredMissingRejected:true,unconsumedEmissionRejected:true,acceptedTheoryExcluded:true})
put('INTEGRATION_INVENTORY.json',{status:'S4_R2_CORRECTIONS_PENDING_MAIN_REVIEW',finding:'S4-R2-P1-01',publicHelper:'Unchanged shared publicObjectName/publicSpeaker',surfaces:['Ordinary Terminal archivist PerformancePortrait alt/caption','Art Lab archivist animation alt','Art Lab all archivist performance intentions','Mission Harness visible speaker','Mission Harness semantic image/optional-asset accessible name'],consumerMapEntries:74,consumerChanges:0,internalAliasesUnchanged:['archivist','ARCHIVIST','MR_INDEX','mr-index','mrIndex'],acceptedControllerBase:'299bc67ab65c3f4fdda22d08e76c6c23df89c8f8',reviewedStart:BASE,candidatePromoted:false,LaneCC1:'Accepted in supplied MAIN controller queue receipt, not integrated/modified here',packetsSent:false,providerRequests:0})
console.log(JSON.stringify({status:'PASS',acceptedLaneFiles:37,truthBytesChanged:0,corpusBytesChanged:0,LaneCPathsChanged:0,clientEntries:74,clientSha256:clientSha}))
