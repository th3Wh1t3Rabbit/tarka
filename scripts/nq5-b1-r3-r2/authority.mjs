import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha } from '../nq5/schema.mjs'
import { gitEnv, instructions } from '../nq5-b1-r1/gates.mjs'
import { accepted as acceptedR1, cut } from '../nq5-b1-r3-r1/authority.mjs'
export { cut }
export const BASE='f2f248d97a263e2d16da8da9f0b0bcdc203a544d',TREE='1af9a61c712e28b32e349ce1ae61927585f0dda2'
export const CONTRACT='docs/source/execution-b1-r3-r2/48_G6P_NQ5_T1_B1_R3_R2_SIGNED_FLOW_CONTRACT.txt',CONTRACT_SHA='1580d5bf89559f8007ee3dc17d67a28a7f63073891056d6316c3fc90f782a2c7'
export const MANIFEST='docs/source/ACTIVE_B1_R3_R2_SOURCE_MANIFEST.sha256'
export const ARCHIVE='TRACE_ESCAPE_G6P_NQ5_T1_B1_R3_R1_SEMANTIC_COUNT_REVALIDATION_ACCOUNTING_FRONTIER_COMPLETENESS_AND_BATCH2_FREEZE_DELIVERY_v1.0.0.zip',ARCHIVE_SHA='69fce411e942d8bf71b99ac830cdaf6b70f7a2a7350ce5efd95eaad8c8e4d036'
export const OUTPUT='TRACE_ESCAPE_G6P_NQ5_T1_B1_R3_R2_SIGNED_FLOW_COMPATIBILITY_PER_CALL_ACCEPTANCE_AND_BATCH2_FREEZE_DELIVERY_v1.0.0.zip'
export const REVIEWS=['docs/G6P_NQ5_T1_B1_R3_R2_SIGNED_FLOW_REVIEW.json','docs/G6P_NQ5_T1_B1_R3_R2_FRONTIER_REVIEW.json']
export const seal=o=>({...o,hash:identity(o)})
const git=(root,...args)=>execFileSync('git',args,{cwd:root,env:gitEnv(),encoding:'utf8',maxBuffer:64000000}).trimEnd()
export function digest(root){const exclude=['.cursor','ART_PRODUCTION','artifacts','docs/G6P_NQ5_T1_B1_REVIEW.json','docs/G6P_NQ5_T1_B1_R1_REVIEW.json','docs/G6P_NQ5_T1_B1_R2_REVIEW.json','docs/G6P_NQ5_T1_B1_R3_PRELIVE_REVIEW.json','docs/G6P_NQ5_T1_B1_R3_POSTLIVE_REVIEW.json','docs/G6P_NQ5_T1_B1_R3_R1_SEMANTIC_REVIEW.json','docs/G6P_NQ5_T1_B1_R3_R1_FRONTIER_REVIEW.json',...REVIEWS].map(n=>':(exclude)'+n),names=git(root,'ls-files','--','.',...exclude).split('\n').filter(Boolean).sort();if(!names.includes(CONTRACT)||!names.includes('scripts/nq5-b1-r3-r2/run.mjs'))throw new Error('R32_UNTRACKED_IMPLEMENTATION');return identity(names.map(n=>[n,sha(n==='AGENTS.md'?instructions(root):fs.readFileSync(path.join(root,n)))]))}
export function accepted(root){
 if(git(root,'rev-parse',BASE+'^{tree}')!==TREE||git(root,'rev-parse',BASE+'^')!=='40facc9da72de8e5e2c23122ec85a5768a08f3b0')throw new Error('R32_GIT_LINEAGE');git(root,'merge-base','--is-ancestor',BASE,'HEAD')
 const manifest=fs.readFileSync(path.join(root,MANIFEST),'utf8');if(manifest!==fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R3_R1_SOURCE_MANIFEST.sha256'),'utf8')+CONTRACT_SHA+'  '+CONTRACT+'\n')throw new Error('R32_SOURCE_MANIFEST');for(const l of manifest.trimEnd().split('\n')){const[h,n]=l.split('  ');if(sha(fs.readFileSync(path.join(root,n)))!==h)throw new Error('R32_SOURCE_IDENTITY')}
 const archive=path.join(path.dirname(root),ARCHIVE);if(sha(fs.readFileSync(archive))!==ARCHIVE_SHA)throw new Error('R32_ARCHIVE_IDENTITY');const read=n=>execFileSync('unzip',['-p',archive,n],{env:gitEnv(),maxBuffer:16000000}),declared=new Map(read('MANIFEST.sha256').toString().trimEnd().split('\n').map(l=>l.split('  ').reverse())),priorFiles={}
 for(const n of ['DELIVERY_MANIFEST.json','SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256','CONTRACTS/ADDRESS_TRANSACTIONS_OBSERVED_COMPATIBILITY_PROFILE.json','SCHEMAS/NANSEN_API_REQUEST_AUDIT.schema.json','SCHEMAS/NQ5_PUBLIC_CALL_INDEX.schema.json','REPORTS/R3_QUALIFICATION_COUNT_ACCEPTANCE_REPORT.json','REPORTS/T1_CAMPAIGN_STATE_REDACTED.json','PUBLIC/NQ5_PUBLIC_CALL_INDEX.json','EVIDENCE/R3_PER_CALL_SEMANTIC_REVALIDATION.json','EVIDENCE/NANSEN_API_REQUEST_AUDIT.json','EVIDENCE/ACCOUNT_WIDE_BALANCE_RECONCILIATION.json','EVIDENCE/FRONTIER_CANDIDATE_REJECTION_MATRIX.json','EVIDENCE/BUGBOT_SEMANTIC_REVIEW.json','EVIDENCE/BUGBOT_FRONTIER_REVIEW.json']){const b=read(n);if(sha(b)!==declared.get(n))throw new Error('R32_PRIOR_MEMBER_IDENTITY');priorFiles[n]=b}
 const previous=JSON.parse(priorFiles['DELIVERY_MANIFEST.json']);if(identity(previous.candidate)!==identity({commit:BASE,tree:TREE})||previous.implementationSha256!=='abbc796d717e4508756dca704ca04bb09e3011d25196480bf4d9e03f2aa6ef17'||!priorFiles['SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256'].equals(fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R3_R1_SOURCE_MANIFEST.sha256'))))throw new Error('R32_PRIOR_CUT_IDENTITY')
 const a=acceptedR1(root);if(!priorFiles['CONTRACTS/ADDRESS_TRANSACTIONS_OBSERVED_COMPATIBILITY_PROFILE.json'].equals(a.bytes['CONTRACTS/ADDRESS_TRANSACTIONS_OBSERVED_COMPATIBILITY_PROFILE.json']))throw new Error('R32_PRIOR_PROFILE_IDENTITY')
 return {...a,r3ArchiveSha256:a.archiveSha256,archiveSha256:ARCHIVE_SHA,priorPrivateStateIdentity:previous.immutablePrivateStateIdentity,priorFiles,priorAudit:JSON.parse(priorFiles['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json']),priorPerCall:JSON.parse(priorFiles['EVIDENCE/R3_PER_CALL_SEMANTIC_REVALIDATION.json']),sourceManifestSha256:sha(Buffer.from(manifest)),docsRefreshed:false}
}
