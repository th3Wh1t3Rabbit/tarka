import {test,expect} from '@playwright/test'
import fs from 'node:fs'
import {setup} from '../fixtures/s2/browser-helpers'
test('native browser authority admits pinned corpus and rejects every resealed MAIN mutation without runtime provider calls',async({page})=>{
 const core=fs.readFileSync('src/investigation/corpus-seam/authority.mjs','utf8'),checks=fs.readFileSync('scripts/nq5-s3-r1/adversarial.mjs','utf8')
 await page.route('http://127.0.0.1:4173/assets/s3-r1-authority.mjs',route=>route.fulfill({contentType:'application/javascript',body:core}))
 await page.route('http://127.0.0.1:4173/assets/s3-r1-checks.mjs',route=>route.fulfill({contentType:'application/javascript',body:checks}))
 const data=await setup(page),candidate=JSON.parse(fs.readFileSync('artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json','utf8')),fixture=JSON.parse(fs.readFileSync('artifacts/g6p-s3/REPORTS/SYNTHETIC_SEMANTIC_FIXTURE.json','utf8'))
 const result=await page.evaluate(async({candidate,fixture})=>{
  const coreUrl='/assets/s3-r1-authority.mjs',checksUrl='/assets/s3-r1-checks.mjs'
  const core=await import(coreUrl),checks=await import(checksUrl)
  return checks.runAuthorityAdversarial(core,candidate,fixture)
 },{candidate,fixture})
 expect(result.status).toBe('PASS');expect(result.resealedFalseSuccessRejections).toBe(54);expect(result.legitimateSubsetModes).toBe(3);expect(data.requests.filter(r=>r.forbidden)).toEqual([])
 console.log(JSON.stringify({status:'PASS_NATIVE_BROWSER_AUTHORITY',resealedChecks:result.resealedFalseSuccessRejections,subsetModes:result.legitimateSubsetModes,providerCalls:0,fixtureHarnessOnly:true,gameplayIntegrated:false}))
})
