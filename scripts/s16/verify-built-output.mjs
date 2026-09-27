import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve('dist')
const files = []
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt'])
const forbidden = [
  ['absolute private path', /\/(?:home|Users)\/[A-Za-z0-9._-]+\//],
  ['credential marker', /(?:api|access|secret)[_-]?key\s*[:=]\s*['"][^'"]{8,}/i],
  ['private acquisition marker', /FUTURE_NANSEN_BUILD_TIME|FIXTURE_ONLY_NO_NETWORK|leadAuthorizationId|requestFingerprint/],
]

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) walk(path)
    else files.push(path)
  }
}

walk(root)
const failures = []
for (const file of files) {
  if (!textExtensions.has(extname(file))) continue
  const content = readFileSync(file, 'utf8')
  for (const [label, pattern] of forbidden) if (pattern.test(content)) failures.push(`${label}: ${relative(root, file)}`)
}
const maps = files.filter(file => extname(file) === '.map')
if (failures.length) throw new Error(failures.join('\n'))
console.log(JSON.stringify({ status: 'PASS', buildFiles: files.length, sourceMapsScanned: maps.length, forbiddenFindings: 0 }))
