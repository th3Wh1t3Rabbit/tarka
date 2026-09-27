import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'
import {laneContractFixture} from '../nq5-s5/lane-fixture.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
const [name,command,...args]=process.argv.slice(2),root=process.cwd()
if(!/^[a-z0-9-]+$/.test(name))throw Error('LOG_NAME')
const hold=path.join(root,'scripts/nq5-r2/hold.cjs')
const env={PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC',TMPDIR:process.env.TMPDIR||os.tmpdir(),NODE_OPTIONS:'--require '+hold,CI:'1',NO_COLOR:'1',PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH}
if(args.some(a=>a.includes('vitest')||a.endsWith('catalogs.node.mjs'))){const fixture=laneContractFixture(root);env.S4_LANE_CONTRACT_ROOT=fixture.root;env.NODE_OPTIONS+=' --import '+path.join(root,'scripts/nq5-s4/lane-test-scope.mjs')}
if(fs.existsSync('artifacts/g6p-s5-r1/LOGS/'+name+'.log'))throw Error('LOG_ALREADY_EXISTS')
const r=spawnSync(command,args,{cwd:root,env,maxBuffer:128000000,encoding:'utf8'})
const text=(r.stdout||'')+(r.stderr||'')+'\nEXIT_CODE='+r.status+'\n'
const normalized=text.split(root).join('[CONTROLLER_ROOT]').split(env.TMPDIR).join('[LOCAL_VERIFICATION_ROOT]').replace(/\u001b\[[0-9;]*m/g,'')
const safe=privatePathFindings(normalized).reduce((s,p)=>s.split(p).join('[REDACTED_LOCAL_TOOL_PATH]'),normalized)
fs.mkdirSync('artifacts/g6p-s5-r1/LOGS',{recursive:true});fs.writeFileSync('artifacts/g6p-s5-r1/LOGS/'+name+'.log',safe)
console.log(JSON.stringify({log:name,status:r.status===0?'PASS':'FAILED_ATTEMPT',exitCode:r.status,bytes:Buffer.byteLength(safe)}));process.exitCode=r.status===0?0:1
