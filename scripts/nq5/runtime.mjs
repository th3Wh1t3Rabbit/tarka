import { assertQualificationCheckpointHold, validateNq5Report } from '../nq5-checkpoint-policy.mjs'
import { AUTH, ALLOWANCE, admitContract, logicalRequest, utilityDecision } from './planner.mjs'
import { compilePublicIndex, projectResponse } from './projection.mjs'
import { identity, validateSchema } from './schema.mjs'
import fs from 'node:fs'
import { readDurableRaw } from './journal.mjs'
import { assertCampaignExecutionAdmission } from '../nq5-r3/checkpoint.mjs'

// The checkpoint exposes no qualification network entry. Fixture execution is
// explicitly separate and can never be recorded as this task's provider activity.
export class Nq5Runtime {
  constructor({ mode, plan, reserve, account, journal, persist, fixtureTransport, cutoffUtc, utilityReview = null, qualificationCheckpoint = null }) {
    if (mode !== 'OFFLINE_FIXTURE') {
      if(plan?.schemaVersion==='3.0.0') {
        if(!qualificationCheckpoint || qualificationCheckpoint.plan!==plan || qualificationCheckpoint.reserve!==reserve)throw new Error('Qualification held: runtime and verified checkpoint artifacts must match.')
        assertCampaignExecutionAdmission(qualificationCheckpoint)
      }
      assertQualificationCheckpointHold()
    }
    validateNq5Report('account', account)
    const { hash, ...contents } = plan
    const { hash: reserveHash, ...reserveContents } = reserve
    if (identity(contents) !== hash || identity(reserveContents) !== reserveHash || !plan.frozen || plan.observedAccountHash !== identity(account) || reserve.parentPlanHash !== hash || plan.allowanceHash !== identity(ALLOWANCE) || plan.worstCaseCredits + reserve.worstCaseCredits > account.account.available_credits - 250) throw new Error('Runtime requires a frozen, balance-bound main/reserve plan.')
    Object.assign(this, { plan, reserve, account, journal, persist, fixtureTransport, cutoffUtc, utilityReview })
  }
  async execute(logicalId, cell) {
    const lock = `${this.journal.file}.issue.lock`
    let fd
    try { fd = fs.openSync(lock, 'wx', 0o600) } catch { throw new Error('Concurrency one; no issue allowed.') }
    try { return await this.executeReserved(logicalId, cell) } finally { fs.closeSync(fd); fs.unlinkSync(lock) }
  }
  async executeReserved(logicalId, cell) {
    const request = [...this.plan.requests, ...this.reserve.requests].find((row) => row.logicalId === logicalId)
    if (!request || logicalRequest(request) !== logicalId || !cell || !request.coverageCells.includes(cell.id)) throw new Error('Runtime request is outside frozen coverage plan.')
    const previous = this.journal.lookup(logicalId)
    if (previous) { if (previous.storage.bytes_equal === true) readDurableRaw(previous.storage); return { syntheticTestOnly: true, issued: false, reused: true, countDelta: 0, terminal: previous } }
    if (request.partition.page > 1) {
      const predecessor = [...this.plan.requests, ...this.reserve.requests].find((row) => row.family === request.family && row.coverageKey.subject_id === request.coverageKey.subject_id && row.coverageKey.time_window_id === request.coverageKey.time_window_id && row.partition.page === request.partition.page - 1)
      const durable = predecessor && this.journal.rows.find((row) => row.event === 'TERMINAL' && row.record.logical_request_id === predecessor.logicalId)
      if (!durable?.continuation?.coverageClosed || durable.record.budget.actual_credits === null) throw new Error('PageN requires durable, reconciled preceding-page coverage.')
      if (durable.continuation.isLastPage || !durable.record.classification.result_count) return { syntheticTestOnly: true, issued: false, stoppedAtTerminalPage: true, countDelta: 0 }
    }
    if (this.journal.rows.some((row) => row.event === 'START' && row.record.logicalId !== logicalId && !this.journal.lookup(row.record.logicalId))) throw new Error('Unresolved spending reservation stops the runtime.')
    // Pending reservations survive restart; uncertainty never permits a second spend.
    if (!this.journal.reserve(logicalId, `FIXTURE.${logicalId}`)) return { syntheticTestOnly: true, issued: false, pending: true, countDelta: 0 }
    const admitted = this.plan.contracts.find((contract) => contract.hash === request.contractHash)
    const { hash: _hash, ...contractInput } = admitted ?? {}
    const contract = admitContract(contractInput)
    const counted = this.journal.rows.filter((row) => row.event === 'TERMINAL' && row.record.qualification_counted)
    const creditDelta = this.journal.rows.filter((row) => row.event === 'TERMINAL').reduce((sum, row) => sum + (row.record.budget.actual_credits ?? row.record.budget.projected_credits), 0)
    const unknownSpend = this.journal.rows.some((row) => row.event === 'TERMINAL' && row.record.budget.actual_credits === null)
    if (counted.length >= ALLOWANCE.global_limits.batch_size && (!this.utilityReview || this.utilityReview.countAtReview !== Math.floor(counted.length / ALLOWANCE.global_limits.batch_size) * ALLOWANCE.global_limits.batch_size || utilityDecision(this.utilityReview, counted.length, this.account.account.available_credits - creditDelta, { worstCaseCredits: request.worstCaseCredits }) !== 'CONTINUE_UTILITY_BOUND')) throw new Error('Mandatory marginal-utility review stops issue.')
    if (unknownSpend || creditDelta + request.worstCaseCredits > this.account.account.available_credits - 250 || creditDelta + request.worstCaseCredits > 15000 || counted.length >= 12288) throw new Error('Budget uncertainty or protected reserve stops issue.')
    const timestamp = new Date().toISOString()
    let status = null, storage = { primary_raw_sha256: null, mirror_raw_sha256: null, primary_path: null, mirror_path: null, bytes_equal: null }, actualCredits = null, response = null, publicArtifact = null, rawBytes = null, failure = null
    try {
      const raw = await this.fixtureTransport(structuredClone(request))
      status = raw.status
      rawBytes = Buffer.from(raw.body)
      storage = this.persist(logicalId, rawBytes)
      if (storage.bytes_equal !== true || storage.primary_raw_sha256 !== storage.mirror_raw_sha256) throw new Error()
      // Raw persistence precedes UTF-8 decoding, JSON interpretation and schema validation.
      response = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBytes))
      validateSchema('provider', response, contract.responseSchema)
      actualCredits = raw.credits
      if (!Number.isFinite(actualCredits) || actualCredits < 0) { actualCredits = null; throw new Error() }
      if (!Number.isFinite(actualCredits) || actualCredits < 0 || actualCredits > contract.maximumCredits || status < 200 || status > 299) throw new Error()
    } catch { failure = 'PRIVATE_FIXTURE_REQUEST_FAILURE' }
    const record = { schema_version: '5.0.1', campaign_id: 'NQ5', authorization_id: AUTH, tranche_id: 'T1', batch_id: 'FIXTURE', ledger_sequence: this.journal.rows.length + 1, logical_request_id: logicalId, attempt_id: `FIXTURE.${logicalId}`, endpoint_family: request.family, endpoint_path: request.path, business_question: request.businessQuestion, purpose_code: request.purpose, consumer_ids: request.consumers, selection_lineage: request.lineage, request_body_sha256: identity(request.body), issued_at_utc: timestamp, terminal_status: failure ? 'TERMINAL_FAILURE' : 'SUCCESS_COUNTED', qualification_counted: !failure, qualification_sequence: failure ? null : counted.length + 1, qualification_exclusion_reason: failure, http_status: status, provider_headers: { credits_cost: actualCredits }, storage, classification: { temporal_class: 'WITHIN_CUTOFF', public_export_disposition: 'ALLOWLIST_ONLY', route_disposition: request.lens === 'STATE' ? 'STATE_CORROBORATION' : request.lens === 'RELATIONSHIPS' ? 'CANDIDATE_RELATIONSHIP' : request.lens === 'RECEIPT' ? 'EXACT_EVENT' : 'BOUNDED_ACTIVITY', evidence_grade: request.lens === 'STATE' ? 'CORROBORATING' : request.lens === 'RELATIONSHIPS' ? 'CONTEXTUAL' : 'EXACT', result_count: response?.data?.length ?? 0, coverage_supports_negative_evidence: cell.supportsNegative === true }, budget: { projected_credits: request.expectedCredits, actual_credits: actualCredits, cumulative_actual_credit_delta: actualCredits === null ? null : creditDelta + actualCredits }, investigative_question_id: request.questionId, question_lens: request.lens, coverage_cell_ids: request.coverageCells, coverage_key: request.coverageKey }
    if (!failure) {
      try { record.classification.result_count = projectResponse(contractInput, response, cell, this.cutoffUtc, rawBytes).rows.length; publicArtifact = compilePublicIndex(record, contractInput, response, cell, this.cutoffUtc, rawBytes) } catch { record.qualification_counted = false; record.qualification_sequence = null; record.terminal_status = 'SUCCESS_NOT_COUNTED'; record.qualification_exclusion_reason = 'PUBLIC_OR_COVERAGE_ADMISSION_FAILED' }
      const emptyCount = counted.filter((row) => row.record.classification.result_count === 0).length
      if (!record.classification.result_count && (emptyCount + 1) / (counted.length + 1) > ALLOWANCE.global_limits.max_empty_counted_ratio) { publicArtifact = null; record.qualification_counted = false; record.qualification_sequence = null; record.terminal_status = 'SUCCESS_NOT_COUNTED'; record.qualification_exclusion_reason = 'PARENT_EMPTY_COUNT_RATIO_EXCEEDED' }
    }
    const pagination = response?.pagination
    const continuation = pagination && pagination.page === request.partition.page && typeof pagination.is_last_page === 'boolean' ? { page: pagination.page, isLastPage: pagination.is_last_page, coverageClosed: record.qualification_counted } : null
    if (publicArtifact) record.storage.normalized_sha256 = publicArtifact.publicRecord.normalized_sha256
    record.novelty_expectation = request.novelty; record.bounded_stop_rule = request.stopRule
    this.journal.terminal(record, continuation)
    return { syntheticTestOnly: true, issued: true, reused: false, countDelta: record.qualification_counted ? 1 : 0, terminal: record, publicArtifact }
  }
}
