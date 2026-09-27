import type { EndpointPolicy, ProviderPolicy } from '../contracts.js'
import type { AllowanceDecision } from './governor.js'

export interface RetryDecisionInput {
  outcome: { httpStatus: number } | { timeout: true }
  attemptNumber: number
  policy: Pick<ProviderPolicy, 'minimumDelayMs' | 'retry'>
  retryAfter?: string | null
  nowUtc?: string
  jitterUnit?: number
  creditMetadataPresent?: boolean
}

export interface RetryDecision {
  retry: boolean
  reason: 'SUCCESS' | 'MISSING_CREDIT_METADATA' | 'AUTH_FAILURE' | 'NOT_RETRYABLE' | 'ATTEMPTS_EXHAUSTED' | 'RETRYABLE_STATUS' | 'TIMEOUT'
  delayMs: number
  nextAttemptNumber: number | null
}

export function parseRetryAfterMs(value: string | null | undefined, nowUtc?: string): number | null {
  if (value === null || value === undefined || value.trim() === '') return null
  const trimmed = value.trim()
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const milliseconds = Number(trimmed) * 1000
    return Number.isFinite(milliseconds) ? Math.max(0, Math.ceil(milliseconds)) : null
  }

  const target = Date.parse(trimmed)
  const now = nowUtc === undefined ? Number.NaN : Date.parse(nowUtc)
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null
  return Math.max(0, target - now)
}

function stop(reason: RetryDecision['reason']): RetryDecision {
  return { retry: false, reason, delayMs: 0, nextAttemptNumber: null }
}

function calculateBackoff(input: RetryDecisionInput): number {
  const jitter = Math.min(1, Math.max(0, input.jitterUnit ?? 0.5))
  const exponential = input.policy.retry.baseDelayMs * (2 ** Math.max(0, input.attemptNumber - 1))
  const jittered = exponential * (0.75 + jitter * 0.5)
  const boundedBackoff = Math.min(input.policy.retry.maximumDelayMs, Math.ceil(jittered))
  const retryAfter = parseRetryAfterMs(input.retryAfter, input.nowUtc) ?? 0
  return Math.max(input.policy.minimumDelayMs, boundedBackoff, retryAfter)
}

export function getRetryDecision(input: RetryDecisionInput): RetryDecision {
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) return stop('NOT_RETRYABLE')

  if ('httpStatus' in input.outcome) {
    if (input.outcome.httpStatus === 200) {
      return stop(input.creditMetadataPresent === false ? 'MISSING_CREDIT_METADATA' : 'SUCCESS')
    }
    if (input.policy.retry.nonRetryableHttpStatuses.includes(input.outcome.httpStatus)) return stop('AUTH_FAILURE')
    if (!input.policy.retry.retryableHttpStatuses.includes(input.outcome.httpStatus)) return stop('NOT_RETRYABLE')
  }

  if (input.attemptNumber >= input.policy.retry.maximumAttempts) return stop('ATTEMPTS_EXHAUSTED')
  const reason = 'timeout' in input.outcome ? 'TIMEOUT' : 'RETRYABLE_STATUS'
  return {
    retry: true,
    reason,
    delayMs: calculateBackoff(input),
    nextAttemptNumber: input.attemptNumber + 1,
  }
}

export interface RateDelayInput {
  minimumDelayMs: number
  lastRequestAtUtc: string | null
  nowUtc: string
  retryAfter?: string | null
}

export function getRateDelay(input: RateDelayInput): number {
  const retryAfter = parseRetryAfterMs(input.retryAfter, input.nowUtc) ?? 0
  if (input.lastRequestAtUtc === null) return retryAfter
  const previous = Date.parse(input.lastRequestAtUtc)
  const now = Date.parse(input.nowUtc)
  if (!Number.isFinite(previous) || !Number.isFinite(now)) throw new TypeError('Rate timestamps must be valid')
  return Math.max(0, input.minimumDelayMs - (now - previous), retryAfter)
}

export interface PaginationDecisionInput {
  currentPage: number
  nextCursor: string | null
  seenCursors: readonly string[]
  endpointPolicy: Pick<EndpointPolicy, 'maximumPages'>
  allowanceDecision: Pick<AllowanceDecision, 'allowed'>
  creditMetadataPresent: boolean
}

export interface PaginationDecision {
  allowed: boolean
  reason: 'NEXT_PAGE_ALLOWED' | 'ALLOWANCE_DENIED' | 'MISSING_CREDIT_METADATA' | 'NO_NEXT_PAGE' | 'PAGE_LIMIT_REACHED' | 'CURSOR_REPEATED' | 'INVALID_PAGE'
  nextPage: number | null
  cursor: string | null
}

export function canRequestNextPage(input: PaginationDecisionInput): PaginationDecision {
  const deny = (reason: PaginationDecision['reason']): PaginationDecision => ({ allowed: false, reason, nextPage: null, cursor: null })
  if (!input.allowanceDecision.allowed) return deny('ALLOWANCE_DENIED')
  if (!input.creditMetadataPresent) return deny('MISSING_CREDIT_METADATA')
  if (!Number.isInteger(input.currentPage) || input.currentPage < 1 || !Number.isInteger(input.endpointPolicy.maximumPages) || input.endpointPolicy.maximumPages < 1) return deny('INVALID_PAGE')
  if (input.nextCursor === null || input.nextCursor.trim() === '') return deny('NO_NEXT_PAGE')
  if (input.currentPage >= input.endpointPolicy.maximumPages) return deny('PAGE_LIMIT_REACHED')
  if (input.seenCursors.includes(input.nextCursor)) return deny('CURSOR_REPEATED')
  return { allowed: true, reason: 'NEXT_PAGE_ALLOWED', nextPage: input.currentPage + 1, cursor: input.nextCursor }
}
