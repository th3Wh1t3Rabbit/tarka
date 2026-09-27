import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'
import { canonical, sha, validateSchema } from './schema.mjs'

// A valid JSON prefix is recoverable; malformed JSON is never treated as a crash.
function incompleteJson(text) {
  let i = 0
  const eof = () => { throw new Error('INCOMPLETE') }
  const bad = () => { throw new Error('MALFORMED') }
  const ws = () => { while (/[\t\n\r ]/.test(text[i] ?? '') && i < text.length) i++ }
  const string = () => {
    i++
    while (i < text.length) {
      const c = text[i++]
      if (c === '"') return
      if (c.charCodeAt(0) < 32) bad()
      if (c === '\\') {
        if (i === text.length) eof()
        const escape = text[i++]
        if (escape === 'u') for (let n = 0; n < 4; n++) { if (i === text.length) eof(); if (!/[\da-f]/i.test(text[i++])) bad() }
        else if (!'"\\/bfnrt'.includes(escape)) bad()
      }
    }
    eof()
  }
  const value = () => {
    ws(); if (i === text.length) eof()
    if (text[i] === '"') return string()
    if (text[i] === '{' || text[i] === '[') {
      const object = text[i++] === '{', close = object ? '}' : ']'
      ws(); if (text[i] === close) { i++; return }
      for (;;) {
        ws(); if (i === text.length) eof()
        if (object) { if (text[i] !== '"') bad(); string(); ws(); if (i === text.length) eof(); if (text[i++] !== ':') bad() }
        value(); ws(); if (i === text.length) eof()
        if (text[i] === close) { i++; return }
        if (text[i++] !== ',') bad()
      }
    }
    const rest = text.slice(i)
    for (const literal of ['true', 'false', 'null']) {
      if (rest.startsWith(literal)) { i += literal.length; return }
      if (literal.startsWith(rest)) eof()
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest)
    if (number) { i += number[0].length; if (i < text.length && /^\.[\d]*$|^[eE][+-]?$/.test(text.slice(i))) eof(); return }
    if (rest === '-') eof()
    bad()
  }
  try { value(); ws(); if (i !== text.length) bad(); return false } catch (error) { if (error.message === 'INCOMPLETE') return true; throw new Error('Malformed journal tail.') }
}

export const durable = (file, bytes, flags) => {
  const fd = fs.openSync(file, flags, 0o600)
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir) } finally { fs.closeSync(dir) }
}

export function publishPrivateCache(file, bytes) {
  const temporary = fs.mkdtempSync(path.join(path.dirname(file), '.checkpoint-publication-'))
  try {
    const staged = path.join(temporary, 'complete.json')
    durable(staged, bytes, 'wx')
    fs.linkSync(staged, file) // Atomic, exclusive publication: never overwrite an existing attempt.
    const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir) } finally { fs.closeSync(dir) }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}

export function recoverJournal(file, validate = () => {}) {
  if (!fs.existsSync(file)) return []
  const bytes = fs.readFileSync(file)
  const lastNewline = bytes.lastIndexOf(10)
  const complete = bytes.subarray(0, lastNewline + 1)
  const tail = bytes.subarray(lastNewline + 1)
  const decode = (value) => new TextDecoder('utf-8', { fatal: true }).decode(value)
  const rows = decode(complete).split('\n').filter(Boolean).map((line) => JSON.parse(line))
  validate(rows)
  if (tail.length) {
    let text, partialUtf8 = false
    try { text = decode(tail) } catch {
      for (let trim = 1; trim <= 3 && trim <= tail.length; trim++) {
        try {
          const prefix = tail.subarray(0, tail.length - trim)
          const suffix = tail.subarray(tail.length - trim)
          const first = suffix[0]
          const expected = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0
          if (expected <= suffix.length || ![...suffix.subarray(1)].every((b) => b >= 0x80 && b <= 0xbf)) continue
          if (suffix.length > 1 && ((first === 0xe0 && suffix[1] < 0xa0) || (first === 0xed && suffix[1] > 0x9f) || (first === 0xf0 && suffix[1] < 0x90) || (first === 0xf4 && suffix[1] > 0x8f))) continue
          text = decode(prefix); partialUtf8 = true; break
        } catch { /* Only a terminal incomplete code point may be removed. */ }
      }
      if (text === undefined) throw new Error('Malformed journal UTF-8.')
    }
    if (incompleteJson(text)) {
      const fd = fs.openSync(file, 'r+'); try { fs.ftruncateSync(fd, complete.length); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    } else {
      if (partialUtf8) throw new Error('Complete record followed by partial bytes.')
      rows.push(JSON.parse(text)); validate(rows); durable(file, '\n', 'a')
    }
  }
  return rows
}

export class PrivateJournal {
  constructor(file) { this.file = file; fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); this.rows = recoverJournal(file, (rows) => { this.rows = rows; this.validate() }); this.validate() }
  validate() {
    const starts = new Map(), terminals = new Set(), counted = new Set()
    this.rows.forEach((row, index) => {
      if (row.sequence !== index + 1 || !['START', 'TERMINAL'].includes(row.event) || !['event,record,sequence', 'continuation,event,record,sequence'].includes(Object.keys(row).sort().join()) || (row.event === 'START' && Object.hasOwn(row, 'continuation'))) throw new Error('Invalid journal envelope.')
      if (row.continuation && (Object.keys(row.continuation).sort().join() !== 'coverageClosed,isLastPage,page' || !Number.isInteger(row.continuation.page) || row.continuation.page < 1 || typeof row.continuation.isLastPage !== 'boolean' || typeof row.continuation.coverageClosed !== 'boolean')) throw new Error('Invalid private continuation metadata.')
      const record = row.record
      if (row.event === 'START') {
        if (Object.keys(record).sort().join() !== 'attemptId,logicalId' || !/^[a-f0-9]{64}$/.test(record.logicalId) || typeof record.attemptId !== 'string' || !record.attemptId || starts.has(record.logicalId)) throw new Error('Duplicate or invalid reservation.')
        starts.set(record.logicalId, record.attemptId)
      } else {
        validateSchema('ledger', record)
        if ((record.terminal_status === 'SUCCESS_COUNTED') !== record.qualification_counted) throw new Error('Counted status and qualification flag disagree.')
        if (record.ledger_sequence !== row.sequence || starts.get(record.logical_request_id) !== record.attempt_id || terminals.has(record.logical_request_id)) throw new Error('Terminal has no unique reservation.')
        if (record.storage.bytes_equal === true && record.storage.primary_raw_sha256 !== record.storage.mirror_raw_sha256) throw new Error('Ledger storage hash disagreement.')
        if (record.qualification_counted) {
          if (counted.has(record.logical_request_id) || record.qualification_sequence !== counted.size + 1 || record.budget.actual_credits === null) throw new Error('Invalid counted success sequence or cost.')
          if (!record.novelty_expectation || !record.bounded_stop_rule || record.coverage_key.question_lens !== record.question_lens || !['EXACT', 'CORROBORATING', 'CONTEXTUAL'].includes(record.classification.evidence_grade)) throw new Error('Counted success lacks current utility/coverage/grade admission.')
          readDurableRaw(record.storage)
          counted.add(record.logical_request_id)
        }
        terminals.add(record.logical_request_id)
      }
    })
  }
  append(event, record, continuation) {
    const lock = `${this.file}.lock`
    let fd
    try { fd = fs.openSync(lock, 'wx', 0o600) } catch { throw new Error('Journal locked; no issue allowed.') }
    try {
      this.rows = recoverJournal(this.file, (rows) => { this.rows = rows; this.validate() }); this.validate()
      const row = { event, sequence: this.rows.length + 1, record, ...(continuation ? { continuation } : {}) }
      this.rows.push(row)
      try { this.validate() } catch (error) { this.rows.pop(); throw error }
      durable(this.file, `${canonical(row)}\n`, 'a')
      return row
    } finally { fs.closeSync(fd); fs.unlinkSync(lock) }
  }
  reserve(logicalId, attemptId) {
    if (this.rows.some((row) => row.event === 'START' && row.record.logicalId === logicalId)) return false
    this.append('START', { logicalId, attemptId }); return true
  }
  terminal(record, continuation) { return this.append('TERMINAL', { ...record, ledger_sequence: this.rows.length + 1 }, continuation) }
  lookup(logicalId) { return this.rows.find((row) => row.event === 'TERMINAL' && row.record.logical_request_id === logicalId)?.record ?? null }
}

export function persistRaw(primaryRoot, mirrorRoot, logicalId, bytes, io = { durable, read: fs.readFileSync }) {
  if (!/^[a-f0-9]{64}$/.test(logicalId) || !Buffer.isBuffer(bytes) || path.resolve(primaryRoot) === path.resolve(mirrorRoot)) throw new Error('Private dual-root admission failed.')
  const files = [primaryRoot, mirrorRoot].map((root) => { fs.mkdirSync(root, { recursive: true, mode: 0o700 }); return path.join(root, `${logicalId}.raw`) })
  for (const file of files) io.durable(file, bytes, 'wx')
  const primary = io.read(files[0]), mirror = io.read(files[1])
  if (!primary.equals(bytes) || !mirror.equals(bytes) || sha(primary) !== sha(mirror)) throw new Error('Private raw byte/hash mismatch.')
  return { primary_raw_sha256: sha(primary), mirror_raw_sha256: sha(mirror), primary_path: files[0], mirror_path: files[1], bytes_equal: true, response_bytes: bytes.length }
}

export function readDurableRaw(storage) {
  try {
    if (storage.bytes_equal !== true || typeof storage.primary_path !== 'string' || typeof storage.mirror_path !== 'string' || path.resolve(storage.primary_path) === path.resolve(storage.mirror_path) || storage.primary_raw_sha256 !== storage.mirror_raw_sha256) throw new Error()
    for (const file of [storage.primary_path, storage.mirror_path]) if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error()
    const primary = fs.readFileSync(storage.primary_path), mirror = fs.readFileSync(storage.mirror_path)
    if (!primary.equals(mirror) || sha(primary) !== storage.primary_raw_sha256) throw new Error()
    return primary
  } catch { throw new Error('Durable private raw verification failed; no issue or public projection allowed.') }
}
