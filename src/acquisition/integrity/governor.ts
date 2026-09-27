import type { AllowanceUsage, EndpointPolicy, PlannedRequest, RequestAllowance } from '../contracts.js'

export type AllowanceDenialReason =
  | 'ALLOWED'
  | 'INVALID_ALLOWANCE'
  | 'INVALID_USAGE'
  | 'OUTSIDE_VALIDITY_WINDOW'
  | 'CANDIDATE_NOT_APPROVED'
  | 'ENDPOINT_NOT_APPROVED'
  | 'POLICY_MISMATCH'
  | 'REQUEST_LIMIT_EXCEEDED'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'ENDPOINT_LIMIT_MISSING'
  | 'ENDPOINT_LIMIT_EXCEEDED'

export interface AllowanceDecision {
  allowed: boolean
  reason: AllowanceDenialReason
  nextUsage: AllowanceUsage
  projectedRequestCredits: number
}

export interface AllowanceEvaluation {
  allowance: RequestAllowance
  usage: AllowanceUsage
  request: PlannedRequest
  endpointPolicy: EndpointPolicy
  nowUtc: string
}

function copyUsage(usage: AllowanceUsage): AllowanceUsage {
  return {
    issuedRequests: usage.issuedRequests,
    projectedCredits: usage.projectedCredits,
    endpointCalls: { ...usage.endpointCalls },
  }
}

function validNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deny(reason: AllowanceDenialReason, usage: AllowanceUsage, credits: number): AllowanceDecision {
  return { allowed: false, reason, nextUsage: copyUsage(usage), projectedRequestCredits: credits }
}

export function evaluateAllowance(input: AllowanceEvaluation): AllowanceDecision {
  const { allowance, usage, request, endpointPolicy } = input
  const credits = endpointPolicy.planningCreditCost
  const from = Date.parse(allowance.validFromUtc)
  const until = Date.parse(allowance.validUntilUtc)
  const now = Date.parse(input.nowUtc)

  if (
    allowance.schemaVersion !== '1.0.0'
    || typeof allowance.allowanceId !== 'string'
    || !allowance.allowanceId.trim()
    || typeof allowance.leadAuthorizationId !== 'string'
    || !allowance.leadAuthorizationId.trim()
    || !Array.isArray(allowance.approvedCandidateIds)
    || !allowance.approvedCandidateIds.every((value) => typeof value === 'string')
    || !Array.isArray(allowance.approvedEndpoints)
    || !allowance.approvedEndpoints.every((value) => typeof value === 'string')
    || !isRecord(allowance.maximumPerEndpointCalls)
    || !validNonNegativeInteger(allowance.maximumRequests)
    || !validNonNegativeInteger(allowance.maximumProjectedCredits)
    || !Number.isFinite(from)
    || !Number.isFinite(until)
    || from > until
    || !Number.isFinite(credits)
    || !validNonNegativeInteger(credits)
  ) return deny('INVALID_ALLOWANCE', usage, credits)

  if (
    !isRecord(usage.endpointCalls)
    || !validNonNegativeInteger(usage.issuedRequests)
    || !validNonNegativeInteger(usage.projectedCredits)
    || Object.values(usage.endpointCalls).some((count) => !validNonNegativeInteger(count))
  ) return deny('INVALID_USAGE', usage, credits)

  if (!Number.isFinite(now) || now < from || now > until) return deny('OUTSIDE_VALIDITY_WINDOW', usage, credits)
  if (typeof request.candidateId !== 'string' || !allowance.approvedCandidateIds.includes(request.candidateId)) return deny('CANDIDATE_NOT_APPROVED', usage, credits)
  if (typeof request.endpoint !== 'string' || !allowance.approvedEndpoints.includes(request.endpoint)) return deny('ENDPOINT_NOT_APPROVED', usage, credits)
  if (
    request.endpoint !== endpointPolicy.endpoint
    || request.apiVersion !== endpointPolicy.apiVersion
    || request.endpointClass !== endpointPolicy.endpointClass
    || !['FIXTURE_ONLY_G3', 'NANSEN_BUILD_TIME_G4A'].includes(endpointPolicy.transport)
  ) return deny('POLICY_MISMATCH', usage, credits)

  const endpointMaximum = allowance.maximumPerEndpointCalls[request.endpoint]
  if (endpointMaximum === undefined || !validNonNegativeInteger(endpointMaximum)) {
    return deny('ENDPOINT_LIMIT_MISSING', usage, credits)
  }

  const nextRequests = usage.issuedRequests + 1
  const nextCredits = usage.projectedCredits + credits
  const nextEndpointCalls = (usage.endpointCalls[request.endpoint] ?? 0) + 1

  if (nextRequests > allowance.maximumRequests) return deny('REQUEST_LIMIT_EXCEEDED', usage, credits)
  if (nextCredits > allowance.maximumProjectedCredits) return deny('CREDIT_LIMIT_EXCEEDED', usage, credits)
  if (nextEndpointCalls > endpointMaximum) return deny('ENDPOINT_LIMIT_EXCEEDED', usage, credits)

  return {
    allowed: true,
    reason: 'ALLOWED',
    projectedRequestCredits: credits,
    nextUsage: {
      issuedRequests: nextRequests,
      projectedCredits: nextCredits,
      endpointCalls: { ...usage.endpointCalls, [request.endpoint]: nextEndpointCalls },
    },
  }
}
