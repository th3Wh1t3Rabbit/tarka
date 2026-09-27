import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha } from '../nq5/schema.mjs'
import { sourceBinding as r2Binding, git, corpusAt } from '../nq5-b1-r2/gates.mjs'
import { instructions, gitEnv } from '../nq5-b1-r1/gates.mjs'

export const BASE='d98cbf05d1f2d282c0411c3f5c841b2238255029',TREE='b4ef04523454be2fba4aff45c6e5e481e99cc7c3'
export const CONTRACT='docs/source/execution-b1-r3/46_G6P_NQ5_T1_B1_R3_EXECUTION_CONTRACT.txt',CONTRACT_SHA='dc2ad03e235609a19e358ce7526a8be909fa2f7c47ce465d02fee10d637cd472'
export const AUTH='LEAD-G6P-NQ5-T1-B1-R3-OBSERVED-TRANSACTION-COMPATIBILITY'
export const ARCHIVE='TRACE_ESCAPE_G6P_NQ5_T1_B1_R2_OFFICIAL_CONTRACT_CLARIFICATION_COMPATIBILITY_AND_CORRECTED_PLAN_FREEZE_DELIVERY_v1.0.0.zip',ARCHIVE_SHA='fbe25f3f7b268dab96f1836c718928eadb886b19371843e9f1c4909235bba8b6'
export const OUTPUT='TRACE_ESCAPE_G6P_NQ5_T1_B1_R3_TRANSACTION_COMPATIBILITY_FOUR_REQUEST_RESUME_AND_NEXT_FRONTIER_DELIVERY_v1.0.0.zip'
export const IDS=Object.freeze(['2ba8e2f1d9c841b8781a736dbceb61ebd52eb78edbb5d6e8f04e5e39b1fad4e6','30df8a668aad9c266f82f973997fbbddf42208d5e4aed18ae84e8887347d5a36','9ad4a32b3bb9a6f705a714fafc6db9036d7011dc9897d95622b4f65c5dc55f40','bf9270f622d3a29ce651c48060d8931512f34f8ef7c4e32bc07484234774dff6'])
export const PINS={
 'PLANS/T1_B1_CORRECTED_CANDIDATE_PLAN.json':['d5cb7bf2525026d572004d539110d7d9fb9d937b5e699de2ab1131b033b26045','cab401004ed1c49dfa10aca8a2956aee22d86ca81d433d96a68f910701c720bc'],
 'PLANS/T1_B1_PLAN_SUPERSESSION_MAP.json':['2f7de16b023a08ac06a09950d8f935d59f81f8c0c076f191c61f2f19e948ada0','2a3c0e17935671f3c50ca01ce73f1a746d826468de122aeee94ec9b426e76cc9'],
 'PLANS/T1_B1_CORRECTED_RESERVE_PLAN.json':['2ef936b69048cf4cde652ae57b6397f239189a5b64acf65d0283b8c7c3031c03','4663b6a2f8e5b4c60c0769e630bd485b927f776c062676607cb4b06919d68844'],
 'CONTRACTS/ADDRESS_TRANSACTIONS_NULL_COMPATIBILITY_PROFILE.json':['61318880a958feb640814c85e9c7a58c2c472178380301c95e39031713228ca7','b9ef3c2c6cc7824dcb9515892b9a64ea94a07ed99d9cea71f585dde587b2afd3'],
 'CONTRACTS/HISTORICAL_BALANCE_TEMPORAL_PROFILE.json':['9c1a853d98c684bc3e677a2f16bbe5f5d138b6df4078bd696da2229bc8221aba','a593479dbabcce331d7852c805c38b62ca0b9a95278ff966fe3e80066fb60eb7'],
 'OFFICIAL_DOCS/INDEX.json':['585ecdbcd44216a7fd29a78791f94aa331006ec3e9f76a2760cf6d98391a1cec',null],
 'EVIDENCE/NANSEN_API_REQUEST_AUDIT.json':['e4b40aa2e9611f4f8af470eaf4ca2bff9201715b6c6b838ec218dfbd89136c03',null],
 'SCHEMAS/NANSEN_API_REQUEST_AUDIT.schema.json':['fece0ddb4c2c77ed4362ba3141bcc564fb8f23618ee8e8168cd6aac464a5877c',null],
 'EVIDENCE/PRESERVED_RAW_COMPATIBILITY_REPLAY.json':['55f6973f26076278d0172df0827853a2c688d1ed8662d2d6de2fe960254d5c55',null]}
export const seal=o=>({...o,hash:identity(o)})
export function priorEvidence(root){
 const archive=path.join(path.dirname(root),ARCHIVE);if(sha(fs.readFileSync(archive))!==ARCHIVE_SHA)throw new Error('R3_R2_ARCHIVE_IDENTITY')
 const bytes=Object.fromEntries(Object.entries(PINS).map(([n,[pin,canonical]])=>{const b=execFileSync('unzip',['-p',archive,n],{env:gitEnv(),maxBuffer:16000000});if(sha(b)!==pin)throw new Error('R3_R2_MEMBER_IDENTITY');if(canonical){const {hash,...p}=JSON.parse(b);if(hash!==canonical||identity(p)!==canonical)throw new Error('R3_R2_CANONICAL_IDENTITY')}return[n,b]}))
 const index=JSON.parse(bytes['OFFICIAL_DOCS/INDEX.json']),audit=JSON.parse(bytes['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json']);if(identity(corpusAt(root).index)!=='9dcd93f996b92d4c8afd44815a5786ace16ca8c667700ea342eeae3a8a3ffbcf'||index.capturedIndexSha256!=='9e18ad8d7cd5d585ce0091ea0cc1dca28f7b98dc34c4ea915bc3020e6b5950d4'||identity(audit)!=='39068d3a124d28da48dd487b88263fba47a07bb0692ff828a22da704ddb74fa3')throw new Error('R3_R2_SOURCE_AUDIT_IDENTITY');return {bytes,index,audit}
}
export function sourceBinding(root){const bound=r2Binding(root);git(root,'merge-base','--is-ancestor',BASE,'HEAD');if(git(root,'rev-parse',BASE+'^{tree}')!==TREE||git(root,'rev-parse',BASE+'^')!=='d9d03ee085da3dca6605326456f0aa208f59fa73'||sha(fs.readFileSync(path.join(root,CONTRACT)))!==CONTRACT_SHA||fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R3_SOURCE_MANIFEST.sha256'),'utf8')!==fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R2_SOURCE_MANIFEST.sha256'),'utf8')+CONTRACT_SHA+'  '+CONTRACT+'\n')throw new Error('R3_SOURCE_LINEAGE');priorEvidence(root);corpusAt(root);return bound}
export function digest(root){const names=git(root,'ls-files','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION',':(exclude)artifacts',':(exclude)docs/G6P_NQ5_T1_B1_REVIEW.json',':(exclude)docs/G6P_NQ5_T1_B1_R1_REVIEW.json',':(exclude)docs/G6P_NQ5_T1_B1_R2_REVIEW.json',':(exclude)docs/G6P_NQ5_T1_B1_R3_PRELIVE_REVIEW.json',':(exclude)docs/G6P_NQ5_T1_B1_R3_POSTLIVE_REVIEW.json').split('\n').filter(Boolean).sort();if(!names.includes(CONTRACT)||!names.includes('scripts/nq5-b1-r3/run.mjs'))throw new Error('R3_NOT_TRACKED');return identity(names.map(n=>[n,sha(n==='AGENTS.md'?instructions(root):fs.readFileSync(path.join(root,n)))]))}
export function cut(root){const excluded=['AGENTS.md','.cursor','ART_PRODUCTION','artifacts'].map(n=>':(exclude)'+n);if(git(root,'status','--porcelain=v1','--untracked-files=all','--','.',...excluded)||!instructions(root).equals(execFileSync('git',['show','HEAD:AGENTS.md'],{cwd:root,env:gitEnv()})))throw new Error('R3_DIRTY_SOURCE');return{commit:git(root,'rev-parse','HEAD'),tree:git(root,'rev-parse','HEAD^{tree}')}}
