import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync,spawnSync} from 'node:child_process'
const root=process.cwd(),base='47f0466e4f6f31ba2583577c4ff747b2dc1dab3b',fresh=fs.mkdtempSync(path.join(os.tmpdir(),'s2-browser-baseline-'))
const env={PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC',TMPDIR:os.tmpdir(),CI:'1',NO_COLOR:'1',NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs')}
const names=execFileSync('git',['ls-tree','-r','--name-only',base,'--','src','public','tests','scripts','docs','package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','tsconfig.acquisition.json','playwright.config.ts']).toString().trim().split('\n')
for(const n of names){if(!n||n.startsWith('/')||n.split('/').includes('..')||/NANSEN_API_KEY/i.test(n))throw Error('BASELINE_PATH');fs.mkdirSync(path.dirname(path.join(fresh,n)),{recursive:true});fs.writeFileSync(path.join(fresh,n),execFileSync('git',['show',base+':'+n],{maxBuffer:16000000}))}
fs.symlinkSync(path.join(root,'node_modules'),path.join(fresh,'node_modules'),'dir')
fs.copyFileSync('scripts/s2-regression-browser.config.mjs',path.join(fresh,'scripts/s2-regression-browser.config.mjs'))
const r=spawnSync('node',['node_modules/@playwright/test/cli.js','test','--config','scripts/s2-regression-browser.config.mjs','capture.spec.ts','cold-open.spec.ts','g5-hero.spec.ts'],{cwd:fresh,env,encoding:'utf8',maxBuffer:128000000})
const text=((r.stdout||'')+(r.stderr||'')).split(fresh).join('[EXACT_ACCEPTED_BASE_VERIFICATION_ROOT]').split(root).join('[CONTROLLER_ROOT]').split(os.tmpdir()).join('[LOCAL_VERIFICATION_ROOT]').replace(/\u001b\[[0-9;]*m/g,'')
fs.writeFileSync('artifacts/g6p-s2/LOGS/exact-accepted-base-legacy-browser-confirmed.log',text+'\nBASE_COMMIT='+base+'\nEXIT_CODE='+r.status+'\n')
console.log(JSON.stringify({base,exitCode:r.status,legacyFailedCount:Number(text.match(/(\d+) failed\s/)?.[1]),legacyPassedCount:Number(text.match(/(\d+) passed \(/)?.[1]),purpose:'Distinguish unchanged historical journey failures from candidate regressions; no acceptance from a failing run.'}))
