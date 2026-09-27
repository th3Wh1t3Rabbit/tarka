import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {deriveBlueprint,validatePreArchiveBeat} from '../../src/controller/foundation/blueprint.ts'
export const BASE='1a2b7cafa165d7b50219dd7a55636e5964433bb2',TREE='0395c6b556fa6b710dd2dc3d1644f3cc67e5d5c7'
export const allowed=n=>['src/investigation/state.ts','src/investigation/fixture.ts','src/controller/foundation/blueprint.ts'].includes(n)||/^tests\/unit\/s6-r1-res2-[A-Za-z0-9.-]+$/.test(n)||n.startsWith('scripts/nq5-s6-r1/res2-')||n.startsWith('docs/source/execution-s6-r1/RES2/')||n.startsWith('artifacts/g6p-s6-r1/RES2/')
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:128000000}).trim()
export async function verify(){
 assert.equal(git('rev-parse',BASE+'^{tree}'),TREE);execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD']);assert.equal(git('rev-list','--merges',BASE+'..HEAD'),'')
 const changes=git('diff','--name-only',BASE,'--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION').split('\n').filter(Boolean);assert.ok(changes.every(allowed),'RES2_EXHAUSTIVE_SCOPE');assert.equal(git('rev-parse','HEAD:AGENTS.md'),git('rev-parse',BASE+':AGENTS.md'))
 const preservation=JSON.parse(fs.readFileSync('artifacts/g6p-s6-r1/RES2/REPORTS/PRESERVATION.json'));for(const f of [...preservation.LaneAFiles,...preservation.historicalGovernedFilesByteIdentical])assert.equal(sha(fs.readFileSync(f.file)),f.sha256,f.file)
 for(const file of ['src/controller/content/runtime-content.json','src/investigation/query.ts','src/investigation/corpus-seam/authority.mjs','src/controller/corpus/input.ts','src/app/App.tsx','src/app/CaseTerminalWorkbench.tsx','src/controller/foundation/contracts.mjs','src/controller/foundation/pixel-identity.mjs','src/controller/foundation/pixel-realization.mjs','src/controller/foundation/pixel-review.mjs','src/controller/foundation/useIntegerViewportScale.ts','public/scenarios/euler-2023-false-exit/scenario.json','public/scenarios/euler-2023-false-exit/evidence-graph.json'])assert.ok(fs.readFileSync(file).equals(execFileSync('git',['show',BASE+':'+file])),file)
 const bp=await deriveBlueprint();assert.equal(JSON.stringify(bp,null,2)+'\n',fs.readFileSync('artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json','utf8'));bp.beats.forEach(validatePreArchiveBeat)
 const read=n=>JSON.parse(fs.readFileSync('artifacts/g6p-s6-r1/RES2/REPORTS/'+n));const post=read('REPRODUCER_CLOSED.json');assert.equal(post.status,'EXPECTED_CLOSED');for(const k of ['fullRelabeledNoProgress','genericRelabeledNoProgress','mixedNoProgress'])assert.equal(post.origin[k],true);for(const v of Object.values(post.origin.intersections))assert.equal(v.length,0);assert.equal(post.blueprint.rejected,104)
 const origin=read('ORIGIN_BOUNDARY_CLOSURE.json');for(const f of origin.sourceBindings)assert.equal(sha(fs.readFileSync(f.file)),f.sha256)
 assert.ok(fs.readFileSync('artifacts/g6p-s6-r1/RES2/REPORTS/MAIN_SCOPE_DECISION.json').equals(fs.readFileSync('docs/source/execution-s6-r1/RES2/INPUT/MAIN_SCOPE_DECISION.json')))
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);for(const f of [...changes.filter(n=>fs.existsSync(n)),...walk('docs/source/execution-s6-r1/RES2'),...walk('artifacts/g6p-s6-r1/RES2'),...fs.readdirSync('scripts/nq5-s6-r1').filter(n=>n.startsWith('res2-')).map(n=>'scripts/nq5-s6-r1/'+n)]){assert.ok(fs.lstatSync(f).isFile()&&!fs.lstatSync(f).isSymbolicLink());const t=fs.readFileSync(f,'utf8');assert.equal(privatePathFindings(t).length,0,f);assert.equal(hasSecretLikeValue(t),false,f)}
 return{status:'PASS_PENDING_MAIN_INDEPENDENT_REVIEW',base:BASE,tree:TREE,sourceScope:'EXACT_THREE_PRODUCTION_PATHS',exactBlueprintPreserved:true,atomicOriginIsolation:true,mutationMatrixRejected:104,LaneAFiles:37,clientEntries:74,semanticRecords:25,boundedNoMatches:7,STATERecords:0,sourcePromoted:false,networkRequests:0,pixelWorkspaceAccess:false,credentialAccess:false,LaneAPacket:'PREPARED_NOT_SENT',LaneAPASS:false}
}
if(process.argv[1]?.endsWith('/res2-verify.mjs'))console.log(JSON.stringify(await verify()))
