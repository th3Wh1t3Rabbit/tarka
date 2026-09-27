import {canonical, identity, sha} from '../nq5/schema.mjs'
export {canonical, identity, sha}
export const BASE='47f0466e4f6f31ba2583577c4ff747b2dc1dab3b'
export const BASE_TREE='11d9390f547754dc2dfca3d8b5ff19dadb792b40'
export const SOURCE_SHA='5cceb9724726665f36a84d342d791130c5661f02ef69dfcfa3e4c709ed1703bb'
export const PRIOR_SHA='7b9f998fc3f8f200f08b05cc94aa2dbed1adf5db0184b3f70d7322ab6943d3ae'
export const CONTRACT_SHA='92dd732c17ed7f59238559464c71098295a77adb701ee602d046f334563ccf0f'
export const OFF=Object.freeze(Object.fromEntries(['network','provider','credential','account','P3','reserve','batch','progression','LaneC','corpusInterfaceFreeze','controllerSeam','LaneAIntegration','LaneBIntegration','Pixel','gameplayIntegration','titleBinding','Mission02','contentLock','hosting','release','submission'].map(k=>[k,false])))
export const STATUS=['SUPPORTABLE_WITH_CURRENT_SCOPE','REQUIRES_NEW_FAMILY','REQUIRES_ADDITIONAL_PUBLIC_SAFE_CASE','REQUIRES_EXTERNAL_RULE_CLARIFICATION','REJECTED_DERIVABLE_OR_PADDING']
export const RESEARCH_DISPOSITION='CURRENT_SCOPE_INSUFFICIENT_BOUNDED_EXPANSION_DECISION_REQUIRED'
export const TERMINAL='BLOCKED_WITH_EVIDENCE'
export function sealed(x){return {...x,identity:identity(x)}}
export function checkSeal(x){const {identity:h,...v}=x;if(h!==identity(v))throw Error('S1_IDENTITY');return true}
export function safeName(n){return typeof n==='string'&&/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(n)&&!n.split('/').some(p=>p==='.'||p==='..')}
export function admitEntries(entries,expected){if(entries.length!==expected.length||new Set(entries.map(x=>x.name)).size!==entries.length||entries.some(x=>!safeName(x.name)||x.type!=='regular')||identity(entries.map(x=>x.name).sort())!==identity([...expected].sort()))throw Error('S1_ARCHIVE_ENTRY_ADMISSION');return true}
export function installTargets(names,epoch='v1.10.0'){
 if(epoch!=='v1.10.0'||new Set(names).size!==names.length||names.some(n=>!safeName(n)))throw Error('S1_SOURCE_INSTALL_SCOPE')
 return names.map(n=>'docs/source/v1.10.0/'+n)
}
export const consumerBehavior=(behavior,response)=>{
 if(behavior==='INDEPENDENT_STATE_CHECK')return response.bucketExact===true?(response.matches===true?'CORROBORATED':'CONTRADICTED'):'UNRESOLVED'
 if(behavior==='BOUNDED_ROUTE_CHECK')return response.match===true?'CORROBORATED':response.boundedEmpty===true?'PROVIDER_NO_MATCH':'UNRESOLVED'
 if(behavior==='CORPUS_REGRESSION_CONTROL')return response.schemaCompatible===true?'FIXTURE_SUPPORTED':'FIXTURE_HELD'
 if(behavior==='RULE_SCOPE_DECISION')return response.corpusAllowed===true?'CONSIDER_BOUNDED_CORPUS':response.countMandatory===false?'REQUEST_INTERNAL_POLICY_DECISION':'REMAIN_CLOSED'
 throw Error('S1_UNKNOWN_BEHAVIOR')
}
export function falsifiable(delta){
 try{return !!delta&&typeof delta.consumer==='string'&&delta.before==='UNRESOLVED'&&delta.tests.length>=2&&new Set(delta.tests.map(t=>consumerBehavior(delta.behavior,t.input))).size>=2&&delta.tests.every(t=>consumerBehavior(delta.behavior,t.input)===t.expected)}catch{return false}
}
// Registry and evidence context are reviewed inputs, never candidate assertions.
// This is a research filter, NOT an automated proof of provider semantics or live admission.
export function evaluate(candidate,context){
 if(!candidate||!context)throw Error('S1_INPUT')
 if(Object.values(candidate.authorities||{}).some(v=>v!==false)||candidate.frozenPlan||candidate.livePlan) return 'LIVE_MISREPRESENTATION'
 if(['HELD','UNKNOWN','RETIRED','RETRY','DURABLE_REUSE'].includes(candidate.origin))return 'HISTORICAL_NOT_FUTURE'
 const o=context.registry[candidate.observationKey]
 if(!o||candidate.question!==o.question||candidate.family!==o.family||identity(candidate.delta)!==identity(o.delta))return 'UNREGISTERED_OBSERVATION_OR_DELTA'
 if(!o.prerequisites.every(x=>context.evidence.includes(x)))return 'MISSING_ACCEPTED_PREREQUISITE'
 if(!falsifiable(o.delta)||!context.consumers.includes(o.delta.consumer))return 'NO_FALSIFIABLE_CONSUMER'
 if(context.derivable.includes(o.key))return 'LOCALLY_DERIVABLE'
 if(context.retired.includes(o.key))return 'HISTORICAL_NOT_FUTURE'
 if(context.hubs.includes(o.subject)&&o.role==='ROUTE_BREADTH')return 'HUB_SUPPRESSED'
 if(o.role==='FOREGROUND_CONTEXT_PROOF')return 'CONTEXT_CANNOT_BECOME_EXACT_PROOF'
 if(!['INDEPENDENT_STATE','BOUNDED_ROUTE','REGRESSION_CONTROL','EXACT_RECONCILIATION'].includes(o.role))return 'NON_INVESTIGATIVE_PURPOSE'
 const zeroDominates=(context.acceptedZeroCoverage||[]).some(z=>z.filterIdentity===o.filterIdentity&&z.page===o.page&&o.window&&z.from<=o.window.from&&z.to>=o.window.to)
 if(context.dominated.includes(o.key)||zeroDominates)return 'DOMINATED_PRIOR_EVIDENCE'
 if(!context.admittedFamilies.includes(o.family)||o.status!==STATUS[0])return 'OUTSIDE_CURRENT_SCOPE'
 if(o.hashes?.length&&identity([...(candidate.hashes||[])].sort())!==identity([...o.hashes].sort()))return 'EXACT_HASH_FRAGMENTATION'
 return 'RESEARCH_INVENTORY_ONLY'
}
// Partition by actual registered observation; IDs, target, phases, display names,
// asserted meaningful/noPadding, family diversity and consumer suffixes add nothing.
export function inventory(candidates,context){
 const accepted=[],rejected=[],seen=new Set()
 for(const c of candidates){let reason=evaluate(c,context);if(reason==='RESEARCH_INVENTORY_ONLY'){const k=context.registry[c.observationKey].equivalenceKey;if(seen.has(k))reason='EQUIVALENT';else{seen.add(k);accepted.push(c)}}if(reason!=='RESEARCH_INVENTORY_ONLY')rejected.push({id:c.id,reason})}
 return {accepted,rejected,maximumDefensible:accepted.length}
}
