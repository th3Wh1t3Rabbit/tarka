import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import {derive,INPUT,OUTPUT,START} from './generate.mjs'
import {sha,identity,privacyBoundary} from '../nq5-s2/activity.mjs'
import {ACTIVITY_INPUT_SCHEMA} from '../nq5-s2/schema.mjs'
import {reportSchema} from './report-schema.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
const root=process.cwd(),env={PATH:process.env.PATH,LANG:'C.UTF-8',TMPDIR:process.env.TMPDIR||os.tmpdir(),NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs')}
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,env,maxBuffer:128000000}).toString(),git=(...a)=>run('git',a).trim()
if(git('rev-parse',START+'^{tree}')!=='493eb81d654b48cd93312d5388c99c574d6bb77b'||git('rev-parse',START+'^')!=='45e315da21266e5f93eb0f82bd254339a652b9bb')throw Error('S2R1_START_IDENTITY')
run('git',['merge-base','--is-ancestor','47f0466e4f6f31ba2583577c4ff747b2dc1dab3b',START]);run('git',['merge-base','--is-ancestor',START,'HEAD'])
const inputManifestBytes=fs.readFileSync(INPUT+'/MANIFEST.sha256');if(sha(inputManifestBytes)!=='aa6fc0f7f5a7e4583c4457c51f5604417ce7e8f5a84fc7c59fc0af361348636b')throw Error('S2R1_EXACT_INPUT_MANIFEST')
const inputManifest=inputManifestBytes.toString().trim().split('\n'),reconstructed=fs.mkdtempSync(path.join(env.TMPDIR,'s2r1-original-input-'))
for(const line of inputManifest){const[h,n]=line.split('  ');if(!/^[a-f0-9]{64}$/.test(h)||!n||n.startsWith('/')||n.includes('..'))throw Error('S2R1_INPUT_MANIFEST');const b=fs.readFileSync(INPUT+'/'+n),original=n.endsWith('.csv')?Buffer.from(b.toString().replace(/\r?\n/g,'\r\n')):b;if(sha(original)!==h)throw Error('S2R1_INPUT_BYTES_'+n);fs.mkdirSync(path.dirname(path.join(reconstructed,n)),{recursive:true});fs.writeFileSync(path.join(reconstructed,n),original)}
fs.copyFileSync(INPUT+'/MANIFEST.sha256',reconstructed+'/MANIFEST.sha256')
console.log(run('python3',['VERIFY_INPUT.py'],reconstructed).trim())
if(sha(fs.readFileSync(INPUT+'/MAIN_REVIEW/TRACE_ESCAPE_MAIN_LEAD_REVIEW_S2_RECEIPT_v1.0.0_2026-09-17.json'))!=='52f33a9437550be33169ce222e7f6529dd84b5cda3fefa9b53d778a137a68360')throw Error('S2R1_REVIEW_IDENTITY')
const contract=INPUT+'/CONTRACT/TRACE_ESCAPE_CODEX_G6P_NQ5_T1_S2_R1_ACCOUNT_EVIDENCE_SEMANTICS_REMEDIATION_PROMPT_v1.0.0_2026-09-17.txt'
if(sha(fs.readFileSync(contract))!=='d0ba8bd7401254858d8948bd226413d778f6dce6b5b7efeb5376df61e360d619')throw Error('S2R1_CONTRACT_IDENTITY')
const oldManifest=fs.readFileSync('docs/source/execution-s2/MANIFEST.sha256','utf8').trim().split('\n')
if(oldManifest.length!==40||sha(fs.readFileSync('docs/source/execution-s2/MANIFEST.sha256'))!=='042218fbf1f843960c7f08ce0098d0e3c94e8933d9378567706be5341da23556'||sha(fs.readFileSync('docs/source/v1.11.0/MANIFEST.sha256'))!=='2630a5423ea9d5d0d447ea37185ac128c802a72c7f853f9704ca1d9484c63f61')throw Error('S2R1_SEALED_S2_MANIFESTS_CHANGED')
for(const line of oldManifest){const[h,n]=line.split('  '),file=n.startsWith('PROJECT_SOURCE/')?'docs/source/v1.11.0/'+n.slice(15):'docs/source/execution-s2/'+n;if(sha(fs.readFileSync(file))!==h)throw Error('S2R1_SEALED_S2_SOURCE_CHANGED')}
const intact=['src/investigation/query.ts','src/investigation/state.ts','src/app/ExactIdentifier.tsx','src/app/CaseTerminalWorkbench.tsx','src/investigation/accounting.ts','scripts/nq5-s2/corpus.mjs','artifacts/g6p-s2/REPORTS/TE_IFACE_CORPUS_RC1.json','artifacts/g6p-s2/SCHEMAS/TE_IFACE_CORPUS_RC1.json.schema.json','docs/G6P_NQ5_T1_S2_CURATED_INPUT.json'],unchanged=[]
for(const n of intact){const b=fs.readFileSync(n),original=execFileSync('git',['show',START+':'+n],{cwd:root,env,maxBuffer:128000000});if(!b.equals(original))throw Error('S2R1_ACCEPTED_SUBSYSTEM_CHANGED_'+n);unchanged.push({file:n,sha256:sha(b),byteIdenticalToReviewedStart:true})}
const snapshot=JSON.parse(fs.readFileSync('docs/G6P_NQ5_T1_S1_PUBLIC_EVIDENCE_INPUT.json'))
for(const f of snapshot.truth.files){if(sha(fs.readFileSync(f.file))!==f.sha256)throw Error('S2R1_EULER_CHANGED');unchanged.push({...f,byteIdenticalToReviewedStart:true})}
const fresh=derive(),expected=[]
for(const[n,v]of Object.entries(fresh.reports)){expected.push([OUTPUT+'/REPORTS/'+n,v],[OUTPUT+'/SCHEMAS/'+n+'.schema.json',reportSchema(v)]);const{identity:h,...body}=v;if(identity(body)!==h)throw Error('S2R1_REPORT_SEAL')}
for(const[n,v]of Object.entries(fresh.inputs))expected.push([OUTPUT+'/INPUTS/'+n,v])
expected.push([OUTPUT+'/SCHEMAS/MERIDIAN_ACTIVITY_INPUT.schema.json',ACTIVITY_INPUT_SCHEMA])
for(const[n,v]of expected)if(fs.readFileSync(n,'utf8')!==JSON.stringify(v,null,2)+'\n')throw Error('S2R1_DETERMINISM_'+n)
const python=`import json,jsonschema\nfrom pathlib import Path\nr=Path('artifacts/g6p-s2-r1')\nfor p in (r/'REPORTS').glob('*.json'):\n s=json.loads((r/'SCHEMAS'/(p.name+'.schema.json')).read_text());jsonschema.Draft202012Validator.check_schema(s);jsonschema.validate(json.loads(p.read_text()),s)\ns=json.loads((r/'SCHEMAS/MERIDIAN_ACTIVITY_INPUT.schema.json').read_text());jsonschema.Draft202012Validator.check_schema(s)\nfor p in (r/'INPUTS').glob('*.json'): jsonschema.validate(json.loads(p.read_text()),s)\nprint('PASS: five schemas, four reports, two explicit transformed inputs')`
console.log(run('python3',['-c',python]).trim())
const changed=git('diff','--name-only',START,'--','.',':(exclude)AGENTS.md',':(exclude).cursor',':(exclude)ART_PRODUCTION').split('\n'),newPaths=run('git',['ls-files','--others','--exclude-standard','--','scripts/nq5-s2-r1','artifacts/g6p-s2-r1','docs/source/execution-s2-r1','docs/G6P_NQ5_T1_S2_R1_NOTES_FOR_LEAD.md','tests/unit/s2-r1-measurement.test.mjs']).trim().split('\n')
const names=[...new Set([...changed,...newPaths].filter(Boolean))]
for(const n of names){const st=fs.lstatSync(n);if(!st.isFile()||st.isSymbolicLink())throw Error('S2R1_CHANGED_NONREGULAR');const text=fs.readFileSync(n,'utf8');if(privatePathFindings(text).length||hasSecretLikeValue(text))throw Error('S2R1_TEXT_PRIVACY_'+n)}
for(const x of Object.values(fresh.reports))privacyBoundary(x)
const probe="const dns=require('node:dns'),net=require('node:net'),https=require('node:https');let n=0;for(const f of[()=>fetch('https://example.invalid'),()=>dns.lookup('example.invalid',()=>{}),()=>net.connect({host:'example.invalid',port:443}),()=>https.get('https://example.invalid')]){try{f()}catch{n++}}if(n!==4)process.exit(1);console.log('FOUR_EXTERNAL_APIS_BLOCKED_BEFORE_ISSUE')"
console.log(run('node',['-e',probe]).trim())
const a=fresh.reports['MERIDIAN_ACCOUNT_ACTIVITY_REPORT.json'],c=fresh.reports['CPP_LOGICAL_OPERATION_REPORT.json'],decision=fresh.reports['S2_R1_DECISION_RECEIPT.json']
if(a.observed.requests!==20||a.observed.credits!==32||a.removedRows.length!==1||c.observed.requests!==0||c.observed.credits!==null||c.logicalOperations.distinctLogicalOperationLowerBound!==3772||c.logicalOperations.pureLiveControlledSuccessOperations!==3758||c.logicalOperations.operationsContainingLiveControlledSuccess!==3760||c.providerRequestFloorEvidenced||c.finalQuotaClaimable||c.quotaMet||c.sameAccountSubmissionApplicability!=='UNRESOLVED'||Object.values(decision.authorities).some(x=>x!==false))throw Error('S2R1_FALSE_SUCCESS')
console.log(JSON.stringify({status:'PASS',gate:'G6P-NQ5-T1-S2-R1',inputManifestEntries:15,inputMembers:16,originalInputReconstructed:true,csvNormalization:'CRLF_TO_LF_REVERSIBLE',schemas:5,reports:4,inputs:2,byteIdenticalAcceptedSubsystems:unchanged,changedTextFilesScanned:names.length,networkRequests:0,externalApisBlocked:4,credentialAccess:false,privateStateAccess:false,corpusIdentity:fresh.corpus.identity,authoritiesOff:true}))
