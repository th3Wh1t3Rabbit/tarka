#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { loadAccepted, ACCEPTED_COMMIT, ACCEPTED_ARCHIVE_SHA, CONTRACT_SHA, MANIFEST_SHA } from './authority.mjs'
import { implementationDigest, admitLocalReview, admitPrivateBaseline, createLiveTransport, assertVerificationCut } from './live.mjs'
import { refreshDocs, validateDocs } from './docs.mjs'
import { Dispatcher, RateGate } from './dispatcher.mjs'
import { BatchStore } from './store.mjs'
import { reconcile, blockedReconciliation } from './reconcile.mjs'
import { configuredCampaignRoots } from '../nq5-r3/genesis.mjs'
import { sha } from '../nq5/schema.mjs'

// Hold the environment object by reference, without enumerating or reading its
// credential. All tools, including preserved helpers, inherit only safe vars.
const runtimeEnvironment=process.env
const safeEnvironment=Object.fromEntries(['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','DISPLAY','XDG_RUNTIME_DIR','PLAYWRIGHT_BROWSERS_PATH','npm_config_cache'].flatMap(name=>runtimeEnvironment[name]===undefined?[]:[[name,runtimeEnvironment[name]]]))
process.env=safeEnvironment
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),parent=path.dirname(root)
const local=path.join(root,'artifacts/g6p-b1/local'),execution=path.join(root,'artifacts/g6p-b1/execution')
const archiveName='TRACE_ESCAPE_G6P_NQ5_T1_B1_FAST_SAFE_CANARY_AND_FROZEN_BATCH_EXECUTION_DELIVERY_v1.0.0.zip'
const childEnvironment={...safeEnvironment,PYTHONDONTWRITEBYTECODE:'1',NODE_OPTIONS:`--require ${path.join(root,'scripts/nq5-r2/hold.cjs')}`,npm_config_update_notifier:'false'}
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',env:childEnvironment,maxBuffer:64000000}).trim()
const write=(directory,name,value)=>{const target=path.join(directory,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(value)?value:typeof value==='string'?value:JSON.stringify(value,null,2)+'\n')}
const files=directory=>fs.readdirSync(directory).sort().flatMap(name=>{const file=path.join(directory,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw new Error('B1_PAYLOAD_SYMLINK');return stat.isDirectory()?files(file):[file]})
function run(command,args,cwd=root){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env:childEnvironment,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>{output+=b;if(output.length>64000000)child.kill()});child.stderr.on('data',b=>{output+=b;if(output.length>64000000)child.kill()});child.on('error',()=>reject(new Error('B1_LOCAL_TOOL_UNAVAILABLE')));child.on('close',code=>code===0?resolve(output):reject(new Error('B1_LOCAL_SUITE_FAILED')))})}
function cut(){
  const exclusions=[':(exclude)AGENTS.md',':(exclude).cursor',':(exclude).cursor/**',':(exclude)ART_PRODUCTION',':(exclude)ART_PRODUCTION/**',':(exclude)artifacts/g6p-a2u/current/**',':(exclude)artifacts/g6p-a2p/verification/**',':(exclude)artifacts/g6p-b1/**']
  if(git('status','--porcelain=v1','--untracked-files=all','--','.',...exclusions))throw new Error('B1_DIRTY_GOVERNED_SOURCE')
  if(!fs.readFileSync(path.join(root,'AGENTS.md'),'utf8').startsWith(execFileSync('git',['show','HEAD:AGENTS.md'],{cwd:root,encoding:'utf8',env:childEnvironment})))throw new Error('B1_OPERATIONAL_INSTRUCTIONS_CHANGED')
  return {commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}')}
}
async function verifyLocal(){
  loadAccepted(root);const suites=[]
  const snapshot=()=>{let governedSourceCommitted=false;try{cut();governedSourceCommitted=true}catch{};return {candidate:{commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}')},governedSourceCommitted,implementationSha256:implementationDigest(root)}}
  const starting=snapshot()
  const suite=async(name,command,args,cwd=root)=>{assertVerificationCut(starting,snapshot());process.stdout.write('LOCAL '+name+'\n');const output=await run(command,args,cwd);assertVerificationCut(starting,snapshot());if(!output.trim())throw new Error('B1_EMPTY_VERIFICATION_LOG');write(local,name+'.log',output);suites.push({name,status:'PASS',sha256:sha(Buffer.from(output))})}
  await suite('execution-adversarial','node',['./node_modules/vitest/vitest.mjs','run','tests/unit/nq5-b1-executor.test.mjs','--reporter=dot'])
  await suite('source-validator','python3',['VALIDATE_SOURCE_SET.py'],path.join(root,'docs/source/v1.7.0'))
  await suite('report-schema-controls','python3',['scripts/test-nq5-report-validation.py'])
  await suite('typecheck-lint','npm',['run','check'])
  await suite('acquisition-compile','npm',['run','acquisition:compile'])
  await suite('unit-regression','node',['./node_modules/vitest/vitest.mjs','run','tests/unit','--exclude','tests/unit/nq5-b1-executor.test.mjs','--reporter=dot'])
  await suite('acquisition-regression','node',['./node_modules/vitest/vitest.mjs','run','tests/acquisition','--reporter=dot'])
  await suite('browser-accessibility-performance','npm',['run','test:e2e','--','--reporter=line'])
  await suite('production-build','npm',['run','build'])
  await suite('browser-boundary','npm',['run','browser-boundary:verify'])
  await suite('records-office-boundary','npm',['run','g6p:a1:boundary:verify'])
  await suite('euler-public-pack','npm',['run','g6:pack:verify'])
  await suite('project-clock-status','npm',['run','project:status'])
  await suite('history-secret-boundary','node',['scripts/verify-git-secret-history.mjs'])
  assertVerificationCut(starting,snapshot())
  const report={schemaVersion:'1.0.0',status:'PASS',generatedAtUtc:new Date().toISOString(),...starting,suites,credentialAccess:false,actualPrivateBaselineAccess:false,providerCalls:0,documentationGets:0,networkHold:true}
  write(local,'VERIFICATION.json',report);process.stdout.write('PHASE_1_LOCAL_SUITES_PASS_REVIEW_STILL_REQUIRED\n')
}
function savedDocs(bound){const index=JSON.parse(fs.readFileSync(path.join(execution,'OFFICIAL_DOCS/INDEX.json'))),bodies=Object.fromEntries(index.snapshots.map(s=>[s.name,fs.readFileSync(path.join(execution,'OFFICIAL_DOCS',s.file))]));return {index,bodies,proof:validateDocs(bound,index,bodies)}}
async function packageDelivery(bound,result,candidate){
  admitLocalReview(root,bound)
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'trace-b1-delivery-')),delivery=path.join(temporary,'delivery');fs.mkdirSync(delivery)
  try{
    let evidence
    try{evidence=result.roots?reconcile(bound,result.roots):blockedReconciliation(bound,result.stopReason)}catch{evidence=blockedReconciliation(bound,'B1_DURABLE_RECONCILIATION_FAILED');result.stopReason??='B1_DURABLE_RECONCILIATION_FAILED'}
    const review=JSON.parse(fs.readFileSync(path.join(root,'docs/G6P_NQ5_T1_B1_REVIEW.json'))),verification=JSON.parse(fs.readFileSync(path.join(local,'VERIFICATION.json')))
    const status=evidence.report.clean&&evidence.report.durableTerminals===15&&!result.stopReason?'DELIVERED_PENDING_LEAD_REVIEW':'BLOCKED_WITH_EVIDENCE'
    const put=(name,value)=>write(delivery,name,value)
    put('README.md',`# TRACE//ESCAPE frozen B1\n\n${status}. Exactly the accepted15 requests, no replacements or Batch2. Attempts${evidence.report.attempts}; counted${evidence.report.countedSuccesses}; actual credits${evidence.report.actualCredits??'indeterminate'}. Historical discovery32 attempts/37 credits and consumed account1/0 are separate. Restore GIT/trace-escape-complete.bundle; manifest governs every payload. Stop for independent Lead review.\n`)
    put('DELIVERY_MANIFEST.json',{schemaVersion:'1.0.0',archiveName,status,candidate,acceptedBase:ACCEPTED_COMMIT,acceptedArchiveSha256:ACCEPTED_ARCHIVE_SHA,executionContractSha256:CONTRACT_SHA,executionSourceManifestSha256:MANIFEST_SHA,campaignId:bound.envelope.campaignId,envelopeHash:bound.envelope.hash,...evidence.report,stopReason:result.stopReason??null,additionalAccountAttempts:0,alchemyCalls:0,batch2Generated:false,qualificationFloorClaimed:false,privatePathsPackaged:false,privateLedgerPackaged:false,rawBodiesPackaged:false,credentialPackaged:false,artLanePackaged:false,finalArtClaimed:false,mission02Claimed:false,hostingOrReleaseClaimed:false})
    put('SOURCE_INSTALL/EXECUTION_CONTRACT_INSTALLATION_REPORT.json',{status:'EXACT_ADDITIVE_CONTRACT_INSTALLED',executionContractSha256:CONTRACT_SHA,sourceManifestSha256:MANIFEST_SHA,unchangedFoundationFiles:59,additiveContractFiles:1,acceptedSourceIdentity:bound.envelope.acceptedSourceIdentity,frozenArtifactSourceIdentity:bound.envelope.frozenArtifactSourceIdentity,separateV181OverlayInstalled:false})
    put('SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256',fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_SOURCE_MANIFEST.sha256')))
    const captured=JSON.parse(fs.readFileSync(path.join(execution,'OFFICIAL_DOCS/INDEX.json')))
    put('OFFICIAL_DOCS/INDEX.json',captured)
    for(const row of captured.snapshots){const bytes=fs.readFileSync(path.join(execution,'OFFICIAL_DOCS',row.file));if(sha(bytes)!==row.bodySha256)throw new Error('B1_CAPTURE_BYTES_CHANGED');put('OFFICIAL_DOCS/'+row.file,bytes)}
    put('EXECUTION/T1_B1_EXECUTION_ENVELOPE.json',bound.envelope)
    put('REPORTS/T1_B1_EXECUTION_REPORT.json',{schemaVersion:'1.0.0',status,candidate,envelopeHash:bound.envelope.hash,stopReason:result.stopReason??null,...evidence.report})
    put('REPORTS/T1_B1_RECONCILIATION_REPORT.json',evidence.report)
    put('REPORTS/T1_B1_UTILITY_REPORT.json',evidence.utility)
    put('REPORTS/T1_CAMPAIGN_STATE_REDACTED.json',{campaignId:bound.envelope.campaignId,startingQualification:result.baselineVerified?{attempts:0,countedSuccesses:0,credits:0}:null,baselineReopenedReadOnly:!!result.baselineVerified,genesisReceiptSha256:bound.envelope.genesisReceiptSha256,endingQualification:evidence.report,privatePathsIncluded:false,newCampaignCreated:false,privateHistoryRepaired:false})
    put('PUBLIC/NQ5_PUBLIC_CALL_INDEX.json',evidence.publicIndex)
    put('PUBLIC/NQ5_PUBLIC_CALL_INDEX.sha256',sha(fs.readFileSync(path.join(delivery,'PUBLIC/NQ5_PUBLIC_CALL_INDEX.json')))+'  NQ5_PUBLIC_CALL_INDEX.json\n')
    put('EVIDENCE/LIVE_REQUEST_IDENTITY_MATRIX.json',evidence.identityMatrix)
    put('EVIDENCE/ATTEMPT_CREDIT_AND_COUNT_RECONCILIATION.json',evidence.report)
    put('EVIDENCE/PRIMARY_MIRROR_AND_LEDGER_RECONCILIATION.json',{ledgerSha256:evidence.report.ledgerSha256,ledgerBytes:evidence.report.ledgerBytes,rawFilesVerified:evidence.report.rawFilesVerified,primaryMirrorLedgerBytesEqual:evidence.report.primaryMirrorLedgerBytesEqual,privatePathsIncluded:false,orderedTerminalCommitsVerified:evidence.report.orderedTerminalCommitsVerified})
    put('EVIDENCE/RATE_CONCURRENCY_AND_LATENCY_REPORT.json',evidence.rates)
    put('EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json',review)
    put('EVIDENCE/KNOWN_LIMITATIONS.md',`# Bounded B1\n\n${status}. Stop after this frozen batch. ${result.stopReason??'No execution breaker observed.'}\n\nEmpty pages are predeclared noncounted, never replacements. Page1 evidence does not prove a whole requested window. Pagination frontiers remain unresolved and unauthorized. Public schema retains its NQ5 call namespace; the enclosing index binds the exact campaign. Utility identifies available evidence, not completed gameplay integration. No1024 floor, finalqualification, art, animation, narrative, Mission02, lock, hosting or release acceptance is claimed. Historical authorities and accepted artifacts remain unchanged.\n`)
    for(const suite of verification.suites)put('VERIFICATION/'+suite.name+'.log',fs.readFileSync(path.join(local,suite.name+'.log')))
    const bundle=path.join(delivery,'GIT/trace-escape-complete.bundle');fs.mkdirSync(path.dirname(bundle))
    await run('git',['-c','pack.threads=1','bundle','create',bundle,'HEAD'])
    const bundleLog=await run('git',['bundle','verify',bundle]),clone=path.join(temporary,'clone')
    await run('git',['clone','--quiet',bundle,clone]);const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:clone,env:childEnvironment,encoding:'utf8'}).trim(),tree=execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:clone,env:childEnvironment,encoding:'utf8'}).trim()
    if(commit!==candidate.commit||tree!==candidate.tree)throw new Error('B1_CLONE_IDENTITY')
    const fsck=await run('git',['fsck','--full','--strict'],clone)
    put('VERIFICATION/bundle-clone-fsck.log',bundleLog.replaceAll(bundle,'GIT/trace-escape-complete.bundle')+`\nclone commit${commit}; tree${tree}; fsck exit0 ${fsck.trim()||'no diagnostics'}\n`)
    put('SOURCE_DIFF.patch',execFileSync('git',['diff','--binary',ACCEPTED_COMMIT,candidate.commit],{cwd:root,env:childEnvironment,maxBuffer:64000000}))
    fs.cpSync(path.join(root,'dist'),path.join(clone,'dist'),{recursive:true})
    put('VERIFICATION/fresh-clone-source-build-secret.log',await run('node',[path.join(root,'scripts/scan-prohibitions.mjs'),clone]))
    put('VERIFICATION/fresh-clone-history-secret.log',await run('node',['scripts/verify-git-secret-history.mjs'],clone))
    put('VERIFICATION/redacted-delivery-secret.log',await run('node',[path.join(root,'scripts/scan-prohibitions.mjs'),delivery]))
    put('EVIDENCE/VERIFICATION_SUMMARY.json',{...verification,candidate,status,independentReviewSha256:sha(fs.readFileSync(path.join(root,'docs/G6P_NQ5_T1_B1_REVIEW.json'))),documentationGets:6,actualPrivateBaselineReadOnlyBeforeIssue:!!result.baselineVerified,bundleFreshCloneIdentityVerified:true,credentialAccess:!!result.credentialResolved,providerCalls:evidence.report.attempts})
    const allowed=/^(?:README\.md|DELIVERY_MANIFEST\.json|MANIFEST\.sha256|SOURCE_DIFF\.patch|GIT\/trace-escape-complete\.bundle|SOURCE_INSTALL\/(?:EXECUTION_CONTRACT_INSTALLATION_REPORT\.json|ACTIVE_SOURCE_MANIFEST\.sha256)|OFFICIAL_DOCS\/(?:INDEX\.json|(?:rate-limits|pricing|transactions|historical-balances|coverage|redistribution)\.md)|EXECUTION\/T1_B1_EXECUTION_ENVELOPE\.json|REPORTS\/(?:T1_B1_EXECUTION_REPORT|T1_B1_RECONCILIATION_REPORT|T1_B1_UTILITY_REPORT|T1_CAMPAIGN_STATE_REDACTED)\.json|PUBLIC\/NQ5_PUBLIC_CALL_INDEX\.(?:json|sha256)|EVIDENCE\/(?:LIVE_REQUEST_IDENTITY_MATRIX|ATTEMPT_CREDIT_AND_COUNT_RECONCILIATION|PRIMARY_MIRROR_AND_LEDGER_RECONCILIATION|RATE_CONCURRENCY_AND_LATENCY_REPORT|VERIFICATION_SUMMARY|REVIEW_FINDINGS_RESOLUTIONS)\.json|EVIDENCE\/KNOWN_LIMITATIONS\.md|VERIFICATION\/[a-z-]+\.log)$/
    if(files(delivery).some(file=>!allowed.test(path.relative(delivery,file))))throw new Error('B1_PAYLOAD_INVENTORY')
    put('MANIFEST.sha256',files(delivery).map(file=>sha(fs.readFileSync(file))+'  '+path.relative(delivery,file)).sort().join('\n')+'\n')
    if(JSON.stringify(cut())!==JSON.stringify(candidate))throw new Error('B1_CANDIDATE_CHANGED')
    admitLocalReview(root,bound)
    const entries=files(delivery).map(file=>{fs.utimesSync(file,new Date('2000-01-01T00:00:00Z'),new Date('2000-01-01T00:00:00Z'));return path.relative(delivery,file)}).sort(),zip=path.join(temporary,'delivery.zip'),second=path.join(temporary,'rebuilt.zip')
    await run('zip',['-X','-q',zip,...entries],delivery);await run('zip',['-X','-q',second,...entries],delivery)
    if(sha(fs.readFileSync(zip))!==sha(fs.readFileSync(second)))throw new Error('B1_REBUILD_IDENTITY')
    await run('unzip',['-t',zip]);const extracted=path.join(temporary,'extracted');fs.mkdirSync(extracted);await run('unzip',['-q',zip,'-d',extracted]);await run('sha256sum',['-c','MANIFEST.sha256'],extracted)
    const output=path.join(parent,archiveName);fs.copyFileSync(zip,output,fs.constants.COPYFILE_EXCL)
    process.stdout.write(JSON.stringify({status,archive:output,sha256:sha(fs.readFileSync(output)),attempts:evidence.report.attempts,counted:evidence.report.countedSuccesses,actualCredits:evidence.report.actualCredits})+'\n')
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
}
async function main(){
  const mode=process.argv[2]
  if(process.argv.length!==3||!['--local','--execute','--reconcile-only'].includes(mode))throw new Error('B1_UNSUPPORTED_MODE')
  if(mode==='--local'){await verifyLocal();return}
  if(fs.existsSync(path.join(parent,archiveName)))throw new Error('B1_EXISTING_ARCHIVE_PRESERVED')
  const candidate=cut(),bound=loadAccepted(root),localProof=admitLocalReview(root,bound)
  if(mode==='--reconcile-only'){
    savedDocs(bound)
    const saved=JSON.parse(fs.readFileSync(path.join(execution,'EXECUTION_RESULT.json')))
    if(JSON.stringify(saved.candidate)!==JSON.stringify(candidate)||saved.envelopeHash!==bound.envelope.hash)throw new Error('B1_EXISTING_RUN_BINDING')
    await packageDelivery(bound,{...saved,roots:configuredCampaignRoots().map(r=>path.join(r,bound.envelope.campaignId))},candidate);return
  }
  process.stdout.write('PHASE_1_REVIEW_AND_VERIFICATION_PASS\nPHASE_2_FIXED_DOC_REFRESH\n')
  const capture=await refreshDocs(bound);write(execution,'OFFICIAL_DOCS/INDEX.json',capture.index)
  for(const [name,bytes]of Object.entries(capture.bodies))write(execution,'OFFICIAL_DOCS/'+name+'.md',bytes)
  try{capture.proof=validateDocs(bound,capture.index,capture.bodies)}catch{await packageDelivery(bound,{stopReason:'B1_CURRENT_OFFICIAL_DOCUMENT_ADMISSION_FAILED',baselineVerified:false,credentialResolved:false},candidate);return}
  process.stdout.write('PHASE_2_PASS\nPHASE_3_READ_ONLY_BASELINE\n')
  let proof
  try{proof=admitPrivateBaseline(localProof,capture.proof)}catch{await packageDelivery(bound,{stopReason:'B1_PRIVATE_BASELINE_ADMISSION_FAILED',baselineVerified:false,credentialResolved:false},candidate);return}
  process.stdout.write('PHASE_3_PASS\nPHASE_4_RUNTIME_CREDENTIAL\n')
  let live
  try{live=createLiveTransport(proof,{environmentCredential:()=>runtimeEnvironment.NANSEN_API_KEY})}catch(error){if(error.message==='B1_APPROVED_CREDENTIAL_FILE_UNAVAILABLE'){process.stdout.write('PHASE_4_APPROVED_CREDENTIAL_NOT_ACCESSIBLE_PAUSE_FOR_USER\n');return}throw error}
  let store
  try{store=new BatchStore(live.roots,bound.envelope)}catch{
    const result={candidate,envelopeHash:bound.envelope.hash,baselineVerified:true,credentialResolved:true,stopReason:'B1_EXCLUSIVE_STORAGE_ADMISSION_FAILED'}
    write(execution,'EXECUTION_RESULT.json',result);await packageDelivery(bound,{...result,roots:live.roots},candidate);return
  }
  const controller=new AbortController()
  const shutdown=()=>controller.abort();process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown)
  const dispatcher=new Dispatcher({bound,store,transport:live.transport,rate:new RateGate({second:capture.proof.officialSecond,minute:capture.proof.officialMinute}),signal:controller.signal})
  process.stdout.write('PHASE_5_FOUR_REQUEST_CANARY_THEN_GATED_ELEVEN\n')
  const result=await dispatcher.run();process.removeListener('SIGINT',shutdown);process.removeListener('SIGTERM',shutdown)
  write(execution,'EXECUTION_RESULT.json',{candidate,envelopeHash:bound.envelope.hash,baselineVerified:true,credentialResolved:true,stopReason:result.stopReason,...result})
  process.stdout.write('PHASE_7_PRIVATE_DURABLE_RECONCILIATION_AND_STOP\n')
  await packageDelivery(bound,{...result,baselineVerified:true,credentialResolved:true,roots:live.roots},candidate)
}
main().catch(error=>{const known=/^B1_[A-Z0-9_]+$/.test(error.message)?error.message:'B1_FAIL_CLOSED_UNCLASSIFIED';process.stderr.write(known+'; no automatic retry or private-state repair.\n');process.exitCode=1})
