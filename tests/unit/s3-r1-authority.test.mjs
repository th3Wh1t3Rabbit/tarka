import {it,expect} from 'vitest'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import * as seam from '../../src/investigation/corpus-seam/authority.mjs'
import {runAuthorityAdversarial} from '../../scripts/nq5-s3-r1/adversarial.mjs'
const candidate=JSON.parse(fs.readFileSync('artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json'))
const fixture=JSON.parse(fs.readFileSync('artifacts/g6p-s3/REPORTS/SYNTHETIC_SEMANTIC_FIXTURE.json'))
it('actual authority seam rejects every locally and whole-candidate resealed MAIN mutation',async()=>{
 const report=await runAuthorityAdversarial(seam,candidate,fixture)
 expect(report.resealedFalseSuccessRejections).toBeGreaterThanOrEqual(50)
 expect(report.legitimateSubsetModes).toBe(3)
})
it('synchronous snapshot prevents caller mutation racing asynchronous admission',async()=>{
 const input=structuredClone(candidate),pending=seam.admitFrozenCorpusCandidate(input)
 input.displayRecords[0].question='MUTATED_DURING_DIGEST'
 const corpus=await pending
 expect(await seam.displayForMode(corpus,'PLAIN_LIST')).toEqual(candidate.displayRecords)
 const selected=await seam.displayForMode(corpus,'PLAIN_LIST')
 expect(()=>{selected[0].question='MUTATED_AFTER_ADMISSION'}).toThrow()
 expect(()=>selected[0].coverage.cellIds.push('MUTATED_AFTER_ADMISSION')).toThrow()
})
it('JSON accessors/cycles/sparse arrays cannot execute or gain authority',async()=>{
 let getterCalls=0
 const input=structuredClone(candidate);Object.defineProperty(input,'concepts',{enumerable:true,get(){getterCalls++;return candidate.concepts}})
 await expect(seam.admitFrozenCorpusCandidate(input)).rejects.toThrow('ACCESSOR');expect(getterCalls).toBe(0)
 const cycle={};cycle.self=cycle
 await expect(seam.admitFrozenCorpusCandidate(cycle)).rejects.toThrow('DOMAIN')
 const sparse=structuredClone(candidate);delete sparse.displayRecords[0]
 await expect(seam.admitFrozenCorpusCandidate(sparse)).rejects.toThrow('ARRAY')
})
it('synthetic role promotion rejects with record and whole-fixture seals recomputed',async()=>{
 const x=structuredClone(fixture),r=x.records[0]
 r.grade='EXACT';r.role='CONTROL'
 const seal=(value,prefix)=>{const{id,identity,...body}=value,h=createHash('sha256').update(seam.canonicalJSON(body)).digest('hex');return prefix?{id:prefix+h,identity:h,...body}:{...body,identity:h}}
 x.records[0]=seal(r,'SEMANTIC.')
 await expect(seam.admitSyntheticCorpusFixture(seal(x))).rejects.toThrow('PROMOTION')
})
