import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { identity } from '../../scripts/nq5/schema.mjs'
import { ACTIVE_R3, R3_SOURCE_MANIFEST_SHA256 } from '../../scripts/nq5-r3/authority.mjs'
import { ACTIVE_R3_R1, SOURCE_MANIFEST_SHA256, R3_CUT, R3_TREE, validateR3R1Source } from '../../scripts/nq5-r3-r1/authority.mjs'
import { loadOfficialSnapshot, buildContractAdmission } from '../../scripts/nq5-r3/contracts.mjs'
import { createCampaignGenesis, newCampaignId } from '../../scripts/nq5-r3/genesis.mjs'
import { buildFrontierPolicy, assertFrontierPolicyIdentity } from '../../scripts/nq5-r3/frontier-policy.mjs'
import { freezeGenesisBatch, serializedSha256, validateFinalPrecall, REQUIRED_GATES, R3_R1_GATES, assertCampaignExecutionAdmission, bindPreservedCheckpointToRemediationCut } from '../../scripts/nq5-r3/checkpoint.mjs'
import { Nq5Runtime } from '../../scripts/nq5/runtime.mjs'

const root=process.cwd(),base='public/scenarios/euler-2023-false-exit/',fixture=buildFrozenFixture(JSON.parse(fs.readFileSync(base+'scenario.json')),JSON.parse(fs.readFileSync(base+'evidence-graph.json')))
const reviewed=JSON.parse(fs.readFileSync('tests/fixtures/nq5-r3-reviewed-observation.json'))
const context={candidateCommit:'1'.repeat(40),candidateTree:'2'.repeat(40),sourceIdentity:identity(ACTIVE_R3),accountObservationIdentity:reviewed.reuse.originalTerminalIdentity,accountReportSha256:serializedSha256(reviewed.account)}
const bytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n'),reseal=value=>{const {hash:_hash,...contents}=value;return {...contents,hash:identity(contents)}}
let temporary,genesis,batch,contracts
// Load historical admission after fixing only the offline Date evaluation time.
beforeAll(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-17T12:00:00Z'));contracts=buildContractAdmission(loadOfficialSnapshot(root),'PRO');temporary=fs.mkdtempSync(path.join(os.tmpdir(),'trace-r3-r1-synthetic-'));const roots=['primary','mirror'].map(name=>{const location=path.join(temporary,name);fs.mkdirSync(location,{mode:0o700});return location});genesis=createCampaignGenesis(roots,newCampaignId(),context);batch=freezeGenesisBatch(fixture,contracts,reviewed.account,genesis,context)})
afterAll(()=>{try{if(temporary)fs.rmSync(temporary,{recursive:true,force:true})}finally{vi.useRealTimers()}})
const verify=(policy,plan=batch.plan,admission=contracts)=>assertFrontierPolicyIdentity(policy,{fixture,plan,admission,campaignId:genesis.campaignId,sourceIdentity:context.sourceIdentity})
function finalCheckpoint(policy=batch.policy) {
 const {plan,reserve}=batch,gates=Object.fromEntries(REQUIRED_GATES.map(key=>[key,'PASS'])),generated=new Date().toISOString()
 const offline={schema_version:'1.1.0',status:'PASS_OFFLINE_GATES_ONLY',active_gate:'G6P-A2U-R3',generated_at_utc:generated,candidate_commit:context.candidateCommit,candidate_tree:context.candidateTree,parent_authorization_id:'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001',active_source_identity:context.sourceIdentity,mandatory_offline_gates:gates,blockers:[],credential_access:false,provider_calls:0,AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT:false,account_attempt_consumed:1,additional_account_attempts_authorized:0,scope:'CURRENT_OFFLINE_GATES_ONLY_NO_NEW_ACCOUNT_AUTHORITY'}
 const report={schema_version:'1.2.0',status:'DELIVERED_PENDING_LEAD_REVIEW',active_gate:'G6P-A2U-R3',generated_at_utc:generated,candidate_commit:context.candidateCommit,candidate_tree:context.candidateTree,active_source_identity:context.sourceIdentity,active_source_manifest_sha256:R3_SOURCE_MANIFEST_SHA256,AUTHORIZED_TO_ISSUE:true,AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT:false,additional_account_attempts:0,historical_account_attempts_consumed:1,qualification_attempts:0,qualification_counted:0,provider_calls_in_r3:0,credential_access_in_r3:false,checkpoint_hold:true,qualification_execution_allowed:false,original_account_report_sha256:context.accountReportSha256,account_observation_reuse_receipt_sha256:serializedSha256(reviewed.reuse),campaign_genesis_receipt_sha256:serializedSha256(genesis),official_contract_admission_sha256:serializedSha256(contracts),t1_plan_sha256:serializedSha256(plan),t1_plan_frozen:true,t1_plan_status:'FROZEN_NEXT_BATCH',reserve_plan_sha256:serializedSha256(reserve),offline_report_sha256:serializedSha256(offline),available_credits:630027,protected_reserve_credits:250,gates,blockers:[],campaign_id:genesis.campaignId,frontier_policy_sha256:serializedSha256(policy),frontier_policy_canonical_identity:policy.hash,frontier_policy_identity_verified:true}
 return {report,plan,reserve,evidence:{offlineReport:offline,accountReuseReceipt:reviewed.reuse,frontierPolicy:policy,frontierPolicyBytes:bytes(policy)}}
}
describe('R3-R1 canonical complete frontier identity and final artifact bindings',()=>{
 it('admits seven exact additive files/three authorities over52 byte-unchanged source files',()=>{const source=validateR3R1Source(root);expect(source.additiveFiles).toBe(7);expect(source.materialAuthorityAdditions).toBe(3);expect(source.unchangedFoundationFiles).toBe(52);expect(source.precedence[1]).toContain('1.7.3')})
 it('seals only after all R3 fields and the exact frozen plan are present',()=>{const {hash,...contents}=batch.policy;expect(identity(contents)).toBe(hash);expect(batch.policy.frozenPlanSha256).toBe(serializedSha256(batch.plan));expect(batch.policy.frozenPlanIdentity).toBe(batch.plan.hash);expect(verify(batch.policy)).toBe(true)})
 it('supports explicit current remediation authority while retaining frozen R3 source provenance',()=>{const policy=buildFrontierPolicy(fixture,batch.plan,contracts,identity(ACTIVE_R3_R1));expect(policy.activeSourceIdentity).toBe(identity(ACTIVE_R3_R1));expect(policy.frozenArtifactSourceIdentity).toBe(context.sourceIdentity);expect(()=>verify(policy)).toThrow();expect(assertFrontierPolicyIdentity(policy,{fixture,plan:batch.plan,admission:contracts,campaignId:genesis.campaignId,sourceIdentity:identity(ACTIVE_R3_R1)})).toBe(true)})
 it.each(['exact-stale','missing','malformed','added-unhashed-r3-field','mutated-field','deleted-field','rehashed-deletion','rehashed-addition','rehashed-mutation','campaign','admitted-families','held-families','plan-file-sha','plan-canonical-identity','active-source','frozen-source'])('rejects %s policy including attempts to reseal semantic changes',kind=>{
  let policy=structuredClone(batch.policy)
  if(kind==='exact-stale')policy.hash='b175c78cb896ceeca0061ef12bac1b0d07a851de68bb402389c4864dc8ebd62f'
  if(kind==='missing')delete policy.hash
  if(kind==='malformed')policy.hash='malformed'
  if(kind==='added-unhashed-r3-field'||kind==='rehashed-addition')policy.uncoveredR3Field=true
  if(kind==='mutated-field'||kind==='rehashed-mutation')policy.maximumFrozenBatch=255
  if(kind==='deleted-field'||kind==='rehashed-deletion')delete policy.genesisDoesNotProveFuturePages
  if(kind==='campaign')policy.campaignId=newCampaignId()
  if(kind==='admitted-families')policy.publiclyAdmittedFamilies.push('profiler/address/counterparties')
  if(kind==='held-families')policy.heldFamiliesExcluded=[]
  if(kind==='plan-file-sha')policy.frozenPlanSha256='0'.repeat(64)
  if(kind==='plan-canonical-identity')policy.frozenPlanIdentity='0'.repeat(64)
  if(kind==='active-source')policy.activeSourceIdentity='0'.repeat(64)
  if(kind==='frozen-source')policy.frozenArtifactSourceIdentity='0'.repeat(64)
  if(kind.startsWith('rehashed-')||['campaign','admitted-families','held-families','plan-file-sha','plan-canonical-identity','active-source','frozen-source'].includes(kind))policy=reseal(policy)
  expect(()=>verify(policy)).toThrow()
 })
 it('rejects a changed frozen plan and a changed admitted-family disposition even if their own hashes are repaired',()=>{const plan=reseal({...batch.plan,expectedCredits:16}),admission=structuredClone(contracts);admission.records.find(row=>!row.qualificationCountedEligible).qualificationCountedEligible=true;expect(()=>verify(batch.policy,plan)).toThrow();expect(()=>verify(batch.policy,batch.plan,admission)).toThrow()})
 it('accepts the exact policy/report/file/plan/campaign bindings with execution still held',()=>{const value=finalCheckpoint();expect(validateFinalPrecall(value.report,value.plan,value.reserve,value.evidence)).toBe(true);expect(()=>assertCampaignExecutionAdmission(value)).toThrow(/held/);expect(()=>new Nq5Runtime({mode:'PRODUCTION',plan:value.plan,reserve:value.reserve,qualificationCheckpoint:value})).toThrow(/held/)})
 it.each(['sha-only','canonical-only','wrong-sha','wrong-canonical','flag-false','report-campaign','plan-sha','changed-file-bytes','policy-omitted','serialized-plan'])('rejects %s final-report authorization',kind=>{
  const value=finalCheckpoint()
  if(kind==='sha-only')delete value.report.frontier_policy_canonical_identity
  if(kind==='canonical-only')delete value.report.frontier_policy_sha256
  if(kind==='wrong-sha')value.report.frontier_policy_sha256='0'.repeat(64)
  if(kind==='wrong-canonical')value.report.frontier_policy_canonical_identity='0'.repeat(64)
  if(kind==='flag-false')value.report.frontier_policy_identity_verified=false
  if(kind==='report-campaign')value.report.campaign_id=newCampaignId()
  if(kind==='plan-sha')value.report.t1_plan_sha256='0'.repeat(64)
  if(kind==='changed-file-bytes')value.evidence.frontierPolicyBytes=Buffer.from(value.evidence.frontierPolicyBytes.toString()+'\n')
  if(kind==='policy-omitted')delete value.evidence.frontierPolicy
  if(kind==='serialized-plan')value.plan=structuredClone(value.plan)
  expect(()=>validateFinalPrecall(value.report,value.plan,value.reserve,value.evidence)).toThrow()
 })
 it('rejects an internally valid policy/report pair for another campaign against the real verified checkpoint',()=>{const foreignPlan=reseal({...batch.plan,campaignId:newCampaignId()}),foreignPolicy=buildFrontierPolicy(fixture,foreignPlan,contracts),value=finalCheckpoint(foreignPolicy);value.report.campaign_id=foreignPlan.campaignId;value.report.t1_plan_sha256=serializedSha256(foreignPlan);expect(assertFrontierPolicyIdentity(foreignPolicy,{fixture,plan:foreignPlan,admission:contracts})).toBe(true);expect(()=>validateFinalPrecall(value.report,foreignPlan,value.reserve,value.evidence)).toThrow();expect(()=>validateFinalPrecall(value.report,batch.plan,value.reserve,value.evidence)).toThrow()})
 it('rejects a fully branded other-campaign policy/report pair in the remediation gate without exact accepted R3 provenance',()=>{
  const policy=buildFrontierPolicy(fixture,batch.plan,contracts,identity(ACTIVE_R3_R1)),value=finalCheckpoint(policy),gates=Object.fromEntries(R3_R1_GATES.map(key=>[key,'PASS']))
  Object.assign(value.evidence.offlineReport,{schema_version:'1.2.0',active_gate:'G6P-A2U-R3-R1',active_source_identity:identity(ACTIVE_R3_R1),mandatory_offline_gates:gates})
  Object.assign(value.report,{schema_version:'1.3.0',active_gate:'G6P-A2U-R3-R1',active_source_identity:identity(ACTIVE_R3_R1),active_source_manifest_sha256:SOURCE_MANIFEST_SHA256,gates,offline_report_sha256:serializedSha256(value.evidence.offlineReport),frozen_artifact_source_identity:context.sourceIdentity,frozen_checkpoint_candidate_commit:R3_CUT,frozen_checkpoint_candidate_tree:R3_TREE})
  expect(assertFrontierPolicyIdentity(policy,{fixture,plan:batch.plan,admission:contracts,sourceIdentity:identity(ACTIVE_R3_R1)})).toBe(true)
  expect(()=>validateFinalPrecall(value.report,value.plan,value.reserve,value.evidence)).toThrow(/provenance/)
 })
 it('rejects the stale policy even when a report honestly binds its exact bytes and its stale label',()=>{const policy={...batch.policy,hash:'b175c78cb896ceeca0061ef12bac1b0d07a851de68bb402389c4864dc8ebd62f'},value=finalCheckpoint(policy);expect(()=>validateFinalPrecall(value.report,value.plan,value.reserve,value.evidence)).toThrow()})
 it('rejects unbranded preserved plan registration before any private baseline access',()=>{expect(()=>bindPreservedCheckpointToRemediationCut(structuredClone(batch.plan),root,{commit:context.candidateCommit,tree:context.candidateTree})).toThrow(/Verified preserved/);expect(()=>assertCampaignExecutionAdmission(finalCheckpoint({...batch.policy,hash:'0'.repeat(64)}))).toThrow()})
})
