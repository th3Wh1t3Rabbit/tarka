import type { CandidateEvidenceGraph, JsonObject, JsonPrimitive, ProvenanceRecord, ProviderPolicy, PublicScenarioDraft } from '../contracts.js'
import { hashCanonicalObject } from '../integrity/identity.js'
import { EvidenceValidationError, validateCandidateEvidenceGraph, validateProvenanceRecord, validatePublicScenarioDraft } from './validators.js'

export interface ExportLintResult {
  ok: boolean
  errors: string[]
}

const PUBLIC_FACT_FIELDS = new Set([
  'amount', 'asset', 'blockNumber', 'eventId', 'fromEntity', 'kind', 'phase', 'toEntity', 'transactionHash',
])
const PUBLIC_TOP_LEVEL_KEYS = new Set(['schemaVersion', 'candidateId', 'caseCutoffUtc', 'evidence', 'provenance'])
const PUBLIC_EVIDENCE_KEYS = new Set(['evidenceId', 'observedEventTimeUtc', 'temporalClass', 'lens', 'facts', 'sourceHash'])
const PROVENANCE_KEYS = new Set(['schemaVersion', 'candidateId', 'caseCutoffUtc', 'sourceRawSha256', 'normalizedSha256', 'candidateGraphSha256', 'publicScenarioSha256', 'generatedAtUtc'])
const PROHIBITED_FIELD = /(?:secret|credential|authorization|api[_-]?key|private[_-]?key|(?:address|entity|wallet|smart[_-]?money)[_-]?labels?|smart[_-]?money)/i
const RAW_MARKER = /^(?:requestFingerprint|requestHash|responseHeaders|bodySha256|bodyByteLength|rawResponse|rawEnvelope|providerRequestId|returnedCreditMetadata|returnedRateMetadata)$/i
const PROHIBITED_VALUE = /(?:^|[\s/_-])(?:smart[\s/_-]*money|address[\s/_-]*labels?|premium[\s/_-]*labels?|leaderboards?|agent[\s/_-]*endpoints?|web[\s/_-]*(?:search|fetch)|trade[\s/_-]*execution|portfolio[\s/_-]*endpoints?|related[\s/_-]*wallets?)(?:$|[\s/_-])/i
const SECRET_VALUE = /(?:^|\b)(?:sk-[A-Za-z0-9_-]{16,}|(?:api|secret|token|key)[_-][A-Za-z0-9_-]{16,})(?:$|\b)/i

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function isPublicPrimitive(value: unknown): value is JsonPrimitive {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
}

function unexpectedKeys(value: Record<string, unknown>, allowed: Set<string>, path: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${path}.${key}: field is not in the public schema`)
}

function scanProhibited(value: unknown, path: string, errors: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanProhibited(item, `${path}[${index}]`, errors))
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (PROHIBITED_FIELD.test(key)) errors.push(`${path}.${key}: prohibited public field`)
      if (RAW_MARKER.test(key)) errors.push(`${path}.${key}: raw-envelope marker is prohibited`)
      scanProhibited(item, `${path}.${key}`, errors)
    }
    return
  }
  if (typeof value === 'string') {
    if (SECRET_VALUE.test(value)) errors.push(`${path}: credential-like value is prohibited`)
    if (PROHIBITED_VALUE.test(value)) errors.push(`${path}: prohibited or restricted material is present`)
  }
}

export function canonicalPublicPayload(value: Pick<PublicScenarioDraft, 'schemaVersion' | 'candidateId' | 'caseCutoffUtc' | 'evidence'>): JsonObject {
  return { schemaVersion: value.schemaVersion, candidateId: value.candidateId, caseCutoffUtc: value.caseCutoffUtc, evidence: value.evidence } as unknown as JsonObject
}

export function projectPublicScenario(graphValue: CandidateEvidenceGraph, provenanceValue: ProvenanceRecord, providerPolicy: ProviderPolicy): PublicScenarioDraft {
  const graph = validateCandidateEvidenceGraph(graphValue)
  const provenance = validateProvenanceRecord(provenanceValue)
  if (provenance.candidateId !== graph.candidateId || provenance.caseCutoffUtc !== graph.caseCutoffUtc) throw new EvidenceValidationError('public projection: provenance does not match graph')

  const evidence = graph.evidence.map((record) => {
    if (!record.admissibleToChrono || record.temporalClass !== 'HISTORICAL_AT_CUTOFF' || record.observedEventTimeUtc === null || record.requestedLens === 'ECHO_ONLY') {
      throw new EvidenceValidationError(`public projection: evidence ${record.evidenceId} is not admissible to historical truth`)
    }
    const endpointPolicies = providerPolicy.endpoints.filter(({ endpoint }) => endpoint === record.sourceEndpoint)
    if (endpointPolicies.length !== 1) throw new EvidenceValidationError(`public projection: source endpoint ${record.sourceEndpoint} is missing or ambiguous in provider policy`)
    const endpointPolicy = endpointPolicies[0]!
    if (endpointPolicy.endpointClass !== record.endpointClass) throw new EvidenceValidationError(`public projection: source endpoint class does not match provider policy for ${record.sourceEndpoint}`)
    if (endpointPolicy.redistribution !== 'PUBLIC_ALLOWLISTED') throw new EvidenceValidationError(`public projection: source endpoint ${record.sourceEndpoint} is not PUBLIC_ALLOWLISTED`)
    if (!endpointPolicy.allowedLenses.includes(record.requestedLens)) throw new EvidenceValidationError(`public projection: lens is not approved by provider policy for ${record.sourceEndpoint}`)
    const approvedFacts = Object.entries(record.facts).filter(([key]) => PUBLIC_FACT_FIELDS.has(key))
    const nonPrimitive = approvedFacts.find(([, value]) => !isPublicPrimitive(value))
    if (nonPrimitive) throw new EvidenceValidationError(`public projection: fact ${nonPrimitive[0]} must be an approved primitive`)
    const facts = Object.fromEntries(approvedFacts) as JsonObject
    if (Object.keys(facts).length === 0) throw new EvidenceValidationError(`public projection: evidence ${record.evidenceId} has no allowlisted facts`)
    return { evidenceId: record.evidenceId, observedEventTimeUtc: record.observedEventTimeUtc, temporalClass: 'HISTORICAL_AT_CUTOFF' as const, lens: record.requestedLens, facts, sourceHash: record.sourceRawSha256 }
  })

  const payload = { schemaVersion: '1.0.0' as const, candidateId: graph.candidateId, caseCutoffUtc: graph.caseCutoffUtc, evidence }
  const draft: PublicScenarioDraft = {
    ...payload,
    provenance: {
      ...provenance,
      candidateGraphSha256: hashCanonicalObject(graph as never),
      publicScenarioSha256: hashCanonicalObject(canonicalPublicPayload(payload)),
    },
  }
  const lint = lintPublicScenario(draft, graph)
  if (!lint.ok) throw new EvidenceValidationError(`public projection rejected: ${lint.errors.join('; ')}`)
  return draft
}

export function lintPublicScenario(value: unknown, candidateGraph?: CandidateEvidenceGraph): ExportLintResult {
  const errors: string[] = []
  const root = asRecord(value)
  if (!root) return { ok: false, errors: ['PublicScenarioDraft: must be an object'] }
  unexpectedKeys(root, PUBLIC_TOP_LEVEL_KEYS, 'PublicScenarioDraft', errors)
  const evidence = Array.isArray(root.evidence) ? root.evidence : []
  evidence.forEach((item, index) => {
    const projection = asRecord(item)
    if (!projection) {
      errors.push(`PublicScenarioDraft.evidence[${index}]: must be an object`)
      return
    }
    unexpectedKeys(projection, PUBLIC_EVIDENCE_KEYS, `PublicScenarioDraft.evidence[${index}]`, errors)
    const facts = asRecord(projection.facts)
    if (facts) {
      unexpectedKeys(facts, PUBLIC_FACT_FIELDS, `PublicScenarioDraft.evidence[${index}].facts`, errors)
      for (const [key, fact] of Object.entries(facts)) {
        if (PUBLIC_FACT_FIELDS.has(key) && !isPublicPrimitive(fact)) errors.push(`PublicScenarioDraft.evidence[${index}].facts.${key}: public facts must be primitives`)
      }
    }
    if (typeof projection.observedEventTimeUtc === 'string' && typeof root.caseCutoffUtc === 'string' && Date.parse(projection.observedEventTimeUtc) > Date.parse(root.caseCutoffUtc)) errors.push(`PublicScenarioDraft.evidence[${index}]: post-cutoff evidence is prohibited`)
    if (projection.temporalClass !== 'HISTORICAL_AT_CUTOFF') errors.push(`PublicScenarioDraft.evidence[${index}]: only historical-at-cutoff evidence may be public`)
    if (typeof projection.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(projection.sourceHash)) errors.push(`PublicScenarioDraft.evidence[${index}].sourceHash: valid source hash is required`)
  })
  const provenance = asRecord(root.provenance)
  if (provenance) {
    unexpectedKeys(provenance, PROVENANCE_KEYS, 'PublicScenarioDraft.provenance', errors)
    if (!Array.isArray(provenance.sourceRawSha256) || provenance.sourceRawSha256.length === 0) errors.push('PublicScenarioDraft.provenance.sourceRawSha256: source hashes are required')
    if (!Array.isArray(provenance.normalizedSha256) || provenance.normalizedSha256.length === 0) errors.push('PublicScenarioDraft.provenance.normalizedSha256: normalized hashes are required')
    if (typeof provenance.publicScenarioSha256 === 'string' && /^[a-f0-9]{64}$/.test(provenance.publicScenarioSha256) && root.schemaVersion === '1.0.0' && typeof root.candidateId === 'string' && typeof root.caseCutoffUtc === 'string' && Array.isArray(root.evidence)) {
      const actualPublicHash = hashCanonicalObject(canonicalPublicPayload(root as unknown as PublicScenarioDraft))
      if (provenance.publicScenarioSha256 !== actualPublicHash) errors.push('PublicScenarioDraft.provenance.publicScenarioSha256: does not match the canonical public payload')
    }
    if (candidateGraph !== undefined) {
      try {
        const graph = validateCandidateEvidenceGraph(candidateGraph)
        if (graph.candidateId !== root.candidateId || graph.caseCutoffUtc !== root.caseCutoffUtc) errors.push('PublicScenarioDraft.provenance.candidateGraphSha256: graph identity does not match public draft')
        if (provenance.candidateGraphSha256 !== hashCanonicalObject(graph as never)) errors.push('PublicScenarioDraft.provenance.candidateGraphSha256: does not match the supplied candidate graph')
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'PublicScenarioDraft: candidate graph validation failed')
      }
    }
  } else {
    errors.push('PublicScenarioDraft.provenance: provenance is required')
  }
  if (provenance && Array.isArray(provenance.sourceRawSha256)) {
    const sourceHashes = new Set(provenance.sourceRawSha256)
    evidence.forEach((item, index) => {
      const projection = asRecord(item)
      if (projection && !sourceHashes.has(projection.sourceHash)) errors.push(`PublicScenarioDraft.evidence[${index}].sourceHash: must be declared by provenance`)
    })
  }
  scanProhibited(value, 'PublicScenarioDraft', errors)
  try {
    validatePublicScenarioDraft(value)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'PublicScenarioDraft: validation failed')
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)].sort() }
}
