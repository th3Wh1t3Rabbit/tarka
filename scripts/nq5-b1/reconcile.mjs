import { identity } from '../nq5/schema.mjs'
import { assertAccepted } from './authority.mjs'
import { admitResponse } from './dispatcher.mjs'
import { replay, readMirrored } from './store.mjs'
import { rejectUnsafePublicProjection } from '../nq5-r3/contracts.mjs'

export function blockedReconciliation(bound,reason){
  assertAccepted(bound)
  const report={schemaVersion:'1.0.0',campaignId:bound.envelope.campaignId,envelopeHash:bound.envelope.hash,reconstructedFromPrivateLedgerAndDualRawOnly:false,reconstructionStatus:'NOT_VERIFIED_FAIL_CLOSED',blocker:reason,attempts:null,uniqueIssuedLogicalRequests:null,provider2xx:null,countedSuccesses:null,retries:null,durableLocalReuse:0,knownActualCredits:null,actualCredits:null,unknownCreditAttempts:null,unresolvedReservations:null,durableTerminals:null,terminalFailures:null,remainingCredits:null,primaryMirrorLedgerBytesEqual:false,rawFilesVerified:0,ledgerSha256:null,ledgerBytes:null,orderedTerminalCommitsVerified:false,priorDiscovery:{attempts:32,credits:37},historicalAccount:{attemptsConsumed:1,additionalAttempts:0,credits:0},protectedReserve:250,clean:false}
  return {report,utility:{status:'NOT_VERIFIED',blocker:reason,batch2Generated:false,qualificationFloorReached:false},publicIndex:{schemaVersion:'1.0.0',campaignId:bound.envelope.campaignId,envelopeHash:bound.envelope.hash,records:[],exportDisposition:'NO_COUNTED_ROWS_EXPORTED_WHILE_RECONCILIATION_UNVERIFIED'},rates:{status:'NOT_VERIFIED',blocker:reason},identityMatrix:bound.plan.requests.map(r=>({logicalId:r.logicalId,family:r.family,requestBodySha256:identity(r.body),disposition:'NOT_VERIFIED'}))}
}

export function reconcile(bound,roots){
  assertAccepted(bound);const state=replay(roots,bound.envelope),publicRows=[],normalized=[]
  let credits=0,unknownCreditAttempts=0,provider2xx=0,remaining=bound.plan.availableCredits
  const unresolved=[]
  for(const [key,start]of state.starts){
    const request=bound.plan.requests.find(r=>r.logicalId===start.logicalId)
    if(start.requestBodySha256!==identity(request.body)||start.reservedCredits!==1)throw new Error('B1_RECONCILE_START_IDENTITY')
    const response=state.responses.get(key)
    if(!response){unresolved.push(key);unknownCreditAttempts++;continue}
    if(response.httpStatus>=200&&response.httpStatus<300)provider2xx++
    if(response.actualCredits===null)unknownCreditAttempts++;else credits+=response.actualCredits
    if(response.remainingCredits!==null)remaining=Math.min(remaining,response.remainingCredits)
    if(response.actualCredits!==null&&String(response.actualCredits)!==response.headers['x-nansen-credits-used'])throw new Error('B1_RECONCILE_ACTUAL_DEDUCTION')
    if(response.quotedCredits!==null&&String(response.quotedCredits)!==response.headers['x-nansen-credits-cost'])throw new Error('B1_RECONCILE_QUOTED_PRICE')
  }
  const utility={endpointFamilies:{},questionLenses:{ACTIVITY:0,RELATIONSHIPS:0,STATE:0,RECEIPT:0},coverageCells:[],namedConsumers:[],admittedNewSubjects:[],queriedAdmittedSeedSubjects:[],paginationFrontiers:[],closedCells:[],unresolvedGaps:[],emptyResults:0}
  for(const request of bound.plan.requests){
    const terminal=state.terminals.get(request.logicalId)
    if(!terminal){utility.unresolvedGaps.push({logicalId:request.logicalId,reason:state.starts.has(request.logicalId+'.1')?'NO_DURABLE_TERMINAL':'NOT_ISSUED'});continue}
    const response=state.responses.get(request.logicalId+'.'+terminal.attempt)
    if(terminal.disposition==='SUCCESS_COUNTED'){
      if(!response||![0,1].includes(response.actualCredits)||response.quotedCredits!==1||response.httpStatus<200||response.httpStatus>=300||response.remainingCredits===null)throw new Error('B1_RECONCILE_COUNT_CREDIT_STATUS')
      const raw=readMirrored(roots,'raw-b1/'+response.rawName)
      const projection=admitResponse(bound,request,raw,response,terminal.publicRecord.qualification_sequence)
      if(projection.disposition!=='SUCCESS_COUNTED'||identity(projection.publicRecord)!==identity(terminal.publicRecord)||projection.normalizedSha256!==terminal.normalizedSha256||identity(projection.pagination)!==identity(terminal.pagination))throw new Error('B1_RECONCILE_PUBLIC_PROJECTION')
      for(const row of projection.normalizedRecords)rejectUnsafePublicProjection(request.family,row)
      publicRows.push(projection.publicRecord);normalized.push(...projection.normalizedRecords)
      utility.endpointFamilies[request.family]=(utility.endpointFamilies[request.family]??0)+projection.resultCount
      utility.questionLenses[request.lens]+=projection.resultCount
      utility.coverageCells.push(...request.coverageCells);utility.namedConsumers.push(...request.consumers);utility.queriedAdmittedSeedSubjects.push(request.body.address)
      if(projection.pagination.isLastPage)utility.closedCells.push(...request.coverageCells)
      else{utility.paginationFrontiers.push({logicalId:request.logicalId,page:1,explicitMore:true,generatedNextPage:false});utility.unresolvedGaps.push({logicalId:request.logicalId,reason:'WINDOW_NOT_COMPLETE_MORE_PAGES_UNAUTHORIZED'})}
    }else{
      if(terminal.reason==='EMPTY_PAGE_NOT_ADMITTED_AS_NEGATIVE_EVIDENCE')utility.emptyResults++
      utility.unresolvedGaps.push({logicalId:request.logicalId,reason:terminal.reason??terminal.disposition})
    }
  }
  publicRows.sort((a,b)=>a.qualification_sequence-b.qualification_sequence)
  const unique=new Set(normalized.map(identity)).size,attempts=state.starts.size,counted=publicRows.length,terminalFailures=[...state.terminals.values()].filter(t=>t.disposition!=='SUCCESS_COUNTED').length
  const report={schemaVersion:'1.0.0',campaignId:bound.envelope.campaignId,envelopeHash:bound.envelope.hash,reconstructedFromPrivateLedgerAndDualRawOnly:true,attempts,uniqueIssuedLogicalRequests:new Set([...state.starts.values()].map(s=>s.logicalId)).size,provider2xx,countedSuccesses:counted,retries:attempts-new Set([...state.starts.values()].map(s=>s.logicalId)).size,durableLocalReuse:0,noncounted2xx:provider2xx-counted,knownActualCredits:credits,actualCredits:unknownCreditAttempts?null:credits,actualCreditSource:'X-Nansen-Credits-Used; Cost is quoted price only',unknownCreditAttempts,unresolvedReservations:unknownCreditAttempts,missingDurableResponses:unresolved.length,durableTerminals:state.terminals.size,terminalFailures,remainingCredits:remaining,primaryMirrorLedgerBytesEqual:true,rawFilesVerified:state.responses.size,ledgerSha256:state.bytesSha256,ledgerBytes:state.bytes,orderedTerminalCommitsVerified:true,duplicateOrReuseCountInflation:false,priorDiscovery:{attempts:32,credits:37},historicalAccount:{attemptsConsumed:1,additionalAttempts:0,credits:0},protectedReserve:250,clean:!unknownCreditAttempts&&!unresolved.length&&!terminalFailures&&state.terminals.size===new Set([...state.starts.values()].map(s=>s.logicalId)).size&&credits<=45&&attempts<=45&&remaining>=250}
  const utilityReport={schemaVersion:'1.0.0',...utility,coverageCells:[...new Set(utility.coverageCells)],namedConsumers:[...new Set(utility.namedConsumers)],queriedAdmittedSeedSubjects:[...new Set(utility.queriedAdmittedSeedSubjects)],newSubjectsAdmissionDisposition:'NONE_AUTHORIZED_OR_PROMOTED_IN_B1',closedCells:[...new Set(utility.closedCells)],uniqueNormalizedRecords:unique,normalizedRecordCount:normalized.length,duplicateRatio:normalized.length?(normalized.length-unique)/normalized.length:0,emptyRatio:state.terminals.size?utility.emptyResults/state.terminals.size:0,recordsPerCredit:unknownCreditAttempts?null:credits?unique/credits:null,recordsPerCreditDisposition:unknownCreditAttempts?'INDETERMINATE_ACTUAL_SPEND':credits?'UNIQUE_RECORDS_PER_KNOWN_ACTUAL_CREDIT':'UNDEFINED_ZERO_ACTUAL_CREDIT_DENOMINATOR',actualCreditsKnown:unknownCreditAttempts===0,batch2Generated:false,qualificationFloorReached:false,consumerEnablementClaim:normalized.length?'Evidence available for named consumers, not integrated gameplay acceptance':'NO_ADMITTED_GAMEPLAY_EVIDENCE_FROM_B1_V1',engineeringValidationValue:state.responses.size?'AUTHENTICATED_TRANSPORT_DURABLE_STORAGE_BILLING_AND_VALIDATION_OBSERVATION':'NONE'}
  const rates={schemaVersion:'1.0.0',attempts,latenciesMs:[...state.responses.values()].map(r=>r.latencyMs),startTimesUtc:[...state.starts.values()].map(r=>r.issuedAtUtc),headerObservations:[...state.responses.values()].map(r=>({logicalId:r.logicalId,attempt:r.attempt,status:r.httpStatus,numericRateAllowances:Object.fromEntries(Object.entries(r.headers).filter(([k,v])=>/^(?:x-)?ratelimit-/.test(k)&&/^\d+$/.test(v)).map(([k,v])=>[k,Number(v)])),scopeDisposition:r.headers['x-nansen-ratelimit-scope']?'GENERIC_SCOPE_HANDLING':'NO_SCOPE_HEADER',retryAfterPresent:r.headers['retry-after']!==undefined})),localCeilings:{second:20,minute:1200,inFlight:8},canaryConcurrency:2,postCanaryRamp:[2,4,8]}
  return {report,utility:utilityReport,publicIndex:{schemaVersion:'1.0.0',campaignId:bound.envelope.campaignId,envelopeHash:bound.envelope.hash,records:publicRows},rates,identityMatrix:bound.plan.requests.map(r=>({logicalId:r.logicalId,family:r.family,requestBodySha256:identity(r.body),questionLens:r.lens,coverageCells:r.coverageCells,consumers:r.consumers,issued:state.starts.has(r.logicalId+'.1'),attempts:[...state.starts.values()].filter(s=>s.logicalId===r.logicalId).length,disposition:state.terminals.get(r.logicalId)?.disposition??'NOT_ISSUED_OR_UNRESOLVED'}))}
}
