import { assertAccountBootstrapAuthorized, assertExactAccountRequest, validateNq5Report } from '../nq5-checkpoint-policy.mjs'
import { createUnissuedAccountReport } from '../nq5-checkpoint-reports.mjs'
import { AUTH } from './planner.mjs'
import { identity } from './schema.mjs'
import { readDurableRaw } from './journal.mjs'

export const ACCOUNT_REQUEST = Object.freeze({ url: 'https://api.nansen.ai/api/v1/account', method: 'GET', retry: 0, redirect: 'error', concurrency: 1, projectedCredits: 0, maximumCredits: 0 })
export const ACCOUNT_ID = identity({ method: 'GET', path: '/api/v1/account', body: null })
const numeric = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null
const agree = (values) => { const valid = values.filter((value) => value !== null); if (!valid.length || valid.some((value) => value !== valid[0])) throw new Error('CREDIT_RECONCILIATION'); return valid[0] }

export function parseAccount(bytes, headers) {
  let body
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new Error('PARSE') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('SCHEMA')
  const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : body
  const credits = data.credits && typeof data.credits === 'object' && !Array.isArray(data.credits) ? data.credits : {}
  const candidates = [data.available_credits, data.credits_remaining, data.remaining_credits, credits.available, credits.remaining].filter((value) => value !== undefined)
  if (!candidates.length || candidates.some((value) => numeric(value) === null)) throw new Error('SCHEMA')
  const balance = agree(candidates.map(numeric))
  const remaining = numeric(headers['x-nansen-credits-remaining'])
  if (headers['x-nansen-credits-remaining'] !== undefined && (remaining === null || remaining !== balance)) throw new Error('CREDIT_RECONCILIATION')
  const cost = numeric(headers['x-nansen-credits-cost']), used = numeric(headers['x-nansen-credits-used'])
  const creditFacts = [headers['x-nansen-credits-cost'], headers['x-nansen-credits-used'], data.credits_cost, data.credits_used].filter((value) => value !== undefined)
  if (!creditFacts.length || creditFacts.some((value) => numeric(value) !== 0)) throw new Error('CREDIT_RECONCILIATION')
  const plan = typeof data.plan === 'string' ? data.plan.toUpperCase() : null
  return { availableCredits: balance, remaining, cost, used, plan: ['FREE', 'PRO'].includes(plan) ? plan : plan === null ? null : 'OTHER_REDACTED', included: numeric(credits.included ?? data.included_credits), promotional: numeric(credits.promotional ?? data.promotional_credits), purchased: numeric(credits.purchased ?? data.purchased_credits) }
}

export function validateCachedAccount(report, journal) {
  validateNq5Report('account', report)
  const starts = journal.rows.filter((row) => row.event === 'START' && row.record.logicalId === ACCOUNT_ID)
  const terminals = journal.rows.filter((row) => row.event === 'TERMINAL' && row.record.logical_request_id === ACCOUNT_ID)
  if (report.request.attempts_issued === 0) {
    if (starts.length || terminals.length || report.ACCOUNT_PREFLIGHT_PASS) throw new Error('Cached account attempt evidence disagrees.')
    return report
  }
  if (starts.length !== 1 || terminals.length !== 1) throw new Error('Cached account terminal missing or ambiguous; no repeat permitted.')
  const record = terminals[0].record
  if (record.endpoint_family !== 'account' || record.endpoint_path !== '/api/v1/account' || record.question_lens !== 'ADMIN' || record.qualification_counted || record.http_status !== report.response.http_status || record.budget.actual_credits !== report.response.actual_credit_delta) throw new Error('Cached account terminal facts disagree.')
  if (report.ACCOUNT_PREFLIGHT_PASS) {
    const bytes = readDurableRaw(record.storage)
    if (record.terminal_status !== 'SUCCESS_NOT_COUNTED' || record.storage.primary_raw_sha256 !== report.storage.primary_raw_sha256 || record.storage.mirror_raw_sha256 !== report.storage.mirror_raw_sha256) throw new Error('Cached account storage facts disagree.')
    const headers = Object.fromEntries(Object.entries({ 'x-nansen-credits-cost': record.provider_headers.credits_cost, 'x-nansen-credits-used': record.provider_headers.credits_used, 'x-nansen-credits-remaining': record.provider_headers.credits_remaining }).filter(([, value]) => value !== null).map(([key, value]) => [key, String(value)]))
    const parsed = parseAccount(bytes, headers)
    const expected = { available_credits: parsed.availableCredits, plan_class: parsed.plan, included_credits: parsed.included, promotional_credits: parsed.promotional, purchased_credits: parsed.purchased }
    if (Object.entries(expected).some(([key, value]) => report.account[key] !== value) || parsed.cost !== report.response.credits_cost || parsed.used !== report.response.credits_used || parsed.remaining !== report.response.credits_remaining_header) throw new Error('Cached account observed facts disagree.')
  }
  return report
}

export function uncertainPriorAccountReport(timestamp = new Date().toISOString()) {
  const report = createUnissuedAccountReport(timestamp)
  report.credential_status = 'PRESENT_REDACTED'; report.request.attempts_issued = 1
  report.ledger.terminal_status = 'FAILED_PRIVATE_NONQUALIFICATION'
  report.response.transport_error_class = 'LEDGER'
  report.blockers = [{ id: 'ACCOUNT_PRIOR_ATTEMPT_EVIDENCE_UNCERTAIN', summary: 'A prior private reservation or cached attempt has unresolved evidence. One attempt is conservatively consumed; no credential resolution, retry or qualification is permitted.' }]
  validateNq5Report('account', report)
  return report
}

export async function runAccountAdapter({ offline, candidate, request = ACCOUNT_REQUEST, resolveCredential, transport, journal, persist, scan = () => true, project = (report) => report, timestamp = new Date().toISOString() }) {
  const report = createUnissuedAccountReport(timestamp)
  let failure = null, storage = null, credential = null
  const fail = (code) => { failure = code; report.response.transport_error_class = code; report.blockers = [{ id: code === 'CREDIT_RECONCILIATION' ? 'ACCOUNT_CREDIT_RECONCILIATION_MISMATCH' : `ACCOUNT_${code}`, summary: 'Private account preflight failed closed; no retry, fallback or qualification operation is permitted.', evidence_refs: ['REPORTS/NQ5_ACCOUNT_PREFLIGHT_REDACTED.json'] }] }
  try {
    assertAccountBootstrapAuthorized(offline, candidate)
    assertExactAccountRequest(request, journal.rows.filter((row) => row.event === 'START' && row.record.logicalId === ACCOUNT_ID).length)
  } catch { fail('OFFLINE_GATES_NOT_PASS'); validateNq5Report('account', report); return report }
  try { credential = await resolveCredential() } catch { report.credential_status = 'RESOLUTION_FAILED_REDACTED'; fail('CREDENTIAL_RESOLUTION_FAILED') }
  if (!failure && (typeof credential !== 'string' || !credential || /[\r\n\0]/.test(credential))) { report.credential_status = 'MISSING_OR_UNREADABLE'; fail('CREDENTIAL_UNAVAILABLE') }
  if (!failure) {
    try { if (!journal.reserve(ACCOUNT_ID, 'ACCOUNT-ONE-ATTEMPT')) throw new Error(); } catch { report.credential_status = 'RESOLUTION_FAILED_REDACTED'; fail('LEDGER') }
  }
  if (!failure) {
    report.credential_status = 'PRESENT_REDACTED'; report.request.attempts_issued = 1
    report.ledger.terminal_status = 'FAILED_PRIVATE_NONQUALIFICATION'
    let response
    try { response = await transport({ endpoint: '/api/v1/account', method: 'GET', credential }) } catch (error) { fail(['DNS', 'TLS', 'TIMEOUT'].includes(error?.code) ? error.code : 'TRANSPORT') }
    if (!failure) {
      if (!Number.isInteger(response?.status) || response.status < 100 || response.status > 599 || !(response.body instanceof Uint8Array) || !response.capturedHeaders || typeof response.capturedHeaders !== 'object') fail('SCHEMA')
      else {
        report.response.http_status = response.status
        try {
          storage = persist(ACCOUNT_ID, Buffer.from(response.body))
          if (!storage || storage.bytes_equal !== true || storage.primary_raw_sha256 !== storage.mirror_raw_sha256 || !/^[a-f0-9]{64}$/.test(storage.primary_raw_sha256)) throw new Error()
          Object.assign(report.storage, { persistence_status: 'PASS', primary_raw_sha256: storage.primary_raw_sha256, mirror_raw_sha256: storage.mirror_raw_sha256, bytes_equal: true })
        } catch { report.storage.persistence_status = 'FAIL'; fail('PERSISTENCE') }
        const cost = numeric(response.capturedHeaders['x-nansen-credits-cost']), used = numeric(response.capturedHeaders['x-nansen-credits-used'])
        Object.assign(report.response, { credits_cost: cost, credits_used: used, credits_remaining_header: numeric(response.capturedHeaders['x-nansen-credits-remaining']), actual_credit_delta: cost !== null && used !== null && cost !== used ? null : cost ?? used })
        // No interpretation or public projection before both raw copies are durable.
        if (!failure && response.status !== 200) fail('HTTP')
        if (!failure) {
          try {
            const parsed = parseAccount(response.body, response.capturedHeaders)
            Object.assign(report.response, { credits_cost: parsed.cost, credits_used: parsed.used, credits_remaining_header: parsed.remaining, actual_credit_delta: 0, transport_error_class: null })
            Object.assign(report.account, { available_credits: parsed.availableCredits, plan_class: parsed.plan, included_credits: parsed.included, promotional_credits: parsed.promotional, purchased_credits: parsed.purchased })
          } catch (error) { fail(['PARSE', 'SCHEMA', 'CREDIT_RECONCILIATION'].includes(error.message) ? error.message : 'SCHEMA') }
        }
      }
    }
    if (!failure) {
      try {
        const trial = project(structuredClone(report))
        if (JSON.stringify(trial) !== JSON.stringify(report)) throw new Error()
        report.secret_scan = scan(report, credential) === true && !JSON.stringify(report).includes(credential) ? 'PASS' : 'FAIL'
        if (report.secret_scan !== 'PASS') throw new Error()
      } catch { report.secret_scan = 'FAIL'; fail('REDACTION') }
    }
    const record = {
      schema_version: '5.0.1', campaign_id: 'NQ5', authorization_id: AUTH, tranche_id: 'ACCOUNT_BOOTSTRAP', batch_id: 'ADMIN', ledger_sequence: journal.rows.length + 1, logical_request_id: ACCOUNT_ID, attempt_id: 'ACCOUNT-ONE-ATTEMPT', endpoint_family: 'account', endpoint_path: '/api/v1/account', business_question: 'Verify private available credit balance before any campaign request.', purpose_code: 'ACCOUNT_PREFLIGHT', consumer_ids: ['PRECALL_AUTHORIZATION'], selection_lineage: ['LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001'], request_body_sha256: identity(null), issued_at_utc: timestamp, terminal_status: failure ? 'TERMINAL_FAILURE' : 'SUCCESS_NOT_COUNTED', qualification_counted: false, qualification_sequence: null, http_status: report.response.http_status,
      provider_headers: { credits_cost: report.response.credits_cost, credits_used: report.response.credits_used, credits_remaining: report.response.credits_remaining_header }, storage: storage ?? { primary_raw_sha256: null, mirror_raw_sha256: null, primary_path: null, mirror_path: null, bytes_equal: null }, classification: { temporal_class: 'ADMIN', public_export_disposition: 'PRIVATE_ONLY', route_disposition: 'ADMIN_NONQUALIFICATION', evidence_grade: 'NONE', result_count: 0 }, budget: { projected_credits: 0, actual_credits: report.response.actual_credit_delta, cumulative_actual_credit_delta: report.response.actual_credit_delta }, investigative_question_id: null, question_lens: 'ADMIN', coverage_cell_ids: [], caseboard_consumer_ids: [],
    }
    try { journal.terminal(record) } catch { fail('LEDGER') }
    if (!failure) { report.status = 'PASS'; report.ACCOUNT_PREFLIGHT_PASS = true; report.blockers = []; report.ledger.terminal_status = 'COMPLETED_PRIVATE_NONQUALIFICATION' }
  }
  credential = null
  validateNq5Report('account', report)
  return report
}
