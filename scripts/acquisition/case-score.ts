import type { CaseScoreInput } from '../../src/acquisition/evidence/score.js'
import { scoreCase } from '../../src/acquisition/evidence/score.js'
import { fail, getArgument, printReport, readJson } from './common.js'

async function main() {
  const input = getArgument('--input', true) as string
  printReport({ command: 'case:score', input, result: scoreCase(await readJson<CaseScoreInput>(input)) })
}

main().catch(fail)
