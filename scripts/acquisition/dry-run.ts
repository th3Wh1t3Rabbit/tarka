import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { AllowanceUsage, CallLedgerRecord, CandidateEvidenceGraph, DryRunPlan, PlannedRequest, ProviderPolicy, ProvenanceRecord } from '../../src/acquisition/contracts.js'
import { normalizeFixturePages } from '../../src/acquisition/evidence/normalize.js'
import { projectPublicScenario } from '../../src/acquisition/evidence/public-export.js'
import { validateCandidateEvidenceGraph, validateCandidateSeed, validatePlannedRequest } from '../../src/acquisition/evidence/validators.js'
import { evaluateAllowance } from '../../src/acquisition/integrity/governor.js'
import { canonicalJson, hashCanonicalObject } from '../../src/acquisition/integrity/identity.js'
import { readLedger } from '../../src/acquisition/integrity/ledger.js'
import { canRequestNextPage } from '../../src/acquisition/integrity/retry.js'
import { loadReusableResponse, storeFixtureResponse } from '../../src/acquisition/integrity/store.js'
import { fail, getArgument, printReport, readJson, resolveContainedJsonFile, resolveLexicallyContainedPath, resolveRepositoryPath, writeJson } from './common.js'

function usageForAllowance(records: readonly CallLedgerRecord[], allowanceId: string): AllowanceUsage {
  const issued = records.filter((record) =>
    (record.status === 'COMPLETED' || record.status === 'SIMULATED')
    && record.redactedRequestMetadata.allowanceId === allowanceId,
  )
  return issued.reduce<AllowanceUsage>((usage, record) => ({
    issuedRequests: usage.issuedRequests + 1,
    projectedCredits: usage.projectedCredits + record.plannedCreditEstimate,
    endpointCalls: { ...usage.endpointCalls, [record.endpoint]: (usage.endpointCalls[record.endpoint] ?? 0) + 1 },
  }), { issuedRequests: 0, projectedCredits: 0, endpointCalls: {} })
}

async function main() {
  const planPath = await resolveContainedJsonFile(getArgument('--plan', true) as string, 'fixtures/acquisition/plans')
  const outputRoot = resolveRepositoryPath(getArgument('--output') ?? 'artifacts/acquisition/dry-run')
  const runAtUtc = getArgument('--now') ?? new Date().toISOString()
  const plan = await readJson<DryRunPlan>(planPath)
  if (plan.schemaVersion !== '1.0.0' || plan.mode !== 'FIXTURE_ONLY_NO_NETWORK' || !Array.isArray(plan.requests)) {
    throw new Error('Dry-run plan must be a G3 fixture-only plan')
  }
  const seed = validateCandidateSeed(plan.seed)
  const policy = await readJson<ProviderPolicy>('src/acquisition/config/provider-policy.json')
  const roots = { primaryRoot: path.join(outputRoot, 'primary'), mirrorRoot: path.join(outputRoot, 'mirror') }
  const ledgerPath = path.join(roots.primaryRoot, 'ledger', 'calls.jsonl')
  let usage = usageForAllowance(await readLedger(ledgerPath), plan.allowance.allowanceId)
  const stored = []
  const normalized = []

  for (const requestGroup of plan.requests) {
    const baseRequest = validatePlannedRequest(requestGroup.request)
    const endpointPolicy = policy.endpoints.find(({ endpoint }) => endpoint === baseRequest.endpoint)
    if (!endpointPolicy) throw new Error(`No endpoint policy for ${baseRequest.endpoint}`)
    if (requestGroup.pages.length === 0 || requestGroup.pages.length > endpointPolicy.maximumPages) throw new Error('Fixture pagination exceeds endpoint policy')
    if (requestGroup.pages[0]?.page !== 1 || requestGroup.pages[0]?.cursor !== null) throw new Error('Fixture pagination must start at page 1 with a null cursor')
    const normalizedPages = []
    const seenCursors: string[] = []

    for (let index = 0; index < requestGroup.pages.length; index += 1) {
      const page = requestGroup.pages[index]
      if (!page) throw new Error('Fixture page is missing')
      if (page.page !== index + 1 || page.page > endpointPolicy.maximumPages) throw new Error('Fixture pages must be contiguous and inside the endpoint page bound')
      const expectedCursor = index === 0 ? null : requestGroup.pages[index - 1]?.nextCursor ?? null
      if (page.cursor !== expectedCursor) throw new Error(`Fixture cursor chain breaks at page ${page.page}`)
      if (page.httpStatus !== 200) throw new Error(`Happy-path dry run requires HTTP 200 fixtures; received ${page.httpStatus}`)
      const request: PlannedRequest = validatePlannedRequest({ ...baseRequest, pagination: { page: page.page, cursor: page.cursor } })
      resolveLexicallyContainedPath(page.responseFixture, 'fixtures/acquisition/pages')
      const reusable = await loadReusableResponse(roots, ledgerPath, request)
      if (reusable === null) {
        const allowance = evaluateAllowance({ allowance: plan.allowance, usage, request, endpointPolicy, nowUtc: runAtUtc })
        if (!allowance.allowed) throw new Error(`Allowance denied before simulated page ${page.page}: ${allowance.reason}`)
        usage = allowance.nextUsage
      }

      const bodyBytes = reusable?.rawBody ?? await readFile(await resolveContainedJsonFile(page.responseFixture, 'fixtures/acquisition/pages'))
      const body = bodyBytes.toString('utf8')
      const result = await storeFixtureResponse({
        roots,
        ledgerPath,
        request,
        rawBody: bodyBytes,
        normalize: (exact) => JSON.parse(Buffer.from(exact).toString('utf8')) as never,
        plannedCreditEstimate: endpointPolicy.planningCreditCost,
        maximumAllowedCredits: plan.allowance.maximumProjectedCredits,
        attemptNumber: 1,
        startedAtUtc: runAtUtc,
        completedAtUtc: runAtUtc,
        httpStatus: page.httpStatus,
        extractResponseMetadata: (value) => {
          const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
          const metadata = record?.creditMetadata
          const pagination = record?.pagination
          const pageMetadata = typeof pagination === 'object' && pagination !== null && !Array.isArray(pagination) ? pagination : null
          const nextCursor = pageMetadata?.nextCursor
          if (!(nextCursor === null || typeof nextCursor === 'string')) throw new Error('Fixture response pagination cursor is invalid')
          return {
            returnedCreditMetadata: typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata) ? metadata : null,
            returnedRateMetadata: { fixtureHeadersPresent: Object.keys(page.responseHeaders).length > 0, fixtureNextCursor: nextCursor },
          }
        },
        redactedRequestMetadata: {
          allowanceId: plan.allowance.allowanceId,
          apiVersion: request.apiVersion,
          endpointClass: request.endpointClass,
          page: request.pagination.page,
          cursorPresent: request.pagination.cursor !== null,
          deliberateRefresh: request.refresh !== null,
        },
        normalizerVersion: request.normalizationContractVersion,
        finalStatus: 'SIMULATED',
      })
      stored.push(result)
      normalizedPages.push({ page: page.page, body, retrievedAtUtc: runAtUtc })

      const actualNextCursor = result.ledgerRecord.returnedRateMetadata?.fixtureNextCursor
      if (!(actualNextCursor === null || typeof actualNextCursor === 'string')) throw new Error(`Stored pagination metadata is missing after page ${page.page}`)
      if (actualNextCursor !== page.nextCursor) throw new Error(`Plan cursor differs from fixture response after page ${page.page}`)

      if (actualNextCursor !== null) {
        const nextPage = requestGroup.pages[index + 1]
        if (!nextPage || nextPage.cursor !== actualNextCursor) throw new Error(`Fixture cursor chain breaks after page ${page.page}`)
        const pagination = canRequestNextPage({ currentPage: page.page, nextCursor: actualNextCursor, seenCursors, endpointPolicy, allowanceDecision: { allowed: true }, creditMetadataPresent: result.ledgerRecord.returnedCreditMetadata !== null })
        if (!pagination.allowed) throw new Error(`Pagination denied after page ${page.page}: ${pagination.reason}`)
        if (pagination.nextPage !== nextPage.page || pagination.cursor !== nextPage.cursor) throw new Error(`Pagination decision differs from planned page ${nextPage.page}`)
        seenCursors.push(actualNextCursor)
      } else if (index !== requestGroup.pages.length - 1) {
        throw new Error(`Fixture includes pages after terminal page ${page.page}`)
      }
    }

    normalized.push(...normalizeFixturePages({ seed, request: baseRequest, requestedLens: seed.allowedLenses[0]!, pages: normalizedPages }))
  }

  const uniqueEvidence = [...new Map(normalized.map((record) => [record.evidenceId, record])).values()]
  const graph: CandidateEvidenceGraph = validateCandidateEvidenceGraph({
    schemaVersion: '1.0.0',
    candidateId: seed.candidateId,
    caseCutoffUtc: seed.caseCutoff,
    evidence: uniqueEvidence,
    derivedClaims: [{ claimId: 'fixture-record-continuity', evidenceIds: uniqueEvidence.map(({ evidenceId }) => evidenceId), statement: 'Fixture evidence remains linked to its stored source records.' }],
  })
  const rawHashes = [...new Set(stored.map(({ rawSha256 }) => rawSha256))]
  const normalizedHashes = [...new Set(stored.map(({ normalizedSha256 }) => normalizedSha256))]
  const graphSha256 = hashCanonicalObject(graph as never)
  const provenance: ProvenanceRecord = {
    schemaVersion: '1.0.0', candidateId: seed.candidateId, caseCutoffUtc: seed.caseCutoff,
    sourceRawSha256: rawHashes, normalizedSha256: normalizedHashes,
    candidateGraphSha256: graphSha256,
    publicScenarioSha256: hashCanonicalObject({ candidateId: seed.candidateId, evidence: uniqueEvidence } as never),
    generatedAtUtc: runAtUtc,
  }
  const publicDraft = projectPublicScenario(graph, provenance, policy)
  const finalizedProvenance = publicDraft.provenance
  const report = {
    command: 'acquisition:dry-run', status: 'PASS', mode: plan.mode,
    candidateId: seed.candidateId, simulatedPages: usage.issuedRequests,
    projectedCredits: usage.projectedCredits, evidenceRecords: graph.evidence.length,
    rawObjects: rawHashes.length, normalizedObjects: normalizedHashes.length,
    graphSha256, publicDraftCanonicalBytes: Buffer.byteLength(canonicalJson(publicDraft as never)),
    providerCalls: 0, credentialResolution: 'DISABLED_G3', nonlocalNetwork: 'NONE',
  }
  await writeJson(path.join(outputRoot, 'reports', 'candidate-evidence-graph.json'), graph)
  await writeJson(path.join(outputRoot, 'reports', 'provenance.json'), finalizedProvenance)
  await writeJson(path.join(outputRoot, 'reports', 'public-scenario-draft.json'), publicDraft)
  await writeJson(path.join(outputRoot, 'reports', 'dry-run-report.json'), report)
  printReport(report)
}

main().catch(fail)
