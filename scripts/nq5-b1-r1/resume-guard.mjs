import { identity } from '../nq5/schema.mjs'
import { CONSUMED, LEDGER_SHA } from './checkpoint.mjs'
import { CONTRACT_SHA, resumeEnvelope } from './audit.mjs'

// Pure admission model, never a serialized live capability or lock writer.
// The actual preserved root cause fails this gate, so R1 has no live entrypoint.
export function assertResumeAdmission(bound,prior,diagnostic,envelope){
  if(identity(envelope)!==identity(resumeEnvelope(bound))||envelope.executionContractSha256!==CONTRACT_SHA||prior.bytesSha256!==LEDGER_SHA||prior.bytes!==4659||prior.starts.size!==2||prior.responses.size!==2||prior.terminals.size!==2||identity([...prior.terminals.keys()].sort())!==identity([...CONSUMED].sort())||[...prior.terminals.values()].some(r=>r.disposition!=='TERMINAL_FAILURE'||r.publicRecord!==null))throw new Error('R1_EXACT_REVIEWED_RESUME_BASELINE_REQUIRED')
  if(diagnostic.responses.length!==2||identity(diagnostic.responses.map(r=>r.logicalId).sort())!==identity([...CONSUMED].sort())||diagnostic.responses.some(r=>r.safelyAdmissible!==true||r.firstFailedStage!==null||Object.values(r.stages).some(s=>s.status!=='PASS')))throw new Error('R1_ROOT_CAUSE_ADMISSION_BLOCKED')
  return true
}
export function assertRemainingIssue(envelope,id,issued=new Set()){
  if(CONSUMED.includes(id)||!envelope.remainingIds.includes(id)||issued.has(id)||issued.size>=13)throw new Error('R1_CONSUMED_REPEATED_OR_UNAUTHORIZED_REQUEST')
  return true
}
