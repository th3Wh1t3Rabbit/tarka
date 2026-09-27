import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canonical, identity, validateSchema } from '../../scripts/nq5/schema.mjs'
import { Nq5Runtime } from '../../scripts/nq5/runtime.mjs'
import { admitContract, buildPlan, freezeT1, logicalRequest, utilityDecision } from '../../scripts/nq5/planner.mjs'
import { PrivateJournal, persistRaw, recoverJournal, publishPrivateCache } from '../../scripts/nq5/journal.mjs'
import { ACCOUNT_REQUEST, runAccountAdapter, validateCachedAccount, uncertainPriorAccountReport } from '../../scripts/nq5/account.mjs'
import { implementationIdentity, assertAuthorityPreserved } from '../../scripts/nq5-review-identity.mjs'
import { compilePublicIndex, projectResponse } from '../../scripts/nq5/projection.mjs'
import { assertQualificationCheckpointHold } from '../../scripts/nq5-checkpoint-policy.mjs'
import { ALLOWANCE, accountReport, candidate, fixtureCell, fixtureContract, fixtureRequest, ledgerRecord, offlineReport, responseBody } from '../fixtures/nq5-offline.mjs'

const directories = []
const temp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-nq5-fixture-')); directories.push(dir); return dir }
afterEach(() => { for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
const plan = (requests = [fixtureRequest()], contracts = [fixtureContract()]) => buildPlan(requests, contracts, ['ACCEPTED.FIXTURE_SEED'], ALLOWANCE)
const savedRecord = (body = responseBody()) => { const dir = temp(), bytes = Buffer.from(JSON.stringify(body)); return { bytes, record: ledgerRecord('b'.repeat(64), persistRaw(path.join(dir, 'primary'), path.join(dir, 'mirror'), 'b'.repeat(64), bytes)) } }

describe('R1 review binding and conservative malformed-tail recovery', () => {
  it('publishes a complete private cache atomically and never overwrites a prior attempt', () => {
    const file = path.join(temp(), 'cache.json'), bytes = Buffer.from('{"synthetic":true}\n')
    publishPrivateCache(file, bytes); expect(fs.readFileSync(file).equals(bytes)).toBe(true)
    expect(() => publishPrivateCache(file, 'replacement')).toThrow(); expect(fs.readFileSync(file).equals(bytes)).toBe(true)
    expect(fs.readdirSync(path.dirname(file))).toEqual(['cache.json'])
  })
  it.each(['\u00a0', '\ufeff', '\u000b'])('preserves impossible JSON whitespace tail %j', (whitespace) => {
    const file = path.join(temp(), 'journal.jsonl'), bytes = Buffer.from('{"a":' + whitespace)
    fs.writeFileSync(file, bytes)
    expect(() => recoverJournal(file)).toThrow(); expect(fs.readFileSync(file).equals(bytes)).toBe(true)
  })
  it.each(['docs/overlays/allowance.yaml', '.npmrc'])('invalidates a stale review after governed edit %s', (name) => {
    const dir = temp(), git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
    git('init', '--quiet'); git('config', 'user.name', 'Synthetic Review'); git('config', 'user.email', 'review@example.invalid')
    fs.mkdirSync(path.join(dir, 'docs/overlays'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'docs/overlays/allowance.yaml'), 'ceiling: 15000\n'); fs.writeFileSync(path.join(dir, '.npmrc'), 'audit=false\n')
    git('add', '.'); git('commit', '--quiet', '-m', 'synthetic initial'); const baseline = git('rev-parse', 'HEAD'), before = implementationIdentity(dir)
    fs.appendFileSync(path.join(dir, name), '# synthetic mutation\n'); git('add', name); git('commit', '--quiet', '-m', 'synthetic mutation')
    expect(implementationIdentity(dir)).not.toBe(before)
    if (name.startsWith('docs/overlays')) expect(() => assertAuthorityPreserved(dir, baseline)).toThrow()
    else expect(assertAuthorityPreserved(dir, baseline)).toBe(true)
  })
})

describe('R1 immutable planner and utility admission — synthetic only', () => {
  it('canonicalizes objects and set filters without erasing ordered arrays', () => {
    const first = { method: 'POST', path: '/api/v1/test', body: { addresses: ['0xAB', '0xab'], order_by: ['a', 'b'] } }
    expect(logicalRequest(first)).toBe(logicalRequest({ ...first, body: { order_by: ['a', 'b'], addresses: ['0xab'] } }))
    expect(logicalRequest(first)).not.toBe(logicalRequest({ ...first, body: { ...first.body, order_by: ['b', 'a'] } }))
    expect(() => canonical({ value: Infinity })).toThrow()
  })
  it('binds immutable deterministic plans and rejects duplicates including casing variants', () => {
    const contract = fixtureContract(), request = fixtureRequest(1, contract)
    const first = plan([request], [contract]), second = plan([request], [contract])
    expect(first.hash).toBe(second.hash); expect(Object.isFrozen(first.requests[0].body)).toBe(true)
    expect(() => { first.requests[0].body.address = 'mutated' }).toThrow()
    expect(() => plan([request, structuredClone(request)], [contract])).toThrow()
  })
  it.each(['authorization', 'ceiling', 'purpose', 'lens', 'lineage', 'consumer', 'coverage', 'partition', 'body', 'stop', 'novelty'])('rejects request/allowance falsifier %s', (name) => {
    const allowance = structuredClone(ALLOWANCE), request = fixtureRequest(), contract = fixtureContract()
    if (name === 'authorization') allowance.authorization_id = 'OTHER'
    if (name === 'ceiling') allowance.global_limits.absolute_success_ceiling = 100000
    if (name === 'purpose') request.purpose = 'LABEL_LOOKUP'
    if (name === 'lens') { request.family = 'profiler/address/historical-balances'; request.path = '/api/v1/profiler/address/historical-balances' }
    if (name === 'lineage') request.lineage = ['UNACCEPTED.SEED']
    if (name === 'consumer') request.consumers = []
    if (name === 'coverage') request.coverageCells = []
    if (name === 'partition') request.partition.minimumWindowSeconds = 1
    if (name === 'body') request.body.private = true
    if (name === 'stop') request.stopRule = ''
    if (name === 'novelty') request.novelty = ''
    expect(() => buildPlan([request], [contract], ['ACCEPTED.FIXTURE_SEED'], allowance)).toThrow()
  })
  it.each(['endpoint', 'snapshot', 'pricing', 'rate', 'coverage', 'redistribution', 'stale', 'schema', 'restricted'])('rejects contract falsifier %s', (name) => {
    const contract = fixtureContract()
    if (name === 'endpoint') contract.path = '/api/v1/arbitrary'
    if (name === 'snapshot') contract.snapshots.endpoint = '0'.repeat(64)
    if (name === 'pricing') contract.maximumCredits = 0
    if (name === 'rate') contract.requestsPerMinute = 201
    if (name === 'coverage') contract.coverage = 'UNKNOWN'
    if (name === 'redistribution') contract.redistribution = 'ALL_FIELDS'
    if (name === 'stale') contract.retrievedAtUtc = '2023-03-13T00:00:00Z'
    if (name === 'schema') contract.responseSchema = { $ref: 'https://example.invalid/private' }
    if (name === 'restricted') contract.family = 'smart-money'
    expect(() => admitContract(contract)).toThrow()
  })
  it('refuses unobserved/schema-invalid balance, tampered plan, insufficient reserve and duplicate reserve', () => {
    const current = plan()
    expect(() => freezeT1(current, { status: 'PASS', ACCOUNT_PREFLIGHT_PASS: true, request: { attempts_issued: 1 }, response: { actual_credit_delta: 0 }, account: { available_credits: 1000 } })).toThrow()
    expect(() => freezeT1({ ...current, worstCaseCredits: 0 }, accountReport())).toThrow()
    expect(() => freezeT1(current, accountReport(252))).toThrow()
    expect(() => freezeT1(current, accountReport(), current.requests)).toThrow()
    const frozen = freezeT1(current, accountReport())
    expect(frozen.plan.frozen).toBe(true); expect(frozen.plan.protectedReserveCredits).toBe(250)
    const { hash, ...contents } = frozen.plan; expect(identity(contents)).toBe(hash)
  })
  it('admits a full reserve but rejects combined parent-credit overrun and invalid reserve lineage', () => {
    const contract = fixtureContract(), primary = plan([fixtureRequest(1, contract)], [contract]), reserve = plan([fixtureRequest(2, contract)], [contract])
    expect(freezeT1(primary, accountReport(), reserve.requests).reserve.worstCaseCredits).toBe(3)
    expect(() => freezeT1(primary, accountReport(), [{ ...reserve.requests[0], lineage: ['UNADMITTED'] }])).toThrow()
    const expensive = fixtureContract('profiler/address/transactions', 5000)
    expect(() => freezeT1(plan([fixtureRequest(1, expensive)], [expensive]), accountReport(100000), plan([fixtureRequest(2, expensive)], [expensive]).requests)).toThrow()
  })
  it('stops count-only growth, saturation, exhausted reserve and 8192 without a P0 gap', () => {
    const report = { new_unique_normalized_records: 10000, duplicate_record_ratio: 0, new_lineage_accepted_subjects: 0, coverage_cells_closed: 0, question_cards_or_recipes_enabled: 0, caseboard_or_trace_thread_consumers_added: 0, route_candidates_added: 0, dead_end_candidates_added: 0, exact_receipt_gaps_closed: 0, state_corroboration_gaps_closed: 0, test_consumers_added: 0, credits_consumed: 10, records_per_credit: 1000, utility_by_question_lens: { ACTIVITY: 0, RELATIONSHIPS: 0, STATE: 0, RECEIPT: 0 }, unresolved_P0_coverage_gaps: 0 }
    expect(utilityDecision(report, 1024, 5000, plan())).toBe('STOP_SATURATED')
    report.coverage_cells_closed = 1
    expect(utilityDecision(report, 8192, 5000, plan())).toBe('STOP_NO_P0_GAP')
    report.unresolved_P0_coverage_gaps = 1
    expect(utilityDecision(report, 8192, 5000, plan())).toBe('CONTINUE_UTILITY_BOUND')
    expect(utilityDecision(report, 12288, 5000, plan())).toBe('STOP')
    expect(utilityDecision(report, 1024, 251, plan())).toBe('STOP')
    report.records_per_credit = NaN
    expect(utilityDecision(report, 1024, 5000, plan())).toBe('STOP')
  })
})

describe('R1 current private ledger and durable dual roots — synthetic only', () => {
  it.each(['partial-json', 'partial-utf8', 'complete-final'])('recovers only valid crash tail: %s, idempotently', (kind) => {
    const file = path.join(temp(), 'journal.jsonl'), start = { event: 'START', sequence: 1, record: { logicalId: 'b'.repeat(64), attemptId: 'ATTEMPT.1' } }
    fs.writeFileSync(file, `${JSON.stringify(start)}\n`)
    const terminal = { event: 'TERMINAL', sequence: 2, record: savedRecord().record }
    fs.appendFileSync(file, kind === 'partial-json' ? '{"event":"TER' : kind === 'partial-utf8' ? Buffer.concat([Buffer.from('{"note":"'), Buffer.from([0xe2, 0x82])]) : JSON.stringify(terminal))
    const journal = new PrivateJournal(file)
    expect(journal.rows).toHaveLength(kind === 'complete-final' ? 2 : 1)
    const recovered = fs.readFileSync(file)
    expect(new PrivateJournal(file).rows).toEqual(journal.rows); expect(fs.readFileSync(file)).toEqual(recovered)
  })
  it.each(['malformed-final', 'malformed-middle', 'overlong-utf8', 'surrogate-utf8', 'too-large-utf8', 'complete-plus-partial', 'invalid-schema-final', 'invalid-schema-middle'])('rejects corruption and preserves bytes: %s', (kind) => {
    const file = path.join(temp(), 'journal.jsonl')
    const prefix = '{"event":"START","sequence":1,"record":{"logicalId":"' + 'b'.repeat(64) + '","attemptId":"ATTEMPT.1"}}\n'
    const tail = kind === 'malformed-final' ? '{oops' : kind === 'malformed-middle' ? '{oops}\n{"a":' : kind === 'overlong-utf8' ? Buffer.concat([Buffer.from('{"a":"'), Buffer.from([0xe0, 0x80])]) : kind === 'surrogate-utf8' ? Buffer.concat([Buffer.from('{"a":"'), Buffer.from([0xed, 0xa0])]) : kind === 'too-large-utf8' ? Buffer.concat([Buffer.from('{"a":"'), Buffer.from([0xf4, 0x90])]) : kind === 'complete-plus-partial' ? Buffer.concat([Buffer.from('{}'), Buffer.from([0xe2])]) : kind === 'invalid-schema-middle' ? '{}\n{"a":' : '{}'
    fs.writeFileSync(file, Buffer.concat([Buffer.from(prefix), Buffer.from(tail)])); const original = fs.readFileSync(file)
    expect(() => new PrivateJournal(file)).toThrow(); expect(fs.readFileSync(file)).toEqual(original)
  })
  it('raw-writes first, verifies byte/hash equality, rejects overwrite/root collision/storage failure/mismatch', () => {
    const dir = temp(), primary = path.join(dir, 'primary'), mirror = path.join(dir, 'mirror'), bytes = Buffer.from('{"data":[]}'), id = 'd'.repeat(64)
    const storage = persistRaw(primary, mirror, id, bytes)
    expect(storage.bytes_equal).toBe(true); expect(fs.readFileSync(storage.primary_path)).toEqual(fs.readFileSync(storage.mirror_path))
    expect(() => persistRaw(primary, mirror, id, bytes)).toThrow()
    expect(() => persistRaw(primary, primary, id, bytes)).toThrow()
    expect(() => persistRaw(primary, mirror, 'e'.repeat(64), bytes, { durable: () => { throw new Error('synthetic failure') }, read: fs.readFileSync })).toThrow()
    expect(() => persistRaw(primary, mirror, 'f'.repeat(64), bytes, { durable: () => {}, read: () => Buffer.from('different') })).toThrow()
  })
  it('durably reserves before issue and rejects duplicate terminal/current-schema mismatch/hash disagreement', () => {
    const file = path.join(temp(), 'journal.jsonl'), id = 'b'.repeat(64), first = new PrivateJournal(file)
    expect(first.reserve(id, 'ATTEMPT.1')).toBe(true)
    const resumed = new PrivateJournal(file); expect(resumed.reserve(id, 'ATTEMPT.1')).toBe(false); expect(resumed.lookup(id)).toBeNull()
    expect(() => resumed.terminal({ ...ledgerRecord(), schema_version: '4.0.0' })).toThrow()
    const mismatch = ledgerRecord(); mismatch.storage.mirror_raw_sha256 = 'a'.repeat(64)
    expect(() => resumed.terminal(mismatch)).toThrow()
    const durable = savedRecord().record
    resumed.terminal(durable); expect(new PrivateJournal(file).lookup(id).qualification_counted).toBe(true)
    expect(() => resumed.terminal(durable)).toThrow()
  })
  it('does not mutate complete middle records during generic recovery', () => {
    const file = path.join(temp(), 'plain.jsonl'); fs.writeFileSync(file, '{"ok":true}\n{"interrupted":')
    expect(recoverJournal(file)).toEqual([{ ok: true }]); expect(fs.readFileSync(file, 'utf8')).toBe('{"ok":true}\n')
  })
})

describe('R1 endpoint field allowlists and public index — synthetic only', () => {
  it('strips incidental labels, unknown fields, account/private headers and validates v5.0.1 index', () => {
    const body = responseBody(), projected = projectResponse(fixtureContract(), body, fixtureCell(), '2023-03-13T12:15:00Z')
    expect(JSON.stringify(projected)).not.toContain('PRIVATE_INCIDENTAL_LABEL'); expect(projected.rows[0].amount).toBe('1234.500000000000000001')
    const { bytes, record } = savedRecord(body); record.provider_headers = { rate_limit_limit: 'private text' }
    const result = compilePublicIndex(record, fixtureContract(), body, fixtureCell(), '2023-03-13T12:15:00Z', bytes)
    expect(validateSchema('public', result.publicRecord)).toBe(true); expect(result.publicRecord.attribution).toBe('Powered by Nansen API')
    expect(JSON.stringify(result)).not.toContain('private text'); expect(result.publicRecord.raw_payload_published).toBe(false)
  })
  it.each(['unadmitted', 'partial', 'post-cutoff', 'raw-object', 'credential', 'missing-fact', 'wrong-grade', 'admin', 'unknown-index'])('refuses unsafe public falsifier %s', (name) => {
    const contract = fixtureContract(), body = responseBody(), cell = fixtureCell(), { record, bytes } = savedRecord(body)
    if (name === 'unadmitted') contract.admitted = false
    if (name === 'partial') cell.status = 'PARTIAL'
    if (name === 'post-cutoff') body.data[0].block_timestamp = '2023-03-14T00:00:00Z'
    if (name === 'raw-object') body.data[0].amount = { raw: 'private' }
    if (name === 'credential') record.business_question = ['api', 'key'].join('_') + '=' + ['synthetic', 'private', 'material'].join('_')
    if (name === 'missing-fact') delete body.data[0].amount
    if (name === 'wrong-grade') record.classification.evidence_grade = 'CORROBORATING'
    if (name === 'admin') record.question_lens = 'ADMIN'
    if (name === 'unknown-index') record.secret = 'private'
    expect(() => compilePublicIndex(record, contract, body, cell, '2023-03-13T12:15:00Z', bytes)).toThrow()
  })
  it('keeps state corroborating and relationship ranking contextual, never exact proof', () => {
    const state = fixtureContract('profiler/address/historical-balances'), relations = fixtureContract('profiler/address/counterparties')
    expect(projectResponse(state, { data: [{ token_address: `0x${'4'.repeat(40)}`, balance: '10', block_timestamp: '2023-03-13T11:38:11Z', label: 'hidden' }] }, fixtureCell(), '2023-03-13T12:15:00Z').rows[0]).not.toHaveProperty('label')
    expect(projectResponse(relations, { data: [{ counterparty_address: `0x${'4'.repeat(40)}`, transaction_count: 7, volume: '10', label: 'hidden' }] }, fixtureCell(), '2023-03-13T12:15:00Z').rows[0]).not.toHaveProperty('label')
  })
})

describe('R1 fixture runtime/compiler dedupe and resume — production held', () => {
  const setup = () => {
    const dir = temp(), contract = fixtureContract(), account = accountReport(), frozen = freezeT1(plan([fixtureRequest(1, contract)], [contract]), account), journal = new PrivateJournal(path.join(dir, 'runtime.jsonl'))
    const context = { mode: 'OFFLINE_FIXTURE', ...frozen, account, journal, persist: (id, bytes) => persistRaw(path.join(dir, 'primary'), path.join(dir, 'mirror'), id, bytes), fixtureTransport: vi.fn(async () => ({ status: 200, body: Buffer.from(JSON.stringify(responseBody())), credits: 1 })), cutoffUtc: '2023-03-13T12:15:00Z' }
    return { context, id: frozen.plan.requests[0].logicalId }
  }
  it('counts only one actual fixture issue; local reuse and restart add no attempt or count', async () => {
    const { context, id } = setup(), runtime = new Nq5Runtime(context), first = await runtime.execute(id, fixtureCell())
    expect(first.countDelta).toBe(1); expect(first.publicArtifact.publicRecord.schema_version).toBe('5.0.1')
    const reused = await runtime.execute(id, fixtureCell()); expect(reused.issued).toBe(false); expect(reused.countDelta).toBe(0)
    context.journal = new PrivateJournal(context.journal.file)
    expect((await new Nq5Runtime(context).execute(id, fixtureCell())).reused).toBe(true)
    expect(context.fixtureTransport).toHaveBeenCalledTimes(1); expect(context.journal.rows).toHaveLength(2)
  }, 20000)
  it('pending start blocks repeat spending after crash/restart', async () => {
    const { context, id } = setup(); context.journal.reserve(id, `FIXTURE.${id}`)
    context.journal = new PrivateJournal(context.journal.file)
    expect((await new Nq5Runtime(context).execute(id, fixtureCell())).pending).toBe(true)
    expect(context.fixtureTransport).not.toHaveBeenCalled()
  })
  it.each(['raw-failure', 'malformed-response', 'coverage-incomplete', 'unknown-cost', 'terminal-failure'])('fails without counted/public output and never retries:%s', async (name) => {
    const { context, id } = setup(), cell = fixtureCell()
    if (name === 'raw-failure') context.persist = () => { throw new Error() }
    if (name === 'malformed-response') context.fixtureTransport = vi.fn(async () => ({ status: 200, body: Buffer.from('{oops'), credits: 1 }))
    if (name === 'coverage-incomplete') cell.status = 'PARTIAL'
    if (name === 'unknown-cost') context.fixtureTransport = vi.fn(async () => ({ status: 200, body: Buffer.from(JSON.stringify(responseBody())), credits: null }))
    if (name === 'terminal-failure') context.journal.terminal = () => { throw new Error() }
    const runtime = new Nq5Runtime(context)
    if (name === 'terminal-failure') await expect(runtime.execute(id, cell)).rejects.toThrow()
    else { const result = await runtime.execute(id, cell); expect(result.countDelta).toBe(0); expect(result.publicArtifact).toBeNull() }
    await runtime.execute(id, cell); expect(context.fixtureTransport).toHaveBeenCalledTimes(1)
  }, 20000)
  it('unconditionally rejects production mode, even with otherwise authorized plans', () => {
    const { context } = setup(); expect(() => new Nq5Runtime({ ...context, mode: 'PRODUCTION' })).toThrow(/held/)
    expect(context.fixtureTransport).not.toHaveBeenCalled()
  })
  it('requires preceding-page durability and stops pagination at a durable terminal page', async () => {
    const { context } = setup(), contract = fixtureContract()
    Object.assign(context, freezeT1(plan([fixtureRequest(1, contract), fixtureRequest(2, contract)], [contract]), context.account))
    const runtime = new Nq5Runtime(context), secondId = context.plan.requests[1].logicalId
    await expect(runtime.execute(secondId, { ...fixtureCell(), id: 'CELL.2' })).rejects.toThrow(/preceding/)
    expect(context.fixtureTransport).not.toHaveBeenCalled()
    await runtime.execute(context.plan.requests[0].logicalId, fixtureCell())
    expect((await runtime.execute(secondId, { ...fixtureCell(), id: 'CELL.2' })).stoppedAtTerminalPage).toBe(true)
    expect(context.fixtureTransport).toHaveBeenCalledTimes(1)
  }, 20000)
  it('verifies raw bytes again on restart and rejects newly corrupted mirror without any new issue', async () => {
    const { context, id } = setup(), result = await new Nq5Runtime(context).execute(id, fixtureCell())
    fs.writeFileSync(result.terminal.storage.mirror_path, 'synthetic corruption')
    expect(() => new PrivateJournal(context.journal.file)).toThrow(/verification/)
    await expect(new Nq5Runtime(context).execute(id, fixtureCell())).rejects.toThrow(/verification/)
    expect(context.fixtureTransport).toHaveBeenCalledTimes(1)
  }, 20000)
})

describe('R1 one-attempt account adapter fixture gate — no real credential/network', () => {
  const setup = () => {
    const dir = temp(), journal = new PrivateJournal(path.join(dir, 'journal.jsonl'))
    return { offline: offlineReport(), candidate, journal, resolveCredential: vi.fn(() => 'synthetic_fixture_credential_not_real'), transport: vi.fn(async () => ({ status: 200, body: Buffer.from('{"available_credits":5000,"plan":"free","email":"private@example.invalid"}'), capturedHeaders: { 'x-nansen-credits-cost': '0', 'x-nansen-credits-remaining': '5000', authorization: 'PRIVATE_HEADER' } })), persist: (id, bytes) => persistRaw(path.join(dir, 'primary'), path.join(dir, 'mirror'), id, bytes) }
  }
  it.each(['valid', 'deleted-mirror', 'corrupt-mirror', 'cache-balance', 'missing-terminal'])('binds cached account recovery to observed durable evidence: %s', async (name) => {
    const context = setup(), report = await runAccountAdapter(context), record = context.journal.lookup((await import('../../scripts/nq5/account.mjs')).ACCOUNT_ID)
    if (name === 'deleted-mirror') fs.unlinkSync(record.storage.mirror_path)
    if (name === 'corrupt-mirror') fs.writeFileSync(record.storage.mirror_path, 'synthetic corruption')
    if (name === 'cache-balance') report.account.available_credits = 5001
    if (name === 'missing-terminal') context.journal.rows.pop()
    if (name === 'valid') expect(validateCachedAccount(report, context.journal)).toBe(report)
    else expect(() => validateCachedAccount(report, context.journal)).toThrow()
    expect(context.transport).toHaveBeenCalledTimes(1)
    const uncertain = uncertainPriorAccountReport(); expect(uncertain.request.attempts_issued).toBe(1); expect(uncertain.ACCOUNT_PREFLIGHT_PASS).toBe(false)
  })
  it.each(['direct', 'data-envelope', 'nested-credits', 'body-cost'])('accepts documented-safe body/header variant %s with exactly one issue/private terminal', async (name) => {
    const context = setup()
    const bodies = { direct: { available_credits: 5000 }, 'data-envelope': { data: { credits_remaining: '5000', plan: 'PRO' } }, 'nested-credits': { credits: { available: 5000, included: 1000, promotional: 2000, purchased: 2000 } }, 'body-cost': { available_credits: 5000, credits_cost: 0 } }
    context.transport = vi.fn(async () => ({ status: 200, body: Buffer.from(JSON.stringify(bodies[name])), capturedHeaders: name === 'body-cost' ? {} : { 'x-nansen-credits-cost': '0', 'x-nansen-credits-used': '0', 'x-nansen-credits-remaining': '5000' } }))
    const report = await runAccountAdapter(context)
    expect(report.status).toBe('PASS'); expect(report.account.available_credits).toBe(5000); expect(context.transport).toHaveBeenCalledTimes(1)
    expect(context.journal.rows).toHaveLength(2); expect(context.journal.rows[1].record.schema_version).toBe('5.0.1'); expect(context.journal.rows[1].record.question_lens).toBe('ADMIN')
    expect(report.request.qualification_counted).toBe(false); expect(report.request.public_indexed).toBe(false); expect(report.response.request_id).toBeNull()
    const again = await runAccountAdapter(context); expect(again.ACCOUNT_PREFLIGHT_PASS).toBe(false); expect(context.transport).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(report)).not.toContain('private@example.invalid'); expect(() => assertQualificationCheckpointHold(report)).toThrow()
  })
  it.each(['offline-fail', 'wrong-method', 'wrong-endpoint', 'body', 'query', 'retry', 'redirect', 'fallback', 'missing', 'resolution', 'start-ledger', 'DNS', 'TLS', 'TIMEOUT', 'TRANSPORT', '3xx', 'non200', 'parse', 'balance', 'positive-credit', 'unknown-credit', 'disagreement', 'primary', 'mirror', 'hash', 'terminal-ledger', 'privacy', 'secret-scan'])('fails closed for %s; no retry/fallback/public/count', async (name) => {
    const context = setup(), request = { ...ACCOUNT_REQUEST }
    const original = context.transport
    if (name === 'offline-fail') context.offline.AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT = false
    if (name === 'wrong-method') request.method = 'POST'
    if (name === 'wrong-endpoint') request.url += '/fallback'
    if (name === 'body') request.body = {}
    if (name === 'query') request.query = 'x=1'
    if (name === 'retry') request.retry = 1
    if (name === 'redirect') request.redirect = 'follow'
    if (name === 'fallback') request.fallback = true
    if (name === 'missing') context.resolveCredential = vi.fn(() => null)
    if (name === 'resolution') context.resolveCredential = vi.fn(() => { throw new Error('synthetic secret must never echo') })
    if (name === 'start-ledger') context.journal.reserve = () => { throw new Error('synthetic start failure') }
    if (['DNS', 'TLS', 'TIMEOUT', 'TRANSPORT'].includes(name)) context.transport = vi.fn(async () => { throw Object.assign(new Error('private exception text'), { code: name }) })
    if (['3xx', 'non200', 'parse', 'balance', 'positive-credit', 'unknown-credit', 'disagreement'].includes(name)) context.transport = vi.fn(async () => {
      const response = await original()
      if (name === '3xx') response.status = 302
      if (name === 'non200') response.status = 500
      if (name === 'parse') response.body = Buffer.from('{oops')
      if (name === 'balance') response.body = Buffer.from('{}')
      if (name === 'positive-credit') response.capturedHeaders['x-nansen-credits-cost'] = '1'
      if (name === 'unknown-credit') delete response.capturedHeaders['x-nansen-credits-cost']
      if (name === 'disagreement') response.capturedHeaders['x-nansen-credits-remaining'] = '4999'
      return response
    })
    if (['primary', 'mirror'].includes(name)) context.persist = () => { throw new Error('private storage path failure') }
    if (name === 'hash') context.persist = () => ({ bytes_equal: true, primary_raw_sha256: 'a'.repeat(64), mirror_raw_sha256: 'b'.repeat(64) })
    if (name === 'terminal-ledger') context.journal.terminal = () => { throw new Error('private ledger failure') }
    if (name === 'privacy') context.project = (report) => ({ ...report, credential: 'synthetic_secret' })
    if (name === 'secret-scan') context.scan = () => false
    const report = await runAccountAdapter({ ...context, request })
    expect(report.status).toBe('BLOCKED_WITH_EVIDENCE'); expect(report.ACCOUNT_PREFLIGHT_PASS).toBe(false)
    expect(report.request.retries).toBe(0); expect(report.request.redirects).toBe(0); expect(report.request.public_indexed).toBe(false); expect(report.request.qualification_counted).toBe(false)
    expect(context.transport.mock.calls.length).toBeLessThanOrEqual(1); expect(JSON.stringify(report)).not.toMatch(/private exception|synthetic_secret|private storage path/)
    if (['offline-fail', 'wrong-method', 'wrong-endpoint', 'body', 'query', 'retry', 'redirect', 'fallback'].includes(name)) expect(context.resolveCredential).not.toHaveBeenCalled()
  }, 20000)
  it('never echoes a private invalid-schema sentinel on stdout or stderr', () => {
    const sentinel = 'SENTINEL_PRIVATE_SCHEMA_VALUE', run = spawnSync('python3', ['scripts/nq5-schema-validation.py'], { input: JSON.stringify({ kind: 'provider', object: {}, schema: { type: sentinel } }), encoding: 'utf8' })
    expect(run.status).toBe(1); expect(run.stdout + run.stderr).not.toContain(sentinel)
  })
})
