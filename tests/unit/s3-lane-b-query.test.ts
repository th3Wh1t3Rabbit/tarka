import {expect,it} from 'vitest'
import {canonicalQuery,dispatchQuery,firstExcludingPredicate,queryReceipt,compareDecimal} from '../../src/investigation/query'
import type {Filter,Query} from '../../src/investigation/contracts'
import {scenarioFixture} from '../fixtures/s2/contract-fixture'
const chip=(field:Filter['field'],value:string,id:string):Filter=>({field,value,origin:'PLAYER_FILTER',sourceId:id})
const make=(assets:string[],amount=true):Query=>({lens:'ACTIVITY',questionId:'S2.REGRESSION',filters:[...assets.map((v,i)=>chip('ASSET',v,'RAW.'+i)),...(amount?[chip('MIN_AMOUNT','50','AMOUNT')]:[])]})
const fixture=()=>{const f=scenarioFixture(19).fixture;f.records.find(r=>r.id===f.secondRecordId)!.assetAmounts=[{asset:'TEST',amount:'100',unit:'TOKEN_DECIMAL'},{asset:'OTHER',amount:'1',unit:'TOKEN_DECIMAL'}];return f}
it('S2-F01 raw API, first predicate, empty corpus and canonical API reject all 1000 unsorted conflicting permutations',()=>{
 const f=fixture(),q=make(['TEST','OTHER']);let seed=19017;const rows=[]
 for(let n=0;n<1000;n++){
  const filters=[...q.filters];for(let j=filters.length-1;j>0;j--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const k=seed%(j+1);[filters[j],filters[k]]=[filters[k]!,filters[j]!]}
  const raw={...q,filters},before=structuredClone(raw)
  expect(canonicalQuery(raw)).toEqual(canonicalQuery(q));expect(()=>dispatchQuery(f,raw,null)).toThrow('INVALID_QUERY');expect(()=>dispatchQuery({...f,records:[]},raw,null)).toThrow('INVALID_QUERY');expect(()=>firstExcludingPredicate(f.records[0]!,raw)).toThrow('INVALID_QUERY')
  const canonical={...raw,filters:canonicalQuery(raw).filters.map((v,i)=>({...v,origin:'PLAYER_FILTER' as const,sourceId:'CANONICAL.'+i}))};expect(()=>dispatchQuery(f,canonical,null)).toThrow('INVALID_QUERY');expect(raw).toEqual(before);expect(queryReceipt(f,raw).activeFilters).toEqual(before.filters)
  rows.push({n,rawOrder:filters.map(v=>v.sourceId),execution:'REJECTED_BEFORE_EVALUATION'})
 }
})

it('S2-F01 exact decimal boundary rejects a one-unit fractional increment beyond binary precision',()=>{
 const f=fixture(),record=f.records.find(r=>r.id===f.secondRecordId)!;record.assetAmounts=[{asset:'TEST',amount:'9007199254740993.000000000000000001',unit:'TOKEN_DECIMAL'}]
 const q=make(['test']);q.filters[1]!.value=record.assetAmounts[0]!.amount;expect(dispatchQuery(f,q,null).recordIds).toContain(record.id);q.filters[1]!.value='9007199254740993.000000000000000002';expect(dispatchQuery(f,q,null).recordIds).not.toContain(record.id);expect(compareDecimal(record.assetAmounts[0]!.amount,q.filters[1]!.value)).toBe(-1)
})
