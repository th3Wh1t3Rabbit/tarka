import { readFileSync } from 'node:fs'
import { identity } from '../../scripts/nq5/schema.mjs'
import { AUTH, ALLOWANCE } from '../../scripts/nq5/planner.mjs'
import { createUnissuedAccountReport } from '../../scripts/nq5-checkpoint-reports.mjs'

export { ALLOWANCE }
export const candidate = { commit: '1'.repeat(40), tree: '2'.repeat(40) }
export function offlineReport() {
  const schema = JSON.parse(readFileSync('docs/overlays/g6p-a2u-failure-schema-v1.0.2/03_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json'))
  return { schema_version: '1.0.2', status: 'PASS', exception_id: 'LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001', parent_authorization_id: AUTH, generated_at_utc: new Date().toISOString(), candidate_commit: candidate.commit, candidate_tree: candidate.tree, mandatory_offline_gates: Object.fromEntries(schema.$defs.allPassGates.required.map((key) => [key, 'PASS'])), blockers: [], credential_resolution_attempted: false, provider_calls_issued: 0, AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: true }
}
export function accountReport(balance = 5000) {
  const report = createUnissuedAccountReport(new Date().toISOString())
  Object.assign(report, { status: 'PASS', ACCOUNT_PREFLIGHT_PASS: true, credential_status: 'PRESENT_REDACTED', blockers: [], secret_scan: 'PASS' })
  report.request.attempts_issued = 1
  Object.assign(report.response, { http_status: 200, credits_cost: 0, credits_used: 0, credits_remaining_header: balance, actual_credit_delta: 0, transport_error_class: null })
  Object.assign(report.storage, { persistence_status: 'PASS', primary_raw_sha256: 'a'.repeat(64), mirror_raw_sha256: 'a'.repeat(64), bytes_equal: true })
  report.ledger.terminal_status = 'COMPLETED_PRIVATE_NONQUALIFICATION'; report.account.available_credits = balance; report.account.plan_class = 'FREE'
  return report
}
export function fixtureContract(family = 'profiler/address/transactions', maximumCredits = 1) {
  const endpoint = `/api/${family.includes('historical-transactions') ? 'v1beta1' : 'v1'}/${family}`
  const requestSchema = { type: 'object', additionalProperties: false, required: ['address', 'pagination'], properties: { address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }, pagination: { type: 'object', additionalProperties: false, required: ['page', 'per_page'], properties: { page: { type: 'integer', minimum: 1, maximum: 4096 }, per_page: { const: 100 } } } } }
  const responseSchema = { type: 'object', additionalProperties: false, required: ['data'], properties: { data: { type: 'array', items: { type: 'object' } }, pagination: { type: 'object' } } }
  const snapshotDocuments = { endpoint: { mode: 'OFFLINE_FIXTURE_ONLY', paths: { [endpoint]: { post: { requestSchema, responseSchema } } } }, pricing: { credits: maximumCredits, maximumCredits }, rate: { requestsPerMinute: 200, minimumDelayMs: 250 }, coverage: { classification: 'PAGINATED_BOUNDED' }, redistribution: { policy: 'ALLOWLIST_ONLY' } }
  return { admitted: true, family, path: endpoint, method: 'POST', requestSchema, responseSchema, credits: maximumCredits, maximumCredits, concurrency: 1, requestsPerMinute: 200, minimumDelayMs: 250, coverage: 'PAGINATED_BOUNDED', redistribution: 'ALLOWLIST_ONLY', retrievedAtUtc: new Date(Date.now() - 1000).toISOString(), snapshots: Object.fromEntries(Object.entries(snapshotDocuments).map(([key, value]) => [key, identity(value)])), snapshotDocuments }
}
export function fixtureRequest(page = 1, contract = fixtureContract()) {
  const lens = contract.family.includes('balances') ? 'STATE' : contract.family.includes('counterparties') ? 'RELATIONSHIPS' : contract.family.includes('lookup') ? 'RECEIPT' : 'ACTIVITY'
  return { family: contract.family, path: contract.path, method: contract.method, purpose: lens === 'STATE' ? 'STATE_BEFORE' : lens === 'RELATIONSHIPS' ? 'COUNTERPARTY_RANKING' : lens === 'RECEIPT' ? 'EXACT_RECEIPT' : 'PAGINATION_COMPLETENESS', lens, questionId: 'QUESTION.OFFLINE_COMPLETENESS', businessQuestion: 'Does this bounded synthetic page close the fixture coverage gap?', consumers: ['TEST.COVERAGE'], lineage: ['ACCEPTED.FIXTURE_SEED'], body: { address: `0x${'1'.repeat(40)}`, pagination: { page, per_page: 100 } }, stopRule: 'Stop at admitted page bound or terminal empty page.', novelty: 'Close a named bounded synthetic coverage cell.', coverageKey: { subject_id: 'ACCEPTED.FIXTURE_SEED', time_window_id: 'WINDOW.FIXTURE', question_lens: lens, page_or_partition_id: `PAGE.${page}` }, coverageCells: [`CELL.${page}`], partition: { page, maximumPages: 4, minimumWindowSeconds: 3600 } }
}
export const responseBody = () => ({ pagination: { page: 1, per_page: 100, is_last_page: true }, data: [{ transaction_hash: `0x${'3'.repeat(64)}`, block_timestamp: '2023-03-13T11:38:11Z', from_address: `0x${'1'.repeat(40)}`, to_address: `0x${'2'.repeat(40)}`, token_address: `0x${'4'.repeat(40)}`, amount: '1234.500000000000000001', label: 'PRIVATE_INCIDENTAL_LABEL', unknown: { private: true } }] })
export const fixtureCell = () => ({ id: 'CELL.1', fromUtc: '2023-03-13T10:00:00Z', toUtc: '2023-03-13T12:15:00Z', status: 'COMPLETE', supportsNegative: false })
export function ledgerRecord(id = 'b'.repeat(64), storage = { primary_raw_sha256: 'c'.repeat(64), mirror_raw_sha256: 'c'.repeat(64), primary_path: null, mirror_path: null, bytes_equal: true }) {
  return { schema_version: '5.0.1', campaign_id: 'NQ5', authorization_id: AUTH, tranche_id: 'T1', batch_id: 'B1', ledger_sequence: 2, logical_request_id: id, attempt_id: 'ATTEMPT.1', endpoint_family: 'profiler/address/transactions', endpoint_path: '/api/v1/profiler/address/transactions', business_question: 'Does the bounded fixture page close a named coverage cell?', purpose_code: 'PAGINATION_COMPLETENESS', consumer_ids: ['TEST.COVERAGE'], selection_lineage: ['ACCEPTED.FIXTURE_SEED'], request_body_sha256: identity(fixtureRequest().body), issued_at_utc: new Date().toISOString(), terminal_status: 'SUCCESS_COUNTED', qualification_counted: true, qualification_sequence: 1, qualification_exclusion_reason: null, http_status: 200, provider_headers: { credits_cost: 1 }, storage, novelty_expectation: 'Close named bounded synthetic coverage gap.', bounded_stop_rule: 'Stop at admitted terminal page or saturated utility.', classification: { temporal_class: 'WITHIN_CUTOFF', public_export_disposition: 'ALLOWLIST_ONLY', route_disposition: 'BOUNDED_ACTIVITY', evidence_grade: 'EXACT', result_count: 1, coverage_supports_negative_evidence: false }, budget: { projected_credits: 1, actual_credits: 1, cumulative_actual_credit_delta: 1 }, investigative_question_id: 'QUESTION.OFFLINE_COMPLETENESS', question_lens: 'ACTIVITY', coverage_cell_ids: ['CELL.1'], coverage_key: fixtureRequest().coverageKey }
}
