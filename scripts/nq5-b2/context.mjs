import { identity, sha } from '../nq5/schema.mjs'
import { readMirrored } from '../nq5-b1/store.mjs'
import { reopen } from '../nq5-b1-r3-r1/readonly.mjs'
import { revalidate } from '../nq5-b1-r3-r2/evidence.mjs'
import { accepted, cut, digest } from './authority.mjs'
import { receipt, freeze } from './planner.mjs'
const contexts=new WeakMap()
export function contextIdentity(c){const normalize=x=>Buffer.isBuffer(x)?{bufferSha256:sha(x),bytes:x.length}:x instanceof Map?{mapEntries:[...x].map(([k,v])=>[normalize(k),normalize(v)]).sort((a,b)=>JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])))}:x instanceof Set?{setValues:[...x].map(normalize).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}:Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,normalize(v)])):x;return identity(normalize(c))}
export function assertBaseline(c,{verifyPrivate=false,locked=false}={}){const p=contexts.get(c);if(!p||contextIdentity(c)!==p||c.state.rows.length!==18)throw new Error('B2_BRANDED_BASELINE_REQUIRED');if(verifyPrivate){const fresh=reopen(c.a,{additionalAllowedFiles:locked?['T1_B2_EXECUTION_LOCK.json']:[]});if(fresh.identity!==c.state.identity||contextIdentity(fresh)!==contextIdentity(c.state))throw new Error('B2_FRESH_PRIVATE_IDENTITY_REQUIRED');for(const r of fresh.responses.values()){const b=readMirrored(fresh.roots,'raw-b1/'+r.rawName);if(sha(b)!==r.rawSha256||b.length!==r.rawBytes)throw new Error('B2_SIX_FRESH_RAW_IDENTITIES_REQUIRED')}}return true}
export function baseline(root){const source={candidate:cut(root),implementationSha256:digest(root)},a=accepted(root),state=reopen(a),priorResult=revalidate(a,state,root),lead=receipt(a,state,priorResult),plans=freeze(a,state,priorResult,lead);for(const r of state.responses.values()){const b=readMirrored(state.roots,'raw-b1/'+r.rawName);if(sha(b)!==r.rawSha256||b.length!==r.rawBytes)throw new Error('B2_SIX_RAW_BINDINGS')}
 const ending=reopen(a);if(ending.identity!==state.identity||identity(source)!==identity({candidate:cut(root),implementationSha256:digest(root)}))throw new Error('B2_READONLY_BASELINE_OR_SOURCE_CHANGED');const c={root,a,state,priorResult,lead,plans,source};contexts.set(c,contextIdentity(c));return c
}
