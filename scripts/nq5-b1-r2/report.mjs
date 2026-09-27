import fs from 'node:fs'
import path from 'node:path'
import { identity, sha } from '../nq5/schema.mjs'
import { preservedCheckpoint } from '../nq5-b1-r1/checkpoint.mjs'
import { requestAudit } from '../nq5-b1-r1/audit.mjs'
import { sourceBinding, priorEvidence, corpusAt, PINS, BASE, TREE, R1_SHA, CONTRACT_SHA, MANIFEST_SHA } from './gates.mjs'
import { profiles } from './contracts.mjs'
import { correctedPlan, updatedAudit, validateContinuity } from './plan.mjs'
import { preservedReplay } from './replay.mjs'
import { fallbackSurvey } from './survey.mjs'

export function offlineReport(root){
  const bound=sourceBinding(root),prior=priorEvidence(root),docs=corpusAt(root),profile=profiles(docs.corpus,bound,docs.index),context=preservedCheckpoint(root)
  const pretty=o=>Buffer.from(JSON.stringify(o,null,2)+'\n')
  if(sha(pretty(context.diagnostic))!==PINS['EVIDENCE/B1_PRESERVED_RESPONSE_DIAGNOSTIC.json']||sha(pretty(requestAudit(bound,context.prior,context.diagnostic)))!==PINS['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json']||context.diagnostic.originalLockSha256!=='331729a7393cf20a2d50533ef267b70102eef18fd4e892f43d44a0fb649edb37')throw new Error('R2_PRESERVED_DIAGNOSTIC_AUDIT_OR_LOCK_CHANGED')
  const plans=correctedPlan(bound,profile),original=JSON.parse(prior['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json']),audit=updatedAudit(original,plans,profile),schema=JSON.parse(fs.readFileSync(path.join(root,'schemas/NANSEN_API_REQUEST_AUDIT.schema.json')))
  validateContinuity(audit,original,plans,profile,schema)
  const replay=preservedReplay(context,profile),after=preservedCheckpoint(root)
  if(identity(after.diagnostic)!==identity(context.diagnostic))throw new Error('R2_PRIVATE_STATE_CHANGED_DURING_READ_ONLY_REPLAY')
  const state={schemaVersion:'1.0.0',status:'BLOCKED_WITH_EVIDENCE',activeGate:'G6P-NQ5-T1-B1-R2',campaignId:bound.envelope.campaignId,AUTHORIZED_TO_ISSUE:false,priorAttempts:2,priorProvider2xx:2,priorCountedSuccesses:0,priorActualCredits:2,unissuedOriginalRequests:13,additionalAttempts:0,additionalCredits:0,additionalProviderRequests:0,additionalAccountRequests:0,alchemyRequests:0,credentialAccess:false,resumeLockCreated:false,resumeReceiptCreated:false,privateStateModified:false,ledgerSha256:context.prior.bytesSha256,ledgerBytes:context.prior.bytes,originalLockSha256:context.diagnostic.originalLockSha256,originalTerminalsImmutable:true,newPublicCallIndexGenerated:false,correctedPlanIdentity:plans.plan.hash,liveReadyRequests:0}
  const readiness={...state,reviewedR1Commit:BASE,reviewedR1Tree:TREE,reviewedR1ArchiveSha256:R1_SHA,executionContractSha256:CONTRACT_SHA,activeSourceManifestSha256:MANIFEST_SHA,transactionDisposition:profile.transaction.disposition,historicalDisposition:profile.historical.disposition,preservedReplayStageFindings:replay.responses.map(r=>({logicalId:r.logicalId,officialContractDisposition:r.officialContractDisposition,proposalOnly:r.proposalOnly??false,firstFailedStage:r.firstFailedStage,firstFailedCode:r.stages[r.firstFailedStage]?.code??null,normalizationProjection:r.stages.normalizationProjection.status,publicSchema:r.stages.publicSchema.status})),newDirectFalsifier:'TRANSACTIONS_ALSO_HAVE_TIMEZONE_LESS_TIMESTAMPS_AFTER_PROPOSED_NULL_SCHEMA_GATE_NO_INFERENCE_ADMITTED',documentationGetAccounting:{totalPerformed:17,indexedAttempts:15,unindexedFallbackAttemptsRecaptured:2,successfulCurrentPrimaryPages:9,clarificationAttempts:4,currentClarificationResponses:2,successfulIndexedFallbackPages:2,redirectsFollowed:0,webSearches:0,browserRuntimeRequests:0,scope:'EXACT_AUTHORIZED_PUBLIC_DOCUMENTATION_ONLY'},originalRequestAuditSha256:PINS['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json'],originalRequestAuditSchemaSha256:PINS['SCHEMAS/NANSEN_API_REQUEST_AUDIT.schema.json'],updatedRequestAuditIdentity:identity(audit),originalRawStorageProof:context.diagnostic.responses.map(r=>({logicalId:r.logicalId,rawBytes:r.rawBytes,primarySha256:r.primarySha256,mirrorSha256:r.mirrorSha256,bytesEqual:r.bytesEqual,immutableTerminal:r.immutableTerminal,qualificationCounted:r.qualificationCounted})),supplierOfflineChecks:{exactSourceLineage:true,exactReviewedArchiveMembers:true,currentDocumentationBytesVerified:true,originalDiagnosticAuditUnchanged:true,requestAuditSchemaAndFullContinuity:true,allOriginalPlanRowsPreserved:true,deterministicZeroReadyPlan:true,budgetReserveProtected:true,readOnlyPrivateBeforeAfterIdentity:true},qualificationOrGameplayAdmissionFromReplay:false,productionNullCompatibility:'NOT_ADMITTED_PENDING_LEAD_PROPOSAL_ONLY',productionTemporalAlignmentAndReplacementPlanner:'HELD_NO_OFFICIALLY_ADMITTED_PROFILE',nextEvent:'STOP_FOR_LEAD_REVIEW_NO_PROVIDER_AUTHORITY'}
  const index={...docs.index,capturedIndexSha256:sha(fs.readFileSync(path.join(root,'docs/official/b1-r2/INDEX.json'))),clarificationDecisions:{questionA:{classification:profile.transaction.clarificationClassification,answerSha256:profile.transaction.clarificationSha256,citedSourcePages:profile.transaction.citedSourcePages},questionB:{classification:profile.historical.clarificationClassification,answerSha256:profile.historical.clarificationSha256,citedSourcePages:profile.historical.citedSourcePages}},getAccounting:readiness.documentationGetAccounting}
  const entries={
    'OFFICIAL_DOCS/INDEX.json':index,
    'CONTRACTS/ADDRESS_TRANSACTIONS_NULL_COMPATIBILITY_PROFILE.json':profile.transaction,
    'CONTRACTS/HISTORICAL_BALANCE_TEMPORAL_PROFILE.json':profile.historical,
    'PLANS/T1_B1_CORRECTED_CANDIDATE_PLAN.json':plans.plan,
    'PLANS/T1_B1_PLAN_SUPERSESSION_MAP.json':plans.supersession,
    'PLANS/T1_B1_CORRECTED_RESERVE_PLAN.json':plans.reserve,
    'REPORTS/T1_B1_R2_OFFLINE_READINESS_REPORT.json':readiness,
    'REPORTS/T1_CAMPAIGN_STATE_REDACTED.json':state,
    'SCHEMAS/NANSEN_API_REQUEST_AUDIT.schema.json':fs.readFileSync(path.join(root,'schemas/NANSEN_API_REQUEST_AUDIT.schema.json')),
    'EVIDENCE/NANSEN_API_REQUEST_AUDIT.json':audit,
    'EVIDENCE/PRESERVED_RAW_COMPATIBILITY_REPLAY.json':replay,
    'EVIDENCE/HISTORICAL_WINDOW_DECISION.json':{...profile.historical,originalUnissuedRows:plans.plan.rows.filter(r=>r.heldDisposition==='HELD_UNISSUED_PENDING_OFFICIAL_TEMPORAL_SEMANTICS').map(r=>({logicalId:r.logicalId,exactOriginalWindow:r.originalRow.body.date,disposition:r.heldDisposition,originalWindowModified:false,replacementProposed:false,AUTHORIZED_TO_ISSUE:false})),preservedReadOnlyReplay:replay.responses.find(r=>r.officialContractDisposition===profile.historical.disposition),allInferencePathsHeld:true},
    'EVIDENCE/BACKTESTING_FALLBACK_SURVEY.json':fallbackSurvey(docs.corpus),
    'EVIDENCE/ACCOUNT_WIDE_BALANCE_RECONCILIATION.json':prior['EVIDENCE/ACCOUNT_WIDE_BALANCE_RECONCILIATION.json'],
    'EVIDENCE/REQUEST_AUDIT_AND_PLAN_LINEAGE_MATRIX.json':{schemaVersion:'1.0.0',correctedPlanIdentity:plans.plan.hash,originalAuditSha256:PINS['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json'],updatedAuditIdentity:identity(audit),rows:audit.records.map(r=>({logicalId:r.logicalId,originalRequestBodySha256:r.requestBodySha256,originalPlanSequence:r.planSequence,...r.r2ContractReview,attemptCount:r.attempts.length,qualificationCounted:r.qualificationCounted,publicCallId:r.publicCallId})),newAttempts:0,newCountedResults:0,AUTHORIZED_TO_ISSUE:false}
  }
  for(const [filename,body]of Object.entries(docs.bodies))entries['OFFICIAL_DOCS/'+filename]=body
  return {entries,readiness,docs,profile,plans,audit,replay}
}
