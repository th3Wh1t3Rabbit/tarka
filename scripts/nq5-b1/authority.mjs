import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha, freeze, validateSchema } from '../nq5/schema.mjs'
import { logicalRequest } from '../nq5/planner.mjs'
import { validateR3R1Source, PRESERVED_PINS, CAMPAIGN_ID } from '../nq5-r3-r1/authority.mjs'
import { proveUnchangedObservationCode } from '../nq5-r2/observation.mjs'

export const ACCEPTED_COMMIT = '2339562ec660570dcc1239826a322871d3b54f16'
export const ACCEPTED_TREE = '6e81b8319216bfd97c2a7cbd14a315089b4dc8c3'
export const ACCEPTED_ARCHIVE_SHA = '06fd647d94ff050120f5101ffa8082b6351d9cfa6fa7f697c6db5ea23bd13a12'
export const CONTRACT = 'docs/source/execution-b1/43_G6P_NQ5_T1_B1_EXECUTION_CONTRACT.txt'
export const CONTRACT_SHA = 'f0ab981fd411628397c491d476a266b9f387ed5f90d2b32198661e7e9664b85c'
export const MANIFEST_SHA = 'bc42c454fce567f2c027d6b4113640c32031c65924160264c05d22e4de697651'
export const PINS = freeze({...PRESERVED_PINS,
  'PLANS/T1_FRONTIER_POLICY.json':'b0c6ce6abb45cb604dc20452a67d680641dadc88e8cc66ffa58b84f7e7527ad9',
  'REPORTS/NQ5_PRECALL_AUTHORIZATION_REPORT.json':'90752483bd564caec7bffa350a635fbecf1c9949bda566e6070b580f5ce70684'})
const accepted = new WeakSet()
export function bindAccepted(bytes) {
  if (identity(Object.keys(bytes).sort()) !== identity(Object.keys(PINS).sort())) throw new Error('B1_ACCEPTED_INVENTORY')
  for (const [name,pin] of Object.entries(PINS)) if (sha(bytes[name])!==pin) throw new Error('B1_ACCEPTED_BYTES')
  const parse = name => JSON.parse(bytes[name])
  const plan=parse('PLANS/T1_PLAN.json'), reserve=parse('PLANS/T1_RESERVE_PLAN.json'), policy=parse('PLANS/T1_FRONTIER_POLICY.json')
  const admission=parse('PLANS/PLAN_SPECIFIC_OFFICIAL_CONTRACT_ADMISSION.json'), checkpoint=parse('REPORTS/NQ5_PRECALL_AUTHORIZATION_REPORT.json')
  const canonical = object => {const {hash,...payload}=object; if(identity(payload)!==hash)throw new Error('B1_CANONICAL_IDENTITY');return hash}
  canonical(plan);canonical(reserve);canonical(policy)
  if(plan.campaignId!==CAMPAIGN_ID || plan.requests.length!==15 || !plan.frozen || reserve.requests.length || reserve.worstCaseCredits!==0 || plan.expectedCredits!==15 || plan.worstCaseCredits!==45 || !checkpoint.AUTHORIZED_TO_ISSUE || checkpoint.campaign_id!==CAMPAIGN_ID || checkpoint.t1_plan_sha256!==PINS['PLANS/T1_PLAN.json'] || checkpoint.frontier_policy_canonical_identity!==policy.hash || checkpoint.frontier_policy_sha256!==PINS['PLANS/T1_FRONTIER_POLICY.json'] || plan.campaignGenesisReceiptSha256!==PINS['REPORTS/T1_CAMPAIGN_GENESIS_RECEIPT.json']) throw new Error('B1_CROSS_BINDING')
  const families=['profiler/address/historical-balances','profiler/address/transactions']
  if(new Set(plan.requests.map(r=>r.logicalId)).size!==15)throw new Error('B1_DUPLICATE')
  for(const row of plan.requests){
    const contract=admission.contracts.find(c=>c.family===row.family)
    if(!families.includes(row.family)||row.logicalId!==logicalRequest(row)||row.path!==contract?.path||row.method!=='POST'||row.body.pagination.page!==1||row.expectedCredits!==1||row.worstCaseCredits!==3)throw new Error('B1_ROW_ADMISSION')
    validateSchema('provider',row.body,contract.requestSchema)
  }
  const canaryIds=families.flatMap(f=>plan.requests.filter(r=>r.family===f).map(r=>r.logicalId).sort().slice(0,2)).sort()
  if(canaryIds.length!==4)throw new Error('B1_CANARY')
  const envelopePayload={schemaVersion:'1.0.0',activeGate:'G6P-NQ5-T1-B1',campaignId:CAMPAIGN_ID,acceptedCommit:ACCEPTED_COMMIT,acceptedTree:ACCEPTED_TREE,acceptedArchiveSha256:ACCEPTED_ARCHIVE_SHA,executionContractSha256:CONTRACT_SHA,executionSourceManifestSha256:MANIFEST_SHA,acceptedSourceIdentity:checkpoint.active_source_identity,frozenArtifactSourceIdentity:plan.activeSourceIdentity,planSha256:PINS['PLANS/T1_PLAN.json'],planCanonicalIdentity:plan.hash,policySha256:PINS['PLANS/T1_FRONTIER_POLICY.json'],policyCanonicalIdentity:policy.hash,genesisReceiptSha256:plan.campaignGenesisReceiptSha256,reserveSha256:PINS['PLANS/T1_RESERVE_PLAN.json'],reserveCanonicalIdentity:reserve.hash,officialAdmissionSha256:PINS['PLANS/PLAN_SPECIFIC_OFFICIAL_CONTRACT_ADMISSION.json'],canaryIds,executionOrder:[...canaryIds,...plan.requests.map(r=>r.logicalId).filter(id=>!canaryIds.includes(id)).sort()],canaryConcurrency:2,postCanaryRamp:[2,4,8],maximumInFlight:8,requestsPerSecond:20,requestsPerMinute:1200,officialLimitFraction:0.8,connectTimeoutMs:5000,initialTotalTimeoutMs:30000,maximumTotalTimeoutMs:60000,maximumLogicalRequests:15,maximumAttempts:45,maximumActualCredits:45,maximumAttemptsPerLogicalRequest:3,protectedReserve:250,retryStatuses:[429,500,502,503,504],retryPolicy:'RETRY_AFTER_AND_EXPONENTIAL_FULL_JITTER',hedging:false,orderedTerminalWriter:true,maximumQueue:15,rawQueueCapacity:8,breakers:['AUTH_PERMISSION_PAYMENT','CREDIT_UNKNOWN_OR_UNEXPECTED','RESERVE_RISK','STATUS_SCHEMA_PAGINATION','PRIVACY_PROJECTION','PRIMARY_MIRROR_STORAGE','LEDGER_ORDER_OR_FAILURE','TIMEOUT_CANCEL_SHUTDOWN','CAPACITY_AUTHORITY_IDENTITY'],emptyResultPolicy:'SUCCESS_NOT_COUNTED_STOP_FOR_REVIEW',additionalAccountAttempts:0,additionalBatches:0,uninstalledPolicyReference:'v1.8.1 mentioned by Lead; no separate overlay installed; exact execution contract governs scheduler'}
  const result=freeze({plan,reserve,policy,admission,checkpoint,genesis:parse('REPORTS/T1_CAMPAIGN_GENESIS_RECEIPT.json'),reuse:parse('REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json'),envelope:{...envelopePayload,hash:identity(envelopePayload)}})
  accepted.add(result);return result
}
export function assertAccepted(value){if(!accepted.has(value))throw new Error('B1_ACCEPTED_PROOF_REQUIRED')}
export function loadAccepted(root){
  validateR3R1Source(root);proveUnchangedObservationCode(root)
  const manifest=fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_SOURCE_MANIFEST.sha256'))
  const prefix=fs.readFileSync(path.join(root,'docs/source/ACTIVE_R3_R1_SOURCE_MANIFEST.sha256'),'utf8')
  if(sha(manifest)!==MANIFEST_SHA||manifest.toString()!==prefix+CONTRACT_SHA+'  '+CONTRACT+'\n'||sha(fs.readFileSync(path.join(root,CONTRACT)))!==CONTRACT_SHA)throw new Error('B1_SOURCE_PIN')
  execFileSync('git',['merge-base','--is-ancestor',ACCEPTED_COMMIT,'HEAD'],{cwd:root,stdio:'pipe'})
  if(execFileSync('git',['rev-parse',ACCEPTED_COMMIT+'^{tree}'],{cwd:root,encoding:'utf8'}).trim()!==ACCEPTED_TREE)throw new Error('B1_ACCEPTED_TREE')
  const archive=path.join(path.dirname(root),'TRACE_ESCAPE_G6P_A2U_R3_R1_FRONTIER_POLICY_IDENTITY_REMEDIATION_DELIVERY_v1.0.0.zip')
  if(sha(fs.readFileSync(archive))!==ACCEPTED_ARCHIVE_SHA)throw new Error('B1_ACCEPTED_ARCHIVE')
  return bindAccepted(Object.fromEntries(Object.keys(PINS).map(name=>[name,execFileSync('unzip',['-p',archive,name],{maxBuffer:16000000})])))
}
