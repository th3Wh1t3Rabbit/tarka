#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { sourceBinding, digest, cut, git as boundGit, BASE, TREE, R1_SHA, CONTRACT_SHA, MANIFEST_SHA } from './gates.mjs'
import { offlineReport } from './report.mjs'
import { sanitizeLog, pathScan } from './privacy.mjs'
import { LOCAL_SUITES, verifyLocalEvidence } from '../nq5-b1/live.mjs'
import { identity, sha } from '../nq5/schema.mjs'

// No R2 live/provider/credential entrypoint. All children are keyless and held;
// documentation retrieval is a separate explicit fixed-inventory operation.
const environment=Object.fromEntries(['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','DISPLAY','XDG_RUNTIME_DIR','PLAYWRIGHT_BROWSERS_PATH','npm_config_cache'].flatMap(n=>process.env[n]===undefined?[]:[[n,process.env[n]]]))
process.env=environment
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),parent=path.dirname(root),local=path.join(root,'artifacts/g6p-b1-r2/local')
const childEnv={...environment,PYTHONDONTWRITEBYTECODE:'1',NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs'),npm_config_update_notifier:'false'}
const archiveName='TRACE_ESCAPE_G6P_NQ5_T1_B1_R2_OFFICIAL_CONTRACT_CLARIFICATION_COMPATIBILITY_AND_CORRECTED_PLAN_FREEZE_DELIVERY_v1.0.0.zip'
const serialize=value=>Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n')
const entryIdentity=entries=>identity(Object.entries(entries).sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>[name,sha(serialize(value))]))
const write=(dir,name,value)=>{const target=path.join(dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,serialize(value))}
const git=(...args)=>boundGit(root,...args)
const run=(command,args,cwd=root)=>new Promise((resolve,reject)=>{const c=spawn(command,args,{cwd,env:childEnv,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [c.stdout,c.stderr])stream.on('data',b=>{output+=b;if(output.length>64000000)c.kill()});c.on('error',()=>reject(new Error('R2_LOCAL_TOOL_UNAVAILABLE')));c.on('close',code=>code===0?resolve(output):reject(new Error('R2_LOCAL_SUITE_FAILED')))})
const files=dir=>fs.readdirSync(dir).sort().flatMap(n=>{const f=path.join(dir,n),s=fs.lstatSync(f);if(s.isSymbolicLink())throw new Error('R2_PAYLOAD_SYMLINK');return s.isDirectory()?files(f):[f]})
function snapshot(){let governedSourceCommitted=false;try{cut(root);governedSourceCommitted=true}catch{};return {candidate:{commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}')},governedSourceCommitted,implementationSha256:digest(root)}}
async function verify(){
  sourceBinding(root);const starting=snapshot(),suites=[]
  const assert=()=>{if(identity(starting)!==identity(snapshot()))throw new Error('R2_VERIFICATION_SOURCE_CHANGED')}
  const suite=async(name,cmd,args,cwd=root)=>{assert();process.stdout.write('LOCAL '+name+'\n');const output=await run(cmd,args,cwd);assert();if(!output.trim())throw new Error('R2_EMPTY_SUITE_LOG');write(local,name+'.log',output);suites.push({name,status:'PASS',sha256:sha(Buffer.from(output))})}
  await suite('execution-adversarial','node',['node_modules/vitest/vitest.mjs','run','tests/unit/nq5-b1-executor.test.mjs','tests/unit/nq5-b1-r1-remediation.test.mjs','tests/unit/nq5-b1-r2-contracts.test.mjs','--reporter=dot'])
  await suite('source-validator','python3',['VALIDATE_SOURCE_SET.py'],path.join(root,'docs/source/v1.7.0'))
  await suite('report-schema-controls','python3',['scripts/test-nq5-report-validation.py'])
  await suite('typecheck-lint','npm',['run','check'])
  await suite('acquisition-compile','npm',['run','acquisition:compile'])
  await suite('unit-regression','node',['node_modules/vitest/vitest.mjs','run','tests/unit','--exclude','tests/unit/nq5-b1-executor.test.mjs','--exclude','tests/unit/nq5-b1-r1-remediation.test.mjs','--exclude','tests/unit/nq5-b1-r2-contracts.test.mjs','--reporter=dot'])
  await suite('acquisition-regression','node',['node_modules/vitest/vitest.mjs','run','tests/acquisition','--reporter=dot'])
  await suite('browser-accessibility-performance','npm',['run','test:e2e','--','--reporter=line'])
  await suite('production-build','npm',['run','build'])
  await suite('browser-boundary','npm',['run','browser-boundary:verify'])
  await suite('records-office-boundary','npm',['run','g6p:a1:boundary:verify'])
  await suite('euler-public-pack','npm',['run','g6:pack:verify'])
  await suite('project-clock-status','npm',['run','project:status'])
  await suite('history-secret-boundary','node',['scripts/verify-git-secret-history.mjs'])
  assert();write(local,'VERIFICATION.json',{schemaVersion:'1.0.0',status:'PASS',generatedAtUtc:new Date().toISOString(),...starting,suites,credentialAccess:false,actualPrivateBaselineAccess:false,providerCalls:0,documentationGets:0,networkHold:true});process.stdout.write('R2_COMPLETE_LOCAL_REGRESSION_PASS\n')
}

function offlineLocal(){const report=offlineReport(root);for(const [name,value]of Object.entries(report.entries))if(!name.startsWith('OFFICIAL_DOCS/'))write(local,name,value);process.stdout.write('R2_OFFICIAL_STRICT_NULL_AND_HISTORICAL_HOLD_ZERO_READY_NO_PROVIDER_NO_CREDENTIAL_NO_PRIVATE_WRITE\n')}
async function deliver(){
  const candidate=cut(root),review=JSON.parse(fs.readFileSync(path.join(root,'docs/G6P_NQ5_T1_B1_R2_REVIEW.json'))),verification=JSON.parse(fs.readFileSync(path.join(local,'VERIFICATION.json'))),logs=Object.fromEntries(LOCAL_SUITES.map(n=>[n,fs.readFileSync(path.join(local,n+'.log'))]))
  verifyLocalEvidence(review,verification,logs,digest(root),candidate)
  const report=offlineReport(root),status=report.readiness.status,temp=fs.mkdtempSync(path.join(os.tmpdir(),'trace-b1-r2-delivery-')),delivery=path.join(temp,'delivery');fs.mkdirSync(delivery)
  try{
    const payload={},logRedactions=[]
    const put=(name,value)=>{payload[name]=serialize(value);write(delivery,name,payload[name])}
    const putLog=(name,value)=>{const s=sanitizeLog(value,root);if(!s.text.trim())throw new Error('R2_EMPTY_DELIVERY_LOG');put(name,s.text);logRedactions.push({file:name,sourceSha256:s.sourceSha256,sanitizedSha256:s.sanitizedSha256,otherPathRedactions:s.otherPathRedactions})}
    for(const [name,value]of Object.entries(report.entries))put(name,value)
    put('README.md','# TRACE//ESCAPE B1-R2\n\nBLOCKED_WITH_EVIDENCE. Documentation-only clarification and offline corrected-plan freeze. Official transactions schema/answer still does not permit null enrichment; historical timezone/bucket question returned no admissible answer. Narrow null compatibility is a pending-Lead offline proposal, not live admission. Zero live-ready requests; all15 exact original rows preserved, first2 immutable noncounted, remaining13 held. AUTHORIZED_TO_ISSUE=false throughout. Stop for Lead review.\n\nNo provider/account/Alchemy request, credential access, private write, resume lock or receipt. Prior attempts2/provider2xx2/count0/campaign credits2;2547 account-wide change remains unattributed. Exact current public docs/clarification bytes and hashes included; restored source is in the complete Git bundle. Delivery logs are sanitized; governed source literals are unchanged.\n')
    put('DELIVERY_MANIFEST.json',{...report.readiness,candidate,archiveName,rawBodiesPackaged:false,privateJournalPackaged:false,privateStoragePathsPackaged:false,credentialsPackaged:false,assetLanePackaged:false,batch2Generated:false,qualificationClaimed:false,gameplayIntegrationClaimed:false,artOrMission02Claimed:false,hostingOrReleaseClaimed:false})
    put('SOURCE_INSTALL/CONTRACT_INSTALLATION_REPORT.json',{schemaVersion:'1.0.0',status:'EXACT_ADDITIVE_CONTRACT_INSTALLED',executionContractSha256:CONTRACT_SHA,activeSourceManifestSha256:MANIFEST_SHA,unchangedFoundationFiles:61,additiveFiles:1,reviewedBaseCommit:BASE,reviewedBaseTree:TREE,reviewedR1ArchiveSha256:R1_SHA})
    put('SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256',fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R2_SOURCE_MANIFEST.sha256')))
    put('EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json',review)
    put('EVIDENCE/KNOWN_LIMITATIONS.md','# Bounded R2 hold\n\nOfficial clarification A confirms strict no-null enrichment, not an unavailable/unknown interpretation. The proposed interpretation/omission replay is engineering-only and pending Lead, not official admission or retroactive qualification. Clarification B returned HTTP200 with source-free failure text; no timezone/bucket semantics were inferred from Smart Money daily methodology or observed raw timestamps. Positive admission predicates use a deliberately strict source certificate with exact schema and semantic clauses, not generic AI prose permission. Ordinary or conflicting prose needs separately reviewed source-backed interpretation; actual current decisions remain strict/held. The current zero-ready planner deliberately rejects any hypothetical admitted-profile flag; an admitted aligned/replacement production planner remains held for a separately reviewed exact contract. Preserved transactions also fail timezone admission after the proposed null schema passes; normalization/public-schema stages remain NOT_RUN. Original2 attempts/request-ID and completion-time null limitations remain unchanged. No new provider/result/public-call identity is produced.\n\nInitial two ask attempts returned no response within transport bound. Two early fallback captures lost their retrieval index during concurrent writes; these were not used or packaged. They were recaptured after index-merge correction with exact fresh URL/time/status/bytes/hash.17 total authorized GETs;15 indexed attempts including4 ask attempts and2 recaptured fallback pages. Arbitrary suggested follow-ups/unrelated source pages were not retrieved. Cited pages are identified; only the directly supporting transactions source is used for decision.\n\nBeta fallback families remain proposals: date-only cutoff ambiguity, undocumented exact beta public-use policy, prose/schema chain discrepancy, and transaction20-result cap/untyped token arrays/label-bearing semantics. No public-call index or family admission. Supplier logs only are sanitized; Git/source literals are preserved. No floor, final qualification, gameplay integration, art/narrative, Mission02, content lock, hosting or release acceptance.\n')
    for(const [n,b]of Object.entries(logs))putLog('VERIFICATION/'+n+'.log',b)
    putLog('VERIFICATION/offline-evidence.log','PASS exact R1 archive '+R1_SHA+' / commit '+BASE+' / tree '+TREE+'; exact pinned audit/schema/diagnostic/balance/chain/rate/stage members.\nPASS all9 primary and2 fallback documentation bytes/hash;2 exact questions,4 preserved attempts.\nPASS deterministic all15 original-row binding and zero-ready corrected plan '+report.plans.plan.hash+'; full audit continuity/schema; reserve627478-0>=250.\nPASS read-only actual ledger4659/hash '+report.readiness.ledgerSha256+' and original lock '+report.readiness.originalLockSha256+' before/after; original2 noncounted unchanged;13 held.\nPASS provider/account/Alchemy requests0; credential reads0; private writes0; resume lock/receipt0; AUTHORIZED_TO_ISSUE=false.\n')
    const bundle=path.join(delivery,'GIT/trace-escape-complete.bundle');fs.mkdirSync(path.dirname(bundle))
    await run('git',['-c','pack.threads=1','bundle','create',bundle,'HEAD']);const bundleLog=await run('git',['bundle','verify',bundle]),clone=path.join(temp,'clone');await run('git',['clone','--quiet',bundle,clone])
    const cloneGit=(...args)=>execFileSync('git',args,{cwd:clone,env:childEnv,encoding:'utf8'}).trimEnd()
    if(cloneGit('rev-parse','HEAD')!==candidate.commit||cloneGit('rev-parse','HEAD^{tree}')!==candidate.tree)throw new Error('R2_CLONE_IDENTITY')
    const fsck=await run('git',['fsck','--full','--strict'],clone)
    putLog('VERIFICATION/bundle-clone-fsck.log',bundleLog+'\nclone '+candidate.commit+' / '+candidate.tree+'; fsck exit0 '+(fsck.trim()||'no diagnostics')+'\n')
    put('GIT/trace-escape-complete.bundle',fs.readFileSync(bundle))
    put('SOURCE_DIFF.patch',execFileSync('git',['diff','--binary',BASE,candidate.commit],{cwd:root,env:childEnv,maxBuffer:64000000}))
    fs.cpSync(path.join(root,'dist'),path.join(clone,'dist'),{recursive:true})
    putLog('VERIFICATION/fresh-clone-source-build-secret.log',await run('node',[path.join(root,'scripts/scan-prohibitions.mjs'),clone]))
    putLog('VERIFICATION/fresh-clone-history-secret.log',await run('node',['scripts/verify-git-secret-history.mjs'],clone))
    putLog('VERIFICATION/redacted-delivery-secret.log',await run('node',[path.join(root,'scripts/scan-prohibitions.mjs'),delivery]))
    put('EVIDENCE/VERIFICATION_SUMMARY.json',{...verification,status:'PASS',candidate,offlineGateStatus:status,AUTHORIZED_TO_ISSUE:false,actualPreservedBaselineReadOnlyAccess:true,privateStateModified:false,credentialAccess:false,providerCalls:0,documentationRetrievalScope:report.readiness.documentationGetAccounting,sourceSuiteLogHashesPreserved:true,deliveryLogBindings:logRedactions,bundleFreshCloneIdentityVerified:true,independentReviewSha256:sha(fs.readFileSync(path.join(root,'docs/G6P_NQ5_T1_B1_R2_REVIEW.json')))})
    const scan=pathScan(payload);if(scan.status!=='PASS')throw new Error('R2_DELIVERY_ABSOLUTE_PATH_LEAK')
    put('EVIDENCE/PATH_REDACTION_SCAN.json',{...scan,deliveryLogs:logRedactions})
    const allowed=new Set([...Object.keys(report.entries),'README.md','DELIVERY_MANIFEST.json','MANIFEST.sha256','GIT/trace-escape-complete.bundle','SOURCE_DIFF.patch','SOURCE_INSTALL/CONTRACT_INSTALLATION_REPORT.json','SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256','EVIDENCE/PATH_REDACTION_SCAN.json','EVIDENCE/VERIFICATION_SUMMARY.json','EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json','EVIDENCE/KNOWN_LIMITATIONS.md'])
    for(const f of files(delivery)){const n=path.relative(delivery,f);if(!allowed.has(n)&&!/^VERIFICATION\/[a-z-]+\.log$/.test(n))throw new Error('R2_PAYLOAD_INVENTORY')}
    put('MANIFEST.sha256',files(delivery).map(f=>sha(fs.readFileSync(f))+'  '+path.relative(delivery,f)).sort().join('\n')+'\n')
    if(identity(cut(root))!==identity(candidate)||entryIdentity(offlineReport(root).entries)!==entryIdentity(report.entries))throw new Error('R2_FINAL_SOURCE_OR_PRESERVED_STATE_CHANGED')
    const entries=files(delivery).map(f=>{fs.utimesSync(f,new Date('2000-01-01T00:00:00Z'),new Date('2000-01-01T00:00:00Z'));return path.relative(delivery,f)}).sort(),zip=path.join(temp,'delivery.zip'),rebuilt=path.join(temp,'rebuilt.zip')
    await run('zip',['-X','-q',zip,...entries],delivery);await run('zip',['-X','-q',rebuilt,...entries],delivery);if(sha(fs.readFileSync(zip))!==sha(fs.readFileSync(rebuilt)))throw new Error('R2_REBUILD_IDENTITY')
    await run('unzip',['-t',zip]);const extracted=path.join(temp,'extracted');fs.mkdirSync(extracted);await run('unzip',['-q',zip,'-d',extracted]);await run('sha256sum',['-c','MANIFEST.sha256'],extracted)
    const output=path.join(parent,archiveName);fs.copyFileSync(zip,output,fs.constants.COPYFILE_EXCL);process.stdout.write(JSON.stringify({status,archive:output,sha256:sha(fs.readFileSync(output)),liveReadyRequests:0,additionalProviderRequests:0,priorAttempts:2,counted:0,priorActualCredits:2})+'\n')
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
async function main(){if(process.argv.length!==3)throw new Error('R2_UNSUPPORTED_MODE');if(process.argv[2]==='--local')await verify();else if(process.argv[2]==='--offline')offlineLocal();else if(process.argv[2]==='--deliver'){if(fs.existsSync(path.join(parent,archiveName)))throw new Error('R2_EXISTING_ARCHIVE_PRESERVED');await deliver()}else throw new Error('R2_NO_LIVE_PROVIDER_OR_CREDENTIAL_ENTRYPOINT')}
main().catch(error=>{process.stderr.write((/^R2_[A-Z0-9_]+$/.test(error.message)?error.message:'R2_FAIL_CLOSED_UNCLASSIFIED')+'; no external retry, provider request, credential resolution or private repair.\n');process.exitCode=1})
