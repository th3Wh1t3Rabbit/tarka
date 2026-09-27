import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const validator = fileURLToPath(new URL('../nq5-schema-validation.py', import.meta.url))
export function validateSchema(kind, object, schema) {
  const run = spawnSync('python3', [validator], { input: JSON.stringify({ kind, object, schema }), encoding: 'utf8', maxBuffer: 1_000_000 })
  if (run.error || !run.stdout) throw new Error('Local schema validation unavailable.')
  const report = JSON.parse(run.stdout)
  if (run.status !== 0 || report.valid !== true) throw new Error('Local schema validation rejected data.')
  return true
}
export function validateSchemaBatch(kind, objects, schema) {
  const run = spawnSync('python3', [validator], { input: JSON.stringify({ kind, objects, schema }), encoding: 'utf8', maxBuffer: 1_000_000 })
  if (run.error || !run.stdout || run.status !== 0 || JSON.parse(run.stdout).valid !== true) throw new Error('Local batch schema admission failed.')
  return true
}
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  throw new Error('Noncanonical input rejected.')
}
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const identity = (object) => sha(canonical(object))
export function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
