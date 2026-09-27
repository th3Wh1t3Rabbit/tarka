#!/usr/bin/env node
// Capture is already sealed. This runner has no external GET or provider path.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { assertCleanA2uSourceCut } from './g6p-a2u-cut.mjs'
import { identity, sha } from './nq5/schema.mjs'
import { REVIEW_LENSES } from './nq5-r2/review-identity.mjs'
import { proveUnchangedObservationCode, reusePreservedObservation } from './nq5-r2/observation.mjs'
import { validateActiveSchema } from './nq5-r2/authority.mjs'
import { buildFrontierPolicy, assertFrontierPolicyIdentity } from './nq5-r3/frontier-policy.mjs'
import { ACTIVE_R3_R1, R3_CUT, R3_TREE, R3_ARCHIVE_SHA256, CAMPAIGN_ID, PRESERVED_PINS, validateR3R1Source, implementationIdentity } from './nq5-r3-r1/authority.mjs'
import { ACTIVE_R3, R2_ARCHIVE_SHA256 } from './nq5-r3/authority.mjs'
import { loadOfficialSnapshot, buildContractAdmission } from './nq5-r3/contracts.mjs'
import { configuredCampaignRoots, resumeCampaignGenesis, assertGenesis } from './nq5-r3/genesis.mjs'
import { freezeGenesisBatch, serializedSha256, validateFinalPrecall, validateOfflineReport, bindPreservedCheckpointToRemediationCut, R3_R1_GATES } from './nq5-r3/checkpoint.mjs'

const root = path.resolve(fileURLToPath(new URL('..',import.meta.url))), parent = path.dirname(root)
const archiveName = 'TRACE_ESCAPE_G6P_A2U_R3_R1_FRONTIER_POLICY_IDENTITY_REMEDIATION_DELIVERY_v1.0.0.zip', output = path.join(parent,archiveName)
const verifyOnly = process.argv.includes('--verify-only')
if (process.argv.slice(2).some(arg=>arg !== '--verify-only') || !verifyOnly && fs.existsSync(output)) throw new Error('Unsupported option or existing delivery; preserve it.')
if (!process.execArgv.some(arg=>arg.includes('hold.cjs'))) throw new Error('External network hold preload required.')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'trace-nq5-r3-r1-')), delivery = path.join(temporary,'delivery')
fs.mkdirSync(delivery)
const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64000000}).trim()
const hash = file => sha(fs.readFileSync(file))
const write = (name,value) => { const file = path.join(delivery,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : JSON.stringify(value,null,2) + '\n') }
function files(directory) { return fs.readdirSync(directory).sort().flatMap(name=>{const file=path.join(directory,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw new Error('Unexpected governed symlink.');return stat.isDirectory()?files(file):[file]}) }
// Explicit safe variables only: never enumerate, read or copy the key variable.
const childEnvironment = Object.fromEntries(['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','DISPLAY','XDG_RUNTIME_DIR','PLAYWRIGHT_BROWSERS_PATH','npm_config_cache'].flatMap(name=>process.env[name] === undefined ? [] : [[name,process.env[name]]]))
Object.assign(childEnvironment,{PYTHONDONTWRITEBYTECODE:'1',NODE_OPTIONS:`--require ${path.join(root,'scripts/nq5-r2/hold.cjs')}`,npm_config_update_notifier:'false'})
function run(command,args,cwd=root) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env:childEnvironment,stdio:['ignore','pipe','pipe']});let stdout='',stderr=''
    child.stdout.on('data',bytes=>{stdout+=bytes;if(stdout.length>64000000)child.kill()});child.stderr.on('data',bytes=>{stderr+=bytes;if(stderr.length>64000000)child.kill()})
    child.on('error',()=>reject(new Error('Local verification tool unavailable.')))
    child.on('close',code=>code===0?resolve({stdout,stderr,exitCode:0}):reject(new Error(`Local suite failed before publication: ${command}\n${stdout}\n${stderr}`)))
  })
}
const historic = [
  ['TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.0.zip','f0840693e7a751a9b58f0dc4b9872e54c43012bea961239eb7e5417fc7865598'],
  ['TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.1.zip','fa80eb43041563e8331743b904fc0e49eb1cdd6470b1d968329cb101a5362b0c'],
  ['TRACE_ESCAPE_G6P_A2U_NQ5_PRECAMPAIGN_CHECKPOINT_DELIVERY_v1.0.2.zip','7fdf2b7c126d6b2b04b186f9674dd00a8eba7adee312d4b1cec2fc868e405403'],
  ['TRACE_ESCAPE_G6P_A2U_R1_OFFLINE_GATE_COMPLETION_AND_PRECALL_CHECKPOINT_DELIVERY_v1.0.0.zip','a182e4a3b6325e5e069cd4c1683d82035d9275046379ee24257558d567bff185'],
  ['TRACE_ESCAPE_G6P_A2U_R2_AUTHORITY_PARITY_AND_T1_PLAN_REMEDIATION_DELIVERY_v1.0.0.zip',R2_ARCHIVE_SHA256],
 ['TRACE_ESCAPE_G6P_A2U_R3_CONTRACT_ADMISSION_CAMPAIGN_GENESIS_AND_FINAL_PRECALL_DELIVERY_v1.0.0.zip',R3_ARCHIVE_SHA256],
]
try {
  const cut=assertCleanA2uSourceCut(root),source=validateR3R1Source(root),snapshot=loadOfficialSnapshot(root),admission=buildContractAdmission(snapshot,'PRO')
  proveUnchangedObservationCode(root)
  const historicalEvidence=()=>Object.fromEntries(['artifacts/g6p-a2u','artifacts/g6p-a2p/verification'].flatMap(relative=>files(path.join(root,relative))).map(file=>[path.relative(root,file),hash(file)]))
  const preserved=identity(historicalEvidence())
  const unchanged=()=>{if(identity(assertCleanA2uSourceCut(root))!==identity(cut)||identity(historicalEvidence())!==preserved)throw new Error('Source or historical artifacts changed.');for(const[name,expected]of historic)if(hash(path.join(parent,name))!==expected)throw new Error('Historical delivery changed.');validateR3R1Source(root);proveUnchangedObservationCode(root);if(loadOfficialSnapshot(root).indexSha256!==snapshot.indexSha256)throw new Error('Sealed official snapshot changed.')}
  unchanged();await run('git',['merge-base','--is-ancestor',R3_CUT,cut.commit])
  const acceptedArchive=path.join(parent,historic.at(-1)[0]),acceptedBytes=Object.fromEntries(Object.entries(PRESERVED_PINS).map(([name,digest])=>{const bytes=execFileSync('unzip',['-p',acceptedArchive,name],{maxBuffer:64000000});if(sha(bytes)!==digest)throw new Error('Accepted artifact pin mismatch.');return [name,bytes]}))
  if(serializedSha256(admission)!==PRESERVED_PINS['PLANS/PLAN_SPECIFIC_OFFICIAL_CONTRACT_ADMISSION.json'])throw new Error('Accepted admission regeneration not byte-identical.')
  const originalPolicy=JSON.parse(execFileSync('unzip',['-p',acceptedArchive,'PLANS/T1_FRONTIER_POLICY.json'])),{hash:originalStaleHash,...originalPolicyContents}=originalPolicy,originalRecomputedIdentity=identity(originalPolicyContents)
  if(originalStaleHash!=='b175c78cb896ceeca0061ef12bac1b0d07a851de68bb402389c4864dc8ebd62f'||originalRecomputedIdentity!=='b31f84c2aa26ab2771291d56954c453a06f218cc0c4f2dbcd16a3c631b2a5b06')throw new Error('Reviewed frontier falsifier does not reproduce.')
  for(const file of new Set(snapshot.index.snapshots.map(doc=>doc.file)))if(!fs.readFileSync(path.join(root,'docs/official/r3',file)).equals(execFileSync('unzip',['-p',acceptedArchive,'OFFICIAL_DOCS/'+file],{maxBuffer:64000000})))throw new Error('Accepted documentation changed.')
  const verifyPreserved=directory=>{for(const [name,bytes]of Object.entries(acceptedBytes))if(!fs.readFileSync(path.join(directory,name)).equals(bytes))throw new Error('Preserved R3 artifact bytes changed.')}

  const review=JSON.parse(fs.readFileSync(path.join(root,'docs/G6P_A2U_R3_R1_REVIEW.json')))
  if(review.status!=='PASS_BOUNDED_R3_R1_SCOPE'||review.unresolvedAcceptedP0P1!==0||review.implementationSha256!==implementationIdentity(root)||review.lenses.map(item=>item.name).sort().join()!==[...REVIEW_LENSES].sort().join()||review.lenses.some(item=>item.status!=='PASS_BOUNDED_OFFLINE_SCOPE'))throw new Error('Dedicated R3 review incomplete or stale.')
  write('EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json',review)
  write('SOURCE_INSTALL/SOURCE_DELTA_INSTALLATION_REPORT.json',{...source,candidate:cut,reviewedR3ArchiveSha256:R3_ARCHIVE_SHA256,reviewedR3Commit:R3_CUT})
  write('SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256',fs.readFileSync(path.join(root,'docs/source/ACTIVE_R3_R1_SOURCE_MANIFEST.sha256')))
  for(const [name,bytes]of Object.entries(acceptedBytes))write(name,bytes)
  const verification=[],unitCases=[],browserCases=[],reportSchemaCases=[]
  const recordSuite=(name,log)=>{if(!log.trim())throw new Error('Empty major-suite evidence.');write(`VERIFICATION/${name}.log`,log);verification.push({suite:name,status:'PASS',log:`VERIFICATION/${name}.log`,sha256:hash(path.join(delivery,`VERIFICATION/${name}.log`))});process.stdout.write(`${name}: PASS\n`)}
  const suite=async(name,command,args,cwd=root,format)=>{
    process.stdout.write(`VERIFY ${name}\n`);const result=await run(command,args,cwd);let log=result.stdout+result.stderr
    if(format==='schema'){const report=JSON.parse(result.stdout);if(report.status!=='PASS'||report.case_count!==118||report.results.some(test=>!test.expectation_met)||report.credential_resolution_attempted||report.provider_calls_issued)throw new Error('Schema/semantic controls failed.');reportSchemaCases.push(...report.results.map(test=>({name:test.name,result:'PASS',syntheticTestOnly:true})));log=`${name}: PASS;118 named schema/semantic/privacy controls in OFFLINE_GATE_MATRIX; provider calls0, credentials false.\n`}
    if(format==='vitest'){const report=JSON.parse(result.stdout);if(!report.success||report.numFailedTests)throw new Error('Unit results failed.');unitCases.push(...report.testResults.flatMap(file=>file.assertionResults.map(test=>({suite:path.relative(root,file.name),name:test.fullName,result:test.status.toUpperCase()}))));log=`${name}: PASS; files${report.testResults.length}; tests${report.numPassedTests}; failed0. Named assertions occur once in OFFLINE_GATE_MATRIX.\n`}
    if(format==='playwright'){const report=JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))),visit=suites=>suites.flatMap(node=>[...(node.specs??[]).map(spec=>({name:spec.title,result:spec.ok&&spec.tests.every(test=>test.status==='expected')?'PASS':'FAIL'})),...visit(node.suites??[])]),cases=visit(report.suites);if(cases.some(test=>test.result!=='PASS')||report.stats.unexpected)throw new Error('Browser results failed.');browserCases.push(...cases);log=`${name}: PASS; journeys${cases.length}; unexpected0. Named journeys occur once in OFFLINE_GATE_MATRIX.\n`}
    recordSuite(name,log)
  }
  recordSuite('additive-source-official-contract-admission',`Current exact source admission PASS:52 unchanged foundation files,7 exact additive files (3 material authorities); precedence v1.7.3 above v1.7.2/v1.7.1/v1.7.0.\nExact named snapshots:${snapshot.index.snapshots.length}; unique Markdown payloads:${new Set(snapshot.index.snapshots.map(doc=>doc.file)).size}; index SHA256:${snapshot.indexSha256}.\nFour exact POST endpoint/request/response schemas parsed; lookup shares transactions bytes. Current complete snapshot:${admission.requiredSnapshotComplete}; publicly admitted families:${admission.contracts.length}.\nTwo exact clarification answers grant no explicit positive permission; counterparties and lookup are excluded, not aliased or counted.\nNo retrieval/provider/credential path executes in this verification runner.\n`)
  recordSuite('dedicated-review',`Dedicated R3 review identity:${review.implementationSha256}; required lenses8, completed8; unresolved accepted P0/P1:0.\nIndependent verification and bounded limitations are recorded once in REVIEW_FINDINGS_RESOLUTIONS.\n`)
  await suite('active-source-validator','python3',['VALIDATE_SOURCE_SET.py'],path.join(root,'docs/source/v1.7.0'))
  await suite('report-schema-semantics','python3',['scripts/test-nq5-report-validation.py'],root,'schema')
  await suite('typecheck-lint','npm',['run','check'])
  await suite('acquisition-compile','npm',['run','acquisition:compile'])
  await suite('unit-domain-storage-planner-projection','npx',['--no-install','vitest','run','tests/unit','--reporter=json'],root,'vitest')
  await suite('acquisition-regression','npx',['--no-install','vitest','run','tests/acquisition','--reporter=json'],root,'vitest')
  await suite('browser-accessibility-performance','npm',['run','test:e2e','--','--reporter=json'],root,'playwright')
  await suite('production-build','npm',['run','build'])
  await suite('browser-boundary','npm',['run','browser-boundary:verify'])
  await suite('records-office-art-shell-boundary','npm',['run','g6p:a1:boundary:verify'])
  await suite('euler-frozen-public-pack','npm',['run','g6:pack:verify'])
  await suite('current-project-clock-status','npm',['run','project:status'])
  const bundle=path.join(delivery,'GIT/trace-escape-complete.bundle');fs.mkdirSync(path.dirname(bundle),{recursive:true})
  await run('git',['-c','pack.threads=1','bundle','create',bundle,'HEAD']);const bundleResult=await run('git',['bundle','verify',bundle])
  const clone=path.join(temporary,'clone');await run('git',['clone','--quiet',bundle,clone])
  const cloneCommit=(await run('git',['rev-parse','HEAD'],clone)).stdout.trim(),cloneTree=(await run('git',['rev-parse','HEAD^{tree}'],clone)).stdout.trim(),fsck=await run('git',['fsck','--full','--strict'],clone)
  if(cloneCommit!==cut.commit||cloneTree!==cut.tree)throw new Error('Direct fresh clone differs from candidate.')
  recordSuite('bundle-clone-fsck',(bundleResult.stdout+bundleResult.stderr).replaceAll(bundle,'GIT/trace-escape-complete.bundle')+`\ngit clone exit0\ngit rev-parse HEAD: ${cloneCommit}\ngit rev-parse HEAD^{tree}: ${cloneTree}\ngit fsck --full --strict exit${fsck.exitCode}; ${fsck.stdout.trim()||'no diagnostics'}\n`+fsck.stderr)
  await suite('candidate-history-secret-scan','node',['scripts/verify-git-secret-history.mjs'],clone)
  write('SOURCE_DIFF.patch',(await run('git',['diff','--binary',R3_CUT,cut.commit])).stdout)
  fs.cpSync(path.join(root,'dist'),path.join(clone,'dist'),{recursive:true})
  await suite('scoped-source-build-secret-scan','node',[path.join(root,'scripts/scan-prohibitions.mjs'),clone])
  unchanged()
  if(unitCases.filter(test=>/nq5-r3-checkpoint/.test(test.suite)).length<47||unitCases.filter(test=>/nq5-r3-r1-frontier-policy/.test(test.suite)).length<35||browserCases.filter(test=>/^R2 parity/.test(test.name)).length!==6||!browserCases.some(test=>/12,288/.test(test.name)))throw new Error('Mandatory R3-R1/R3/R2 evidence missing.')
  const accountBytes=acceptedBytes['REPORTS/NQ5_ACCOUNT_PREFLIGHT_REDACTED.json'],priorReuseBytes=acceptedBytes['REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json']
  validateActiveSchema('account',JSON.parse(accountBytes))
  const {buildFrozenFixture}=await import('../.acquisition-build/src/investigation/fixture.js'),scenarioRoot=path.join(root,'public/scenarios/euler-2023-false-exit')
  const fixture=buildFrozenFixture(JSON.parse(fs.readFileSync(path.join(scenarioRoot,'scenario.json'))),JSON.parse(fs.readFileSync(path.join(scenarioRoot,'evidence-graph.json'))))
  let observation=null,genesis=null,frozen=null
  const reuse=JSON.parse(priorReuseBytes),genesisReceipt=JSON.parse(acceptedBytes['REPORTS/T1_CAMPAIGN_GENESIS_RECEIPT.json'])
  const historicalContext={candidateCommit:R3_CUT,candidateTree:R3_TREE,sourceIdentity:identity(ACTIVE_R3),accountObservationIdentity:reuse.originalTerminalIdentity,accountReportSha256:sha(accountBytes)}
  if(!verifyOnly){
    try {
      observation=reusePreservedObservation(root,accountBytes)
      if(serializedSha256(observation.receipt)!==sha(priorReuseBytes))throw new Error('Original observation reuse receipt drift.')
      const creation={...historicalContext,candidateCommit:'41be40d234c7a7f31d9167294dafa5cf8a3e94a5',candidateTree:'718b8b8e1c0c04e6195130d96078f78c70a6ecc9'}
      genesis=resumeCampaignGenesis(configuredCampaignRoots(),CAMPAIGN_ID,creation,historicalContext,root,'462f2a627c6f3f6c00fd521626a069d53a4713d60627851fa04eff691abc4a57')
      if(serializedSha256(genesis)!==PRESERVED_PINS['REPORTS/T1_CAMPAIGN_GENESIS_RECEIPT.json'])throw new Error('Historical genesis receipt bytes changed.')
      frozen=freezeGenesisBatch(fixture,admission,observation.account,genesis,historicalContext)
      if(serializedSha256(frozen.plan)!==PRESERVED_PINS['PLANS/T1_PLAN.json']||serializedSha256(frozen.reserve)!==PRESERVED_PINS['PLANS/T1_RESERVE_PLAN.json'])throw new Error('Accepted plan/reserve regeneration not byte-identical.')
      frozen.policy=bindPreservedCheckpointToRemediationCut(frozen.plan,root,cut)
      assertGenesis(genesis,historicalContext)
    } catch { genesis=null;frozen=null }
  }
  const plan=frozen?.plan??JSON.parse(acceptedBytes['PLANS/T1_PLAN.json']),reserve=frozen?.reserve??JSON.parse(acceptedBytes['PLANS/T1_RESERVE_PLAN.json'])
  const policy=frozen?.policy??buildFrontierPolicy(fixture,plan,admission,identity(ACTIVE_R3_R1))
  assertFrontierPolicyIdentity(policy,{fixture,plan,admission,campaignId:CAMPAIGN_ID,sourceIdentity:identity(ACTIVE_R3_R1)})
  write('PLANS/T1_FRONTIER_POLICY.json',policy);verifyPreserved(delivery)
  write('EVIDENCE/T1_UTILITY_AND_ISSUABILITY_REPORT.json',execFileSync('unzip',['-p',acceptedArchive,'EVIDENCE/T1_UTILITY_AND_ISSUABILITY_REPORT.json']))
  const identityEvidence={schemaVersion:'1.0.0',acceptedFinding:'A2U-R3-P1-01',status:genesis&&frozen?'PASS_LOCAL_READ_ONLY_REVALIDATION_AND_POLICY_BINDING':'BLOCKED_WITH_EVIDENCE',currentCandidate:cut,acceptedFrozenCandidate:{commit:R3_CUT,tree:R3_TREE},activeSourceIdentity:identity(ACTIVE_R3_R1),frozenArtifactSourceIdentity:identity(ACTIVE_R3),reviewedR3ArchiveSha256:R3_ARCHIVE_SHA256,preservedArtifacts:PRESERVED_PINS,preservedArtifactBytesEqual:true,officialDocumentBodiesUnchanged:true,officialDocumentBodiesIncluded:false,staleOriginalPolicyHash:'b175c78cb896ceeca0061ef12bac1b0d07a851de68bb402389c4864dc8ebd62f',canonicalOriginalExtendedPayloadIdentity:'b31f84c2aa26ab2771291d56954c453a06f218cc0c4f2dbcd16a3c631b2a5b06',correctedPlanBoundPolicyIdentity:policy.hash,correctedPolicyFileSha256:serializedSha256(policy),frozenPlanFileSha256:serializedSha256(plan),frozenPlanCanonicalIdentity:plan.hash,campaignId:CAMPAIGN_ID,genesisReceiptSha256:serializedSha256(genesisReceipt),genesisRecordSha256:genesisReceipt.primaryGenesisSha256,journalBytes:genesisReceipt.journalBytes,journalSha256:genesisReceipt.journalSha256,actualGenesisReopenedReadOnly:!!genesis,actualCampaignExecutionAdmission:'HELD_BEFORE_ANY_PROVIDER_REQUEST',privateArtifactsModified:false,campaignCreationRepeated:false,credentialAccess:false,externalRequests:0,providerCalls:0,accountAttemptsAdditional:0,qualificationAttempts:0,qualificationCounted:0}
  write('EVIDENCE/FRONTIER_POLICY_IDENTITY_AND_REPORT_BINDING.json',identityEvidence)
  recordSuite('frontier-policy-readonly-preservation',`Canonical policy verifier PASS; policy identity:${policy.hash}; exact file SHA256:${serializedSha256(policy)}.\nSeven accepted public artifacts byte-identical; documentation bodies verified locally, not duplicated.\nActual genesis reopened read-only:${!!genesis}; no creation/repair/private mutation. Direct evidence: EVIDENCE/FRONTIER_POLICY_IDENTITY_AND_REPORT_BINDING.json.\n`)
  const gates=Object.fromEntries(R3_R1_GATES.map(gate=>[gate,'PASS'])),blockers=[]
  const block=(id,summary,refs,affected)=>{blockers.push({id,summary,evidence_refs:refs});for(const gate of affected)gates[gate]='NOT_VERIFIED'}
  if(admission.status!=='PASS_PLAN_SPECIFIC_CONTRACT_ADMISSION')block('EXACT_REQUIRED_OFFICIAL_SNAPSHOT_INCOMPLETE','Required current endpoint snapshot is unavailable or admission incomplete; held families are not permission.',['OFFICIAL_DOCS/INDEX.json','PLANS/PLAN_SPECIFIC_OFFICIAL_CONTRACT_ADMISSION.json'],['current_official_docs_snapshot'])
  if(!observation)block(verifyOnly?'ACTUAL_OBSERVATION_NOT_READ_VERIFICATION_ONLY':'ORIGINAL_OBSERVATION_REUSE_PROOF_FAILED','Actual durable original observation revalidation is required; no second account attempt.',['REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json'],['account_observation_local_reuse'])
  if(!genesis)block('ACTUAL_CAMPAIGN_GENESIS_NOT_VERIFIED','Exclusive committed current campaign baseline is not verified; missing history never means zero.',['REPORTS/T1_CAMPAIGN_GENESIS_RECEIPT.json'],['campaign_genesis'])
  if(!frozen)block('NO_VERIFIED_FROZEN_NEXT_BATCH','No issue authorization without a meaningful currently admitted frozen batch and protected reserve proof.',['PLANS/T1_PLAN.json','PLANS/T1_RESERVE_PLAN.json'],['frozen_next_batch','protected_reserve'])
  const status=blockers.length?'BLOCKED_WITH_EVIDENCE':'DELIVERED_PENDING_LEAD_REVIEW',generated=new Date().toISOString()
  const offline={schema_version:'1.2.0',status:blockers.length?'BLOCKED_WITH_EVIDENCE':'PASS_OFFLINE_GATES_ONLY',active_gate:'G6P-A2U-R3-R1',generated_at_utc:generated,candidate_commit:cut.commit,candidate_tree:cut.tree,parent_authorization_id:'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001',active_source_identity:identity(ACTIVE_R3_R1),mandatory_offline_gates:gates,blockers,credential_access:false,provider_calls:0,AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT:false,account_attempt_consumed:1,additional_account_attempts_authorized:0,scope:'CURRENT_OFFLINE_GATES_ONLY_NO_NEW_ACCOUNT_AUTHORITY'}
  validateOfflineReport(offline);write('REPORTS/NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.json',offline)
  const final={schema_version:'1.3.0',status,active_gate:'G6P-A2U-R3-R1',generated_at_utc:generated,candidate_commit:cut.commit,candidate_tree:cut.tree,active_source_identity:identity(ACTIVE_R3_R1),active_source_manifest_sha256:source.manifestSha256,AUTHORIZED_TO_ISSUE:!blockers.length,AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT:false,additional_account_attempts:0,historical_account_attempts_consumed:1,qualification_attempts:0,qualification_counted:0,provider_calls_in_r3:0,credential_access_in_r3:false,checkpoint_hold:true,qualification_execution_allowed:false,original_account_report_sha256:sha(accountBytes),account_observation_reuse_receipt_sha256:hash(path.join(delivery,'REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json')),campaign_genesis_receipt_sha256:serializedSha256(genesisReceipt),official_contract_admission_sha256:serializedSha256(admission),t1_plan_sha256:serializedSha256(plan),t1_plan_frozen:plan.frozen===true,t1_plan_status:plan.frozen===true?'FROZEN_NEXT_BATCH':'UNFROZEN_NOT_ISSUABLE',reserve_plan_sha256:serializedSha256(reserve),offline_report_sha256:serializedSha256(offline),available_credits:observation?.account.account.available_credits??null,protected_reserve_credits:250,gates,blockers,campaign_id:CAMPAIGN_ID,frontier_policy_sha256:hash(path.join(delivery,'PLANS/T1_FRONTIER_POLICY.json')),frontier_policy_canonical_identity:policy.hash,frontier_policy_identity_verified:true,frozen_artifact_source_identity:identity(ACTIVE_R3),frozen_checkpoint_candidate_commit:R3_CUT,frozen_checkpoint_candidate_tree:R3_TREE}
  const finalEvidence={offlineReport:offline,accountReuseReceipt:reuse,frontierPolicy:policy,frontierPolicyBytes:fs.readFileSync(path.join(delivery,'PLANS/T1_FRONTIER_POLICY.json'))}
  validateFinalPrecall(final,plan,reserve,finalEvidence);write('REPORTS/NQ5_PRECALL_AUTHORIZATION_REPORT.json',final)
  write('EVIDENCE/OFFLINE_GATE_MATRIX.json',{candidate:cut,status,gates,assertions:unitCases,reportSchemaCases,browserJourneys:browserCases,providerCalls:0,credentialAccess:false,qualificationAttempts:0,qualificationCounted:0,blockers})
  write('EVIDENCE/KNOWN_LIMITATIONS.md',`# R3-R1 bounded local remediation\n\n${status}. Stop before qualification for separate Lead review. R3 contracts, genesis and batch are accepted for continuation; final pre-call authorization is not Lead-accepted. This local-only policy remediation makes no self-acceptance claim. Counterparties and exact lookup have complete schemas/prices but no exact positive redistribution clarification; both are excluded. Existing accepted Euler evidence is unchanged. Conditional useful durable frontiers, not the15-row initial plan, govern the1024 outcome floor. No provider/account/credential request, purchase or subscription change occurred. Prior discovery32 attempts/37 credits and consumed account1 attempt/0 credits remain separate from zero T1 history.\n\nNo final art, animation, narrative, Mission02, lock, hosting, release or manual assistive-technology certification is claimed. Source remains additive; the asset lane is untouched. No private paths, journals, raw account bytes or provider responses are packaged.\n\n`+blockers.map(item=>item.id+': '+item.summary).join('\n')+'\n')
  write('README.md',`# TRACE//ESCAPE A2U-R3-R1\n\nStatus: ${status}. Candidate ${cut.commit}; tree ${cut.tree}. Restore GIT/trace-escape-complete.bundle; SOURCE_DIFF.patch is against accepted R3 continuation ${R3_CUT}. Additive source and accepted official index are governed by manifests. Official bodies remain in the accepted R3 delivery and are not duplicated here.\n\nCurrently admitted transactions/state only; counterparties/lookup remain excluded. Final checkpoint issue authorization:${final.AUTHORIZED_TO_ISSUE}; qualification execution is held regardless, pending separate Lead review. Qualification attempts/counts0; provider calls0; credential access false. Account report is byte-identical and consumed observation reuse is read-only. Genesis status:${genesisReceipt.status}; frozen next batch:${plan.requests.length}; protected reserve250. No future outcomes are promised. MANIFEST.sha256 governs every other payload. No source duplication, private evidence or separate asset lane is included.\n`)
  write('DELIVERY_MANIFEST.json',{schemaVersion:'1.0.0',archiveName,status,...cut,resumedFrom:R3_CUT,reviewedR3ArchiveSha256:R3_ARCHIVE_SHA256,activeSourceIdentity:identity(ACTIVE_R3_R1),frozenArtifactSourceIdentity:identity(ACTIVE_R3),sourceVersions:['1.7.0','1.7.1','1.7.2','1.7.3'],unchangedSourcePreserved:true,originalAccountReportByteIdentical:true,originalAccountReuseReceiptByteIdentical:!!observation,originalAccountReportSha256:sha(accountBytes),accountObservationReuseStatus:reuse.status,campaignGenesisStatus:genesisReceipt.status,campaignId:genesisReceipt.campaignId??null,frozenNextBatch:plan.frozen?plan.requests.length:0,AUTHORIZED_TO_ISSUE:final.AUTHORIZED_TO_ISSUE,qualificationExecutionAllowed:false,checkpointHold:true,qualificationAttempts:0,qualificationCounted:0,providerCallsInR3:0,credentialAccessInR3:false,documentationRetrievalInRemediation:false,acceptedArtifactPreservationVerified:true,frontierPolicyIdentity:policy.hash,frontierPolicySha256:serializedSha256(policy),additionalAccountAttempts:0,priorDiscovery:{attempts:32,credits:37},consumedAccount:{attempts:1,credits:0},completeClonableBundle:true,privatePathsPackaged:false,privateJournalPackaged:false,rawPayloadPackaged:false,separateAssetLanePackaged:false,priorEvidencePreserved:true,leadAcceptanceClaimed:false,finalArtClaimed:false,finalNarrativeClaimed:false,finalAnimationInventoryClaimed:false,mission02Admitted:false,contentLockClaimed:false,hostingClaimed:false,releaseReadinessClaimed:false,blockers})
  await suite('redacted-delivery-secret-scan','node',[path.join(root,'scripts/scan-prohibitions.mjs'),delivery])
  write('EVIDENCE/VERIFICATION_SUMMARY.json',{schemaVersion:'1.0.0',status,localExecutedSuites:'PASS',candidate:cut,suites:verification,unitAssertions:unitCases.length,browserJourneys:browserCases.length,accountReuse:reuse.status,campaignGenesis:genesisReceipt.status,frozenBatch:plan.frozen?plan.requests.length:0,protectedObservationCodeUnchanged:true,historicalEvidencePreserved:true,historicalArchivesPreserved:Object.fromEntries(historic),freshCloneIdentityVerified:true,directBundleCloneFsckLogNonempty:true,officialRequiredSnapshotsVerified:admission.requiredSnapshotComplete,heldFamiliesExcluded:true,networkHoldPreload:true,externalRequestsInVerification:0,documentationRetrievalInRemediation:false,credentialAccess:false,providerCalls:0,qualificationAttempts:0,qualificationCounted:0,dedicatedReviewIdentity:implementationIdentity(root),blockers})
  const allowed=/^(?:README\.md|DELIVERY_MANIFEST\.json|MANIFEST\.sha256|SOURCE_DIFF\.patch|GIT\/trace-escape-complete\.bundle|SOURCE_INSTALL\/(?:SOURCE_DELTA_INSTALLATION_REPORT\.json|ACTIVE_SOURCE_MANIFEST\.sha256)|OFFICIAL_DOCS\/INDEX\.json|REPORTS\/(?:NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT|NQ5_ACCOUNT_PREFLIGHT_REDACTED|ACCOUNT_OBSERVATION_REUSE_RECEIPT|T1_CAMPAIGN_GENESIS_RECEIPT|NQ5_PRECALL_AUTHORIZATION_REPORT)\.json|PLANS\/(?:PLAN_SPECIFIC_OFFICIAL_CONTRACT_ADMISSION|T1_PLAN|T1_FRONTIER_POLICY|T1_RESERVE_PLAN)\.json|EVIDENCE\/(?:FRONTIER_POLICY_IDENTITY_AND_REPORT_BINDING|OFFLINE_GATE_MATRIX|T1_UTILITY_AND_ISSUABILITY_REPORT|VERIFICATION_SUMMARY|REVIEW_FINDINGS_RESOLUTIONS)\.json|EVIDENCE\/KNOWN_LIMITATIONS\.md|VERIFICATION\/[a-z-]+\.log)$/
  if(files(delivery).some(file=>!allowed.test(path.relative(delivery,file))))throw new Error('Unexpected payload.')
  write('MANIFEST.sha256',files(delivery).map(file=>hash(file)+'  '+path.relative(delivery,file)).sort().join('\n')+'\n');unchanged()
  if(verifyOnly)process.stdout.write(JSON.stringify({status,localSuites:'PASS',actualObservationRead:false,actualGenesisCreated:false,frozenNextBatch:0,qualificationAttempts:0,qualificationCounted:0})+'\n')
  else{
    const fixed=new Date('2000-01-01T00:00:00Z'),entries=files(delivery).map(file=>{fs.utimesSync(file,fixed,fixed);return path.relative(delivery,file)}).sort(),zip=path.join(temporary,'delivery.zip'),rebuilt=path.join(temporary,'rebuilt.zip')
    await run('zip',['-X','-q',zip,...entries],delivery);await run('zip',['-X','-q',rebuilt,...entries],delivery)
    if(hash(zip)!==hash(rebuilt))throw new Error('Identical archive rebuild failed.')
    await run('unzip',['-t',zip]);const extracted=path.join(temporary,'extracted');fs.mkdirSync(extracted);await run('unzip',['-q',zip,'-d',extracted]);await run('sha256sum',['-c','MANIFEST.sha256'],extracted)
    if(!fs.readFileSync(path.join(extracted,'REPORTS/NQ5_ACCOUNT_PREFLIGHT_REDACTED.json')).equals(accountBytes)||observation&&!fs.readFileSync(path.join(extracted,'REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json')).equals(priorReuseBytes))throw new Error('Historical report/reuse bytes changed.')
    verifyPreserved(extracted)
    const extractedPolicyBytes=fs.readFileSync(path.join(extracted,'PLANS/T1_FRONTIER_POLICY.json'))
    assertFrontierPolicyIdentity(JSON.parse(extractedPolicyBytes),{fixture,plan,admission,campaignId:CAMPAIGN_ID,sourceIdentity:identity(ACTIVE_R3_R1)})
    validateFinalPrecall(JSON.parse(fs.readFileSync(path.join(extracted,'REPORTS/NQ5_PRECALL_AUTHORIZATION_REPORT.json'))),plan,JSON.parse(fs.readFileSync(path.join(extracted,'PLANS/T1_RESERVE_PLAN.json'))),{offlineReport:JSON.parse(fs.readFileSync(path.join(extracted,'REPORTS/NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.json'))),accountReuseReceipt:JSON.parse(fs.readFileSync(path.join(extracted,'REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json'))),frontierPolicy:JSON.parse(extractedPolicyBytes),frontierPolicyBytes:extractedPolicyBytes});unchanged();fs.copyFileSync(zip,output,fs.constants.COPYFILE_EXCL)
    process.stdout.write(JSON.stringify({status,archive:output,sha256:hash(output),...cut,members:entries.length,identicalRebuildVerified:true,governedHashesVerified:true,originalReportByteIdentical:true,originalReuseReceiptByteIdentical:!!observation,genesisStatus:genesisReceipt.status,campaignId:genesisReceipt.campaignId??null,frozenNextBatch:plan.frozen?plan.requests.length:0,expectedCredits:plan.expectedCredits??0,worstCaseCredits:plan.worstCaseCredits??0,AUTHORIZED_TO_ISSUE:final.AUTHORIZED_TO_ISSUE,checkpointHold:true,providerCalls:0,qualificationAttempts:0,qualificationCounted:0})+'\n')
  }
}finally{fs.rmSync(temporary,{recursive:true,force:true})}
