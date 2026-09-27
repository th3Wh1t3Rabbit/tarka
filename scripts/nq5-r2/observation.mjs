import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { ACCOUNT_ID, validateCachedAccount } from '../nq5/account.mjs'
import { readDurableRaw } from '../nq5/journal.mjs'
import { canonical, identity, sha, freeze } from '../nq5/schema.mjs'
import { validateActiveSchema } from './authority.mjs'

export const OBSERVATION_CUT = '6572ea4ed1ea82902bac50669a2e534762558cea'
const verifiedCodeProofs = new WeakSet()
export const PROTECTED_CODE = ['scripts/nq5/account.mjs', 'scripts/nq5/credential.mjs', 'scripts/nq5/journal.mjs', 'scripts/nq5/schema.mjs', 'scripts/nq5/planner.mjs', 'scripts/nq5-schema-validation.py', 'scripts/nq5-checkpoint-policy.mjs', 'scripts/nq5-checkpoint-reports.mjs', 'scripts/nq5-report-validation.py', 'src/acquisition/live/transport.ts']
export function proveUnchangedObservationCode(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  const evidence = PROTECTED_CODE.map(relative => {
    const original = execFileSync('git', ['show', OBSERVATION_CUT + ':' + relative], { cwd: root })
    if (!fs.readFileSync(path.join(root, relative)).equals(original) || git('log', '--format=%H', OBSERVATION_CUT + '..HEAD', '--', relative)) throw new Error('Relevant post-observation code mutation; local reuse blocked.')
    return { source: relative, originalSha256: sha(original), currentSha256: sha(original), changedSinceObservation: false }
  })
  const historicalFiles = git('ls-files', '--', 'docs/overlays').split('\n').filter(Boolean)
  for (const relative of historicalFiles) if (!fs.readFileSync(path.join(root, relative)).equals(execFileSync('git', ['show', OBSERVATION_CUT + ':' + relative], { cwd: root }))) throw new Error('Historical account schema or allowance changed.')
  if (git('log', '--format=%H', OBSERVATION_CUT + '..HEAD', '--', 'docs/overlays')) throw new Error('Historical account dependencies changed after observation.')
  const proof = freeze({ status: 'PASS', noRelevantPostObservationMutation: true, observationCommit: OBSERVATION_CUT, historicalSchemaAllowanceFilesUnchanged: historicalFiles.length, evidence })
  verifiedCodeProofs.add(proof); return proof
}
export function verifyLocalObservation(accountBytes, journalBytes, codeProof) {
  if (!verifiedCodeProofs.has(codeProof)) throw new Error('Account code preservation unproved; serialized markers are not proof.')
  if (!journalBytes.length || journalBytes.at(-1) !== 10) throw new Error('Account journal is not complete; read-only remediation cannot repair it.')
  const rows = new TextDecoder('utf-8', { fatal: true }).decode(journalBytes).trimEnd().split('\n').map(line => JSON.parse(line))
  if (rows.length !== 2 || rows[0].event !== 'START' || rows[1].event !== 'TERMINAL' || rows[0].sequence !== 1 || rows[1].sequence !== 2 || rows[0].record.logicalId !== ACCOUNT_ID || rows[1].record.logical_request_id !== ACCOUNT_ID || rows[0].record.attemptId !== rows[1].record.attempt_id || rows[1].record.ledger_sequence !== 2) throw new Error('Account journal identity or consumed attempt is inconsistent.')
  validateActiveSchema('ledger', rows[1].record)
  const account = JSON.parse(accountBytes); validateActiveSchema('account', account)
  validateCachedAccount(account, { rows })
  const original = rows[1].record
  if (original.attempt_id !== 'ACCOUNT-ONE-ATTEMPT' || original.authorization_id !== account.parent_authorization_id || original.purpose_code !== 'ACCOUNT_PREFLIGHT' || original.request_body_sha256 !== identity(null) || original.issued_at_utc !== account.generated_at_utc || original.budget.projected_credits !== 0 || original.budget.cumulative_actual_credit_delta !== 0 || original.classification.temporal_class !== 'ADMIN' || original.classification.public_export_disposition !== 'PRIVATE_ONLY' || original.classification.route_disposition !== 'ADMIN_NONQUALIFICATION' || original.classification.evidence_grade !== 'NONE' || original.classification.result_count !== 0 || original.investigative_question_id !== null || original.qualification_sequence !== null || identity(original.consumer_ids) !== identity(['PRECALL_AUTHORIZATION']) || identity(original.selection_lineage) !== identity(['LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001'])) throw new Error('Original account terminal identity does not agree with report.')
  if (!account.ACCOUNT_PREFLIGHT_PASS || account.request.attempts_issued !== 1 || account.response.http_status !== 200 || account.response.actual_credit_delta !== 0) throw new Error('Historical observation is not durably reusable.')
  const terminal = rows[1].record, before = readDurableRaw(terminal.storage), after = readDurableRaw(terminal.storage)
  if (!before.equals(after)) throw new Error('Private observation changed during revalidation.')
  return { account, receipt: { schemaVersion: '1.0.0', status: 'PASS_LOCAL_REVALIDATION_ONLY', observationCommit: OBSERVATION_CUT, originalRedactedReportSha256: sha(accountBytes), originalPrivateJournalSha256: sha(journalBytes), originalTerminalIdentity: identity(terminal), originalTerminalEnvelopeIdentity: sha(Buffer.from(canonical(rows[1]))), logicalRequestIdentity: ACCOUNT_ID, primaryRawSha256: terminal.storage.primary_raw_sha256, mirrorRawSha256: terminal.storage.mirror_raw_sha256, bytesEqual: true, rawHashesAgreeWithRedactedReport: true, httpStatus: 200, originalAttemptsConsumed: 1, additionalAttempts: 0, actualCreditDelta: 0, availableCredits: account.account.available_credits, protectedReserveCredits: 250, credentialResolutionInGate: false, providerRequestsInGate: 0, accountAdapterInvoked: false, transportInvoked: false, privateJournalMutated: false, rawStorageMutated: false, localReuseOnly: true, noRelevantPostObservationCodeMutation: true, protectedCodeProof: codeProof, qualificationAttempts: 0, qualificationCounted: 0, originalOrderingAccepted: false, historicalDisposition: 'CONSUMED_OBSERVATION_AFTER_REJECTED_OFFLINE_PASS_NOT_REAUTHORIZED', privatePathsIncluded: false, rawPayloadIncluded: false } }
}
export function reusePreservedObservation(root, accountBytes) {
  const proof = proveUnchangedObservationCode(root)
  const directory = path.join(os.homedir(), '.local/share/trace-escape/nq5-private/r1-account')
  const journalFile = path.join(directory, 'account.jsonl'), cacheFile = path.join(directory, 'redacted-checkpoint.json')
  if (!fs.lstatSync(journalFile).isFile() || !fs.lstatSync(cacheFile).isFile()) throw new Error('Preserved observation must be regular local files; no linked source is read.')
  const journalBytes = fs.readFileSync(journalFile), cacheBytes = fs.readFileSync(cacheFile), cache = JSON.parse(cacheBytes)
  if (cache.commit !== OBSERVATION_CUT || cache.tree !== 'b263a41575b86ceb0a3920fba1bb40f67de3cf75' || identity(cache.report) !== identity(JSON.parse(accountBytes))) throw new Error('Recorded account cache does not match reviewed delivery.')
  const result = verifyLocalObservation(accountBytes, journalBytes, proof)
  if (result.account.account.available_credits !== 630027 || !fs.readFileSync(journalFile).equals(journalBytes) || !fs.readFileSync(cacheFile).equals(cacheBytes)) throw new Error('Recorded account observation changed.')
  return result
}
