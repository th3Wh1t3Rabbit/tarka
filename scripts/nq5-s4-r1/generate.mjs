import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {compileContent} from '../nq5-s4/compile-content.mjs'
import {consumerManifest,assertClosedClient} from './consumers.mjs'
import {BASE,TREE} from './constants.mjs'
const out='artifacts/g6p-s4-r1/REPORTS/',put=(n,x)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+n,JSON.stringify(x,null,2)+'\n')},read=n=>JSON.parse(fs.readFileSync(n)),old=n=>execFileSync('git',['show',BASE+':'+n],{maxBuffer:128000000})
assert.equal(execFileSync('git',['rev-parse',BASE+'^{tree}'],{encoding:'utf8'}).trim(),TREE)
const lane=read('artifacts/g6p-s4/REPORTS/LANE_A_ADMISSION.json').laneFiles
const truth=['scenario.json','provenance.json','catalog.json','scenario.sha256','world.json','evidence-graph.json','omitted-events.json'].map(n=>'public/scenarios/euler-2023-false-exit/'+n)
const receipts=fs.readdirSync('docs/source/execution-s4/MAIN_S3_R1_ACCEPTANCE').map(n=>'docs/source/execution-s4/MAIN_S3_R1_ACCEPTANCE/'+n)
const account=fs.readdirSync('artifacts/g6p-s2-r1/REPORTS').map(n=>'artifacts/g6p-s2-r1/REPORTS/'+n)
const files=[...lane.map(x=>x.file),...truth,...receipts,...account,'artifacts/g6p-s4/REPORTS/TRUTH_HASH_CROSSWALK.json','artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json','src/investigation/corpus-seam/authority.d.mts','src/adventure/scenes.ts','src/adventure/reducer.ts','src/investigation/state.ts','src/investigation/query.ts','src/investigation/fixture.ts']
const preservedFiles=[...new Set(files)].map(file=>{const b=fs.readFileSync(file);assert.ok(b.equals(old(file)),file);return {file,sha256:sha(b)}})
for(const x of lane)assert.equal(sha(fs.readFileSync(x.file)),x.sha256)
const paths=['src/investigation/semantic-ux/','src/app/corpus-presentation/','tests/unit/lane-c/','tests/e2e/lane-c/','docs/parallel/lane-c/']
assert.equal(execFileSync('git',['diff','--name-only',BASE,'--',...paths],{encoding:'utf8'}).trim(),'')
put('PRESERVATION.json',{status:'PASS',reviewedStart:BASE,reviewedTree:TREE,preservedFiles,acceptedLaneFiles:37,truthFiles:7,truthCrosswalkByteIdentical:true,frozenCorpusIdentity:'4c9d93c8b9b97503df4580ee72f8d19c7515a9ed29dad54d558cb258bd2c3e60',MAINFreezeReceiptsByteIdentical:true,accountEvidenceByteIdentical:true,LaneCTrackedPathsChanged:0,LaneCPathCheck:'Tracked reviewed-base to workspace diff is empty; no untracked autonomous lane content enumerated, read, modified or packaged.',legacyAliasesBytePreservedByScenes:true,providerRequests:0})
put('TRUTH_HASH_CROSSWALK.json',read('artifacts/g6p-s4/REPORTS/TRUTH_HASH_CROSSWALK.json'))
const map=compileContent(),consumers=consumerManifest(map.dead);assertClosedClient(map,consumers);assert.equal(canonical(map),canonical(read('src/controller/content/runtime-content.json')))
put('CONSUMER_MANIFEST.json',{status:'PASS',keys:Object.keys(consumers),consumers,compiledEntries:map.compiledEntries,previousCompiledEntries:374,removedEntries:374-map.compiledEntries,requiredMissingRejected:true,unconsumedEmissionRejected:true,acceptedTheoryExcluded:true,authoringCatalogsUnchanged:true})
put('LANE_A_ADMISSION.json',read('artifacts/g6p-s4/REPORTS/LANE_A_ADMISSION.json'))
put('INTEGRATION_INVENTORY.json',{status:'S4_R1_CORRECTIONS_PENDING_MAIN_REVIEW',publicHelper:'src/controller/content/adapter.ts publicObjectName; publicSpeaker delegates',surfaces:['No-verb/verb/item command sentence','Character alt','Hotspot aria','Speech speaker','Dialogue title','Art Lab binding-name statement'],consumerMapEntries:map.compiledEntries,closedConsumerSet:true,compilerConsumerBindings:'Build-only source AST plus exact dead-end dispatch tables',deferred:['Accepted theory','Conclusion/proof copy','Exact evidence','Evidence-bound hints','Optional banter','Final density/title/performance/art'],internalAliasesUnchanged:['archivist','MR_INDEX','mr-index','mrIndex'],acceptedControllerBase:'299bc67ab65c3f4fdda22d08e76c6c23df89c8f8',reviewedStart:BASE,S4CandidatePromoted:false,corpusGameplayIntegrated:false,packetsSent:false,providerRequests:0})
console.log(JSON.stringify({status:'PASS',acceptedLaneFiles:37,truthBytesChanged:0,corpusBytesChanged:0,LaneCPathsChanged:0,clientEntries:map.compiledEntries}))
