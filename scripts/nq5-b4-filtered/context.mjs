import { identity } from '../nq5/schema.mjs'
import { postContext, reconcile } from '../nq5-b3/reconciliation.mjs'
import { accepted, cut, digest, LEDGER_SHA } from './authority.mjs'
export function baseline(root){
 const a=accepted(root),prior=postContext(root),e=a.objects['EXECUTION/T1_B3_EXECUTION_ENVELOPE.json'],r=reconcile(prior,e)
 if(r.current.bytesSha256!==LEDGER_SHA||r.current.bytes!==87416||r.current.rows.length!==39||r.current.starts.size!==13||r.current.responses.size!==13||r.current.terminals.size!==13||r.report.supplierCountedTerminals!==11||r.report.knownCampaignCredits!==13||!r.report.clean||r.report.unresolvedReservations!==0||r.report.unresolvedTerminals!==0||identity(r.index)!==identity(a.objects['PUBLIC/NQ5_PUBLIC_CALL_INDEX.json'])||identity(r.audit)!==identity(a.objects['EVIDENCE/NANSEN_API_REQUEST_AUDIT.json']))throw new Error('B4_EXACT_THIRTEEN_RESPONSE_BASELINE')
 const sources=[...prior.priorResult.privateProjections,...r.projections];if(sources.length!==8)throw new Error('B4_EXACT_EIGHT_ACCEPTED_SOURCES')
 return {root,a,prior,r,sources,source:{candidate:cut(root),implementationSha256:digest(root)}}
}
