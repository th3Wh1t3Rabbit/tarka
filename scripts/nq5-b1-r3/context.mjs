import fs from 'node:fs'
import path from 'node:path'
import { identity, sha } from '../nq5/schema.mjs'
import { preservedCheckpoint, CONSUMED, LEDGER_SHA } from '../nq5-b1-r1/checkpoint.mjs'
import { replay, readMirrored } from '../nq5-b1/store.mjs'
import { configuredCampaignRoots } from '../nq5-r3/genesis.mjs'
import { preservedReplay } from '../nq5-b1-r2/replay.mjs'
import { priorEvidence, sourceBinding, PINS } from './authority.mjs'
import { acceptedTruth, profile, plans } from './compatibility.mjs'

export function publicContext(root){const bound=sourceBinding(root),accepted=priorEvidence(root),oldProfile=JSON.parse(accepted.bytes['CONTRACTS/ADDRESS_TRANSACTIONS_NULL_COMPATIBILITY_PROFILE.json']),truth=acceptedTruth(root),p=profile(bound,oldProfile,truth);return {root,bound,accepted,oldProfile,truth,profile:p,plans:plans(bound,p),auditSchema:JSON.parse(fs.readFileSync(path.join(root,'schemas/NANSEN_API_REQUEST_AUDIT.schema.json')))}}
export function privateContext(root,{postLive=false}={}){
 const context=publicContext(root);let original
 if(!postLive)original=preservedCheckpoint(root)
 else{
  const roots=configuredCampaignRoots().map(r=>path.join(r,context.bound.envelope.campaignId)),current=replay(roots,context.bound.envelope),bytes=readMirrored(roots,'qualification.jsonl'),prefix=bytes.subarray(0,4659)
  if(prefix.length!==4659||sha(prefix)!==LEDGER_SHA||prefix.at(-1)!==10)throw new Error('R3_ORIGINAL_PREFIX_IDENTITY')
  const rows=JSON.parse('['+prefix.toString('utf8').trimEnd().split('\n').join(',')+']'),prior={rows,starts:new Map([...current.starts].filter(([,r])=>CONSUMED.includes(r.logicalId))),responses:new Map([...current.responses].filter(([,r])=>CONSUMED.includes(r.logicalId))),terminals:new Map([...current.terminals].filter(([,r])=>CONSUMED.includes(r.logicalId))),bytes:4659,bytesSha256:LEDGER_SHA}
  original={roots,prior,diagnostic:{originalLockSha256:sha(readMirrored(roots,'B1_EXECUTION_LOCK.json'))}}
 }
 Object.assign(context,{roots:original.roots,prior:original.prior,diagnostic:original.diagnostic})
 if(context.diagnostic.originalLockSha256!=='331729a7393cf20a2d50533ef267b70102eef18fd4e892f43d44a0fb649edb37')throw new Error('R3_ORIGINAL_LOCK_IDENTITY')
 context.originalStateHashes={'genesis.json':context.bound.genesis.primaryGenesisSha256,'GENESIS_COMMIT.json':context.bound.genesis.primaryCommitSha256}
 for(const [n,h]of Object.entries(context.originalStateHashes))if(sha(readMirrored(context.roots,n))!==h)throw new Error('R3_GENESIS_IDENTITY')
 const originalReplay=preservedReplay(context,{transaction:context.oldProfile,historical:JSON.parse(context.accepted.bytes['CONTRACTS/HISTORICAL_BALANCE_TEMPORAL_PROFILE.json'])})
 if(sha(Buffer.from(JSON.stringify(originalReplay,null,2)+'\n'))!==PINS['EVIDENCE/PRESERVED_RAW_COMPATIBILITY_REPLAY.json'][0])throw new Error('R3_EXACT_R2_REPLAY_IDENTITY')
 return context
}
