import fs from 'node:fs'
import { ALLOWANCE, admitContract, buildPlan, freezeT1, logicalRequest } from '../nq5/planner.mjs'
import { freeze, identity } from '../nq5/schema.mjs'
import { readDurableRaw } from '../nq5/journal.mjs'
import { compilePublicIndex } from '../nq5/projection.mjs'
import { officialContract } from '../nq5/official.mjs'
import { ACTIVE, validateActiveSchema, validateSourceInstallation } from './authority.mjs'
import { assertCampaignEvidence } from './campaign-evidence.mjs'

export const LENS_FAMILIES = Object.freeze({ ACTIVITY: 'profiler/address/transactions', RELATIONSHIPS: 'profiler/address/counterparties', STATE: 'profiler/address/historical-balances', RECEIPT: 'transaction-with-token-transfer-lookup' })
const approvedRequests = new WeakMap(), approvedRows = new WeakMap(), observations = new WeakSet()
const seal = value => freeze({ ...value, hash: identity(value) })
const approve = request => { const value = freeze(request); approvedRequests.set(value, identity(value)); return value }
const originalContract = ({ hash, ...contract }) => { if (hash && identity(contract) !== hash) throw new Error('Contract digest mismatch.'); return contract }
const scenario = JSON.parse(fs.readFileSync(new URL('../../public/scenarios/euler-2023-false-exit/scenario.json', import.meta.url)))
function acceptedFixture(fixture) {
  if (fixture.mode !== 'ACCEPTED_FROZEN' || fixture.id !== scenario.scenarioId || fixture.cutoffUtc !== scenario.historicalCutoff || fixture.records.length !== scenario.evidence.length || fixture.records.some(record => {
    const original = scenario.evidence.find(item => item.id === record.id)
    return !original || record.transactionHash !== original.transactionHash || record.observedAtUtc !== original.observedAtUtc || record.provenance.lineage !== original.sourceLineageId || record.provenance.rawSha256 !== original.rawSha256 || record.provenance.normalizedSha256 !== original.normalizedSha256 || ![record.source, record.destination].every(address => original.facts.roleBindings.some(role => role.address === address))
  })) throw new Error('Accepted Euler seed identity required; synthetic frontier is not historical evidence.')
}
export function frontierPolicy(fixture) {
  acceptedFixture(fixture)
  return seal({ schemaVersion: '2.0.0', activeSourceIdentity: identity(ACTIVE), outcomeFloor: 1024, floorIsRequiredOutcomeNotPlanSize: true, maximumFrozenBatch: 256, qualificationCallsAllowed: false, credentialResolutionAllowed: false, fixedPageEnumeration: false, countDrivenTimeFragmentation: false, endpointFamilies: LENS_FAMILIES, historicalCutoffUtc: fixture.cutoffUtc, pageAdmission: ['previous counted terminal matches admitted request', 'dual durable raw bytes and hashes agree', 'current schema and allowlisted public projection pass', 'nonempty previous page explicitly says is_last_page=false', 'named unresolved question and gameplay/test consumer show marginal utility'], newSubjectAdmission: ['allowlisted durable normalized fact', 'pre-cutoff bounded parent coverage', 'exact fact identity and parent terminal lineage', 'named unresolved gap, not a target-count deficit'], deterministicOrder: 'canonical method/path/body identity ascending, take at most256', stops: ['last page', 'empty page', 'saturated utility even below1024', 'closed question or coverage cell', 'duplicate/equivalent request including prior batches, retries or local reuse', 'authority hold', 'protected reserve250 or parent ceilings'], routeToFloor: ['accepted page1 questions and exact receipts', 'only demonstrably necessary continuation pages', 'observed allowlisted subjects and exact-receipt gaps', 'revalidate utility and budget before each next bounded batch', 'continue until1024 unique counted successes or report unmet floor at a stop'], floorReachability: 'CONDITIONAL_ON_OBSERVED_USEFUL_FRONTIERS_NOT_PROVEN_BY_SPECULATIVE_ROWS', assumedFutureResponses: 0, promisedSuccesses: 0 })
}
function requestFor(fixture, seed, lens, phase = 'INCIDENT') {
  let from = scenario.historicalWindow.startUtc, to = fixture.cutoffUtc
  if (lens === 'STATE' && phase === 'BEFORE') { to = from; from = new Date(Date.parse(from) - 3600000).toISOString() }
  if (lens === 'STATE' && phase === 'AFTER') from = new Date(Date.parse(to) - 3600000).toISOString()
  const receipt = lens === 'RECEIPT', subject = receipt ? seed.transactionHash : seed.address
  const family = LENS_FAMILIES[lens], questionId = `QUESTION.T1.${lens}.${phase}.${subject}`
  const body = receipt ? { chain: 'ethereum', transaction_hash: subject } : { address: subject, chain: 'ethereum', date: { from, to }, pagination: { page: 1, per_page: 100 }, ...(lens === 'RELATIONSHIPS' ? { group_by: 'wallet' } : {}) }
  return { family, path: '/api/v1/' + family, method: 'POST', lens, purpose: receipt ? 'EXACT_RECEIPT' : lens === 'STATE' ? `STATE_${phase}` : lens === 'RELATIONSHIPS' ? 'COUNTERPARTY_RANKING' : 'ANCHOR_ACTIVITY_PAGE', questionId, businessQuestion: `Which bounded ${lens.toLowerCase()} facts for ${seed.recordId} in ${from} through ${to} test the ${phase.toLowerCase()} question?`, consumers: [`CASEBOARD.${seed.recordId}`, `TEST.T1.${lens}.${phase}`, `COVERAGE.${questionId}`], lineage: [seed.lineage], body, novelty: `Resolve the named ${questionId} gap; ${lens === 'STATE' ? 'state corroborates but does not cause an exact event' : 'do not infer identity or intent'}.`, stopRule: 'Stop at durable last-page or empty evidence, closed coverage, saturated utility, duplicate identity, authority hold or protected budget; never pad toward1024.', coverageKey: { subject_id: subject, time_window_id: `${from}/${to}`, question_lens: lens, page_or_partition_id: receipt ? 'EXACT_RECEIPT' : 'PAGE.1' }, coverageCells: [`CELL.${identity({ questionId, body })}`], partition: { page: 1, maximumPages: receipt ? 1 : 4096, minimumWindowSeconds: Math.max(3600, (Date.parse(to) - Date.parse(from)) / 1000) }, frontierProof: { kind: seed.parentTerminalIdentity ? 'DURABLE_RESULT' : 'ACCEPTED_SEED', recordId: seed.recordId, ...(seed.parentTerminalIdentity ? { parentTerminalIdentity: seed.parentTerminalIdentity, normalizedFactIdentity: seed.factIdentity } : {}) } }
}
export function seedQuestions(fixture) {
  acceptedFixture(fixture)
  const subjects = new Map(), receipts = new Map()
  for (const record of fixture.records) {
    for (const address of [record.source, record.destination]) if (!subjects.has(address)) subjects.set(address, { address, recordId: record.id, lineage: record.provenance.lineage })
    if (record.exactRelationship && !receipts.has(record.transactionHash)) receipts.set(record.transactionHash, { transactionHash: record.transactionHash, recordId: record.id, lineage: record.provenance.lineage })
  }
  const requests = [...subjects.values()].flatMap(seed => [requestFor(fixture, seed, 'ACTIVITY'), requestFor(fixture, seed, 'RELATIONSHIPS'), requestFor(fixture, seed, 'STATE', 'BEFORE'), requestFor(fixture, seed, 'STATE', 'AFTER')]).concat([...receipts.values()].map(seed => requestFor(fixture, seed, 'RECEIPT')))
  return requests.sort((a, b) => logicalRequest(a).localeCompare(logicalRequest(b))).map(approve)
}
export function freezeNextBatch(requests, contracts, account, priorLogicalIds = [], limit = 256, campaignEvidence = null) {
  validateSourceInstallation()
  if (!Number.isInteger(limit) || limit < 1 || limit > 256 || !requests.length || requests.length > limit) throw new Error('Only next bounded nonempty batch, at most256, may freeze.')
  const history = assertCampaignEvidence(campaignEvidence)
  if (identity([...priorLogicalIds].sort()) !== identity([...history.logicalIds].sort())) throw new Error('Prior requests and durable campaign accounting must agree; unknown spending blocks freeze.')
  const seen = new Set(priorLogicalIds)
  for (const request of requests) {
    if (approvedRequests.get(request) !== identity(request)) throw new Error('Request lacks verified seed or durable frontier admission; serialized markers are not proof.')
    if (request.frontierProof.kind !== 'ACCEPTED_SEED' && !history?.terminals.some(item => item.terminalIdentity === request.frontierProof.parentTerminalIdentity && item.record.qualification_counted)) throw new Error('Current cumulative evidence lacks the exact durable parent terminal.')
    const id = logicalRequest(request)
    if (seen.has(id)) throw new Error('Duplicate, retry or local reuse cannot inflate the next batch.')
    seen.add(id)
  }
  const sorted = [...requests].sort((a, b) => logicalRequest(a).localeCompare(logicalRequest(b)))
  const main = buildPlan(sorted, contracts.map(originalContract), [...new Set(sorted.flatMap(row => row.lineage))], ALLOWANCE)
  const limits = ALLOWANCE.global_limits
  if ((history?.counted ?? 0) + requests.length > 1024 || (history?.counted ?? 0) + requests.length > limits.absolute_success_ceiling || (history?.maximumPriorAttempts ?? 0) + requests.length * 3 > limits.max_http_attempts_issued || (history?.actualCredits ?? 0) + main.worstCaseCredits > limits.max_actual_credit_delta || (history?.projectedCredits ?? 0) + main.expectedCredits > limits.max_projected_credit_delta || (history?.actualCredits ?? 0) + main.worstCaseCredits > account.account.available_credits - 250) throw new Error('Cumulative tranche, attempt, credit or protected-balance ceiling stops freeze.')
  const frozen = freezeT1(main, account, [])
  const { hash: _hash, ...contents } = frozen.plan
  const plan = seal({ ...contents, schemaVersion: '2.0.0', activeSourceIdentity: identity(ACTIVE), definition: 'FROZEN_NEXT_IMMEDIATELY_ISSUABLE_BATCH_ONLY', requiredOutcomeFloor: 1024, floorReached: false, qualificationCallsAllowed: false, historicalObservationReuseOnly: true, checkpointHold: true, cumulativeAdmission: { priorJournalSha256: history?.journalSha256 ?? null, priorCounted: history?.counted ?? 0, priorActualCredits: history?.actualCredits ?? 0, priorProjectedCredits: history?.projectedCredits ?? 0, maximumPriorAttempts: history?.maximumPriorAttempts ?? 0, trancheSuccessCeiling: 1024, successorTrancheRequiresSeparateAdmission: true } })
  for (const row of plan.requests) approvedRows.set(row, identity(row))
  return { plan, reserve: seal({ schemaVersion: '2.0.0', parentPlanHash: plan.hash, requests: [], worstCaseCredits: 0, protectedReserveCredits: 250, speculativeReserveForbidden: true, futureRequestsRequireDurableFrontierAdmission: true }) }
}
export function durableObservation(row, terminal, contractInput, cell, cutoffUtc, campaignEvidence) {
  if (approvedRows.get(row) !== identity(row)) throw new Error('Parent is not an admitted frozen row.')
  const history = assertCampaignEvidence(campaignEvidence), durable = history.terminals.find(item => item.logicalId === row.logicalId)
  if (!durable || durable.terminalIdentity !== identity(terminal)) throw new Error('Terminal not durably recorded with matching reservation and exact envelope identity.')
  const original = originalContract(contractInput), contract = admitContract(original)
  validateActiveSchema('ledger', terminal)
  if (terminal.logical_request_id !== row.logicalId || terminal.request_body_sha256 !== identity(row.body) || terminal.endpoint_family !== row.family || terminal.endpoint_path !== row.path || terminal.question_lens !== row.lens || terminal.purpose_code !== row.purpose || terminal.investigative_question_id !== row.questionId || terminal.terminal_status !== 'SUCCESS_COUNTED' || !terminal.qualification_counted || identity(terminal.selection_lineage) !== identity(row.lineage) || identity(terminal.consumer_ids) !== identity(row.consumers) || identity(terminal.coverage_key) !== identity(row.coverageKey) || identity(terminal.coverage_cell_ids) !== identity(row.coverageCells) || contract.hash !== row.contractHash || cell.id !== row.coverageCells[0] || cell.fromUtc + '/' + cell.toUtc !== row.coverageKey.time_window_id || cutoffUtc !== scenario.historicalCutoff) throw new Error('Durable terminal does not match admitted bounded question.')
  const bytes = readDurableRaw(terminal.storage), response = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  const projection = compilePublicIndex(terminal, original, response, cell, cutoffUtc, bytes)
  if (response.pagination && (response.pagination.page !== row.partition.page || typeof response.pagination.is_last_page !== 'boolean')) throw new Error('Explicit pagination evidence required.')
  const value = freeze({ row, terminalIdentity: identity(terminal), terminalEnvelopeIdentity: durable.envelopeIdentity, parentJournalSha256: history.journalSha256, rawSha256: terminal.storage.primary_raw_sha256, normalizedSha256: projection.publicRecord.normalized_sha256, facts: projection.normalizedRecords, previousPage: row.partition.page, explicitMore: response.pagination?.is_last_page === false, cell: structuredClone(cell), campaignEvidence: history })
  observations.add(value); return value
}
export function expandFrontier(fixture, durableResults, review, contracts, priorLogicalIds = []) {
  acceptedFixture(fixture)
  if (!review || review.saturated !== false || !Number.isFinite(review.duplicateRatio) || review.duplicateRatio < 0 || review.duplicateRatio > 0.8 || !Array.isArray(review.closedQuestionIds) || !Array.isArray(review.closedCoverageCellIds) || !Array.isArray(review.gaps)) return []
  const admitted = contracts.map(originalContract).map(admitContract), seen = new Set(priorLogicalIds), next = new Map()
  const add = request => {
    if (!admitted.some(item => item.family === request.family)) return
    const id = logicalRequest(request)
    if (!seen.has(id) && !next.has(id)) next.set(id, approve(request))
  }
  for (const result of durableResults) {
    if (!observations.has(result)) throw new Error('Unverified durable result; marker/hash fields alone cannot authorize expansion.')
    assertCampaignEvidence(result.campaignEvidence)
    const row = result.row
    if (!result.facts.length || review.closedQuestionIds.includes(row.questionId) || row.coverageCells.some(id => review.closedCoverageCellIds.includes(id))) continue
    const gaps = review.gaps.filter(gap => gap.parentTerminalIdentity === result.terminalIdentity && gap.unresolved === true && /^QUESTION\./.test(gap.questionId) && /^(CASEBOARD|TEST|TRACE_THREAD)\./.test(gap.consumerId) && typeof gap.marginalUtility === 'string' && gap.marginalUtility.length >= 12)
    for (const gap of gaps) {
      if (gap.kind === 'WINDOW_COMPLETENESS' && gap.questionId === row.questionId && result.explicitMore && row.body.pagination && row.partition.page < row.partition.maximumPages) {
        const { logicalId: _id, sequence: _seq, contractHash: _contract, expectedCredits: _cost, worstCaseCredits: _worst, ...request } = structuredClone(row)
        const page = row.partition.page + 1
        request.body.pagination.page = page; request.partition.page = page
        if (row.lens === 'ACTIVITY') request.purpose = 'PAGINATION_COMPLETENESS'
        request.coverageKey.page_or_partition_id = `PAGE.${page}`; request.coverageCells = [`CELL.${identity({ questionId: row.questionId, body: request.body })}`]
        request.consumers = [...new Set([...row.consumers, gap.consumerId])]; request.novelty = gap.marginalUtility
        request.frontierProof = { kind: 'DURABLE_NEXT_PAGE', parentTerminalIdentity: result.terminalIdentity, previousPage: result.previousPage, explicitMore: true, namedMarginalUtility: gap.marginalUtility }
        add(request)
      }
      for (const fact of result.facts) {
        if (gap.normalizedFactIdentity !== identity(fact)) continue
        const seed = { recordId: gap.questionId, lineage: `DURABLE.${result.terminalIdentity}.${identity(fact)}`, parentTerminalIdentity: result.terminalIdentity, factIdentity: identity(fact) }
        if (gap.kind === 'EXACT_RECEIPT' && fact.transaction_hash) { const request = requestFor(fixture, { ...seed, transactionHash: fact.transaction_hash }, 'RECEIPT'); request.consumers = [...new Set([...request.consumers, gap.consumerId])]; request.novelty = gap.marginalUtility; add(request) }
        if (gap.kind === 'SUBJECT_ACTIVITY' || gap.kind === 'SUBJECT_RELATIONSHIPS') for (const address of [...new Set([fact.from_address, fact.to_address, fact.counterparty_address].filter(Boolean))]) {
          const request = requestFor(fixture, { ...seed, address }, gap.kind === 'SUBJECT_ACTIVITY' ? 'ACTIVITY' : 'RELATIONSHIPS'); request.consumers = [...new Set([...request.consumers, gap.consumerId])]; request.novelty = gap.marginalUtility; add(request)
        }
      }
    }
  }
  return [...next.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 256).map(([, row]) => row)
}
export function freezeAcceptedT1(refresh, account, fixture, campaignEvidence = null) {
  const policy = frontierPolicy(fixture), seeds = seedQuestions(fixture), contracts = [], blockedFamilies = []
  for (const family of Object.values(LENS_FAMILIES)) {
    try { const { hash: _hash, ...contract } = officialContract(refresh, family, account.account.plan_class); contracts.push(contract) }
    catch { blockedFamilies.push({ family, status: 'NOT_ADMITTED', reason: 'Exact path/schema/pricing/rate/coverage/redistribution unresolved in preserved official material; this gate forbids fetching replacements.' }) }
  }
  const issuable = seeds.filter(row => contracts.some(contract => contract.family === row.family))
  let frozen
  if (issuable.length && campaignEvidence) frozen = freezeNextBatch(issuable, contracts, account, campaignEvidence.logicalIds, 256, campaignEvidence)
  else {
    const review = issuable.length ? buildPlan(issuable, contracts, [...new Set(issuable.flatMap(row => row.lineage))], ALLOWANCE) : { requests: [], expectedCredits: 0, worstCaseCredits: 0 }
    frozen = { plan: seal({ schemaVersion: '2.0.0', activeSourceIdentity: identity(ACTIVE), frozen: false, definition: 'UNFROZEN_BOUNDED_REVIEW_CANDIDATES_NOT_ISSUABLE_AUTHORITY', requests: review.requests, contracts: review.contracts ?? [], acceptedLineage: review.acceptedLineage ?? [], allowanceHash: identity(ALLOWANCE), expectedCredits: review.expectedCredits, worstCaseCredits: review.worstCaseCredits, availableCredits: account.account.available_credits, observedAccountHash: identity(account), protectedReserveCredits: 250, candidateWorstCaseFitsObservedBalanceMinusReserve: review.worstCaseCredits <= account.account.available_credits - 250, requiresVerifiedCampaignHistoryIncludingInitialEmptiness: true, campaignHistoryStatus: 'NOT_VERIFIED_NO_IMPLICIT_ZERO_RESET', qualificationCallsAllowed: false, checkpointHold: true }), reserve: seal({ requests: [], worstCaseCredits: 0, protectedReserveCredits: 250, speculativeReserveForbidden: true }) }
  }
  return { ...frozen, policy, completeTargetPlan: false, targetSuccesses: 1024, initialFrontierRequests: frozen.plan.frozen ? issuable.length : 0, report: { schemaVersion: '2.0.0', status: blockedFamilies.length || !frozen.plan.frozen ? 'BLOCKED_WITH_EVIDENCE' : 'DELIVERED_PENDING_LEAD_REVIEW', acceptedSeedQuestions: seeds.length, boundedReviewCandidates: issuable.length, frozenNextBatchRequests: frozen.plan.frozen ? issuable.length : 0, verifiedCampaignHistory: !!campaignEvidence, noImplicitEmptyHistoryAssumption: true, speculativePages: 0, allInitialPagesOneOrExactLookup: true, properLensFamilies: LENS_FAMILIES, blockedFamilies, requiredOutcomeFloor: 1024, actualQualificationAttempts: 0, actualCountedSuccesses: 0, floorReachability: policy.floorReachability, noFloorPromiseFromPlanLength: true, futureReserveRequests: 0, checkpointHeld: true } }
}
