import type { ProviderPolicy } from '../../src/acquisition/contracts.js'
import { fail, printReport, readJson } from './common.js'

async function main() {
  const policy = await readJson<ProviderPolicy>('src/acquisition/config/provider-policy.json')
  const valid = policy.schemaVersion === '1.0.0'
    && policy.provider === 'FUTURE_NANSEN_BUILD_TIME'
    && policy.requestProtocol.method === 'POST'
    && policy.requestProtocol.contentType === 'application/json'
    && policy.authentication.g3Resolution === 'DISABLED'
    && policy.concurrency === 1
    && policy.minimumDelayMs > 0
    && policy.retryAfterSemantics === 'HONOR_SECONDS_OR_HTTP_DATE'
    && policy.historicalResponsePolicy === 'MAY_BE_RESTATED'
    && policy.endpoints.length > 0
    && policy.endpoints.every((endpoint) => endpoint.transport === 'FIXTURE_ONLY_G3' && endpoint.planningCreditCost >= 0)
  if (!valid) throw new Error('Provider policy failed G3 preflight validation')
  printReport({
    command: 'acquisition:preflight',
    status: 'PASS',
    mode: 'FIXTURE_ONLY_NO_NETWORK',
    credentialResolution: 'DISABLED_G3',
    nonlocalNetwork: 'PROHIBITED',
    configuredConcurrency: policy.concurrency,
    endpointPolicies: policy.endpoints.length,
    providerCalls: 0,
  })
}

main().catch(fail)
