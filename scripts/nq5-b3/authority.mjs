import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha } from '../nq5/schema.mjs'
import { gitEnv, instructions } from '../nq5-b1-r1/gates.mjs'
import { accepted as foundation, cut, HELD, ACCEPTED_ID, IDS as B2_IDS } from '../nq5-b2/authority.mjs'
export { cut, HELD, ACCEPTED_ID, B2_IDS }
export const BASE='a1098fb5adb07fc2c77ddbf09aa919c4784c11b4',TREE='6aee3eb30f0d35e94c3ce2b31a7e116ac712c99a'
export const CONTRACT='docs/source/execution-b3/50_G6P_NQ5_T1_B3_EXECUTION_CONTRACT.txt',CONTRACT_SHA='cb9d15464a2542339b7848fde7377ead0be11537a0b6f7d3b166e4e623a61378',MANIFEST='docs/source/ACTIVE_B3_SOURCE_MANIFEST.sha256'
export const ARCHIVE='TRACE_ESCAPE_G6P_NQ5_T1_B2_TWO_REQUEST_FRONTIER_CANARY_AND_BATCH3_FREEZE_DELIVERY_v1.0.0.zip',ARCHIVE_SHA='00807ce7e3554cbeb71bb0361bcd6a14ab4331377ee7905825df753e26e0edbf'
export const OUTPUT='TRACE_ESCAPE_G6P_NQ5_T1_B3_FIVE_REQUEST_REPRESENTATIVE_FRONTIER_AND_BATCH4_SCALE_FREEZE_DELIVERY_v1.0.0.zip',AUTH='LEAD-NQ5-T1-B3-FIVE-REQUEST-REPRESENTATIVE-FRONTIER-001'
export const REVIEWS=['docs/G6P_NQ5_T1_B3_PRELIVE_REVIEW.json','docs/G6P_NQ5_T1_B3_POSTLIVE_REVIEW.json']
export const IDS=['7c812749f9e8351f18621782214a2bbb36edd26675f41247f98a7d35fc17cae9','3ce23250b09f423c615ddf1865131476066c14cbdd3549efe6c3005fa35b8820','e677fcc895ee443cbfd3d72c6d68463ed15cc9820d14ac9bd8bf9eeb0c66f4c3','fd844b4bdc5999147d8327b8ba95a47c9feee61862411c09f80b5aedb119d6f7','2fa5ca459facb8746725cc6d753cc5b72712137ed0e68fbaab1d47ecf50f1db9']
export const ISSUE_ORDER=[IDS[0],IDS[3],IDS[1],IDS[2],IDS[4]],LEDGER_SHA='5b43af468e90b114e58aa62958181aa0bb737417211a5e01edfbd475b13c998b'
export const seal=o=>({...o,hash:identity(o)})
const git=(root,...args)=>execFileSync('git',args,{cwd:root,env:gitEnv(),encoding:'utf8',maxBuffer:64000000}).trimEnd()
const exclusions=['.cursor','ART_PRODUCTION','artifacts',...REVIEWS,...['G6P_NQ5_T1_B1_REVIEW','G6P_NQ5_T1_B1_R1_REVIEW','G6P_NQ5_T1_B1_R2_REVIEW','G6P_NQ5_T1_B1_R3_PRELIVE_REVIEW','G6P_NQ5_T1_B1_R3_POSTLIVE_REVIEW','G6P_NQ5_T1_B1_R3_R1_SEMANTIC_REVIEW','G6P_NQ5_T1_B1_R3_R1_FRONTIER_REVIEW','G6P_NQ5_T1_B1_R3_R2_SIGNED_FLOW_REVIEW','G6P_NQ5_T1_B1_R3_R2_FRONTIER_REVIEW','G6P_NQ5_T1_B2_PRELIVE_REVIEW','G6P_NQ5_T1_B2_POSTLIVE_REVIEW'].map(n=>'docs/'+n+'.json')]
const names=root=>git(root,'ls-files','--','.',...exclusions.map(n=>':(exclude)'+n)).split('\n').filter(Boolean).sort()
export function digest(root){return identity(names(root).map(n=>[n,sha(n==='AGENTS.md'?instructions(root):fs.readFileSync(path.join(root,n)))]))}
export function historicalDigest(root,commit){if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('B3_HISTORICAL_COMMIT');return identity(names(root).flatMap(n=>{try{const b=execFileSync('git',['show',commit+':'+n],{cwd:root,env:gitEnv(),stdio:['ignore','pipe','ignore'],maxBuffer:64000000});return [[n,sha(b)]]}catch{return []}}))}
export function accepted(root){
 if(git(root,'rev-parse',BASE+'^{tree}')!==TREE||git(root,'rev-parse',BASE+'^')!=='8194f9344fbba57ade5ec368cf3e0e88e72a6374'||historicalDigest(root,BASE)!=='98bfc0215fcc263659838f847d69603d9b593a5cb13f256dbd37409ca4a57186')throw new Error('B3_ACCEPTED_GIT_IMPLEMENTATION');git(root,'merge-base','--is-ancestor',BASE,'HEAD')
 const manifest=fs.readFileSync(path.join(root,MANIFEST),'utf8');if(manifest!==fs.readFileSync(path.join(root,'docs/source/ACTIVE_B2_SOURCE_MANIFEST.sha256'),'utf8')+CONTRACT_SHA+'  '+CONTRACT+'\n')throw new Error('B3_ADDITIVE_MANIFEST');for(const l of manifest.trimEnd().split('\n')){const[h,n]=l.split('  ');if(sha(fs.readFileSync(path.join(root,n)))!==h)throw new Error('B3_SOURCE_IDENTITY')}
 const archive=path.join(path.dirname(root),ARCHIVE);if(sha(fs.readFileSync(archive))!==ARCHIVE_SHA)throw new Error('B3_ACCEPTED_ARCHIVE');const read=n=>execFileSync('unzip',['-p',archive,n],{env:gitEnv(),maxBuffer:64000000}),declared=new Map(read('MANIFEST.sha256').toString().trimEnd().split('\n').map(l=>l.split('  ').reverse())),bytes={};for(const[n,h]of declared){const b=read(n);if(sha(b)!==h)throw new Error('B3_ACCEPTED_MEMBER');if(n!=='GIT/trace-escape-complete.bundle'&&n!=='SOURCE_DIFF.patch')bytes[n]=b}
 const objects=Object.fromEntries(Object.entries(bytes).filter(([n])=>n.endsWith('.json')).map(([n,b])=>[n,JSON.parse(b)])),m=objects['DELIVERY_MANIFEST.json'];if(identity(m.candidate)!==identity({commit:BASE,tree:TREE})||m.implementationSha256!==historicalDigest(root,BASE)||identity(objects['PUBLIC/NQ5_PUBLIC_CALL_INDEX.json'])!=='049511a4a3c2befed3b66e257274e092160a7e3b5ecf9de3490e6dc2b2c77b75'||identity(objects['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json'])!=='401d8e3c8625dada1c687c3a62d9110d988bca7d5449bc1d76f03888fc268d92'||identity(objects['EVIDENCE/BATCH3_FRONTIER_CANDIDATE_REJECTION_MATRIX.json'])!=='b4aa2102d42ee3286e0da7f9965618e0a73ef78d66f499c06ff53b41549d8759'||objects['EXECUTION/T1_B2_EXECUTION_ENVELOPE.json'].hash!=='2a809fd0f1ef821d5608dea901931a738f93a0ed5219720778bbd437d6b31254'||objects['PLANS/T1_BATCH2_EXECUTION_PLAN.json'].hash!=='e9de60420d26d7a12ce4806f5708af49fb59e99a393f23a58352923803c386fc')throw new Error('B3_ACCEPTED_DERIVED_IDENTITIES')
 return {...foundation(root),b3PriorBytes:bytes,b3PriorObjects:objects,sourceManifestSha256:sha(Buffer.from(manifest))}
}
