import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {sha} from '../nq5-s2/activity.mjs'
export function laneContractFixture(root=process.cwd()){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'s4-lane-contract-')),base='a1bf6689b9ba6a3c7077869ee03be1926b2e1c41',git=(args,input)=>execFileSync('git',args,{cwd:temp,input,maxBuffer:128000000})
 git(['init','--quiet']);fs.mkdirSync(temp+'/.git/objects/info',{recursive:true});fs.writeFileSync(temp+'/.git/objects/info/alternates',path.join(root,'.git/objects')+'\n');git(['read-tree',base])
 const names=git(['ls-files','-z','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION']);git(['update-index','--skip-worktree','-z','--stdin'],names)
 const patch=fs.readFileSync(path.join(root,'docs/source/execution-s4/LANE_A_ACCEPTED_PACKAGE/handoff/lane-a-exact.patch'),'utf8')
 assert.equal(sha(patch),'bed005d4d4475aa1934f963919ba42b95890c1cedd6a3ca36f50717466464ae5')
 const paths=[...patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map(m=>m[1]);assert.equal(paths.length,37)
 for(const n of paths){assert.ok(/^(content\/parallel\/narrative|docs\/parallel\/lane-a|tests\/unit\/parallel\/narrative-contract)\//.test(n));fs.mkdirSync(path.dirname(temp+'/'+n),{recursive:true});fs.copyFileSync(path.join(root,n),temp+'/'+n)}
 for(const n of ['src/adventure/narrative.ts','src/adventure/content.ts','src/investigation/state.ts']){const bytes=execFileSync('git',['show',base+':'+n],{cwd:root,maxBuffer:128000000});fs.mkdirSync(path.dirname(temp+'/'+n),{recursive:true});fs.writeFileSync(temp+'/'+n,bytes)}
 return {root:temp,authority:'IMMUTABLE_ACCEPTED_LANE_A_ONLY_37_ADDITIONS_AND_ORIGINAL_BASE_PATH_CHECK',originalSourceRewritten:false,integratedControllerScopeCheckedSeparately:true}
}
if(process.argv[1]?.endsWith('lane-fixture.mjs'))console.log(JSON.stringify(laneContractFixture()))
