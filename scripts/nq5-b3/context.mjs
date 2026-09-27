import fs from 'node:fs'
import path from 'node:path'
import { identity, sha } from '../nq5/schema.mjs'
import { readMirrored, replay } from '../nq5-b1/store.mjs'
import { postContext as priorContext, reconcilePrior } from './prior.mjs'
import { contextIdentity } from '../nq5-b2/context.mjs'
import { assertPrivateAncestry, assertRawInventory } from '../nq5-b1-r3/gate-proof.mjs'
import { accepted, cut, digest, LEDGER_SHA, ISSUE_ORDER, B2_IDS } from './authority.mjs'
import { receipt, freeze } from './planner.mjs'
export { contextIdentity }
const contexts=new WeakMap()
export function open(root,{post=false,locked=false}={}){
 const a=accepted(root),old=priorContext(root),e=a.b3PriorObjects['EXECUTION/T1_B2_EXECUTION_ENVELOPE.json'],r=reconcilePrior(old,e),envelope={...a.context.bound.envelope,executionOrder:[...a.context.bound.envelope.executionOrder,...B2_IDS,...ISSUE_ORDER]},full=replay(old.state.roots,envelope),bytes=readMirrored(old.state.roots,'qualification.jsonl');assertPrivateAncestry(old.state.roots);if(bytes.length<47766||sha(bytes.subarray(0,47766))!==LEDGER_SHA||!post&&bytes.length!==47766||full.rows.length<24)throw new Error('B3_ACCEPTED_PRIVATE_PREFIX')
 const roots=old.state.roots,required=['B1_EXECUTION_LOCK.json','B1_R3_RESUME_LOCK.json','T1_B2_EXECUTION_LOCK.json','GENESIS_COMMIT.json','genesis.json','qualification.jsonl','raw-b1',...(locked||post&&fs.existsSync(path.join(roots[0],'T1_B3_EXECUTION_LOCK.json'))?['T1_B3_EXECUTION_LOCK.json']:[])].sort().join();for(const dir of roots)if(fs.readdirSync(dir).sort().join()!==required)throw new Error('B3_EXACT_PRIVATE_INVENTORY');assertRawInventory(roots,[...full.responses.values()].map(v=>v.rawName))
 const privateHashes={'qualification.jsonl':LEDGER_SHA};for(const n of ['B1_EXECUTION_LOCK.json','B1_R3_RESUME_LOCK.json','T1_B2_EXECUTION_LOCK.json','GENESIS_COMMIT.json','genesis.json'])privateHashes[n]=sha(readMirrored(roots,n));for(const v of r.current.responses.values()){const b=readMirrored(roots,'raw-b1/'+v.rawName);if(sha(b)!==v.rawSha256||b.length!==v.rawBytes)throw new Error('B3_EIGHT_RAW_HASHES');privateHashes['raw-b1/'+v.rawName]=sha(b)}
 const state={...r.current,roots,privateHashes,identity:identity(privateHashes)},priorResult={...old.priorResult,index:r.index,audit:r.audit,privateProjections:[old.priorResult.privateProjections.find(v=>v.logicalId===a.b3PriorObjects['RECEIPTS/R3_R2_LEAD_ACCEPTANCE_RECEIPT.json'].logicalId),...r.projections]},lead=receipt(a,state,r),plans=freeze(a,state,priorResult,lead),source={candidate:cut(root),implementationSha256:digest(root)},c={root,a,state,priorResult,lead,plans,source};return c
}
export function assertBaseline(c,{verifyPrivate=false,locked=false}={}){if(!contexts.has(c)||contexts.get(c)!==contextIdentity(c)||c.state.rows.length!==24)throw new Error('B3_BRANDED_BASELINE_REQUIRED');if(verifyPrivate){const fresh=open(c.root,{locked});if(contextIdentity(fresh)!==contextIdentity(c))throw new Error('B3_FRESH_EIGHT_RAW_BASELINE_REQUIRED')}return true}
export function baseline(root){const c=open(root);if(identity(c.source)!==identity({candidate:cut(root),implementationSha256:digest(root)}))throw new Error('B3_SOURCE_CHANGED');contexts.set(c,contextIdentity(c));return c}
export function postContext(root){return open(root,{post:true})}
