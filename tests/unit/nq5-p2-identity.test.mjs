import fs from 'node:fs'
import {describe,it,expect} from 'vitest'
import {assertAcceptanceIdentities} from '../../scripts/nq5-p2/acceptance.mjs'
import {PHASES,CONCEPTS} from '../../scripts/nq5-p2/corpus.mjs'
import {ADDRESS} from '../../scripts/nq5-p2/admission.mjs'
const ids=Array.from({length:10},(_,i)=>i.toString(16).padStart(64,'0')),plan={executionOrder:ids},rows=ids.map((logicalId,i)=>({logicalId,supplierSequence:12+i,publicCallId:'NQ5-'+String(12+i).padStart(6,'0')}))
describe('P2 fail-closed immutable acceptance identity boundary',()=>{
 it('permits exact preserved supplier/public identities independently of list order',()=>expect(assertAcceptanceIdentities([...rows].reverse(),plan)).toBe(true))
 it('rejects a supplier-order permutation rather than renumbering historical calls',()=>{const x=structuredClone(rows);[x[2].supplierSequence,x[3].supplierSequence]=[x[3].supplierSequence,x[2].supplierSequence];expect(()=>assertAcceptanceIdentities(x,plan)).toThrow('P2_HANDOFF_IMMUTABLE_SUPPLIER_PUBLIC_ID_CONFLICT')})
 it('rejects a mismatched public ID even with an exact sequence',()=>{const x=structuredClone(rows);x[2].publicCallId='NQ5-000099';expect(()=>assertAcceptanceIdentities(x,plan)).toThrow()})
 it('rejects an unknown logical request',()=>{const x=structuredClone(rows);x[2].logicalId='f'.repeat(64);expect(()=>assertAcceptanceIdentities(x,plan)).toThrow()})
 it('rejects duplicate execution order',()=>expect(()=>assertAcceptanceIdentities(rows,{executionOrder:Array(10).fill(ids[0])})).toThrow())
 it('retains exactly three broad accepted chronology phases and thirteen distinct concepts',()=>{expect(PHASES).toHaveLength(3);expect(PHASES[2].from).toBe('2023-03-13T11:38:11Z');expect(new Set(CONCEPTS).size).toBe(13);expect(PHASES.every(p=>p.consumers.length>=5&&p.teachingPurpose)).toBe(true)})
 it('has no credential/provider/private writer capability in the blocker proof',()=>{const s=fs.readFileSync(new URL('../../scripts/nq5-p2/failure.mjs',import.meta.url),'utf8');expect(s).not.toMatch(/https\.request|resolveCredential|process\.env|new Store|writeFileSync|appendFileSync/);expect(ADDRESS.test('0xc66dfa84bc1b93df194bd964a41282da65d73c9a')).toBe(true)})
})
