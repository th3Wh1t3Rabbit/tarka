import { identity } from '../nq5/schema.mjs'
import { logicalRequest } from '../nq5/planner.mjs'
import { structuralSchema } from '../nq5-b1-r1/diagnostic.mjs'
import { CONSUMED } from '../nq5-b1-r1/checkpoint.mjs'

const seal=payload=>({...payload,hash:identity(payload)})
const fields=family=>family.endsWith('balances')?['token_address','balance','block_timestamp']:['transaction_hash','block_timestamp','from_address','to_address','token_address','amount']
export function correctedPlan(bound,profiles){
  const rows=bound.plan.requests.map(originalRow=>{
    const consumed=CONSUMED.includes(originalRow.logicalId),historical=originalRow.family.endsWith('balances'),profile=historical?profiles.historical:profiles.transaction
    if(logicalRequest(originalRow)!==originalRow.logicalId)throw new Error('R2_ORIGINAL_LOGICAL_ID_MISMATCH')
    // Actual current evidence supports zero eligible rows. A hypothetical future
    // admitted profile needs a separately reviewed planner, not caller booleans.
    if(profile.liveReadyContract||profile.disposition==='OFFICIALLY_CLARIFIED_ADMITTED')throw new Error('R2_CURRENT_BLOCKED_PLANNER_REQUIRES_NEW_ADMITTED_PROFILE_IMPLEMENTATION')
    return {originalRow:structuredClone(originalRow),logicalId:originalRow.logicalId,historicalState:consumed?'ISSUED_TERMINAL_NONCOUNTED':'UNISSUED',classification:consumed?'ISSUED_TERMINAL_NONCOUNTED':'HELD_PENDING_CONTRACT',heldDisposition:consumed?null:historical?'HELD_UNISSUED_PENDING_OFFICIAL_TEMPORAL_SEMANTICS':'HELD_UNISSUED_CURRENT_OPENAPI_STRICT_NO_NULL',profileDisposition:profile.disposition,profileIdentity:profile.hash,officialEndpointSha256:profile.endpointSha256,clarificationSha256:profile.clarificationSha256,requestAuditLogicalId:originalRow.logicalId,exactPublicProjection:fields(originalRow.family),labelsStripped:true,rawPrivate:true,replacementLogicalId:null,AUTHORIZED_TO_ISSUE:false}
  })
  const plan=seal({schemaVersion:'1.0.0',activeGate:'G6P-NQ5-T1-B1-R2',campaignId:bound.envelope.campaignId,originalPlanIdentity:bound.plan.hash,originalEnvelopeIdentity:bound.envelope.hash,transactionProfileIdentity:profiles.transaction.hash,historicalProfileIdentity:profiles.historical.hash,rows,requests:[],frozen:true,candidateOnly:true,liveReadyRequestCount:0,maximumCandidateRequests:8,expectedCredits:0,worstCaseCredits:0,AUTHORIZED_TO_ISSUE:false})
  const supersession=seal({schemaVersion:'1.0.0',originalPlanIdentity:bound.plan.hash,correctedCandidateIdentity:plan.hash,originalRowsPreserved:15,rows:rows.map(r=>({originalLogicalId:r.logicalId,originalRequestBodyIdentity:identity(r.originalRow.body),historicalState:r.historicalState,classification:r.classification,heldDisposition:r.heldDisposition,replacementLogicalId:null,replacementRequestBodyIdentity:null,reason:r.historicalState==='ISSUED_TERMINAL_NONCOUNTED'?'CONSUMED_TERMINAL_IMMUTABLE_NO_REISSUE':r.heldDisposition,lineage:[r.logicalId],AUTHORIZED_TO_ISSUE:false})),replacements:[],originalPlanMutated:false,AUTHORIZED_TO_ISSUE:false})
  const reserve=seal({schemaVersion:'1.0.0',correctedCandidateIdentity:plan.hash,latestSafeBalanceAnchor:627478,anchorDisposition:'PRESERVED_B1_RESPONSE_HEADER_NOT_NEW_ACCOUNT_OBSERVATION',protectedReserve:250,requests:[],additionalMaximumAttempts:0,additionalWorstCaseCredits:0,remainingAfterWorstCase:627478,reserveHeadroomAfterWorstCase:627228,priorKnownCampaignAttempts:2,priorKnownCampaignCredits:2,unattributedAccountWideChange:2547,maximumCumulativeCampaignCredits:2,budgetSafe:true,AUTHORIZED_TO_ISSUE:false})
  return {plan,supersession,reserve}
}
export function updatedAudit(original,plans,profiles){
  const audit=structuredClone(original)
  for(const record of audit.records){const row=plans.plan.rows.find(r=>r.logicalId===record.logicalId),profile=record.family.endsWith('balances')?profiles.historical:profiles.transaction
    record.r2ContractReview={profileDisposition:profile.disposition,profileIdentity:profile.hash,correctedPlanIdentity:plans.plan.hash,rowState:row.classification,noIssueReason:record.issued?'PRIOR_CONSUMED_CALL_IMMUTABLE_NOT_REISSUED':row.heldDisposition,clarificationSha256:profile.clarificationSha256,officialEndpointSha256:profile.endpointSha256,sourceIndexIdentity:profile.sourceIndexIdentity,lineageOriginalLogicalId:record.logicalId,replacementLogicalId:null,driftNotice:record.issued&&record.family.endsWith('transactions')?profiles.transaction.proposal.contractDriftNotice:null,AUTHORIZED_TO_ISSUE:false}
  }
  return audit
}
export function validateContinuity(audit,original,plans,profiles,schema){
  if(structuralSchema(audit,schema).status!=='PASS'||identity(audit)!==identity(updatedAudit(original,plans,profiles)))throw new Error('R2_REQUEST_AUDIT_CONTINUITY_REJECTED')
  if(audit.records.length!==15||audit.records.filter(r=>r.issued).length!==2||audit.records.reduce((n,r)=>n+r.attempts.length,0)!==2||audit.records.some(r=>r.qualificationCounted||r.publicCallId!==null))throw new Error('R2_PRIOR_ACTIVITY_OR_COUNT_CHANGED')
  for(const record of audit.records){const {r2ContractReview,...prior}=record;if(identity(prior)!==identity(original.records.find(r=>r.logicalId===record.logicalId)))throw new Error('R2_ORIGINAL_AUDIT_RECORD_CHANGED')}
  return true
}
