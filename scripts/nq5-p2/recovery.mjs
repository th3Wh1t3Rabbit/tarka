import {identity,sha} from '../nq5/schema.mjs'
import {captureSafeHeaders} from '../nq5-b1-r1/headers.mjs'
import {normalize} from './admission.mjs'
import {consume} from './consumers.mjs'
import {supportRecord} from './audit.mjs'
import {COUNTER} from './admission.mjs'

export function validateHistoricalCanary(c,state){
 const ids=c.plans.plan.canaryLogicalIds,families=new Set()
 if(ids.length!==8||new Set(ids).size!==8)throw new Error('P2_REPRESENTATIVE_CANARY')
 for(const id of ids){const q=c.plans.plan.requests.find(x=>x.logicalId===id),t=state.terminals.get(id),row=t&&state.responses.get(id+'.'+t.attempt)
  if(!q||!t||t.disposition!=='SUCCESS_COUNTED'||t.auditDisposition!=='PASS'||!row||row.httpStatus!==200||row.actualCredits!==q.expectedCredits||row.quotedCredits!==q.expectedCredits||!row.providerRequestId)throw new Error('P2_CANARY_NOT_DURABLE_SUPPORTED')
  families.add(q.family)
 }
 if(c.plans.plan.requests.some(q=>q.family===COUNTER)&&!families.has(COUNTER))throw new Error('P2_REPRESENTATIVE_CANARY')
 return true
}

// Read-only, per-call recovery. Durable journal facts and supplier numbering
// survive unavailable bodies; only independently reproduced projections qualify.
export function recoverProjections(c,state,terminals,qs,rawFor,{independent=false}={}){
 const projections=[],failures=new Map(state.rawRecoveryFailures??[]);let counted=0
 for(const t of terminals){const q=qs.get(t.logicalId),row=state.responses.get(t.logicalId+'.'+t.attempt)
  if(t.disposition!=='SUCCESS_COUNTED'){if(t.publicRecord!==null)throw new Error('P2_FAILURE_PUBLIC_ROW');continue}
  const supplierSequence=22+counted++
  try{
   if(failures.has(t.logicalId))throw new Error(failures.get(t.logicalId))
   if(!row||row.httpStatus!==200||row.actualCredits!==q.expectedCredits||row.quotedCredits!==q.expectedCredits||!row.providerRequestId||row.providerRequestId!==row.headers['x-request-id']||identity(captureSafeHeaders(row.headers))!==identity(row.headers)||t.auditDisposition!=='PASS')throw new Error('P2_TERMINAL_CREDIT_PROVIDER')
   const bytes=rawFor(row);if(bytes.length!==row.rawBytes||sha(bytes)!==row.rawSha256)throw new Error('P2_SUPPORT_RAW')
   const n=normalize(q,bytes,c.admission,c.truth),consumers=consume(c,q,n,row)
   if(n.normalizedSha256!==t.normalizedSha256||n.resultCount!==t.resultCount||identity(supportRecord(c,q,row,n,supplierSequence))!==identity(t.publicRecord))throw new Error('P2_TERMINAL_SEMANTIC_REDERIVATION')
   projections.push({logicalId:q.logicalId,request:q,normalized:n,consumers,terminal:t,response:row})
  }catch(err){if(!independent)throw err;failures.set(t.logicalId,'P2_R1_INDIVIDUAL_SUPPORT_NOT_REPRODUCED')}
 }
 return {projections,failures,counted}
}

// Exact archived metadata must match all current durable records. A failed body
// can change only its derived support fields, never observed receipt or charges.
export function compareReplayAudit(audit,historical,failures){
 const current=structuredClone(audit),old=structuredClone(historical)
 for(const p of current.p2Records){if(!failures.has(p.request.logicalId))continue;const h=old.p2Records.find(x=>x.request.logicalId===p.request.logicalId)
  if(!h)throw new Error('P2_R1_RECOVERY_UNKNOWN_ARCHIVED_CALL')
  for(const k of ['localSupportCandidate','runtimeEvidenceProven','normalizedSha256','resultCount','emptyResultRole'])p[k]=h[k]
 }
 if(identity(current)!==identity(old))throw new Error('P2_R1_CURRENT_DURABLE_AUDIT_ARCHIVE_MISMATCH')
 return identity(old)
}
