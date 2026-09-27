import { expect,test } from '@playwright/test'
import { setup } from '../fixtures/s2/browser-helpers'
// Exercise the guard itself even when the ordinary build CSP would reject external probes first.
test.use({bypassCSP:true,trace:'off'})
test('B-R02 guard self-test aborts injected proxy, external and non-GET requests',async ({page}) => {
  const data = await setup(page)
  const failures = await page.evaluate(async () => {
    const probes = [['/api/v1/s3-synthetic-boundary-probe','GET'],['https://s3-synthetic.invalid/never-issued','GET'],['/scenarios/s3-synthetic-boundary-probe','POST']]
    return Promise.all(probes.map(async ([url,method]) => { try { await fetch(url!,{method:method!});return false } catch { return true } }))
  })
  expect(failures).toEqual([true,true,true])
  const probes = data.requests.filter((r) => r.forbidden)
  expect(probes).toHaveLength(3);expect(probes.every((r) => r.blocked)).toBe(true)
  console.log(JSON.stringify({status:'PASS',syntheticInjectedProbesOnly:true,cspBypassedForGuardSelfTestOnly:true,requests:probes,actualProviderCalls:0}))
})
