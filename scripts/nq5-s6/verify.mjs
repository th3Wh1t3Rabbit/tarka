import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {deriveBlueprint} from '../../src/controller/foundation/blueprint.ts'
export const BASE='f74a569c959158b25f56c10cc07c625c202f43cc',TREE='bf91c31308492c8e4fc68cd23bd8a75168d3835d'
export const allowed=n=>/^src\/controller\/foundation\/pixel-[A-Za-z0-9.-]+$/.test(n)||n==='src/controller/foundation/contracts.mjs'||/^tests\/unit\/s6-[A-Za-z0-9.-]+$/.test(n)||['scripts/nq5-s6/','artifacts/g6p-s6/','docs/source/execution-s6/'].some(p=>n.startsWith(p))
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:128000000}).trim()
export async function verify(){
 assert.equal(git('rev-parse',BASE+'^{tree}'),TREE);execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD']);assert.equal(git('rev-list','--merges',BASE+'..HEAD'),'')
 const changes=git('diff','--name-only',BASE,'--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION').split('\n').filter(Boolean);assert.ok(changes.every(allowed),'S6_SOURCE_BOUNDARY')
 assert.equal(git('rev-parse','HEAD:AGENTS.md'),git('rev-parse',BASE+':AGENTS.md'));assert.equal(git('diff',BASE,'HEAD','--','AGENTS.md'),'')
 for(const file of ['src/controller/foundation/pixel-identity.mjs','src/controller/foundation/pixel-identity.d.mts'])assert.ok(fs.readFileSync(file).equals(execFileSync('git',['show',BASE+':'+file])),'ACCEPTED_APPROVAL_IDENTITY_UNCHANGED')
 const original=execFileSync('git',['show',BASE+':src/controller/foundation/contracts.mjs'],{encoding:'utf8'})
 const expected=original.replace("import {clipDefinitionSha256,capabilityContentSha256} from './pixel-identity.mjs'","import {clipDefinitionSha256,capabilityContentSha256} from './pixel-identity.mjs'\nimport {capabilityRealizationSha256} from './pixel-realization.mjs'").replace("  if(c.required && requiredContent.has(computedIdentity)) fail('DUPLICATE_REQUIRED_CONTENT')\n  if(c.required)requiredContent.add(computedIdentity);caps.add(c.id)","  // S6 user-approved scope exception: only duplicate realization, never approval.\n  const realizationIdentity=c.required?capabilityRealizationSha256(c,x.assets,x.clips):null\n  if(c.required && requiredContent.has(realizationIdentity)) fail('DUPLICATE_REQUIRED_CONTENT')\n  if(c.required)requiredContent.add(realizationIdentity);caps.add(c.id)")
 assert.equal(fs.readFileSync('src/controller/foundation/contracts.mjs','utf8'),expected,'EXACT_NARROW_SCOPE_EXCEPTION')
 const p=JSON.parse(fs.readFileSync('artifacts/g6p-s5/REPORTS/PRESERVATION.json'))
 for(const f of [...p.preservedFiles,...p.laneAFiles])assert.equal(sha(fs.readFileSync(f.file)),f.sha256,f.file);assert.equal(p.laneAFiles.length,37)
 assert.equal(sha(fs.readFileSync('src/controller/content/runtime-content.json')),'57f27ecfef64f9c149f2f80bdb1efffbc629d79fd5f6a76e21c0e943c5c95bfc');assert.equal(Object.keys(JSON.parse(fs.readFileSync('src/controller/content/runtime-content.json')).entries).length,74)
 const bp=await deriveBlueprint();assert.equal(canonical(bp),canonical(JSON.parse(fs.readFileSync('artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json'))));assert.equal(bp.beats.length,24);assert.equal(bp.semanticTotal,25);assert.equal(bp.boundedNoMatches,7);assert.equal(bp.beats.find(b=>b.id==='LENS.STATE').acceptedCorpus.after.count,0)
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
 for(const file of [...changes.filter(f=>fs.existsSync(f)),...walk('scripts/nq5-s6'),...walk('artifacts/g6p-s6'),...walk('docs/source/execution-s6')]){const s=fs.lstatSync(file);assert.ok(s.isFile()&&!s.isSymbolicLink());const text=fs.readFileSync(file,'utf8');assert.equal(privatePathFindings(text).length,0,file);assert.equal(hasSecretLikeValue(text),false,file)}
 return {status:'PASS',reviewedBase:BASE,reviewedTree:TREE,sourceException:'USER_AUTHORIZED_EXACT_IMPORT_AND_DUPLICATE_SET_ONLY',approvalIdentityChanged:false,LaneAFiles:37,clientEntries:74,canonicalRecords:25,boundedNoMatches:7,STATERecords:0,beats:24,gameplayAndLaneSourceChanges:0,externalNetworkRequests:0,productionArtApproved:false}
}
if(process.argv[1]?.endsWith('/verify.mjs'))console.log(JSON.stringify(await verify()))
