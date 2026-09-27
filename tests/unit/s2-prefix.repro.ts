import { expect,it } from 'vitest'
import { canonicalQuery,dispatchQuery } from '../../src/investigation/query'
import type { Query,Filter } from '../../src/investigation/contracts'
import { scenarioFixture } from '../fixtures/s2/contract-fixture'
it('pre-fix B-F01 reproduces the accepted raw-ASSET-order discrepancy on MAIN',()=>{
 const f=scenarioFixture(19).fixture
 f.records.find(r=>r.id===f.secondRecordId)!.assetAmounts=[{asset:'TEST',amount:'100',unit:'TOKEN_DECIMAL'},{asset:'OTHER',amount:'1',unit:'TOKEN_DECIMAL'}]
 const filter=(field:Filter['field'],value:string):Filter=>({field,value,origin:'PLAYER_FILTER',sourceId:'SYNTHETIC.REPRO'})
 const a:Query={lens:'ACTIVITY',questionId:'SYNTHETIC.MULTIASSET',filters:[filter('ASSET','TEST'),filter('ASSET','OTHER'),filter('MIN_AMOUNT','50')]},b={...a,filters:[a.filters[1]!,a.filters[0]!,a.filters[2]!]}
 expect(canonicalQuery(a)).toEqual(canonicalQuery(b));expect(dispatchQuery(f,a,null).recordIds).toContain(f.secondRecordId);expect(dispatchQuery(f,b,null).recordIds).not.toContain(f.secondRecordId)
})
