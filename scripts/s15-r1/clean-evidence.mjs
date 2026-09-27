import { mkdirSync, readdirSync, rmSync } from 'node:fs'

const root = 'artifacts/s15-r1'
for (const directory of ['LOGS', 'RECEIPTS', 'SCREENSHOTS', 'TRACES']) {
  const path = `${root}/${directory}`
  mkdirSync(path, { recursive: true })
  for (const member of readdirSync(path)) rmSync(`${path}/${member}`, { recursive: true, force: true })
}
console.log('PASS_S15_R1_EVIDENCE_CLEAN')
