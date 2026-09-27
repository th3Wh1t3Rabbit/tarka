import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sha} from '../nq5-s2/activity.mjs'
import {verify,EXTRA} from './verify.mjs'
const read=n=>fs.readFileSync(n,'utf8'),report=n=>JSON.parse(read(n))
const bind=files=>[...new Set(files)].sort().map(file=>({file,sha256:sha(fs.readFileSync(file))}))
const log=(n,count)=>{const t=read('artifacts/g6p-s5/LOGS/'+n+'.log');assert.ok(t.includes(count+' passed')&&t.includes('EXIT_CODE=0'));assert.ok(!/\d+ failed/.test(t));return{file:'artifacts/g6p-s5/LOGS/'+n+'.log',sha256:sha(t),passed:count}}
const preservation=await verify()
const tests=[log('unit-s5-hardened',30),log('unit-lane-c-corrected',35),log('browser-current-fresh-corrected',34),log('browser-preserved-all',15),log('browser-s5-final-derived',5),log('browser-lane-c',5)]
const production=EXTRA.filter(n=>n.startsWith('src/')).concat(['src/app/corpus-presentation/CorpusPresentation.tsx','src/investigation/semantic-ux/model.ts'])
const common={status:'PASS_CLOSED_TASK_OWNED_FINDINGS',independent:false,genuineBugbot:false,reviewKind:'BOUNDED_DISCLOSED_SAME_AGENT_ADVERSARIAL_FALLBACK',genuineBugbotAvailability:'No callable Bugbot/code-review service found in active tools. No new task, plugin, subagent or external message created to simulate independence.',MAINAcceptanceGranted:false,productionArtApprovalGranted:false,observedAtUtc:new Date().toISOString(),preservation,testEvidence:tests}
const review1={...common,checkpoint:1,scope:'Model/origin/exact-proof, viewport and pure Pixel metadata boundaries; native integrated keyboard behavior.',
 taskOwnedFindingsClosed:[
  {finding:'Mutable nested viewport constants',correction:'Recursively freeze exact source contract and test nested rectangles.'},
  {finding:'Old admitted view could remain while a new fixture admission resolves',correction:'Bind admitted/error state to the exact current fixture reference; stale results cannot render canonical authority.'},
  {finding:'Duplicate required content could be renamed with a lied declared identity',correction:'Check underlying static and ordered timed frame asset-hash signatures, not only capability names/declarations.'},
  {finding:'SHOW MORE locator compatibility and review panel hit target after integer fit',correction:'Preserve original prefix and cap/page using existing SHOW_MORE reducer; constrain diagnostic review panel without reducer/truth changes.'},
 ],
 boundedChecks:'30S5 tests exercise17 required false-success classes; original Lane C35 semantic tests and5 native integration checks remain separate. Source-derived blueprint verifies every reported before/after count against the frozen25, while the original reducer independently completes exact proof and receipt-review guards.',
 residuals:['Final art/geometry/acting timing pending','Optional title/banter/density late-bound','No actual AT certification or final full-journey MAIN acceptance','Intake does not decode PNG/verify authored recipe identity/authenticate approval signatures; future real-archive admission requires these checks'],
 implementationBindings:bind([...production,'tests/unit/s5-foundation.test.ts','tests/e2e/s5-integration.spec.ts','tests/fixtures/s5/art-index.ts'])}
const own=fs.readdirSync('scripts/nq5-s5').map(n=>'scripts/nq5-s5/'+n)
assert.ok(read('scripts/nq5-s5/package.mjs').includes("candidate.commit+' HEAD'"))
assert.ok(read('scripts/nq5-s5/package.mjs').includes("captures.length===8"))
assert.ok(read('scripts/nq5-s5/package.mjs').includes("primaryStatus()==='M AGENTS.md'"))
assert.ok(read('scripts/nq5-s5/packets.mjs').includes("status:'PREPARED_NOT_SENT'"))
const review2={...common,checkpoint:2,scope:'Governed admission, original preservation, bounded source/package recovery policy, test scopes and authority holds.',
 taskOwnedFindingsClosed:[
  {finding:'Linked .git pointer incompatible with inherited helper',correction:'New S5 helper resolves existing object path via Git; original helper and37 immutable additions unchanged.'},
  {finding:'Fresh root missing eight published regression inputs',correction:'Exact hash-pinned local redacted archives linked outside production/worktrees; no new retrieval/private campaign replay.'},
  {finding:'Native capture outputs trigger closed source scope',correction:'Only eight task-owned regenerated controller captures restored from accepted Git bytes; no Pixel art or Principal file touched.'},
  {finding:'Page test assumed proof count',correction:'Expected counts/summaries derived by original local dispatcher, not hand-authored seven-record assumption.'},
 ],
 policyChecks:['Exact standalone source/schema/count/preservation verification PASS','Original MAIN S4-R2 receipt binds accepted0f/98 rather than supplier promotion','15-file first Lane C cut exact; no historical merge','37Lane A,74 client entries and frozen25/truth unchanged','Principal quota-risk retirement is planning testimony, not fabricated calls or independent HTTP verification','Clean-root exception observes only primary path/status metadata; trusted Git AGENTS blobs separate','No message/task/provider call/art workspace inspection','Current34 and preserved15 suites unchanged; Lane C5 and integrated5 separately scoped','Future actual Pixel archive and exact art approval remain open'],
 deliveryExtensionRequired:'Final exact candidate/tree/bundle/diff, fresh1584 unit/acquisition+59browser, independently verified minimum unsent packets, privacy/object scan, ZIP roundtrip/determinism and12 tamper rejects are checked by sealed package execution and reported in final delivery extension; this pre-seal checkpoint does not assert them already executed.',
 implementationBindings:bind([...own,...EXTRA.filter(n=>!n.startsWith('src/')),'scripts/s5-preserved-browser.config.mjs','src/app/corpus-presentation/harness.tsx','tests/unit/lane-c/model.test.ts'])}
const falseSuccess=[
 ['Room-only viewport','locks the whole 480x270 game'],['Fractional/smoothed scale','rejects fractional/smoothed display scaling'],['Independent actor rescale','rejects fractional/smoothed display scaling'],['Baked text/evidence/state','rejects baked raster text/evidence'],
 ['Canonical/synthetic contamination','canonical gameplay requires full accepted fixture equality; keeps synthetic origin copy honest; rejects cross-kind tokens'],['Alter/drop/add frozen corpus','rejects altered/dropped/added frozen membership'],['CPP/account rows as gameplay','rejects quota-cpp frozen membership'],['Invented semantic counts','executes every beat count; invented reported count fails exact replay'],
 ['Undiscovered exact clues/cards','no undiscovered exact card/clue/value can be staged'],['Context/zero as exact proof','context/no-match IDs cannot fill exact slots'],['Wrong-theory dead end','pure Mistaken Investigator recoverable exact bounded ending and native accepted keyboard journey'],['Silent final creative/art binding','no final optional title/density/production clip/filename silently bound'],
 ['Historical Lane C merge','source verifier linear ancestry/no historical merge; exact original15 pins'],['Lane A/truth drift','37 immutable pins,74 compiled map, truth/corpus exact hashes and current34/preserved15 checks'],['External transport','global transport trap, process hold4before-transport rejections and native accepted request guard'],
 ['Unsafe/malformed/duplicate art index','intake malformed/unsafe-path/duplicate-asset/bad-order/bad-baseline/duplicate-required tests'],['Derivative inherits prior approval','intake derivative-approval and exact asset hash/member tamper tests'],
].map(([falseSuccessClass,executedCheck],i)=>({class:i+1,falseSuccessClass,executedCheck}))
assert.equal(falseSuccess.length,17)
for(const[n,x]of [['REVIEW_1.json',review1],['REVIEW_2.json',review2],['FALSE_SUCCESS_COVERAGE.json',{status:'PASS_FOR_EXECUTED_BOUNDED_FOUNDATION_CHECKS',classes:falseSuccess,tests}]] )fs.writeFileSync('artifacts/g6p-s5/REPORTS/'+n,JSON.stringify(x,null,2)+'\n')
console.log(JSON.stringify({status:'PASS',checkpoints:2,independent:false,genuineBugbot:false,requiredFalseSuccessClasses:17,MAINAcceptanceGranted:false}))
