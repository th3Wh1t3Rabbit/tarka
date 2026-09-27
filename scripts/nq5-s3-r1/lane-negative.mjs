import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,identity} from '../nq5-s2/activity.mjs'
const source='artifacts/g6p-s3-r1/LANE_C_PREPARED_NOT_SENT',temp=fs.mkdtempSync(path.join(os.tmpdir(),'s3r1-lane-negative-'))
for(const n of fs.readdirSync(source))fs.copyFileSync(source+'/'+n,temp+'/'+n)
const names=fs.readdirSync(temp).filter(n=>n!=='MANIFEST.sha256').sort(),manifest=temp+'/MANIFEST.sha256',rehash=()=>fs.writeFileSync(manifest,names.map(n=>sha(fs.readFileSync(temp+'/'+n))+'  '+n).join('\n')+'\n')
let rejected=0
for(const[name,change]of [
 ['resealed_question',x=>{const r=x.displayRecords[0];r.question='Fabricated';const{id,identity:h,...body}=r,hash=identity(body);x.displayRecords[0]={id:'SEMANTIC.'+hash,identity:hash,...body}}],
 ['substituted_record',x=>{const r=x.displayRecords[0];r.conceptId='CONCEPT.'+'0'.repeat(64);const{id,identity:h,...body}=r,hash=identity(body);x.displayRecords[0]={id:'SEMANTIC.'+hash,identity:hash,...body}}],
 ['stripped_audit',x=>{delete x.auditReferences[0].provenance}],
 ['dropped_record',x=>{x.displayRecords.pop()}],
 ['freeze',x=>{x.interfaceFrozen=true}],
 ['activation',x=>{x.LaneCActive=true}]
]){
 const n='TE_IFACE_CORPUS_FINAL_CANDIDATE.json',file=temp+'/'+n,b=fs.readFileSync(file),m=fs.readFileSync(manifest)
 try{const x=JSON.parse(b);change(x);const{identity:h,...body}=x;x.identity=identity(body);fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n');rehash();let error='';try{execFileSync(process.execPath,[temp+'/VERIFY_LANE_C.mjs'],{stdio:'pipe'})}catch(e){error=String(e.stderr)}assert.ok(error.includes('S3_CANDIDATE_'),name+' must fail actual full admission before content pinning');rejected++}
 finally{fs.writeFileSync(file,b);fs.writeFileSync(manifest,m)}
}
const file=temp+'/LANE_C_LAUNCH_CONTRACT.json',b=fs.readFileSync(file),m=fs.readFileSync(manifest)
try{const x=JSON.parse(b);x.ownedPaths.push('src/investigation/');const{identity:h,...body}=x;x.identity=identity(body);fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n');rehash();assert.throws(()=>execFileSync(process.execPath,[temp+'/VERIFY_LANE_C.mjs'],{stdio:'pipe'}));rejected++}finally{fs.writeFileSync(file,b);fs.writeFileSync(manifest,m)}
execFileSync(process.execPath,[temp+'/VERIFY_LANE_C.mjs'],{stdio:'pipe'})
console.log(JSON.stringify({status:'PASS',resealedRehashedPacketRejections:rejected,fullAdmissionRejectionsBeforeContentPins:6,packetsSent:false,LaneCActive:false}))
