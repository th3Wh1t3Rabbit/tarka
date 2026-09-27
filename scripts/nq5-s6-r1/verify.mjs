import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {deriveBlueprint} from '../../src/controller/foundation/blueprint.ts'
export const BASE='04e1f3337f576496018929a05b8a65cf6ebf4d99',TREE='a9c59f628ec5b320e19f97342352e537f02250fc'
export const allowed=n=>['scripts/nq5-s6-r1/','artifacts/g6p-s6-r1/','docs/source/execution-s6-r1/'].some(p=>n.startsWith(p))
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:128000000}).trim()
export async function verify(){
 assert.equal(git('rev-parse',BASE+'^{tree}'),TREE);execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD']);assert.equal(git('rev-list','--merges',BASE+'..HEAD'),'')
 const changes=git('diff','--name-only',BASE,'--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION').split('\n').filter(Boolean);assert.ok(changes.every(allowed),'EVIDENCE_ONLY_NO_PRODUCTION_SCOPE_EXPANSION')
 assert.equal(git('rev-parse','HEAD:AGENTS.md'),git('rev-parse',BASE+':AGENTS.md'));assert.equal(git('diff',BASE,'HEAD','--','AGENTS.md'),'')
 const p=JSON.parse(fs.readFileSync('artifacts/g6p-s5/REPORTS/PRESERVATION.json'));for(const f of [...p.preservedFiles,...p.laneAFiles])assert.equal(sha(fs.readFileSync(f.file)),f.sha256,f.file);assert.equal(p.laneAFiles.length,37)
 assert.equal(sha(fs.readFileSync('src/controller/content/runtime-content.json')),'57f27ecfef64f9c149f2f80bdb1efffbc629d79fd5f6a76e21c0e943c5c95bfc');assert.equal(Object.keys(JSON.parse(fs.readFileSync('src/controller/content/runtime-content.json')).entries).length,74)
 for(const file of ['src/controller/foundation/contracts.mjs','src/controller/foundation/pixel-identity.mjs','src/controller/foundation/pixel-identity.d.mts','src/controller/foundation/pixel-realization.mjs','src/controller/foundation/pixel-realization.d.mts','src/controller/foundation/pixel-review.mjs','src/controller/foundation/pixel-review.d.mts','src/controller/foundation/blueprint.ts','src/investigation/state.ts','src/investigation/fixture.ts','artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json','artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.md'])assert.ok(fs.readFileSync(file).equals(execFileSync('git',['show',BASE+':'+file])),'UNCHANGED_PRODUCTION_OR_BASELINE '+file)
 const bp=await deriveBlueprint();assert.equal(canonical(bp),canonical(JSON.parse(fs.readFileSync('artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json'))));assert.equal(bp.beats.length,24);assert.equal(bp.semanticTotal,25);assert.equal(bp.boundedNoMatches,7);assert.equal(bp.beats.find(b=>b.id==='LENS.STATE').acceptedCorpus.after.count,0)
 assert.ok(fs.readFileSync('artifacts/g6p-s6-r1/REPORTS/SYNTHETIC_AUTHORITY_SCOPE_DECISION.json').equals(fs.readFileSync('docs/source/execution-s6-r1/INPUT/SYNTHETIC_AUTHORITY_SCOPE_DECISION.json')),'EXACT_MAIN_SCOPE_DECISION')
 const state=JSON.parse(fs.readFileSync('artifacts/g6p-s6-r1/REPORTS/GATE_STATUS.json'));assert.equal(state.status,'BLOCKED_WITH_EVIDENCE');assert.equal(state.blueprintRemediationCompleted,false);assert.equal(state.LaneAPacketPrepared,false)
 const diag=JSON.parse(fs.readFileSync('artifacts/g6p-s6-r1/REPORTS/SYNTHETIC_NO_BRIDGE_DIAGNOSTIC.json'));assert.equal(diag.directReducerCrossFixture.complete,true);assert.equal(diag.normalSaveCrossFixture.rejected,true);assert.equal(diag.productionFixApplied,false)
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);for(const file of ['scripts/nq5-s6-r1','artifacts/g6p-s6-r1','docs/source/execution-s6-r1'].flatMap(walk)){const s=fs.lstatSync(file);assert.ok(s.isFile()&&!s.isSymbolicLink());const text=fs.readFileSync(file,'utf8');assert.equal(privatePathFindings(text).length,0,file);assert.equal(hasSecretLikeValue(text),false,file)}
 return {status:'PASS_EVIDENCE_ONLY_BOUNDARY_NOT_GATE_COMPLETION',reviewedStart:BASE,reviewedTree:TREE,productionChanges:0,blueprintP1Closed:false,syntheticBridgeInvariantPassed:false,LaneAFiles:37,clientEntries:74,canonicalRecords:25,boundedNoMatches:7,STATERecords:0,beats:24,sourcePromoted:false,externalNetworkRequests:0}
}
if(process.argv[1]?.endsWith('/verify.mjs'))console.log(JSON.stringify(await verify()))
