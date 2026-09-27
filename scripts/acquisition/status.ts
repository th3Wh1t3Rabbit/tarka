import path from 'node:path'
import { readLedger } from '../../src/acquisition/integrity/ledger.js'
import { getArgument, printReport, resolveRepositoryPath } from './common.js'

async function main() {
  const primaryRoot = resolveRepositoryPath(getArgument('--primary-root') ?? 'artifacts/acquisition/dry-run/primary')
  const ledgerPath = path.join(primaryRoot, 'ledger', 'calls.jsonl')
  const records = await readLedger(ledgerPath)
  const completed = records.filter(({ status }) => status === 'COMPLETED' || status === 'SIMULATED' || status === 'REUSED')
  const issued = records.filter(({ status }) => status === 'COMPLETED' || status === 'SIMULATED')
  printReport({
    command: 'acquisition:status',
    mode: 'FIXTURE_ONLY_NO_NETWORK',
    ledgerPath: path.relative(process.cwd(), ledgerPath),
    records: records.length,
    completed: completed.length,
    reused: records.filter(({ status }) => status === 'REUSED').length,
    projectedCredits: issued.reduce((sum, record) => sum + record.plannedCreditEstimate, 0),
    providerCalls: 0,
    credentialResolution: 'DISABLED_G3',
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`FAILED: ${error instanceof Error ? error.message : 'status error'}\n`)
  process.exitCode = 1
})
