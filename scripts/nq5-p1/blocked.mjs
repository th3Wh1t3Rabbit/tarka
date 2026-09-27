import fs from 'node:fs'
import path from 'node:path'
import {identity,sha,validateSchema} from '../nq5/schema.mjs'
import {seal,source} from './authority.mjs'
import {prepare,LEDGER_SHA} from './context.mjs'
import {requestAudit,auditSchema} from './audit.mjs'
import {CLAIMS} from './admission.mjs'
import {lessons,serialize} from './model.mjs'
// Historical public factory only. Never opens current private storage, key,
// provider body, lock, runtime envelope or unchecked cached execution metadata.
export function blockedEntries(c,reason='P1_DURABLE_RUNTIME_EVIDENCE_UNPROVEN'){
 if(reason!=='P1_DURABLE_RUNTIME_EVIDENCE_UNPROVEN')throw new Error('P1_FINITE_BLOCKER_REQUIRED');
 const state={terminals:new Map(),responses:new Map()},audit=requestAudit(c,state,()=>{throw new Error('P1_BLOCKED_RAW_FORBIDDEN')});
 for(const r of audit.p1Records){r.disposition='UNPROVEN_RUNTIME_STATE';r.resultCount=null;r.runtimeEvidenceProven=false;r.localSupportCandidate=false}
 const schema=auditSchema(c);validateSchema('provider',audit,schema);
 const report={schemaVersion:'1.0.0',status:'BLOCKED_WITH_EVIDENCE',reason,campaignId:c.receipt.campaignId,historicalAcceptedB4LedgerSha256:LEDGER_SHA,historicalAcceptedB4LedgerBytes:87416,historicalHttpAttempts:13,historicalProvider2xx:13,historicalSupplierCountedTerminals:11,permanentlyHeldSupplierTerminals:3,leadAcceptedBeforeP1:8,leadAcceptedAfterP1:8,currentLedgerSha256:null,currentLedgerBytes:null,ledgerSha256:null,ledgerBytes:null,httpAttempts:null,provider2xx:null,supplierCountedTerminals:null,newAttempts:null,newDistinctRequests:null,newKnownCredits:null,newLocalSupportCandidates:null,knownCampaignCredits:null,retries:null,unresolvedReservations:null,unresolvedTerminals:null,clean:false,allPrimaryMirrorRawEqual:null,historicalThirteenAttemptsResponsesTerminalsAndMirrorsUnchanged:null,latestSafeResponseBalance:null,protectedReserve:250,balanceAnchorHistoricalOnly:625707,accountWideDecrease:null,campaignAttributedCredits:null,unattributedAccountWideChange:null,causeAssigned:false,publicAcceptedIndexRows:8,publicPendingIndexRows:0,p1PendingLocalCandidateRows:null,acceptedPublicIndexIdentity:identity(c.index),requestAuditIdentity:identity(audit),credentialAccess:null,privateMutation:null,actualPrivateStateAccess:null,blockedFactoryPrivateStateAccess:false,blockedFactoryScope:'PINNED_HISTORICAL_PUBLIC_REFERENCES_ONLY_NO_CURRENT_DURABLE_PROOF',reviewerExternalRequests:0,unauthenticatedDocumentationGets:c.admission.official.index.unauthenticatedDocumentationGets,webDocumentationNavigationToolInvocations:4,webDocumentationPageNavigationOperations:5,webNavigationUnderlyingHttpGetCount:null,authenticatedCampaignProviderRequests:null,authenticatedCampaignProviderRequestsByFamily:null,accountRequests:0,browserRuntimeProviderRequests:0,AUTHORIZED_TO_ISSUE:false,P2_AUTHORIZED_TO_ISSUE:false};
 const matrix={schemaVersion:'1.0.0',rows:[],completeCandidateRows:null,candidateCompletenessProven:false,meaningfulCandidates:null,frozenForReview:false,gate:{pass:false,reason},AUTHORIZED_TO_ISSUE:false},e=seal({schemaVersion:'1.0.0',status:'BLOCKED_CURRENT_RUNTIME_ENVELOPE_NOT_ADMITTED',reason,candidate:c.source.candidate,implementationSha256:c.source.implementationSha256,planIdentity:c.plans.plan.hash,reserveIdentity:c.plans.reserve.hash,frontierPolicyIdentity:c.plans.policy.hash,b4SaturationReceiptIdentity:c.receipt.hash,officialSourceIdentity:c.admission.official.identity,AUTHORIZED_TO_ISSUE:false}),indexBytes=serialize(c.index);
 const entries={
 'RECEIPTS/B4_FRONTIER_SATURATION_ACCEPTANCE_RECEIPT.json':c.receipt,'CONTRACTS/TGM_TRANSFERS_OFFICIAL_CONTRACT_ADMISSION.json':c.admission.tgm,
 'EXECUTION/T1_P1_MULTI_FAMILY_PILOT_ENVELOPE.json':e,
 'PLANS/T1_P1_MULTI_FAMILY_PILOT_PLAN.json':c.plans.plan,'PLANS/T1_P1_RESERVE_PLAN.json':c.plans.reserve,'PLANS/T1_P1_FRONTIER_POLICY.json':c.plans.policy,
 'REPORTS/T1_P1_EXECUTION_REPORT.json':{...report,noNewIssueAfterBlocker:true,noRepair:true,noRecovery:true,noReentry:true},'REPORTS/T1_P1_RECONCILIATION_REPORT.json':report,
 'REPORTS/T1_P1_UTILITY_AND_ROUTE_VIABILITY_REPORT.json':{schemaVersion:'1.0.0',status:'BLOCKED_WITH_EVIDENCE',reason,supportFraction:null,meaningfulGains:null,credibleRemaining1024PathEstablished:false,p2PlanGenerated:false,P2_AUTHORIZED_TO_ISSUE:false,p2RequestsIssued:0,transactionFamilySaturationPreserved:true,claimBoundaries:CLAIMS},
 'REPORTS/T1_CAMPAIGN_STATE_REDACTED.json':{...report,qualificationFloorClaimed:false,gameplayIntegrationAccepted:false},
 'SCHEMAS/NANSEN_API_REQUEST_AUDIT.schema.json':schema,'SCHEMAS/NQ5_PUBLIC_CALL_INDEX.schema.json':c.pubSchema,
 'PUBLIC/NQ5_PUBLIC_CALL_INDEX.json':indexBytes,'PUBLIC/NQ5_PUBLIC_CALL_INDEX.sha256':sha(indexBytes)+'  NQ5_PUBLIC_CALL_INDEX.json\n',
 'EVIDENCE/NANSEN_API_REQUEST_AUDIT.json':audit,'EVIDENCE/P1_LIVE_REQUEST_IDENTITY_MATRIX.json':{schemaVersion:'1.0.0',runtimeEvidenceProven:false,requests:audit.p1Records},
 'EVIDENCE/P1_ATTEMPT_CREDIT_COUNT_AND_PROVIDER_ID_RECONCILIATION.json':{...report,newAttemptsDetail:null,currentProviderIdsAndCreditsNotProven:true},
 'EVIDENCE/P1_PRIMARY_MIRROR_LEDGER_AND_PUBLIC_INDEX_RECONCILIATION.json':{...report,currentRawEqualityNotProven:true,historicalPublicIndexRepresentationOnly:true,publicIndexFileSha256:sha(indexBytes),rawBodiesIncluded:false,privatePathsIncluded:false},
 'EVIDENCE/P2_CANDIDATE_REJECTION_MATRIX.json':matrix,'OFFICIAL_DOCS/INDEX.json':c.admission.official.index
 };for(const s of c.admission.official.index.snapshots)entries['OFFICIAL_DOCS/'+s.filename]=c.admission.official.bodies[s.name];if(c.admission.counter.status.startsWith('ADMITTED_'))entries['CONTRACTS/ADDRESS_COUNTERPARTIES_OFFICIAL_CONTRACT_ADMISSION.json']=c.admission.counter;
 return {c,r:{audit,report},f:{matrix,plan:null,reserve:null,policy:null},entries,status:'BLOCKED_WITH_EVIDENCE',report}
}
export function blocked(root){const c=prepare(root),d=blockedEntries(c);d.entries['SOURCE_INSTALL/V1_9_0_SOURCE_SYNC_INSTALLATION_REPORT.json']=source(root,{validate:true});d.entries['SCHEMAS/TGM_TRANSFERS_RESPONSE_COMPATIBILITY.schema.json']=fs.readFileSync(path.join(root,'schemas/TGM_TRANSFERS_RESPONSE_COMPATIBILITY.schema.json'));if(c.admission.counter.status.startsWith('ADMITTED_'))d.entries['SCHEMAS/ADDRESS_COUNTERPARTIES_PUBLIC_PROJECTION.schema.json']=fs.readFileSync(path.join(root,'schemas/ADDRESS_COUNTERPARTIES_PUBLIC_PROJECTION.schema.json'));d.entries['EVIDENCE/QUALIFICATION_LESSONS_LEARNED_DELTA.json']=lessons(root);return d}
