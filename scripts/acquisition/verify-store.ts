import path from 'node:path'
import { verifyContentStore } from '../../src/acquisition/integrity/store.js'
import { fail, getArgument, printReport, resolveRepositoryPath } from './common.js'

async function main() {
  const outputRoot = resolveRepositoryPath(getArgument('--output') ?? 'artifacts/acquisition/dry-run')
  const roots = { primaryRoot: path.join(outputRoot, 'primary'), mirrorRoot: path.join(outputRoot, 'mirror') }
  const result = await verifyContentStore(roots, path.join(roots.primaryRoot, 'ledger', 'calls.jsonl'))
  printReport({ command: 'acquisition:verify-store', ...result })
  if (!result.ok) process.exitCode = 1
}

main().catch(fail)
