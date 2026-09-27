import type { JsonObject } from '../contracts.js'

const BASE_URL = 'https://api.nansen.ai'
const ALLOWED_ENDPOINTS = new Set([
  '/api/v1/account',
  '/api/v1/profiler/address/transactions',
  '/api/v1/profiler/address/counterparties',
  '/api/v1/transaction-with-token-transfer-lookup',
  '/api/v1/profiler/address/historical-balances',
  '/api/v1/tgm/token-information',
])
const CAPTURED_EXACT_HEADERS = new Set([
  'x-nansen-credits-cost', 'x-nansen-credits-used', 'x-nansen-credits-remaining',
  'x-request-id', 'retry-after',
])

export interface TransportRequest {
  endpoint: string
  method: 'GET' | 'POST'
  body?: JsonObject
  credential: string
  timeoutMs?: number
}

export interface TransportResponse {
  status: number
  body: Uint8Array
  capturedHeaders: Record<string, string>
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export function validateTransportRequest(input: Omit<TransportRequest, 'credential'>): void {
  if (!ALLOWED_ENDPOINTS.has(input.endpoint)) throw new Error('Transport policy rejected endpoint')
  if (input.endpoint === '/api/v1/account' ? input.method !== 'GET' : input.method !== 'POST') throw new Error('Transport policy rejected method')
  if (input.method === 'GET' && input.body !== undefined) throw new Error('GET request body is prohibited')
  if (input.method === 'POST' && (input.body === undefined || typeof input.body !== 'object' || Array.isArray(input.body))) throw new Error('POST request body is required')
  if (input.method !== 'POST' || input.body === undefined) return
  const keys = Object.keys(input.body)
  const exactKeys = (required: string[], optional: string[]) => {
    if (required.some((key) => !(key in input.body!)) || keys.some((key) => !required.includes(key) && !optional.includes(key))) throw new Error('Transport policy rejected request schema')
  }
  if (input.endpoint === '/api/v1/transaction-with-token-transfer-lookup') {
    exactKeys(['chain', 'transaction_hash'], ['block_timestamp'])
    if (input.body.chain !== 'ethereum' || typeof input.body.transaction_hash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(input.body.transaction_hash)) throw new Error('Transport policy rejected transaction lookup identity')
  } else if (input.endpoint === '/api/v1/profiler/address/transactions') {
    exactKeys(['address', 'chain', 'date'], ['hide_spam_token', 'filters', 'pagination', 'order_by'])
    if (input.body.chain !== 'ethereum' || typeof input.body.address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(input.body.address)) throw new Error('Transport policy rejected address transaction identity')
  } else if (input.endpoint === '/api/v1/profiler/address/counterparties') {
    exactKeys(['address', 'chain', 'date'], ['source_input', 'group_by', 'pagination', 'order_by'])
    if (input.body.chain !== 'ethereum' || typeof input.body.address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(input.body.address) || input.body.group_by !== 'wallet') throw new Error('Transport policy rejected counterparty identity')
  } else if (input.endpoint === '/api/v1/tgm/token-information') {
    exactKeys(['chain', 'token_address', 'timeframe'], [])
    if (input.body.chain !== 'ethereum' || typeof input.body.token_address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(input.body.token_address) || input.body.timeframe !== '1d') throw new Error('Transport policy rejected token metadata identity')
  } else if (input.endpoint === '/api/v1/profiler/address/historical-balances') {
    exactKeys(['address', 'chain', 'date'], ['filters', 'pagination', 'order_by'])
    if (input.body.chain !== 'ethereum' || typeof input.body.address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(input.body.address)) throw new Error('Transport policy rejected historical balance identity')
  }
  const date = input.body.date
  if (date !== undefined) {
    if (typeof date !== 'object' || date === null || Array.isArray(date)) throw new Error('Transport policy rejected date schema')
    const range = date as Record<string, unknown>
    if (typeof range.from !== 'string' || typeof range.to !== 'string' || !Number.isFinite(Date.parse(range.from)) || !Number.isFinite(Date.parse(range.to)) || Date.parse(range.from) > Date.parse(range.to)) throw new Error('Transport policy rejected date range')
  }
  const pagination = input.body.pagination
  if (pagination !== undefined) {
    if (typeof pagination !== 'object' || pagination === null || Array.isArray(pagination)) throw new Error('Transport policy rejected pagination schema')
    const page = (pagination as Record<string, unknown>).page
    const perPage = (pagination as Record<string, unknown>).per_page
    const maximum = input.endpoint === '/api/v1/profiler/address/transactions' || input.endpoint === '/api/v1/profiler/address/counterparties' ? 100 : 1000
    if (!Number.isInteger(page) || (page as number) < 1 || !Number.isInteger(perPage) || (perPage as number) < 1 || (perPage as number) > maximum) throw new Error('Transport policy rejected pagination bounds')
  }
}

export function createNansenTransport(fetchImplementation: FetchLike = globalThis.fetch): (input: TransportRequest) => Promise<TransportResponse> {
  return async (input) => {
    validateTransportRequest(input)
    if (!input.credential || /[\r\n\0]/.test(input.credential)) throw new Error('Credential unavailable or header-unsafe')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000)
    try {
      const init: RequestInit = {
        method: input.method,
        headers: { apikey: input.credential, ...(input.method === 'POST' ? { 'content-type': 'application/json' } : {}) },
        redirect: 'error',
        signal: controller.signal,
      }
      if (input.method === 'POST') init.body = JSON.stringify(input.body)
      const response = await fetchImplementation(`${BASE_URL}${input.endpoint}`, init)
      const capturedHeaders: Record<string, string> = {}
      response.headers.forEach((value, rawName) => {
        const name = rawName.toLowerCase()
        if (CAPTURED_EXACT_HEADERS.has(name) || name.startsWith('ratelimit-') || name.startsWith('x-ratelimit-')) capturedHeaders[name] = value
      })
      return { status: response.status, body: new Uint8Array(await response.arrayBuffer()), capturedHeaders }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Nansen request timed out', { cause: error })
      throw new Error('Nansen transport failed', { cause: error })
    } finally {
      clearTimeout(timer)
    }
  }
}

export function splitResponseMetadata(headers: Record<string, string>): {
  requestId: string | null
  credit: JsonObject | null
  rate: JsonObject | null
} {
  const creditEntries = Object.entries(headers).filter(([name]) => name.startsWith('x-nansen-credits-'))
  const rateEntries = Object.entries(headers).filter(([name]) => name.startsWith('ratelimit-') || name.startsWith('x-ratelimit-') || name === 'retry-after')
  return {
    requestId: headers['x-request-id'] ?? null,
    credit: creditEntries.length > 0 ? Object.fromEntries(creditEntries) : null,
    rate: rateEntries.length > 0 ? Object.fromEntries(rateEntries) : null,
  }
}
