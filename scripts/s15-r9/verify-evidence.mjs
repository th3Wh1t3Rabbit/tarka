import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('review/s15-r9')
const inventory = JSON.parse(readFileSync(resolve('public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json'), 'utf8'))
const mutation = JSON.parse(readFileSync(resolve(root, 'MUTATIONS/MUTATION_RESULTS.json'), 'utf8'))
const globe = JSON.parse(readFileSync(resolve(root, 'RECEIPTS/GLOBE_L1_SLOWDOWN_FRAME_SERIES.json'), 'utf8'))
const opening = JSON.parse(readFileSync(resolve(root, 'RECEIPTS/OPENING_PAPER_FRAME_SERIES.json'), 'utf8'))
const observations = readFileSync(resolve(root, 'RECEIPTS/BROWSER_OBSERVATIONS.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
const screenshots = readdirSync(resolve(root, 'SCREENSHOTS')).filter(name => name.endsWith('.png')).sort()
const required = [
  'approved-arthur-all-53-contact-sheet.png', 'approved-rook-all-90-contact-sheet.png',
  'cabinet-close-neutral-reach.png', 'cabinet-point-facing-hold.png', 'form-neutral-reach.png',
  'globe-l1-controls-active.png', 'globe-l2-promoted.png', 'globe-l3-no-reset.png',
  'globe-natural-final-hold.png', 'globe-neutral-reach-contact.png', 'globe-reverse-same-handler.png',
  'opening-paper-arthur-speech.png', 'opening-paper-closed.png', 'talk-to-mutual-facing.png',
  'terminal-authorized-open.png', 'terminal-point-facing.png', 'terminal-power-off-before-return.png',
  'terminal-power-return-contact.png',
].sort()

const errors = []
if (JSON.stringify(screenshots) !== JSON.stringify(required)) errors.push('screenshot-set')
if (inventory.counts?.rook !== 90 || inventory.counts?.arthur !== 53 || inventory.frames?.length !== 143) errors.push('inventory-counts')
if (mutation.killed !== 18 || mutation.survived !== 0 || mutation.results?.length !== 18) errors.push('mutations')
if (globe.expectedTotalMs !== 9760 || globe.samples?.length < 20 || globe.samples.at(-1)?.motion !== 'FINAL_HOLD') errors.push('globe-series')
if (!new Set(globe.samples?.map(sample => sample.decay)).has('TRICKLE')) errors.push('globe-trickle')
if (opening.samples?.[0]?.frames !== '1' || opening.samples?.[1]?.frames !== '2') errors.push('opening-paper-series')
for (const id of ['globe-l1-controls-active', 'globe-l2-promoted', 'globe-l3-no-reset', 'globe-reverse-same-handler', 'cabinet-point-facing-hold', 'terminal-power-off-before-return', 'terminal-power-return-contact']) {
  if (!observations.some(observation => observation.id === id)) errors.push(`observation-${id}`)
}
for (const name of screenshots) {
  const bytes = readFileSync(resolve(root, 'SCREENSHOTS', name))
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') errors.push(`png-${name}`)
}
if (errors.length) throw new Error(`S15_R9_EVIDENCE_FAILED:${errors.join(',')}`)
console.log(`PASS_S15_R9_EVIDENCE screenshots=${screenshots.length} observations=${observations.length} frames=${inventory.frames.length} mutations=${mutation.killed}`)
