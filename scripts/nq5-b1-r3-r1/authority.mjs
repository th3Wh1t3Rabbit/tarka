import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha } from '../nq5/schema.mjs'
import { gitEnv, instructions } from '../nq5-b1-r1/gates.mjs'
import { publicContext } from '../nq5-b1-r3/context.mjs'
import { cut } from '../nq5-b1-r3/authority.mjs'
export { cut }
export const BASE='14a9cd2ab494ac6b1345977dc1a025a2b70715da',TREE='236aa5e8aab2dc7d3dcdb2bc03844997bbf3d7e5'
export const CONTRACT='docs/source/execution-b1-r3-r1/47_G6P_NQ5_T1_B1_R3_R1_SEMANTIC_REVALIDATION_CONTRACT.txt',CONTRACT_SHA='10350257a952f2bc761f1db7c8d9d2738bd48e9c7eca50794b7cd18fce6100ec'
export const MANIFEST='docs/source/ACTIVE_B1_R3_R1_SOURCE_MANIFEST.sha256'
export const ARCHIVE='TRACE_ESCAPE_G6P_NQ5_T1_B1_R3_TRANSACTION_COMPATIBILITY_FOUR_REQUEST_RESUME_AND_NEXT_FRONTIER_DELIVERY_v1.0.0.zip',ARCHIVE_SHA='7bdc477181b3f065a4f53cad6caf9a34380a403a72c39910515cc2ca36145a13'
export const OUTPUT='TRACE_ESCAPE_G6P_NQ5_T1_B1_R3_R1_SEMANTIC_COUNT_REVALIDATION_ACCOUNTING_FRONTIER_COMPLETENESS_AND_BATCH2_FREEZE_DELIVERY_v1.0.0.zip'
export const REVIEWS=['docs/G6P_NQ5_T1_B1_R3_R1_SEMANTIC_REVIEW.json','docs/G6P_NQ5_T1_B1_R3_R1_FRONTIER_REVIEW.json']
export const LEDGER_SHA='99ac010b27f3b98bcbc1eb82b053b9c190ad0cf40ac0c393a8d604d02d436374'
export const PINS={
 'CONTRACTS/ADDRESS_TRANSACTIONS_OBSERVED_COMPATIBILITY_PROFILE.json':['797b8a25f60d3d35dd7035fd6f88eb4eea493f70f37a9d0d74e2c911bd88a364','6d6dd78a41a92027a02643ed2b1233dd0711e3f25c6644c93c577bd2aefd19fd'],
 'EXECUTION/T1_B1_R3_RESUME_ENVELOPE.json':['024798dfc749d8c539c3aa9eaf96e6d445965e85cff1d29b65535d8446c3f797','10fa25e453a61a71aa2f0c1bdfb075e012fdc39a2afcb0c9a1d91ddc607e4ae0'],
 'PLANS/T1_B1_R3_TRANSACTION_ONLY_PLAN.json':['054b450f8f413c8339058d96111ce3e4b2d88e7c702ebac907aae13db42cbea5','a76855ac29c42b2872ab6178afc5aadd3b48c4ffc0273f885d12c1df8f41ff73'],
 'PLANS/T1_B1_R3_RESERVE_PLAN.json':['d9343f0386cc52e6b8e7b7316db67c43e4cf624bb5d38b0a5f714f93d5cce8e3','7027ae3b45436b8cb466123ac876b9a18f210f11db1c215583e29e43b2b6f519'],
 'EVIDENCE/NANSEN_API_REQUEST_AUDIT.json':['6df0b636b9e468d441f85121e9b3c3d8b5210cc131827355455a54ba2344522f',null],
 'REPORTS/T1_B1_R3_RECONCILIATION_REPORT.json':['ca34b695624c4d7a576ff391011598a5971b7183fbaab109f6f0602a6bf06ddf',null],
 'OFFICIAL_DOCS/INDEX.json':['d34ceea003e4bb45a54b0e9474dcbe72cef7074a56ac980f5a06cdcfdaf93ca5',null]}
export const seal=o=>({...o,hash:identity(o)})
const git=(root,...args)=>execFileSync('git',args,{cwd:root,env:gitEnv(),encoding:'utf8',maxBuffer:64000000}).trimEnd()
export function digest(root){const excluded=['.cursor','ART_PRODUCTION','artifacts','docs/G6P_NQ5_T1_B1_REVIEW.json','docs/G6P_NQ5_T1_B1_R1_REVIEW.json','docs/G6P_NQ5_T1_B1_R2_REVIEW.json','docs/G6P_NQ5_T1_B1_R3_PRELIVE_REVIEW.json','docs/G6P_NQ5_T1_B1_R3_POSTLIVE_REVIEW.json',...REVIEWS].map(n=>':(exclude)'+n),names=git(root,'ls-files','--','.',...excluded).split('\n').filter(Boolean).sort();if(!names.includes(CONTRACT)||!names.includes('scripts/nq5-b1-r3-r1/run.mjs'))throw new Error('R31_UNTRACKED_IMPLEMENTATION');return identity(names.map(n=>[n,sha(n==='AGENTS.md'?instructions(root):fs.readFileSync(path.join(root,n)))]))}
export function accepted(root){
 if(git(root,'rev-parse',BASE+'^{tree}')!==TREE||git(root,'rev-parse',BASE+'^')!=='4bee28be0d7aeec6b29ad0595d0c7cb48517a2b4')throw new Error('R31_GIT_LINEAGE');git(root,'merge-base','--is-ancestor',BASE,'HEAD')
 const manifest=fs.readFileSync(path.join(root,MANIFEST),'utf8');if(manifest!==fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R3_SOURCE_MANIFEST.sha256'),'utf8')+CONTRACT_SHA+'  '+CONTRACT+'\n')throw new Error('R31_SOURCE_MANIFEST')
 for(const l of manifest.trimEnd().split('\n')){const [h,n]=l.split('  ');if(sha(fs.readFileSync(path.join(root,n)))!==h)throw new Error('R31_SOURCE_IDENTITY')}
 const archive=path.join(path.dirname(root),ARCHIVE);if(sha(fs.readFileSync(archive))!==ARCHIVE_SHA)throw new Error('R31_ARCHIVE_IDENTITY')
 const read=n=>execFileSync('unzip',['-p',archive,n],{env:gitEnv(),maxBuffer:16000000}),bytes={},objects={}
 for(const[n,[h,canonical]]of Object.entries(PINS)){const b=read(n);if(sha(b)!==h)throw new Error('R31_MEMBER_IDENTITY');const o=JSON.parse(b);if(canonical){const{hash,...payload}=o;if(hash!==canonical||identity(payload)!==canonical)throw new Error('R31_CANONICAL_IDENTITY')}bytes[n]=b;objects[n]=o}
 const docs=objects['OFFICIAL_DOCS/INDEX.json'];if(docs.snapshots.length!==5||docs.unauthenticatedDocumentationGets!==5)throw new Error('R31_ACCEPTED_DOCUMENT_INDEX');for(const r of docs.snapshots){if(!['transactions','pricing','rates','coverage','redistribution'].includes(r.name)||r.filename!==r.name+'.md')throw new Error('R31_DOC_INVENTORY');const b=read('OFFICIAL_DOCS/'+r.filename);if(b.length!==r.bytes||sha(b)!==r.sha256||r.sha256!==r.r2Sha256||r.httpStatus!==200)throw new Error('R31_DOC_IDENTITY')}
 const c=publicContext(root);if(identity(c.profile)!==identity(objects['CONTRACTS/ADDRESS_TRANSACTIONS_OBSERVED_COMPATIBILITY_PROFILE.json'])||identity(c.plans.plan)!==identity(objects['PLANS/T1_B1_R3_TRANSACTION_ONLY_PLAN.json']))throw new Error('R31_ACCEPTED_PROFILE_PLAN')
 return {context:c,bytes,objects,archiveSha256:ARCHIVE_SHA,sourceManifestSha256:sha(Buffer.from(manifest)),docsRefreshed:false}
}
