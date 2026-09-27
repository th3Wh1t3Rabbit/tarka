import fs from 'node:fs'
import { identity, sha, freeze, validateSchemaBatch } from '../nq5/schema.mjs'
import { readDurableRaw } from '../nq5/journal.mjs'
import { AUTH } from '../nq5/planner.mjs'
const verified = new WeakSet()
const schema = JSON.parse(fs.readFileSync(new URL('../../docs/source/v1.7.0/18_NQ5_PRIVATE_CALL_LEDGER.schema.json', import.meta.url)))
// Strict read-only admission: never recover/truncate/append a private journal.
export function readCampaignEvidence(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error('Only regular local durable journals may be read.')
  const bytes = fs.readFileSync(file)
  if (bytes.length && bytes.at(-1) !== 10) throw new Error('Partial durable campaign journal.')
  const rows = bytes.length ? new TextDecoder('utf-8', { fatal: true }).decode(bytes).trimEnd().split('\n').map(line => JSON.parse(line)) : [], starts = new Map(), terminals = new Map()
  let actualCredits = 0, projectedCredits = 0, counted = 0
  validateSchemaBatch('provider', rows.filter(row => row.event === 'TERMINAL').map(row => row.record), schema)
  for (const [index, row] of rows.entries()) {
    const keys = Object.keys(row).sort().join()
    if (row.sequence !== index + 1 || !['event,record,sequence', 'continuation,event,record,sequence'].includes(keys)) throw new Error('Durable envelope sequence invalid.')
    if (row.event === 'START') {
      const record = row.record
      if (keys !== 'event,record,sequence' || Object.keys(record).sort().join() !== 'attemptId,logicalId' || !/^[a-f0-9]{64}$/.test(record.logicalId) || !record.attemptId || starts.has(record.logicalId)) throw new Error('Duplicate/invalid durable reservation.')
      starts.set(record.logicalId, record.attemptId)
    } else if (row.event === 'TERMINAL') {
      const record = row.record
      if (record.authorization_id !== AUTH || record.question_lens === 'ADMIN' || record.tranche_id !== 'T1' || record.ledger_sequence !== row.sequence || starts.get(record.logical_request_id) !== record.attempt_id || terminals.has(record.logical_request_id) || (record.terminal_status === 'SUCCESS_COUNTED') !== record.qualification_counted || record.budget.actual_credits === null || !Number.isFinite(record.budget.actual_credits) || record.budget.actual_credits < 0) throw new Error('Missing terminal, uncertain spend, duplicate or unadmitted tranche.')
      actualCredits += record.budget.actual_credits; projectedCredits += record.budget.projected_credits
      if (record.budget.cumulative_actual_credit_delta !== actualCredits) throw new Error('Cumulative spending disagreement.')
      if (record.qualification_counted) {
        if (record.qualification_sequence !== counted + 1 || record.http_status < 200 || record.http_status > 299 || record.storage.bytes_equal !== true) throw new Error('Counted sequence or durable storage mismatch.')
        readDurableRaw(record.storage); counted++
      }
      terminals.set(record.logical_request_id, { terminalIdentity: identity(record), envelopeIdentity: identity(row), record: structuredClone(record) })
    } else throw new Error('Unknown journal event.')
  }
  if (starts.size !== terminals.size || !fs.readFileSync(file).equals(bytes)) throw new Error('Pending/changed durable campaign journal; spending unknown.')
  const result = freeze({ journalSha256: sha(bytes), logicalIds: [...starts.keys()], terminals: [...terminals.entries()].map(([logicalId, value]) => ({ logicalId, ...value })), counted, actualCredits, projectedCredits, maximumPriorAttempts: starts.size * 3, attemptAccounting: 'CONSERVATIVE_MAX_THREE_PER_LOGICAL_INCLUDES_RETRY_ALLOWANCE', journalFile: file })
  verified.add(result); return result
}
export function assertCampaignEvidence(value) {
  if (!verified.has(value) || sha(fs.readFileSync(value.journalFile)) !== value.journalSha256) throw new Error('Current reconciled durable campaign evidence required; serialized accounting is not proof.')
  // Recheck raw storage before using an earlier local proof.
  for (const terminal of value.terminals) if (terminal.record.qualification_counted) readDurableRaw(terminal.record.storage)
  return value
}
