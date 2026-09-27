import { identity, sha, freeze } from '../nq5/schema.mjs'
import { seedQuestions, freezeNextBatch, frontierPolicy } from '../nq5-r2/frontier.mjs'
import { ACTIVE_R3, R3_SOURCE_MANIFEST_SHA256, REVIEWED_ACCOUNT_REPORT_SHA256, REVIEWED_ACCOUNT_REUSE_RECEIPT_SHA256 } from './authority.mjs'
import { assertContractAdmission } from './contracts.mjs'
import { assertGenesis } from './genesis.mjs'
import { hasSecretLikeValue } from '../secret-patterns.mjs'
import { buildFrontierPolicy, assertFrontierPolicyIdentity } from './frontier-policy.mjs'
import { ACTIVE_R3_R1, SOURCE_MANIFEST_SHA256, R3_CUT, R3_TREE, CAMPAIGN_ID, PRESERVED_PINS, validateR3R1Source } from '../nq5-r3-r1/authority.mjs'
import { assertCleanA2uSourceCut } from '../g6p-a2u-cut.mjs'
import { execFileSync } from 'node:child_process'
const verifiedPlans = new WeakMap()
export const REQUIRED_GATES = Object.freeze(['source_admission','complete_local_regression','current_official_docs_snapshot','fixture_schema_conformance','terminal_archive_feature_parity','large_corpus_browser_performance','dedicated_review','nq5_planner_and_runtime_tests','ledger_crash_tail_and_dual_root_storage','endpoint_policy_and_public_projection','credential_browser_boundary','secret_scans','account_adapter_fixture_tests','account_observation_local_reuse','campaign_genesis','frozen_next_batch','protected_reserve'])
export const serializedSha256 = value => sha(Buffer.from(JSON.stringify(value,null,2) + '\n'))
export const R3_R1_GATES = Object.freeze([...REQUIRED_GATES,'frontier_policy_identity','accepted_artifact_preservation'])
const remediation = report => report.active_gate === 'G6P-A2U-R3-R1'
const reportGates = report => remediation(report) ? R3_R1_GATES : REQUIRED_GATES
function safeReport(report) {
  const text = JSON.stringify(report)
  if (hasSecretLikeValue(text) || /\/home\/|\/tmp\/|file:\/\/\/|[A-Za-z]:\\\\|Bearer\s/i.test(text)) throw new Error('Private or credential-like report value rejected without disclosure.')
  if (!/^[a-f\d]{40}$/.test(report.candidate_commit) || !/^[a-f\d]{40}$/.test(report.candidate_tree) || report.active_source_identity !== identity(remediation(report) ? ACTIVE_R3_R1 : ACTIVE_R3) || !/^\d{4}-\d\d-\d\dT.*Z$/.test(report.generated_at_utc) || !Number.isFinite(Date.parse(report.generated_at_utc))) throw new Error('Current report candidate/source/time identity invalid.')
}
export function freezeGenesisBatch(fixture, admission, account, genesis, context) {
  assertContractAdmission(admission)
  if (account.account.available_credits !== 630027 || serializedSha256(account) !== context.accountReportSha256) throw new Error('Genesis requires preserved observed account identity/balance.')
  const history = assertGenesis(genesis,context)
  const admittedFamilies = new Set(admission.contracts.map(contract=>contract.family))
  const requests = seedQuestions(fixture).filter(request=>admittedFamilies.has(request.family))
  if (!requests.length || requests.length > 256 || requests.some(request=>request.partition.page !== 1 || request.lens !== 'RECEIPT' && request.body.pagination?.page !== 1)) throw new Error('Nonempty meaningful genesis batch must contain only admitted page1 seeds.')
  const frozen = freezeNextBatch(requests,admission.contracts,account,[],256,history)
  const {hash:_hash,...contents} = frozen.plan
  const rows = contents.requests.map(row=>({...row,publicProjectionPolicy:admission.records.find(record=>record.family === row.family).publicProjectionPolicy}))
  const planContents = {...contents,schemaVersion:'3.0.0',activeSourceIdentity:identity(ACTIVE_R3),campaignId:genesis.campaignId,campaignGenesisReceiptSha256:serializedSha256(genesis),officialContractAdmissionSha256:serializedSha256(admission),requests:rows,executionRequiresSeparateLeadReview:true,qualificationCallsAllowed:false,checkpointHold:true}
  const plan = freeze({...planContents,hash:identity(planContents)})
  const reserveContents = {schemaVersion:'3.0.0',parentPlanHash:plan.hash,campaignId:genesis.campaignId,requests:[],worstCaseCredits:0,protectedReserveCredits:250,speculativeReserveForbidden:true,futureRequestsRequireDurableFrontierAdmission:true}
  const reserve = freeze({...reserveContents,hash:identity(reserveContents)})
  const report = freeze({schemaVersion:'3.0.0',status:'PASS_FROZEN_NEXT_BATCH_ONLY',campaignId:genesis.campaignId,frozen:true,frozenNextBatchRequests:rows.length,admittedFamilies:[...admittedFamilies].sort(),heldFamilies:admission.records.filter(record=>!record.qualificationCountedEligible).map(record=>record.family).sort(),page1Only:true,speculativeFuturePages:0,duplicateLogicalRequests:0,expectedCredits:plan.expectedCredits,worstCaseCredits:plan.worstCaseCredits,reserveWorstCaseCredits:0,protectedReserveCredits:250,availableCredits:630027,remainingAfterWorstCaseAndProtectedReserve:630027-plan.worstCaseCredits-250,initialT1Attempts:0,initialT1CountedSuccesses:0,initialT1ActualCreditDelta:0,verifiedInitialCampaignSnapshot:true,noImplicitZeroReset:true,requiredOutcomeFloor:1024,floorReached:false,floorReachability:frontierPolicy(fixture).floorReachability,privateOrHeldFamiliesCounted:false,qualificationAttempts:0,qualificationCounted:0,checkpointHeld:true})
  const policy=buildFrontierPolicy(fixture,plan,admission)
  verifiedPlans.set(plan,{admission,genesis,context,reserve,fixture,policy}); return {plan,reserve,report,policy}
}
export function bindPreservedCheckpointToRemediationCut(plan,root,cut) {
  const proof=verifiedPlans.get(plan)
  if(!proof || identity(assertCleanA2uSourceCut(root))!==identity(cut))throw new Error('Verified preserved checkpoint and clean current cut required.')
  validateR3R1Source(root);execFileSync('git',['merge-base','--is-ancestor',R3_CUT,cut.commit],{cwd:root,stdio:'pipe'})
  const preserved={'PLANS/T1_PLAN.json':plan,'PLANS/T1_RESERVE_PLAN.json':proof.reserve,'PLANS/PLAN_SPECIFIC_OFFICIAL_CONTRACT_ADMISSION.json':proof.admission,'REPORTS/T1_CAMPAIGN_GENESIS_RECEIPT.json':proof.genesis}
  if(proof.context.candidateCommit!==R3_CUT || proof.context.candidateTree!==R3_TREE || plan.campaignId!==CAMPAIGN_ID || Object.entries(preserved).some(([name,value])=>serializedSha256(value)!==PRESERVED_PINS[name]))throw new Error('Accepted R3 checkpoint bytes or historical candidate binding changed.')
  assertGenesis(proof.genesis,proof.context)
  proof.reportContext={...proof.context,candidateCommit:cut.commit,candidateTree:cut.tree,sourceIdentity:identity(ACTIVE_R3_R1)}
  proof.remediationRoot=root
  proof.policy=buildFrontierPolicy(proof.fixture,plan,proof.admission,identity(ACTIVE_R3_R1))
  return proof.policy
}
export function assertFrozenIdentity(report, plan) {
  if (report.t1_plan_sha256 !== serializedSha256(plan) || report.t1_plan_frozen !== (plan.frozen === true) || report.t1_plan_status !== (plan.frozen === true ? 'FROZEN_NEXT_BATCH' : 'UNFROZEN_NOT_ISSUABLE') || Object.hasOwn(report,'frozen_t1_plan_sha256') && (plan.frozen !== true || report.frozen_t1_plan_sha256 !== serializedSha256(plan))) throw new Error('Plan identity must bind explicit frozen contents; misleading frozen label rejected.')
}
export function validateFinalPrecall(report, plan, reserve, evidence) {
  safeReport(report)
  const allowed = ['schema_version','status','active_gate','generated_at_utc','candidate_commit','candidate_tree','active_source_identity','active_source_manifest_sha256','AUTHORIZED_TO_ISSUE','AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT','additional_account_attempts','historical_account_attempts_consumed','qualification_attempts','qualification_counted','provider_calls_in_r3','credential_access_in_r3','checkpoint_hold','qualification_execution_allowed','original_account_report_sha256','account_observation_reuse_receipt_sha256','campaign_genesis_receipt_sha256','official_contract_admission_sha256','t1_plan_sha256','t1_plan_frozen','t1_plan_status','reserve_plan_sha256','offline_report_sha256','available_credits','protected_reserve_credits','gates','blockers','campaign_id','frontier_policy_sha256','frontier_policy_canonical_identity','frontier_policy_identity_verified',...(remediation(report)?['frozen_artifact_source_identity','frozen_checkpoint_candidate_commit','frozen_checkpoint_candidate_tree']:[])]
  if (report.schema_version !== (remediation(report)?'1.3.0':'1.2.0') || !['G6P-A2U-R3','G6P-A2U-R3-R1'].includes(report.active_gate) || typeof report.AUTHORIZED_TO_ISSUE !== 'boolean' || allowed.some(key=>!Object.hasOwn(report,key)) || Object.keys(report).some(key=>!allowed.includes(key) && key !== 'frozen_t1_plan_sha256') || Object.keys(report.gates).sort().join() !== [...reportGates(report)].sort().join() || Object.values(report.gates).some(value=>!['PASS','FAIL','NOT_VERIFIED'].includes(value)) || report.historical_account_attempts_consumed !== 1 || report.protected_reserve_credits !== 250 || !Array.isArray(report.blockers) || report.blockers.some(item=>Object.keys(item).sort().join() !== 'evidence_refs,id,summary' || typeof item.id !== 'string' || !item.id || typeof item.summary !== 'string' || !item.summary || !Array.isArray(item.evidence_refs) || item.evidence_refs.some(value=>typeof value !== 'string' || !/^(?:REPORTS|PLANS|OFFICIAL_DOCS|EVIDENCE)\/[a-zA-Z0-9_.-]+$/.test(value)))) throw new Error('Current strict R3 report contract violated.')
  const digests = ['active_source_manifest_sha256','original_account_report_sha256','account_observation_reuse_receipt_sha256','campaign_genesis_receipt_sha256','official_contract_admission_sha256','t1_plan_sha256','reserve_plan_sha256','offline_report_sha256','frontier_policy_sha256','frontier_policy_canonical_identity']
  if (digests.some(key=>!/^[a-f\d]{64}$/.test(report[key])) || report.available_credits !== null && (!Number.isFinite(report.available_credits) || report.available_credits < 0)) throw new Error('Report digest/balance contract invalid.')
  if (!evidence || Object.keys(evidence).sort().join() !== 'accountReuseReceipt,frontierPolicy,frontierPolicyBytes,offlineReport') throw new Error('Actual offline, policy bytes and observation-reuse artifacts required, not unverified digests.')
  const {offlineReport,accountReuseReceipt} = evidence
  validateOfflineReport(offlineReport)
  if (report.offline_report_sha256 !== serializedSha256(offlineReport) || report.account_observation_reuse_receipt_sha256 !== serializedSha256(accountReuseReceipt) || report.active_source_manifest_sha256 !== (remediation(report)?SOURCE_MANIFEST_SHA256:R3_SOURCE_MANIFEST_SHA256) || report.active_gate!==offlineReport.active_gate || identity(report.gates) !== identity(offlineReport.mandatory_offline_gates) || identity(report.blockers) !== identity(offlineReport.blockers) || report.candidate_commit !== offlineReport.candidate_commit || report.candidate_tree !== offlineReport.candidate_tree || report.active_source_identity !== offlineReport.active_source_identity || report.generated_at_utc !== offlineReport.generated_at_utc) throw new Error('Final/offline/current-source/reuse evidence disagreement.')
  const {frontierPolicy:policy,frontierPolicyBytes:policyBytes}=evidence
  if(!Buffer.isBuffer(policyBytes) || report.frontier_policy_sha256!==sha(policyBytes) || identity(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(policyBytes)))!==identity(policy) || report.frontier_policy_canonical_identity!==policy.hash || report.campaign_id!==plan.campaignId || report.frontier_policy_identity_verified!==true)throw new Error('Exact frontier-policy bytes/self-identity/campaign report binding mismatch.')
  assertFrozenIdentity(report,plan)
  if (report.AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT !== false || report.additional_account_attempts !== 0 || report.qualification_attempts !== 0 || report.qualification_counted !== 0 || report.provider_calls_in_r3 !== 0 || report.credential_access_in_r3 !== false || report.checkpoint_hold !== true || report.qualification_execution_allowed !== false || report.reserve_plan_sha256 !== serializedSha256(reserve)) throw new Error('R3 execution/account/credential hold or reserve binding violated.')
  if (report.AUTHORIZED_TO_ISSUE) {
    const proof = verifiedPlans.get(plan)
    if (!proof || report.status !== 'DELIVERED_PENDING_LEAD_REVIEW' || report.blockers.length || Object.values(report.gates).some(value=>value !== 'PASS') || identity(proof.reserve) !== identity(reserve) || report.campaign_genesis_receipt_sha256 !== serializedSha256(proof.genesis) || report.official_contract_admission_sha256 !== serializedSha256(proof.admission)) throw new Error('Final authorization needs all current gates and verified frozen plan.')
    assertContractAdmission(proof.admission); assertGenesis(proof.genesis,proof.context)
    assertFrontierPolicyIdentity(policy,{fixture:proof.fixture,plan,admission:proof.admission,campaignId:proof.genesis.campaignId,sourceIdentity:report.active_source_identity})
    if(identity(policy)!==identity(proof.policy) || remediation(report) && (!proof.reportContext || report.frozen_artifact_source_identity!==proof.context.sourceIdentity || report.frozen_checkpoint_candidate_commit!==R3_CUT || report.frozen_checkpoint_candidate_tree!==R3_TREE))throw new Error('Current verified continuation policy or accepted frozen provenance mismatch.')
    if(remediation(report)) {
      validateR3R1Source(proof.remediationRoot)
      if(identity(assertCleanA2uSourceCut(proof.remediationRoot))!==identity({commit:report.candidate_commit,tree:report.candidate_tree}))throw new Error('Current remediation cut changed after binding.')
    }
    const reuse = accountReuseReceipt
    if (offlineReport.status !== 'PASS_OFFLINE_GATES_ONLY' || serializedSha256(reuse) !== REVIEWED_ACCOUNT_REUSE_RECEIPT_SHA256 || proof.context.accountReportSha256 !== REVIEWED_ACCOUNT_REPORT_SHA256 || reuse.status !== 'PASS_LOCAL_REVALIDATION_ONLY' || reuse.originalRedactedReportSha256 !== proof.context.accountReportSha256 || reuse.originalTerminalIdentity !== proof.context.accountObservationIdentity || reuse.originalAttemptsConsumed !== 1 || reuse.additionalAttempts !== 0 || reuse.actualCreditDelta !== 0 || reuse.availableCredits !== 630027 || reuse.protectedReserveCredits !== 250 || !reuse.bytesEqual || !reuse.rawHashesAgreeWithRedactedReport || !/^[a-f\d]{64}$/.test(reuse.primaryRawSha256) || reuse.primaryRawSha256 !== reuse.mirrorRawSha256 || reuse.credentialResolutionInGate !== false || reuse.providerRequestsInGate !== 0 || reuse.accountAdapterInvoked !== false || reuse.transportInvoked !== false || reuse.privateJournalMutated !== false || reuse.rawStorageMutated !== false || reuse.localReuseOnly !== true || reuse.noRelevantPostObservationCodeMutation !== true || reuse.protectedCodeProof?.status !== 'PASS' || reuse.protectedCodeProof.noRelevantPostObservationMutation !== true || reuse.qualificationAttempts !== 0 || reuse.qualificationCounted !== 0 || reuse.privatePathsIncluded !== false || reuse.rawPayloadIncluded !== false || reuse.originalOrderingAccepted !== false) throw new Error('Bound consumed account observation reuse evidence not admitted.')
    const boundContext=proof.reportContext??proof.context
    if (report.candidate_commit !== boundContext.candidateCommit || report.candidate_tree !== boundContext.candidateTree || report.active_source_identity !== boundContext.sourceIdentity || report.original_account_report_sha256 !== proof.context.accountReportSha256 || report.available_credits !== 630027) throw new Error('Final current candidate/source/account binding mismatch.')
    const {hash,...contents} = plan, {hash:reserveHash,...reserveContents} = reserve
    if (identity(contents) !== hash || identity(reserveContents) !== reserveHash || !plan.frozen || !plan.requests.length || plan.requests.length > 256 || plan.availableCredits !== 630027 || reserve.protectedReserveCredits !== 250 || plan.worstCaseCredits + reserve.worstCaseCredits > plan.availableCredits - 250 || new Set(plan.requests.map(row=>row.logicalId)).size !== plan.requests.length || plan.requests.some(row=>!proof.admission.contracts.some(contract=>contract.hash === row.contractHash && contract.family === row.family) || row.partition.page !== 1 || !row.publicProjectionPolicy)) throw new Error('Actual frozen contents/row/reserve admission mismatch.')
  } else if (report.status !== 'BLOCKED_WITH_EVIDENCE' || !report.blockers.length) throw new Error('False authorization must carry blockers.')
  return true
}
export function validateOfflineReport(report) {
  safeReport(report)
  const keys = ['schema_version','status','active_gate','generated_at_utc','candidate_commit','candidate_tree','parent_authorization_id','active_source_identity','mandatory_offline_gates','blockers','credential_access','provider_calls','AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT','account_attempt_consumed','additional_account_attempts_authorized','scope']
  if (Object.keys(report).sort().join() !== keys.sort().join() || report.schema_version !== (remediation(report)?'1.2.0':'1.1.0') || !['G6P-A2U-R3','G6P-A2U-R3-R1'].includes(report.active_gate) || report.credential_access !== false || report.provider_calls !== 0 || report.AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT !== false || report.account_attempt_consumed !== 1 || report.additional_account_attempts_authorized !== 0 || report.scope !== 'CURRENT_OFFLINE_GATES_ONLY_NO_NEW_ACCOUNT_AUTHORITY' || Object.keys(report.mandatory_offline_gates).sort().join() !== [...reportGates(report)].sort().join()) throw new Error('Strict R3 offline report/consumed account contract violated.')
  const passed = Object.values(report.mandatory_offline_gates).every(value=>value === 'PASS')
  if (report.status !== (passed ? 'PASS_OFFLINE_GATES_ONLY' : 'BLOCKED_WITH_EVIDENCE') || passed !== (report.blockers.length === 0) || Object.values(report.mandatory_offline_gates).some(value=>!['PASS','FAIL','NOT_VERIFIED'].includes(value))) throw new Error('Truthful R3 offline gate values required; PASS never reauthorizes account.')
  return true
}
export function assertCampaignExecutionAdmission({report,plan,reserve,evidence}) {
  validateFinalPrecall(report,plan,reserve,evidence)
  const proof=verifiedPlans.get(plan)
  if(!proof || !report.AUTHORIZED_TO_ISSUE)throw new Error('Verified checkpoint authorization required before execution admission.')
  assertFrontierPolicyIdentity(evidence.frontierPolicy,{fixture:proof.fixture,plan,admission:proof.admission,campaignId:proof.genesis.campaignId,sourceIdentity:report.active_source_identity})
  throw new Error('Qualification execution held pending separate Lead review; no provider request admitted.')
}
