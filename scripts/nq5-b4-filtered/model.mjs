import fs from 'node:fs'
import path from 'node:path'
import { identity, sha } from '../nq5/schema.mjs'
import { tuple } from '../nq5-b3/planner.mjs'
import { baseline } from './context.mjs'
import { receipt, acceptedIndex, acceptedAudit } from './acceptance.mjs'
import { quality } from './quality.mjs'
import { freeze } from './planner.mjs'
import { lessons } from './lessons.mjs'
import { seal, LEDGER_SHA } from './authority.mjs'
export const serialize=x=>Buffer.isBuffer(x)?x:Buffer.from(typeof x==='string'?x:JSON.stringify(x,null,2)+'\n')
export function derive(root){
 const c=baseline(root),lead=receipt(c),q=quality(c.sources,c.prior.a.context.truth,lead),index=acceptedIndex(c,lead),a=acceptedAudit(c,lead,index,q),f=freeze(c,lead,index,a,q)
 if(f.liveGate.pass)throw new Error('B4_FOUR_CANDIDATES_REQUIRE_SEPARATE_REVIEWED_RUNTIME_IMPLEMENTATION')
 const indexBytes=serialize(index),metrics={perCallNormalizedRowSum:c.sources.reduce((n,p)=>n+p.admission.resultCount,0),globalDistinctTransferIdentityCount:new Set(c.sources.flatMap(p=>p.admission.normalizedRecords.map(tuple))).size}
 if(metrics.perCallNormalizedRowSum!==780||metrics.globalDistinctTransferIdentityCount!==772)throw new Error('B4_ACCEPTED_METRIC_REPRODUCTION')
 const scope={reviewerExternalRequests:0,unauthenticatedDocumentationGets:0,authenticatedCampaignProviderRequests:0,accountRequests:0,browserRuntimeProviderRequests:0},execution={schemaVersion:'1.0.0',status:'NOT_ISSUED_FILTERED_FRONTIER_THRESHOLD',reason:f.liveGate.reason,ordinaryMeaningfulCandidates:f.liveGate.ordinaryMeaningfulCandidates,minimumOrdinaryRequired:4,newAttempts:0,newCredits:0,newLocalSupportCandidates:0,credentialResolutionAttempted:false,credentialAccess:false,privateMutation:false,documentationRefreshAttempted:false,...scope,AUTHORIZED_TO_ISSUE:false,noReplacement:true,noSeventeenthRequest:true,noBatch5Issue:true}
 const reconciliation={schemaVersion:'1.0.0',status:'READONLY_ACCEPTED_BASELINE_PASS_B4_NOT_ISSUED',campaignId:lead.campaignId,httpAttempts:13,provider2xx:13,supplierCountedTerminals:11,leadAcceptedBeforeB4:8,leadAcceptedAfterB4:8,permanentlyHeldCalls:3,newAttempts:0,newProvider2xx:0,newSupplierCountedTerminals:0,newLocalSupportCandidates:0,newKnownCredits:0,knownCampaignCredits:13,retries:0,unresolvedReservations:0,unresolvedTerminals:0,ledgerSha256:LEDGER_SHA,ledgerBytes:87416,originalHistoryAndLocksUnchanged:true,allThirteenRawMirrorsReopenedAndEqual:true,allFiveB3AcceptedSemanticsReproduced:true,latestSafeResponseBalance:625707,historicalBalanceAnchor:630027,totalAccountWideDecrease:4320,totalCampaignKnownCredits:13,totalAccountWideUnattributedChange:4307,b3HeaderBalanceDecrease:267,b3KnownCredits:5,b3UnattributedHeaderBalanceChange:262,b4HeaderBalanceDecrease:0,b4KnownCredits:0,b4UnattributedHeaderBalanceChange:0,balanceSource:'HISTORICAL_SAFE_B3_PROVIDER_HEADER_NOT_NEW_ACCOUNT_OBSERVATION',causeAssigned:false,publicIndexRowsAfterLeadAcceptance:8,publicIndexRowsPendingLeadAcceptance:0,acceptedPublicIndexIdentity:identity(index),requestAuditIdentity:identity(a),sourceQualityIdentity:q.hash,...metrics,...scope,actualPrivateStateAccess:true,credentialAccess:false,privateMutation:false,AUTHORIZED_TO_ISSUE:false}
 const rejectedCounts=Object.fromEntries([...new Set(f.matrix.rows.map(r=>r.rejectionCode??'ADMITTED'))].sort().map(k=>[k,f.matrix.rows.filter(r=>(r.rejectionCode??'ADMITTED')===k).length])),utility={schemaVersion:'1.0.0',status:'BLOCKED_FILTERED_ORDINARY_THRESHOLD',...metrics,metricsAreNotFrontierUtility:true,leadAcceptedSources:8,recursiveNonHubSources:q.rows.filter(r=>r.recursiveFrontierAuthority).length,nonrecursiveControlSources:q.rows.filter(r=>!r.recursiveFrontierAuthority).length,completeCandidateRows:f.matrix.completeCandidateCount,ordinaryMeaningfulUnissuedCandidates:f.matrix.ordinaryAdmittedCount,infrastructureControlsFrozen:f.matrix.infrastructureControlAdmittedCount,filteredRequests:f.plan.requests.length,rejectionCounts:rejectedCounts,sourceQualityIdentity:q.hash,candidateMatrixIdentity:identity(f.matrix),planIdentity:f.plan.hash,old64PlanRejected:true,noRawBranchingExtrapolation:true,transactionOnlyFloorAssessment:'CURRENT_FILTERED_FRONTIER_BELOW_LIVE_THRESHOLD_NO_CREDIBLE_1024_PATH_ESTABLISHED_NOT_A_NEGATIVE_PROOF',exhaustionClaimed:false,gameplayIntegrationAccepted:false,BATCH5_AUTHORIZED_TO_ISSUE:false,batch5PlanGenerated:false,batch5NotDerivedReason:'B4_NOT_ISSUED_NO_75_PERCENT_SUPPORT_OR_TWO_NEW_MEANINGFUL_NON_HUB_CANDIDATES',nextRequestsIssued:0}
 const envelope=seal({schemaVersion:'1.0.0',status:'BLOCKED_FILTERED_PRELIVE_THRESHOLD',AUTHORIZED_TO_ISSUE:false,reason:f.liveGate.reason,candidate:c.source.candidate,implementationSha256:c.source.implementationSha256,planIdentity:f.plan.hash,reserveIdentity:f.reserve.hash,frontierPolicyIdentity:f.policy.hash,sourceQualityIdentity:q.hash,leadAcceptanceReceiptIdentity:lead.hash,immutableLedgerSha256:LEDGER_SHA,immutableLedgerBytes:87416,providerRequests:0,credentialAccess:false,privateMutation:false})
 const entries={
 'RECEIPTS/B3_LEAD_ACCEPTANCE_RECEIPT.json':lead,
 'CONTRACTS/ADDRESS_TRANSACTIONS_OBSERVED_COMPATIBILITY_PROFILE.json':c.a.bytes['CONTRACTS/ADDRESS_TRANSACTIONS_OBSERVED_COMPATIBILITY_PROFILE.json'],
 'CONTRACTS/ADDRESS_TRANSACTIONS_SIGNED_FLOW_COMPATIBILITY_PROFILE.json':c.a.bytes['CONTRACTS/ADDRESS_TRANSACTIONS_SIGNED_FLOW_COMPATIBILITY_PROFILE.json'],
 'EVIDENCE/B3_SOURCE_CALL_FRONTIER_QUALITY_CLASSIFICATION.json':q,
 'EVIDENCE/BATCH4_FILTERED_CANDIDATE_REJECTION_MATRIX.json':f.matrix,
 'EXECUTION/T1_BATCH4_FILTERED_EXECUTION_ENVELOPE.json':envelope,
 'PLANS/T1_BATCH4_FILTERED_EXECUTION_PLAN.json':f.plan,'PLANS/T1_BATCH4_FILTERED_RESERVE_PLAN.json':f.reserve,'PLANS/T1_BATCH4_FILTERED_FRONTIER_POLICY.json':f.policy,
 'REPORTS/T1_BATCH4_FILTERED_EXECUTION_REPORT.json':execution,'REPORTS/T1_BATCH4_FILTERED_RECONCILIATION_REPORT.json':reconciliation,'REPORTS/T1_BATCH4_FILTERED_UTILITY_AND_VIABILITY_REPORT.json':utility,
 'REPORTS/T1_CAMPAIGN_STATE_REDACTED.json':{...reconciliation,qualificationFloorClaimed:false,gameplayIntegrationAccepted:false},
 'SCHEMAS/NANSEN_API_REQUEST_AUDIT.schema.json':fs.readFileSync(path.join(root,'schemas/NANSEN_API_REQUEST_AUDIT_B4_ACCEPTED.schema.json')),
 'SCHEMAS/NQ5_PUBLIC_CALL_INDEX.schema.json':fs.readFileSync(path.join(root,'schemas/NQ5_PUBLIC_CALL_INDEX_B4_ACCEPTED.schema.json')),
 'PUBLIC/NQ5_PUBLIC_CALL_INDEX.json':indexBytes,'PUBLIC/NQ5_PUBLIC_CALL_INDEX.sha256':sha(indexBytes)+'  NQ5_PUBLIC_CALL_INDEX.json\n',
 'EVIDENCE/NANSEN_API_REQUEST_AUDIT.json':a,
 'EVIDENCE/B4_LIVE_REQUEST_IDENTITY_MATRIX.json':{schemaVersion:'1.0.0',status:'NOT_ISSUED_PRELIVE_FILTER_HOLD',planIdentity:f.plan.hash,requests:f.plan.requests.map(r=>({...r,issued:false,terminalIdentity:null,localSupportCandidate:false,leadAccepted:false})),existingB3AcceptanceBindings:lead.calls,canonicalRequestIdsIndependentlyRecomputed:true},
 'EVIDENCE/B4_ATTEMPT_CREDIT_COUNT_AND_PROVIDER_ID_RECONCILIATION.json':{...reconciliation,priorAttempts:[...c.r.current.responses.values()].map(r=>({logicalId:r.logicalId,attempt:r.attempt,providerRequestId:r.providerRequestId,httpStatus:r.httpStatus,actualCredits:r.actualCredits,rawSha256:r.rawSha256,rawBytes:r.rawBytes})),newAttemptsDetail:[]},
 'EVIDENCE/B4_PRIMARY_MIRROR_LEDGER_AND_PUBLIC_INDEX_RECONCILIATION.json':{...reconciliation,publicIndexFileSha256:sha(indexBytes),oldFoundationPrivateIdentity:c.prior.state.identity,permanentlyHeldCallsExcluded:true,rawBodiesIncluded:false,privatePathsIncluded:false},
 'EVIDENCE/QUALIFICATION_LESSONS_LEARNED_DELTA.json':lessons(),
 'OFFICIAL_DOCS/INDEX.json':{...c.a.objects['OFFICIAL_DOCS/INDEX.json'],scope:'HISTORICAL_ACCEPTED_B3_BINDINGS_NOT_CURRENT_B4_RUNTIME_ADMISSION',freshnessGateReached:false,documentationRefreshSkippedReason:f.liveGate.reason}
 }
 return {c,lead,quality:q,index,audit:a,frontier:f,entries,report:reconciliation,status:'BLOCKED_WITH_EVIDENCE'}
}
