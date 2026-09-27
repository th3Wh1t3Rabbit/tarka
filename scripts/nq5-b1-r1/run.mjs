#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { sourceBinding, implementationDigest, cut, reviewEvidence, CONTRACT, MANIFEST_SHA } from './gates.mjs'
import { preservedCheckpoint, BASE, LEDGER_SHA, B1_SHA } from './checkpoint.mjs'
import { preservedDocs } from './preserved-docs.mjs'
import { requestAudit, balanceReconciliation, resumeEnvelope, utilityBuckets, CONTRACT_SHA } from './audit.mjs'
import { assertResumeAdmission } from './resume-guard.mjs'
import { reconcile } from '../nq5-b1/reconcile.mjs'
import { identity, sha } from '../nq5/schema.mjs'

// This root-cause-blocked invocation never reads the credential, and every child
// gets an explicit safe environment plus the no-network/no-private fixture hold.
const environment=Object.fromEntries(['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','DISPLAY','XDG_RUNTIME_DIR','PLAYWRIGHT_BROWSERS_PATH','npm_config_cache'].flatMap(n=>process.env[n]===undefined?[]:[[n,process.env[n]]]))
process.env=environment
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),parent=path.dirname(root),local=path.join(root,'artifacts/g6p-b1-r1/local')
const childEnv={...environment,PYTHONDONTWRITEBYTECODE:'1',NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs'),npm_config_update_notifier:'false'}
const archiveName='TRACE_ESCAPE_G6P_NQ5_T1_B1_R1_PRESERVED_RAW_DIAGNOSTIC_REQUEST_AUDIT_AND_REMAINING_13_EXECUTION_DELIVERY_v1.0.0.zip'
const write=(dir,name,value)=>{const target=path.join(dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(value)?value:typeof value==='string'?value:JSON.stringify(value,null,2)+'\n')}
const git=(...args)=>execFileSync('git',args,{cwd:root,env:childEnv,encoding:'utf8',maxBuffer:64000000}).trimEnd()
const run=(command,args,cwd=root)=>new Promise((resolve,reject)=>{const c=spawn(command,args,{cwd,env:childEnv,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [c.stdout,c.stderr])stream.on('data',b=>{output+=b;if(output.length>64000000)c.kill()});c.on('error',()=>reject(new Error('R1_LOCAL_TOOL_UNAVAILABLE')));c.on('close',code=>code===0?resolve(output):reject(new Error('R1_LOCAL_SUITE_FAILED')))})
const files=dir=>fs.readdirSync(dir).sort().flatMap(n=>{const f=path.join(dir,n),s=fs.lstatSync(f);if(s.isSymbolicLink())throw new Error('R1_PAYLOAD_SYMLINK');return s.isDirectory()?files(f):[f]})
function snapshot(){let governedSourceCommitted=false;try{cut(root);governedSourceCommitted=true}catch{};return {candidate:{commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}')},governedSourceCommitted,implementationSha256:implementationDigest(root)}}
async function verify(){
  sourceBinding(root);const starting=snapshot(),suites=[]
  const assert=()=>{if(identity(starting)!==identity(snapshot()))throw new Error('R1_VERIFICATION_SOURCE_CHANGED')}
  const suite=async(name,cmd,args,cwd=root)=>{assert();process.stdout.write('LOCAL '+name+'\n');const output=await run(cmd,args,cwd);assert();if(!output.trim())throw new Error('R1_EMPTY_SUITE_LOG');write(local,name+'.log',output);suites.push({name,status:'PASS',sha256:sha(Buffer.from(output))})}
  await suite('execution-adversarial','node',['node_modules/vitest/vitest.mjs','run','tests/unit/nq5-b1-executor.test.mjs','tests/unit/nq5-b1-r1-remediation.test.mjs','--reporter=dot'])
  await suite('source-validator','python3',['VALIDATE_SOURCE_SET.py'],path.join(root,'docs/source/v1.7.0'))
  await suite('report-schema-controls','python3',['scripts/test-nq5-report-validation.py'])
  await suite('typecheck-lint','npm',['run','check'])
  await suite('acquisition-compile','npm',['run','acquisition:compile'])
  await suite('unit-regression','node',['node_modules/vitest/vitest.mjs','run','tests/unit','--exclude','tests/unit/nq5-b1-executor.test.mjs','--exclude','tests/unit/nq5-b1-r1-remediation.test.mjs','--reporter=dot'])
  await suite('acquisition-regression','node',['node_modules/vitest/vitest.mjs','run','tests/acquisition','--reporter=dot'])
  await suite('browser-accessibility-performance','npm',['run','test:e2e','--','--reporter=line'])
  await suite('production-build','npm',['run','build'])
  await suite('browser-boundary','npm',['run','browser-boundary:verify'])
  await suite('records-office-boundary','npm',['run','g6p:a1:boundary:verify'])
  await suite('euler-public-pack','npm',['run','g6:pack:verify'])
  await suite('project-clock-status','npm',['run','project:status'])
  await suite('history-secret-boundary','node',['scripts/verify-git-secret-history.mjs'])
  assert();write(local,'VERIFICATION.json',{schemaVersion:'1.0.0',status:'PASS',generatedAtUtc:new Date().toISOString(),...starting,suites,credentialAccess:false,actualPrivateBaselineAccess:false,providerCalls:0,documentationGets:0,networkHold:true});process.stdout.write('R1_COMPLETE_LOCAL_REGRESSION_PASS\n')
}
function diagnoseLocal(){const context=preservedCheckpoint(root);preservedDocs(root,context.bound);write(local,'B1_PRESERVED_RESPONSE_DIAGNOSTIC.json',context.diagnostic);write(local,'NANSEN_API_REQUEST_AUDIT.json',requestAudit(context.bound,context.prior,context.diagnostic));write(local,'ACCOUNT_WIDE_BALANCE_RECONCILIATION.json',balanceReconciliation(context.prior));process.stdout.write('R1_READ_ONLY_DIAGNOSTIC_ROOT_CAUSE_BLOCK_NO_NETWORK_NO_CREDENTIAL\n')}
async function deliver(){
  const candidate=cut(root),bound=sourceBinding(root),evidence=reviewEvidence(root),context=preservedCheckpoint(root),docs=preservedDocs(root,bound),envelope=resumeEnvelope(bound)
  let blocked=false;try{assertResumeAdmission(bound,context.prior,context.diagnostic,envelope)}catch(error){if(error.message==='R1_ROOT_CAUSE_ADMISSION_BLOCKED')blocked=true;else throw error}
  if(!blocked)throw new Error('R1_BLOCKED_PACKAGE_REQUIRES_ROOT_CAUSE_FAILURE')
  const data=reconcile(bound,context.roots),audit=requestAudit(bound,context.prior,context.diagnostic),balance=balanceReconciliation(context.prior)
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'trace-b1-r1-delivery-')),delivery=path.join(temp,'delivery');fs.mkdirSync(delivery)
  try{
    const put=(name,v)=>write(delivery,name,v),status='BLOCKED_WITH_EVIDENCE'
    const summary={schemaVersion:'1.0.0',status,candidate,campaignId:bound.envelope.campaignId,resumeEnvelopeHash:envelope.hash,rootCauseDisposition:'UNADMITTED_PROVIDER_NULL_SEMANTICS_AND_AMBIGUOUS_TEMPORAL_WINDOW',additionalRequests:0,additionalAttempts:0,additionalActualCredits:0,cumulativeAttempts:2,cumulativeProvider2xx:2,cumulativeCountedSuccesses:0,cumulativeActualCredits:2,remainingFrozenUnissued:13,credentialResolutionInR1:false,documentationGetsInR1:0,documentationDisposition:docs.disposition,resumeLockCreated:false,resumeReceiptCreated:false,priorLockPreserved:true,privateHistoryModified:false,liveResumeImplementationDisposition:'PURE_ADMISSION_AND_IDENTITY_GUARDS_ONLY_NO_LIVE_ENTRYPOINT_BECAUSE_ROOT_CAUSE_BLOCKED',noQualificationOrGameplayEvidenceFromPriorB1:true}
    put('README.md','# TRACE//ESCAPE B1-R1\n\nBLOCKED_WITH_EVIDENCE. Exact preserved responses show null-vs-number provider-schema mismatch and timezone-less / nominally pre-window balances. No schema widening, inferred timezone, window change or response reclassification is admitted. Additional requests0; cumulative attempts2/provider2xx2/count0/actual credits2. All13 remain unissued. Stop for Lead review.\n\nSix documentation snapshots are preserved exact B1 bytes, NOT refreshed: local root-cause failure prohibits external retrieval. Restore GIT/trace-escape-complete.bundle; all payloads are manifest-bound. No live resume entrypoint/lock/receipt was created or invoked.\n')
    put('DELIVERY_MANIFEST.json',{...summary,archiveName,reviewedB1ArchiveSha256:B1_SHA,reviewedB1Commit:BASE,executionContractSha256:CONTRACT_SHA,sourceManifestSha256:MANIFEST_SHA,rawBodiesPackaged:false,privateJournalPackaged:false,privatePathsPackaged:false,credentialPackaged:false,artLanePackaged:false,additionalAccountAttempts:0,alchemyCalls:0,batch2Generated:false,qualificationFloorClaimed:false,finalArtClaimed:false,mission02Claimed:false,hostingOrReleaseClaimed:false})
    put('SOURCE_INSTALL/EXECUTION_CONTRACT_INSTALLATION_REPORT.json',{status:'EXACT_ADDITIVE_CONTRACT_INSTALLED',contractPath:CONTRACT,executionContractSha256:CONTRACT_SHA,activeSourceManifestSha256:MANIFEST_SHA,unchangedFoundationFiles:60,additiveFiles:1})
    put('SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256',fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R1_SOURCE_MANIFEST.sha256')))
    put('OFFICIAL_DOCS/INDEX.json',docs.indexBytes);for(const [n,b]of Object.entries(docs.bodies))put('OFFICIAL_DOCS/'+n+'.md',b)
    put('EXECUTION/T1_B1_R1_RESUME_ENVELOPE.json',envelope)
    put('SCHEMAS/NANSEN_API_REQUEST_AUDIT.schema.json',fs.readFileSync(path.join(root,'schemas/NANSEN_API_REQUEST_AUDIT.schema.json')))
    put('REPORTS/T1_B1_R1_EXECUTION_REPORT.json',summary);put('REPORTS/T1_B1_R1_RECONCILIATION_REPORT.json',{...data.report,...summary})
    put('REPORTS/T1_B1_R1_UTILITY_REPORT.json',{...data.utility,...utilityBuckets(audit)});put('REPORTS/T1_CAMPAIGN_STATE_REDACTED.json',{...summary,reviewedLedgerSha256:LEDGER_SHA,endingLedgerSha256:context.prior.bytesSha256,endingLedgerBytes:context.prior.bytes,newCampaignCreated:false,startingTwoTerminalsUnchanged:true,priorDiscovery:{attempts:32,credits:37},historicalAccount:{attemptsConsumed:1,additionalAttempts:0,credits:0}})
    put('PUBLIC/NQ5_PUBLIC_CALL_INDEX.json',data.publicIndex);put('PUBLIC/NQ5_PUBLIC_CALL_INDEX.sha256',sha(fs.readFileSync(path.join(delivery,'PUBLIC/NQ5_PUBLIC_CALL_INDEX.json')))+'  NQ5_PUBLIC_CALL_INDEX.json\n')
    put('EVIDENCE/B1_PRESERVED_RESPONSE_DIAGNOSTIC.json',context.diagnostic);put('EVIDENCE/NANSEN_API_REQUEST_AUDIT.json',audit);put('EVIDENCE/ACCOUNT_WIDE_BALANCE_RECONCILIATION.json',balance)
    put('EVIDENCE/RESUME_CHAIN_PROOF.json',{schemaVersion:'1.0.0',reviewedB1ArchiveSha256:B1_SHA,reviewedB1Commit:BASE,currentCandidate:candidate,reviewedLedgerSha256:LEDGER_SHA,ledgerSha256:context.prior.bytesSha256,ledgerBytes:context.prior.bytes,originalLockSha256:context.diagnostic.originalLockSha256,originalGenesisSha256:bound.genesis.primaryGenesisSha256,originalGenesisCommitSha256:bound.genesis.primaryCommitSha256,exactReviewedStateReopenedReadOnly:true,firstTwoNoncountedTerminalsImmutable:true,unresolvedReservations:0,originalLockPreserved:true,invocationResumeLockCreated:false,resumeReceiptCreated:false,newProviderIssueAuthorized:false,pureAdmissionModelIsNotLiveCapability:true})
    put('EVIDENCE/LIVE_REQUEST_IDENTITY_MATRIX.json',data.identityMatrix);put('EVIDENCE/ATTEMPT_CREDIT_AND_COUNT_RECONCILIATION.json',data.report)
    put('EVIDENCE/PRIMARY_MIRROR_AND_LEDGER_RECONCILIATION.json',{ledgerSha256:data.report.ledgerSha256,ledgerBytes:data.report.ledgerBytes,rawFilesVerified:2,primaryMirrorLedgerBytesEqual:true,orderedTerminalCommitsVerified:true,originalLockVerified:true,privatePathsIncluded:false})
    put('EVIDENCE/RATE_CONCURRENCY_AND_LATENCY_REPORT.json',{...data.rates,rateWindowCorrection:'INDEPENDENT_EXPIRING_WINDOWS_GENERIC_ONE_SECOND_NEVER_PERMANENT_MINUTE_CAP',additionalLiveObservations:0})
    put('EVIDENCE/VALIDATION_STAGE_MATRIX.json',context.diagnostic.responses.map(r=>({logicalId:r.logicalId,firstFailedStage:r.firstFailedStage,stages:r.stages,safelyAdmissible:r.safelyAdmissible})))
    put('EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json',evidence.review)
    put('EVIDENCE/KNOWN_LIMITATIONS.md','# Bounded blocked R1\n\nNo additional credential resolution, documentation GET, provider request, private append or resume lock/receipt. Original two request IDs and completion timestamps were not captured; they remain null with explicit v1 limitations, never invented. Stage checks after a failed upstream gate remain NOT_RUN. Exact null-field semantics and timezone/intraday balance ambiguity cannot be resolved from preserved official bytes without weakening admission.\n\nCurrent documentation has NOT been refreshed because root-cause admission fails. Pure resume admission/remaining-ID guards are not production lock/writer/transport support, and positive synthetic predicates confer no live capability. Actual resume implementation/execution remains pending a separately admissible root-cause path and review. No15 counted results can be achieved under this gate; no1024 floor, gameplay integration, art, narrative, Mission02, content lock, hosting or release acceptance.\n')
    for(const [n,b]of Object.entries(evidence.logs))put('VERIFICATION/'+n+'.log',b)
    const bundle=path.join(delivery,'GIT/trace-escape-complete.bundle');fs.mkdirSync(path.dirname(bundle))
    await run('git',['-c','pack.threads=1','bundle','create',bundle,'HEAD']);const bundleLog=await run('git',['bundle','verify',bundle]),clone=path.join(temp,'clone');await run('git',['clone','--quiet',bundle,clone])
    const cloneGit=(...args)=>execFileSync('git',args,{cwd:clone,env:childEnv,encoding:'utf8'}).trimEnd()
    if(cloneGit('rev-parse','HEAD')!==candidate.commit||cloneGit('rev-parse','HEAD^{tree}')!==candidate.tree)throw new Error('R1_CLONE_IDENTITY')
    const fsck=await run('git',['fsck','--full','--strict'],clone);put('VERIFICATION/bundle-clone-fsck.log',bundleLog.replaceAll(bundle,'GIT/trace-escape-complete.bundle')+'\nclone '+candidate.commit+' / '+candidate.tree+'; fsck exit0 '+(fsck.trim()||'no diagnostics')+'\n')
    put('SOURCE_DIFF.patch',execFileSync('git',['diff','--binary',BASE,candidate.commit],{cwd:root,env:childEnv,maxBuffer:64000000}));fs.cpSync(path.join(root,'dist'),path.join(clone,'dist'),{recursive:true})
    put('VERIFICATION/fresh-clone-source-build-secret.log',await run('node',[path.join(root,'scripts/scan-prohibitions.mjs'),clone]));put('VERIFICATION/fresh-clone-history-secret.log',await run('node',['scripts/verify-git-secret-history.mjs'],clone))
    put('VERIFICATION/redacted-delivery-secret.log',await run('node',[path.join(root,'scripts/scan-prohibitions.mjs'),delivery]))
    put('EVIDENCE/VERIFICATION_SUMMARY.json',{...evidence.verification,...summary,independentReviewSha256:sha(fs.readFileSync(path.join(root,'docs/G6P_NQ5_T1_B1_R1_REVIEW.json'))),bundleFreshCloneIdentityVerified:true,actualPreservedBaselineReopenedReadOnly:true,credentialAccess:false,providerCalls:0,documentationGets:0})
    const allowed=new Set(['README.md','DELIVERY_MANIFEST.json','MANIFEST.sha256','SOURCE_DIFF.patch','GIT/trace-escape-complete.bundle','SOURCE_INSTALL/EXECUTION_CONTRACT_INSTALLATION_REPORT.json','SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256','OFFICIAL_DOCS/INDEX.json',...Object.keys(docs.bodies).map(n=>'OFFICIAL_DOCS/'+n+'.md'),'EXECUTION/T1_B1_R1_RESUME_ENVELOPE.json','SCHEMAS/NANSEN_API_REQUEST_AUDIT.schema.json',...['T1_B1_R1_EXECUTION_REPORT','T1_B1_R1_RECONCILIATION_REPORT','T1_B1_R1_UTILITY_REPORT','T1_CAMPAIGN_STATE_REDACTED'].map(n=>'REPORTS/'+n+'.json'),'PUBLIC/NQ5_PUBLIC_CALL_INDEX.json','PUBLIC/NQ5_PUBLIC_CALL_INDEX.sha256',...['B1_PRESERVED_RESPONSE_DIAGNOSTIC','NANSEN_API_REQUEST_AUDIT','ACCOUNT_WIDE_BALANCE_RECONCILIATION','RESUME_CHAIN_PROOF','LIVE_REQUEST_IDENTITY_MATRIX','ATTEMPT_CREDIT_AND_COUNT_RECONCILIATION','PRIMARY_MIRROR_AND_LEDGER_RECONCILIATION','RATE_CONCURRENCY_AND_LATENCY_REPORT','VALIDATION_STAGE_MATRIX','VERIFICATION_SUMMARY','REVIEW_FINDINGS_RESOLUTIONS'].map(n=>'EVIDENCE/'+n+'.json'),'EVIDENCE/KNOWN_LIMITATIONS.md'])
    for(const f of files(delivery)){const n=path.relative(delivery,f);if(!allowed.has(n)&&!/^VERIFICATION\/[a-z-]+\.log$/.test(n))throw new Error('R1_PAYLOAD_INVENTORY')}
    put('MANIFEST.sha256',files(delivery).map(f=>sha(fs.readFileSync(f))+'  '+path.relative(delivery,f)).sort().join('\n')+'\n')
    reviewEvidence(root);if(identity(cut(root))!==identity(candidate)||preservedCheckpoint(root).prior.bytesSha256!==LEDGER_SHA)throw new Error('R1_FINAL_SOURCE_OR_PRIVATE_STATE_CHANGED')
    const entries=files(delivery).map(f=>{fs.utimesSync(f,new Date('2000-01-01T00:00:00Z'),new Date('2000-01-01T00:00:00Z'));return path.relative(delivery,f)}).sort(),zip=path.join(temp,'delivery.zip'),rebuilt=path.join(temp,'rebuilt.zip')
    await run('zip',['-X','-q',zip,...entries],delivery);await run('zip',['-X','-q',rebuilt,...entries],delivery);if(sha(fs.readFileSync(zip))!==sha(fs.readFileSync(rebuilt)))throw new Error('R1_REBUILD_IDENTITY')
    await run('unzip',['-t',zip]);const extracted=path.join(temp,'extracted');fs.mkdirSync(extracted);await run('unzip',['-q',zip,'-d',extracted]);await run('sha256sum',['-c','MANIFEST.sha256'],extracted)
    const output=path.join(parent,archiveName);fs.copyFileSync(zip,output,fs.constants.COPYFILE_EXCL);process.stdout.write(JSON.stringify({status,archive:output,sha256:sha(fs.readFileSync(output)),additionalRequests:0,cumulativeAttempts:2,counted:0,actualCredits:2})+'\n')
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
async function main(){if(process.argv.length!==3)throw new Error('R1_UNSUPPORTED_MODE');if(process.argv[2]==='--local')await verify();else if(process.argv[2]==='--diagnose')diagnoseLocal();else if(process.argv[2]==='--deliver-blocked'){if(fs.existsSync(path.join(parent,archiveName)))throw new Error('R1_EXISTING_ARCHIVE_PRESERVED');await deliver()}else throw new Error('R1_NO_LIVE_ENTRYPOINT_ROOT_CAUSE_BLOCKED')}
main().catch(error=>{process.stderr.write((/^R1_[A-Z0-9_]+$/.test(error.message)?error.message:'R1_FAIL_CLOSED_UNCLASSIFIED')+'; no automatic retry, external request or private repair.\n');process.exitCode=1})
