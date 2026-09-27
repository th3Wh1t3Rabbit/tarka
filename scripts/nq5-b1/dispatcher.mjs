import { identity, validateSchema } from '../nq5/schema.mjs'
import { assertAccepted } from './authority.mjs'
import { projectResponse } from '../nq5/projection.mjs'
import { AUTH } from '../nq5/planner.mjs'
import { reconcile } from './reconcile.mjs'
import { diagnoseDurable } from '../nq5-b1-r1/diagnostic.mjs'

const numberHeader=(headers,name)=>{const value=headers[name];return typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null}
export function retryAfter(headers,now){const value=headers['retry-after'];if(value===undefined)return 0;const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return Math.ceil(seconds*1000);const date=Date.parse(value);if(!Number.isFinite(date))throw new Error('B1_RETRY_AFTER_INVALID');return Math.max(0,date-now)}
export class RateGate {
  constructor({now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),second=75,minute=1500}={}){this.now=now;this.sleep=sleep;this.localSecond=Math.min(20,second*0.8);this.localMinute=Math.min(1200,minute*0.8);this.stamps=[];this.allowances=new Map();this.pausedUntil=0;this.headerUpdates=0}
  get second(){const a=this.allowances.get('x-ratelimit-second-');return a&&a.until>this.now()&&a.limit!==null?Math.min(this.localSecond,a.limit):this.localSecond}
  get minute(){const a=this.allowances.get('x-ratelimit-minute-');return a&&a.until>this.now()&&a.limit!==null?Math.min(this.localMinute,a.limit):this.localMinute}
  headers(headers,status){
    const now=this.now()
    for(const [prefix,defaultDuration]of [['x-ratelimit-',null],['ratelimit-',null],['x-ratelimit-second-',1000],['x-ratelimit-minute-',60000]]){
      // Nansen's granular header suffix is Limit-Second, not Second-Limit.
      const suffix=prefix.includes('second')?'-second':prefix.includes('minute')?'-minute':''
      const base=suffix?'x-ratelimit-':prefix,limit=numberHeader(headers,base+'limit'+suffix),remaining=numberHeader(headers,base+'remaining'+suffix)
      if(limit!==null||remaining!==null){
        const reset=numberHeader(headers,base+'reset'+suffix)
        // Official resets are deltas, never epoch timestamps. A generic window
        // must have its own horizon; it cannot permanently become a minute cap.
        if(defaultDuration===null&&reset===null)throw new Error('B1_RATE_WINDOW_HORIZON_UNKNOWN')
        const duration=defaultDuration??Math.max(1,reset*1000),until=now+(reset===null?duration:Math.max(1,reset*1000))
        const prior=this.allowances.get(prefix)
        const safeLimit=limit===null?null:limit*0.8,safeRemaining=remaining===null?Math.floor(safeLimit??0):Math.floor(remaining*0.8)
        this.allowances.set(prefix,{remaining:prior&&prior.until>now?Math.min(prior.remaining,safeRemaining):safeRemaining,until:Math.max(now+1,prior?.until??0,until),duration,limit:safeLimit})
      }
    }
    if(status===429)this.pausedUntil=Math.max(this.pausedUntil,now+Math.max(1000,retryAfter(headers,now)))
    this.headerUpdates++
  }
  async acquire(stopped){
    const started=this.now()
    while(!stopped()){
      const now=this.now();this.stamps=this.stamps.filter(t=>now-t<60000)
      for(const [key,a]of this.allowances)if(a.until<=now)this.allowances.delete(key)
      let until=this.pausedUntil
      const seconds=this.stamps.filter(t=>now-t<1000)
      if(this.second<=0||this.minute<=0)throw new Error('B1_RATE_ZERO_ALLOWANCE')
      if(seconds.length>=Math.max(1,Math.floor(this.second)))until=Math.max(until,seconds[0]+Math.max(1000,1000/this.second))
      if(this.stamps.length>=Math.max(1,Math.floor(this.minute)))until=Math.max(until,this.stamps[0]+Math.max(60000,60000/this.minute))
      if(this.stamps.length)until=Math.max(until,this.stamps.at(-1)+1000/this.second)
      for(const allowance of this.allowances.values()){
        if(allowance.remaining<=0)until=Math.max(until,allowance.until)
        if(allowance.limit!==null){
          const inWindow=this.stamps.filter(t=>now-t<allowance.duration)
          if(inWindow.length>=Math.max(1,Math.floor(allowance.limit)))until=Math.max(until,inWindow[0]+allowance.duration)
          if(this.stamps.length)until=Math.max(until,this.stamps.at(-1)+allowance.duration/allowance.limit)
        }
      }
      if(until<=now){this.stamps.push(now);for(const a of this.allowances.values())a.remaining--;return true}
      if(now-started>60000 || until-now>60000)throw new Error('B1_RATE_WAIT_REQUIRES_REVIEW')
      await this.sleep(Math.min(100,until-now))
    }
    return false
  }
}

export function admitResponse(bound,request,raw,responseRow,sequence){
  const contract=bound.admission.contracts.find(c=>c.family===request.family)
  const response=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))
  validateSchema('provider',response,contract.responseSchema)
  const pagination=response.pagination
  if(pagination.page!==request.body.pagination.page || pagination.per_page!==request.body.pagination.per_page || typeof pagination.is_last_page!=='boolean'||response.data.length>pagination.per_page||(!pagination.is_last_page&&response.data.length===0))throw new Error('B1_PAGINATION_INCOMPATIBLE')
  const cell={id:request.coverageCells[0],fromUtc:request.body.date.from,toUtc:request.body.date.to,status:response.data.length?'COMPLETE':'EMPTY_COMPLETE',supportsNegative:false}
  // Page-complete is not whole-window-complete. More pages stay unresolved and
  // are never generated here. Empty page1 cannot pad the qualification count.
  const projection=projectResponse(contract,response,cell,'2023-03-13T12:15:00Z',raw)
  const counted=projection.rows.length>0
  const publicRecord=counted?{schema_version:'5.0.1',campaign_id:'NQ5',authorization_id:AUTH,public_call_id:`NQ5-${String(sequence).padStart(6,'0')}`,qualification_sequence:sequence,tranche_id:'T1',endpoint_family:request.family,business_question:request.businessQuestion,purpose_code:request.purpose,consumer_ids:request.consumers,request_body_sha256:identity(request.body),response_sha256:responseRow.rawSha256,normalized_sha256:projection.normalizedSha256,result_count:projection.rows.length,route_disposition:request.lens==='STATE'?'STATE_CORROBORATION':'BOUNDED_ACTIVITY',evidence_grade:request.lens==='STATE'?'CORROBORATING':'EXACT',temporal_class:'WITHIN_CUTOFF',coverage_scope:`${cell.fromUtc} through ${cell.toUtc}; PAGE.1 complete only, not all requested-window pages or chain history`,selection_lineage_summary:request.lineage,coverage_cell_ids:request.coverageCells,coverage_key:request.coverageKey,raw_payload_published:false,attribution:projection.attribution,investigative_question_id:request.questionId,question_lens:request.lens}:null
  if(publicRecord)validateSchema('public',publicRecord)
  return {disposition:counted?'SUCCESS_COUNTED':'SUCCESS_NOT_COUNTED',reason:counted?null:'EMPTY_PAGE_NOT_ADMITTED_AS_NEGATIVE_EVIDENCE',publicRecord,normalizedSha256:projection.normalizedSha256,normalizedRecords:projection.rows,pagination:{page:pagination.page,isLastPage:pagination.is_last_page},resultCount:projection.rows.length}
}

export class Dispatcher {
  constructor({bound,store,transport,rate=new RateGate(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now,random=Math.random,signal}){
    assertAccepted(bound)
    if(store.envelope.hash!==bound.envelope.hash||store.rows.length)throw new Error('B1_EXECUTION_BASELINE')
    Object.assign(this,{bound,store,transport,rate,sleep,now,random,signal})
    this.stopReason=null;this.started=new Set();this.attempts=new Map();this.totalAttempts=0;this.credits=0;this.remainingCredits=bound.plan.availableCredits;this.reservedCredits=0;this.inFlight=0;this.maxInFlight=0;this.completed=new Map();this.commitRank=0;this.counted=0;this.latencies=[];this.writerStopped=false;this.running=false
    this.onAbort=()=>this.stop('B1_CANCELLED');signal?.addEventListener('abort',this.onAbort,{once:true})
  }
  stop(reason){this.stopReason??=reason}
  flush(){
    if(this.writerStopped)return
    while(this.commitRank<this.bound.envelope.executionOrder.length){
      const id=this.bound.envelope.executionOrder[this.commitRank],result=this.completed.get(id)
      if(!result)break
      try{
        if(result.responseRow&&result.responseRow.httpStatus>=200&&result.responseRow.httpStatus<300&&(!result.failure||result.failure==='EMPTY_PAGE_NOT_ADMITTED_AS_NEGATIVE_EVIDENCE')){
          const request=this.bound.plan.requests.find(r=>r.logicalId===id)
          const projection=admitResponse(this.bound,request,this.store.raw(result.responseRow),result.responseRow,this.counted+1)
          result.terminal={...projection};delete result.terminal.normalizedRecords
        }else result.terminal={disposition:'TERMINAL_FAILURE',reason:result.failure??'B1_HTTP_TERMINAL',publicRecord:null}
      }catch{
        const request=this.bound.plan.requests.find(r=>r.logicalId===id)
        result.diagnostic=diagnoseDurable(this.bound,request,this.store,result.responseRow,this.counted+1)
        if(result.diagnostic.firstFailedStage==='durableStorage'){this.writerStopped=true;this.stop('B1_DURABLE_RAW_READ_FAILED');return}
        const code='R1_'+(result.diagnostic.firstFailedStage??'unexpected').toUpperCase()+'_'+(result.diagnostic.stages[result.diagnostic.firstFailedStage]?.code??'UNEXPECTED_VALIDATION_FAILURE')
        result.terminal={disposition:'SUCCESS_NOT_COUNTED',reason:code,publicRecord:null};this.stop(code)
      }
      if(result.diagnostic)result.terminal.validationDiagnostics=result.diagnostic
      if(result.terminal.disposition!=='SUCCESS_COUNTED')this.stop(result.terminal.reason??'B1_TERMINAL_FAILURE')
      try{this.store.append({kind:'TERMINAL',logicalId:id,attempt:result.attempt,...result.terminal})}catch{this.writerStopped=true;this.stop('B1_LEDGER_STORAGE_FAILED');return}
      if(result.terminal.disposition==='SUCCESS_COUNTED')this.counted++
      this.commitRank++
    }
  }
  async issue(request){
    const id=request.logicalId
    const acceptedRequest=this.bound.plan.requests.find(r=>r.logicalId===id)
    if(!acceptedRequest||identity(acceptedRequest)!==identity(request)||!this.bound.envelope.executionOrder.includes(id)||this.started.has(id))throw new Error('B1_REPEATED_OR_UNAUTHORIZED_ID')
    this.started.add(id);let result={attempt:0,responseRow:null,failure:null}
    for(let attempt=1;attempt<=3;attempt++){
      try{
        if(!await this.rate.acquire(()=>!!this.stopReason||this.signal?.aborted))break
        // Synchronous reservation + durable START is a single issue boundary.
        // Each outstanding attempt reserves one credit, independent of retries.
        if(this.stopReason||this.signal?.aborted)break
        if(this.totalAttempts>=45||this.credits+this.reservedCredits+1>45||this.remainingCredits-this.reservedCredits-1<250||this.inFlight>=8)throw new Error('B1_CAPACITY_OR_RESERVE_RISK')
        this.totalAttempts++;this.reservedCredits++;this.attempts.set(id,attempt);result.attempt=attempt
        this.store.append({kind:'START',logicalId:id,attempt,requestBodySha256:identity(request.body),issuedAtUtc:new Date(this.now()).toISOString(),reservedCredits:1})
        this.inFlight++;this.maxInFlight=Math.max(this.maxInFlight,this.inFlight)
        const began=this.now();let received
        try{received=await this.transport(request,{connectTimeoutMs:5000,totalTimeoutMs:this.timeout()})}catch{result.failure='B1_TRANSPORT_TIMEOUT_OR_INDETERMINATE';this.stop(result.failure);break}finally{this.inFlight--}
        this.latencies.push(Math.max(0,this.now()-began))
        if(!received||!Buffer.isBuffer(received.bytes)||!Number.isInteger(received.status)||!received.headers)throw new Error('B1_TRANSPORT_SHAPE')
        const storage=this.store.persist(id,attempt,received.bytes)
        const headers=received.headers,quotedCost=numberHeader(headers,'x-nansen-credits-cost'),cost=numberHeader(headers,'x-nansen-credits-used'),remaining=numberHeader(headers,'x-nansen-credits-remaining')
        const row=this.store.append({kind:'RESPONSE',logicalId:id,attempt,httpStatus:received.status,quotedCredits:quotedCost,actualCredits:cost,remainingCredits:remaining,headers,...storage,latencyMs:this.latencies.at(-1),completedAtUtc:new Date(this.now()).toISOString(),providerRequestId:headers['x-request-id']??null})
        result.responseRow=row
        if(cost!==null){this.reservedCredits--;this.credits+=cost}
        if(remaining!==null)this.remainingCredits=Math.min(this.remainingCredits,remaining)
        this.rate.headers(headers,received.status)
        if(quotedCost===null||quotedCost>1||cost===null||remaining===null||cost>1||(received.status>=200&&received.status<300&&quotedCost!==1)||this.credits+this.reservedCredits>45){result.failure='B1_CREDIT_UNKNOWN_OR_UNEXPECTED';this.stop(result.failure);break}
        if(this.remainingCredits-this.reservedCredits<250){result.failure='B1_RESERVE_RISK';this.stop(result.failure);break}
        if([401,402,403].includes(received.status)){result.failure='B1_AUTH_PERMISSION_PAYMENT';this.stop(result.failure);break}
        if(received.status>=200&&received.status<300){
          try{const preflight=admitResponse(this.bound,request,this.store.raw(row),row,1);if(preflight.disposition!=='SUCCESS_COUNTED'){result.failure=preflight.reason;this.stop(result.failure)}}catch{
            result.diagnostic=diagnoseDurable(this.bound,request,this.store,row,1)
            if(result.diagnostic.firstFailedStage==='durableStorage')this.writerStopped=true
            result.failure='R1_'+(result.diagnostic.firstFailedStage??'unexpected').toUpperCase()+'_'+(result.diagnostic.stages[result.diagnostic.firstFailedStage]?.code??'UNEXPECTED_VALIDATION_FAILURE');this.stop(result.failure)
          }
          break
        }
        if(!this.bound.envelope.retryStatuses.includes(received.status)||attempt===3){result.failure='B1_HTTP_TERMINAL';this.stop(result.failure);break}
        const wait=Math.max(retryAfter(headers,this.now()),Math.floor(this.random()*1000*2**(attempt-1)))
        if(wait>60000){result.failure='B1_RETRY_WAIT_REQUIRES_REVIEW';this.stop(result.failure);break}
        let remainingWait=wait
        while(remainingWait>0&&!this.stopReason&&!this.signal?.aborted){const interval=Math.min(100,remainingWait);await this.sleep(interval);remainingWait-=interval}
      }catch{result.failure='B1_STORAGE_RATE_OR_RESERVATION';this.stop(result.failure);break}
    }
    if(result.attempt){if(!result.responseRow&&!result.failure)result.failure='B1_UNRESOLVED_ATTEMPT';this.completed.set(id,result);this.flush()}
  }
  timeout(){const sorted=[...this.latencies].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*0.95)-1]??0;return Math.min(60000,Math.max(30000,p95*2))}
  async group(ids,concurrency){
    let cursor=0
    const worker=async()=>{while(!this.stopReason&&!this.signal?.aborted&&cursor<ids.length){const id=ids[cursor++];await this.issue(this.bound.plan.requests.find(r=>r.logicalId===id))}}
    await Promise.all(Array.from({length:Math.min(concurrency,ids.length)},worker));this.flush()
  }
  async run(){
    if(this.running||this.started.size)throw new Error('B1_INVOCATION_CANNOT_REPEAT');this.running=true
    try{
      if(this.signal?.aborted)this.stop('B1_CANCELLED')
      const order=this.bound.envelope.executionOrder
      await this.group(order.slice(0,4),2)
      const canary=this.store.rows.filter(r=>r.kind==='TERMINAL')
      let canaryReconciled=false
      if(!this.stopReason){try{const proof=reconcile(this.bound,this.store.roots);canaryReconciled=proof.report.clean&&proof.report.countedSuccesses===4&&proof.report.durableTerminals===4}catch{this.stop('B1_CANARY_DURABLE_RECONCILIATION_FAILED')}}
      if(!this.stopReason&&canaryReconciled&&canary.length===4&&canary.every(r=>r.disposition==='SUCCESS_COUNTED')&&this.reservedCredits===0){
        // Deliberate durable ramp barriers, never speculative parallel batches.
        await this.group(order.slice(4,6),2)
        if(!this.stopReason)await this.group(order.slice(6,10),4)
        if(!this.stopReason)await this.group(order.slice(10),8)
      }else this.stop(this.stopReason??'B1_CANARY_RECONCILIATION_FAILED')
      return {stopReason:this.stopReason,totalAttempts:this.totalAttempts,counted:this.counted,actualCredits:this.credits,unresolvedCreditReservations:this.reservedCredits,maxInFlight:this.maxInFlight}
    }finally{this.signal?.removeEventListener('abort',this.onAbort)}
  }
}
