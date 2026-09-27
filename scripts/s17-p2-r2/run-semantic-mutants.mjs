import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = process.cwd()
const output = resolve(root, process.argv[2] ?? 'review/s17-p2-r2/MUTATIONS/semantic-mutants.json')
const focused = ['vitest', 'run', 'tests/unit/s17-p2-r2-production-dialogue-audit.test.ts', 'tests/unit/s17-p2-r2-routing-matrix.test.ts', '--reporter=dot']
const mutations = [
  {
    id: 'M01_READD_SUPERSEDED_POST_AUTHORIZATION',
    file: 'src/adventure/content.ts',
    from: "POST_STAMP_AUTHORIZATION: uniqueSpeech(event('COPY.A1:Stamp, return, and authorization'), event('COPY.A1:Confidential-files warning and approved continuation'))",
    to: "POST_STAMP_AUTHORIZATION: uniqueSpeech(event('COPY.A1:Stamp, return, and authorization'), event('COPY.A1:Confidential-files warning and approved continuation'), event('COPY.A2_A4:A2.1 — Post-authorization direction'))",
  },
  {
    id: 'M02_BROADEN_TERMINAL_VHS_ROUTE',
    file: 'src/adventure/content.ts',
    from: "return itemId === 'sharknado-2-vhs' ? event('COPY.INVENTORY:USE with Case Terminal') : incompatibleUseFallback(itemId, targetId)",
    to: "return event('COPY.INVENTORY:USE with Case Terminal')",
  },
  {
    id: 'M03_INVENTORY_TALK_FALLS_TO_VHS',
    file: 'src/adventure/content.ts',
    from: "if (verb === 'TALK_TO') return inventoryTalkFallback(itemId)",
    to: "if (verb === 'TALK_TO') return event('COPY.INVENTORY:Invalid USE elsewhere')",
  },
  {
    id: 'M04_BARE_WORLD_USE_FALLS_TO_VHS',
    file: 'src/adventure/content.ts',
    from: "if (verb === 'USE') return reachableFallback('That won’t help.')",
    to: "if (verb === 'USE') return event('COPY.INVENTORY:Invalid USE elsewhere')",
  },
  {
    id: 'M05_REINTRODUCE_DORMANT_INVALID_INDEX',
    file: 'src/adventure/content.ts',
    from: 'return incompatibleUseFallback(itemId, targetItemId)',
    to: "return event('COPY.INVENTORY:Invalid USE pair', 4)",
  },
  {
    id: 'M06_DISABLE_EXACT_REPETITION_DETECTOR',
    file: 'src/adventure/productionDialogueAudit.ts',
    from: "if (left.normalized === right.normalized) return { routeId, kind: 'EXACT', similarity: 1, left, right }",
    to: "if (false && left.normalized === right.normalized) return { routeId, kind: 'EXACT', similarity: 1, left, right }",
  },
]

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const reports = []
for (const mutation of mutations) {
  const path = resolve(root, mutation.file)
  const original = readFileSync(path)
  let setupError = null
  let result = null
  try {
    const source = original.toString('utf8')
    const occurrences = source.split(mutation.from).length - 1
    if (occurrences !== 1) throw new Error(`${mutation.file}: expected one mutation site, found ${occurrences}`)
    writeFileSync(path, source.replace(mutation.from, mutation.to))
    result = spawnSync('npx', focused, { cwd: root, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } })
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error)
  } finally {
    writeFileSync(path, original)
  }
  const restored = readFileSync(path)
  const outputText = `${result?.stdout ?? ''}${result?.stderr ?? ''}`
  reports.push({
    id: mutation.id,
    namedSemanticAssertionFailed: !setupError && result?.status !== 0 && /AssertionError|expected/i.test(outputText),
    exitCode: result?.status ?? null,
    setupError,
    file: mutation.file,
    originalSha256: sha256(original),
    restoredSha256: sha256(restored),
    byteRestored: Buffer.compare(original, restored) === 0,
    outputTail: outputText.slice(-2400).replaceAll(root, '<REPO>'),
  })
}

const report = {
  schemaVersion: '1.0.0',
  method: 'Six semantic faults were applied one at a time to settled source. Focused assertions had to fail semantically, then original bytes were restored and hash-checked.',
  total: reports.length,
  killed: reports.filter(report => report.namedSemanticAssertionFailed).length,
  survived: reports.filter(report => !report.namedSemanticAssertionFailed).map(report => report.id),
  allByteRestored: reports.every(report => report.byteRestored),
  mutations: reports,
}
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ output, total: report.total, killed: report.killed, survived: report.survived, allByteRestored: report.allByteRestored }))
process.exit(report.killed === report.total && report.allByteRestored ? 0 : 1)
