import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const receiptPath = resolve(root, 'review/s15-r8/RECEIPTS/ACTUAL_FRAME_SERIES.ndjson')
const rows = readFileSync(receiptPath, 'utf8').trim().split('\n').map(line => JSON.parse(line))
const byId = new Map(rows.map(row => [row.id, row]))
const required = ['document-arthur-fully-revealed', 'document-same-speaker-transition', 'document-rook-reply-static', 'point-arthur-fully-revealed', 'point-rook-reply-static', 'ordinary-rook-talk']
for (const id of required) if (!byId.has(id)) throw new Error(`missing actual frame series: ${id}`)

for (const id of ['document-arthur-fully-revealed', 'point-arthur-fully-revealed']) {
  const samples = byId.get(id).samples
  const changes = samples.map(sample => sample.frameIndex).filter((value, index, all) => index === 0 || value !== all[index - 1])
  if (changes.length < 5) throw new Error(`${id}: fewer than two alternating cycles`)
  if (new Set(samples.map(sample => sample.requestedSource)).size !== 2) throw new Error(`${id}: did not request both mouth frames`)
  if (samples.some(sample => sample.requestedSource !== sample.imageRequestedSource || sample.imageRequestedSource !== sample.renderedSource)) throw new Error(`${id}: requested/rendered source mismatch`)
}
for (const id of ['document-rook-reply-static', 'point-rook-reply-static']) {
  const samples = byId.get(id).samples
  if (samples.some(sample => sample.frameIndex !== 0 || sample.frameCount !== 1)) throw new Error(`${id}: listening pose moved or retained a talk index`)
  if (samples.some(sample => sample.requestedSource !== sample.renderedSource)) throw new Error(`${id}: static source mismatch`)
}
const mutation = JSON.parse(readFileSync(resolve(root, 'review/s15-r8/MUTATIONS/MUTATION_RESULTS.json'), 'utf8'))
if (mutation.total < 10 || mutation.caught !== mutation.total || !mutation.allCaught) throw new Error('mutation result is incomplete')
for (const screenshot of ['document-rook-reply-static.png', 'point-rook-reply-static.png']) if (!existsSync(resolve(root, 'review/s15-r8/SCREENSHOTS', screenshot))) throw new Error(`missing screenshot: ${screenshot}`)
if (!existsSync(resolve(root, 'review/s15-r8/RECEIPTS/FINAL_DISMISSAL.json'))) throw new Error('missing final dismissal receipt')
console.log(`PASS_S15_R8_EVIDENCE frameSeries=${rows.length} mutations=${mutation.caught}/${mutation.total} screenshots=2`)
