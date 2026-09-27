import { validateNq5Report } from './nq5-checkpoint-policy.mjs'
import { createHash } from 'node:crypto'

export const reportBytes = (report) => `${JSON.stringify(report, null, 2)}\n`
export const reportHash = (report) => createHash('sha256').update(reportBytes(report)).digest('hex')

const common = (timestamp) => ({ schema_version: '1.0.2', status: 'BLOCKED_WITH_EVIDENCE', exception_id: 'LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001', parent_authorization_id: 'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001', generated_at_utc: timestamp })

export function createBlockedOfflineReport(candidate, gates, timestamp) {
  const report = { ...common(timestamp), candidate_commit: candidate.commit, candidate_tree: candidate.tree,
    mandatory_offline_gates: gates,
    blockers: Object.entries(gates).filter(([, state]) => state !== 'PASS').map(([gate, state]) => ({ id: `OFFLINE_${gate.toUpperCase()}`, summary: `Required offline gate remains ${state}; no credential or provider operation is permitted.`, gate, evidence_refs: ['SOURCE_SNAPSHOT/docs/G6P_A2U_V1_0_2_OFFLINE_CHECKPOINT.md'] })),
    deferred_until_account_balance: ['FROZEN_T1_COVERAGE_UTILITY_AND_RESERVE_PLAN', 'FINAL_BUDGET_ADMISSION'],
    credential_resolution_attempted: false, provider_calls_issued: 0, AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: false }
  validateNq5Report('offline', report)
  return report
}

export function createOfflinePassReport(candidate, gates, timestamp) {
  const report = { ...common(timestamp), status: 'PASS', candidate_commit: candidate.commit, candidate_tree: candidate.tree, mandatory_offline_gates: gates, blockers: [], deferred_until_account_balance: ['FROZEN_T1_COVERAGE_UTILITY_AND_RESERVE_PLAN', 'FINAL_BUDGET_ADMISSION'], credential_resolution_attempted: false, provider_calls_issued: 0, AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: true }
  validateNq5Report('offline', report)
  return report
}

export function createUnissuedAccountReport(timestamp) {
  const report = { ...common(timestamp), credential_status: 'NOT_RESOLVED', ACCOUNT_PREFLIGHT_PASS: false,
    request: { method: 'GET', host: 'api.nansen.ai', path: '/api/v1/account', attempts_issued: 0, retries: 0, redirects: 0, body_sent: false, query_sent: false, qualification_counted: false, public_indexed: false },
    response: { http_status: null, request_id: null, credits_cost: null, credits_used: null, credits_remaining_header: null, actual_credit_delta: null, transport_error_class: 'OFFLINE_GATES_NOT_PASS', rate_limit_headers: {} },
    storage: { persistence_status: 'NOT_ATTEMPTED', primary_raw_sha256: null, mirror_raw_sha256: null, bytes_equal: null, raw_payload_packaged: false, private_paths_redacted: true },
    ledger: { question_lens: 'ADMIN', purpose_code: 'ACCOUNT_PREFLIGHT', qualification_counted: false, public_call_id: null, terminal_status: 'NOT_ISSUED_PRIVATE_NONQUALIFICATION' },
    account: { plan_class: null, available_credits: null, included_credits: null, promotional_credits: null, purchased_credits: null, actual_cash_spend_usd: null, identity_fields_included: false },
    secret_scan: 'NOT_RUN', blockers: [{ id: 'OFFLINE_GATES_NOT_PASS', summary: 'Account operation was not reached; no credential was resolved, no request was attempted, and no private account bytes or ledger records exist.' }] }
  validateNq5Report('account', report)
  return report
}

export function assertFinalCheckpointConsistency(report) {
  if (!report || report.schema_version !== '1.0.2' || report.checkpoint_hold !== true || report.qualification_calls_allowed !== false || report.qualification_attempts !== 0 || report.qualification_counted !== 0) throw new Error('Checkpoint hold or zero-call proof is missing.')
  if (!Array.isArray(report.blockers) || !report.offline_report || !report.account_report || !report.objective_gates || Object.keys(report.objective_gates).length !== 13) throw new Error('Incomplete final checkpoint report.')
  validateNq5Report('offline', report.offline_report)
  validateNq5Report('account', report.account_report)
  if (Object.keys(report.objective_gates).sort().join('|') !== Object.keys(report.offline_report.mandatory_offline_gates).sort().join('|') || Object.entries(report.objective_gates).some(([name, gate]) => !['PASS', 'FAIL', 'NOT_VERIFIED'].includes(gate) || gate !== report.offline_report.mandatory_offline_gates[name])) throw new Error('Final objective gates do not match the offline contract and evidence.')
  if (report.candidate_commit !== report.offline_report.candidate_commit || report.candidate_tree !== report.offline_report.candidate_tree || report.offline_report_sha256 !== reportHash(report.offline_report) || report.account_report_sha256 !== reportHash(report.account_report)) throw new Error('Final report cut or embedded report hash is inconsistent.')
  if (report.available_credits !== report.account_report.account.available_credits || report.protected_reserve_credits !== 250) throw new Error('Final balance or protected reserve contradicts account evidence and allowance.')
  for (const identity of ['source_manifest_sha256', 'allowance_sha256', 'offline_schema_sha256', 'account_schema_sha256', 'contracts_sha256', 'review_sha256']) if (!/^[a-f0-9]{64}$/.test(report[identity])) throw new Error('Required final checkpoint evidence identity is missing.')
  if (report.AUTHORIZED_TO_ISSUE === true) {
    if (report.status !== 'PASS' || report.blockers.length || report.offline_report.status !== 'PASS' || report.account_report.ACCOUNT_PREFLIGHT_PASS !== true || Object.values(report.objective_gates).some((gate) => gate !== 'PASS') || !report.frozen_t1 || !Number.isFinite(report.frozen_t1.worst_case_credits) || report.frozen_t1.worst_case_credits < 0 || report.frozen_t1.worst_case_credits > report.account_report.account.available_credits - 250) throw new Error('Final PASS cannot authorize incomplete gates, balance or plan.')
  } else if (report.AUTHORIZED_TO_ISSUE !== false || report.status !== 'BLOCKED_WITH_EVIDENCE' || !report.blockers.length) throw new Error('Blocked final report is inconsistent.')
  return true
}
