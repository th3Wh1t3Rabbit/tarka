import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha } from '../nq5/schema.mjs'
import { gitEnv, instructions } from '../nq5-b1-r1/gates.mjs'
import { accepted as priorAccepted, cut } from '../nq5-b1-r3-r2/authority.mjs'
export { cut }
export const BASE='12597d157eb219de906553f277ce21fa0390dea5',TREE='b5fc8de903ae1eea77040fcb1dc3f99155a858cf'
export const CONTRACT='docs/source/execution-b2/49_G6P_NQ5_T1_B2_EXECUTION_CONTRACT.txt',CONTRACT_SHA='0f4ae129ce922d4325bffd01a1347f42ca54338257f38cac2030314e5c3f8443',MANIFEST='docs/source/ACTIVE_B2_SOURCE_MANIFEST.sha256'
export const ARCHIVE='TRACE_ESCAPE_G6P_NQ5_T1_B1_R3_R2_SIGNED_FLOW_COMPATIBILITY_PER_CALL_ACCEPTANCE_AND_BATCH2_FREEZE_DELIVERY_v1.0.0.zip',ARCHIVE_SHA='1ce0d5b052e329118f3c7bcecde8db69fb8dc3b658afb4c63ef64931930dc2a7'
export const OUTPUT='TRACE_ESCAPE_G6P_NQ5_T1_B2_TWO_REQUEST_FRONTIER_CANARY_AND_BATCH3_FREEZE_DELIVERY_v1.0.0.zip',AUTH='LEAD-NQ5-T1-B2-TWO-REQUEST-CANARY-001'
export const REVIEWS=['docs/G6P_NQ5_T1_B2_PRELIVE_REVIEW.json','docs/G6P_NQ5_T1_B2_POSTLIVE_REVIEW.json']
export const ACCEPTED_ID='2ba8e2f1d9c841b8781a736dbceb61ebd52eb78edbb5d6e8f04e5e39b1fad4e6',HELD=['30df8a668aad9c266f82f973997fbbddf42208d5e4aed18ae84e8887347d5a36','9ad4a32b3bb9a6f705a714fafc6db9036d7011dc9897d95622b4f65c5dc55f40','bf9270f622d3a29ce651c48060d8931512f34f8ef7c4e32bc07484234774dff6']
export const IDS=['20282d4d836dc8d746ac00ff1bcd408c4898259670f24d6e8e64e3f7d5206ea2','a78811744179ce394287f1c934469632446dec6521bd0bc636ac372d6acb539b']
export const seal=o=>({...o,hash:identity(o)})
const git=(root,...a)=>execFileSync('git',a,{cwd:root,env:gitEnv(),encoding:'utf8',maxBuffer:64000000}).trimEnd()
export function digest(root){const excluded=['.cursor','ART_PRODUCTION','artifacts',...REVIEWS,...['G6P_NQ5_T1_B1_REVIEW','G6P_NQ5_T1_B1_R1_REVIEW','G6P_NQ5_T1_B1_R2_REVIEW','G6P_NQ5_T1_B1_R3_PRELIVE_REVIEW','G6P_NQ5_T1_B1_R3_POSTLIVE_REVIEW','G6P_NQ5_T1_B1_R3_R1_SEMANTIC_REVIEW','G6P_NQ5_T1_B1_R3_R1_FRONTIER_REVIEW','G6P_NQ5_T1_B1_R3_R2_SIGNED_FLOW_REVIEW','G6P_NQ5_T1_B1_R3_R2_FRONTIER_REVIEW'].map(n=>'docs/'+n+'.json')];return identity(git(root,'ls-files','--','.',...excluded.map(n=>':(exclude)'+n)).split('\n').filter(Boolean).sort().map(n=>[n,sha(n==='AGENTS.md'?instructions(root):fs.readFileSync(path.join(root,n)))]))}
export function accepted(root){
 if(git(root,'rev-parse',BASE+'^{tree}')!==TREE||git(root,'rev-parse',BASE+'^')!=='9e3663f779299056a55cb177831bccacf48ac610')throw new Error('B2_GIT_LINEAGE');git(root,'merge-base','--is-ancestor',BASE,'HEAD')
 const manifest=fs.readFileSync(path.join(root,MANIFEST),'utf8');if(manifest!==fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R3_R2_SOURCE_MANIFEST.sha256'),'utf8')+CONTRACT_SHA+'  '+CONTRACT+'\n')throw new Error('B2_SOURCE_MANIFEST');for(const l of manifest.trimEnd().split('\n')){const[h,n]=l.split('  ');if(sha(fs.readFileSync(path.join(root,n)))!==h)throw new Error('B2_SOURCE_IDENTITY')}
 const archive=path.join(path.dirname(root),ARCHIVE);if(sha(fs.readFileSync(archive))!==ARCHIVE_SHA)throw new Error('B2_ARCHIVE_IDENTITY');const read=n=>execFileSync('unzip',['-p',archive,n],{env:gitEnv(),maxBuffer:64000000}),declared=new Map(read('MANIFEST.sha256').toString().trimEnd().split('\n').map(l=>l.split('  ').reverse())),bytes={};for(const[n,h]of declared){const b=read(n);if(sha(b)!==h)throw new Error('B2_PRIOR_MEMBER_IDENTITY');if(n!=='GIT/trace-escape-complete.bundle'&&n!=='SOURCE_DIFF.patch')bytes[n]=b}
 const objects=Object.fromEntries(Object.entries(bytes).filter(([n])=>n.endsWith('.json')).map(([n,b])=>[n,JSON.parse(b)])),m=objects['DELIVERY_MANIFEST.json'];if(identity(m.candidate)!==identity({commit:BASE,tree:TREE})||m.implementationSha256!=='4016f3358092f1f193281bceae959786d779f3182c23f41f46efe974dcdee6c9')throw new Error('B2_PRIOR_IMPLEMENTATION');const a=priorAccepted(root)
 return {...a,b2PriorBytes:bytes,b2PriorObjects:objects,sourceManifestSha256:sha(Buffer.from(manifest))}
}
