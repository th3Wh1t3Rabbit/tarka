#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Public documentation only. No API host, credential, dynamic query, or payment access.
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const destination = path.join(root, 'artifacts/g6p-a2u/current/contracts')
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
mkdirSync(destination, { recursive: true })
const snapshots = []
for (const [name, url] of documents) {
  if (new URL(url).hostname !== 'docs.nansen.ai') throw new Error('Documentation scope violation')
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.text()
    const contracts = [...body.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].flatMap((match) => {
      try { const json = JSON.parse(match[1]); return json.openapi && json.paths ? [json] : [] } catch { return [] }
    })
    // Archive structural OpenAPI contracts, not prose or the page's unrelated agent instructions.
    for (let index = 0; index < contracts.length; index++) writeFileSync(path.join(destination, `${name}.${index}.openapi.json`), `${JSON.stringify(contracts[index], null, 2)}\n`)
    snapshots.push({ name, url, retrievedAtUtc: new Date().toISOString(), sha256: createHash('sha256').update(body).digest('hex'), status: 'FETCHED', openapiContracts: contracts.length, paths: contracts.flatMap((contract) => Object.keys(contract.paths)) })
    process.stdout.write(`SNAPSHOT ${name}: ${contracts.length} structural contracts\n`)
  } catch (error) { snapshots.push({ name, url, status: 'UNVERIFIED', error: String(error.message) }) }
}
const report = {
  status: snapshots.every((snapshot) => snapshot.status === 'FETCHED') ? 'PUBLIC_DOCS_REFRESHED_NOT_ACQUISITION_AUTHORIZED' : 'INCOMPLETE_PUBLIC_DOC_REFRESH',
  snapshots, providerCallsIssued: 0, credentialResolutionAttempted: false,
  campaign: { requirement: '1,000+ API calls', submissionDeadlineUtc: '2026-09-27T23:59:00Z', source: 'https://release.nansen.ai/help/articles/3540155-nansen-meridian-buildathon-sep-14-27', verifiedViaBrowser: true },
  accountPlan: 'UNKNOWN', accountBalance: null, accountPreflight: 'NOT_ISSUED_AUTHORIZATION_CYCLE',
  planFrozen: false, qualificationCounted: 0,
  notes: ['Public docs describe Ethereum history from July 2015; that is not proof of complete retrieval for any specific query.', 'Current rate limits: Free 15/second and 300/minute; Pro 75/second and 1500/minute. The allowance imposes stricter concurrency/delay/rate constraints.', 'Quoted cost, used credits, and remaining credits must be reconciled from actual response headers. Current account tier and available credits remain unknown.', 'The transaction-lookup OpenAPI contract is included on the Address Transactions page.', 'No NQ5 plan or credit projection is claimed frozen or verified. Refresh plan-specific docs again immediately before any future campaign.'],
}
writeFileSync(path.join(destination, 'OFFICIAL_CONTRACT_REFRESH.json'), `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${report.status}\n`)
