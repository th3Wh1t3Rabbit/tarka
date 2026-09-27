import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'

const root = 'artifacts/s15-r1'
const files = readdirSync(`${root}/SCREENSHOTS`).sort()
const traces = readdirSync(`${root}/TRACES`).filter(file => file.endsWith('.zip')).sort()
const required = [
  'title-before-play',
  'room-music-control',
  'case-terminal',
  'rejected-theory-falsifier',
  'blocking-ending-no-music-control',
  'completion-music-restored',
  '200-percent-zoom',
]
for (const token of required) if (!files.some(file => file.includes(token))) throw new Error(`Missing fresh evidence family: ${token}`)
for (const file of files) {
  if (!file.endsWith('.png')) throw new Error(`Unexpected screenshot member: ${file}`)
  const bytes = readFileSync(`${root}/SCREENSHOTS/${file}`)
  if (bytes.length < 5_000) throw new Error(`Screenshot too small to be production evidence: ${file}`)
}
if (traces.length !== 3) throw new Error(`Expected three fresh journey traces, found ${traces.length}`)
const receipt = { schemaVersion: 's15-r1-evidence-ownership.v1', status: 'PASS', producer: 'tests/e2e/s15-r1-production-journeys.spec.ts', screenshots: files, traces }
mkdirSync(`${root}/RECEIPTS`, { recursive: true })
writeFileSync(`${root}/RECEIPTS/EVIDENCE_OWNERSHIP.json`, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt))
