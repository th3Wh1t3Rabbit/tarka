#!/usr/bin/env node
import '../nq5-r2/hold.cjs'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import {identity,sha} from '../nq5/schema.mjs'
import {source,cut,digest,git} from './authority.mjs'
import {SUITES} from './gates.mjs'
import {writeArtifact} from './io.mjs'
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),environment=Object.fromEntries(['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','DISPLAY','XDG_RUNTIME_DIR','PLAYWRIGHT_BROWSERS_PATH','npm_config_cache'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]]]))
process.env=environment
const childEnv={...environment,PYTHONDONTWRITEBYTECODE:'1',NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs'),npm_config_update_notifier:'false'}
const run=(cmd,args,cwd)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env:childEnv,stdio:['ignore','pipe','pipe']});let out='';for(const s of[p.stdout,p.stderr])s.on('data',b=>{out+=b;if(out.length>64000000)p.kill()});p.on('error',()=>reject(new Error('P2_R1_LOCAL_TOOL_UNAVAILABLE')));p.on('close',code=>{if(code===0)return resolve(out);const e=new Error('P2_R1_LOCAL_SUITE_FAILED');e.safeOutput=out;reject(e)})})
async function verify(){
 source(root);const candidate=cut(root),implementationSha256=digest(root),temp=fs.mkdtempSync(path.join(os.tmpdir(),'p2-r1-verification-')),fresh=path.join(temp,'clone')
 await run('git',['clone','--quiet','--no-hardlinks',root,fresh],root)
 if(identity(cut(fresh))!==identity(candidate)||digest(fresh)!==implementationSha256)throw new Error('P2_R1_FRESH_CLONE_IDENTITY')
 fs.symlinkSync(path.join(root,'node_modules'),path.join(fresh,'node_modules'),'dir')
 // A dependency symlink is not a directory for the tracked node_modules/
 // ignore rule. Ignore only this explicitly provisioned fresh-clone input.
 fs.appendFileSync(path.join(fresh,'.git/info/exclude'),'\nnode_modules\n')
 // Only exact historical delivery filenames explicitly referenced by qualification
 // modules are copied as read-only verification inputs, never into the delivery.
 const archives=new Set(),walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(mjs|cjs)$/.test(e.name))for(const m of fs.readFileSync(f,'utf8').matchAll(/TRACE_ESCAPE_[A-Za-z0-9_]+DELIVERY_v[0-9.]+\.zip/g))archives.add(m[0])}}
 for(const e of fs.readdirSync(path.join(root,'scripts'),{withFileTypes:true}))if(e.isDirectory()&&e.name.startsWith('nq5'))walk(path.join(root,'scripts',e.name))
 let copied=0;for(const name of [...archives].sort()){const input=path.join(path.dirname(root),name);if(!fs.existsSync(input))continue;const s=fs.lstatSync(input);if(!s.isFile()||s.isSymbolicLink())throw new Error('P2_R1_HISTORICAL_ARCHIVE_REGULAR_REQUIRED');fs.copyFileSync(input,path.join(temp,name),fs.constants.COPYFILE_EXCL);copied++}
 const suites=[],assert=()=>{if(identity(candidate)!==identity(cut(root))||digest(root)!==implementationSha256||identity(cut(fresh))!==identity(candidate)||digest(fresh)!==implementationSha256)throw new Error('P2_R1_VERIFICATION_SOURCE_CHANGED')}
 const suite=async(name,cmd,args,cwd=fresh)=>{assert();process.stdout.write('LOCAL '+name+'\n');let out;try{out=await run(cmd,args,cwd)}catch(e){if(e.safeOutput?.trim())writeArtifact(root,'local',name+'.log',e.safeOutput);throw e};assert();if(!out.trim())throw new Error('P2_R1_EMPTY_SUITE_LOG');writeArtifact(root,'local',name+'.log',out);suites.push({name,status:'PASS',sha256:sha(Buffer.from(out)),verificationScope:cwd===fresh?'FRESH_EXACT_HEAD_CLONE_ISOLATED_LOCAL':'MAIN_CURRENT_AUTHORITY_READ_ONLY_REPLAY'})}
 const names=['nq5-b1-executor','nq5-b1-r1-remediation','nq5-b1-r2-contracts','nq5-b1-r3-resume','nq5-b1-r3-r1-semantics','nq5-b1-r3-r2-signed-flow','nq5-b2-canary','nq5-b3-frontier','nq5-b4-filtered','nq5-p1-pilot','nq5-p2-identity','nq5-p2-breadth','nq5-p2-r1-remediation']
 await suite('execution-adversarial','node',['node_modules/vitest/vitest.mjs','run',...names.map(n=>'tests/unit/'+n+'.test.mjs'),'--reporter=dot'])
 await suite('source-validator','node',['--input-type=module','-e',"import {source} from './scripts/nq5-p2-r1/authority.mjs';console.log(JSON.stringify(source(process.cwd())))"])
 await suite('report-schema-controls','python3',['scripts/test-nq5-report-validation.py'])
 await suite('typecheck-lint','npm',['run','check']);await suite('acquisition-compile','npm',['run','acquisition:compile'])
 await suite('unit-regression','node',['node_modules/vitest/vitest.mjs','run','tests/unit',...names.flatMap(n=>['--exclude','tests/unit/'+n+'.test.mjs']),'--reporter=dot'])
 await suite('acquisition-regression','node',['node_modules/vitest/vitest.mjs','run','tests/acquisition','--reporter=dot'])
 await suite('browser-accessibility-performance','npm',['run','test:e2e','--','--reporter=line'])
 await suite('production-build','npm',['run','build']);await suite('browser-boundary','npm',['run','browser-boundary:verify'])
 await suite('records-office-boundary','npm',['run','g6p:a1:boundary:verify']);await suite('euler-public-pack','npm',['run','g6:pack:verify'])
 await suite('project-clock-status','node',['scripts/nq5-p2-r1/run.mjs','--status'],root)
 await suite('history-secret-boundary','node',['scripts/verify-git-secret-history.mjs'])
 await suite('current-tree-secret-boundary','node',['scripts/scan-prohibitions.mjs',fresh])
 await suite('exact-receipt-index-accounting','node',['scripts/nq5-p2-r1/run.mjs','--audit'],root)
 assert();if(identity(suites.map(x=>x.name))!==identity(SUITES))throw new Error('P2_R1_EXACT_SUITE_SET')
 writeArtifact(root,'local','VERIFICATION.json',{schemaVersion:'1.0.0',status:'PASS',generatedAtUtc:new Date().toISOString(),candidate,implementationSha256,freshVerificationRootCandidate:cut(fresh),freshVerificationRootImplementationSha256:digest(fresh),historicalArchiveInputsCopied:copied,suites,networkHold:true,externalRequests:0,credentialAccess:false,privateMutation:false,mainReadOnlyPrivateReplay:true,freshCloneSuitesActualPrivateStateAccess:false,scope:'FRESH_EXACT_HEAD_CLONE_LOCAL_REGRESSIONS_PLUS_SEPARATE_MAIN_READ_ONLY_RECEIPT_RAW_JOURNAL_RECONCILIATION_NO_CREDENTIALS'})
 process.stdout.write('P2_R1_ALL16_FRESH_LOCAL_SUITES_PASS\n')
}
verify().catch(e=>{process.stderr.write((/^P2_R1_[A-Z0-9_]+$/.test(e.message)?e.message:'P2_R1_FRESH_VERIFICATION_FAILED')+'; no network, credential, reissue or private repair.\n');process.exitCode=1})
