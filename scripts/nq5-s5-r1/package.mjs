import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import {sha} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {attachPublishedRegressionInputs} from '../nq5-s2/published-regression-inputs.mjs'
import {laneContractFixture} from '../nq5-s5/lane-fixture.mjs'
import {buildPackets} from './packets.mjs'
export const OUTPUT='TRACE_ESCAPE_G6P_NQ5_T1_S5_R1_PIXEL_CLIP_IDENTITY_AND_SINGLE_EXPLORE_SEAM_REMEDIATION_DELIVERY_v1.0.0.zip'
const BASE='0d39031a746f09f5fd2d984c96585daf3b34a2d8',TREE='fbf58344223f1e0d95d96b5e9fbd80147e41fb8d'
const INPUT_SHA='db120aa0f9e33fb9238817a14989df0cea27265397b4edb753e7838825343395'
const ACCEPTED='0f52131c9f56f49128e7a413396331917e687a1f'
const root=process.cwd(),args=process.argv.slice(2)
if(args.length!==6||args[0]!=='--primary-reference-root'||args[2]!=='--admitted-input-root'||args[4]!=='--output-directory')throw Error('S5_R1_PACKAGE_ARGUMENTS')
const primary=path.resolve(args[1]),input=path.resolve(args[3]),output=path.resolve(args[5])
if(primary===root||output===root||!path.isAbsolute(os.tmpdir()))throw Error('S5_R1_PACKAGE_ISOLATION')
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'s5-delivery-')),dir=path.join(tmp,'package'),fresh=path.join(tmp,'reconstructed'),audit=path.join(tmp,'pack-audit')
const env={PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC',TMPDIR:os.tmpdir(),NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs'),CI:'1',NO_COLOR:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}
const sanitize=t=>t.split(root).join('[IMPLEMENTATION_ROOT]').split(primary).join('[PRIMARY_REFERENCE_ROOT]').split(input).join('[ADMITTED_INPUT_ROOT]').split(tmp).join('[FRESH_VERIFICATION_ROOT]').split(os.tmpdir()).join('[LOCAL_VERIFICATION_ROOT]').replace(/\u001b\[[0-9;]*m/g,'')
const run=(cmd,a,cwd=root,customEnv=env)=>{try{return execFileSync(cmd,a,{cwd,env:customEnv,maxBuffer:128000000,stdio:['pipe','pipe','pipe']}).toString()}catch(e){const d=path.join(root,'artifacts/g6p-s5-r1/LOGS');fs.mkdirSync(d,{recursive:true});let n=1;while(fs.existsSync(path.join(d,'package-stopped-'+n+'.log')))n++;fs.writeFileSync(path.join(d,'package-stopped-'+n+'.log'),sanitize((e.stdout||'').toString()+(e.stderr||'').toString())+'\nEXIT_CODE='+e.status+'\n');throw Error('S5_R1_PACKAGE_STOPPED_'+cmd)}}
const git=(...a)=>run('git',a).trim(),check=(b,n)=>{if(!b)throw Error('S5_R1_'+n)}
const primaryStatus=()=>run('git',['status','--porcelain=v1','--untracked-files=no'],primary).trim()
const primaryHead=()=>run('git',['rev-parse','HEAD'],primary).trim()
check(primaryStatus()==='M AGENTS.md'&&primaryHead()===ACCEPTED,'PRIMARY_METADATA_ONLY_ADMISSION')
const candidate={commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),parent:git('rev-parse','HEAD^')}
check(git('rev-parse',BASE+'^{tree}')===TREE,'BASE_TREE');run('git',['merge-base','--is-ancestor',BASE,candidate.commit]);check(!git('rev-list','--merges',BASE+'..HEAD'),'NO_MERGE')
check(!git('diff','--name-only','HEAD','--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION'),'SEALED_TRACKED_SOURCE')
check(!git('diff',BASE,'HEAD','--','AGENTS.md'),'COMMITTED_AGENTS_DIFF_EMPTY')
const agentBlob=git('rev-parse',BASE+':AGENTS.md');check(git('rev-parse','HEAD:AGENTS.md')===agentBlob,'TRUSTED_AGENTS_GIT_BLOB_MATCH')
const changed=git('diff','--name-only',BASE,candidate.commit).split('\n').filter(Boolean)
check(changed.length>=8&&!changed.some(n=>n==='AGENTS.md'||n.startsWith('.cursor/')||n.startsWith('ART_PRODUCTION/')),'CHANGED_SCOPE')
fs.mkdirSync(dir)
const payload=new Map(),put=(n,b)=>{check(n&&!n.startsWith('/')&&!n.includes('\\')&&!n.split('/').some(x=>!x||x==='..'||x==='.')&&!payload.has(n),'PACKAGE_PATH');b=Buffer.isBuffer(b)?b:Buffer.from(typeof b==='string'?b:JSON.stringify(b,null,2)+'\n');fs.mkdirSync(path.dirname(path.join(dir,n)),{recursive:true});fs.writeFileSync(path.join(dir,n),b,{flag:'wx'});payload.set(n,b)}
const log=(n,t)=>put('FRESH_LOGS/'+n+'.log',sanitize(t)+'\nEXIT_CODE=0\n')
const bundle=path.join(tmp,'incremental.bundle');run('git',['-c','pack.threads=1','bundle','create',bundle,'HEAD','^'+BASE])
const bytes=fs.readFileSync(bundle),boundary=bytes.indexOf(Buffer.from('\n\n'));check(boundary>0,'BUNDLE_HEADER')
const header=bytes.subarray(0,boundary).toString();check(header.includes('-'+BASE+' ')&&header.split('\n').filter(l=>l.startsWith('-')).length===1&&header.includes(candidate.commit+' HEAD'),'EXACT_ONE_PREREQUISITE')
const objectDir=git('rev-parse','--path-format=absolute','--git-path','objects')
const initAlternate=d=>{fs.mkdirSync(d);run('git',['init','--quiet'],d);fs.mkdirSync(path.join(d,'.git/objects/info'),{recursive:true});fs.writeFileSync(path.join(d,'.git/objects/info/alternates'),objectDir+'\n')}
initAlternate(audit)
const indexed=execFileSync('git',['index-pack','--fix-thin','--stdin'],{cwd:audit,env,input:bytes.subarray(boundary+2),maxBuffer:128000000}).toString().trim(),pack=indexed.split(/\s+/).at(-1)
const objects=run('git',['verify-pack','-v',path.join(audit,'.git/objects/pack/pack-'+pack+'.idx')],audit).split('\n').filter(l=>/^[a-f0-9]{40} (?:blob|commit|tree|tag) /.test(l)).map(l=>{const[id,type]=l.split(' ');return{id,type}})
check(objects.length>0,'PACK_NOT_EMPTY');let textObjects=0
for(const o of objects){if(!['blob','commit','tag'].includes(o.type))continue;const b=execFileSync('git',['cat-file',o.type,o.id],{cwd:audit,env,maxBuffer:128000000});let t;try{t=new TextDecoder('utf8',{fatal:true}).decode(b)}catch{throw Error('S5_R1_NEW_NON_TEXT_GIT_OBJECT')};check(!privatePathFindings(t).length&&!hasSecretLikeValue(t),'GIT_OBJECT_PRIVACY');textObjects++}
put('EVIDENCE/INCREMENTAL_GIT_OBJECT_PRIVACY.json',{status:'PASS',bundleSha256:sha(bytes),prerequisiteCommit:BASE,objects:objects.length,textObjectsScanned:textObjects,objectIds:objects,completeInheritedHistoryIncluded:false,privatePathFindings:0,secretFindings:0,credentialFileOpened:false,protectedPrimaryAgentsOpened:false,networkRequests:0})
put('GIT/trace-escape-incremental.bundle',bytes)
initAlternate(fresh);const bv=run('git',['bundle','verify',bundle],fresh)
run('git',['fetch','--quiet','--no-tags',bundle,'HEAD:refs/heads/candidate'],fresh);run('git',['symbolic-ref','HEAD','refs/heads/candidate'],fresh);run('git',['read-tree','HEAD'],fresh)
for(const[expr,value]of [['HEAD',candidate.commit],['HEAD^{tree}',candidate.tree],['HEAD^',candidate.parent]])check(run('git',['rev-parse',expr],fresh).trim()===value,'FRESH_IDENTITY')
const entries=run('git',['ls-files','--stage','-z','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION'],fresh).split('\0').filter(Boolean)
for(const entry of entries){const n=entry.slice(entry.indexOf('\t')+1),mode=entry.slice(0,6);check(!n.startsWith('/')&&!n.split('/').includes('..')&&['100644','100755'].includes(mode),'FRESH_REGULAR_PATH');const b=execFileSync('git',['show','HEAD:'+n],{cwd:fresh,env,maxBuffer:128000000});fs.mkdirSync(path.dirname(path.join(fresh,n)),{recursive:true});fs.writeFileSync(path.join(fresh,n),b,{flag:'wx',mode:mode==='100755'?0o755:0o644})}
fs.symlinkSync(path.join(root,'node_modules'),path.join(fresh,'node_modules'),'dir');fs.appendFileSync(path.join(fresh,'.git/info/exclude'),'\nnode_modules\n')
const fsck=run('git',['fsck','--full','--strict'],fresh)
put('EVIDENCE/PUBLISHED_REGRESSION_INPUT_BINDINGS.json',attachPublishedRegressionInputs(primary,tmp,env))
const diff=execFileSync('git',['diff','--binary',BASE,candidate.commit],{cwd:root,env,maxBuffer:128000000}),fd=execFileSync('git',['diff','--binary',BASE,candidate.commit],{cwd:fresh,env,maxBuffer:128000000});check(diff.equals(fd),'EXACT_DIFF_RECOVERY');put('SOURCE_DIFF.patch',diff)
log('incremental-reconstruction',bv+fsck+'\nExact base/candidate/tree/parent and patch equality PASS. Only existing local object alternates used. No full history packaged.\n')
console.log('S5-R1 exact incremental recovery PASS; fresh source boundaries and complete tests starting.')
log('source-boundaries',run('node',['--loader','./scripts/nq5-s5/ts-loader.mjs','scripts/nq5-s5-r1/verify.mjs'],fresh))
log('no-network',run('node',['scripts/nq5-s3-r1/no-network.mjs'],fresh))
log('scenario-pack',run('node',['scripts/g5-pack.mjs','verify'],fresh))
log('preserved-json-schemas',run('python3',['scripts/nq5-s3-r1/schema-check.py'],fresh))
log('corrected-portable-repro',run('node',['scripts/nq5-s5-r1/corrected-repro.mjs'],fresh))
log('new-json-schemas',run('python3',['scripts/nq5-s5/schema-check.py'],fresh))
const isolated=laneContractFixture(fresh),unitEnv={...env,S4_LANE_CONTRACT_ROOT:isolated.root,NODE_OPTIONS:env.NODE_OPTIONS+' --import '+path.join(fresh,'scripts/nq5-s4/lane-test-scope.mjs')}
const unit=run('node',['node_modules/vitest/vitest.mjs','run','--maxWorkers=4'],fresh,unitEnv);log('broad-unit-acquisition',unit)
const unitCount=Number(unit.match(/Tests\s+(\d+) passed/)?.[1]);check(unitCount===1626&&!/\d+ failed/.test(unit),'FRESH_BROAD_TEST_COUNT')
console.log('S5-R1 fresh broad unit/acquisition '+unitCount+' PASS; build, boundaries and browser regressions starting.')
log('typecheck',run('npm',['run','typecheck'],fresh));log('build',run('npm',['run','build'],fresh));log('lint',run('npm',['run','lint'],fresh));log('browser-boundary',run('node',['scripts/verify-browser-boundary.mjs'],fresh))
const browserRuns=[['current-browser','scripts/s5-current-browser.config.mjs',34],['preserved-browser','scripts/s5-preserved-browser.config.mjs',15],['integrated-s5-browser','scripts/s5-r1-existing-browser.config.mjs',5],['single-explore-browser','scripts/s5-r1-browser.config.mjs',3]]
for(const[name,config,count]of browserRuns){const t=run('node',['node_modules/@playwright/test/cli.js','test','--config',config],fresh);log(name,t);check(t.includes(count+' passed')&&!/\d+ failed/.test(t),'BROWSER_COUNT_'+name);console.log('S5-R1 fresh '+name+' '+count+' PASS.')}
log('lane-c-build',run('node',['node_modules/vite/bin/vite.js','build','--config','tests/e2e/lane-c/vite.config.ts'],fresh))
const laneBrowser=run('node',['node_modules/@playwright/test/cli.js','test','--config','tests/e2e/lane-c/playwright.config.ts'],fresh);log('lane-c-browser',laneBrowser);check(laneBrowser.includes('5 passed')&&!/\d+ failed/.test(laneBrowser),'LANE_C_BROWSER_COUNT')
// Restore only the eight task-generated controller captures in the reconstructed root.
const captures=run('git',['diff','--name-only','HEAD','--','artifacts/screenshots/g6p-a1'],fresh).trim().split('\n').filter(Boolean)
check(captures.length===8&&captures.every(n=>/^artifacts\/screenshots\/g6p-a1\/0[1-8]-[A-Za-z0-9-]+\.png$/.test(n)),'OWN_GENERATED_CAPTURE_SCOPE')
for(const n of captures)fs.writeFileSync(path.join(fresh,n),execFileSync('git',['show',BASE+':'+n],{cwd:fresh,env,maxBuffer:128000000}))
check(!run('git',['diff','--name-only','HEAD','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION'],fresh).trim(),'FRESH_TRACKED_CLEAN_AFTER_CAPTURE_RESTORE')
log('final-source-boundaries',run('node',['--loader','./scripts/nq5-s5/ts-loader.mjs','scripts/nq5-s5-r1/verify.mjs'],fresh))
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
for(const file of walk(path.join(root,'artifacts/g6p-s5-r1')).sort()){
 const rel=path.relative(path.join(root,'artifacts/g6p-s5-r1'),file).split(path.sep).join('/')
 if(rel.startsWith('SCREENSHOTS/'))continue
 const s=fs.lstatSync(file);check(s.isFile()&&!s.isSymbolicLink(),'ARTIFACT_REGULAR');put(rel,fs.readFileSync(file))
}
for(const file of walk(path.join(root,'docs/source/execution-s5-r1')).sort())put('SOURCE_INPUT/'+path.relative(path.join(root,'docs/source/execution-s5-r1'),file).split(path.sep).join('/'),fs.readFileSync(file))
const bindings=JSON.parse(fs.readFileSync(path.join(root,'artifacts/g6p-s5-r1/REPORTS/INPUT_ADMISSION.json')))
const binaryInputs=[]
for(const f of bindings.inputs){const file=path.join(input,f.file),s=fs.lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.size===f.bytes&&sha(fs.readFileSync(file))===f.sha256,'SUPPLIED_INPUT_HASH');const n='SUPPLIED_INPUT/'+f.file;put(n,fs.readFileSync(file));if(n.endsWith('.zip'))binaryInputs.push(n)}
check(binaryInputs.length===0,'NO_NESTED_HISTORICAL_ARCHIVE')
log('supplied-input-verifier',run('node',['VERIFY_INPUT.mjs'],path.join(dir,'SUPPLIED_INPUT')))
for(const n of changed.filter(n=>/^(src|scripts|tests|artifacts\/g6p-s5\/REPORTS)\//.test(n)))put('INTEGRATED_SOURCE/'+n,execFileSync('git',['show',candidate.commit+':'+n],{cwd:root,env,maxBuffer:128000000}))
const packets=buildPackets(root,candidate,put)
const packetRepeat=new Map();buildPackets(root,candidate,(n,b)=>packetRepeat.set(n,Buffer.isBuffer(b)?b:Buffer.from(typeof b==='string'?b:JSON.stringify(b,null,2)+'\n')))
for(const[n,b]of packetRepeat)check(payload.get(n)?.equals(b),'DETERMINISTIC_PACKET_BYTES')
const generationRoots=[path.join(tmp,'generation-one'),path.join(tmp,'generation-two')]
for(const d of generationRoots)run('node',['--loader','./scripts/nq5-s5/ts-loader.mjs','scripts/nq5-s5-r1/generate.mjs',d],fresh)
const generated=fs.readdirSync(generationRoots[0]).sort();for(const n of generated)check(fs.readFileSync(path.join(generationRoots[0],n)).equals(fs.readFileSync(path.join(generationRoots[1],n)))&&fs.readFileSync(path.join(generationRoots[0],n)).equals(fs.readFileSync(path.join(fresh,'artifacts/g6p-s5-r1/REPORTS',n))),'DETERMINISTIC_REPORT_BYTES')
put('EVIDENCE/DETERMINISTIC_GENERATION.json',{status:'PASS',method:'Two independent output roots, deterministic source reports, both minimum lane packet outputs compared byte-for-byte against identical sealed candidate/base bindings.',reports:generated.map(file=>({file,sha256:sha(fs.readFileSync(path.join(generationRoots[0],file)))})),packetMembersCompared:packetRepeat.size,candidate})
for(const lane of ['A','C']){
 const packetRoot=path.join(dir,'LANE_'+lane+'_PREPARED_NOT_SENT')
 log('lane-'+lane.toLowerCase()+'-packet',run('node',['VERIFY_PACKET.mjs'],packetRoot))
 const target=path.join(tmp,'lane-'+lane.toLowerCase()+'-target-recovery');initAlternate(target);run('git',['read-tree',BASE],target)
 run('git',['apply','--cached','--check',path.join(packetRoot,'TARGETED_RECOVERY.patch')],target)
 run('git',['apply','--cached',path.join(packetRoot,'TARGETED_RECOVERY.patch')],target)
 const contract=JSON.parse(fs.readFileSync(path.join(packetRoot,'TARGETED_REGRESSION_CONTRACT.json')))
 for(const f of contract.files)check(sha(execFileSync('git',['show',':'+f.file],{cwd:target,env,maxBuffer:128000000}))===f.sha256,'TARGETED_RECOVERY_SOURCE_MATCH')
 const targetPaths=run('git',['diff','--cached','--name-only',BASE],target).trim().split('\n').filter(Boolean)
 check(targetPaths.every(n=>contract.files.some(f=>f.file===n)),'TARGETED_RECOVERY_CLOSED_PATHS')
 log('lane-'+lane.toLowerCase()+'-target-recovery','Exact reviewed-S5-prerequisite targeted patch applied to separate local index; all'+contract.files.length+' source/test hashes match candidate. No full candidate-tree claim. PASS.\n')
}
for(const n of ['terminal-4x.png','plain-200pct-forced.png','evidence-sea-placeholder.png']){const file=path.join(fresh,'artifacts/g6p-s5/SCREENSHOTS',n),b=fs.readFileSync(file);check(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'OWN_SCREENSHOT_PNG');put('SCREENSHOTS/'+n,b)}
check(primaryStatus()==='M AGENTS.md'&&primaryHead()===ACCEPTED,'FINAL_PRIMARY_METADATA_ONLY_PRESERVATION')
put('EVIDENCE/PROTECTED_PRIMARY_AND_CANDIDATE_PRESERVATION.json',{status:'PASS',primaryBefore:[' M AGENTS.md'],primaryAfter:[' M AGENTS.md'],primaryHeadBefore:ACCEPTED,primaryHeadAfter:ACCEPTED,primaryProtectedFileDirectlyRead:false,primaryProtectedFileHashComputed:false,primaryProtectedFileDiffedCopiedStagedPackaged:false,trustedAcceptedCommitAgentsBlob:agentBlob,trustedCandidateCommitAgentsBlob:git('rev-parse','HEAD:AGENTS.md'),committedAgentsDiffEmpty:true,candidate,linearCommits:git('rev-list','--reverse',BASE+'..HEAD').split('\n'),implementationRef:git('symbolic-ref','HEAD'),implementationRetainedForMAIN:true,previousBlockedDeliveryPreserved:true,previousBlockedDeliverySha256:'c7585bb65213dfcc6e7184f4eba00e3748c8e9cf15488107430ed9f56c020d2a'})
for(const n of ['REVIEW_1.json','REVIEW_2.json']){const v=JSON.parse(payload.get('REPORTS/'+n));check(v.status==='PASS_CLOSED_TASK_OWNED_FINDINGS'&&v.independent===false&&v.genuineBugbot===false,'DISCLOSED_REVIEWS');for(const f of v.implementationBindings)check(sha(fs.readFileSync(path.join(root,f.file)))===f.sha256,'REVIEW_STALE')}
const summary={status:'DELIVERED_PENDING_MAIN_LEAD_REVIEW',candidate,reviewedS5Prerequisite:{commit:BASE,tree:TREE},acceptedControllerBase:ACCEPTED,freshBroadUnitAcquisitionTests:unitCount,freshCurrentBrowserTests:34,freshPreservedFocusedBrowserTests:15,freshS5IntegratedBrowserTests:5,freshLaneCBrowserTests:5,freshS5R1SingleExploreBrowserTests:3,totalScopedBrowserTests:62,focusedCountsNotAddedToBroadUnitTotal:true,canonicalSemanticRecords:25,boundedNoMatchRecords:7,acceptedLaneAAdditionsPreserved:37,compiledAnswerFreeClientEntries:74,clientMapSha256:'57f27ecfef64f9c149f2f80bdb1efffbc629d79fd5f6a76e21c0e943c5c95bfc',truthAndFrozenCorpusBytesChanged:0,exactProofLayerSeparate:true,twoReviews:'DISCLOSED_SAME_AGENT_FALLBACK_NOT_BUGBOT_OR_INDEPENDENT_MAIN',strictFsck:'PASS',incrementalRecovery:'EXACT_ONE_LOCAL_PREREQUISITE',exactDiffReproduced:true,completeHistoryPackaged:false,MAINFrozenBySeparateReceipt:true,supplierSelfPromoted:false,releaseApproved:false,contentLocked:false,PixelArchiveInspected:false,productionArtIntegrated:false,technicalArchiveArtApprovalGranted:false,externalNetworkRequests:0,localLoopbackPreviews:'TEST_ONLY',networkRequests:0,credentialAccess:false,privateCampaignAccess:false,newAccountCPPCallProofClaimed:false,quotaRiskRetiredByPrincipal:true,packetsSent:false,packets}
put('EVIDENCE/VERIFICATION_SUMMARY.json',summary)
put('EVIDENCE/CANDIDATE_CHANGED_PATH_INVENTORY.json',{candidate,reviewedPrerequisite:BASE,ancestry:git('rev-list','--reverse',BASE+'..HEAD').split('\n'),merges:0,changedPaths:changed.map(file=>({file,sha256:sha(execFileSync('git',['show',candidate.commit+':'+file],{cwd:root,env,maxBuffer:128000000}))})),LaneCOwnedEdits:['src/app/corpus-presentation/CorpusPresentation.tsx · optional display-safe inspection callback only']})
put('EVIDENCE/FINAL_REVIEW_2_DELIVERY_EXTENSION.json',{status:'PASS',independent:false,genuineBugbot:false,candidate,scope:'Exact fresh reconstruction, all1626 unit/acquisition and62 scoped browser checks, two unsent packet verifiers, source preservation, private-path/secret object scans and closed-member final package verification. Standalone package tamper results are bound separately.',engineeringFoundationOnly:true,MAINAcceptanceGranted:false,networkRequests:0})
const manifest={schemaVersion:'1.0.0',status:summary.status,candidate,reviewedStartCommit:BASE,reviewedStartTree:TREE,acceptedControllerBase:ACCEPTED,incrementalBundlePrerequisite:BASE,incrementalBundleSha256:sha(bytes),sourceDiffSha256:sha(diff),sourceInputArchiveSha256:INPUT_SHA,canonicalCorpusFileSha256:'9a68312148dab31784c7e8221ff7db2bc9f87424e969d1169159aa91df75b90f',corpusInterface:'TE-IFACE-CORPUS@1.0.0',corpusIdentity:'4c9d93c8b9b97503df4580ee72f8d19c7515a9ed29dad54d558cb258bd2c3e60',originalAdmittedLaneCCutCommit:git('rev-parse','e902652'),candidatePromoted:false,packetsSent:false,runtimeProviderCalls:0,credentialAccess:false,productionArtApproved:false,completeHistoryIncluded:false,baseDependentRecovery:true}
put('DELIVERY_MANIFEST.json',manifest)
put('00_READ_ME_FIRST.md','S5-R1 DELIVERED_PENDING_MAIN_LEAD_REVIEW. Integrated engineering MVP foundation, not final art, story/content lock, release or supplier self-promotion. Primary Principal-owned AGENTS.md delta and primary HEAD preserved; only clean linked-root accepted/candidate committed blobs used. Original blocked ZIP retained separately. Run node VERIFY_DELIVERY.mjs after safely extracting unique regular path-safe ZIP members. Exact incremental bundle requires reviewed unpromoted S5 '+BASE+' /tree '+TREE+' already present locally. Full candidate recovery is in GIT and SOURCE_DIFF; the two independently verifiable targeted lane directories bind this candidate but recover only their minimum source/test subsets. Both PREPARED_NOT_SENT. All1626 unit/acquisition and62 scoped browser checks reran in a fresh local reconstruction using installed locked dependencies and8 hash-bound previously published redacted test inputs. No registry/provider/credential/private-campaign access. No nested historical return ZIP or actual Pixel archive is included. Screenshots are task-generated controller placeholders, not actual Pixel art. Viewport480x270 whole-game; terminal replaces room+controls with shared semantic reducer.25 frozen context records remain separate from exact proof. See Lead notes, MAIN review, computed clip/capability identity specification/crosswalk and single-EXPLORE inventory. Original24-beat blueprint/counts/viewport/pending art are unchanged in the exact prerequisite. See two explicitly same-agent fallback reviews, all stopped attempts and raw-safe local test logs. Fixed deadlines are unchanged. Stop for independent MAIN review.\n')
const binaryAllowed=['GIT/trace-escape-incremental.bundle',...binaryInputs,...['terminal-4x.png','plain-200pct-forced.png','evidence-sea-placeholder.png'].map(n=>'SCREENSHOTS/'+n)]
function verifyDelivery(){
 const fail=n=>{throw Error(n)},read=n=>fs.readFileSync(path.join(root,n))
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name),s=fs.lstatSync(p);if(s.isSymbolicLink()||(!s.isDirectory()&&(!s.isFile()||s.nlink!==1)))fail('S5_R1_NONREGULAR');return s.isDirectory()?walk(p):[path.relative(root,p).split(path.sep).join('/')] }).sort()
 if(JSON.stringify(walk(root))!==JSON.stringify(allowed))fail('S5_R1_EXACT_MEMBERS')
 const seen=new Set(),lines=read('MANIFEST.sha256').toString().trimEnd().split('\n');if(lines.length!==allowed.length-1)fail('S5_R1_HASH_COUNT')
 for(const l of lines){const h=l.slice(0,64),n=l.slice(66);if(!/^[a-f0-9]{64}$/.test(h)||l.slice(64,66)!=='  '||!allowed.includes(n)||n==='MANIFEST.sha256'||seen.has(n)||sha(read(n))!==h)fail('S5_R1_HASH');seen.add(n)}
 for(const[n,h]of Object.entries(expectedHashes))if(sha(read(n))!==h)fail('S5_R1_PINNED_SOURCE_BINDING')
 const m=JSON.parse(read('DELIVERY_MANIFEST.json'));if(JSON.stringify(m)!==JSON.stringify(manifest))fail('S5_R1_MANIFEST_BINDINGS')
 const b=read('GIT/trace-escape-incremental.bundle'),header=b.toString('utf8',0,b.indexOf(Buffer.from('\n\n')))
 if(!header.includes('-'+m.reviewedStartCommit+' ')||header.split('\n').filter(x=>x.startsWith('-')).length!==1||!header.includes(m.candidate.commit+' HEAD')||sha(b)!==m.incrementalBundleSha256||sha(read('SOURCE_DIFF.patch'))!==m.sourceDiffSha256)fail('S5_R1_GIT_BINDING')
 for(const lane of ['A','C']){const p=JSON.parse(read('LANE_'+lane+'_PREPARED_NOT_SENT/TARGETED_REGRESSION_CONTRACT.json'));if(p.status!=='PREPARED_NOT_SENT'||p.packetsSent!==false||p.providerRequests!==0||JSON.stringify(p.candidate)!==JSON.stringify(m.candidate)||p.requiresPrerequisiteCommit!==m.reviewedStartCommit)fail('S5_R1_PACKET_AUTHORITY');for(const f of p.files)if(sha(read('LANE_'+lane+'_PREPARED_NOT_SENT/SOURCE/'+f.file))!==f.sha256)fail('S5_R1_PACKET_SOURCE')}
 const v=JSON.parse(read('EVIDENCE/PROTECTED_PRIMARY_AND_CANDIDATE_PRESERVATION.json'));if(v.primaryProtectedFileDirectlyRead!==false||v.primaryProtectedFileHashComputed!==false||v.primaryProtectedFileDiffedCopiedStagedPackaged!==false||v.trustedAcceptedCommitAgentsBlob!==v.trustedCandidateCommitAgentsBlob||v.primaryHeadBefore!==m.acceptedControllerBase||v.primaryHeadAfter!==m.acceptedControllerBase||JSON.stringify(v.primaryBefore)!==JSON.stringify(v.primaryAfter)||JSON.stringify(v.primaryAfter)!==JSON.stringify([' M AGENTS.md']))fail('S5_R1_PROTECTED_PRESERVATION')
 for(const n of allowed){if(binaryAllowed.includes(n))continue;let t;try{t=new TextDecoder('utf8',{fatal:true}).decode(read(n))}catch{fail('S5_R1_NON_TEXT_PAYLOAD')};if(privatePathFindings(t).length||hasSecretLikeValue(t))fail('S5_R1_PRIVACY')}
 console.log(JSON.stringify({status:'PASS',members:allowed.length,hashes:seen.size,candidate:m.candidate,terminalStatus:m.status,packetsSent:false,baseDependentRecovery:true,protectedPrimaryPreserved:true,productionArtApproved:false}))
}
const secret=fs.readFileSync(path.join(root,'scripts/secret-patterns.mjs'),'utf8').replace('export function','function'),privacy=fs.readFileSync(path.join(root,'scripts/nq5-s1/privacy.mjs'),'utf8').split('export function privatePathFindings')[1].split('export function currentTreeScan')[0]
const seal=()=>{
 payload.delete('VERIFY_DELIVERY.mjs');payload.delete('MANIFEST.sha256')
 for(const n of ['VERIFY_DELIVERY.mjs','MANIFEST.sha256'])if(fs.existsSync(path.join(dir,n)))fs.unlinkSync(path.join(dir,n))
 const expectedHashes=Object.fromEntries([...payload].filter(([n])=>n!=='DELIVERY_MANIFEST.json').map(([n,b])=>[n,sha(b)])),allowed=[...payload.keys(),'VERIFY_DELIVERY.mjs','MANIFEST.sha256'].sort()
 put('VERIFY_DELIVERY.mjs',"import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';const root=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),allowed="+JSON.stringify(allowed)+",manifest="+JSON.stringify(manifest)+",expectedHashes="+JSON.stringify(expectedHashes)+",binaryAllowed="+JSON.stringify(binaryAllowed)+";\n"+secret+'\nfunction privatePathFindings'+privacy+'\n('+verifyDelivery.toString()+')();\n')
 for(const[n,b]of payload)if(!binaryAllowed.includes(n))check(!privatePathFindings(b.toString()).length&&!hasSecretLikeValue(b.toString()),'PACKAGE_PRIVACY_'+n)
 put('MANIFEST.sha256',[...payload].sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>sha(b)+'  '+n).join('\n')+'\n')
 run('node',['VERIFY_DELIVERY.mjs'],dir);return allowed
}
const tamper=allowed=>{
 const results=[],rehash=()=>fs.writeFileSync(path.join(dir,'MANIFEST.sha256'),allowed.filter(n=>n!=='MANIFEST.sha256').map(n=>sha(fs.readFileSync(path.join(dir,n)))+'  '+n).join('\n')+'\n')
 const reject=(name,apply,restore,expected)=>{const hashes=fs.readFileSync(path.join(dir,'MANIFEST.sha256'));try{apply();let stopped=false;try{execFileSync('node',['VERIFY_DELIVERY.mjs'],{cwd:dir,env,stdio:['pipe','pipe','pipe']})}catch(e){check(String(e.stderr).includes(expected),'WRONG_REJECTION_'+name);stopped=true}check(stopped,'FALSE_SUCCESS_'+name);results.push({name,status:'REJECTED',expected})}finally{restore();fs.writeFileSync(path.join(dir,'MANIFEST.sha256'),hashes)}}
 const name='FRESH_LOGS/typecheck.log',original=fs.readFileSync(path.join(dir,name))
 reject('changed byte',()=>fs.appendFileSync(path.join(dir,name),'CORRUPTION'),()=>fs.writeFileSync(path.join(dir,name),original),'S5_R1_HASH')
 reject('extra member',()=>fs.writeFileSync(path.join(dir,'EXTRA.txt'),'TEST'),()=>fs.unlinkSync(path.join(dir,'EXTRA.txt')),'S5_R1_EXACT_MEMBERS')
 reject('missing member',()=>fs.unlinkSync(path.join(dir,name)),()=>fs.writeFileSync(path.join(dir,name),original),'S5_R1_EXACT_MEMBERS')
 reject('symlink',()=>{fs.unlinkSync(path.join(dir,name));fs.symlinkSync('synthetic-target',path.join(dir,name))},()=>{fs.unlinkSync(path.join(dir,name));fs.writeFileSync(path.join(dir,name),original)},'S5_R1_NONREGULAR')
 const mutate=(n,label,change,expected='S5_R1_PINNED_SOURCE_BINDING')=>{const b=fs.readFileSync(path.join(dir,n));reject(label,()=>{const x=JSON.parse(b);change(x);fs.writeFileSync(path.join(dir,n),JSON.stringify(x,null,2)+'\n');rehash()},()=>fs.writeFileSync(path.join(dir,n),b),expected)}
 mutate('REPORTS/SINGLE_EXPLORE_CROSSWALK.json','resealed dual explore claim',x=>{x.canonicalTotal=6})
 mutate('REPORTS/IDENTITY_CROSSWALK.json','resealed stale clip hash',x=>{x.computedClipSha256='0'.repeat(64)})
 mutate('REPORTS/PRESERVATION.json','resealed frozen corpus pin',x=>{x.preservedFiles[0].sha256='0'.repeat(64)})
 mutate('LANE_A_PREPARED_NOT_SENT/TARGETED_REGRESSION_CONTRACT.json','resealed sent packet',x=>{x.status='SENT';x.packetsSent=true})
 mutate('EVIDENCE/PROTECTED_PRIMARY_AND_CANDIDATE_PRESERVATION.json','resealed protected-file copy claim',x=>{x.primaryProtectedFileDiffedCopiedStagedPackaged=true})
 mutate('INTEGRATED_SOURCE/artifacts/g6p-s5/REPORTS/SYNTHETIC_INTAKE_EXAMPLE.json','resealed derivative approval inheritance',x=>{x.clips[0].frames[0].durationMs++})
 mutate('SUPPLIED_INPUT/TRACE_ESCAPE_MAIN_LEAD_REVIEW_S5_RECEIPT_v1.0.0_2026-09-18.json','resealed MAIN source identity',x=>{x.reviewed_candidate.promoted=true})
 mutate('DELIVERY_MANIFEST.json','resealed candidate substitution',x=>{x.candidate.tree='0'.repeat(40)},'S5_R1_MANIFEST_BINDINGS')
 check(results.length===12,'TAMPER_COUNT');run('node',['VERIFY_DELIVERY.mjs'],dir);return results
}
let allowed=seal();const adversarial=tamper(allowed);put('EVIDENCE/PACKAGE_ADVERSARIAL_RESULTS.json',{status:'PASS',rejections:adversarial.length,cases:adversarial,limitations:'Rejects alterations against embedded exact-source pins, including attacker-rehashed member manifest. The verifier itself and its trust root must be obtained with the published final ZIP SHA; not a digital signature or independent MAIN acceptance.'});allowed=seal();tamper(allowed)
for(const n of allowed)fs.utimesSync(path.join(dir,n),new Date('2000-01-01Z'),new Date('2000-01-01Z'))
const zip=path.join(tmp,'delivery.zip'),repeat=path.join(tmp,'repeat.zip');run('zip',['-X','-q',zip,...allowed],dir);run('zip',['-X','-q',repeat,...allowed],dir);check(sha(fs.readFileSync(zip))===sha(fs.readFileSync(repeat)),'ZIP_DETERMINISM')
const meta="import zipfile,stat,json,sys\nwith zipfile.ZipFile(sys.argv[1]) as z:\n n=[i.filename for i in z.infolist()]\n assert len(n)==len(set(n))\n for i in z.infolist():\n  assert not i.is_dir() and stat.S_IFMT(i.external_attr>>16) in (0,stat.S_IFREG) and not i.filename.startswith('/') and '\\\\' not in i.filename and not any(p in ('','..','.') for p in i.filename.split('/'))\n print(json.dumps(n))"
check(JSON.stringify(JSON.parse(run('python3',['-c',meta,zip])).sort())===JSON.stringify(allowed),'ZIP_SAFE_EXACT_MEMBERS')
const extracted=path.join(tmp,'extracted');fs.mkdirSync(extracted);run('unzip',['-q',zip,'-d',extracted]);const verification=run('node',['VERIFY_DELIVERY.mjs'],extracted)
for(const n of allowed)check(fs.readFileSync(path.join(dir,n)).equals(fs.readFileSync(path.join(extracted,n))),'ROUNDTRIP_BYTES')
check(git('rev-parse','HEAD')===candidate.commit&&git('rev-parse','HEAD^{tree}')===candidate.tree,'CANDIDATE_STABLE')
check(primaryStatus()==='M AGENTS.md'&&primaryHead()===ACCEPTED,'PRIMARY_FINAL_METADATA')
fs.mkdirSync(output,{recursive:true});check(!fs.existsSync(path.join(output,OUTPUT)),'NO_DELIVERY_OVERWRITE');const dest=path.join(output,OUTPUT);fs.copyFileSync(zip,dest,fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({status:'DELIVERED_PENDING_MAIN_LEAD_REVIEW',archive:dest,sha256:sha(fs.readFileSync(dest)),bytes:fs.statSync(dest).size,members:allowed.length,candidate,freshBroadUnitAcquisitionTests:unitCount,totalScopedBrowserTests:62,packageAdversarialRejections:12,networkRequests:0,finalArchiveVerification:JSON.parse(verification)},null,2))
