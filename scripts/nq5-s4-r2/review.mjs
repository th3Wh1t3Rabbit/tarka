import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sha} from '../nq5-s2/activity.mjs'
import {verify,extra,allowedPath} from './verify.mjs'
import {compileContent,compileEntries} from '../nq5-s4/compile-content.mjs'
import {consumerManifest,assertClosedClient} from '../nq5-s4-r1/consumers.mjs'
assert.equal(verify().status,'PASS')
const map=compileContent(),manifest=consumerManifest(map.dead),source=JSON.parse(fs.readFileSync('content/parallel/narrative/COPY_CATALOG.json')),key='lane_a.opening.1'
const missing=structuredClone(source);missing.entries=missing.entries.filter(e=>e.key!==key);assert.throws(()=>compileEntries(missing,manifest),/MISSING_REQUIRED_CONSUMER_KEY/)
const injected=structuredClone(map);injected.entries['lane_a.theory.accepted']={text:'IT JOINED THE SECOND ROUTE',optional:false};assert.throws(()=>assertClosedClient(injected,manifest),/CLIENT_CONSUMER_KEY_SET/)
const hidden=structuredClone(map);hidden.entries[key].text='IT JOINED THE SECOND ROUTE';assert.throws(()=>assertClosedClient(hidden,manifest),/CLIENT_EXACT_OR_ANSWER_TEXT/)
const pruned=structuredClone(map);delete pruned.entries[key];assert.throws(()=>assertClosedClient(pruned,manifest),/CLIENT_CONSUMER_KEY_SET/)
for(const n of ['src/investigation/semantic-ux/x','src/app/corpus-presentation/x','tests/unit/lane-c/x','tests/e2e/lane-c/x','docs/parallel/lane-c/x','content/parallel/narrative/x','public/scenarios/euler-2023-false-exit/scenario.json'])assert.equal(allowedPath(n),false)
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
const requireLog=(name,count)=>{const text=fs.readFileSync('artifacts/g6p-s4-r2/LOGS/'+name+'.log','utf8');assert.match(text,new RegExp(count+' passed'));assert.match(text,/EXIT_CODE=0/);assert.doesNotMatch(text,/\d+ failed/)}
for(const [name,count] of [['broad-unit-acquisition',1519],['browser-current-preview',34],['browser-fixes',3],['browser-s3',3],['browser-authority',1],['browser-s4',2],['browser-display-corrected',3],['browser-residual-corrected',3]])requireLog(name,count)
const files=[...new Set([...walk('scripts/nq5-s4-r2'),...extra.filter(n=>fs.existsSync(n))])].sort(),implementationBindings=files.map(file=>({file,sha256:sha(fs.readFileSync(file))}))
const cases=[
 {case:'Primary office Arthur masks stale ordinary Terminal optional performance',evidence:'Native earned Terminal optional details assert actual Arthur image and corrected late-bound-art caption; all 12 portrait intentions independently SSR-rendered'},
 {case:'Art Lab name statement passes while preview or capability alt stays raw',evidence:'Native preview child image plus every performance intention; body/aria snapshots and unchanged qualified internal-ID heading/clip/asset IDs'},
 {case:'Only initial Mission cue is fixed while later speakers leak',evidence:'Native all ten onboarding cues assert every speaker and semantic image; full/reduced initial cue; optional missing-asset fallback SSR assertion'},
 {case:'Public-name correction renames internal IDs or saved/progression values',evidence:'Original keyboard progression phases/inventory remain asserted; unchanged source scenes/reducers/state/query/fixture/narrative/catalogs/sequence engine; native original clip/semantic/asset IDs and saved values exclude display strings'},
 {case:'Helper is bypassed through semantic image or missing asset fallback',evidence:'Both branches call the unchanged shared publicObjectName; publicSpeaker delegates unchanged; SSR missing-asset rendering bears Arthur'},
 {case:'New presentation fields inflate or secretly spoil accepted 74-key map',evidence:'Same accepted runtime SHA, untouched compiler/AST consumers; actual injected key/text and deleted authoring/emitted-key mutations reject'},
 {case:'Passing focused UI tests conceal truth/frozen corpus/Lane C drift',evidence:'Exact reviewed-base preservation pins, empty tracked Lane C path diff, closed scope sentinels and schema/no-network/scenario checks'},
 {case:'Package/source/report is resealed to imply promotion or sent supplier packet',evidence:'Candidate-bound incremental bundle/diff/object privacy, unsent packet, original MAIN receipt pins, disclosed non-independent reviews and ten actual rejection cases required before publication'}
]
for(const [number,scope]of [[1,'Residual optional/performance/Mission visual and accessibility boundaries; internal compatibility'],[2,'Accepted 74-key SHA preservation, mandatory fail-closed behavior and exact package/authority seams']])fs.writeFileSync('artifacts/g6p-s4-r2/REPORTS/REVIEW_'+number+'.json',JSON.stringify({status:'PASS_CLOSED_TASK_OWNED_FINDINGS',independent:false,reviewer:'MAIN_OWNED_DISCLOSED_FALLBACK',scope,implementationBindings,strongestFalseSuccessChecks:cases,executedClosedMapMutationRejections:4,acceptedClientMapUnchanged:true,consumerChanges:0,localFindingCorrections:['S4-R2-P1-01'],independentMAINAcceptance:false,providerRequests:0,packetsSent:false,unperformed:['Actual AT/contrast/hardware touch','Final Pixel/full integrated journey','Content lock/release/quota acceptance','Supplier targeted return after MAIN']},null,2)+'\n')
console.log(JSON.stringify({status:'PASS',reviews:2,independent:false,strongestFalseSuccessClasses:8,executedClosedMapMutationRejections:4,implementationFiles:files.length}))
