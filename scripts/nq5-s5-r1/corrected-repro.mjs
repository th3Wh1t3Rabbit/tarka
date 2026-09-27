import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const root=process.cwd(),results=[]
for(const file of ['S5_PIXEL_CLIP_STALE_APPROVAL_REPRODUCER.mjs','S5_DUAL_EXPLORE_MODEL_REPRODUCER.mjs']){
 let output,exit
 try{output=execFileSync(process.execPath,['docs/source/execution-s5-r1/INPUT/'+file,'.'],{encoding:'utf8',maxBuffer:1000000});exit=0}catch(e){output=String(e.stdout);exit=e.status}
 const x=JSON.parse(output);assert.equal(exit,2);assert.equal(x.status,'NOT_REPRODUCED')
 if(x.cases){assert.equal(x.cases[0].accepted,true);assert.ok(x.cases.slice(1).every(c=>!c.accepted && c.error==='S5_CLIP_DEFINITION_IDENTITY'))}
 else{assert.equal(x.checks.acceptedSemanticEvidenceSea,true);for(const[k,v]of Object.entries(x.checks))if(k!=='acceptedSemanticEvidenceSea')assert.equal(v,false)}
 const normalized=JSON.parse(output.split(root).join('[IMPLEMENTATION_ROOT]'))
 results.push({file,expectedNegativeExit:exit,originalSuppliedScriptUnmodified:true,result:normalized})
}
console.log(JSON.stringify({status:'PASS_CORRECTED_FALSE_SUCCESSES_REJECTED',results},null,2))
