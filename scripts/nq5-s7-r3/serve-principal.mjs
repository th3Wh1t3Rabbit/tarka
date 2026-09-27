import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../artifacts/principal-review')
const port = Number(process.env.TRACE_PRINCIPAL_PORT ?? 4293)
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' }
http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname)
  const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return }
  try {
    const info = await stat(target)
    if (!info.isFile()) throw new Error('not file')
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    createReadStream(target).pipe(response)
  } catch { response.writeHead(404).end('Not found') }
}).listen(port, '127.0.0.1', () => console.log(`Principal workbench preview on http://127.0.0.1:${port}`))
