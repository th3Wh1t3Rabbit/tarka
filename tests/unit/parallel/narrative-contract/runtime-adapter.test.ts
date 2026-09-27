import {readFileSync} from 'node:fs'
import {it,expect} from 'vitest'
import {buildFrozenFixture} from '../../../../src/investigation/fixture'
import {exactPredicate,createInvestigationState,investigationReducer} from '../../../../src/investigation/state'
import {dispatchQuery} from '../../../../src/investigation/query'
import {contextFromState} from '../../../../content/parallel/narrative/catalog-contract.mjs'
const source='public/scenarios/euler-2023-false-exit/'
const fixture=()=>buildFrozenFixture(JSON.parse(readFileSync(source+'scenario.json','utf8')),JSON.parse(readFileSync(source+'evidence-graph.json','utf8')))
const runtime={exactPredicate,dispatchQuery}
function filed(f:any) {
  return {...createInvestigationState(f),access:true,discoveredRecords:Object.values(f.proof.slots),exactEventIds:['EXACT.EXACT_CONVERGENCE'],assembly:{...f.proof.slots},complete:true}
}
it('observes the real reducer journey and existing exact predicate before literal proof',()=>{
  const f=fixture();let s=investigationReducer(f,createInvestigationState(f),{type:'EARN_ACCESS'})
  const commands:any[]=[{type:'COLLECT_CASE_FILE'},{type:'REVIEW_RECEIPT'},{type:'DISPATCH',path:'TERMINAL'},{type:'SELECT_RESULT',recordId:f.openingRecordId},{type:'STAGE_CARD',cardId:'CARD.FOLLOW_FORWARD'},{type:'REVIEW_RECEIPT'},{type:'DISPATCH',path:'TERMINAL'},{type:'READ_BRANCH',branch:'SECOND'},{type:'SELECT_RESULT',recordId:f.proof.slots.LINK},{type:'STAGE_CARD',cardId:'CARD.EXACT_RECEIPT'},{type:'REVIEW_RECEIPT'},{type:'DISPATCH',path:'TERMINAL'}]
  for(const command of commands)s=investigationReducer(f,s,command)
  expect(contextFromState(f,s,null,runtime).EXACT_CONVERGENCE_VERIFIED).toBe(true)
  expect(contextFromState(f,s,null,runtime).CASE_COMPLETE).toBe(false)
  expect(contextFromState(f,filed(f),null,runtime).CASE_COMPLETE).toBe(true)
})
it('fails closed for each exact-observation mutation and the combined review reproduction',()=>{
  const mutations=[(r:any)=>r.exactRelationship=false,(r:any)=>r.source='wrong',(r:any)=>r.destination='wrong',(r:any)=>r.observedAtUtc='2099-01-01T00:00:00Z',(r:any)=>r.assetAmounts=[],(r:any)=>r.provenance.rawSha256='invalid',(r:any)=>r.derivedFrom=['STATE_EARLY_ENGINE'],(r:any)=>r.assetAmounts[0].amount='9999999999',(r:any)=>r.transactionHash='wrong']
  for(const mutate of mutations) {
    const f=fixture(),s=filed(f);mutate(f.records.find(r=>r.id===f.proof.slots.LINK))
    const c=contextFromState(f,s,null,runtime);expect(c.EXACT_CONVERGENCE_VERIFIED).toBe(false);expect(c.CASE_COMPLETE).toBe(false)
  }
  const f=fixture(),s=filed(f);for(const r of f.records)for(const mutate of mutations.slice(0,6))mutate(r)
  expect(contextFromState(f,s,null,runtime).CASE_COMPLETE).toBe(false)
})
it('refuses no-access, missing/throwing verifier, moved cutoff and altered first amount',()=>{
  const f=fixture(),s=filed(f)
  expect(contextFromState(f,s).CASE_COMPLETE).toBe(false)
  expect(contextFromState(f,s,null,{exactPredicate:()=>{throw Error('invalid')}}).CASE_COMPLETE).toBe(false)
  expect(contextFromState(f,{...s,access:false},null,runtime).EXACT_EARLY_DISCOVERED).toBe(false)
  f.cutoffUtc='2099-01-01T00:00:00Z';expect(contextFromState(f,s,null,runtime).CASE_COMPLETE).toBe(false)
  const first=fixture();first.records.find(r=>r.id===first.openingRecordId)!.assetAmounts[0]!.amount='8877507.348306697'
  expect(contextFromState(first,filed(first),null,runtime).EXACT_EARLY_DISCOVERED).toBe(false)
})
function negative() {
  const f=fixture(),cell=f.coverage[0]!;cell.status='COMPLETE';cell.supportsNegative=true
  const query:any={operator:'AND',lens:cell.lens,filters:[{field:'SUBJECT',value:cell.subject,origin:'PLAYER_FILTER',sourceId:'TEST'},{field:'FROM',value:'2023-03-13T12:00:00Z',origin:'PLAYER_FILTER',sourceId:'TEST'},{field:'TO',value:f.cutoffUtc,origin:'PLAYER_FILTER',sourceId:'TEST'}]}
  const s={...filed(f),result:dispatchQuery(f,query,null)}
  return {f,s,cell}
}
it('replays the actual bounded query before admitting scoped-negative copy',()=>{
  const {f,s}=negative();expect(s.result.zeroClass).toBe('NEGATIVE_EVIDENCE_SUPPORTED')
  expect(contextFromState(f,s,null,runtime).NEGATIVE_SCOPE_ACCEPTED).toBe(true)
  expect(contextFromState(f,s).NEGATIVE_SCOPE_ACCEPTED).toBe(false)
})
it('rejects wrong lens/subject/window, nonempty rows, incomplete cells and mismatched IDs',()=>{
  const mutations=[(s:any)=>s.result.query.lens='STATE',(s:any)=>s.result.query.filters[0].value='unrelated',(s:any)=>s.result.query.filters[1].value='2099-01-01T00:00:00Z',(s:any)=>s.result.query.filters[2].value='2099-01-01T00:00:00Z',(s:any)=>s.result.query.filters.pop(),(s:any)=>s.result.query.filters[1].value='invalid',(s:any)=>s.result.recordIds=['nonempty-result'],(s:any)=>s.result.coverageIds=['wrong']]
  for(const mutate of mutations){const {f,s}=negative();mutate(s);expect(contextFromState(f,s,null,runtime).NEGATIVE_SCOPE_ACCEPTED).toBe(false)}
  const {f,s,cell}=negative();cell.status='PARTIAL';expect(contextFromState(f,s,null,runtime).NEGATIVE_SCOPE_ACCEPTED).toBe(false)
})
it('cannot claim absence when actual replay finds a record despite forged empty rows',()=>{
  const {f,s}=negative();s.result.query.filters[1]!.value='2023-03-13T08:00:00Z'
  expect(dispatchQuery(f,s.result.query,null).recordIds.length).toBeGreaterThan(0)
  expect(contextFromState(f,s,null,runtime).NEGATIVE_SCOPE_ACCEPTED).toBe(false)
})
