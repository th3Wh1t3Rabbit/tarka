import { describe, expect, it } from 'vitest'
import { validateExactLookupResponse } from '../../scripts/acquisition/g6-euler-coverage'

const dai = '0x6b175474e89094c44da98b954eedeac495271d0f'
const engine = '0xebc29199c817dc47ba12e3f86102564d640cbf99'
const receiver = '0xb66cd966670d962c227b3eaba30a872dbfb995db'
const hash = `0x${'a'.repeat(64)}`
const expected = { transactionHash: hash, observedAtUtc: '2023-03-13T11:38:11Z', transfers: [{ from: engine, to: receiver, assetAddress: dai, amount: 8_877_507.348306697 }] }

describe('G6 durable exact-lookup validation', () => {
  it('requires the exact timestamp and from/to/asset/amount transfer relationship', () => {
    const body = { data: [{ transaction_hash: hash, block_timestamp: '2023-03-13T11:38:11', token_transfer_array: [{ from_address: engine, to_address: receiver, token_address: dai, token_amount: 8_877_507.348306697 }] }] }
    expect(validateExactLookupResponse(body, expected)).toBe(true)
    expect(validateExactLookupResponse({ data: [{ ...body.data[0], token_transfer_array: [{ ...body.data[0]!.token_transfer_array[0], to_address: engine }] }] }, expected)).toBe(false)
    expect(validateExactLookupResponse({ data: [{ ...body.data[0], token_transfer_array: [{ ...body.data[0]!.token_transfer_array[0], token_amount: 1 }] }] }, expected)).toBe(false)
  })

  it('rejects a body that merely repeats the requested transaction hash', () => {
    expect(validateExactLookupResponse({ data: [{ transaction_hash: hash, block_timestamp: '2023-03-13T11:38:11', note: hash }] }, expected)).toBe(false)
  })
})
