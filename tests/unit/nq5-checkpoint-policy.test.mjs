import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'
import { accountOperationAfterOfflinePass, assertAccountBootstrapAuthorized, assertExactAccountRequest, assertQualificationCheckpointHold } from '../../scripts/nq5-checkpoint-policy.mjs'
import { assertFinalCheckpointConsistency, createBlockedOfflineReport, createUnissuedAccountReport, reportHash } from '../../scripts/nq5-checkpoint-reports.mjs'

const schema = JSON.parse(readFileSync('docs/overlays/g6p-a2u-failure-schema-v1.0.2/03_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json', 'utf8'))
const candidate = { commit: '0'.repeat(40), tree: '1'.repeat(40) }
// Synthetic in-memory authorization specimens only; never written as evidence.
const passing = () => ({ schema_version: '1.0.2', status: 'PASS', exception_id: 'LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001', parent_authorization_id: 'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001', candidate_commit: candidate.commit, candidate_tree: candidate.tree, generated_at_utc: '2026-09-16T00:00:00Z', mandatory_offline_gates: Object.fromEntries(schema.properties.mandatory_offline_gates.required.map((gate) => [gate, 'PASS'])), blockers: [], credential_resolution_attempted: false, provider_calls_issued: 0, AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: true })

test('all 20 supplied probes and the 118-case corrected regression matrix pass without network or credentials', () => {
  for (const [file, count] of [['docs/overlays/g6p-a2u-failure-schema-v1.0.2/05_VALIDATE_FAILURE_REPORT_SCHEMAS.py', 20], ['scripts/test-nq5-report-validation.py', 118]]) {
    const result = spawnSync('python3', [file], { encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.status).toBe('PASS')
    expect(report.case_count).toBe(count)
    expect(report.results.every((probe) => probe.expectation_met)).toBe(true)
  }
})

test('missing, failed or unverified report and mismatched cut block before synthetic credential callback', () => {
  let resolved = 0
  const resolve = () => { resolved++; return 'SYNTHETIC_TEST_CALLBACK_ONLY' }
  expect(() => accountOperationAfterOfflinePass(undefined, candidate, 'ACCOUNT_PREFLIGHT', resolve)).toThrow()
  for (const gate of Object.keys(passing().mandatory_offline_gates)) for (const state of ['FAIL', 'NOT_VERIFIED']) {
    const report = passing()
    report.mandatory_offline_gates[gate] = state
    report.status = 'BLOCKED_WITH_EVIDENCE'; report.AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT = false
    report.blockers = [{ id: 'SYNTHETIC', summary: 'Synthetic gate failure', gate }]
    expect(() => accountOperationAfterOfflinePass(report, candidate, 'ACCOUNT_PREFLIGHT', resolve)).toThrow()
  }
  expect(() => assertAccountBootstrapAuthorized(passing(), { ...candidate, tree: '2'.repeat(40) })).toThrow()
  expect(() => accountOperationAfterOfflinePass(passing(), candidate, 'EXACT_RECEIPT', resolve)).toThrow()
  expect(resolved).toBe(0)
  expect(accountOperationAfterOfflinePass(passing(), candidate, 'ACCOUNT_PREFLIGHT', resolve)).toBe('SYNTHETIC_TEST_CALLBACK_ONLY')
  expect(resolved).toBe(1)
})

test('only the exact account request is eligible; second attempt, altered request and hidden fallback fail closed', () => {
  const request = { url: 'https://api.nansen.ai/api/v1/account', method: 'GET', retry: 0, redirect: 'error', concurrency: 1, projectedCredits: 0, maximumCredits: 0 }
  expect(() => assertExactAccountRequest(request, 0)).not.toThrow()
  for (const changed of [{ method: 'POST' }, { url: 'https://other.invalid/api/v1/account' }, { url: 'https://api.nansen.ai/api/v1/accounts' }, { url: request.url + '?x=1' }, { url: request.url + '#' }, { body: '' }, { query: {} }, { retry: 1 }, { redirect: 'follow' }, { concurrency: 2 }, { projectedCredits: 1 }, { maximumCredits: 1 }, { fallback: true }, { headers: { cookie: 'SYNTHETIC' } }]) expect(() => assertExactAccountRequest({ ...request, ...changed }, 0)).toThrow()
  expect(() => assertExactAccountRequest(request, 1)).toThrow()
  expect(() => assertExactAccountRequest(request, -1)).toThrow()
})

test('qualification hold is unconditional regardless of account/final PASS flags', () => {
  for (const report of [undefined, { ACCOUNT_PREFLIGHT_PASS: true }, { AUTHORIZED_TO_ISSUE: true, status: 'PASS' }]) expect(() => assertQualificationCheckpointHold(report)).toThrow(/held/)
})

test('truthful blocked checkpoint reports validate and final authorization stays false with incomplete gates or evidence', () => {
  const gates = { ...passing().mandatory_offline_gates, nq5_planner_and_runtime_tests: 'NOT_VERIFIED' }
  const offline = createBlockedOfflineReport(candidate, gates, '2026-09-16T00:00:00Z')
  const account = createUnissuedAccountReport('2026-09-16T00:00:00Z')
  expect(offline.AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT).toBe(false)
  expect(account.request.attempts_issued).toBe(0)
  expect(account.credential_status).toBe('NOT_RESOLVED')
  expect(account.account.available_credits).toBe(null)
  const final = { schema_version: '1.0.2', status: 'BLOCKED_WITH_EVIDENCE', AUTHORIZED_TO_ISSUE: false, checkpoint_hold: true, qualification_calls_allowed: false, qualification_attempts: 0, qualification_counted: 0, candidate_commit: candidate.commit, candidate_tree: candidate.tree, objective_gates: gates, offline_report: offline, account_report: account, offline_report_sha256: reportHash(offline), account_report_sha256: reportHash(account), blockers: offline.blockers, frozen_t1: null, available_credits: null, protected_reserve_credits: 250, source_manifest_sha256: 'a'.repeat(64), allowance_sha256: 'a'.repeat(64), offline_schema_sha256: 'a'.repeat(64), account_schema_sha256: 'a'.repeat(64), contracts_sha256: 'a'.repeat(64), review_sha256: 'a'.repeat(64) }
  expect(assertFinalCheckpointConsistency(final)).toBe(true)
  expect(() => assertFinalCheckpointConsistency({ ...final, AUTHORIZED_TO_ISSUE: true, status: 'PASS' })).toThrow()
  expect(() => assertFinalCheckpointConsistency({ ...final, objective_gates: { ...gates, nq5_planner_and_runtime_tests: 'PASS' } })).toThrow()
  for (const changed of [{ account_report_sha256: 'b'.repeat(64) }, { review_sha256: null }, { checkpoint_hold: false }, { qualification_attempts: 1 }, { candidate_tree: '2'.repeat(40) }, { available_credits: 5000 }, { protected_reserve_credits: 0 }]) expect(() => assertFinalCheckpointConsistency({ ...final, ...changed })).toThrow()
  expect(() => createBlockedOfflineReport(candidate, passing().mandatory_offline_gates, '2026-09-16T00:00:00Z')).toThrow()
})
