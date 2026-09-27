import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {renderToStaticMarkup} from 'react-dom/server'
import {createElement} from 'react'
import {ExactIdentifier} from '../../src/app/ExactIdentifier'
import {canonicalQuery,dispatchQuery,firstExcludingPredicate,queryReceipt,queryValidationIssues} from '../../src/investigation/query'
import {createInvestigationState,investigationReducer} from '../../src/investigation/state'
import type {Query,Filter} from '../../src/investigation/contracts'
import {scenarioFixture} from '../fixtures/s2/contract-fixture'
import {MERIDIAN_POLICY,acceptedEvidenceAccounting} from '../../src/investigation/accounting'
const filter=(field:Filter['field'],value:string):Filter=>({field,value,origin:'PLAYER_FILTER',sourceId:'SYNTHETIC.S2'})
const query=(assets:string[],amount=true):Query=>({lens:'ACTIVITY',questionId:'SYNTHETIC.MULTIASSET',filters:[...assets.map(a=>filter('ASSET',a)),...(amount?[filter('MIN_AMOUNT','50')]:[])]})
const fixture=()=>{const f=scenarioFixture(19).fixture;f.records.find(r=>r.id===f.secondRecordId)!.assetAmounts=[{asset:'TEST',amount:'100',unit:'TOKEN_DECIMAL'},{asset:'OTHER',amount:'1',unit:'TOKEN_DECIMAL'}];return f}
describe('S2 B-F01 explicit asset semantics',()=>{
 it.each([[],['TEST','OTHER'],['OTHER','TEST'],['TEST','OTHER','TEST']].map(assets=>({assets})))('rejects invalid threshold assets $assets without mutation',({assets})=>{
  const f=fixture(),q=query(assets),before=structuredClone(q)
  expect(queryValidationIssues(q)).toHaveLength(1);expect(()=>dispatchQuery(f,q,null)).toThrow('INVALID_QUERY');expect(()=>firstExcludingPredicate(f.records[0]!,q)).toThrow('INVALID_QUERY');expect(q).toEqual(before)
  expect(()=>dispatchQuery({...f,records:[]},q,null)).toThrow('INVALID_QUERY')
 })
 it.each([['TEST'],['TEST','TEST'],['test',' TEST ']].map(assets=>({assets})))('admits one canonical asset $assets without deleting duplicate staged chips',({assets})=>{
  const f=fixture(),q=query(assets),before=structuredClone(q),result=dispatchQuery(f,q,null)
  expect(result.recordIds).toContain(f.secondRecordId);expect(q).toEqual(before);expect(result.query).toEqual(q);expect(queryReceipt(f,q).activeFilters).toEqual(q.filters)
 })
 it('allows multiple distinct AND assets without amount',()=>{const f=fixture(),q=query(['TEST','OTHER'],false);expect(dispatchQuery(f,q,null).recordIds).toContain(f.secondRecordId)})
 it('all permutations of original accepted reproducer reject identically and have identical canonical receipts',()=>{
  const f=fixture(),q=query(['TEST','OTHER']),permutations=q.filters.flatMap((a,i)=>q.filters.filter((_,j)=>j!==i).map((b)=>[a,b,q.filters.find(c=>c!==a&&c!==b)!]))
  for(const filters of permutations){const p={...q,filters};expect(canonicalQuery(p)).toEqual(canonicalQuery(q));expect(queryReceipt(f,p).validationIssues).toEqual(queryReceipt(f,q).validationIssues);expect(()=>dispatchQuery(f,p,null)).toThrow('INVALID_QUERY');expect(()=>firstExcludingPredicate(f.records[0]!,p)).toThrow('INVALID_QUERY')}
 })
 it.each(['TERMINAL','PLUNGER'] as const)('invalid %s dispatch preserves query/history/results/selection/proof',path=>{
  const f=fixture(),base=investigationReducer(f,createInvestigationState(f),{type:'EARN_ACCESS'}),q=query(['TEST','OTHER']),s={...base,query:q,reviewedReceipt:JSON.stringify(canonicalQuery(q))},r=investigationReducer(f,s,{type:'DISPATCH',path})
  for(const k of ['query','past','future','result','lastDispatchQuery','selectedRecordId','exactEventIds','discoveredRecords','canister'] as const)expect(r[k]).toEqual(s[k])
  expect(r.error).toContain('exactly one distinct ASSET');expect(r.announcement).toContain('not dispatched');expect(r.section).toBe('CASE')
 })
 it('undo/redo preserves staged order and recovers after removing conflict',()=>{
  const f=fixture();let s=investigationReducer(f,createInvestigationState(f),{type:'EARN_ACCESS'})
  for(const a of ['TEST','OTHER'])s=investigationReducer(f,s,{type:'ADD_FILTER',filter:filter('ASSET',a)})
  s=investigationReducer(f,s,{type:'ADD_FILTER',filter:filter('MIN_AMOUNT','50')});const q=structuredClone(s.query)
  s=investigationReducer(f,s,{type:'UNDO'});expect(queryValidationIssues(s.query)).toEqual([])
  s=investigationReducer(f,s,{type:'REDO'});expect(s.query).toEqual(q)
  s=investigationReducer(f,s,{type:'REMOVE_FILTER',index:1});s=investigationReducer(f,s,{type:'REVIEW_RECEIPT'});s=investigationReducer(f,s,{type:'DISPATCH',path:'TERMINAL'});expect(s.error).toBeNull();expect(s.result).not.toBeNull()
 })
 it('first excluding predicate and Evidence Delta agree in both valid orders',()=>{
  const f=fixture(),broad=dispatchQuery(f,query([],false),null),q=query(['OTHER']),rev={...q,filters:[...q.filters].reverse()}
  const a=dispatchQuery(f,q,broad),b=dispatchQuery(f,rev,broad);expect(a.recordIds).toEqual(b.recordIds);expect(a.delta.excluded).toEqual(b.delta.excluded)
  expect(a.delta.excluded.find(r=>r.recordId===f.secondRecordId)?.firstPredicate).toBe(firstExcludingPredicate(f.records.find(r=>r.id===f.secondRecordId)!,q))
 })
 it('direct API rejects malformed thresholds before record evaluation',()=>{const q=query(['TEST']);q.filters.push(filter('MIN_AMOUNT','nonsense'));expect(()=>dispatchQuery(fixture(),q,null)).toThrow('INVALID_QUERY')})
})
describe('S2 B-F02 shared semantic copy surface',()=>{
 it.each(['Full transaction hash','Source address','Destination address'])('field %s exposes button, full value, selectable fallback and polite feedback',label=>{
  const value='0x'+'a'.repeat(label==='Full transaction hash'?64:40),html=renderToStaticMarkup(createElement(ExactIdentifier,{label,value}))
  expect(html).toContain(value);expect(html).toContain('aria-label="Copy '+label+'"');expect(html).toContain('<button type="button"');expect(html).toContain('aria-live="polite"');expect(html.toLowerCase()).toContain('readonly');expect(html).not.toContain('tabindex="-1"')
 })
 it('all three modes use the same SOURCE implementation, not mode-local buttons',()=>{const source=readFileSync('src/app/CaseTerminalWorkbench.tsx','utf8');expect(source.match(/<ExactIdentifier/g)).toHaveLength(1);expect(source).not.toContain('qualification-counted');expect(source).toContain('curated evidence calls')})
})
describe('S2 two-track accounting',()=>{
 it('retired curated floor cannot gate the product',()=>{expect(MERIDIAN_POLICY.curatedProductCallFloor).toBeNull();expect(MERIDIAN_POLICY.officialAccountCallFloor).toBe(1000);expect(MERIDIAN_POLICY.accountPlanningBufferTarget).toBe(1024)})
 it('keeps 25 curated calls, 47 attempts, 33 2xx, 31 supplier terminals and 37 credits distinct',()=>{expect(acceptedEvidenceAccounting.curatedProductEvidence.leadAcceptedCalls).toBe(25);expect(acceptedEvidenceAccounting.traceAcquisition).toMatchObject({attempts:47,responses2xx:33,supplierTerminals:31});expect(acceptedEvidenceAccounting.credits.knownTraceCredits).toBe(37);expect(acceptedEvidenceAccounting.accountCompliance.quotaMet).toBe(false)})
})
