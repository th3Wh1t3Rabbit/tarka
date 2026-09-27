import { canonical, freeze, identity, validateSchema, validateSchemaBatch } from './schema.mjs'
import { validateNq5Report } from '../nq5-checkpoint-policy.mjs'
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
export const ALLOWANCE = freeze(load(readFileSync(new URL('../../docs/overlays/g6p-a2u-v1.0.1/02_NANSEN_UTILITY_BOUND_QUALIFICATION_ALLOWANCE.yaml', import.meta.url), 'utf8')))

export const AUTH = 'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001'
export const FAMILY_PURPOSES = {
  'profiler/address/transactions': ['ANCHOR_ACTIVITY_PAGE', 'WINDOW_COMPLETENESS_PAGE', 'FLOW_DIRECTION_QUERY', 'ASSET_PATH_QUERY', 'VALUE_BAND_QUERY', 'DEAD_END_DISCOVERY', 'DEAD_END_FALSIFIER', 'QUESTION_RECIPE_VALIDATION', 'NEGATIVE_CONTROL', 'PAGINATION_COMPLETENESS', 'COVERAGE_CELL_CLOSURE', 'PROVENANCE_RECONCILIATION', 'REGRESSION_FIXTURE'],
  'profiler/address/historical-transactions': ['ANCHOR_ACTIVITY_PAGE', 'WINDOW_COMPLETENESS_PAGE', 'FLOW_DIRECTION_QUERY', 'ASSET_PATH_QUERY', 'VALUE_BAND_QUERY', 'PAGINATION_COMPLETENESS', 'COVERAGE_CELL_CLOSURE', 'NEGATIVE_CONTROL'],
  'profiler/address/counterparties': ['COUNTERPARTY_RANKING', 'TRACE_THREAD_LINK_TEST', 'DEAD_END_DISCOVERY', 'QUESTION_RECIPE_VALIDATION'],
  'profiler/address/historical-balances': ['STATE_BEFORE', 'STATE_AFTER', 'REGRESSION_FIXTURE'],
  'transaction-with-token-transfer-lookup': ['EXACT_RECEIPT', 'TRACE_THREAD_LINK_TEST', 'DEAD_END_FALSIFIER', 'PROVENANCE_RECONCILIATION'],
}
export function logicalRequest(request) {
  const normalized = structuredClone(request)
  // Normalize address/hash casing, object order and set-valued filters only.
  const normalize = (value, key = '') => {
    if (typeof value === 'string' && /^0x[\da-f]+$/i.test(value)) return value.toLowerCase()
    if (Array.isArray(value)) {
      const values = value.map((item) => normalize(item))
      return ['addresses', 'tokens', 'chains'].includes(key) ? [...new Map(values.map((item) => [canonical(item), item])).values()].sort((a, b) => canonical(a).localeCompare(canonical(b))) : values
    }
    return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([name, nested]) => [name, normalize(nested, name)])) : value
  }
  return identity({ method: normalized.method, path: normalized.path, body: normalize(normalized.body) })
}
export function admitContract(contract) {
  if (!contract || !FAMILY_PURPOSES[contract.family] || contract.admitted !== true || !/^\/api\//.test(contract.path) || !['GET', 'POST'].includes(contract.method) || /[?#]|labels|smart-money|portfolio|agent|related-wallets|leaderboard/i.test(contract.path) || !contract.requestSchema || !contract.responseSchema || !Number.isFinite(contract.credits) || contract.credits < 0 || !Number.isFinite(contract.maximumCredits) || contract.maximumCredits < contract.credits || contract.concurrency !== 1 || !Number.isFinite(contract.requestsPerMinute) || contract.requestsPerMinute < 1 || contract.requestsPerMinute > 200 || contract.minimumDelayMs < 250 || !['COMPLETE_BOUNDED', 'PAGINATED_BOUNDED'].includes(contract.coverage) || contract.redistribution !== 'ALLOWLIST_ONLY' || !contract.snapshots || !['endpoint', 'pricing', 'rate', 'coverage', 'redistribution'].every((key) => /^[a-f0-9]{64}$/.test(contract.snapshots[key]))) throw new Error('Plan-specific contract not admitted.')
  if (!Number.isFinite(Date.parse(contract.retrievedAtUtc)) || Date.parse(contract.retrievedAtUtc) > Date.now() || Date.now() - Date.parse(contract.retrievedAtUtc) > 86400000) throw new Error('Stale plan-specific contract.')
  if (contract.path !== `/api/${contract.family.includes('historical-transactions') ? 'v1beta1' : 'v1'}/${contract.family}` || contract.method !== 'POST' || !contract.snapshotDocuments || Object.entries(contract.snapshots).some(([key, digest]) => identity(contract.snapshotDocuments[key]) !== digest)) throw new Error('Endpoint snapshot identity mismatch.')
  const operation = contract.snapshotDocuments.endpoint.paths?.[contract.path]?.[contract.method.toLowerCase()]
  if (!operation || identity(operation.requestSchema) !== identity(contract.requestSchema) || identity(operation.responseSchema) !== identity(contract.responseSchema) || contract.snapshotDocuments.pricing.maximumCredits !== contract.maximumCredits || contract.snapshotDocuments.pricing.credits !== contract.credits || contract.snapshotDocuments.coverage.classification !== contract.coverage || contract.snapshotDocuments.redistribution.policy !== contract.redistribution || contract.snapshotDocuments.rate.requestsPerMinute !== contract.requestsPerMinute || contract.snapshotDocuments.rate.minimumDelayMs !== contract.minimumDelayMs) throw new Error('Contract values are not bound to plan-specific snapshots.')
  validateSchema('provider', {}, { type: 'object', $defs: { request: contract.requestSchema, response: contract.responseSchema } })
  return freeze(structuredClone({ ...contract, hash: identity(contract) }))
}
export function buildPlan(requests, contracts, acceptedLineage, allowance) {
  if (identity(allowance) !== identity(ALLOWANCE) || allowance.authorization_id !== AUTH || allowance.global_limits.protected_credit_floor_after_campaign !== 250 || allowance.global_limits.max_concurrency !== 1) throw new Error('Allowance identity/boundaries mismatch.')
  const admitted = contracts.map(admitContract)
  const seen = new Set()
  const rows = requests.map((request, index) => {
    const contract = admitted.find((item) => item.family === request.family && item.path === request.path && item.method === request.method)
    if (!contract || !FAMILY_PURPOSES[request.family].includes(request.purpose) || !['ACTIVITY', 'RELATIONSHIPS', 'STATE', 'RECEIPT'].includes(request.lens) || !/^QUESTION\./.test(request.questionId) || request.businessQuestion.length < 12 || !request.consumers.length || !request.lineage.length || request.lineage.some((id) => !acceptedLineage.includes(id)) || !request.stopRule || !request.novelty || !request.coverageKey || !Object.values(request.coverageKey).every((value) => typeof value === 'string' && value.length) || request.coverageKey.question_lens !== request.lens || !request.coverageCells.length || !Number.isInteger(request.partition.page) || request.partition.page < 1 || !Number.isInteger(request.partition.maximumPages) || request.partition.page > request.partition.maximumPages || request.partition.maximumPages > 4096 || request.partition.minimumWindowSeconds < 3600) throw new Error('Request utility/lineage/coverage admission failed.')
    if ((request.family.includes('balances') && request.lens !== 'STATE') || (request.family.includes('counterparties') && request.lens !== 'RELATIONSHIPS') || (request.family.includes('lookup') && request.lens !== 'RECEIPT')) throw new Error('Question Lens and data family mismatch.')
    const restricted = (value) => value && typeof value === 'object' && Object.entries(value).some(([key, child]) => /label|smart.?money|entity_name/i.test(key) || (key === 'group_by' && child !== 'wallet') || restricted(child))
    if (restricted(request.body) || (request.body.pagination && request.body.pagination.page !== request.partition.page) || Object.keys(request.coverageKey).sort().join() !== 'page_or_partition_id,question_lens,subject_id,time_window_id' || new Set(request.coverageCells).size !== request.coverageCells.length || request.coverageCells.some((id) => typeof id !== 'string' || !id) || request.consumers.some((id) => typeof id !== 'string' || !id) || new Set(request.consumers).size !== request.consumers.length) throw new Error('Restricted request or inconsistent coverage partition.')
    const id = logicalRequest(request)
    if (seen.has(id)) throw new Error('Equivalent logical requests cannot inflate plan size.')
    seen.add(id)
    return { ...structuredClone(request), logicalId: id, sequence: index + 1, contractHash: contract.hash, expectedCredits: contract.credits, worstCaseCredits: contract.maximumCredits * 3 }
  })
  for (const contract of admitted) validateSchemaBatch('provider', rows.filter((row) => row.contractHash === contract.hash).map((row) => row.body), contract.requestSchema)
  const expectedCredits = rows.reduce((sum, row) => sum + row.expectedCredits, 0)
  const worstCaseCredits = rows.reduce((sum, row) => sum + row.worstCaseCredits, 0)
  if (!rows.length || rows.length > allowance.global_limits.absolute_success_ceiling || rows.length * 3 > allowance.global_limits.max_http_attempts_issued || expectedCredits > allowance.global_limits.max_projected_credit_delta || worstCaseCredits > allowance.global_limits.max_actual_credit_delta) throw new Error('Plan exceeds parent ceilings.')
  const plan = { schemaVersion: '1.0.0', authorizationId: AUTH, allowanceHash: identity(allowance), acceptedLineage: [...acceptedLineage], requests: rows, contracts: admitted, expectedCredits, worstCaseCredits, frozen: false }
  return freeze({ ...plan, hash: identity(plan) })
}
export function freezeT1(plan, account, reserveRequests = []) {
  validateNq5Report('account', account)
  const { hash: planHash, ...planContents } = plan
  if (identity(planContents) !== planHash || plan.frozen || plan.authorizationId !== AUTH) throw new Error('Plan identity is not admitted.')
  if (account.status !== 'PASS' || account.ACCOUNT_PREFLIGHT_PASS !== true || account.request.attempts_issued !== 1 || account.response.actual_credit_delta !== 0 || !Number.isFinite(account.account.available_credits)) throw new Error('T1 requires an observed successful account balance.')
  const reserveIds = reserveRequests.map(logicalRequest)
  // Re-run the complete admission path for the reserve, rather than trusting costs.
  if (reserveRequests.length) {
    const contracts = plan.contracts.map(({ hash: _hash, ...contract }) => contract)
    const reservePlan = buildPlan(reserveRequests, contracts, plan.acceptedLineage, ALLOWANCE)
    if (reservePlan.requests.some((row, index) => row.logicalId !== reserveRequests[index].logicalId || row.contractHash !== reserveRequests[index].contractHash || row.worstCaseCredits !== reserveRequests[index].worstCaseCredits || row.expectedCredits !== reserveRequests[index].expectedCredits)) throw new Error('Reserve rows contradict full admission.')
  }
  if (new Set(reserveIds).size !== reserveIds.length || reserveIds.some((id) => plan.requests.some((row) => row.logicalId === id))) throw new Error('Reserve duplicates an admitted request.')
  // Reserves must themselves be admitted plan rows, not arbitrary credit guesses.
  if (reserveRequests.some((row) => {
    const contract = plan.contracts.find((item) => item.hash === row.contractHash)
    if (!contract || !row.logicalId || logicalRequest(row) !== row.logicalId || row.family !== contract.family || row.path !== contract.path || row.method !== contract.method || !FAMILY_PURPOSES[row.family]?.includes(row.purpose) || row.worstCaseCredits !== contract.maximumCredits * 3 || row.expectedCredits !== contract.credits || !row.consumers?.length || !row.lineage?.length || !row.coverageCells?.length || !row.stopRule) return true
    return false
  })) throw new Error('Unadmitted reserve plan.')
  const reserveWorst = reserveRequests.reduce((sum, row) => sum + row.worstCaseCredits, 0)
  const limits = ALLOWANCE.global_limits
  if (plan.allowanceHash !== identity(ALLOWANCE) || plan.requests.length + reserveRequests.length > limits.absolute_success_ceiling || (plan.requests.length + reserveRequests.length) * 3 > limits.max_http_attempts_issued || plan.expectedCredits + reserveRequests.reduce((sum, row) => sum + row.expectedCredits, 0) > limits.max_projected_credit_delta || plan.worstCaseCredits + reserveWorst > limits.max_actual_credit_delta) throw new Error('Combined main and reserve plans exceed parent ceilings.')
  if (plan.worstCaseCredits + reserveWorst > account.account.available_credits - 250) throw new Error('Observed balance minus protected reserve cannot support worst case.')
  const frozen = { ...structuredClone(planContents), frozen: true, observedAccountHash: identity(account), availableCredits: account.account.available_credits, protectedReserveCredits: 250 }
  const reserve = { authorizationId: AUTH, parentPlanHash: identity(frozen), requests: structuredClone(reserveRequests), worstCaseCredits: reserveWorst }
  return { plan: freeze({ ...frozen, hash: identity(frozen) }), reserve: freeze({ ...reserve, hash: identity(reserve) }) }
}
export function utilityDecision(report, qualificationCount, remainingCredits, nextPlan) {
  const required = ['new_unique_normalized_records', 'duplicate_record_ratio', 'new_lineage_accepted_subjects', 'coverage_cells_closed', 'question_cards_or_recipes_enabled', 'caseboard_or_trace_thread_consumers_added', 'route_candidates_added', 'dead_end_candidates_added', 'exact_receipt_gaps_closed', 'state_corroboration_gaps_closed', 'test_consumers_added', 'credits_consumed', 'records_per_credit', 'utility_by_question_lens', 'unresolved_P0_coverage_gaps']
  if (required.some((key) => report[key] === undefined) || required.filter((key) => key !== 'utility_by_question_lens').some((key) => !Number.isFinite(report[key]) || report[key] < 0) || report.duplicate_record_ratio > 1 || !Number.isInteger(qualificationCount) || qualificationCount < 0 || !Number.isFinite(remainingCredits) || !Number.isFinite(nextPlan.worstCaseCredits) || nextPlan.worstCaseCredits < 0 || qualificationCount >= 12288 || remainingCredits - nextPlan.worstCaseCredits < 250) return 'STOP'
  if (!report.utility_by_question_lens || Object.keys(report.utility_by_question_lens).sort().join() !== 'ACTIVITY,RECEIPT,RELATIONSHIPS,STATE' || Object.values(report.utility_by_question_lens).some((value) => !Number.isFinite(value) || value < 0)) return 'STOP'
  const utility = ['coverage_cells_closed', 'question_cards_or_recipes_enabled', 'caseboard_or_trace_thread_consumers_added', 'route_candidates_added', 'dead_end_candidates_added', 'exact_receipt_gaps_closed', 'state_corroboration_gaps_closed', 'test_consumers_added'].reduce((sum, key) => sum + report[key], 0)
  if (qualificationCount >= 1024 && (!utility || report.duplicate_record_ratio > 0.8)) return 'STOP_SATURATED'
  if (qualificationCount >= 8192 && report.unresolved_P0_coverage_gaps <= 0) return 'STOP_NO_P0_GAP'
  return 'CONTINUE_UTILITY_BOUND'
}
