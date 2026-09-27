// Pure admission boundary. R1 adapter and credential resolution call these guards;
// qualification remains held independently of account/final authorization flags.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
export function validateNq5Report(kind, report) {
  const validation = spawnSync('python3', [path.join(root, 'scripts/nq5-report-validation.py')], { input: JSON.stringify({ kind, report }), encoding: 'utf8', maxBuffer: 1_000_000 })
  if (validation.error || validation.status === null || !validation.stdout) throw new Error('Offline report validation unavailable; deny authorization.')
  const result = JSON.parse(validation.stdout)
  if (validation.status !== 0 || result.valid !== true) throw new Error('Report rejected; deny authorization.')
  return result
}

export function assertAccountBootstrapAuthorized(report, candidate) {
  validateNq5Report('offline', report)
  if (report.status !== 'PASS' || report.AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT !== true || report.candidate_commit !== candidate.commit || report.candidate_tree !== candidate.tree) throw new Error('Account bootstrap is not authorized for this source cut.')
}

export function assertExactAccountRequest(request, attemptsAlreadyReserved) {
  const allowed = new Set(['url', 'method', 'body', 'query', 'retry', 'redirect', 'concurrency', 'projectedCredits', 'maximumCredits'])
  if (!request || Object.keys(request).some((key) => !allowed.has(key)) || attemptsAlreadyReserved !== 0 || request.url !== 'https://api.nansen.ai/api/v1/account' || request.method !== 'GET' || request.body !== undefined || request.query !== undefined || request.retry !== 0 || request.redirect !== 'error' || request.concurrency !== 1 || request.projectedCredits !== 0 || request.maximumCredits !== 0) throw new Error('Request is outside the exact one-attempt account bootstrap policy.')
}

export function assertQualificationCheckpointHold() {
  // Unconditional through R1, even with an otherwise valid final PASS report.
  throw new Error('Qualification requests are held for Lead checkpoint review and successor transfer.')
}

export function accountOperationAfterOfflinePass(report, candidate, operation, resolveApprovedCredential) {
  assertAccountBootstrapAuthorized(report, candidate)
  if (operation !== 'ACCOUNT_PREFLIGHT') throw new Error('Only the private account operation is permitted after offline PASS.')
  return resolveApprovedCredential()
}
