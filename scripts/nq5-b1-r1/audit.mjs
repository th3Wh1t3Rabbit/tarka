import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { identity } from '../nq5/schema.mjs'
import { structuralSchema } from './diagnostic.mjs'
import { captureSafeHeaders } from './headers.mjs'
import { CONSUMED, LEDGER_SHA, BASE, B1_SHA } from './checkpoint.mjs'

export const CONTRACT_SHA='016b57c4803024add42815df5da1b1cb7653dddddf84970fa75ee443359fbe76'
export const RESUME_AUTH_ID='LEAD-G6P-NQ5-T1-B1-R1-PRESERVED-RAW-REMEDIATION'
export function resumeEnvelope(bound){
  const remaining=bound.envelope.executionOrder.filter(id=>!CONSUMED.includes(id))
  const payload={schemaVersion:'1.0.0',activeGate:'G6P-NQ5-T1-B1-R1',authorizationId:RESUME_AUTH_ID,executionContractSha256:CONTRACT_SHA,campaignId:bound.envelope.campaignId,reviewedB1Commit:BASE,reviewedB1ArchiveSha256:B1_SHA,priorEnvelopeHash:bound.envelope.hash,priorLedgerSha256:LEDGER_SHA,priorLedgerBytes:4659,consumedIds:CONSUMED,remainingIds:remaining,resumeCanaryIds:remaining.slice(0,2),priorNoncountedCalls:2,maximumAdditionalUniqueRequests:13,maximumAdditionalAttempts:39,maximumCumulativeAttempts:41,maximumAdditionalActualCredits:39,maximumCumulativeActualCredits:41,maximumAttemptsPerLogicalRequest:3,latestBudgetAnchor:627478,protectedReserve:250,canaryConcurrency:2,postCanaryRamp:[2,4,8],maximumInFlight:8,requestsPerSecond:20,requestsPerMinute:1200,officialLimitFraction:0.8,connectTimeoutMs:5000,initialTotalTimeoutMs:30000,maximumTotalTimeoutMs:60000,retryStatuses:bound.envelope.retryStatuses,priorRecordsImmutable:true,rootCauseAdmissionRequired:true,localReviewAndRegressionRequired:true,currentDocsAdmissionRequired:true,originalLockPreserved:true,invocationResumeLockFailIfExists:true,additionalAccountAttempts:0,replacementRequests:0,additionalBatches:0}
  return {...payload,hash:identity(payload)}
}
export function balanceReconciliation(prior){
  const sequence=[...prior.responses.values()].sort((a,b)=>a.sequence-b.sequence).map(r=>({responseSequence:r.sequence,logicalId:r.logicalId,attempt:r.attempt,quotedCost:r.quotedCredits,actualUsed:r.actualCredits,remaining:r.remainingCredits}))
  const spent=sequence.reduce((n,r)=>n+r.actualUsed,0),latest=sequence.at(-1)?.remaining??null
  return {schemaVersion:'1.0.0',historicalAnchor:630027,perResponseSequence:sequence,campaignAttributedCreditUse:spent,totalAccountWideDecreaseSinceHistoricalAnchor:latest===null?null:630027-latest,unattributedAccountWideDecrease:latest===null?null:630027-latest-spent,classification:'UNATTRIBUTED_ACCOUNT_WIDE_CHANGE',latestSafeBudgetAnchor:latest,protectedReserve:250,additionalAccountRequests:0,otherActorAttributed:false,priorDiscoveryAttributed:false}
}
function deriveAudit(bound,prior,diagnostic,blocker='ROOT_CAUSE_ADMISSION_BLOCKED'){
  const records=bound.plan.requests.map(request=>{
    const attempts=[...prior.starts.values()].filter(s=>s.logicalId===request.logicalId).map(start=>{
      const response=prior.responses.get(request.logicalId+'.'+start.attempt),terminal=prior.terminals.get(request.logicalId),d=diagnostic.responses.find(d=>d.logicalId===request.logicalId)
      const contract=bound.admission.contracts.find(c=>c.family===request.family)
      const validation=d?Object.fromEntries(['schemaIdentity','stages','safelyAdmissible','admittedResultCount','normalizedIdentity','firstFailedStage'].map(k=>[k,d[k]])):terminal?.validationDiagnostics??null
      return {attemptNumber:start.attempt,attemptIdentity:start.hash,startSequence:start.sequence,responseSequence:response?.sequence??null,terminalSequence:terminal?.attempt===start.attempt?terminal.sequence:null,issuedAtUtc:start.issuedAtUtc,completedAtUtc:response?.completedAtUtc??null,completedTimestampDisposition:response?response.completedAtUtc?'CAPTURED':'NOT_CAPTURED_BY_B1_TRANSPORT_V1':'NO_RESPONSE',latencyMs:response?.latencyMs??null,httpStatus:response?.httpStatus??null,provider_request_id:response?.providerRequestId??null,providerRequestIdDisposition:response?response.providerRequestId?'CAPTURED':CONSUMED.includes(request.logicalId)?'NOT_CAPTURED_BY_B1_TRANSPORT_V1':'MISSING_FUTURE_REQUEST_ID':'NO_RESPONSE',safeHeaders:response?captureSafeHeaders(response.headers):{},quotedCredits:response?.quotedCredits??null,actualCredits:response?.actualCredits??null,remainingCredits:response?.remainingCredits??null,rawBytes:response?.rawBytes??null,primarySha256:response?.rawSha256??null,mirrorSha256:response?.rawSha256??null,bytesEqual:!!response,responseSchemaIdentity:identity(contract.responseSchema),validation}
    })
    const terminal=prior.terminals.get(request.logicalId),counted=terminal?.disposition==='SUCCESS_COUNTED',old=CONSUMED.includes(request.logicalId)
    if(old&&counted)throw new Error('R1_PRIOR_CALL_MUST_REMAIN_NONCOUNTED')
    return {authorizationId:old?'LEAD-G6P-NQ5-T1-B1-FROZEN15':RESUME_AUTH_ID,executionContractSha256:old?bound.envelope.executionContractSha256:CONTRACT_SHA,campaignId:bound.envelope.campaignId,trancheId:'T1',batchId:'B1',planSequence:request.sequence,logicalId:request.logicalId,family:request.family,path:request.path,method:request.method,requestBodySha256:identity(request.body),investigativeQuestionId:request.questionId,questionLens:request.lens,purposeCode:request.purpose,businessQuestion:request.businessQuestion,selectionLineage:request.lineage,coverageCells:request.coverageCells,coverageKey:request.coverageKey,consumerIds:request.consumers,expectedCredits:request.expectedCredits,worstCaseCredits:request.worstCaseCredits,issued:attempts.length>0,issueDisposition:old?'CONSUMED_PRIOR_B1_NONCOUNTED_IMMUTABLE':attempts.length?'ISSUED_R1':blocker==='ROOT_CAUSE_ADMISSION_BLOCKED'?'NOT_ISSUED_ROOT_CAUSE_ADMISSION_BLOCK':'NOT_ISSUED_BREAKER',attempts,terminalDisposition:terminal?.disposition??null,qualificationCounted:counted,qualificationSequence:counted?terminal.publicRecord.qualification_sequence:null,exclusionReason:terminal?.reason??(attempts.length?null:blocker),publicCallId:counted?terminal.publicRecord.public_call_id:null,normalizedIdentity:counted?terminal.normalizedSha256:null,admittedResultCount:counted?terminal.resultCount:null,qualification_value:counted?'ADMITTED_BOUNDED_EVIDENCE':'ZERO_NOT_COUNTED',engineering_value:attempts.length?['AUTHENTICATED_TRANSPORT','CONCURRENCY_OBSERVATION','DURABLE_PRIMARY_MIRROR_STORAGE','BILLING_RATE_HEADER_OBSERVATION',...(old?['VALIDATION_MISMATCH_DIAGNOSIS']:[])]:[],gameplay_consumer_value:counted?'ADMITTED_BOUNDED_EVIDENCE_NOT_INTEGRATION_ACCEPTANCE':'NO_ADMITTED_GAMEPLAY_EVIDENCE_FROM_B1_V1',competition_evidence_value:counted?'SAFE_ADMITTED_QUALIFICATION_AUDIT':attempts.length?'SAFE_ENGINEERING_AUDIT_ONLY':'PLAN_ONLY_NOT_ISSUED'}
  })
  const report={schemaVersion:'1.0.0',campaignId:bound.envelope.campaignId,authorizationId:RESUME_AUTH_ID,records,rawBodiesIncluded:false,privatePathsIncluded:false,unrestrictedHeadersIncluded:false}
  return report
}
export function requestAudit(bound,prior,diagnostic,blocker='ROOT_CAUSE_ADMISSION_BLOCKED'){
  const report=deriveAudit(bound,prior,diagnostic,blocker)
  validateAudit(report,bound,prior,diagnostic,blocker)
  return report
}
export function validateAudit(report,bound,prior,diagnostic,blocker='ROOT_CAUSE_ADMISSION_BLOCKED'){
  const schema=JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../schemas/NANSEN_API_REQUEST_AUDIT.schema.json',import.meta.url))))
  if(structuralSchema(report,schema).status!=='PASS')throw new Error('R1_AUDIT_SCHEMA_REJECTED')
  if(!diagnostic||!Array.isArray(diagnostic.responses))throw new Error('R1_TRUSTED_DIAGNOSTIC_CONTEXT_REQUIRED')
  // Compare every field against a deterministic derivation from the caller's
  // read-only verified replay/diagnostic context, not just selected assertions.
  if(identity(report)!==identity(deriveAudit(bound,prior,diagnostic,blocker)))throw new Error('R1_AUDIT_DERIVED_EVIDENCE_MISMATCH')
  if(identity(report.records.map(r=>r.logicalId).sort())!==identity(bound.plan.requests.map(r=>r.logicalId).sort()))throw new Error('R1_AUDIT_INVENTORY')
  for(const record of report.records){
    const request=bound.plan.requests.find(r=>r.logicalId===record.logicalId),terminal=prior.terminals.get(record.logicalId)
    if(record.requestBodySha256!==identity(request.body)||record.planSequence!==request.sequence||identity(record.consumerIds)!==identity(request.consumers)||identity(record.coverageKey)!==identity(request.coverageKey)||record.businessQuestion!==request.businessQuestion||record.issued!==[...prior.starts.values()].some(r=>r.logicalId===record.logicalId)||record.qualificationCounted!==(terminal?.disposition==='SUCCESS_COUNTED')||record.terminalDisposition!==(terminal?.disposition??null)||record.attempts.length!==[...prior.starts.values()].filter(r=>r.logicalId===record.logicalId).length)throw new Error('R1_AUDIT_SEMANTIC_IDENTITY')
    for(const [auditKey,planKey]of [['family','family'],['path','path'],['method','method'],['investigativeQuestionId','questionId'],['questionLens','lens'],['purposeCode','purpose'],['selectionLineage','lineage'],['coverageCells','coverageCells'],['expectedCredits','expectedCredits'],['worstCaseCredits','worstCaseCredits']])if(identity(record[auditKey])!==identity(request[planKey]))throw new Error('R1_AUDIT_PLAN_BINDING')
    const old=CONSUMED.includes(record.logicalId),counted=record.qualificationCounted
    if(record.campaignId!==bound.envelope.campaignId||record.executionContractSha256!==(old?bound.envelope.executionContractSha256:CONTRACT_SHA)||record.authorizationId!==(old?'LEAD-G6P-NQ5-T1-B1-FROZEN15':RESUME_AUTH_ID)||record.qualificationSequence!==(counted?terminal.publicRecord.qualification_sequence:null)||record.publicCallId!==(counted?terminal.publicRecord.public_call_id:null)||record.normalizedIdentity!==(counted?terminal.normalizedSha256:null)||record.admittedResultCount!==(counted?terminal.resultCount:null)||record.qualification_value!==(counted?'ADMITTED_BOUNDED_EVIDENCE':'ZERO_NOT_COUNTED'))throw new Error('R1_AUDIT_COUNT_OR_AUTHORITY_BINDING')
    const uniqueAttempts=new Set()
    for(const attempt of record.attempts){
      const key=record.logicalId+'.'+attempt.attemptNumber,start=prior.starts.get(key),response=prior.responses.get(key)
      if(!start||uniqueAttempts.has(key))throw new Error('R1_AUDIT_ATTEMPT_IDENTITY');uniqueAttempts.add(key)
      if(attempt.attemptIdentity!==start.hash||attempt.startSequence!==start.sequence||attempt.issuedAtUtc!==start.issuedAtUtc||attempt.responseSequence!==(response?.sequence??null)||attempt.provider_request_id!==(response?.providerRequestId??null)||attempt.rawBytes!==(response?.rawBytes??null)||attempt.primarySha256!==(response?.rawSha256??null)||attempt.mirrorSha256!==(response?.rawSha256??null)||attempt.actualCredits!==(response?.actualCredits??null)||attempt.quotedCredits!==(response?.quotedCredits??null)||attempt.remainingCredits!==(response?.remainingCredits??null)||attempt.httpStatus!==(response?.httpStatus??null)||attempt.latencyMs!==(response?.latencyMs??null)||attempt.completedAtUtc!==(response?.completedAtUtc??null)||identity(attempt.safeHeaders)!==identity(response?captureSafeHeaders(response.headers):{}))throw new Error('R1_AUDIT_RESPONSE_BINDING')
    }
    if(CONSUMED.includes(record.logicalId)&&(record.qualificationCounted||record.qualification_value!=='ZERO_NOT_COUNTED'||record.gameplay_consumer_value!=='NO_ADMITTED_GAMEPLAY_EVIDENCE_FROM_B1_V1'||record.attempts.length!==1||record.attempts[0].provider_request_id!==null))throw new Error('R1_PRIOR_CALL_MUST_REMAIN_NONCOUNTED')
  }
  return true
}
export function utilityBuckets(audit){
  const group=selector=>{
    const buckets={}
    for(const record of audit.records)for(const key of selector(record)){
      const b=buckets[key]??={plannedLogicalRequests:0,issuedLogicalRequests:0,attempts:0,provider2xx:0,countedSuccesses:0,knownActualCredits:0,actualCreditUseDeterminate:true,admittedNormalizedResultCount:0,gameplayEvidenceDisposition:'NO_ADMITTED_GAMEPLAY_EVIDENCE_FROM_B1_V1',creditAggregationDisposition:'REQUEST_MEMBERSHIP_NOT_EXCLUSIVE_COST_ALLOCATION'}
      b.plannedLogicalRequests++;if(record.issued)b.issuedLogicalRequests++;b.attempts+=record.attempts.length
      for(const attempt of record.attempts){if(attempt.httpStatus>=200&&attempt.httpStatus<300)b.provider2xx++;if(attempt.actualCredits===null)b.actualCreditUseDeterminate=false;else b.knownActualCredits+=attempt.actualCredits}
      if(record.qualificationCounted){b.countedSuccesses++;b.admittedNormalizedResultCount+=record.admittedResultCount;b.gameplayEvidenceDisposition='ADMITTED_BOUNDED_EVIDENCE_NOT_INTEGRATION_ACCEPTANCE'}
    }
    return buckets
  }
  return {byEndpointFamily:group(r=>[r.family]),byQuestionLens:group(r=>[r.questionLens]),byCoverageCell:group(r=>r.coverageCells),byNamedConsumer:group(r=>r.consumerIds)}
}
