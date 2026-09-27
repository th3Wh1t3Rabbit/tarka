import fs from 'node:fs'
import path from 'node:path'
import { identity, sha } from '../nq5/schema.mjs'
import { corpusAt } from '../nq5-b1-r2/gates.mjs'
import { get, PAGES } from '../nq5-b1-r2/fetch-docs.mjs'
export const NAMES=Object.freeze(['transactions','pricing','rates','coverage','redistribution'])
const proofs=new WeakMap()
const branded=result=>{proofs.set(result,identity(result.index));return result}
export function assertLiveDocs(root,result){if(!proofs.has(result)||proofs.get(result)!==identity(result.index))throw new Error('R3_BRANDED_DOCUMENT_PROOF_REQUIRED');recheckFresh(root,result);return true}
export function allowed(url){return NAMES.some(n=>url==='https://docs.nansen.ai'+PAGES[n])}
export function validateCapturedIndex(index){
 const outer=['schemaVersion','acceptedR2SourceIndexIdentity','mode','unauthenticatedDocumentationGets','authenticatedNansenProviderRequests','accountRequests','browserRuntimeRequests','snapshots'],keys=['name','url','retrievedAtUtc','httpStatus','bytes','sha256','r2Sha256','unchangedFromR2','reusedR2','filename','transport']
 if(!index||Object.keys(index).some(k=>!outer.includes(k))||index.schemaVersion!=='1.0.0'||index.acceptedR2SourceIndexIdentity!=='9dcd93f996b92d4c8afd44815a5786ace16ca8c667700ea342eeae3a8a3ffbcf'||!['LOCAL_BYTE_EXACT_FRESH_R2_REUSE','EXACT_FIVE_CONDITIONAL_REFRESH'].includes(index.mode)||index.authenticatedNansenProviderRequests!==0||index.accountRequests!==0||index.browserRuntimeRequests!==0||!Array.isArray(index.snapshots)||index.snapshots.length>5||index.unauthenticatedDocumentationGets!==(index.mode==='EXACT_FIVE_CONDITIONAL_REFRESH'?index.snapshots.length:0))throw new Error('R3_INVALID_CAPTURE_INDEX')
 for(const[r,i]of index.snapshots.map((r,i)=>[r,i]))if(!r||Object.keys(r).some(k=>!keys.includes(k))||r.name!==NAMES[i]||r.url!=='https://docs.nansen.ai'+PAGES[r.name]||r.filename!==r.name+'.md'||!Number.isFinite(Date.parse(r.retrievedAtUtc))||!r.retrievedAtUtc.endsWith('Z')||!(r.httpStatus===null||Number.isInteger(r.httpStatus)&&r.httpStatus>=100&&r.httpStatus<=599)||!Number.isSafeInteger(r.bytes)||r.bytes<0||r.bytes>4000000||!/^[a-f0-9]{64}$/.test(r.sha256)||!/^[a-f0-9]{64}$/.test(r.r2Sha256)||typeof r.unchangedFromR2!=='boolean'||typeof r.reusedR2!=='boolean'||r.reusedR2!==(index.mode==='LOCAL_BYTE_EXACT_FRESH_R2_REUSE')||!['LOCAL_EXACT_R2_REUSE','UNAUTHENTICATED_HTTPS_GET_NO_REDIRECT','RETRIEVAL_UNAVAILABLE'].includes(r.transport))throw new Error('R3_INVALID_CAPTURE_ROW')
 return index
}
function directory(root){let dir=root;for(const n of ['artifacts','g6p-b1-r3','docs']){dir=path.join(dir,n);const st=fs.lstatSync(dir);if(st.isSymbolicLink()||!st.isDirectory())throw new Error('R3_DOCUMENT_DIRECTORY_METADATA')}return dir}
export function readCapturedDocs(root){
 const dir=directory(root),read=(name,max)=>{const f=path.join(dir,name),s=fs.lstatSync(f);if(s.isSymbolicLink()||!s.isFile()||s.nlink!==1||s.size>max)throw new Error('R3_DOCUMENT_FILE_METADATA');const fd=fs.openSync(f,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{return fs.readFileSync(fd)}finally{fs.closeSync(fd)}}
 const index=validateCapturedIndex(JSON.parse(read('INDEX.json',100000))),bodies={};for(const r of index.snapshots)if(!r.reusedR2){const b=read(r.filename,4000000);if(sha(b)!==r.sha256||b.length!==r.bytes)throw new Error('R3_CAPTURE_BYTE_IDENTITY');bodies[r.name]=b}return{index,bodies}
}
export function assertFresh(index,bodies,accepted,now=Date.now()){
 if(index.snapshots.length!==5||identity(index.snapshots.map(r=>r.name).sort())!==identity([...NAMES].sort()))throw new Error('R3_EXACT_FIVE_DOC_INVENTORY')
 for(const r of index.snapshots){const b=bodies[r.name],old=accepted[r.name];if(typeof r.reusedR2!=='boolean'||r.reusedR2&&(r.retrievedAtUtc!==old.retrievedAtUtc||r.transport!=='LOCAL_EXACT_R2_REUSE')||!allowed(r.url)||r.url!==old.url||r.httpStatus!==200||!Buffer.isBuffer(b)||r.bytes!==b.length||r.sha256!==sha(b)||r.sha256!==old.sha256||!Number.isFinite(Date.parse(r.retrievedAtUtc))||!r.retrievedAtUtc.endsWith('Z')||Date.parse(r.retrievedAtUtc)>now||now-Date.parse(r.retrievedAtUtc)>7200000)throw new Error('R3_DOC_UNAVAILABLE_CHANGED_OR_STALE')}
 return true
}
export async function freshness(root){
 const {corpus}=corpusAt(root),dir=path.join(root,'artifacts/g6p-b1-r3/docs'),indexFile=path.join(dir,'INDEX.json');let index,bodies
 try{fs.lstatSync(indexFile);throw new Error('R3_EXISTING_DOCUMENT_CAPTURE_NO_REENTRY')}catch(error){if(error.code!=='ENOENT')throw error}
 const reuse=NAMES.every(n=>Date.now()-Date.parse(corpus[n].retrievedAtUtc)<=7200000)
 index={schemaVersion:'1.0.0',acceptedR2SourceIndexIdentity:'9dcd93f996b92d4c8afd44815a5786ace16ca8c667700ea342eeae3a8a3ffbcf',mode:reuse?'LOCAL_BYTE_EXACT_FRESH_R2_REUSE':'EXACT_FIVE_CONDITIONAL_REFRESH',unauthenticatedDocumentationGets:0,authenticatedNansenProviderRequests:0,accountRequests:0,browserRuntimeRequests:0,snapshots:[]};bodies={};fs.mkdirSync(dir,{recursive:true});directory(root)
 for(const name of NAMES){const old=corpus[name],url=old.url;if(!allowed(url))throw new Error('R3_DOCUMENTATION_URL_FORBIDDEN');const result=reuse?{status:old.httpStatus,bytes:Buffer.from(old.body),retrievedAtUtc:old.retrievedAtUtc,transport:'LOCAL_EXACT_R2_REUSE'}:await get(url);if(!reuse)index.unauthenticatedDocumentationGets++;const filename=name+'.md',r={name,url,retrievedAtUtc:result.retrievedAtUtc,httpStatus:result.status,bytes:result.bytes.length,sha256:sha(result.bytes),r2Sha256:old.sha256,unchangedFromR2:sha(result.bytes)===old.sha256,reusedR2:reuse,filename,transport:result.transport};index.snapshots.push(r);bodies[name]=result.bytes;if(!reuse)fs.writeFileSync(path.join(dir,filename),result.bytes,{flag:'wx'});fs.writeFileSync(indexFile,JSON.stringify(index,null,2)+'\n',{flag:fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW|(index.snapshots.length===1?fs.constants.O_EXCL:fs.constants.O_TRUNC)});process.stdout.write('R3_DOC '+name+' status '+result.status+' bytes '+r.bytes+' sha256 '+r.sha256+'\n');if(result.status!==200||r.sha256!==old.sha256)throw new Error('R3_DOC_UNAVAILABLE_OR_CHANGE_REQUIRES_REVIEW')}
 assertFresh(index,bodies,corpus);return branded({index,bodies})
}
export function recheckFresh(root,result){return assertFresh(result.index,result.bodies,corpusAt(root).corpus)}
