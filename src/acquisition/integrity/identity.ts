import { createHash } from 'node:crypto'

import type { JsonValue, PlannedRequest } from '../contracts.js'

function serializeCanonical(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null'

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON accepts only finite numbers')
    return JSON.stringify(value)
  }

  if (typeof value !== 'object') {
    throw new TypeError(`Canonical JSON cannot encode ${typeof value}`)
  }

  if (seen.has(value)) throw new TypeError('Canonical JSON cannot encode cyclic values')
  seen.add(value)

  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => serializeCanonical(item, seen)).join(',')}]`
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical JSON accepts only plain objects and arrays')
    }

    const objectValue = value as Record<string, unknown>
    const keys = Object.keys(objectValue).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${serializeCanonical(objectValue[key], seen)}`).join(',')}}`
  } finally {
    seen.delete(value)
  }
}

export function canonicalJson(value: JsonValue): string {
  return serializeCanonical(value, new Set())
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hashCanonicalObject(value: JsonValue): string {
  return sha256Hex(canonicalJson(value))
}

export function fingerprintRequest(request: PlannedRequest): string {
  if (request.identityVersion !== '1.0.0') {
    throw new TypeError('Unsupported request identity version')
  }

  if (request.refresh !== null && (!request.refresh.reason.trim() || !request.refresh.identity.trim())) {
    throw new TypeError('A deliberate refresh requires both a reason and a new identity')
  }

  return hashCanonicalObject({
    identityVersion: request.identityVersion,
    endpoint: request.endpoint,
    endpointClass: request.endpointClass,
    apiVersion: request.apiVersion,
    requestBody: request.requestBody,
    candidateId: request.candidateId,
    purposeId: request.purposeId,
    temporalWindow: request.temporalWindow,
    normalizationContractVersion: request.normalizationContractVersion,
    pagination: request.pagination,
    refresh: request.refresh,
  })
}
