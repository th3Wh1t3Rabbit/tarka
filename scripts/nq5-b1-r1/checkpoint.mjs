import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { sha, identity } from '../nq5/schema.mjs'
import { loadAccepted } from '../nq5-b1/authority.mjs'
import { readMirrored, replay } from '../nq5-b1/store.mjs'
import { configuredCampaignRoots } from '../nq5-r3/genesis.mjs'
import { diagnose } from './diagnostic.mjs'
import { captureSafeHeaders } from './headers.mjs'

export const BASE='f6cfe0773c5c66e47195eb84c57afb9ab70dc27c'
export const TREE='1773088619c343fa188d79a11fb7584f75e15236'
export const LEDGER_SHA='fb4331def4c1115ee85dafc2f8c104442b27659eb3d2fa7462903506578f27d5'
export const B1_ARCHIVE='TRACE_ESCAPE_G6P_NQ5_T1_B1_FAST_SAFE_CANARY_AND_FROZEN_BATCH_EXECUTION_DELIVERY_v1.0.0.zip'
export const B1_SHA='3a5f201dc61e3fbcb93ef1441ce9eb93383e5b830f70bdf45c1b04d4d2942fc7'
export const CONSUMED=Object.freeze(['049f8fdc840b535e9a19f6b0872f77d95f08b810a3daf8d411390bc6d890ff7a','0adc6faa92c8411b7ee6834c8c71734de4999f9c5a9443b522f5ca435808dd35'])
// Pure read-only structural admission. Production always supplies fixed reviewed
// pins; custom pins exist only to test synthetic stores, never as a live proof.
export function verifyPreservedState(bound,roots,pins={ledgerSha256:LEDGER_SHA,ledgerBytes:4659,genesisSha256:bound.genesis.primaryGenesisSha256,commitSha256:bound.genesis.primaryCommitSha256}){
  for(const root of roots){let current=path.parse(root).root;for(const part of root.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);const st=fs.lstatSync(current);if(st.isSymbolicLink()||!st.isDirectory())throw new Error('R1_PRIVATE_ANCESTRY')}}
  const prior=replay(roots,bound.envelope)
  if(prior.bytesSha256!==pins.ledgerSha256||prior.bytes!==pins.ledgerBytes||prior.starts.size!==2||prior.responses.size!==2||prior.terminals.size!==2||identity([...prior.terminals.keys()].sort())!==identity([...CONSUMED].sort())||[...prior.terminals.values()].some(t=>t.disposition!=='TERMINAL_FAILURE'||t.publicRecord!==null))throw new Error('R1_REVIEWED_LEDGER_IDENTITY')
  const lock=readMirrored(roots,'B1_EXECUTION_LOCK.json')
  if(!lock.equals(Buffer.from(JSON.stringify({envelopeHash:bound.envelope.hash,campaignId:bound.envelope.campaignId})+'\n')))throw new Error('R1_ORIGINAL_LOCK_ALTERED')
  for(const root of roots)if(fs.readdirSync(root).sort().join()!=='B1_EXECUTION_LOCK.json,GENESIS_COMMIT.json,genesis.json,qualification.jsonl,raw-b1')throw new Error('R1_UNEXPECTED_PRIVATE_STATE')
  if(sha(readMirrored(roots,'genesis.json'))!==pins.genesisSha256||sha(readMirrored(roots,'GENESIS_COMMIT.json'))!==pins.commitSha256)throw new Error('R1_GENESIS_IDENTITY')
  const expectedRaw=CONSUMED.map(id=>id+'.1.bin').sort().join()
  for(const root of roots)if(fs.readdirSync(path.join(root,'raw-b1')).sort().join()!==expectedRaw)throw new Error('R1_ORPHAN_OR_MISSING_RAW')
  for(const id of CONSUMED){
    const request=bound.plan.requests.find(r=>r.logicalId===id),start=prior.starts.get(id+'.1'),response=prior.responses.get(id+'.1')
    if(!response||response.httpStatus!==200||response.actualCredits!==1||response.quotedCredits!==1||start.requestBodySha256!==identity(request.body)||response.headers['x-nansen-credits-used']!=='1'||response.headers['x-nansen-credits-cost']!=='1'||String(response.remainingCredits)!==response.headers['x-nansen-credits-remaining'])throw new Error('R1_PRIOR_ATTEMPT_IDENTITY')
    captureSafeHeaders(response.headers)
  }
  return {prior,originalLockSha256:sha(lock)}
}
export function preservedCheckpoint(root){
  const archive=path.join(path.dirname(root),B1_ARCHIVE)
  if(sha(fs.readFileSync(archive))!==B1_SHA)throw new Error('R1_B1_ARCHIVE_IDENTITY')
  execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'],{cwd:root,stdio:'pipe'})
  if(execFileSync('git',['rev-parse',BASE+'^{tree}'],{cwd:root,encoding:'utf8'}).trim()!==TREE)throw new Error('R1_B1_TREE_IDENTITY')
  const bound=loadAccepted(root),roots=configuredCampaignRoots().map(r=>path.join(r,bound.envelope.campaignId)),{prior,originalLockSha256}=verifyPreservedState(bound,roots)
  const evidence=CONSUMED.map(id=>{
    const request=bound.plan.requests.find(r=>r.logicalId===id),start=prior.starts.get(id+'.1'),response=prior.responses.get(id+'.1'),terminal=prior.terminals.get(id)
    if(!response||response.httpStatus!==200||response.actualCredits!==1||response.quotedCredits!==1||start.requestBodySha256!==identity(request.body))throw new Error('R1_PRIOR_ATTEMPT_IDENTITY')
    const raw=readMirrored(roots,'raw-b1/'+response.rawName)
    return {logicalId:id,family:request.family,requestBodySha256:start.requestBodySha256,ledger:{startSequence:start.sequence,startHash:start.hash,responseSequence:response.sequence,responseHash:response.hash,terminalSequence:terminal.sequence,terminalHash:terminal.hash},rawBytes:raw.length,primarySha256:sha(raw),mirrorSha256:sha(raw),bytesEqual:true,httpStatus:response.httpStatus,safeHeaders:captureSafeHeaders(response.headers),provider_request_id:null,providerRequestIdLimitation:'NOT_CAPTURED_BY_B1_TRANSPORT_V1',immutableTerminal:terminal.disposition,qualificationCounted:false,...diagnose(bound,request,raw,response)}
  })
  return {bound,roots,prior,diagnostic:{schemaVersion:'1.0.0',campaignId:bound.envelope.campaignId,reviewedB1ArchiveSha256:B1_SHA,ledgerSha256:prior.bytesSha256,ledgerBytes:prior.bytes,originalLockSha256,responses:evidence,rawBodiesIncluded:false,privatePathsIncluded:false,currentDocumentationAdmission:'NOT_REFRESHED_ROOT_CAUSE_BLOCK',preservedOfficialSchemaAdmission:'EXACT_SCHEMA_UNCHANGED'}}
}
