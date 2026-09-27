import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { snapshotCheckpointContracts } from './snapshot-nq5-checkpoint-contracts.mjs'
import { resolveLocalSchema } from './nq5/official.mjs'

export function compactRefresh(report) {
  return { ...report, snapshots: report.snapshots.map((snapshot) => ({ ...snapshot, contracts: (snapshot.contracts ?? []).map((document) => ({ openapi: document.openapi, paths: Object.fromEntries(Object.entries(document.paths).map(([route, methods]) => {
    const request = resolveLocalSchema(document, methods.post.requestBody.content['application/json'].schema)
    const response = resolveLocalSchema(document, methods.post.responses['200'].content['application/json'].schema)
    return [route, { post: { requestBody: { content: { 'application/json': { schema: request } } }, responses: { '200': { content: { 'application/json': { schema: response } } } } } }]
  })) })) })) }
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-nq5-source-refresh-'))
  const report = compactRefresh(await snapshotCheckpointContracts(directory))
  const output = path.join(directory, 'SOURCE_REFRESH.json')
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ output, status: report.status, facts: report.snapshots.map(({ name, facts }) => ({ name, facts })) })}\n`)
}
