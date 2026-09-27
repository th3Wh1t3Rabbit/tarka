import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha } from '../nq5/schema.mjs'
import { gitEnv, instructions } from '../nq5-b1-r1/gates.mjs'
import { accepted as foundation, historicalDigest, cut, seal, HELD, ACCEPTED_ID, B2_IDS, ISSUE_ORDER } from '../nq5-b3/authority.mjs'
export { cut, seal, HELD, ACCEPTED_ID, B2_IDS, ISSUE_ORDER }
export const BASE='05af09e9c346a34a27b8c79b5c59eff405d1164f',TREE='9d5e050814f0f203e68ea200f8f480368bb3fcf9'
export const CONTRACT='docs/source/execution-b4-filtered/51_G6P_NQ5_T1_B3_R1_FILTERED_BATCH4_EXECUTION_CONTRACT.txt',CONTRACT_SHA='6ca77ead85b05fd8f5642d7e3c137043ebff0bd5387eb52027a8bc4f04dfacff',MANIFEST='docs/source/ACTIVE_B4_FILTERED_SOURCE_MANIFEST.sha256'
export const ARCHIVE='TRACE_ESCAPE_G6P_NQ5_T1_B3_FIVE_REQUEST_REPRESENTATIVE_FRONTIER_AND_BATCH4_SCALE_FREEZE_DELIVERY_v1.0.0.zip',ARCHIVE_SHA='47062dfe0029783a7cde58066688783d9d9dcdc8ba0b0a07f0710634ec90fca7'
export const OUTPUT='TRACE_ESCAPE_G6P_NQ5_T1_B3_R1_LEAD_ACCEPTANCE_FRONTIER_QUALITY_AND_FILTERED_BATCH4_EXECUTION_DELIVERY_v1.0.0.zip'
export const LEDGER_SHA='3b4261db069e68ab6a257ac23857cd9011ec72bab5ec14834cdabc70e9a222f2'
export const REVIEWS=['docs/G6P_NQ5_T1_B4_FILTERED_PRELIVE_REVIEW.json','docs/G6P_NQ5_T1_B4_FILTERED_POSTLIVE_REVIEW.json']
const git=(root,...args)=>execFileSync('git',args,{cwd:root,env:gitEnv(),encoding:'utf8',maxBuffer:256000000}).trimEnd()
export function digest(root){const names=git(root,'ls-files','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION',':(exclude)artifacts').split('\n').filter(n=>n&&!/^docs\/G6P.*_REVIEW\.json$/.test(n)).sort();return identity(names.map(n=>[n,sha(n==='AGENTS.md'?instructions(root):fs.readFileSync(path.join(root,n)))]))}
export function accepted(root){
 if(git(root,'rev-parse',BASE+'^{tree}')!==TREE||git(root,'rev-parse',BASE+'^')!=='4d4772d619f7659904110b48fbc41251708f643c'||historicalDigest(root,BASE)!=='912e0f87a7650916b4b62ead0b5ae91fcae53f9b616aaae7553b9204f845f2ad')throw new Error('B4_ACCEPTED_GIT_CUT')
 git(root,'merge-base','--is-ancestor',BASE,'HEAD')
 const text=fs.readFileSync(path.join(root,MANIFEST),'utf8');if(text!==fs.readFileSync(path.join(root,'docs/source/ACTIVE_B3_SOURCE_MANIFEST.sha256'),'utf8')+CONTRACT_SHA+'  '+CONTRACT+'\n')throw new Error('B4_ADDITIVE_MANIFEST')
 for(const l of text.trimEnd().split('\n')){const[h,n]=l.split('  ');if(sha(fs.readFileSync(path.join(root,n)))!==h)throw new Error('B4_SOURCE_HASH')}
 const archive=path.join(path.dirname(root),ARCHIVE);if(sha(fs.readFileSync(archive))!==ARCHIVE_SHA)throw new Error('B4_ACCEPTED_ARCHIVE')
 const read=n=>execFileSync('unzip',['-p',archive,n],{env:gitEnv(),maxBuffer:256000000}),manifest=read('MANIFEST.sha256').toString().trimEnd().split('\n'),members=gitMembers(archive),bytes={}
 if(members.length!==57||new Set(members).size!==57||manifest.length!==56)throw new Error('B4_ARCHIVE_MEMBER_SET')
 for(const l of manifest){const h=l.slice(0,64),n=l.slice(66),b=read(n);if(!members.includes(n)||sha(b)!==h)throw new Error('B4_ARCHIVE_MEMBER_HASH');if(n!=='GIT/trace-escape-complete.bundle'&&n!=='SOURCE_DIFF.patch')bytes[n]=b}
 const o=Object.fromEntries(Object.entries(bytes).filter(([n])=>n.endsWith('.json')).map(([n,b])=>[n,JSON.parse(b)])),m=o['DELIVERY_MANIFEST.json']
 const pins={'PUBLIC/NQ5_PUBLIC_CALL_INDEX.json':'2c3b1ed0d41245226ee1557d59106ae66d4a2de47ba5b1f833947e1426b65fb2','EVIDENCE/NANSEN_API_REQUEST_AUDIT.json':'79567d51ec7933ec212599f51d10c8c02431355304a3f01af3b2ed25ec9340ba','EVIDENCE/BATCH4_FRONTIER_CANDIDATE_REJECTION_MATRIX.json':'2a2f026510d458f1a975a552d40a25023461fc0be5562436cefd135ec6959e19'}
 if(m.status!=='DELIVERED_PENDING_LEAD_REVIEW'||identity(m.candidate)!==identity({commit:BASE,tree:TREE})||m.implementationSha256!==historicalDigest(root,BASE))throw new Error('B4_ARCHIVE_CANDIDATE')
 for(const[n,h]of Object.entries(pins))if(identity(o[n])!==h)throw new Error('B4_PINNED_SAFE_IDENTITY')
 for(const[n,h]of [['EXECUTION/T1_B3_EXECUTION_ENVELOPE.json','0116270ee7b8130423793863389f532f54704d884cab4378cbfafebd5f184b5e'],['PLANS/T1_BATCH3_EXECUTION_PLAN.json','c75ffd6f7e9a043ffce15b59c48b080eb3ebf8aadeb83624f43314bb34a11bf3'],['PLANS/T1_BATCH4_CANDIDATE_PLAN.json','668922b6ddc07e4260588fbdb73465921aefecabdbcb7801a0fff1121aca628e'],['PLANS/T1_BATCH4_FRONTIER_POLICY.json','ad50822de585e269a3555590871e13b481a1d587498aef58ae2217aecbb27f2a'],['PLANS/T1_BATCH4_RESERVE_PLAN.json','1c3f1528a2e24c915dfd3cc3cf267a098996cf76bbedbdec0b87619311915f1d']])if(o[n].hash!==h)throw new Error('B4_ACCEPTED_PLAN_ENVELOPE')
 return {foundation:foundation(root),objects:o,bytes,sourceManifestSha256:sha(Buffer.from(text)),archiveSourceDiffSha256:sha(read('SOURCE_DIFF.patch'))}
}
function gitMembers(archive){return execFileSync('unzip',['-Z1',archive],{env:gitEnv(),encoding:'utf8'}).trimEnd().split('\n')}
