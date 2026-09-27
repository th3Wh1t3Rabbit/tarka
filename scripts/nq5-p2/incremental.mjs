import {identity} from '../nq5/schema.mjs'
import {canonical} from '../nq5-p1/planner.mjs'
const comparable=q=>({family:q.family,path:q.path,method:q.method,body:Object.fromEntries(Object.entries(q.body??{}).filter(([k])=>k!=='date'))})
const window=q=>{const a=Date.parse(q.body?.date?.from),b=Date.parse(q.body?.date?.to);return Number.isFinite(a)&&Number.isFinite(b)&&a<=b?[a,b]:null}
export function dominance(q,facts){const w=window(q);if(!w)return null;return facts.find(f=>{const old=window(f.request);return f.formallyAccepted===true&&f.resultCount===0&&f.isLastPage===true&&old&&identity(comparable(q))===identity(comparable(f.request))&&old[0]<=w[0]&&old[1]>=w[1]&&(old[0]<w[0]||old[1]>w[1])})??null}
export const DOMINATED='REDUNDANT_SUBWINDOW_OF_PRIOR_ACCEPTED_FULL_WINDOW_ZERO_NO_INCREMENTAL_PROVIDER_EVIDENCE'
// This is a pure decision verifier, not a discovery/generation/authorization capability.
// The current R1 gate supplies no future-question registry or new request decisions.
export function incrementalDecision(q,d,facts,questions=[]){
 const reject=reason=>({logicalId:canonical(q),admitted:false,rejectionCode:reason,AUTHORIZED_TO_ISSUE:false})
 const prior=dominance(q,facts),question=questions.find(x=>x.id===d?.questionId)
 if(prior)return {...reject(DOMINATED),dominatingAcceptedLogicalId:prior.logicalId}
 if(facts.some(f=>f.formallyAccepted&&canonical(f.request)===canonical(q)))return reject('REQUEST_OBSERVATION_ALREADY_ACCEPTED_DERIVABLE_LOCALLY')
 if(!d||d.type!=='REQUEST_SPECIFIC_INCREMENTAL_UTILITY'||d.logicalId!==canonical(q)||d.requestIdentity!==identity(q))return reject('NO_REQUEST_SPECIFIC_INCREMENTAL_UTILITY_DECISION')
 if(!question||question.status!=='PREDECLARED_UNRESOLVED'||question.requestLogicalId!==canonical(q)||question.observationKey!==identity(q.body)||!['BOUNDED_COUNT_CONTRAST','PROVIDER_CONTRACT_FACT'].includes(question.kind))return reject('NO_EXACT_PREDECLARED_UNRESOLVED_QUESTION')
 const refs=d.priorAcceptedEvidenceLogicalIds
 if(!Array.isArray(refs)||!refs.length||new Set(refs).size!==refs.length||refs.some(id=>!facts.some(f=>f.logicalId===id&&f.formallyAccepted)))return reject('COMPARISON_REQUIRES_EXACT_ACCEPTED_EVIDENCE')
 if(d.acceptedEvidenceIdentity!==identity(facts)||d.absentObservationKey!==identity(q.body)||d.localDerivationRejection!=='EXACT_OBSERVATION_ABSENT_AND_NOT_LOCALLY_DERIVABLE')return reject('ABSENT_EVIDENCE_AND_LOCAL_DERIVATION_BINDING_REQUIRED')
 if(!d.unresolvedInvestigativeQuestion||d.unresolvedInvestigativeQuestion!==question.text||!d.existingEvidenceCannotAnswer||d.existingEvidenceCannotAnswer!==question.localDerivationLimit)return reject('CONCRETE_UNRESOLVED_DELTA_REQUIRED_NOT_TEMPLATE_QUESTION')
 const delta=d.downstreamBehavior
 if(!delta||!q.consumers?.includes(delta.consumerId)||delta.behavior!=='COMPARE_SUPPORTED_COUNTS_AT_EXACT_FILTERS'||delta.before!=='EXACT_COMPARISON_NOT_SUPPORTED'||delta.after!=='ADD_BOUNDED_SUPPORTED_COMPARISON'||delta.observationKey!==identity(q.body)||delta.expectedDistinctSemanticDelta!==question.expectedDistinctSemanticDelta||!delta.expectedDistinctSemanticDelta)return reject('CONCRETE_CONSUMER_BEHAVIOR_DELTA_REQUIRED')
 if(d.boundedStopRule!=='NO_ISSUE_WITHOUT_SEPARATE_REVIEW_AND_AUTHORITY_FIRST_BREAKER_NO_REPLACEMENT')return reject('BOUNDED_STOP_RULE_REQUIRED')
 return {logicalId:canonical(q),admitted:true,rejectionCode:null,decisionIdentity:identity(d),questionIdentity:identity(question),priorEvidenceIdentity:identity(facts),independentIncrementalUtility:true,AUTHORIZED_TO_ISSUE:false}
}
export function selectIncrementalRequests({candidates=[],decisions=[],acceptedEvidence=[],unresolvedQuestions=[]}={}){
 if(!Array.isArray(candidates)||!Array.isArray(decisions)||!Array.isArray(acceptedEvidence)||!Array.isArray(unresolvedQuestions))throw new Error('P2_INCREMENTAL_INPUT_ARRAYS_REQUIRED')
 if(new Set(candidates.map(canonical)).size!==candidates.length||new Set(decisions.map(d=>d.logicalId)).size!==decisions.length||decisions.some(d=>!candidates.some(q=>canonical(q)===d.logicalId)))throw new Error('P2_INCREMENTAL_EXACT_UNIQUE_DECISIONS_REQUIRED')
 const rows=candidates.map(q=>({request:q,...incrementalDecision(q,decisions.find(d=>d.logicalId===canonical(q)),acceptedEvidence,unresolvedQuestions)}))
 return {requests:rows.filter(r=>r.admitted).map(r=>r.request),rows,selectedByIndependentDecisionOnly:true,cartesianEnumerationIsAdmission:false,generatedConsumerIdsAreAdmission:false,noPaddingBooleanIsAdmission:false,AUTHORIZED_TO_ISSUE:false}
}
