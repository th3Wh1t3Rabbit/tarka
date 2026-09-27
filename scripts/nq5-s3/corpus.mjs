import {identity,canonical} from '../nq5-s2/activity.mjs'
import {compileCorpus,validateConcept} from '../nq5-s2/corpus.mjs'
export const BASE='60c613d292099edb464210b9f03e07d6415c220e'
export const BASE_TREE='bdf1077923be6a3154fe3d358f9d36f045219f3b'
export const RC_ID='64807a4cbfb7b5ea1fb4931c2b94731c9e8c6e4f7b751fc609f3ce1c45df5e53'
export const VERSION='TE-IFACE-CORPUS@1.0.0'
export const ROLES=['EXACT','CONTEXTUAL','CORROBORATING','BOUNDED_NO_MATCH','CONTROL','CANDIDATE','DEAD_END','PROVENANCE','COVERAGE']
export const MODES=['FULLSCREEN_CRT','DOCKED_OVERLAY','PLAIN_LIST']
export const DISPLAY_KEYS=['id','identity','conceptId','role','grade','temporalClass','questionId','question','lens','zeroResultClass','coverage','claimBoundaries','consumerIds','observedResultCount','proofEligible','recursiveFrontierAuthority','runtimeProviderCalls','synthetic']
export const seal=x=>({...x,identity:identity(x)})
export function displayRecord(c,{synthetic=false,role=c.zeroResultClass?'BOUNDED_NO_MATCH':'CONTEXTUAL',grade=c.evidenceGrade}={}){
 const key=c.coverage.key
 const coverage={...structuredClone(c.coverage),key:key?{subjectId:key.subject_id,timeWindowId:key.time_window_id,lens:key.question_lens,partitionId:key.page_or_partition_id}:null}
 const body={conceptId:c.id,role,grade,temporalClass:c.temporalClass,questionId:c.question.id,question:c.question.question,lens:c.question.lens,zeroResultClass:c.zeroResultClass,coverage,claimBoundaries:[...c.claimBoundaries],consumerIds:[...c.namedConsumers],observedResultCount:c.observedResultCount,proofEligible:false,recursiveFrontierAuthority:false,runtimeProviderCalls:0,synthetic}
 const hash=identity(body);return {id:'SEMANTIC.'+hash,identity:hash,...body}
}
export function compileFinal(input,compatibility){
 const rc=compileCorpus(input);if(rc.identity!==RC_ID)throw Error('S3_PINNED_RC')
 const concepts=rc.concepts.map(c=>{validateConcept(c);return structuredClone(c)})
 const displayRecords=concepts.map(c=>displayRecord(c)).sort((a,b)=>a.id.localeCompare(b.id))
 const auditReferences=concepts.map(c=>({conceptId:c.id,identity:c.identity,provenance:structuredClone(c.provenance),publicPrivateDispositions:structuredClone(c.publicPrivateDispositions),allowedSurfaces:['SOURCE','LEDGER'],classification:'PUBLIC_REDACTED_REFERENCE_ONLY_PRIVATE_BODY_NOT_IMPORTED'})).sort((a,b)=>a.conceptId.localeCompare(b.conceptId))
 return seal({schemaVersion:'1.0.0',interface:VERSION,status:'READY_FOR_MAIN_FREEZE',parentRCIdentity:RC_ID,inputIdentity:rc.inputIdentity,acceptedIndexIdentity:rc.acceptedIndexIdentity,conceptCount:25,curatedAcceptedCalls:25,concepts,displayRecords,auditReferences,displaySurfaces:['CASE','RESULTS','EXPLORE'],exactTruthSeparation:rc.exactTruthSeparation,compatibility,interfaceFrozen:false,LaneCActive:false,gameplayIntegrated:false,newRequests:0,runtimeProviderCalls:0})
}
export function validateFinal(candidate,input,compatibility){
 const expected=compileFinal(input,compatibility)
 if(canonical(candidate)!==canonical(expected))throw Error('S3_FINAL_EXACT_VERSION_SEMANTIC_AUDIT_BINDING')
 return true
}
export function syntheticFixture(final){
 const base=final.concepts.find(c=>c.observedResultCount>0),zero=final.concepts.find(c=>c.zeroResultClass)
 const records=ROLES.map((role,i)=>{const c=structuredClone(role==='BOUNDED_NO_MATCH'?zero:base);c.id='SYNTHETIC.CONCEPT.'+i;c.question={id:'SYNTHETIC.QUESTION.'+i,question:'Nonhistorical '+role+' contract example',lens:'ACTIVITY',purpose:'SYNTHETIC_TEST'};c.namedConsumers=['SYNTHETIC.CONSUMER'];c.temporalClass='SYNTHETIC_NONHISTORICAL';c.coverage={scope:'SYNTHETIC_BOUNDED_ONLY',cellIds:['SYNTHETIC.CELL'],key:null,status:'PARTIAL_ACCEPTED_RETRIEVED_SCOPE',supportsHistoricalNegative:false};c.claimBoundaries=['SYNTHETIC_NOT_CANONICAL_TRUTH','NO_CONTEXTUAL_TO_EXACT_PROMOTION','NO_GLOBAL_NEGATIVE'];c.observedResultCount=role==='BOUNDED_NO_MATCH'?0:1;return displayRecord(c,{synthetic:true,role,grade:role==='EXACT'?'EXACT':role==='CORROBORATING'?'CORROBORATING':'CONTEXTUAL'})}).sort((a,b)=>a.id.localeCompare(b.id))
 return seal({schemaVersion:'1.0.0',interface:VERSION,interfaceIdentity:final.identity,status:'SYNTHETIC_TEST_NOT_GAMEPLAY',records,proofEligible:false,runtimeProviderCalls:0})
}
export const OWNED_PATHS=Object.freeze(['src/investigation/semantic-ux/','src/app/corpus-presentation/','tests/unit/lane-c/','tests/e2e/lane-c/','docs/parallel/lane-c/'])
export function launchContract(final){
 return seal({schemaVersion:'1.0.0',status:'PREPARED_NOT_SENT',interface:VERSION,interfaceIdentity:final.identity,reviewedStartCommit:BASE,reviewedStartTree:BASE_TREE,candidateBinding:'OUTER_DELIVERY_MANIFEST_EXACT_CANDIDATE_COMMIT_TREE_PARENT',interfaceFrozen:false,LaneCActive:false,packetsSent:false,transmission:'BLOCKED_UNTIL_MAIN_ACCEPTS_S3_AND_FREEZES_EXACT_IDENTITY',orientationBeforeActivation:true,charter:'ADDITIVE_ENDPOINT_INDEPENDENT_INVESTIGATION_SEMANTIC_UX_AND_CORPUS_PRESENTATION_ONLY',ownedPaths:[...OWNED_PATHS],prohibitions:['provider normalization','canonical truth','central reducers','source/account/credential access','historical merges','release state','interface changes','Lane A or Pixel integration','runtime provider calls'],knowledgeTransfer:'LANE_LOCAL_ONLY_NO_ROUTINE_MAIN_TRAFFIC_EXCEPT_SHARED_CONTRACT_CONFLICT_OR_AUTHORITY_BLOCKER'})
}
export function validateLaunch(x,final){if(canonical(x)!==canonical(launchContract(final)))throw Error('S3_LAUNCH_AUTHORITY_OWNERSHIP_BINDING');return true}
