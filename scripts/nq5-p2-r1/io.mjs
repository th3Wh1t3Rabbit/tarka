import fs from 'node:fs'
import path from 'node:path'
import {readEvidence} from '../nq5-p2/evidence-files.mjs'
import {serialize} from './model.mjs'
export function writeArtifact(root,section,name,value,{immutable=false}={}){
 if(!['local','results'].includes(section)||name.split('/').some(p=>!p||p==='.'||p==='..')||name.includes('\\'))throw new Error('P2_R1_BOUNDED_ARTIFACT_NAME')
 const parts=['artifacts','g6p-p2-r1',section,...name.split('/').slice(0,-1)];let dir=root
 for(const p of parts){dir=path.join(dir,p);if(!fs.existsSync(dir))fs.mkdirSync(dir);const s=fs.lstatSync(dir);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid())throw new Error('P2_R1_OWNED_ARTIFACT_DIRECTORY')}
 const base=path.join(root,'artifacts/g6p-p2-r1',section),file=path.join(base,name),bytes=serialize(value)
 if(fs.existsSync(file)){const old=readEvidence(base,name);if(old.equals(bytes))return;if(immutable)throw new Error('P2_R1_IMMUTABLE_RECEIPT_NO_REWRITE')}
 const flags=fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW|(immutable?fs.constants.O_EXCL:0),fd=fs.openSync(file,flags,0o600)
 try{const s=fs.fstatSync(fd);if(!s.isFile()||s.nlink!==1||s.uid!==process.getuid())throw new Error('P2_R1_OWNED_ARTIFACT_FILE');fs.ftruncateSync(fd,0);fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
}
export function persist(root,d){for(const[n,v]of Object.entries(d.entries))writeArtifact(root,'results',n,v,{immutable:n==='RECEIPTS/P2_LEAD_PARTIAL_ACCEPTANCE_RECEIPT.json'})}
