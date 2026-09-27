import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import {derive} from './generate.mjs'
import {identity,sha,importActivity} from './activity.mjs'
import {schemaOf} from '../nq5-s1/model.mjs'
import {ACTIVITY_INPUT_SCHEMA} from './schema.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
const root=process.cwd(),env={PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||os.tmpdir(),LANG:'C.UTF-8',NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs')}
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,env,maxBuffer:128000000}).toString(),git=(...a)=>run('git',a).trim()
const base='47f0466e4f6f31ba2583577c4ff747b2dc1dab3b'
if(git('rev-parse',base+'^{tree}')!=='11d9390f547754dc2dfca3d8b5ff19dadb792b40')throw Error('S2_EXACT_BASE_TREE')
run('git',['merge-base','--is-ancestor',base,'HEAD'])
const source='docs/source/v1.11.0',input='docs/source/execution-s2',manifest=fs.readFileSync(input+'/MANIFEST.sha256','utf8').trim().split('\n'),installed=[]
if(manifest.length!==40||sha(fs.readFileSync(input+'/MANIFEST.sha256'))!=='042218fbf1f843960c7f08ce0098d0e3c94e8933d9378567706be5341da23556'||sha(fs.readFileSync(source+'/MANIFEST.sha256'))!=='2630a5423ea9d5d0d447ea37185ac128c802a72c7f853f9704ca1d9484c63f61')throw Error('S2_EXACT_MANIFEST_BYTES')
for(const line of manifest){const[h,n]=line.split('  ');if(!/^[a-f0-9]{64}$/.test(h)||!n||n.startsWith('/')||n.split('/').includes('..'))throw Error('S2_INPUT_MANIFEST');const file=n.startsWith('PROJECT_SOURCE/')?source+'/'+n.slice(15):input+'/'+n;if(sha(fs.readFileSync(file))!==h)throw Error('S2_INPUT_BYTES');installed.push(file)}
const contract=input+'/CONTRACT/TRACE_ESCAPE_CODEX_G6P_NQ5_T1_S2_RULE_ALIGNED_REBASE_CPP_EVIDENCE_P1_FIXES_CORPUS_SEAM_PROMPT_v1.0.0_2026-09-17.txt'
const contractBound=manifest.find(l=>l.endsWith('  '+contract.slice(input.length+1)))
if(!contractBound||sha(fs.readFileSync(contract))!==contractBound.slice(0,64))throw Error('S2_CONTRACT_BYTES')
console.log(run('sha256sum',['-c','MANIFEST.sha256'],path.join(root,source)).trim())
console.log(run('python3',['_TOOLS/VALIDATE_SOURCE_PACK.py'],path.join(root,source)).trim())
const fresh=derive(root)
for(const[n,v]of Object.entries(fresh)){
 const bytes=fs.readFileSync('artifacts/g6p-s2/REPORTS/'+n);if(bytes.toString()!==JSON.stringify(v,null,2)+'\n')throw Error('S2_REPORT_DETERMINISM')
 const{identity:h,...payload}=v;if(h!==identity(payload))throw Error('S2_REPORT_SEAL')
 if(fs.readFileSync('artifacts/g6p-s2/SCHEMAS/'+n+'.schema.json','utf8')!==JSON.stringify(schemaOf(v),null,2)+'\n')throw Error('S2_SCHEMA_DETERMINISM')
}
if(fs.readFileSync('artifacts/g6p-s2/SCHEMAS/MERIDIAN_ACTIVITY_INPUT.schema.json','utf8')!==JSON.stringify(ACTIVITY_INPUT_SCHEMA,null,2)+'\n')throw Error('S2_INPUT_SCHEMA')
const python=`import json,jsonschema\nfrom pathlib import Path\nr=Path('.')\nfor f in sorted((r/'artifacts/g6p-s2/REPORTS').glob('*.json')):\n s=json.loads((r/'artifacts/g6p-s2/SCHEMAS'/(f.name+'.schema.json')).read_text());jsonschema.Draft202012Validator.check_schema(s);jsonschema.validate(json.loads(f.read_text()),s)\ns=json.loads((r/'artifacts/g6p-s2/SCHEMAS/MERIDIAN_ACTIVITY_INPUT.schema.json').read_text());jsonschema.Draft202012Validator.check_schema(s);x=json.loads((r/'docs/source/execution-s2/INPUTS/CPP_SAMPLE_ACTIVITY_OBSERVATION_2026-09-17.json').read_text());jsonschema.validate(x,s)\nprint(json.dumps({'status':'PASS','schemas':4,'localOnly':True}))`
console.log(run('python3',['-c',python]).trim())
const snapshot=JSON.parse(fs.readFileSync('docs/G6P_NQ5_T1_S1_PUBLIC_EVIDENCE_INPUT.json'))
for(const f of snapshot.truth.files)if(sha(fs.readFileSync(f.file))!==f.sha256)throw Error('S2_EXACT_TRUTH_CHANGED')
const historic=git('diff','--name-only','HEAD','--','docs/source',':(exclude)docs/source/v1.11.0',':(exclude)docs/source/execution-s2');if(historic)throw Error('S2_HISTORICAL_SOURCE_MUTATION')
const names=new Set([...git('diff','--name-only',base,'--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION').split('\n'),...run('git',['ls-files','--others','--exclude-standard','--','scripts/nq5-s2','scripts/s2-prefix.config.mjs','scripts/s2-browser.config.mjs','src','tests/unit/s2-controller.test.ts','tests/unit/s2-activity-corpus.test.mjs','tests/unit/s2-prefix.repro.ts','tests/e2e/s2-fixes.spec.ts','tests/e2e/s2-prefix.repro.spec.ts','tests/fixtures/s2','artifacts/g6p-s2','docs/source/execution-s2','docs/source/v1.11.0','docs/G6P_NQ5_T1_S2_CURATED_INPUT.json','docs/G6P_NQ5_T1_S2_ACCOUNTING_CONTRACT.md','docs/G6P_NQ5_T1_S2_ORGANIZER_CLARIFICATION_NOT_SENT.md','docs/G6P_NQ5_T1_S2_NEXT_PACKETS_NOT_SENT.md','docs/G6P_NQ5_T1_S2_NOTES_FOR_LEAD.md','docs/TE_IFACE_CORPUS_1.0.0_RC1.md']).trim().split('\n')].filter(Boolean))
for(const n of names){const st=fs.lstatSync(n);if(!st.isFile()||st.isSymbolicLink())throw Error('S2_CHANGED_REGULAR_FILE');const text=fs.readFileSync(n,'utf8');if(privatePathFindings(text).length||hasSecretLikeValue(text))throw Error('S2_CHANGED_TEXT_PRIVACY_'+n)}
if(fs.readFileSync('src/app/CaseTerminalWorkbench.tsx','utf8').includes('qualification-counted'))throw Error('S2_RETIRED_PUBLIC_COPY')
const probe="const dns=require('node:dns'),net=require('node:net'),https=require('node:https');let n=0;for(const f of[()=>fetch('https://example.invalid'),()=>dns.lookup('example.invalid',()=>{}),()=>net.connect({host:'example.invalid',port:443}),()=>https.get('https://example.invalid')]){try{f()}catch{n++}}if(n!==4)process.exit(1);console.log('FOUR_EXTERNAL_APIS_BLOCKED_BEFORE_ISSUE')"
console.log(run('node',['-e',probe]).trim())
const sample=JSON.parse(fs.readFileSync(input+'/INPUTS/CPP_SAMPLE_ACTIVITY_OBSERVATION_2026-09-17.json')),report=importActivity(sample)
if(report.observed.requests!==20||report.observed.credits!==32||report.finalQuotaProofEligible||report.verifiedSuccessfulLowerBound!==0)throw Error('S2_ACCOUNT_FALSE_SUCCESS')
console.log(JSON.stringify({status:'PASS',inputMembers:manifest.length+2,outerManifestEntries:manifest.length,manifestFiles:2,schemas:4,reports:3,unchangedEulerFiles:snapshot.truth.files.length,governedChangedTextFilesScanned:names.size,privateStateAccess:false,credentialAccess:false,networkRequests:0,externalApisBlocked:4,accountVerifiedLowerBound:0,curatedAcceptedCalls:25,interfaceFrozen:false,LaneCActive:false}))
