import fs from 'node:fs'
import path from 'node:path'
import { sha, identity } from '../nq5/schema.mjs'

const strict = (file,directory=false) => {
  const stat=fs.lstatSync(file)
  if(stat.isSymbolicLink() || (directory?!stat.isDirectory():!stat.isFile()) || (stat.mode&0o777)!==(directory?0o700:0o600) || stat.uid!==process.getuid() || (!directory&&stat.nlink!==1))throw new Error('B1_PRIVATE_METADATA')
}
function syncDirectory(directory){const fd=fs.openSync(directory,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function create(file,bytes){const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}syncDirectory(path.dirname(file));strict(file)}
function read(file){strict(file);const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{return fs.readFileSync(fd)}finally{fs.closeSync(fd)}}
export function readMirrored(roots,name){const values=roots.map(root=>{strict(root,true);return read(path.join(root,name))});if(!values[0].equals(values[1]))throw new Error('B1_MIRROR_MISMATCH');return values[0]}
export function replay(roots,envelope){
  if(roots.length!==2||path.resolve(roots[0])===path.resolve(roots[1]))throw new Error('B1_PRIVATE_ROOTS')
  const bytes=readMirrored(roots,'qualification.jsonl')
  if(bytes.length && bytes.at(-1)!==10)throw new Error('B1_CRASH_TAIL_NO_REPAIR')
  const rows=bytes.length?new TextDecoder('utf-8',{fatal:true}).decode(bytes).trimEnd().split('\n').map(line=>JSON.parse(line)):[]
  let previous=sha(Buffer.alloc(0));const starts=new Map(),responses=new Map(),terminals=new Map();let lastRank=-1
  for(let i=0;i<rows.length;i++){
    const row=rows[i],{hash,...payload}=row
    if(identity(payload)!==hash || row.previous!==previous || row.sequence!==i+1 || row.envelopeHash!==envelope.hash || row.campaignId!==envelope.campaignId)throw new Error('B1_LEDGER_CHAIN')
    previous=hash
    const rank=envelope.executionOrder.indexOf(row.logicalId),attemptKey=row.logicalId+'.'+row.attempt
    if(rank<0 || !Number.isInteger(row.attempt) || row.attempt<1 || row.attempt>3)throw new Error('B1_LEDGER_AUTHORITY')
    if(row.kind==='START'){
      if(starts.has(attemptKey)||terminals.has(row.logicalId)||starts.size>=45)throw new Error('B1_LEDGER_DUPLICATE_START')
      if(row.attempt>1){const prior=responses.get(row.logicalId+'.'+(row.attempt-1));if(!prior||!envelope.retryStatuses.includes(prior.httpStatus)||prior.actualCredits===null)throw new Error('B1_LEDGER_RETRY')}
      starts.set(attemptKey,row)
    }else if(row.kind==='RESPONSE'){
      if(!starts.has(attemptKey)||responses.has(attemptKey)||terminals.has(row.logicalId))throw new Error('B1_LEDGER_RESPONSE_ORDER')
      if(row.rawName!==row.logicalId+'.'+row.attempt+'.bin')throw new Error('B1_RAW_IDENTITY')
      strict(path.join(roots[0],'raw-b1'),true);strict(path.join(roots[1],'raw-b1'),true)
      const raw=readMirrored(roots,'raw-b1/'+row.rawName)
      if(sha(raw)!==row.rawSha256 || raw.length!==row.rawBytes)throw new Error('B1_RAW_HASH')
      if(row.actualCredits!==null && (!Number.isSafeInteger(row.actualCredits)||row.actualCredits<0))throw new Error('B1_CREDIT_SHAPE')
      responses.set(attemptKey,row)
    }else if(row.kind==='TERMINAL'){
      if(!starts.has(attemptKey)||terminals.has(row.logicalId)||rank<=lastRank)throw new Error('B1_TERMINAL_ORDER')
      if(row.disposition==='SUCCESS_COUNTED'&&(!responses.has(attemptKey)||!row.publicRecord||row.publicRecord.qualification_sequence!==[...terminals.values()].filter(t=>t.disposition==='SUCCESS_COUNTED').length+1))throw new Error('B1_COUNT_ORDER')
      lastRank=rank;terminals.set(row.logicalId,row)
    }else throw new Error('B1_LEDGER_KIND')
  }
  return {rows,starts,responses,terminals,bytesSha256:sha(bytes),bytes:bytes.length}
}
// No recovery truncation, tail repair, history reset, or lock stealing. A prior
// invocation may be reconstructed read-only, but never resumed for new issue.
export class BatchStore {
  constructor(roots,envelope){
    const prior=replay(roots,envelope)
    if(prior.rows.length)throw new Error('B1_NONZERO_BASELINE_NO_REISSUE')
    for(const root of roots){strict(root,true);if(fs.readdirSync(root).sort().join()!=='GENESIS_COMMIT.json,genesis.json,qualification.jsonl')throw new Error('B1_UNEXPECTED_PRIVATE_BASELINE')}
    this.roots=roots;this.envelope=envelope;this.rows=[];this.failed=false
    try{
      for(const root of roots)create(path.join(root,'B1_EXECUTION_LOCK.json'),Buffer.from(JSON.stringify({envelopeHash:envelope.hash,campaignId:envelope.campaignId})+'\n'))
      for(const root of roots){fs.mkdirSync(path.join(root,'raw-b1'),{mode:0o700});syncDirectory(root)}
    }catch{this.failed=true;throw new Error('B1_EXCLUSIVE_EXECUTION_LOCK')}
  }
  append(payload){
    if(this.failed)throw new Error('B1_LEDGER_STOPPED')
    const row={...payload,campaignId:this.envelope.campaignId,envelopeHash:this.envelope.hash,sequence:this.rows.length+1,previous:this.rows.at(-1)?.hash??sha(Buffer.alloc(0))}
    row.hash=identity(row);const bytes=Buffer.from(JSON.stringify(row)+'\n')
    try{
      for(const root of this.roots){const file=path.join(root,'qualification.jsonl');strict(file);const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_NOFOLLOW);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}syncDirectory(root)}
      this.rows.push(row)
      if(!readMirrored(this.roots,'qualification.jsonl').equals(Buffer.from(this.rows.map(r=>JSON.stringify(r)+'\n').join(''))))throw new Error('B1_LEDGER_READBACK')
    }catch{this.failed=true;throw new Error('B1_LEDGER_STORAGE_FAILED')}
    return row
  }
  persist(logicalId,attempt,bytes){
    if(!this.envelope.executionOrder.includes(logicalId)||!Number.isInteger(attempt)||attempt<1||attempt>3||!Buffer.isBuffer(bytes))throw new Error('B1_RAW_AUTHORITY')
    const rawName=logicalId+'.'+attempt+'.bin'
    try{
      for(const root of this.roots){strict(path.join(root,'raw-b1'),true);create(path.join(root,'raw-b1',rawName),bytes)}
      const reopened=readMirrored(this.roots,'raw-b1/'+rawName)
      if(!reopened.equals(bytes))throw new Error('B1_RAW_MISMATCH')
      return {rawName,rawSha256:sha(reopened),rawBytes:reopened.length}
    }catch{throw new Error('B1_RAW_STORAGE_FAILED')}
  }
  raw(row){return readMirrored(this.roots,'raw-b1/'+row.rawName)}
}
