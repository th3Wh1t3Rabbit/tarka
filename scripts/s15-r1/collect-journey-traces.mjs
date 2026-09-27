import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'

const output = 'artifacts/s15-r1/TRACES'
mkdirSync(output, { recursive: true })
const sources = readdirSync('test-results', { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name.startsWith('s15-r1-production-journeys-'))
  .map(entry => `test-results/${entry.name}/trace.zip`)
  .filter(path => { try { return statSync(path).isFile() } catch { return false } })
  .sort()
if (sources.length !== 3) throw new Error(`Expected three current journey traces, found ${sources.length}`)
for (const [index, source] of sources.entries()) copyFileSync(source, `${output}/${String(index + 1).padStart(2, '0')}-production-journey-trace.zip`)
console.log(JSON.stringify({ schemaVersion: 's15-r1-journey-traces.v1', status: 'PASS', count: sources.length }))
