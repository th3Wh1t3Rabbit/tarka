import { createHash } from 'node:crypto'
import type {
  CandidateSeed,
  EvidenceLens,
  JsonObject,
  NormalizedEvidenceRecord,
  PlannedRequest,
} from '../contracts.js'
import { classifyTemporalEvidence } from './temporal.js'
import { EvidenceValidationError, validateCandidateSeed, validateNormalizedEvidenceRecord, validatePlannedRequest } from './validators.js'

export interface FixtureBodyPage {
  page: number
  body: string
  retrievedAtUtc: string
}

export interface NormalizeFixturePagesInput {
  seed: CandidateSeed
  request: PlannedRequest
  requestedLens: EvidenceLens
  pages: FixtureBodyPage[]
}

const FIXTURE_KEYS = ['schemaVersion', 'data', 'pagination', 'creditMetadata'] as const
const RECORD_KEYS = ['recordId', 'observedEventTimeUtc', 'facts'] as const
const PAGINATION_KEYS = ['page', 'nextCursor'] as const

function strictRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new EvidenceValidationError(`${path}: must be an object`)
  return value as Record<string, unknown>
}

function assertKeys(record: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(record).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new EvidenceValidationError(`${path}: schema drift; expected only ${wanted.join(', ')}`)
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function normalizeFixturePages(input: NormalizeFixturePagesInput): NormalizedEvidenceRecord[] {
  const seed = validateCandidateSeed(input.seed)
  const request = validatePlannedRequest(input.request)
  if (request.candidateId !== seed.candidateId) throw new EvidenceValidationError('normalize: request candidate does not match seed')
  if (!seed.purposeIds.includes(request.purposeId)) throw new EvidenceValidationError('normalize: request purpose is not in the candidate seed')
  if (!seed.allowedLenses.includes(input.requestedLens)) throw new EvidenceValidationError('normalize: requested lens is not in the candidate seed')
  if (input.pages.length === 0) throw new EvidenceValidationError('normalize: at least one fixture page is required')

  const pages = [...input.pages].sort((a, b) => a.page - b.page)
  const seenPageNumbers = new Set<number>()
  const records = new Map<string, { record: NormalizedEvidenceRecord; canonicalFacts: string }>()

  pages.forEach((page, pageIndex) => {
    if (!Number.isInteger(page.page) || page.page < 1 || seenPageNumbers.has(page.page)) throw new EvidenceValidationError(`normalize.pages[${pageIndex}].page: must be a unique positive integer`)
    seenPageNumbers.add(page.page)
    let parsed: unknown
    try {
      parsed = JSON.parse(page.body) as unknown
    } catch {
      throw new EvidenceValidationError(`normalize.pages[${pageIndex}]: malformed JSON`)
    }
    const fixture = strictRecord(parsed, `normalize.pages[${pageIndex}]`)
    assertKeys(fixture, FIXTURE_KEYS, `normalize.pages[${pageIndex}]`)
    if (fixture.schemaVersion !== '1.0.0') throw new EvidenceValidationError(`normalize.pages[${pageIndex}].schemaVersion: unsupported fixture schema`)
    if (!Array.isArray(fixture.data)) throw new EvidenceValidationError(`normalize.pages[${pageIndex}].data: must be an array`)
    const pagination = strictRecord(fixture.pagination, `normalize.pages[${pageIndex}].pagination`)
    assertKeys(pagination, PAGINATION_KEYS, `normalize.pages[${pageIndex}].pagination`)
    if (pagination.page !== page.page || !(pagination.nextCursor === null || typeof pagination.nextCursor === 'string')) throw new EvidenceValidationError(`normalize.pages[${pageIndex}].pagination: does not match page metadata`)
    if (!(fixture.creditMetadata === null || (typeof fixture.creditMetadata === 'object' && !Array.isArray(fixture.creditMetadata)))) throw new EvidenceValidationError(`normalize.pages[${pageIndex}].creditMetadata: must be an object or null`)

    const sourceRawSha256 = sha256(page.body)
    fixture.data.forEach((rawRecord, recordIndex) => {
      const item = strictRecord(rawRecord, `normalize.pages[${pageIndex}].data[${recordIndex}]`)
      assertKeys(item, RECORD_KEYS, `normalize.pages[${pageIndex}].data[${recordIndex}]`)
      if (typeof item.recordId !== 'string' || item.recordId.length === 0) throw new EvidenceValidationError(`normalize.pages[${pageIndex}].data[${recordIndex}].recordId: must be a non-empty string`)
      if (!(item.observedEventTimeUtc === null || typeof item.observedEventTimeUtc === 'string')) throw new EvidenceValidationError(`normalize.pages[${pageIndex}].data[${recordIndex}].observedEventTimeUtc: must be a string or null`)
      const facts = strictRecord(item.facts, `normalize.pages[${pageIndex}].data[${recordIndex}].facts`) as JsonObject
      const classification = classifyTemporalEvidence({ endpointClass: request.endpointClass, requestedLens: input.requestedLens, observedEventTimeUtc: item.observedEventTimeUtc, caseCutoffUtc: seed.caseCutoff })
      const normalized = validateNormalizedEvidenceRecord({
        schemaVersion: '1.0.0',
        evidenceId: `${seed.candidateId}:${request.endpointClass}:${item.recordId}`,
        candidateId: seed.candidateId,
        sourceEndpoint: request.endpoint,
        endpointClass: request.endpointClass,
        requestedStartUtc: request.temporalWindow.start,
        requestedEndUtc: request.temporalWindow.end,
        sourceRetrievedAtUtc: page.retrievedAtUtc,
        observedEventTimeUtc: item.observedEventTimeUtc,
        temporalClass: classification.temporalClass,
        caseCutoffUtc: seed.caseCutoff,
        admissibleToChrono: classification.admissibleToChrono,
        requestedLens: input.requestedLens,
        sourceRawSha256,
        facts,
      })
      const recordFingerprint = canonical({ observedEventTimeUtc: normalized.observedEventTimeUtc, facts: normalized.facts })
      const previous = records.get(normalized.evidenceId)
      if (previous && previous.canonicalFacts !== recordFingerprint) throw new EvidenceValidationError(`normalize: overlapping record ${normalized.evidenceId} changed between pages`)
      if (!previous) records.set(normalized.evidenceId, { record: normalized, canonicalFacts: recordFingerprint })
    })
  })

  return [...records.values()].map(({ record }) => record).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))
}
