// Redacted metadata contracts only. No credential value, identity, raw body or
// private storage path is representable in these staged report interfaces.
export type GateStatus = 'PASS' | 'FAIL' | 'NOT_VERIFIED'
export type OfflineGate = 'source_admission' | 'complete_local_regression' | 'current_official_docs_snapshot' | 'fixture_schema_conformance' | 'terminal_archive_feature_parity' | 'large_corpus_browser_performance' | 'dedicated_review' | 'nq5_planner_and_runtime_tests' | 'ledger_crash_tail_and_dual_root_storage' | 'endpoint_policy_and_public_projection' | 'credential_browser_boundary' | 'secret_scans' | 'account_adapter_fixture_tests'
export interface ReportBlocker { id: string; summary: string; gate?: string | null; evidence_refs?: string[] }
export interface ReportIdentity {
  schema_version: '1.0.2'
  exception_id: 'LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001'
  parent_authorization_id: 'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001'
  generated_at_utc: string
}
interface OfflineCommon extends ReportIdentity {
  candidate_commit: string; candidate_tree: string
  credential_resolution_attempted: false; provider_calls_issued: 0
  deferred_until_account_balance?: ('FROZEN_T1_COVERAGE_UTILITY_AND_RESERVE_PLAN' | 'FINAL_BUDGET_ADMISSION')[]
}
export type OfflineReport = OfflineCommon & (
  { status: 'PASS'; AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: true; mandatory_offline_gates: Record<OfflineGate, 'PASS'>; blockers: [] }
  | { status: 'BLOCKED_WITH_EVIDENCE'; AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: false; mandatory_offline_gates: Record<OfflineGate, GateStatus>; blockers: [ReportBlocker, ...ReportBlocker[]] }
)
export interface AccountRedactedReport extends ReportIdentity {
  status: 'PASS' | 'BLOCKED_WITH_EVIDENCE'
  ACCOUNT_PREFLIGHT_PASS: boolean
  credential_status: 'NOT_RESOLVED' | 'PRESENT_REDACTED' | 'MISSING_OR_UNREADABLE' | 'RESOLUTION_FAILED_REDACTED'
  request: { method: 'GET'; host: 'api.nansen.ai'; path: '/api/v1/account'; attempts_issued: 0 | 1; retries: 0; redirects: 0; body_sent: false; query_sent: false; qualification_counted: false; public_indexed: false }
  response: { http_status: number | null; request_id: null; credits_cost: number | null; credits_used: number | null; credits_remaining_header: number | null; actual_credit_delta: number | null; transport_error_class: string | null; rate_limit_headers?: Record<string, number> }
  storage: { persistence_status: 'PASS' | 'FAIL' | 'NOT_ATTEMPTED'; primary_raw_sha256: string | null; mirror_raw_sha256: string | null; bytes_equal: boolean | null; raw_payload_packaged: false; private_paths_redacted: boolean }
  ledger: { question_lens: 'ADMIN'; purpose_code: 'ACCOUNT_PREFLIGHT'; qualification_counted: false; public_call_id: null; terminal_status: 'COMPLETED_PRIVATE_NONQUALIFICATION' | 'FAILED_PRIVATE_NONQUALIFICATION' | 'NOT_ISSUED_PRIVATE_NONQUALIFICATION' }
  account: { plan_class: 'FREE' | 'PRO' | 'OTHER_REDACTED' | null; available_credits: number | null; included_credits: number | null; promotional_credits: number | null; purchased_credits: number | null; actual_cash_spend_usd: number | null; identity_fields_included: false }
  secret_scan: 'PASS' | 'FAIL' | 'NOT_RUN'; blockers: ReportBlocker[]
}
// Runtime schema/semantic validation remains mandatory; TypeScript alone does
// not prove nonnegative values, successful cross-fields, hashes or gate evidence.
