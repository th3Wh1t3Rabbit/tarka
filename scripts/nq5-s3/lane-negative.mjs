import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,identity} from '../nq5-s2/activity.mjs'
const source='artifacts/g6p-s3/LANE_C_PREPARED_NOT_SENT',temp=fs.mkdtempSync(path.join(os.tmpdir(),'s3-lane-negative-'))
for(const n of fs.readdirSync(source)){const s=fs.lstatSync(source+'/'+n);assert.ok(s.isFile()&&!s.isSymbolicLink());fs.copyFileSync(source+'/'+n,temp+'/'+n)}
const manifest=temp+'/MANIFEST.sha256',names=fs.readdirSync(temp).filter(n=>n!=='MANIFEST.sha256')
const rehash=()=>fs.writeFileSync(manifest,names.sort().map(n=>sha(fs.readFileSync(temp+'/'+n))+'  '+n).join('\n')+'\n')
let rejects=0
for(const[n,change]of [
 ['TE_IFACE_CORPUS_FINAL_CANDIDATE.json',x=>{x.displayRecords[0].endpoint='SYNTHETIC'}],
 ['TE_IFACE_CORPUS_FINAL_CANDIDATE.json',x=>{delete x.auditReferences[0].provenance}],
 ['TE_IFACE_CORPUS_FINAL_CANDIDATE.json',x=>{x.interfaceFrozen=true}],
 ['LANE_C_LAUNCH_CONTRACT.json',x=>{x.ownedPaths.push('src/investigation/')}],
 ['LANE_C_LAUNCH_CONTRACT.json',x=>{x.LaneCActive=true}],
 ['LANE_C_LAUNCH_CONTRACT.json',x=>{x.packetsSent=true}]
]){
 const original=fs.readFileSync(temp+'/'+n),old=fs.readFileSync(manifest)
 try{const x=JSON.parse(original);change(x);const{identity:h,...body}=x;x.identity=identity(body);fs.writeFileSync(temp+'/'+n,JSON.stringify(x,null,2)+'\n');rehash();assert.throws(()=>execFileSync(process.execPath,[temp+'/VERIFY_LANE_C.mjs'],{stdio:'pipe'}));rejects++}
 finally{fs.writeFileSync(temp+'/'+n,original);fs.writeFileSync(manifest,old)}
}
execFileSync(process.execPath,[temp+'/VERIFY_LANE_C.mjs'],{stdio:'pipe'})
console.log(JSON.stringify({status:'PASS',rehashedResealedLaneFalseSuccessRejections:rejects,packetsSent:false,LaneCActive:false}))
