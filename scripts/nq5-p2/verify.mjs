#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {execFileSync,spawn} from 'node:child_process'
import {identity,sha} from '../nq5/schema.mjs'
import {LOCAL_SUITES} from '../nq5-b1/live.mjs'
import {gitEnv} from '../nq5-b1-r1/gates.mjs'
import {sanitizeLog,pathScan} from '../nq5-b1-r2/privacy.mjs'
import {accepted,cut,digest,source,REVIEWS,BASE,ARCHIVE_SHA,CONTRACT_SHA,MANIFEST,OUTPUT} from './authority.mjs'
import {serialize} from './failure.mjs'
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),parent=path.dirname(root),local=path.join(root,'artifacts/g6p-p2/local'),runtime=path.join(root,'artifacts/g6p-p2/runtime')
const environment=Object.fromEntries(['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','DISPLAY','XDG_RUNTIME_DIR','PLAYWRIGHT_BROWSERS_PATH','npm_config_cache'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]]]))
const childEnv={...environment,PYTHONDONTWRITEBYTECODE:'1',NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs'),npm_config_update_notifier:'false'}
const write=(dir,n,x)=>{const f=path.join(dir,n);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,serialize(x))}
const immutable=(n,x)=>{fs.mkdirSync(runtime,{recursive:true});const f=path.join(runtime,n),fd=fs.openSync(f,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);try{fs.writeFileSync(fd,serialize(x));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}const df=fs.openSync(runtime,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);try{fs.fsyncSync(df)}finally{fs.closeSync(df)}}
const run=(cmd,args,cwd=root)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env:childEnv,stdio:['ignore','pipe','pipe']});let out='';for(const s of[p.stdout,p.stderr])s.on('data',b=>{out+=b;if(out.length>64000000)p.kill()});p.on('error',()=>reject(new Error('P2_LOCAL_TOOL_UNAVAILABLE')));p.on('close',code=>{if(code===0)return resolve(out);const e=new Error('P2_LOCAL_TOOL_FAILED');e.safeOutput=out;reject(e)})})
const snapshot=()=>({candidate:cut(root),implementationSha256:digest(root)})
async function verify(){accepted(root);const start=snapshot(),suites=[],assert=()=>{if(identity(start)!==identity(snapshot()))throw new Error('P2_VERIFICATION_SOURCE_CHANGED')},suite=async(name,cmd,args,cwd=root)=>{assert();process.stdout.write('LOCAL '+name+'\n');let out;try{out=await run(cmd,args,cwd)}catch(e){if(e.safeOutput?.trim())write(local,name+'.log',e.safeOutput);throw e};assert();if(!out.trim())throw new Error('P2_EMPTY_LOG');write(local,name+'.log',out);suites.push({name,status:'PASS',sha256:sha(Buffer.from(out))})},names=['nq5-b1-executor','nq5-b1-r1-remediation','nq5-b1-r2-contracts','nq5-b1-r3-resume','nq5-b1-r3-r1-semantics','nq5-b1-r3-r2-signed-flow','nq5-b2-canary','nq5-b3-frontier','nq5-b4-filtered','nq5-p1-pilot','nq5-p2-identity','nq5-p2-breadth'];
 await suite('execution-adversarial','node',['node_modules/vitest/vitest.mjs','run',...names.map(n=>'tests/unit/'+n+'.test.mjs'),'--reporter=dot']);await suite('source-validator','node',['--input-type=module','-e',"import {source} from './scripts/nq5-p2/authority.mjs'; console.log(JSON.stringify(source(process.cwd(),{validate:true})))"]);await suite('report-schema-controls','python3',['scripts/test-nq5-report-validation.py']);await suite('typecheck-lint','npm',['run','check']);await suite('acquisition-compile','npm',['run','acquisition:compile']);await suite('unit-regression','node',['node_modules/vitest/vitest.mjs','run','tests/unit',...names.flatMap(n=>['--exclude','tests/unit/'+n+'.test.mjs']),'--reporter=dot']);await suite('acquisition-regression','node',['node_modules/vitest/vitest.mjs','run','tests/acquisition','--reporter=dot']);await suite('browser-accessibility-performance','npm',['run','test:e2e','--','--reporter=line']);await suite('production-build','npm',['run','build']);await suite('browser-boundary','npm',['run','browser-boundary:verify']);await suite('records-office-boundary','npm',['run','g6p:a1:boundary:verify']);await suite('euler-public-pack','npm',['run','g6:pack:verify']);await suite('project-clock-status','npm',['run','project:status']);await suite('history-secret-boundary','node',['scripts/verify-git-secret-history.mjs']);assert();write(local,'VERIFICATION.json',{schemaVersion:'1.0.0',status:'PASS',generatedAtUtc:new Date().toISOString(),...start,suites,credentialAccess:false,actualPrivateStateAccess:false,privateMutation:false,externalRequests:0,networkHold:true,scope:'ISOLATED_LOCAL_REGRESSION_LOOPBACK_ONLY_NOT_PROVIDER_RUNTIME'});process.stdout.write('P2_ALL14_LOCAL_SUITES_PASS\n')
}

process.env=environment;
verify().catch(e=>{process.stderr.write((/^P2_[A-Z0-9_]+$/.test(e.message)?e.message:'P2_ISOLATED_LOCAL_VERIFICATION_FAILED')+'\n');process.exitCode=1});
