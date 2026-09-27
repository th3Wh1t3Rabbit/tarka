import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { execFileSync } from 'node:child_process'
import { identity, sha, freeze } from '../nq5/schema.mjs'
import { assertAccepted, ACCEPTED_COMMIT } from './authority.mjs'
import { assertDocs } from './docs.mjs'
import { REVIEW_LENSES } from '../nq5-r2/review-identity.mjs'
import { proveUnchangedObservationCode } from '../nq5-r2/observation.mjs'
import { configuredCampaignRoots, resumeCampaignGenesis } from '../nq5-r3/genesis.mjs'
import { R3_CUT, R3_TREE, CAMPAIGN_ID } from '../nq5-r3-r1/authority.mjs'
import { ACTIVE_R3 } from '../nq5-r3/authority.mjs'
import { captureSafeHeaders } from '../nq5-b1-r1/headers.mjs'

const localProofs=new WeakMap(),liveProofs=new WeakMap()
export const LOCAL_SUITES=Object.freeze(['execution-adversarial','source-validator','report-schema-controls','typecheck-lint','acquisition-compile','unit-regression','acquisition-regression','browser-accessibility-performance','production-build','browser-boundary','records-office-boundary','euler-public-pack','project-clock-status','history-secret-boundary'])
function instructionPrefix(root){
  const prefix=execFileSync('git',['show',':AGENTS.md'],{cwd:root})
  if(prefix.includes(Buffer.from('## User-directed art-production continuity')))throw new Error('B1_ART_APPENDIX_STAGED')
  const fd=fs.openSync(path.join(root,'AGENTS.md'),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW),working=Buffer.alloc(prefix.length)
  try{if(fs.readSync(fd,working,0,working.length,0)!==working.length||!working.equals(prefix))throw new Error('B1_OPERATIONAL_INSTRUCTIONS_CHANGED')}finally{fs.closeSync(fd)}
  return prefix
}
export function implementationDigest(root){
  const names=execFileSync('git',['ls-files','--','.',':(exclude)ART_PRODUCTION',':(exclude).cursor',':(exclude)artifacts',':(exclude)docs/G6P_NQ5_T1_B1_REVIEW.json'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).sort()
  if(!names.includes('scripts/nq5-b1/run.mjs')||names.length<8)throw new Error('B1_IMPLEMENTATION_NOT_TRACKED')
  return identity(names.map(name=>[name,sha(name==='AGENTS.md'?instructionPrefix(root):fs.readFileSync(path.join(root,name)))]))
}
export function verifyLocalEvidence(review,verification,logs,digest,candidate){
  if(review.schemaVersion!=='1.0.0'||verification.schemaVersion!=='1.0.0')throw new Error('B1_LOCAL_VERIFICATION_OR_REVIEW_REQUIRED')
  if(review.implementationSha256!==digest||review.unresolvedAcceptedP0P1!==0||review.status!=='PASS_BOUNDED_NO_CREDENTIAL_SCOPE'||review.lenses.length!==8||identity(review.lenses.map(l=>l.name).sort())!==identity([...REVIEW_LENSES].sort())||review.lenses.some(l=>l.status!=='PASS_BOUNDED_SCOPE')||verification.implementationSha256!==digest||verification.status!=='PASS'||verification.governedSourceCommitted!==true||identity(verification.candidate)!==identity(candidate)||verification.suites.length!==LOCAL_SUITES.length||identity(verification.suites.map(s=>s.name).sort())!==identity([...LOCAL_SUITES].sort())||verification.suites.some(s=>s.status!=='PASS'||!Buffer.isBuffer(logs[s.name])||!logs[s.name].toString().trim()||sha(logs[s.name])!==s.sha256)||verification.credentialAccess!==false||verification.actualPrivateBaselineAccess!==false||verification.providerCalls!==0||verification.documentationGets!==0||verification.networkHold!==true||!Number.isFinite(Date.parse(verification.generatedAtUtc))||Date.now()-Date.parse(verification.generatedAtUtc)>86400000||Date.parse(verification.generatedAtUtc)>Date.now())throw new Error('B1_LOCAL_VERIFICATION_OR_REVIEW_REQUIRED')
}
export function assertVerificationCut(start,current){if(identity(start)!==identity(current))throw new Error('B1_VERIFICATION_SOURCE_CHANGED')}
export function admitLocalReview(root,bound){
  assertAccepted(bound)
  const review=JSON.parse(fs.readFileSync(path.join(root,'docs/G6P_NQ5_T1_B1_REVIEW.json'))),verification=JSON.parse(fs.readFileSync(path.join(root,'artifacts/g6p-b1/local/VERIFICATION.json')))
  const digest=implementationDigest(root)
  const logs=Object.fromEntries(LOCAL_SUITES.map(name=>[name,fs.readFileSync(path.join(root,'artifacts/g6p-b1/local',name+'.log'))]))
  const candidate={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim()}
  verifyLocalEvidence(review,verification,logs,digest,candidate)
  const proof=freeze({envelopeHash:bound.envelope.hash,digest})
  localProofs.set(proof,{root,bound});return proof
}
export function admitPrivateBaseline(local,docs){
  const context=localProofs.get(local)
  if(!context)throw new Error('B1_LOCAL_PROOF_REQUIRED')
  const {root,bound}=context;assertDocs(docs,bound)
  if(local.digest!==implementationDigest(root))throw new Error('B1_IMPLEMENTATION_CHANGED')
  proveUnchangedObservationCode(root)
  execFileSync('git',['merge-base','--is-ancestor',ACCEPTED_COMMIT,'HEAD'],{cwd:root,stdio:'pipe'})
  const historical={candidateCommit:R3_CUT,candidateTree:R3_TREE,sourceIdentity:identity(ACTIVE_R3),accountObservationIdentity:bound.reuse.originalTerminalIdentity,accountReportSha256:'6dc07198fdc6f6dc685b076877456c9b669517798aea932cc39c981f8e11ee3f'}
  const creation={...historical,candidateCommit:'41be40d234c7a7f31d9167294dafa5cf8a3e94a5',candidateTree:'718b8b8e1c0c04e6195130d96078f78c70a6ecc9'}
  const receipt=resumeCampaignGenesis(configuredCampaignRoots(),CAMPAIGN_ID,creation,historical,root,'462f2a627c6f3f6c00fd521626a069d53a4713d60627851fa04eff691abc4a57')
  if(sha(Buffer.from(JSON.stringify(receipt,null,2)+'\n'))!==bound.envelope.genesisReceiptSha256)throw new Error('B1_GENESIS_RECEIPT_CHANGED')
  const proof=freeze({envelopeHash:bound.envelope.hash,baseline:'VERIFIED_ZERO_READ_ONLY',digest:local.digest})
  liveProofs.set(proof,{...context,docs,roots:configuredCampaignRoots().map(r=>path.join(r,CAMPAIGN_ID))});return proof
}
// Called only after all no-credential gates. File discovery is metadata-only;
// the approved separate file's contents are read only inside this closure.
function credential(project,environmentCredential){
  let value=environmentCredential()
  if(!value){
    const directory=path.join(project,'sources'),found=[]
    const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile()&&/(?:^|[-_ ])NANSEN_API_KEY\.txt$/.test(entry.name))found.push(file)}}
    if(fs.existsSync(directory))walk(directory)
    if(found.length!==1)throw new Error('B1_APPROVED_CREDENTIAL_FILE_UNAVAILABLE')
    const stat=fs.lstatSync(found[0]);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)throw new Error('B1_APPROVED_CREDENTIAL_FILE_UNAVAILABLE')
    const fd=fs.openSync(found[0],fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW)
    try{value=fs.readFileSync(fd,'utf8').trim()}finally{fs.closeSync(fd)}
  }
  if(typeof value!=='string'||value.length<8||value.length>4096||/[^\x21-\x7e]/.test(value))throw new Error('B1_CREDENTIAL_FORMAT_UNAVAILABLE')
  return value
}
export function createLiveTransport(proof,{environmentCredential=()=>process.env.NANSEN_API_KEY}={}){
  const context=liveProofs.get(proof)
  if(!context)throw new Error('B1_RUNTIME_CREDENTIAL_GATE_REQUIRED')
  const {root,bound,docs,roots}=context;assertDocs(docs,bound)
  if(implementationDigest(root)!==proof.digest)throw new Error('B1_IMPLEMENTATION_CHANGED')
  let key
  try{key=credential(path.dirname(root),environmentCredential)}catch{throw new Error('B1_APPROVED_CREDENTIAL_FILE_UNAVAILABLE')}
  const transport=(request,timeouts)=>new Promise((resolve,reject)=>{
    if(!bound.plan.requests.some(r=>identity(r)===identity(request))||request.method!=='POST'){reject(new Error('B1_UNAUTHORIZED_PROVIDER_REQUEST'));return}
    let settled=false,connectTimer,totalTimer
    const fail=()=>{if(settled)return;settled=true;clearTimeout(connectTimer);clearTimeout(totalTimer);req.destroy();reject(new Error('B1_PROVIDER_TRANSPORT_FAILED'))}
    const req=https.request({hostname:'api.nansen.ai',port:443,path:request.path,method:'POST',agent:false,headers:{apikey:key,'content-type':'application/json',accept:'application/json'}},response=>{
      clearTimeout(connectTimer);let length=0;const chunks=[]
      response.on('data',chunk=>{length+=chunk.length;if(length>32000000)return fail();chunks.push(chunk)})
      response.on('error',fail);response.on('aborted',fail)
      response.on('end',()=>{
        if(settled)return
        const bytes=Buffer.concat(chunks)
        // Echoed credential material must never be copied into durable storage.
        if(bytes.includes(Buffer.from(key))||Object.values(response.headers).some(v=>String(v).includes(key)))return fail()
        let headers
        try{headers=captureSafeHeaders(response.headers,key)}catch{return fail()}
        settled=true;clearTimeout(totalTimer)
        resolve({status:response.statusCode,bytes,headers})
      })
    })
    req.on('socket',socket=>socket.once('secureConnect',()=>clearTimeout(connectTimer)));req.on('error',fail)
    connectTimer=setTimeout(fail,5000);totalTimer=setTimeout(fail,Math.min(60000,Math.max(30000,timeouts.totalTimeoutMs)));req.end(JSON.stringify(request.body))
  })
  return {transport,roots}
}
