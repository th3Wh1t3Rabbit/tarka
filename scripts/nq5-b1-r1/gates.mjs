import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha } from '../nq5/schema.mjs'
import { loadAccepted } from '../nq5-b1/authority.mjs'
import { LOCAL_SUITES, verifyLocalEvidence } from '../nq5-b1/live.mjs'
import { BASE, TREE, B1_ARCHIVE, B1_SHA } from './checkpoint.mjs'
import { CONTRACT_SHA } from './audit.mjs'

export const MANIFEST_SHA='a532fd3c3cf835fdf2b453c9a2866e3e3058bd6d80d74935df3e9ef7fc653555'
export const CONTRACT='docs/source/execution-b1-r1/44_G6P_NQ5_T1_B1_R1_EXECUTION_CONTRACT.txt'
export const gitEnv=()=>Object.fromEntries(['PATH','HOME','LANG','LC_ALL','TMPDIR'].flatMap(n=>process.env[n]===undefined?[]:[[n,process.env[n]]]))
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',env:gitEnv(),maxBuffer:64000000}).trimEnd()
export function sourceBinding(root){
  const bound=loadAccepted(root),manifest=fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_R1_SOURCE_MANIFEST.sha256'))
  if(sha(manifest)!==MANIFEST_SHA||manifest.toString()!==fs.readFileSync(path.join(root,'docs/source/ACTIVE_B1_SOURCE_MANIFEST.sha256'),'utf8')+CONTRACT_SHA+'  '+CONTRACT+'\n'||sha(fs.readFileSync(path.join(root,CONTRACT)))!==CONTRACT_SHA||sha(fs.readFileSync(path.join(path.dirname(root),B1_ARCHIVE)))!==B1_SHA||git(root,'rev-parse',BASE+'^{tree}')!==TREE)throw new Error('R1_EXACT_SOURCE_INSTALL_REQUIRED')
  git(root,'merge-base','--is-ancestor',BASE,'HEAD');return bound
}
export function instructions(root){
  const prefix=execFileSync('git',['show',':AGENTS.md'],{cwd:root,env:gitEnv()})
  if(prefix.includes(Buffer.from('## User-directed art-production continuity')))throw new Error('R1_ART_APPENDIX_STAGED')
  const fd=fs.openSync(path.join(root,'AGENTS.md'),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW),working=Buffer.alloc(prefix.length)
  try{if(fs.readSync(fd,working,0,working.length,0)!==working.length||!working.equals(prefix))throw new Error('R1_OPERATIONAL_INSTRUCTIONS_CHANGED')}finally{fs.closeSync(fd)}
  return prefix
}
export function implementationDigest(root){
  const names=git(root,'ls-files','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION',':(exclude)artifacts',':(exclude)docs/G6P_NQ5_T1_B1_REVIEW.json',':(exclude)docs/G6P_NQ5_T1_B1_R1_REVIEW.json').split('\n').filter(Boolean).sort()
  if(!names.includes('scripts/nq5-b1-r1/run.mjs')||!names.includes(CONTRACT))throw new Error('R1_IMPLEMENTATION_NOT_STAGED')
  return identity(names.map(n=>[n,sha(n==='AGENTS.md'?instructions(root):fs.readFileSync(path.join(root,n)))]))
}
export function cut(root){
  const excluded=['AGENTS.md','.cursor','ART_PRODUCTION','artifacts/g6p-a2u/current','artifacts/g6p-a2p/verification','artifacts/g6p-b1','artifacts/g6p-b1-r1'].map(n=>':(exclude)'+n)
  if(git(root,'status','--porcelain=v1','--untracked-files=all','--','.',...excluded))throw new Error('R1_DIRTY_GOVERNED_SOURCE')
  const prefix=instructions(root)
  if(!prefix.equals(execFileSync('git',['show','HEAD:AGENTS.md'],{cwd:root,env:gitEnv()})))throw new Error('R1_UNCOMMITTED_OPERATIONAL_INSTRUCTIONS')
  return {commit:git(root,'rev-parse','HEAD'),tree:git(root,'rev-parse','HEAD^{tree}')}
}
export function reviewEvidence(root){
  const review=JSON.parse(fs.readFileSync(path.join(root,'docs/G6P_NQ5_T1_B1_R1_REVIEW.json'))),verification=JSON.parse(fs.readFileSync(path.join(root,'artifacts/g6p-b1-r1/local/VERIFICATION.json'))),logs=Object.fromEntries(LOCAL_SUITES.map(n=>[n,fs.readFileSync(path.join(root,'artifacts/g6p-b1-r1/local',n+'.log'))]))
  verifyLocalEvidence(review,verification,logs,implementationDigest(root),cut(root))
  return {review,verification,logs}
}
