import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CandidateEvidenceGraph, ProvenanceRecord, PublicScenarioDraft } from '../../src/acquisition/contracts.js'
import { lintPublicScenario } from '../../src/acquisition/evidence/public-export.js'
import { canonicalJson, sha256Hex } from '../../src/acquisition/integrity/identity.js'
import { fail, getArgument, printReport, readJson, resolveRepositoryPath } from './common.js'

async function main() {
  const input = getArgument('--input', true) as string
  const inputPath = resolveRepositoryPath(input)
  const graphPath = resolveRepositoryPath(getArgument('--graph') ?? path.join(path.dirname(inputPath), 'candidate-evidence-graph.json'))
  const normalizedRoot = resolveRepositoryPath(getArgument('--normalized-root') ?? path.join(path.dirname(inputPath), '..', 'primary', 'normalized', 'sha256'))
  const provenancePath = resolveRepositoryPath(getArgument('--provenance') ?? path.join(path.dirname(inputPath), 'provenance.json'))
  const errors: string[] = []
  let graph: CandidateEvidenceGraph | undefined
  try {
    graph = await readJson<CandidateEvidenceGraph>(graphPath)
  } catch {
    errors.push('PublicScenarioDraft.provenance.candidateGraphSha256: supplied candidate graph is missing or unreadable')
  }
  const draft = await readJson<PublicScenarioDraft>(inputPath)
  try {
    const standalone = await readJson<ProvenanceRecord>(provenancePath)
    if (canonicalJson(standalone as never) !== canonicalJson(draft.provenance as never)) {
      errors.push('PublicScenarioDraft.provenance: standalone provenance does not exactly match embedded finalized provenance')
    }
  } catch {
    errors.push('PublicScenarioDraft.provenance: standalone provenance is missing or unreadable')
  }
  const lint = lintPublicScenario(draft, graph)
  for (const hash of draft.provenance?.normalizedSha256 ?? []) {
    if (!/^[a-f0-9]{64}$/.test(hash)) continue
    try {
      const bytes = await readFile(path.join(normalizedRoot, hash.slice(0, 2), `${hash}.json`))
      if (sha256Hex(bytes) !== hash) errors.push(`PublicScenarioDraft.provenance.normalizedSha256: stored object ${hash} does not match its digest`)
    } catch {
      errors.push(`PublicScenarioDraft.provenance.normalizedSha256: stored object ${hash} is missing or unreadable`)
    }
  }
  const result = { ok: lint.ok && errors.length === 0, errors: [...new Set([...lint.errors, ...errors])].sort() }
  printReport({ command: 'export:lint', input, ...result })
  if (!result.ok) process.exitCode = 1
}

main().catch(fail)
