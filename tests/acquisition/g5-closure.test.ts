import { describe, expect, it } from 'vitest'

import { assessHistoricalState, closureRequest, hasDurableSemanticResponse } from '../../scripts/acquisition/g5-euler-closure.js'
import type { CallLedgerRecord } from '../../src/acquisition/contracts.js'
import { hashCanonicalObject } from '../../src/acquisition/integrity/identity.js'
import type { LiveEndpointPolicy } from '../../src/acquisition/live/executor.js'

const dai = '0x6b175474e89094c44da98b954eedeac495271d0f'
const policy: LiveEndpointPolicy = {
  endpoint: '/api/v1/profiler/address/historical-balances', method: 'POST', apiVersion: 'nansen-v1', endpointClass: 'historical-balances', planningCreditCost: 1,
  allowedLenses: ['STATE_ECHO'], redistribution: 'PUBLIC_ALLOWLISTED', maximumPages: 2, transport: 'NANSEN_BUILD_TIME_G4A',
}

describe('G5 Euler closure boundary', () => {
  it('plans only the authorized Early Engine historical-balance request', () => {
    expect(closureRequest(policy)).toMatchObject({
      candidateId: 'EULER_2023_FALSE_EXIT_CLOSURE', purposeId: 'clean-early-engine-dai-state', endpoint: policy.endpoint,
      temporalWindow: { start: '2023-03-13T08:45:00Z', end: '2023-03-13T11:45:00Z' },
      requestBody: { address: '0xebc29199c817dc47ba12e3f86102564d640cbf99', chain: 'ethereum' },
    })
  })

  it('forbids repeating a durably stored response even when accounting rejected its terminal record', () => {
    const request = closureRequest(policy)
    const terminal = { status: 'FAILED', rawSha256: 'a'.repeat(64), endpoint: request.endpoint, canonicalRequestHash: hashCanonicalObject(request.requestBody) } as CallLedgerRecord
    expect(hasDurableSemanticResponse([terminal], request)).toBe(true)
    expect(hasDurableSemanticResponse([{ ...terminal, rawSha256: null }], request)).toBe(false)
  })

  it('accepts only a clean nonnegative before-rise-fall sequence', () => {
    const assessment = assessHistoricalState({ data: [
      { token_address: dai, token_amount: 0, block_timestamp: '2023-03-13T08:45:00' },
      { token_address: dai, token_amount: 8_877_507.348306697, block_timestamp: '2023-03-13T09:00:00' },
      { token_address: dai, token_amount: 0, block_timestamp: '2023-03-13T11:40:00' },
    ] })
    expect(assessment).toMatchObject({ disposition: 'CLEAN_HISTORICAL_STATE', negativeRowsOmitted: 0 })
    expect(assessment.acceptedRows).toHaveLength(3)
  })

  it('falls back without publishing unexplained negative balance rows', () => {
    expect(assessHistoricalState({ data: [
      { token_address: dai, token_amount: -8_877_507.348306697, block_timestamp: '2023-03-13T09:00:00Z' },
    ] })).toEqual({
      disposition: 'TRANSACTION_DERIVED_NET_STATE_FALLBACK', acceptedRows: [], negativeRowsOmitted: 1,
      reason: 'Historical balance semantics did not provide a clean nonnegative before/rise/fall comparison; exact transaction-local net state is used.',
    })
  })
})
