import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'s6-reproducer-')),file='S5_R1_REALIZATION_EQUIVALENCE_REPRODUCER.mjs'
fs.copyFileSync(path.join(root,'docs/source/execution-s6/INPUT/MAIN',file),path.join(tmp,file));fs.symlinkSync(root,path.join(tmp,'repo'),'dir')
const v=JSON.parse(execFileSync('node',[path.join(tmp,file)],{cwd:tmp,env:{...process.env,NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs')},encoding:'utf8'}))
assert.equal(v.status,'REJECTED');assert.equal(v.accepted,false);assert.ok(v.error.includes('S5_DUPLICATE_REQUIRED_CONTENT'))
const before=JSON.parse(fs.readFileSync('artifacts/g6p-s6/BASELINE/REALIZATION_EQUIVALENCE.json'))
for(const k of ['originalClipIdentity','clonedClipIdentity','originalCapabilityIdentity','clonedCapabilityIdentity'])assert.equal(v[k],before[k],k)
console.log(JSON.stringify({status:'PASS',suppliedScriptUnmodified:true,baselineStatus:before.status,corrected:v,exactApprovalIdentitiesUnchanged:true,networkRequests:0},null,2))
