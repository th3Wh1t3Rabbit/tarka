import { admitContract, AUTH, FAMILY_PURPOSES } from './planner.mjs'
import { identity, sha, validateSchema } from './schema.mjs'
import { decimalLexeme, parseExactJson } from './exact-json.mjs'
import { readDurableRaw } from './journal.mjs'

const FIELDS = {
  'profiler/address/transactions': ['transaction_hash', 'block_timestamp', 'from_address', 'to_address', 'token_address', 'amount'],
  'profiler/address/historical-transactions': ['transaction_hash', 'block_timestamp', 'from_address', 'to_address', 'token_address', 'amount'],
  'profiler/address/counterparties': ['counterparty_address', 'transaction_count', 'volume'],
  'profiler/address/historical-balances': ['token_address', 'balance', 'block_timestamp'],
  'transaction-with-token-transfer-lookup': ['transaction_hash', 'block_timestamp', 'from_address', 'to_address', 'token_address', 'amount'],
}
const safeText = (value) => typeof value === 'string' && !/[\r\n\0]|@|Bearer\s|(?:api.?key|secret|credential)\s*[:=]|(?:\/home\/|\/tmp\/|[A-Za-z]:\\)/i.test(value)
function officialRows(family, bytes) {
  const data = parseExactJson(bytes).data
  if (!Array.isArray(data)) throw new Error('Unknown official response structure.')
  if (data.some((row) => row.chain !== 'ethereum') || (family.includes('lookup') && data.some((row) => row.receipt_status !== '1'))) throw new Error('Only admitted Ethereum successful event facts may be public.')
  if (family.includes('balances')) return data.map((row) => ({ token_address: row.token_address, balance: decimalLexeme(row.token_amount), block_timestamp: row.block_timestamp }))
  if (family.includes('counterparties')) return data.map((row) => ({ counterparty_address: row.counterparty_address, transaction_count: Number(row.interaction_count), volume: decimalLexeme(row.total_volume_usd) }))
  return data.flatMap((row) => {
    const transfers = family.includes('lookup') ? row.token_transfer_array : [...(row.tokens_sent ?? []), ...(row.tokens_received ?? [])]
    if (!Array.isArray(transfers)) throw new Error('Unknown official transfer structure.')
    if (!transfers.length) throw new Error('No allowlisted transfer facts; native/NFT/contract facts remain private until separately admitted.')
    return transfers.map((transfer) => {
      const token = Array.isArray(transfer) ? { token_amount: transfer[1], token_address: transfer[4], from_address: transfer[6], to_address: transfer[7] } : transfer
      const amount = decimalLexeme(token.token_amount).replace(/^-/, '')
      return { transaction_hash: row.transaction_hash, block_timestamp: row.block_timestamp, from_address: token.from_address, to_address: token.to_address, token_address: token.token_address, amount }
    })
  })
}
export function projectResponse(contractInput, response, cell, cutoffUtc, rawBytes) {
  const contract = admitContract(contractInput)
  if (!cell || !['COMPLETE', 'EMPTY_COMPLETE'].includes(cell.status) || !cell.id || !Number.isFinite(Date.parse(cutoffUtc)) || !Number.isFinite(Date.parse(cell.fromUtc)) || !Number.isFinite(Date.parse(cell.toUtc)) || Date.parse(cell.fromUtc) > Date.parse(cell.toUtc) || Date.parse(cell.toUtc) > Date.parse(cutoffUtc)) throw new Error('Incomplete or post-cutoff coverage cannot create a public artifact.')
  validateSchema('provider', response, contract.responseSchema)
  if (!Array.isArray(response.data)) throw new Error('Response shape is not projected.')
  const inputRows = contract.snapshotDocuments.endpoint.mode === 'NANSEN_OFFICIAL_OPENAPI' ? officialRows(contract.family, rawBytes) : response.data
  const rows = inputRows.map((row) => {
    const projected = Object.fromEntries(FIELDS[contract.family].filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]))
    if (Object.values(projected).some((value) => typeof value === 'object' || (typeof value === 'string' ? !safeText(value) : typeof value !== 'number' || !Number.isFinite(value) || value < 0))) throw new Error('Unsafe normalized field.')
    for (const [key, value] of Object.entries(projected)) {
      if ((key.endsWith('_address') || key === 'counterparty_address') && !/^0x[a-f\d]{40}$/i.test(value)) throw new Error('Invalid public address.')
      if (key === 'transaction_hash' && !/^0x[a-f\d]{64}$/i.test(value)) throw new Error('Invalid public receipt identity.')
      if (key === 'block_timestamp' && (!Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.parse(cutoffUtc) || Date.parse(value) < Date.parse(cell.fromUtc) || Date.parse(value) > Date.parse(cell.toUtc))) throw new Error('Post-cutoff or out-of-window public record.')
      if (['amount', 'balance', 'volume'].includes(key) && (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))) throw new Error('Exact decimal string required.')
      if (key === 'transaction_count' && (!Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid counterparty count.')
    }
    if (Object.keys(projected).length !== FIELDS[contract.family].length) throw new Error('Missing allowlisted fact; cannot downgrade silently.')
    return projected
  })
  return { rows, normalizedSha256: identity(rows), attribution: 'Powered by Nansen API', claimBoundary: 'An exact event is not proof of common human identity, intent, coordination, or all later value.' }
}

export function compilePublicIndex(record, contractInput, response, cell, cutoffUtc, rawBytes) {
  validateSchema('ledger', record)
  const contract = admitContract(contractInput)
  if (!Buffer.isBuffer(rawBytes) || !readDurableRaw(record.storage).equals(rawBytes) || sha(rawBytes) !== record.storage.primary_raw_sha256 || identity(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBytes))) !== identity(response)) throw new Error('Response does not match durable private bytes.')
  if (record.authorization_id !== AUTH || !record.qualification_counted || record.terminal_status !== 'SUCCESS_COUNTED' || record.endpoint_family !== contract.family || record.endpoint_path !== contract.path || !FAMILY_PURPOSES[contract.family].includes(record.purpose_code) || record.storage.bytes_equal !== true || record.storage.primary_raw_sha256 !== record.storage.mirror_raw_sha256 || record.budget.actual_credits === null || record.investigative_question_id === null || record.question_lens === 'ADMIN' || !record.consumer_ids.every(safeText) || !record.selection_lineage.every(safeText) || !safeText(record.business_question) || !record.coverage_cell_ids.includes(cell.id) || record.coverage_key.question_lens !== record.question_lens) throw new Error('Public-call admission failed.')
  const projection = projectResponse(contractInput, response, cell, cutoffUtc, rawBytes)
  const expectedGrade = contract.family.includes('balances') ? 'CORROBORATING' : contract.family.includes('counterparties') ? 'CONTEXTUAL' : 'EXACT'
  if (record.classification.evidence_grade !== expectedGrade || record.classification.temporal_class !== 'WITHIN_CUTOFF' || record.classification.public_export_disposition !== 'ALLOWLIST_ONLY' || record.classification.result_count !== projection.rows.length || !['BOUNDED_ACTIVITY', 'CANDIDATE_RELATIONSHIP', 'STATE_CORROBORATION', 'EXACT_EVENT', 'BOUNDED_NEGATIVE'].includes(record.classification.route_disposition) || (!projection.rows.length && (!cell.supportsNegative || !record.classification.coverage_supports_negative_evidence))) throw new Error('Grade, coverage or claim classification mismatch.')
  const publicRecord = {
    schema_version: '5.0.1', campaign_id: 'NQ5', authorization_id: AUTH, public_call_id: `NQ5-${String(record.qualification_sequence).padStart(6, '0')}`, qualification_sequence: record.qualification_sequence, tranche_id: record.tranche_id, endpoint_family: contract.family, business_question: record.business_question, purpose_code: record.purpose_code, consumer_ids: record.consumer_ids, request_body_sha256: record.request_body_sha256, response_sha256: record.storage.primary_raw_sha256, normalized_sha256: projection.normalizedSha256, result_count: projection.rows.length, route_disposition: record.classification.route_disposition, evidence_grade: expectedGrade, temporal_class: 'WITHIN_CUTOFF', coverage_scope: `${cell.fromUtc} through ${cell.toUtc}; ${record.coverage_key.page_or_partition_id} complete only, not all requested-window pages or chain history`, selection_lineage_summary: record.selection_lineage, coverage_cell_ids: record.coverage_cell_ids, coverage_key: record.coverage_key, raw_payload_published: false, attribution: projection.attribution, investigative_question_id: record.investigative_question_id, question_lens: record.question_lens,
  }
  validateSchema('public', publicRecord)
  return { publicRecord, normalizedRecords: projection.rows, claimBoundary: projection.claimBoundary }
}
