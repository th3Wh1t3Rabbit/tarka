import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { extractDocumentFacts } from './nq5/official.mjs'

const documents = [
  ['transactions', 'https://docs.nansen.ai/api/profiler/address-transactions.md'],
  ['counterparties', 'https://docs.nansen.ai/api/profiler/address-counterparties.md'],
  ['historical-balances', 'https://docs.nansen.ai/api/profiler/address-historical-balances.md'],
  ['historical-transactions', 'https://docs.nansen.ai/api/backtesting-data/historical-address-transactions.md'],
  ['coverage', 'https://docs.nansen.ai/api/data-coverage.md'],
  ['pricing', 'https://docs.nansen.ai/getting-started/credits.md'],
  ['rate-limits', 'https://docs.nansen.ai/getting-started/rate-limits.md'],
  ['errors', 'https://docs.nansen.ai/getting-started/error-handling.md'],
  ['redistribution', 'https://docs.nansen.ai/guides/redistribution-guide.md'],
]

export async function snapshotCheckpointContracts(destination) {
  mkdirSync(destination, { recursive: true })
  const snapshots = []
  // Public docs host only. No API host, credentials, redirects, or fallback URLs.
  for (const [name, url] of documents) {
    if (new URL(url).origin !== 'https://docs.nansen.ai') throw new Error('Documentation scope violation.')
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error('Public document unavailable.')
      const body = await response.text()
      const structural = [...body.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].flatMap((match) => {
        try { const object = JSON.parse(match[1]); return object.openapi && object.paths ? [object] : [] } catch { return [] }
      })
      for (const [index, contract] of structural.entries()) writeFileSync(path.join(destination, `${name}.${index}.openapi.json`), `${JSON.stringify(contract, null, 2)}\n`)
      snapshots.push({ name, url, status: 'FETCHED', retrievedAtUtc: new Date().toISOString(), bodySha256: createHash('sha256').update(body).digest('hex'), facts: extractDocumentFacts(name, body), structuralContracts: structural.length, contracts: structural, paths: structural.flatMap((contract) => Object.keys(contract.paths)) })
    } catch { snapshots.push({ name, url, status: 'UNVERIFIED' }) }
    process.stdout.write(`PUBLIC DOC ${name}: ${snapshots.at(-1).status}\n`)
  }
  const report = { status: snapshots.every((snapshot) => snapshot.status === 'FETCHED') ? 'PASS_PUBLIC_DOC_REFRESH_ONLY' : 'INCOMPLETE', snapshots, providerCallsIssued: 0, credentialResolutionAttempted: false, accountBalance: null, planSpecificAdmission: false, frozenT1: false, qualificationCounted: 0 }
  writeFileSync(path.join(destination, 'OFFICIAL_CONTRACT_REFRESH.json'), `${JSON.stringify(report, null, 2)}\n`)
  return report
}
