import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const root = resolve('dist')
const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name)
  return entry.isDirectory() ? files(path) : [path]
}).filter((path) => /\.(?:js|map)$/.test(path))

const forbidden = [
  { id: 'PRIVATE_HOME_PATH', pattern: /\/home\/al(?:\/|\\b)/ },
  { id: 'PRIVATE_TMP_WORKTREE', pattern: /\/tmp\/trace-escape/ },
  { id: 'TRANSMISSION_ARCHIVE_NAME', pattern: /TRACE_ESCAPE_(?:MAIN_TO_CURSOR|CURSOR_TO_MAIN)/ },
  { id: 'REVIEW_QUERY', pattern: /[?&]review=1\b/ },
  { id: 'PROVIDER_SECRET', pattern: /(?:NANSEN|ALCHEMY)_(?:API_)?KEY\s*[:=]/ },
  { id: 'OPENAI_SECRET_SHAPE', pattern: /\bsk-[A-Za-z0-9_-]{20,}/ },
]

const hits = []
for (const path of files(root)) {
  const text = readFileSync(path, 'utf8')
  for (const rule of forbidden) if (rule.pattern.test(text)) hits.push({ rule: rule.id, path: relative(root, path) })
}
if (hits.length) throw new Error(`Built-output scan failed: ${JSON.stringify(hits)}`)
console.log(JSON.stringify({ status: 'PASS', scannedFiles: files(root).length, forbiddenPatterns: forbidden.map((rule) => rule.id), hits }))
