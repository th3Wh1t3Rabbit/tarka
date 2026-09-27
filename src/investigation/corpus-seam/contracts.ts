import type {Query,QuestionLens,EvidenceGrade} from '../contracts'
import {assertExecutableQuery,canonicalQuery} from '../query'
export {CORPUS_INTERFACE,CORPUS_INTERFACE_IDENTITY,canonicalJSON,admitFrozenCorpusCandidate,validateDisplayRecord,displayForMode,admitSyntheticCorpusFixture,syntheticDisplayForMode} from './authority.mjs'
export type {AdmittedCorpus,AdmittedSyntheticCorpus,DeepReadonly} from './authority.mjs'
export type SemanticRole='EXACT'|'CONTEXTUAL'|'CORROBORATING'|'BOUNDED_NO_MATCH'|'CONTROL'|'CANDIDATE'|'DEAD_END'|'PROVENANCE'|'COVERAGE'
export interface DisplayRecord {
 id:string; identity:string; conceptId:string; role:SemanticRole; grade:EvidenceGrade
 temporalClass:string; questionId:string; question:string; lens:QuestionLens
 zeroResultClass:'NO_MATCH_IN_ACCEPTED_CORPUS'|null
 coverage:{scope:string;cellIds:string[];key:{subjectId:string;timeWindowId:string;lens:string;partitionId:string}|null;status:'PARTIAL_ACCEPTED_RETRIEVED_SCOPE';supportsHistoricalNegative:false}
 claimBoundaries:string[]; consumerIds:string[]; observedResultCount:number
 proofEligible:false; recursiveFrontierAuthority:false; runtimeProviderCalls:0; synthetic:boolean
}
export function executableCorpusQuery(query:Query):ReturnType<typeof canonicalQuery> {
 assertExecutableQuery(query)
 return canonicalQuery(query)
}
