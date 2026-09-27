import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest'
import { bindAccepted, PINS, CONTRACT_SHA } from '../../scripts/nq5-b1/authority.mjs'
import { BatchStore, replay, readMirrored } from '../../scripts/nq5-b1/store.mjs'
import { Dispatcher, RateGate, retryAfter, admitResponse } from '../../scripts/nq5-b1/dispatcher.mjs'
import { reconcile, blockedReconciliation } from '../../scripts/nq5-b1/reconcile.mjs'
import { createLiveTransport, admitPrivateBaseline, verifyLocalEvidence, LOCAL_SUITES, assertVerificationCut } from '../../scripts/nq5-b1/live.mjs'
import { REVIEW_LENSES } from '../../scripts/nq5-r2/review-identity.mjs'
import { validateDocs, PAGES } from '../../scripts/nq5-b1/docs.mjs'
import { identity, sha } from '../../scripts/nq5/schema.mjs'
import { admitContract } from '../../scripts/nq5/planner.mjs'
import { hasSecretLikeValue } from '../../scripts/secret-patterns.mjs'

const root=fileURLToPath(new URL('../..',import.meta.url)),directories=[]
let bound,accepted
// Historical immutable admission fixtures are evaluated at their valid time.
// Only Date is fixed; production freshness and real scheduler timers remain intact.
beforeAll(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-17T12:00:00Z'));accepted=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/nq5-b1-accepted-public.json')));bound=bindAccepted(accepted)},30000)
afterAll(()=>vi.useRealTimers())
describe('Historical fixture clock does not waive production freshness',()=>{
  it('accepts valid historical admission and still rejects beyond 24 hours',()=>{
    const c=bound.admission.contracts[0],retrieved=Date.parse(c.retrievedAtUtc)
    try{
      vi.setSystemTime(new Date(retrieved+60000));expect(()=>admitContract(c)).not.toThrow()
      vi.setSystemTime(new Date(retrieved+86400001));expect(()=>admitContract(c)).toThrow('Stale plan-specific contract.')
      vi.setSystemTime(new Date(retrieved-1));expect(()=>admitContract(c)).toThrow('Stale plan-specific contract.')
    }finally{vi.setSystemTime(new Date('2026-09-17T12:00:00Z'))}
  })
})
afterEach(()=>{for(const directory of directories.splice(0))fs.rmSync(directory,{recursive:true,force:true})})
function baseline(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trace-b1-synthetic-'));directories.push(dir)
  const roots=['primary','mirror'].map(name=>{const location=path.join(dir,name);fs.mkdirSync(location,{mode:0o700});for(const file of ['GENESIS_COMMIT.json','genesis.json','qualification.jsonl'])fs.writeFileSync(path.join(location,file),'',{mode:0o600});return location})
  return roots
}
const headers=(cost=1,remaining=630026)=>({'x-nansen-credits-cost':String(cost),'x-nansen-credits-remaining':String(remaining),'x-nansen-credits-used':String(cost)})
function response(request,{empty=false,pagination={},row={}}={}){
  const address='0x'+'1'.repeat(40),timestamp=request.body.date.from
  const record=request.family.endsWith('historical-balances')?{chain:'ethereum',block_timestamp:timestamp,token_symbol:'TEST',token_address:address,token_amount:2,...row}:{chain:'ethereum',method:'transfer',source_type:'SYNTHETIC',block_timestamp:timestamp,transaction_hash:'0x'+'2'.repeat(64),tokens_sent:[{chain:'ethereum',token_symbol:'TEST',token_amount:2,token_address:address,from_address:address,to_address:'0x'+'3'.repeat(40),from_address_label:'PRIVATE_SYNTHETIC_LABEL'}],tokens_received:[],...row}
  return {status:200,headers:headers(),bytes:Buffer.from(JSON.stringify({pagination:{page:1,per_page:100,is_last_page:true,...pagination},data:empty?[]:[record]}))}
}
function clock(){let t=Date.now();return {now:()=>t,sleep:async ms=>{t+=ms},advance:ms=>{t+=ms}}}
function executor(transport,options={}){const roots=baseline(),store=new BatchStore(roots,bound.envelope),time=clock(),rate=new RateGate(time);return {roots,store,time,dispatcher:new Dispatcher({bound,store,transport,rate,...time,...options})}}
function docs(){
  const bodies=Object.fromEntries(Object.keys(PAGES).map(name=>[name,fs.readFileSync(path.join(root,'docs/official/r3',name+'.md'))]))
  const index={snapshots:Object.entries(bodies).map(([name,bytes])=>({name,url:'https://docs.nansen.ai'+PAGES[name],httpStatus:200,status:'FETCHED',retrievedAtUtc:new Date().toISOString(),bodySha256:sha(bytes),bytes:bytes.length}))}
  return {bodies,index}
}
describe('B1 no-credential scoped authority',()=>{
  it('excludes synthetic separate-lane objects before historyscan, but still detects governedsecrets',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trace-b1-synthetic-git-'));directories.push(dir)
    const env=Object.fromEntries(['PATH','HOME','USER','LOGNAME','LANG','LC_ALL'].flatMap(n=>process.env[n]===undefined?[]:[[n,process.env[n]]]))
    const git=(...args)=>execFileSync('git',args,{cwd:dir,env,stdio:'pipe'})
    git('init','--quiet');git('config','user.name','Synthetic B1');git('config','user.email','synthetic@example.invalid')
    const sentinel=['API','KEY'].join('_')+'='+['SYNTHETIC','NOT','REAL','SENTINEL'].join('_')
    for(const name of ['ART_PRODUCTION','.cursor']){fs.mkdirSync(path.join(dir,name));fs.writeFileSync(path.join(dir,name,'sentinel.bin'),sentinel)}
    fs.writeFileSync(path.join(dir,'governed.md'),'safe synthetic source');git('add','.');git('commit','--quiet','-m','synthetic source')
    const scan=()=>spawnSync(process.execPath,[path.join(root,'scripts/verify-git-secret-history.mjs')],{cwd:dir,env,encoding:'utf8'})
    expect(scan().status).toBe(0)
    fs.writeFileSync(path.join(dir,'governed.md'),sentinel);git('add','governed.md');git('commit','--quiet','-m','synthetic failure control')
    const result=scan();expect(result.status).toBe(1);expect(result.stderr).toContain('governed.md');expect(result.stderr).not.toContain('sentinel.bin')
  })
  it('exempts only the exact public B1 checkpointstatus, never assignment variants or appendedtokens',()=>{
    const line='r3_final_precall_'+'authorization: '+['ACCEPTED','BY','RECORDED','B1','LEAD','CONTRACT'].join('_')
    expect(hasSecretLikeValue(line)).toBe(false);expect(hasSecretLikeValue('+ '+line)).toBe(true)
    expect(hasSecretLikeValue(line+'_'+'UNAPPROVED')).toBe(true);expect(hasSecretLikeValue(line+' '+['UNAPPROVED','TOKEN'].join('_'))).toBe(true)
    expect(hasSecretLikeValue(line.replace('r3_final_precall_','other_'))).toBe(true)
    expect(hasSecretLikeValue('API'+'_'+'KEY='+['SYNTHETIC','NOT','REAL','ASSIGNMENT'].join('_'))).toBe(true)
    expect(hasSecretLikeValue('authorization: '+'bearer '+['SYNTHETIC','NOT','REAL','TOKEN'].join('_'))).toBe(true)
  })
  it('pins every accepted artifact, identity and deterministic two-per-family canary',()=>{
    expect(bound.plan.requests).toHaveLength(15);expect(bound.reserve.requests).toHaveLength(0)
    expect(bound.envelope.executionContractSha256).toBe(CONTRACT_SHA)
    expect(bound.envelope.canaryIds).toHaveLength(4)
    for(const family of bound.admission.contracts.map(c=>c.family))expect(bound.envelope.canaryIds.filter(id=>bound.plan.requests.find(r=>r.logicalId===id).family===family)).toHaveLength(2)
    expect(new Set(bound.envelope.executionOrder).size).toBe(15)
  })
  it.each(Object.keys(PINS))('rejects altered accepted bytes: %s',name=>{expect(()=>bindAccepted({...accepted,[name]:accepted[name]+' '})).toThrow()})
  it('rejects missing, extra and invented admission inventory',()=>{const copy={...accepted};delete copy['PLANS/T1_PLAN.json'];expect(()=>bindAccepted(copy)).toThrow();expect(()=>bindAccepted({...accepted,extra:'{}'})).toThrow()})
  it('cannot reach credential or real private baseline without branded local gates',()=>{expect(()=>createLiveTransport({})).toThrow('B1_RUNTIME_CREDENTIAL_GATE_REQUIRED');expect(()=>admitPrivateBaseline({},{})).toThrow('B1_LOCAL_PROOF_REQUIRED')})
  it.each(LOCAL_SUITES)('requires durable execution evidence for every phase1 suite: %s',name=>{
    const candidate={commit:'synthetic',tree:'synthetic'},digest='synthetic',logs=Object.fromEntries(LOCAL_SUITES.map(n=>[n,Buffer.from(n+':PASS synthetic')])),review={schemaVersion:'1.0.0',implementationSha256:digest,unresolvedAcceptedP0P1:0,status:'PASS_BOUNDED_NO_CREDENTIAL_SCOPE',lenses:REVIEW_LENSES.map(n=>({name:n,status:'PASS_BOUNDED_SCOPE'}))}
    const verification={schemaVersion:'1.0.0',status:'PASS',implementationSha256:digest,generatedAtUtc:new Date().toISOString(),candidate,governedSourceCommitted:true,credentialAccess:false,actualPrivateBaselineAccess:false,providerCalls:0,documentationGets:0,networkHold:true,suites:LOCAL_SUITES.map(n=>({name:n,status:'PASS',sha256:sha(logs[n])}))}
    expect(()=>verifyLocalEvidence(review,verification,logs,digest,candidate)).not.toThrow()
    expect(()=>verifyLocalEvidence(review,{...verification,suites:verification.suites.filter(s=>s.name!==name)},logs,digest,candidate)).toThrow()
    expect(()=>verifyLocalEvidence(review,verification,{...logs,[name]:Buffer.from('corrupted')},digest,candidate)).toThrow()
    expect(()=>verifyLocalEvidence(review,{...verification,governedSourceCommitted:false},logs,digest,candidate)).toThrow()
    expect(()=>verifyLocalEvidence(review,verification,logs,digest,{...candidate,commit:'different'})).toThrow()
    for(const [key,value]of Object.entries({schemaVersion:'wrong',networkHold:false,credentialAccess:true,actualPrivateBaselineAccess:true,providerCalls:1,documentationGets:1}))expect(()=>verifyLocalEvidence(review,{...verification,[key]:value},logs,digest,candidate)).toThrow()
    expect(()=>verifyLocalEvidence(review,{...verification,suites:[...verification.suites.slice(1),verification.suites[1]]},logs,digest,candidate)).toThrow()
  })
  it('rejects changed code or candidate during/after verification rather than rebinding stale suites',()=>{const start={candidate:{commit:'old',tree:'old'},implementationSha256:'old',governedSourceCommitted:true};expect(()=>assertVerificationCut(start,structuredClone(start))).not.toThrow();expect(()=>assertVerificationCut(start,{...start,implementationSha256:'new'})).toThrow();expect(()=>assertVerificationCut(start,{...start,candidate:{commit:'new',tree:'new'}})).toThrow();expect(()=>assertVerificationCut(start,{...start,governedSourceCommitted:false})).toThrow()})
  it('never invents zero successes or credits after reconstruction failure',()=>{const failed=blockedReconciliation(bound,'B1_SYNTHETIC_BLOCKER');expect(failed.report.actualCredits).toBeNull();expect(failed.report.countedSuccesses).toBeNull();expect(failed.report.clean).toBe(false);expect(failed.publicIndex.records).toHaveLength(0)})
  it('rejects changed creditheader meaning before credential resolution',()=>{const d=docs();let text=d.bodies.transactions.toString().replace('Credits actually deducted for this request.','Quoted cost, not actual deduction.');expect(text).not.toBe(d.bodies.transactions.toString());d.bodies.transactions=Buffer.from(text);const row=d.index.snapshots.find(s=>s.name==='transactions');row.bodySha256=sha(d.bodies.transactions);row.bytes=d.bodies.transactions.length;expect(()=>validateDocs(bound,d.index,d.bodies)).toThrow('B1_DOC_CREDIT_HEADER_SEMANTICS_CHANGED')})
  it('has independent scheduler authority without changing inherited contracts',()=>{expect(bound.plan.contracts.every(c=>c.concurrency===1&&c.requestsPerMinute===200&&c.minimumDelayMs===250)).toBe(true);expect(bound.envelope.maximumInFlight).toBe(8)})
  it('admits the exact six current endpoint, schema, pricing and policy documents',()=>{const d=docs();expect(validateDocs(bound,d.index,d.bodies).officialMinute).toBe(1500)})
  it.each(['endpoint','price','rate','coverage','redistribution','pagination','status','provenance'])('fails changed documentation before any credential: %s',kind=>{
    const d=docs(),name=kind==='price'?'pricing':kind==='rate'?'rate-limits':kind==='coverage'?'coverage':kind==='redistribution'?'redistribution':'transactions'
    if(kind==='status')d.index.snapshots[0].httpStatus=302
    else if(kind==='provenance')d.index.snapshots[0].url+='?ask=forbidden'
    else {
      let body=d.bodies[name].toString()
      if(kind==='endpoint')body=body.replaceAll('/api/v1/profiler/address/transactions','/api/v1/forbidden')
      if(kind==='price')body=body.replaceAll('profiler/address/transactions','removed/family')
      if(kind==='rate')body=body.replaceAll('1,500 requests','1,000 requests')
      if(kind==='coverage')body=body.replaceAll('30 Jul 2015','31 Jul 2015')
      if(kind==='redistribution')body=body.replaceAll('Powered by Nansen API','attribution removed')
      if(kind==='pagination')body=body.replaceAll('is_last_page','different_field')
      d.bodies[name]=Buffer.from(body);const row=d.index.snapshots.find(s=>s.name===name);row.bodySha256=sha(d.bodies[name]);row.bytes=d.bodies[name].length
    }
    expect(()=>validateDocs(bound,d.index,d.bodies)).toThrow()
  })
})
describe('B1 strict durable mirrored storage',()=>{
  it('takes exclusive locks and forbids repeated invocation or duplicate equivalent issue',async()=>{
    const x=executor(async request=>response(request)),request=bound.plan.requests.find(r=>r.logicalId===bound.envelope.executionOrder[0])
    expect(()=>new BatchStore(x.roots,bound.envelope)).toThrow()
    await x.dispatcher.issue(request);await expect(x.dispatcher.issue(request)).rejects.toThrow('B1_REPEATED_OR_UNAUTHORIZED_ID')
    await expect(x.dispatcher.issue({...request,body:structuredClone(request.body)})).rejects.toThrow()
    expect(x.dispatcher.totalAttempts).toBe(1)
  })
  it('refuses unauthorized ID and arbitrary bodies at the production transport gate',async()=>{const x=executor(async request=>response(request));await expect(x.dispatcher.issue({...bound.plan.requests[0],logicalId:'a'.repeat(64)})).rejects.toThrow();expect(x.dispatcher.totalAttempts).toBe(0)})
  it('never repairs a crash tail or divergent journals',()=>{
    const roots=baseline();for(const root of roots)fs.appendFileSync(path.join(root,'qualification.jsonl'),'{"partial":')
    const before=roots.map(root=>fs.readFileSync(path.join(root,'qualification.jsonl')))
    expect(()=>new BatchStore(roots,bound.envelope)).toThrow('B1_CRASH_TAIL_NO_REPAIR')
    expect(roots.map(root=>fs.readFileSync(path.join(root,'qualification.jsonl')))).toEqual(before)
  })
  it('rejects mirror disagreement and unsafe permissions',()=>{const roots=baseline();fs.writeFileSync(path.join(roots[1],'qualification.jsonl'),'x');expect(()=>replay(roots,bound.envelope)).toThrow('B1_MIRROR_MISMATCH');fs.writeFileSync(path.join(roots[1],'qualification.jsonl'),'');fs.chmodSync(path.join(roots[0],'qualification.jsonl'),0o644);expect(()=>replay(roots,bound.envelope)).toThrow('B1_PRIVATE_METADATA')})
  it('rejects symlinked or hardlinked private raw/journal files',()=>{const roots=baseline();const source=path.join(roots[0],'qualification.jsonl');fs.linkSync(source,path.join(roots[0],'alias'));expect(()=>replay(roots,bound.envelope)).toThrow('B1_PRIVATE_METADATA')})
  it('persists and fsyncs START before issue and dual raw before validation',async()=>{
    const x=executor(async request=>{expect(x.store.rows.at(-1).kind).toBe('START');expect(readMirrored(x.roots,'qualification.jsonl').length).toBeGreaterThan(0);return response(request)})
    await x.dispatcher.group(bound.envelope.canaryIds.slice(0,1),1)
    expect(x.store.rows.map(r=>r.kind)).toEqual(['START','RESPONSE','TERMINAL']);expect(replay(x.roots,bound.envelope).terminals.size).toBe(1)
    expect(()=>new BatchStore(x.roots,bound.envelope)).toThrow('B1_NONZERO_BASELINE_NO_REISSUE')
  })
  it('fails before count when raw primary and mirror mismatch',async()=>{const x=executor(async request=>response(request));const persist=x.store.persist.bind(x.store);x.store.persist=(id,attempt,bytes)=>{const s=persist(id,attempt,bytes);fs.appendFileSync(path.join(x.roots[1],'raw-b1',s.rawName),'x');return s};await x.dispatcher.run();expect(x.dispatcher.counted).toBe(0);expect(x.dispatcher.stopReason).toBeTruthy()})
  it('fails before issue if START storage fails',async()=>{let issued=0;const x=executor(async request=>{issued++;return response(request)});x.store.append=()=>{throw new Error('synthetic failure')};await x.dispatcher.run();expect(issued).toBe(0);expect(x.dispatcher.counted).toBe(0)})
  it('holds partial journal writes without repair or further issue',async()=>{let issued=0;const x=executor(async request=>{issued++;return response(request)});fs.chmodSync(path.join(x.roots[1],'qualification.jsonl'),0o644);await x.dispatcher.run();expect(issued).toBe(0);expect(x.store.failed).toBe(true);expect(()=>replay(x.roots,bound.envelope)).toThrow()})
})
describe('B1 atomic dispatch and truthful reconciliation',()=>{
  it('runs exactly15 with canary barrier, durable ramp and deterministic ordered commits',async()=>{
    const seen=[];let x;x=executor(async request=>{
      seen.push(request.logicalId)
      if(seen.length>4)expect(x.store.rows.filter(r=>r.kind==='TERMINAL').slice(0,4).every(r=>r.disposition==='SUCCESS_COUNTED')).toBe(true)
      await new Promise(resolve=>setTimeout(resolve,request.logicalId===bound.envelope.canaryIds[0]?30:1));return response(request)
    })
    const result=await x.dispatcher.run(),r=reconcile(bound,x.roots)
    expect(result.stopReason).toBeNull();expect(seen).toHaveLength(15);expect(new Set(seen).size).toBe(15);expect(result.maxInFlight).toBeLessThanOrEqual(8)
    expect(x.store.rows.filter(r=>r.kind==='TERMINAL').map(r=>r.logicalId)).toEqual(bound.envelope.executionOrder)
    expect(r.report).toMatchObject({attempts:15,countedSuccesses:15,actualCredits:15,durableTerminals:15,clean:true,retries:0,durableLocalReuse:0})
    expect(JSON.stringify(r.publicIndex)).not.toContain('PRIVATE_SYNTHETIC_LABEL');expect(JSON.stringify(r.publicIndex)).not.toContain(x.roots[0]);expect(r.utility.batch2Generated).toBe(false);expect(r.utility.admittedNewSubjects).toEqual([]);expect(r.utility.queriedAdmittedSeedSubjects.length).toBeGreaterThan(0)
    await expect(x.dispatcher.run()).rejects.toThrow('B1_INVOCATION_CANNOT_REPEAT')
  },60000)
  it('retry statuses count attempts and known spend but never inflate success',async()=>{
    let calls=0;const x=executor(async request=>{calls++;return calls===1?{status:429,headers:{...headers(0),'retry-after':'0','x-nansen-ratelimit-scope':'future-new-scope'},bytes:Buffer.from('{"error":"synthetic"}')}:response(request)},{random:()=>0})
    await x.dispatcher.group(bound.envelope.canaryIds.slice(0,1),1)
    const r=reconcile(bound,x.roots);expect(r.report).toMatchObject({attempts:2,countedSuccesses:1,actualCredits:1,retries:1});expect(x.dispatcher.stopReason).toBeNull()
  },15000)
  it('accounts actualUSED separately from quotedCOST on rejected retries',async()=>{let calls=0;const x=executor(async request=>{calls++;return calls===1?{status:429,headers:{...headers(0),'x-nansen-credits-cost':'1','retry-after':'0','x-nansen-ratelimit-scope':'future'},bytes:Buffer.from('{}')}:response(request)},{random:()=>0});await x.dispatcher.group(bound.envelope.canaryIds.slice(0,1),1);expect(reconcile(bound,x.roots).report).toMatchObject({attempts:2,retries:1,countedSuccesses:1,actualCredits:1});expect(x.store.rows.find(r=>r.kind==='RESPONSE')).toMatchObject({quotedCredits:1,actualCredits:0})})
  it('never counts or retries when actualdeduction USED is missing even if quotedcost is1',async()=>{let calls=0;const x=executor(async request=>{calls++;const r=response(request);delete r.headers['x-nansen-credits-used'];return r});await x.dispatcher.run();const r=reconcile(bound,x.roots);expect(calls).toBeLessThanOrEqual(2);expect(r.report.actualCredits).toBeNull();expect(r.report.unknownCreditAttempts).toBeGreaterThan(0);expect(r.report.countedSuccesses).toBe(0)})
  it('missingUSED429 holds its credit reservation and never retries an indeterminate deduction',async()=>{let calls=0;const x=executor(async()=>{calls++;return{status:429,bytes:Buffer.from('{}'),headers:{'x-nansen-credits-cost':'1','x-nansen-credits-remaining':'630026','retry-after':'0'}}});await x.dispatcher.group(bound.envelope.canaryIds.slice(0,1),1);const r=reconcile(bound,x.roots);expect(calls).toBe(1);expect(x.dispatcher.reservedCredits).toBe(1);expect(r.report).toMatchObject({actualCredits:null,unknownCreditAttempts:1,unresolvedReservations:1,countedSuccesses:0,retries:0})})
  it('unexpected actualdeduction stops, without replacing it with quotedcost',async()=>{const x=executor(async request=>{const r=response(request);r.headers['x-nansen-credits-used']='2';return r});await x.dispatcher.run();expect(x.dispatcher.stopReason).toBeTruthy();const r=reconcile(bound,x.roots);expect(r.report.actualCredits).toBeGreaterThanOrEqual(2);expect(r.report.countedSuccesses).toBe(0)})
  it('a knownzero actualdeduction remainszero, not a fabricatedonecredit charge',async()=>{const x=executor(async request=>{const r=response(request);r.headers['x-nansen-credits-used']='0';return r});await x.dispatcher.group(bound.envelope.canaryIds.slice(0,1),1);const r=reconcile(bound,x.roots);expect(r.report).toMatchObject({actualCredits:0,countedSuccesses:1,clean:true});expect(r.utility.recordsPerCredit).toBeNull();expect(r.utility.recordsPerCreditDisposition).toBe('UNDEFINED_ZERO_ACTUAL_CREDIT_DENOMINATOR')})
  it('classifies admittedempty2xx asSUCCESS_NOT_COUNTED, never genericfailure or replacement',async()=>{const x=executor(async request=>response(request,{empty:true}));await x.dispatcher.group(bound.envelope.canaryIds.slice(0,1),1);expect(x.store.rows.find(r=>r.kind==='TERMINAL')).toMatchObject({disposition:'SUCCESS_NOT_COUNTED',reason:'EMPTY_PAGE_NOT_ADMITTED_AS_NEGATIVE_EVIDENCE',resultCount:0,publicRecord:null});expect(reconcile(bound,x.roots).report).toMatchObject({provider2xx:1,noncounted2xx:1,countedSuccesses:0,actualCredits:1})})
  it.each([500,502,503,504])('retries admitted %s with at most3 attempts',async status=>{let calls=0;const x=executor(async()=>{calls++;return{status,headers:headers(0),bytes:Buffer.from('{}')}},{random:()=>0});await x.dispatcher.group(bound.envelope.canaryIds.slice(0,1),1);expect(calls).toBe(3);expect(x.dispatcher.counted).toBe(0);expect(x.dispatcher.stopReason).toBeTruthy()})
  it.each([400,401,402,403,404,422,302])('does not retry terminal HTTP%s or follow redirect',async status=>{let calls=0;const x=executor(async()=>{calls++;return{status,headers:headers(0),bytes:Buffer.from('{}')}});await x.dispatcher.run();expect(calls).toBeLessThanOrEqual(2);expect(x.dispatcher.counted).toBe(0);expect(x.dispatcher.stopReason).toBeTruthy()})
  it.each(['missingCost','unexpectedCost','missingRemaining','reserve','schema','pagination','privateProjection','empty','timeout'])('canary breaker drains already-issued responses and forbids eleven: %s',async failure=>{
    let calls=0;const x=executor(async request=>{
      calls++;if(failure==='timeout')throw new Error('synthetic only')
      const result=response(request,failure==='empty'?{empty:true}:failure==='pagination'?{pagination:{page:2}}:failure==='privateProjection'?{row:{token_address:'/home/private',transaction_hash:'bad'}}:{})
      if(failure==='missingCost')delete result.headers['x-nansen-credits-cost']
      if(failure==='unexpectedCost')result.headers['x-nansen-credits-cost']='2'
      if(failure==='missingRemaining')delete result.headers['x-nansen-credits-remaining']
      if(failure==='reserve')result.headers['x-nansen-credits-remaining']='249'
      if(failure==='schema')result.bytes=Buffer.from('{"data":"wrong"}')
      return result
    });const result=await x.dispatcher.run();expect(calls).toBeLessThanOrEqual(2);expect(result.stopReason).toBeTruthy();expect(result.counted).toBe(0)
    const r=reconcile(bound,x.roots);expect(r.report.clean).toBe(false)
  },20000)
  it('stops atomic attempt or credit reservation overshoot before another network issue',async()=>{
    let calls=0;const x=executor(async request=>{calls++;return response(request)});x.dispatcher.totalAttempts=45;await x.dispatcher.run();expect(calls).toBe(0)
    const y=executor(async request=>{calls++;return response(request)});y.dispatcher.credits=45;await y.dispatcher.run();expect(calls).toBe(0)
  })
  it('cancellation before issue is zero attempts, and queue/inflight saturation fails closed',async()=>{const signal=new AbortController();signal.abort();let calls=0;const x=executor(async request=>{calls++;return response(request)},{signal:signal.signal});await x.dispatcher.run();expect(calls).toBe(0);const y=executor(async request=>{calls++;return response(request)});y.dispatcher.inFlight=8;await y.dispatcher.run();expect(calls).toBe(0)})
  it('partial inflight cancellation drains responses and prevents further issue',async()=>{const controller=new AbortController();let calls=0;const x=executor(async request=>{calls++;controller.abort();await new Promise(resolve=>setTimeout(resolve,1));return response(request)},{signal:controller.signal});await x.dispatcher.run();expect(calls).toBeLessThanOrEqual(2);expect(x.dispatcher.inFlight).toBe(0);expect(x.dispatcher.stopReason).toBe('B1_CANCELLED')})
  it('reconstruction detects durable raw mutation and cannot inflate existing terminals',async()=>{const x=executor(async request=>response(request));await x.dispatcher.group(bound.envelope.canaryIds.slice(0,1),1);const row=x.store.rows.find(r=>r.kind==='RESPONSE');for(const root of x.roots)fs.appendFileSync(path.join(root,'raw-b1',row.rawName),'x');expect(()=>reconcile(bound,x.roots)).toThrow('B1_RAW_HASH')})
})
describe('B1 immediate downward rate and retry allowance',()=>{
  it('honors numeric and HTTP-date Retry-After and rejects malformed values',()=>{expect(retryAfter({'retry-after':'2'},0)).toBe(2000);expect(retryAfter({'retry-after':'Thu, 01 Jan 1970 00:00:05 GMT'},0)).toBe(5000);expect(()=>retryAfter({'retry-after':'invalid'},0)).toThrow()})
  it('immediately respects remaining-second zero, and unknown scope429 pauses generically',async()=>{const t=clock(),rate=new RateGate(t),start=t.now();rate.headers({'x-ratelimit-remaining-second':'0'},200);await rate.acquire(()=>false);expect(t.now()-start).toBeGreaterThanOrEqual(1000);const next=t.now();rate.headers({'retry-after':'3','x-nansen-ratelimit-scope':'unknown-future'},429);await rate.acquire(()=>false);expect(t.now()-next).toBeGreaterThanOrEqual(3000)})
  it('lowers granular and general limits with80% headroom and both allowance windows',async()=>{const t=clock(),rate=new RateGate(t);rate.headers({'x-ratelimit-limit-second':'10','ratelimit-remaining':'2','ratelimit-reset':'2'},200);expect(rate.second).toBe(8);await rate.acquire(()=>false);const first=t.now();await rate.acquire(()=>false);expect(t.now()-first).toBeGreaterThanOrEqual(2000)})
  it('never issues on zero rate allowance, long required pause, or stop',async()=>{const t=clock(),rate=new RateGate(t);rate.headers({'x-ratelimit-limit-second':'0'},200);await expect(rate.acquire(()=>false)).rejects.toThrow();const other=new RateGate(t);other.headers({'retry-after':'3600'},429);await expect(other.acquire(()=>false)).rejects.toThrow();expect(await other.acquire(()=>true)).toBe(false)})
})
