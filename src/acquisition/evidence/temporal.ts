import type {
  EndpointClass,
  EvidenceLens,
  EvidenceTemporalClass,
} from '../contracts.js'

export type TemporalRejectionReason =
  | 'NONE'
  | 'INVALID_CUTOFF'
  | 'INVALID_EVENT_TIME'
  | 'MISSING_EVENT_TIME'
  | 'POST_CUTOFF'
  | 'CURRENT_ONLY_SOURCE'
  | 'ENDPOINT_LENS_MISMATCH'

export interface TemporalClassification {
  temporalClass: EvidenceTemporalClass
  admissibleToChrono: boolean
  reason: TemporalRejectionReason
}

const ENDPOINT_LENSES: Readonly<Record<EndpointClass, readonly EvidenceLens[]>> = {
  'historical-events': ['ROUTE_SCAN', 'CONVERSION_TRACE'],
  'historical-balances': ['STATE_ECHO'],
  'current-relationships': ['ECHO_ONLY'],
  'current-portfolio': ['ECHO_ONLY'],
}

function isValidUtc(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value))
}

export function endpointAllowsLens(endpointClass: EndpointClass, lens: EvidenceLens): boolean {
  return ENDPOINT_LENSES[endpointClass].includes(lens)
}

export function classifyTemporalEvidence(input: {
  endpointClass: EndpointClass
  requestedLens: EvidenceLens
  observedEventTimeUtc: string | null
  caseCutoffUtc: string
}): TemporalClassification {
  if (!endpointAllowsLens(input.endpointClass, input.requestedLens)) {
    return { temporalClass: 'UNKNOWN', admissibleToChrono: false, reason: 'ENDPOINT_LENS_MISMATCH' }
  }

  if (!isValidUtc(input.caseCutoffUtc)) {
    return { temporalClass: 'UNKNOWN', admissibleToChrono: false, reason: 'INVALID_CUTOFF' }
  }

  if (input.endpointClass === 'current-relationships' || input.endpointClass === 'current-portfolio') {
    return { temporalClass: 'CURRENT_ONLY', admissibleToChrono: false, reason: 'CURRENT_ONLY_SOURCE' }
  }

  if (input.observedEventTimeUtc === null) {
    return { temporalClass: 'UNKNOWN', admissibleToChrono: false, reason: 'MISSING_EVENT_TIME' }
  }

  if (!isValidUtc(input.observedEventTimeUtc)) {
    return { temporalClass: 'UNKNOWN', admissibleToChrono: false, reason: 'INVALID_EVENT_TIME' }
  }

  if (Date.parse(input.observedEventTimeUtc) > Date.parse(input.caseCutoffUtc)) {
    return { temporalClass: 'UNKNOWN', admissibleToChrono: false, reason: 'POST_CUTOFF' }
  }

  return { temporalClass: 'HISTORICAL_AT_CUTOFF', admissibleToChrono: true, reason: 'NONE' }
}

