import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import {sha} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {OFF,admitEntries} from '../nq5-s1/core.mjs'
import {laneContractFixture} from './lane-fixture.mjs'
import {allowedPath} from './verify.mjs'
import {attachPublishedRegressionInputs} from '../nq5-s2/published-regression-inputs.mjs'
export const OUTPUT='TRACE_ESCAPE_G6P_NQ5_T1_S4_CONTROLLER_CONTENT_ADMISSION_TRUTH_COPY_AND_INTEGRATION_FOUNDATION_DELIVERY_v1.0.0.zip'
const BASE='299bc67ab65c3f4fdda22d08e76c6c23df89c8f8',BASE_TREE='8fa1fcfa3a919fedd70cac1c77ec986e0d7d5986',PARENT='299bc67ab65c3f4fdda22d08e76c6c23df89c8f8',INPUT_ZIP_SHA='8b75a7636bc03e9d3090ffd0c77a3c83d17e44986c12496bc6aade35b5928c74'
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'s2-delivery-')),dir=path.join(tmp,'package'),fresh=path.join(tmp,'reconstructed'),objectRoot=path.join(tmp,'pack-audit')
const env={PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC',TMPDIR:os.tmpdir(),NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs'),CI:'1',NO_COLOR:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}
const run=(cmd,args,cwd=root)=>{try{return execFileSync(cmd,args,{cwd,env,maxBuffer:128000000,stdio:['pipe','pipe','pipe']}).toString()}catch(e){const d=path.join(root,'artifacts/g6p-s4/LOGS');fs.mkdirSync(d,{recursive:true});let i=1;while(fs.existsSync(path.join(d,'package-stopped-'+i+'.log')))i++;fs.writeFileSync(path.join(d,'package-stopped-'+i+'.log'),sanitize((e.stdout||'').toString()+(e.stderr||'').toString())+'\nEXIT_CODE='+e.status+'\n');throw Error('S4_PACKAGE_STOPPED_'+cmd)}} ,git=(...a)=>run('git',a).trim()
const sanitize=t=>t.split(root).join('[CONTROLLER_ROOT]').split(tmp).join('[FRESH_VERIFICATION_ROOT]').split(os.tmpdir()).join('[LOCAL_VERIFICATION_ROOT]').replace(/\u001b\[[0-9;]*m/g,'')
fs.mkdirSync(dir)
const candidate={commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),parent:git('rev-parse','HEAD^')}
if(candidate.commit===PARENT||git('rev-parse',BASE+'^{tree}')!==BASE_TREE)throw Error('S4_ANCESTRY_IDENTITY');run('git',['merge-base','--is-ancestor',BASE,candidate.commit]);run('git',['merge-base','--is-ancestor',PARENT,candidate.commit])
if(git('rev-list','--merges',BASE+'..'+candidate.commit))throw Error('S4_R1_MERGE_FORBIDDEN')
if(git('diff','--name-only','HEAD','--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION'))throw Error('S4_DIRTY_GOVERNED_TRACKED')
const changed=git('diff','--name-only',BASE,candidate.commit).split('\n')
const lane=JSON.parse(fs.readFileSync('artifacts/g6p-s4/REPORTS/LANE_A_ADMISSION.json')).laneFiles.map(x=>x.file)
if(changed.some(n=>!allowedPath(n,lane)))throw Error('S4_CHANGED_PATH_SCOPE')
const payload=new Map(),put=(n,b)=>{if(!n||n.startsWith('/')||n.split('/').includes('..')||n.includes('\\')||payload.has(n))throw Error('S4_PACKAGE_PATH');b=Buffer.isBuffer(b)?b:Buffer.from(typeof b==='string'?b:JSON.stringify(b,null,2)+'\n');fs.mkdirSync(path.dirname(path.join(dir,n)),{recursive:true});fs.writeFileSync(path.join(dir,n),b,{flag:'wx'});payload.set(n,b)}
const log=(n,text)=>put('LOGS/'+n+'.log',sanitize(text))
const bundle=path.join(tmp,'incremental.bundle');run('git',['-c','pack.threads=1','bundle','create',bundle,'HEAD','^'+BASE])
const bytes=fs.readFileSync(bundle),boundary=bytes.indexOf(Buffer.from('\n\n'))
if(boundary<0)throw Error('S4_BUNDLE_HEADER');const header=bytes.subarray(0,boundary).toString()
if(!header.includes('-'+BASE+' ')||header.split('\n').filter(l=>l.startsWith('-')).length!==1)throw Error('S4_EXACT_BASE_PREREQUISITE')
fs.mkdirSync(objectRoot);run('git',['init','--quiet'],objectRoot);fs.mkdirSync(path.join(objectRoot,'.git/objects/info'),{recursive:true});fs.writeFileSync(path.join(objectRoot,'.git/objects/info/alternates'),path.join(root,'.git/objects')+'\n')
const indexed=execFileSync('git',['index-pack','--fix-thin','--stdin'],{cwd:objectRoot,env,input:bytes.subarray(boundary+2),maxBuffer:128000000}).toString().trim(),packHash=indexed.split(/\s+/).at(-1),packIndex=path.join(objectRoot,'.git/objects/pack','pack-'+packHash+'.idx')
const objects=run('git',['verify-pack','-v',packIndex],objectRoot).split('\n').filter(l=>/^[a-f0-9]{40} (?:blob|commit|tree|tag) /.test(l)).map(l=>{const[id,type]=l.split(' ');return{id,type}})
if(!objects.length)throw Error('S4_PACK_OBJECTS_EMPTY')
let scanned=0;for(const o of objects){if(!['blob','commit','tag'].includes(o.type))continue;const b=execFileSync('git',['cat-file',o.type,o.id],{cwd:objectRoot,env,maxBuffer:128000000});let text;try{text=new TextDecoder('utf8',{fatal:true}).decode(b)}catch{throw Error('S4_NON_TEXT_NEW_OBJECT')};if(privatePathFindings(text).length||hasSecretLikeValue(text))throw Error('S4_PACKAGED_GIT_OBJECT_PRIVACY');scanned++}
const objectReport={status:'PASS',bundleSha256:sha(bytes),prerequisiteCommit:BASE,objects:objects.length,textObjectsScanned:scanned,objectIds:objects,thinPackDependencyMaterialization:'Indexed with local existing base-object alternates; every object in the reconstructed incremental pack scanned, including any required delta bases.',privatePathFindings:0,secretFindings:0,completeInheritedHistoryPackaged:false,credentialFileOpened:false,networkRequests:0}
put('EVIDENCE/INCREMENTAL_GIT_OBJECT_PRIVACY.json',objectReport);put('GIT/trace-escape-incremental.bundle',bytes)
fs.mkdirSync(fresh);run('git',['init','--quiet'],fresh);fs.mkdirSync(path.join(fresh,'.git/objects/info'),{recursive:true});fs.writeFileSync(path.join(fresh,'.git/objects/info/alternates'),path.join(root,'.git/objects')+'\n')
const bv=run('git',['bundle','verify',bundle],fresh);run('git',['fetch','--quiet','--no-tags',bundle,'HEAD:refs/heads/candidate'],fresh);run('git',['symbolic-ref','HEAD','refs/heads/candidate'],fresh);run('git',['read-tree','HEAD'],fresh)
if(run('git',['rev-parse','HEAD'],fresh).trim()!==candidate.commit||run('git',['rev-parse','HEAD^{tree}'],fresh).trim()!==candidate.tree||run('git',['rev-parse','HEAD^'],fresh).trim()!==candidate.parent)throw Error('S4_RECONSTRUCTED_IDENTITY')
const names=run('git',['ls-files','-z','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION'],fresh).split('\0').filter(Boolean)
const modes=new Map(run('git',['ls-files','--stage','-z','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION'],fresh).split('\0').filter(Boolean).map(l=>[l.slice(l.indexOf('\t')+1),l.slice(0,6)]))
for(const n of names){if(n.startsWith('/')||n.split('/').includes('..')||!['100644','100755'].includes(modes.get(n)))throw Error('S4_FRESH_PATH_MODE');const b=execFileSync('git',['show','HEAD:'+n],{cwd:fresh,env,maxBuffer:128000000});fs.mkdirSync(path.dirname(path.join(fresh,n)),{recursive:true});fs.writeFileSync(path.join(fresh,n),b,{flag:'wx',mode:modes.get(n)==='100755'?0o755:0o644})}
fs.symlinkSync(path.join(root,'node_modules'),path.join(fresh,'node_modules'),'dir');fs.appendFileSync(path.join(fresh,'.git/info/exclude'),'\nnode_modules\n')
const fsck=run('git',['fsck','--full','--strict'],fresh)
put('EVIDENCE/PUBLISHED_REGRESSION_INPUT_BINDINGS.json',attachPublishedRegressionInputs(root,tmp,env))
const diff=execFileSync('git',['diff','--binary',BASE,candidate.commit],{cwd:root,env,maxBuffer:128000000}),freshDiff=execFileSync('git',['diff','--binary',BASE,candidate.commit],{cwd:fresh,env,maxBuffer:128000000});if(!diff.equals(freshDiff))throw Error('S4_EXACT_DIFF_RECONSTRUCTION');put('SOURCE_DIFF.patch',diff)
log('incremental-reconstruction',bv+fsck+'\nExact accepted/promoted S3-R1 prerequisite, candidate/tree/parent, strict fsck, and identical base-to-candidate patch: PASS. Local object alternates used; no complete history copied into delivery.\n')

log('fresh-s4-boundaries',run('node',['scripts/nq5-s4/verify.mjs'],fresh))
log('fresh-no-network',run('node',['scripts/nq5-s3-r1/no-network.mjs'],fresh))
log('fresh-scenario-pack',run('node',['scripts/g5-pack.mjs','verify'],fresh))
log('fresh-json-schemas',run('python3',['scripts/nq5-s3-r1/schema-check.py'],fresh))
const fixture=laneContractFixture(fresh);env.S4_LANE_CONTRACT_ROOT=fixture.root;env.NODE_OPTIONS+=' --import '+path.join(fresh,'scripts/nq5-s4/lane-test-scope.mjs')
const test=run('node',['node_modules/vitest/vitest.mjs','run','--maxWorkers=4'],fresh);log('fresh-broad-unit-acquisition',test)
const testCount=Number(test.match(/Tests\s+(\d+) passed/)?.[1]);if(testCount!==1513||/\d+ failed/.test(test))throw Error('S4_FRESH_BROAD_TESTS')
log('fresh-typecheck',run('npm',['run','typecheck'],fresh));log('fresh-build',run('npm',['run','build'],fresh));log('fresh-lint',run('npm',['run','lint'],fresh));log('fresh-browser-boundary',run('node',['scripts/verify-browser-boundary.mjs'],fresh))
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
for(const n of walk(path.join(root,'artifacts/g6p-s4')).sort()){
 const rel=path.relative(path.join(root,'artifacts/g6p-s4'),n).split(path.sep).join('/')
 let b=fs.readFileSync(n);if(rel==='LANE_A_PREPARED_NOT_SENT/TARGETED_REGRESSION_CONTRACT.json'){const x=JSON.parse(b);x.candidate=candidate;b=Buffer.from(JSON.stringify(x,null,2)+'\n')}
 put(rel,b)
}
for(const n of walk(path.join(root,'docs/source/execution-s4')).sort())put('SOURCE_INPUT/'+path.relative(path.join(root,'docs/source/execution-s4'),n).split(path.sep).join('/'),fs.readFileSync(n))
put('EVIDENCE/NOTES_FOR_LEAD.md',fs.readFileSync(path.join(root,'docs/G6P_NQ5_T1_S4_NOTES_FOR_LEAD.md')))
for(const n of changed.filter(n=>/^(src|scripts|tests|content|public)\//.test(n)))put('INTEGRATED_SOURCE/'+n,fs.readFileSync(path.join(root,n)))
const readReport=n=>JSON.parse(payload.get('REPORTS/'+n))
const requireLog=(n,count)=>{const t=payload.get('LOGS/'+n+'.log')?.toString();if(!t||!t.includes(count+' passed')||!t.includes('EXIT_CODE=0')||/\d+ failed/.test(t))throw Error('S4_REQUIRED_LOG_'+n)}
requireLog('browser-current',34);requireLog('browser-fixes',3);requireLog('browser-s3',3);requireLog('browser-authority',1);requireLog('browser-s4-corrected',2)
for(const n of ['REVIEW_1.json','REVIEW_2.json']){const x=readReport(n);if(x.status!=='PASS_CLOSED_TASK_OWNED_FINDINGS'||x.independent!==false)throw Error('S4_REVIEWS_REQUIRED');for(const f of x.implementationBindings)if(sha(fs.readFileSync(path.join(root,f.file)))!==f.sha256)throw Error('S4_REVIEW_STALE')}
const summary={status:'DELIVERED_PENDING_MAIN_LEAD_REVIEW',candidate,reviewedStart:{commit:BASE,tree:BASE_TREE},freshBroadUnitAcquisitionTests:testCount,currentBrowserTests:34,focusedS2BrowserTests:3,focusedS3BrowserTests:3,authorityBrowserTests:1,focusedS4BrowserTests:2,totalScopedBrowserTests:43,exactClipboardChecks:9,focusedCountsNotAddedToBroadTotal:true,acceptedLaneAdditions:37,compiledAnswerFreeNonoptionalEntries:374,truthCopyChangedFiles:4,MAINFrozenBySeparateReceipt:true,supplierSelfFrozen:false,corpusGameplayIntegrated:false,LaneCPathsChanged:0,packetsSent:false,networkRequests:0,credentialAccess:false,privateStateAccess:false,quotaClaimed:false,strictFsck:'PASS',exactDiffReproduced:true,incrementalGitPrivacy:'PASS',baseDependentRecovery:true,completeHistoryIncluded:false,twoReviews:'MAIN_OWNED_DISCLOSED_FALLBACK_NOT_INDEPENDENT_ACCEPTANCE',legacyBrowser:'Historical S2 28 pass /17 fail; not rerun or claimed passing. Current excludes capture/cold-open/g5-hero; S2/S3/S3-R1/S4 focused cases run separately.',authorities:OFF}
put('EVIDENCE/VERIFICATION_SUMMARY.json',summary)
const manifest={schemaVersion:'1.0.0',status:summary.status,candidate,reviewedStartCommit:BASE,reviewedStartTree:BASE_TREE,incrementalBundlePrerequisite:BASE,incrementalBundleSha256:sha(bytes),sourceDiffSha256:sha(diff),sourceInputArchiveSha256:INPUT_ZIP_SHA,corpusInterface:'TE-IFACE-CORPUS@1.0.0',corpusIdentity:'4c9d93c8b9b97503df4580ee72f8d19c7515a9ed29dad54d558cb258bd2c3e60',MAINFreezeReceipt:'MAIN-TE-IFACE-CORPUS-1.0.0-FREEZE-20260917-01',MAINFrozenBySeparateReceipt:true,supplierSelfFrozen:false,contentInterface:'TE-IFACE-CONTENT@1.1.0',contentIdentity:'540623c9e7f973f0f1cfa4bd4aa5b27f5150247004a05b61ab3a8791b87e0a2e',candidatePromoted:false,corpusGameplayIntegrated:false,LaneCPathsChanged:0,packetsSent:false,runtimeProviderCalls:0,quotaClaimed:false,completeHistoryIncluded:false,baseDependentRecovery:true,authorities:OFF}
put('DELIVERY_MANIFEST.json',manifest)
put('EVIDENCE/PACKAGE_POLICY_CHECKS.json',{status:'PASS_CONDITIONAL_ON_CHECKED_EXECUTION',rejections:10,cases:['changed byte','extra member','missing member','symlink','resealed alias rename','resealed stale truth hash','resealed optional banter','resealed Lane C scope','resealed MAIN freeze receipt','rehashed candidate identity substitution']})
put('00_READ_ME_FIRST.md','S4: DELIVERED_PENDING_MAIN_LEAD_REVIEW. Supplied MAIN independently froze corpus; unchanged supplier does not self-authorize. Controller foundation is pending review, not full gameplay/journey/content-lock acceptance. Lane A targeted packet UNSENT. Zero external transport/credentials/private state. Safely extract unique regular path-safe members then run node VERIFY_DELIVERY.mjs. Incremental bundle requires exact accepted/promoted '+BASE+' /tree '+BASE_TREE+' locally. No full history, inherited private paths, protected art/editor context or nested historical ZIP. Compare exact candidate/tree/parent, SOURCE_DIFF.patch and strict fsck in a separate local ref. Full local rerun requires installed locked dependencies and eight hash-bound public redacted inputs; no online install/fetch. Immutable Lane A tests run in isolated original-base context; separate integrated S4 path/runtime tests remain required. SOURCE_INPUT is selective, not complete original-validator replay. See notes, failed-attempt logs, truth crosswalk and independent MAIN receipt. Optional banter/exact authoring hints/Lane C gameplay wiring/final density/art/release are deferred. Stop for MAIN review.\n')
const expectedHashes=Object.fromEntries([...payload].filter(([n])=>n!=='DELIVERY_MANIFEST.json').map(([n,b])=>[n,sha(b)]))
const allowed=[...payload.keys(),'VERIFY_DELIVERY.mjs','MANIFEST.sha256'].sort()
function verifyDelivery(){
 const fail=n=>{throw Error(n)},read=n=>fs.readFileSync(path.join(root,n))
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name),s=fs.lstatSync(p);if(s.isSymbolicLink()||(!s.isDirectory()&&(!s.isFile()||s.nlink!==1)))fail('S4_NONREGULAR');return s.isDirectory()?walk(p):[path.relative(root,p).split(path.sep).join('/')] }).sort()
 if(JSON.stringify(walk(root))!==JSON.stringify(allowed))fail('S4_EXACT_MEMBERS')
 const seen=new Set(),lines=read('MANIFEST.sha256').toString().trimEnd().split('\n');if(lines.length!==allowed.length-1)fail('S4_HASH_COUNT')
 for(const l of lines){const h=l.slice(0,64),n=l.slice(66);if(!/^[a-f0-9]{64}$/.test(h)||l.slice(64,66)!=='  '||!allowed.includes(n)||n==='MANIFEST.sha256'||seen.has(n)||sha(read(n))!==h)fail('S4_HASH');seen.add(n)}
 for(const[n,h]of Object.entries(expectedHashes))if(sha(read(n))!==h)fail('S4_PINNED_SOURCE_RECEIPT_BINDING')
 const m=JSON.parse(read('DELIVERY_MANIFEST.json'));if(JSON.stringify(m)!==JSON.stringify(manifest))fail('S4_MANIFEST_BINDINGS')
 const b=read('GIT/trace-escape-incremental.bundle'),header=b.toString('utf8',0,b.indexOf(Buffer.from('\n\n')))
 if(!header.includes('-'+manifest.reviewedStartCommit+' ')||header.split('\n').filter(x=>x.startsWith('-')).length!==1||!header.includes(manifest.candidate.commit+' HEAD')||sha(b)!==manifest.incrementalBundleSha256||sha(read('SOURCE_DIFF.patch'))!==manifest.sourceDiffSha256)fail('S4_GIT_BINDING')
 const p=JSON.parse(read('LANE_A_PREPARED_NOT_SENT/TARGETED_REGRESSION_CONTRACT.json'));if(p.packetsSent!==false||p.providerRequests!==0||p.status!=='PREPARED_NOT_SENT'||JSON.stringify(p.candidate)!==JSON.stringify(manifest.candidate)||p.acceptedAdditions.length!==37)fail('S4_PACKET_AUTHORITY')
 for(const x of p.files){const n=x.file.startsWith('artifacts/g6p-s4/')?x.file.slice('artifacts/g6p-s4/'.length):'INTEGRATED_SOURCE/'+x.file;if(sha(read(n))!==x.sha256)fail('S4_PACKET_BINDING')}
 for(const n of allowed){if(n.startsWith('GIT/'))continue;const text=read(n).toString();if(privatePathFindings(text).length||hasSecretLikeValue(text))fail('S4_PRIVACY')}
 console.log(JSON.stringify({status:'PASS',members:allowed.length,hashes:seen.size,MAINFrozenBySeparateReceipt:true,supplierSelfFrozen:false,packetsSent:false,baseDependentRecovery:true,candidate:manifest.candidate,terminalStatus:manifest.status}))
}
const secret=fs.readFileSync(path.join(root,'scripts/secret-patterns.mjs'),'utf8').replace('export function','function'),privacy=fs.readFileSync(path.join(root,'scripts/nq5-s1/privacy.mjs'),'utf8').split('export function privatePathFindings')[1].split('export function currentTreeScan')[0]
put('VERIFY_DELIVERY.mjs',"import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';const root=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),allowed="+JSON.stringify(allowed)+",manifest="+JSON.stringify(manifest)+",expectedHashes="+JSON.stringify(expectedHashes)+";\n"+secret+'\nfunction privatePathFindings'+privacy+'\n('+verifyDelivery.toString()+')();\n')
for(const[n,b]of payload){if(n.startsWith('GIT/'))continue;if(privatePathFindings(b.toString()).length||hasSecretLikeValue(b.toString()))throw Error('S4_PACKAGE_PRIVACY_'+n)}
put('MANIFEST.sha256',[...payload].sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>sha(b)+'  '+n).join('\n')+'\n');run('node',['VERIFY_DELIVERY.mjs'],dir)
let rejected=0
const rehash=()=>fs.writeFileSync(path.join(dir,'MANIFEST.sha256'),allowed.filter(n=>n!=='MANIFEST.sha256').map(n=>sha(fs.readFileSync(path.join(dir,n)))+'  '+n).join('\n')+'\n')
const reject=(name,apply,restore,expected)=>{const original=fs.readFileSync(path.join(dir,'MANIFEST.sha256'));try{apply();let stopped=false;try{execFileSync('node',['VERIFY_DELIVERY.mjs'],{cwd:dir,env,stdio:['pipe','pipe','pipe']})}catch(e){if(!String(e.stderr).includes(expected))throw Error('S4_WRONG_REJECTION_'+name);stopped=true}if(!stopped)throw Error('S4_FALSE_SUCCESS_'+name);rejected++}finally{restore();fs.writeFileSync(path.join(dir,'MANIFEST.sha256'),original)}}
const logName='LOGS/browser-fixes.log',original=fs.readFileSync(path.join(dir,logName))
reject('byte',()=>fs.appendFileSync(path.join(dir,logName),'CORRUPTION'),()=>fs.writeFileSync(path.join(dir,logName),original),'S4_HASH')
reject('extra',()=>fs.writeFileSync(path.join(dir,'EXTRA.txt'),'SYNTHETIC'),()=>fs.unlinkSync(path.join(dir,'EXTRA.txt')),'S4_EXACT_MEMBERS')
reject('missing',()=>fs.unlinkSync(path.join(dir,logName)),()=>fs.writeFileSync(path.join(dir,logName),original),'S4_EXACT_MEMBERS')
reject('symlink',()=>{fs.unlinkSync(path.join(dir,logName));fs.symlinkSync('synthetic-target',path.join(dir,logName))},()=>{fs.unlinkSync(path.join(dir,logName));fs.writeFileSync(path.join(dir,logName),original)},'S4_NONREGULAR')
const mutate=(n,change,expected)=>{const original=fs.readFileSync(path.join(dir,n));reject(n,()=>{const x=JSON.parse(original);change(x);fs.writeFileSync(path.join(dir,n),JSON.stringify(x,null,2)+'\n');rehash()},()=>fs.writeFileSync(path.join(dir,n),original),expected)}
mutate('INTEGRATED_SOURCE/src/controller/content/runtime-content.json',x=>{x.alias.legacy.hotspot='SYNTHETIC_RENAMED'},'S4_PINNED')
mutate('REPORTS/TRUTH_HASH_CROSSWALK.json',x=>{x.files[0].afterSha256='0'.repeat(64)},'S4_PINNED')
mutate('INTEGRATED_SOURCE/src/controller/content/runtime-content.json',x=>{x.optionalIncluded=true},'S4_PINNED')
mutate('LANE_A_PREPARED_NOT_SENT/TARGETED_REGRESSION_CONTRACT.json',x=>{x.files.push({file:'src/investigation/semantic-ux/SYNTHETIC',sha256:'0'.repeat(64)})},'S4_PINNED')
mutate('SOURCE_INPUT/MAIN_S3_R1_ACCEPTANCE/TRACE_ESCAPE_MAIN_TE_IFACE_CORPUS_1_0_0_FREEZE_RECEIPT_v1.0.0_2026-09-17.json',x=>{x.main_disposition.interface_frozen=false},'S4_PINNED')
mutate('DELIVERY_MANIFEST.json',x=>{x.candidate.tree='0'.repeat(40)},'S4_MANIFEST_BINDINGS')
if(rejected!==10)throw Error('S4_REJECTION_TOTAL');run('node',['VERIFY_DELIVERY.mjs'],dir)
for(const n of allowed)fs.utimesSync(path.join(dir,n),new Date('2000-01-01Z'),new Date('2000-01-01Z'))
const zip=path.join(tmp,'delivery.zip'),repeat=path.join(tmp,'repeat.zip');run('zip',['-X','-q',zip,...allowed],dir);run('zip',['-X','-q',repeat,...allowed],dir);if(sha(fs.readFileSync(zip))!==sha(fs.readFileSync(repeat)))throw Error('S4_ZIP_DETERMINISM')
const metadata="import zipfile,stat,json,sys\nwith zipfile.ZipFile(sys.argv[1]) as z:\n print(json.dumps([{'name':i.filename,'type':'regular' if not i.is_dir() and stat.S_IFMT(i.external_attr>>16) in (0,stat.S_IFREG) else 'nonregular'} for i in z.infolist()]))"
admitEntries(JSON.parse(run('python3',['-c',metadata,zip])),allowed)
const extracted=path.join(tmp,'extracted');fs.mkdirSync(extracted);run('unzip',['-q',zip,'-d',extracted]);const verification=run('node',['VERIFY_DELIVERY.mjs'],extracted)
for(const n of allowed)if(!fs.readFileSync(path.join(dir,n)).equals(fs.readFileSync(path.join(extracted,n))))throw Error('S4_ROUNDTRIP')
if(git('rev-parse','HEAD')!==candidate.commit||git('rev-parse','HEAD^{tree}')!==candidate.tree)throw Error('S4_CANDIDATE_CHANGED')
const dest=path.join(path.dirname(root),OUTPUT);fs.copyFileSync(zip,dest,fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({status:'DELIVERED_PENDING_MAIN_LEAD_REVIEW',archive:dest,sha256:sha(fs.readFileSync(dest)),bytes:fs.statSync(dest).size,members:allowed.length,freshBroadUnitAcquisitionTests:testCount,totalScopedBrowserTests:43,packageAdversarialRejections:rejected,candidate,MAINFrozenBySeparateReceipt:true,supplierSelfFrozen:false,networkRequests:0,finalArchiveVerification:JSON.parse(verification)},null,2))
