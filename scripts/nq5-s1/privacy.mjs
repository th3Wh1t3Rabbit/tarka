import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
export function privatePathFindings(text){
 // Absolute literal paths, not slash-separated prose. Classify only exact
 // existing public synthetic regression literals; an added suffix is rejected.
 const a=[...text.matchAll(/(?<![A-Za-z0-9._/\\-])(?:file:\/\/)?(?:\/(?:home|Users)\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+|\/(?:tmp|private|workspace|mnt|var\/tmp)\/[A-Za-z0-9._/-]+|[A-Za-z]:\\+[A-Za-z0-9._-]{2,}(?:\\+[A-Za-z0-9._/-]+)*)/g)].map(x=>x[0].replace(/^file:\/\//,''))
 const publicFixtures=new Set(['synthetic/project/file','synthetic/private/key','synthetic/project','synthetic/source','synthetic/private.json','synthetic/private','private/value'].map(n=>'/'+['home',n].join('/')))
 const extraFixtures=new Set([['private','a'],['private','b'],['private','credential.txt'],['tmp','synthetic-x/log'],['var/tmp','synthetic/file'],['tmp','synthetic-only'],['tmp','synthetic'],['tmp','secret.txt'],['tmp','synthetic-fixture'],['tmp','SYNTHETIC_R1_DELIVERY_ONLY']].map(x=>'/'+x.join('/')))
 const windowsFixtures=new Set(['C','X','D'].flatMap((drive,i)=>['\\','\\\\'].map(s=>drive+':'+s+[i===0?'Users':i===1?'private':'tmp',...(i===0?['Synthetic','file']:[i===1?'data':'file'])].join(s))))
 return [...new Set(a)].filter(p=>!publicFixtures.has(p)&&!extraFixtures.has(p)&&!windowsFixtures.has(p))
}
export function currentTreeScan(root){
 const names=execFileSync('git',['ls-files','-z','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION',':(exclude)AGENTS.md'],{cwd:root}).toString().split('\0').filter(Boolean)
 let scanned=0;for(const n of names){const s=fs.lstatSync(root+'/'+n);if(!s.isFile()||s.isSymbolicLink())throw Error('S1_TREE_REGULAR');const t=fs.readFileSync(root+'/'+n).toString();if(hasSecretLikeValue(t))throw Error('S1_TREE_SECRET');if(privatePathFindings(t).length)throw Error('S1_TREE_PRIVATE_USER_PATH');scanned++}
 // The trusted committed AGENTS prefix is included without opening dirty worktree bytes.
 const a=execFileSync('git',['show','HEAD:AGENTS.md'],{cwd:root}).toString();if(hasSecretLikeValue(a)||privatePathFindings(a).length)throw Error('S1_COMMITTED_AGENTS_BOUNDARY')
 return {status:'PASS',governedFilesScanned:scanned,committedAgentsScanned:true,dirtyArtAppendixOpened:false,assetLanesEnumerated:false,secretFindings:0,privatePathFindings:0,privatePathScope:'Boundary-aware Unix and Windows absolute literals; exact existing public synthetic regression strings classified separately, no prefix exemptions.'}
}
export function historyPrivatePathScan(root){
 const rows=execFileSync('git',['rev-list','--objects','HEAD','--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION'],{cwd:root,maxBuffer:64000000}).toString().trim().split('\n').map(r=>{const[id,...bits]=r.split(' ');return {id,name:bits.join(' ')}}).filter(x=>!['.cursor','ART_PRODUCTION'].some(n=>x.name===n||x.name.startsWith(n+'/')))
 const input=rows.map(x=>x.id).join('\n')+'\n',types=execFileSync('git',['cat-file','--batch-check'],{cwd:root,input,maxBuffer:64000000}).toString().trim().split('\n'),blobs=rows.filter((x,i)=>types[i].split(' ')[1]==='blob'),findings=[],uniquePaths=new Set();let binaryPatternCandidates=0
 for(let start=0;start<blobs.length;start+=128){const part=blobs.slice(start,start+128),bytes=execFileSync('git',['cat-file','--batch'],{cwd:root,input:part.map(x=>x.id).join('\n')+'\n',maxBuffer:256000000});let off=0
  for(const entry of part){const end=bytes.indexOf(10,off),[id,type,size]=bytes.subarray(off,end).toString().split(' ');if(id!==entry.id||type!=='blob'||!Number.isInteger(Number(size)))throw Error('S1_GIT_BATCH');const b=bytes.subarray(end+1,end+1+Number(size));off=end+2+Number(size);let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(b)}catch{binaryPatternCandidates+=privatePathFindings(b.toString()).length;continue}const p=privatePathFindings(text);if(p.length){p.forEach(x=>uniquePaths.add(x));findings.push({gitBlob:entry.id,governedRelativeFile:entry.name,absoluteLiteralFindings:p.length,classification:'INHERITED_PRIVATE_ABSOLUTE_PATHS_NOT_A_PUBLIC_FIXTURE_EXCEPTION'})}}
 }
 return {status:findings.length?'FAIL_INHERITED_PRIVATE_ABSOLUTE_PATHS':'PASS',governedBlobs:blobs.length,privatePathFindings:findings.reduce((n,x)=>n+x.absoluteLiteralFindings,0),distinctPrivatePathLiterals:uniquePaths.size,binaryNonUtf8PatternCandidates:binaryPatternCandidates,binaryCandidatesAreNotTextPathLiterals:true,findings,privateFilesystemTargetsOpened:false,credentialFileOpened:false,assetLanesEnumerated:false,requiredAction:findings.length?'MAIN_EXPLICIT_HISTORY_PACKAGING_DISPOSITION_NO_UNILATERAL_EXCEPTION_OR_REWRITE':'NONE'}
}
