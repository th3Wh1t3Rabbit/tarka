import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  CandidateEvidenceGraph,
  CandidateSeed,
  NormalizedEvidenceRecord,
  PlannedRequest,
  ProvenanceRecord,
  ProviderPolicy,
} from '../../src/acquisition/contracts'
import { normalizeFixturePages } from '../../src/acquisition/evidence/normalize'
import { lintPublicScenario, projectPublicScenario } from '../../src/acquisition/evidence/public-export'
import { scoreCase } from '../../src/acquisition/evidence/score'
import { classifyTemporalEvidence, endpointAllowsLens } from '../../src/acquisition/evidence/temporal'
import {
  EvidenceValidationError,
  validateCandidateEvidenceGraph,
  validateCandidateSeed,
  validateNormalizedEvidenceRecord,
  validatePlannedRequest,
  validateProvenanceRecord,
  validatePublicScenarioDraft,
} from '../../src/acquisition/evidence/validators'

const fixture = (path: string): string => readFileSync(resolve(process.cwd(), 'fixtures/acquisition', path), 'utf8')
const providerPolicy = JSON.parse(readFileSync(resolve(process.cwd(), 'src/acquisition/config/provider-policy.json'), 'utf8')) as ProviderPolicy

const seed: CandidateSeed = {
  candidateId: 'fixture-candidate-alpha',
  label: 'Synthetic acquisition-control fixture',
  caseCutoff: '2024-03-01T23:59:59Z',
  requestedWindow: { start: '2024-03-01T00:00:00Z', end: '2024-03-01T23:59:59Z' },
  purposeIds: ['fixture-route-proof'],
  allowedLenses: ['ROUTE_SCAN'],
}

const request: PlannedRequest = {
  identityVersion: '1.0.0',
  endpoint: '/fixture/v1/historical/events',
  endpointClass: 'historical-events',
  apiVersion: 'fixture-v1',
  requestBody: { fixture: 'events' },
  candidateId: seed.candidateId,
  purposeId: seed.purposeIds[0]!,
  temporalWindow: { ...seed.requestedWindow },
  normalizationContractVersion: '1.0.0',
  pagination: { page: 1, cursor: null },
  refresh: null,
}

const normalizedRecord: NormalizedEvidenceRecord = {
  schemaVersion: '1.0.0',
  evidenceId: 'fixture-candidate-alpha:historical-events:event-001',
  candidateId: seed.candidateId,
  sourceEndpoint: request.endpoint,
  endpointClass: request.endpointClass,
  requestedStartUtc: request.temporalWindow.start,
  requestedEndUtc: request.temporalWindow.end,
  sourceRetrievedAtUtc: '2026-09-14T12:00:00Z',
  observedEventTimeUtc: '2024-03-01T10:00:00Z',
  temporalClass: 'HISTORICAL_AT_CUTOFF',
  caseCutoffUtc: seed.caseCutoff,
  admissibleToChrono: true,
  requestedLens: 'ROUTE_SCAN',
  sourceRawSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  facts: { eventId: 'event-001', kind: 'TRANSFER', fromEntity: 'origin', toEntity: 'fork', asset: 'UNIT', amount: 24, blockNumber: 100 },
}

const graph: CandidateEvidenceGraph = {
  schemaVersion: '1.0.0',
  candidateId: seed.candidateId,
  caseCutoffUtc: seed.caseCutoff,
  evidence: [normalizedRecord],
  derivedClaims: [{ claimId: 'claim-route', evidenceIds: [normalizedRecord.evidenceId], statement: 'Fixture route is fully sourced.' }],
}

const provenance: ProvenanceRecord = {
  schemaVersion: '1.0.0',
  candidateId: seed.candidateId,
  caseCutoffUtc: seed.caseCutoff,
  sourceRawSha256: [normalizedRecord.sourceRawSha256],
  normalizedSha256: ['bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
  candidateGraphSha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  publicScenarioSha256: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  generatedAtUtc: '2026-09-14T12:00:00Z',
}

describe('strict acquisition evidence validators', () => {
  it('accepts all six generic typed layers used by evidence controls', () => {
    expect(validateCandidateSeed(seed)).toEqual(seed)
    expect(validatePlannedRequest(request)).toEqual(request)
    expect(validateNormalizedEvidenceRecord(normalizedRecord)).toEqual(normalizedRecord)
    expect(validateCandidateEvidenceGraph(graph)).toEqual(graph)
    expect(validateProvenanceRecord(provenance)).toEqual(provenance)
    const publicDraft = projectPublicScenario(graph, provenance, providerPolicy)
    expect(validatePublicScenarioDraft(publicDraft)).toEqual(publicDraft)
  })

  it('rejects unknown fields, invalid windows, and non-fixture request endpoints', () => {
    expect(() => validateCandidateSeed({ ...seed, silentDrift: true })).toThrow(/unexpected or missing keys/)
    expect(() => validateCandidateSeed({ ...seed, requestedWindow: { start: seed.caseCutoff, end: seed.requestedWindow.start } })).toThrow(/start must not follow end/)
    expect(() => validatePlannedRequest({ ...request, endpoint: 'https://nonlocal.invalid/provider' })).toThrow(/fixture-only/)
  })

  it('rejects graph identity drift, dangling claims, missing hashes, and derived temporal lies', () => {
    expect(() => validateCandidateEvidenceGraph({ ...graph, evidence: [{ ...normalizedRecord, candidateId: 'other' }] })).toThrow(/must match graph/)
    expect(() => validateCandidateEvidenceGraph({ ...graph, derivedClaims: [{ claimId: 'dangling', evidenceIds: ['not-present'], statement: 'Invalid.' }] })).toThrow(/must reference/)
    expect(() => validateProvenanceRecord({ ...provenance, sourceRawSha256: [] })).toThrow(/source hashes/)
    expect(() => validateNormalizedEvidenceRecord({ ...normalizedRecord, temporalClass: 'CURRENT_ONLY' })).toThrow(/derived class/)
  })
})

describe('temporal firewall and endpoint-to-lens mapping', () => {
  it('admits only mapped, at-or-before-cutoff historical observations', () => {
    expect(endpointAllowsLens('historical-events', 'ROUTE_SCAN')).toBe(true)
    expect(endpointAllowsLens('historical-events', 'STATE_ECHO')).toBe(false)
    expect(classifyTemporalEvidence({ endpointClass: 'historical-events', requestedLens: 'ROUTE_SCAN', observedEventTimeUtc: seed.caseCutoff, caseCutoffUtc: seed.caseCutoff })).toEqual({ temporalClass: 'HISTORICAL_AT_CUTOFF', admissibleToChrono: true, reason: 'NONE' })
  })

  it.each([
    {
      name: 'post-cutoff',
      input: { endpointClass: 'historical-events' as const, requestedLens: 'ROUTE_SCAN' as const, observedEventTimeUtc: '2024-03-02T00:00:00Z', caseCutoffUtc: seed.caseCutoff },
      expected: { temporalClass: 'UNKNOWN', admissibleToChrono: false, reason: 'POST_CUTOFF' },
    },
    {
      name: 'current-only',
      input: { endpointClass: 'current-relationships' as const, requestedLens: 'ECHO_ONLY' as const, observedEventTimeUtc: '2024-03-01T10:00:00Z', caseCutoffUtc: seed.caseCutoff },
      expected: { temporalClass: 'CURRENT_ONLY', admissibleToChrono: false, reason: 'CURRENT_ONLY_SOURCE' },
    },
    {
      name: 'unknown time',
      input: { endpointClass: 'historical-balances' as const, requestedLens: 'STATE_ECHO' as const, observedEventTimeUtc: null, caseCutoffUtc: seed.caseCutoff },
      expected: { temporalClass: 'UNKNOWN', admissibleToChrono: false, reason: 'MISSING_EVENT_TIME' },
    },
    {
      name: 'lens mismatch',
      input: { endpointClass: 'current-portfolio' as const, requestedLens: 'ROUTE_SCAN' as const, observedEventTimeUtc: null, caseCutoffUtc: seed.caseCutoff },
      expected: { temporalClass: 'UNKNOWN', admissibleToChrono: false, reason: 'ENDPOINT_LENS_MISMATCH' },
    },
  ])('classifies $name evidence without leaking it into Chrono truth', ({ input, expected }) => {
    expect(classifyTemporalEvidence(input)).toEqual(expected)
  })
})

describe('fixture normalization', () => {
  const pages = [
    { page: 1, body: fixture('pages/events-page-1.json'), retrievedAtUtc: '2026-09-14T12:00:00Z' },
    { page: 2, body: fixture('pages/events-page-2-overlap.json'), retrievedAtUtc: '2026-09-14T12:00:01Z' },
    { page: 3, body: fixture('pages/events-page-3-empty.json'), retrievedAtUtc: '2026-09-14T12:00:02Z' },
  ]

  it('normalizes multi-page data, dedupes overlap, accepts an empty final page, and is deterministic', () => {
    const normalized = normalizeFixturePages({ seed, request, requestedLens: 'ROUTE_SCAN', pages })
    const reversed = normalizeFixturePages({ seed, request, requestedLens: 'ROUTE_SCAN', pages: [...pages].reverse() })
    expect(normalized).toHaveLength(3)
    expect(normalized.map(({ evidenceId }) => evidenceId)).toEqual([
      'fixture-candidate-alpha:historical-events:event-001',
      'fixture-candidate-alpha:historical-events:event-002',
      'fixture-candidate-alpha:historical-events:event-003',
    ])
    expect(reversed).toEqual(normalized)
  })

  it('rejects malformed JSON, provider schema drift, and post-cutoff observations', () => {
    expect(() => normalizeFixturePages({ seed, request, requestedLens: 'ROUTE_SCAN', pages: [{ page: 1, body: fixture('pages/malformed-json.json'), retrievedAtUtc: '2026-09-14T12:00:00Z' }] })).toThrow(/malformed JSON/)
    expect(() => normalizeFixturePages({ seed, request, requestedLens: 'ROUTE_SCAN', pages: [{ page: 1, body: fixture('pages/schema-drift.json'), retrievedAtUtc: '2026-09-14T12:00:00Z' }] })).toThrow(/schema drift/)
    expect(() => normalizeFixturePages({ seed, request, requestedLens: 'ROUTE_SCAN', pages: [{ page: 1, body: fixture('pages/post-cutoff.json'), retrievedAtUtc: '2026-09-14T12:00:00Z' }] })).toThrow(EvidenceValidationError)
  })

  it('rejects changed data hidden inside overlapping pagination', () => {
    const changedPage = pages[1]!.body.replace('"amount":17', '"amount":16')
    expect(() => normalizeFixturePages({ seed, request, requestedLens: 'ROUTE_SCAN', pages: [pages[0]!, { ...pages[1]!, body: changedPage }] })).toThrow(/changed between pages/)
  })
})

describe('default-deny public projection and export lint', () => {
  it('projects only explicit public fields with source hashes and passes strict lint', () => {
    const privateGraph: CandidateEvidenceGraph = { ...graph, evidence: [{ ...normalizedRecord, facts: { ...normalizedRecord.facts, internalAnnotation: 'must not leave private graph' } }] }
    const projected = projectPublicScenario(privateGraph, provenance, providerPolicy)
    expect(projected.evidence[0]?.facts).not.toHaveProperty('internalAnnotation')
    expect(projected.evidence[0]?.sourceHash).toBe(normalizedRecord.sourceRawSha256)
    expect(lintPublicScenario(projected)).toEqual({ ok: true, errors: [] })
  })

  it('binds projection to one exact centrally configured public endpoint', () => {
    const missingEndpointPolicy: ProviderPolicy = { ...providerPolicy, endpoints: providerPolicy.endpoints.filter(({ endpoint }) => endpoint !== normalizedRecord.sourceEndpoint) }
    expect(() => projectPublicScenario(graph, provenance, missingEndpointPolicy)).toThrow(/missing or ambiguous/)

    const mismatchedClassPolicy: ProviderPolicy = {
      ...providerPolicy,
      endpoints: providerPolicy.endpoints.map((entry) => entry.endpoint === normalizedRecord.sourceEndpoint ? { ...entry, endpointClass: 'historical-balances' } : entry),
    }
    expect(() => projectPublicScenario(graph, provenance, mismatchedClassPolicy)).toThrow(/class does not match/)

    const restrictedPolicy: ProviderPolicy = {
      ...providerPolicy,
      endpoints: providerPolicy.endpoints.map((entry) => entry.endpoint === normalizedRecord.sourceEndpoint ? { ...entry, redistribution: 'RESTRICTED' } : entry),
    }
    expect(() => projectPublicScenario(graph, provenance, restrictedPolicy)).toThrow(/not PUBLIC_ALLOWLISTED/)
  })

  it('rejects nested values under approved fact keys in both projection and lint', () => {
    const nestedGraph: CandidateEvidenceGraph = { ...graph, evidence: [{ ...normalizedRecord, facts: { ...normalizedRecord.facts, phase: { name: 'before' } } }] }
    expect(() => projectPublicScenario(nestedGraph, provenance, providerPolicy)).toThrow(/phase must be an approved primitive/)

    const draft = projectPublicScenario(graph, provenance, providerPolicy) as unknown as Record<string, unknown>
    const evidence = draft.evidence as Array<Record<string, unknown>>
    const facts = evidence[0]!.facts as Record<string, unknown>
    facts.phase = ['before']
    expect(lintPublicScenario(draft).errors.join(' ')).toMatch(/public facts must be primitives/)
  })

  it('rejects current-only, unknown, or post-cutoff evidence from public Chrono truth', () => {
    const currentOnly: NormalizedEvidenceRecord = {
      ...normalizedRecord,
      sourceEndpoint: '/fixture/v1/current/relationships',
      endpointClass: 'current-relationships',
      requestedLens: 'ECHO_ONLY',
      temporalClass: 'CURRENT_ONLY',
      admissibleToChrono: false,
    }
    expect(() => projectPublicScenario({ ...graph, evidence: [currentOnly], derivedClaims: [{ ...graph.derivedClaims[0]!, evidenceIds: [currentOnly.evidenceId] }] }, provenance, providerPolicy)).toThrow(/not admissible/)
    const draft = projectPublicScenario(graph, provenance, providerPolicy)
    const postCutoff = structuredClone(draft) as unknown as Record<string, unknown>
    const evidence = postCutoff.evidence as Array<Record<string, unknown>>
    evidence[0]!.observedEventTimeUtc = '2024-03-02T00:00:00Z'
    expect(lintPublicScenario(postCutoff).errors.join(' ')).toMatch(/post-cutoff/)
  })

  it('rejects prohibited fields, raw envelopes, endpoint families, and absent provenance hashes', () => {
    const prohibited = JSON.parse(fixture('public/prohibited-field.json')) as unknown
    expect(lintPublicScenario(prohibited).errors.join(' ')).toMatch(/prohibited public field/)
    const draft = projectPublicScenario(graph, provenance, providerPolicy) as unknown as Record<string, unknown>
    const evidence = draft.evidence as Array<Record<string, unknown>>
    evidence[0]!.responseHeaders = { fixture: 'never public' }
    evidence[0]!.facts = { eventId: 'event-001', kind: 'smart-money endpoint' }
    const draftProvenance = draft.provenance as Record<string, unknown>
    draftProvenance.sourceRawSha256 = []
    expect(lintPublicScenario(draft).errors.join(' ')).toMatch(/raw-envelope marker/)
    expect(lintPublicScenario(draft).errors.join(' ')).toMatch(/prohibited or restricted material/)
    expect(lintPublicScenario(draft).errors.join(' ')).toMatch(/source hashes are required/)
  })

  it.each([
    ['address labels', 'addressLabel', 'REDACTED'],
    ['Smart Money holdings', 'smartMoneyHoldings', 'REDACTED'],
    ['Smart Money trades', 'smartMoneyTrades', 'REDACTED'],
    ['prohibited endpoint family', 'kind', '/fixture/v1/current/relationships'],
    ['unknown public fields', 'internalAnnotation', 'REDACTED'],
  ])('rejects %s', (_name, key, value) => {
    const draft = projectPublicScenario(graph, provenance, providerPolicy) as unknown as Record<string, unknown>
    const evidence = draft.evidence as Array<Record<string, unknown>>
    evidence[0]!.facts = { eventId: 'event-001', [key]: value }
    expect(lintPublicScenario(draft).ok).toBe(false)
  })

  it('does not apply word-wide bans to ordinary allowed trade or perpetual values', () => {
    const draft = projectPublicScenario(graph, provenance, providerPolicy) as unknown as Record<string, unknown>
    const evidence = draft.evidence as Array<Record<string, unknown>>
    evidence[0]!.facts = { eventId: 'event-001', kind: 'perpetual trade' }
    expect(lintPublicScenario(draft).errors.join(' ')).not.toMatch(/prohibited or restricted material/)
  })

  it('detects a credential-like value constructed only at test runtime', () => {
    const draft = projectPublicScenario(graph, provenance, providerPolicy) as unknown as Record<string, unknown>
    const evidence = draft.evidence as Array<Record<string, unknown>>
    const facts = evidence[0]!.facts as Record<string, unknown>
    facts.note = [['s', 'k'].join(''), ['fixture', '0123456789abcdef'].join('')].join('-')
    expect(lintPublicScenario(draft).errors.join(' ')).toMatch(/credential-like value/)
  })
})

describe('deterministic 100-point candidate scoring', () => {
  it('scores all eight weighted categories and qualifies only against an explicit threshold', () => {
    const passing = JSON.parse(fixture('scores/passing.json')) as Parameters<typeof scoreCase>[0]
    expect(scoreCase(passing)).toEqual({ schemaVersion: '1.0.0', candidateId: 'fixture-score-passing', categories: passing.categories, total: 92, fatalDefects: [], eligible: true })
    expect(scoreCase({ ...passing, eligibilityThreshold: 93 }).eligible).toBe(false)
  })

  it('applies fatal-defect override even to a perfect score', () => {
    const fatal = JSON.parse(fixture('scores/fatal-override.json')) as Parameters<typeof scoreCase>[0]
    expect(scoreCase(fatal)).toMatchObject({ total: 100, fatalDefects: ['LOOK_AHEAD_LEAKAGE'], eligible: false })
  })

  it('rejects missing categories, weight overflow, and unknown fatal defects', () => {
    const passing = JSON.parse(fixture('scores/passing.json')) as Parameters<typeof scoreCase>[0]
    const missing = structuredClone(passing) as unknown as { categories: Record<string, number> }
    delete missing.categories.visualWorldReadability
    expect(() => scoreCase(missing as Parameters<typeof scoreCase>[0])).toThrow(/eight canonical categories/)
    expect(() => scoreCase({ ...passing, categories: { ...passing.categories, proofClosureAuditability: 21 } })).toThrow(/0 to 20/)
    expect(() => scoreCase({ ...passing, fatalDefects: ['NOT_A_DEFECT'] as never[] })).toThrow(/unknown or duplicate/)
  })
})
