import fs from 'node:fs'
import path from 'node:path'
import { identity, sha } from '../nq5/schema.mjs'
import { configuredCampaignRoots } from '../nq5-r3/genesis.mjs'
import { readMirrored } from '../nq5-b1/store.mjs'
import { IDS } from '../nq5-b1-r3/authority.mjs'
import { assertPrivateAncestry, assertRawInventory } from '../nq5-b1-r3/gate-proof.mjs'
import { captureSafeHeaders } from '../nq5-b1-r1/headers.mjs'
import { LEDGER_SHA } from './authority.mjs'
export function reopen(a,{additionalAllowedFiles=[]}={}){
 if(!Array.isArray(additionalAllowedFiles)||additionalAllowedFiles.length>1||additionalAllowedFiles.some(n=>n!=='T1_B2_EXECUTION_LOCK.json'))throw new Error('R31_UNAUTHORIZED_INVENTORY_EXTENSION')
 const c=a.context,envelope=c.bound.envelope,roots=configuredCampaignRoots().map(r=>path.join(r,envelope.campaignId));assertPrivateAncestry(roots)
 const bytes=readMirrored(roots,'qualification.jsonl');if(bytes.length!==32547||sha(bytes)!==LEDGER_SHA||sha(bytes.subarray(0,4659))!=='fb4331def4c1115ee85dafc2f8c104442b27659eb3d2fa7462903506578f27d5'||bytes.at(-1)!==10)throw new Error('R31_PRIVATE_LEDGER_IDENTITY')
 const rows=bytes.toString('utf8').trimEnd().split('\n').map(l=>JSON.parse(l)),starts=new Map(),responses=new Map(),terminals=new Map();let previous=sha(Buffer.alloc(0))
 for(const[r,i]of rows.map((r,i)=>[r,i])){const{hash,...payload}=r;if(identity(payload)!==hash||r.previous!==previous||r.sequence!==i+1||r.envelopeHash!==envelope.hash||r.campaignId!==envelope.campaignId)throw new Error('R31_LEDGER_CHAIN');previous=hash;const map=r.kind==='START'?starts:r.kind==='RESPONSE'?responses:r.kind==='TERMINAL'?terminals:null,key=r.kind==='TERMINAL'?r.logicalId:r.logicalId+'.'+r.attempt;if(!map||map.has(key))throw new Error('R31_LEDGER_EVENT');map.set(key,r)}
 if(starts.size!==6||responses.size!==6||terminals.size!==6||[...responses.values()].some(r=>r.httpStatus!==200||r.actualCredits!==1)||[...terminals.values()].filter(r=>r.disposition==='SUCCESS_COUNTED').length!==4)throw new Error('R31_CAMPAIGN_ACCOUNTING')
 const privateHashes={'qualification.jsonl':sha(bytes)},genesis=c.bound.genesis
 for(const[n,h]of Object.entries({'B1_EXECUTION_LOCK.json':'331729a7393cf20a2d50533ef267b70102eef18fd4e892f43d44a0fb649edb37','genesis.json':genesis.primaryGenesisSha256,'GENESIS_COMMIT.json':genesis.primaryCommitSha256})){const b=readMirrored(roots,n);if(sha(b)!==h)throw new Error('R31_PRIVATE_FOUNDATION_CHANGED');privateHashes[n]=h}
 const resume=a.objects['EXECUTION/T1_B1_R3_RESUME_ENVELOPE.json'],lockBytes=readMirrored(roots,'B1_R3_RESUME_LOCK.json'),lock=JSON.parse(lockBytes);if(lock.resumeEnvelopeHash!==resume.hash||lock.campaignId!==envelope.campaignId||lock.implementationSha256!==resume.implementationSha256||identity(lock.candidate)!==identity(resume.candidate))throw new Error('R31_RESUME_LOCK');privateHashes['B1_R3_RESUME_LOCK.json']=sha(lockBytes)
 const names=[...responses.values()].map(r=>r.rawName);assertRawInventory(roots,names);const expected=['B1_EXECUTION_LOCK.json','B1_R3_RESUME_LOCK.json','GENESIS_COMMIT.json','genesis.json','qualification.jsonl','raw-b1',...additionalAllowedFiles].sort().join();for(const root of roots)if(fs.readdirSync(root).sort().join()!==expected)throw new Error('R31_PRIVATE_INVENTORY')
 const calls=IDS.map(id=>{const request=c.bound.plan.requests.find(r=>r.logicalId===id),start=starts.get(id+'.1'),response=responses.get(id+'.1'),terminal=terminals.get(id),audit=a.objects['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json'].records.find(r=>r.logicalId===id),raw=readMirrored(roots,'raw-b1/'+response.rawName)
  if(raw.length!==response.rawBytes||sha(raw)!==response.rawSha256||response.providerRequestId!==response.headers['x-request-id']||identity(captureSafeHeaders(response.headers))!==identity(response.headers)||start.requestBodySha256!==identity(request.body)||terminal.normalizedSha256!==audit.normalizedIdentity||terminal.resultCount!==audit.admittedResultCount||audit.attempts[0].primarySha256!==response.rawSha256||audit.attempts[0].provider_request_id!==response.providerRequestId||terminal.publicRecord.campaign_id!=='NQ5'||terminal.auditDisposition!=='PASS')throw new Error('R31_CALL_BINDING')
  return {request,start,response,terminal,audit,raw}
 })
 if(new Set(calls.map(r=>r.response.providerRequestId)).size!==4||calls[0].terminal.sequence!==11||calls[1].terminal.sequence!==12||calls[2].start.sequence!==13||calls[3].start.sequence!==14)throw new Error('R31_CANARY_ORDER')
 return {roots,rows,starts,responses,terminals,calls,privateHashes,identity:identity({privateHashes,raw: calls.map(r=>[r.response.rawSha256,r.raw.length])})}
}
