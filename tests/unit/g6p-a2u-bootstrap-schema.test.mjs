import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'

test('independent Draft 2020-12 controls reproduce unrepresentable blocked source-contract states without credentials or transport', () => {
  const run = spawnSync('python3', ['scripts/validate-g6p-a2u-bootstrap-failure-paths.py'], { encoding: 'utf8' })
  expect(run.status, run.stderr).toBe(0)
  const report = JSON.parse(run.stdout)
  expect(report.probe_execution).toBe('PASS')
  expect(report.is_authorization_report).toBe(false)
  expect(report.AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT).toBe(false)
  expect(report.AUTHORIZED_TO_ISSUE).toBe(false)
  expect(report.credential_resolution_attempted).toBe(false)
  expect(report.provider_calls_issued).toBe(0)
  expect(report.qualification_counted).toBe(0)
  expect(report.cases).toHaveLength(32)
  expect(report.cases.every((probe) => probe.synthetic_test_only && probe.expectation_met)).toBe(true)
  expect(report.cases.filter((probe) => probe.valid)).toHaveLength(4)
  const mismatch = report.cases.find((probe) => probe.name === 'account_BLOCKED_storage_mismatch')
  expect(mismatch.errors.map((error) => error.instance_path)).toContain('/storage/bytes_equal')
  const failed = report.cases.find((probe) => probe.name === 'offline_BLOCKED_source_admission_FAIL')
  expect(failed.errors.map((error) => error.instance_path)).toContain('/mandatory_offline_gates/source_admission')
})
