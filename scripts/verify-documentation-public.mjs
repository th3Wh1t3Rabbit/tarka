import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const failures = []
const fail = (message) => failures.push(message)
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? walk(path) : [path]
})
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

const markdownFiles = [join(root, 'README.md'), ...walk(join(root, 'docs')).filter((p) => extname(p) === '.md')]
const requests = JSON.parse(readFileSync(join(root, 'docs/data/requests.json'), 'utf8'))
const records = JSON.parse(readFileSync(join(root, 'docs/data/records.json'), 'utf8'))
const scriptCoverage = JSON.parse(readFileSync(join(root, 'docs/script/SCRIPT_EXPLORER_COVERAGE.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(root, 'docs-site/build-manifest.json'), 'utf8'))
const figures = walk(join(root, 'docs/assets/terminal')).filter((p) => extname(p).toLowerCase() === '.png')

if (markdownFiles.length !== 147) fail(`Expected 147 canonical Markdown pages, found ${markdownFiles.length}`)
if (requests.length !== 101) fail(`Expected 101 request records, found ${requests.length}`)
if (records.length !== 227) fail(`Expected 227 compiled records, found ${records.length}`)
if (figures.length !== 17) fail(`Expected 17 terminal-reference figures, found ${figures.length}`)
if (manifest.pages !== 147 || manifest.request_pages !== 101 || manifest.compiled_records !== 227) {
  fail('Generated documentation manifest counts do not match the canonical library')
}
if (scriptCoverage.result !== 'PASS') fail('Script Explorer coverage receipt is not PASS')
if (scriptCoverage.invariants?.missingFinalBubbleIds?.length) fail('Script Explorer is missing final authority bubbles')
if (scriptCoverage.invariants?.productionActionErrors?.length) fail('Script Explorer production action execution has errors')
if (scriptCoverage.invariants?.unexplainedOmissions?.length) fail('Script Explorer has unexplained omissions')
if (scriptCoverage.invariants?.expectedWorldRouteCount !== scriptCoverage.invariants?.actualWorldRouteCount) fail('Script Explorer world route count drift')
if (scriptCoverage.invariants?.expectedInventoryRouteCount !== scriptCoverage.invariants?.actualInventoryRouteCount) fail('Script Explorer inventory route count drift')
if (manifest.script_explorer_result !== 'PASS' || manifest.script_explorer_unexplained_omissions !== 0) fail('Generated site is not bound to PASS Script Explorer coverage')
for (const name of ['SCRIPT_EXPLORER_INDEX.json', 'SCRIPT_EXPLORER_COVERAGE.json']) {
  const source = join(root, 'docs/script', name)
  const copy = join(root, 'docs-site/docs/script', name)
  if (!existsSync(copy) || sha256(copy) !== sha256(source)) fail(`Generated Script Explorer asset mismatch: ${name}`)
}

const forbidden = [
  [/\[DOC-TODO:/i, 'DOC-TODO marker'],
  [/\[SCREENSHOT:/i, 'SCREENSHOT marker'],
  [/\{\{[^}\n]+\}\}/, 'template marker'],
  [/\/home\/al\//, 'machine-local home path'],
  [/\/tmp\//, 'machine-local temporary path'],
  [/Cypher Lynx Vale/i, 'private creator name'],
]
for (const file of [...markdownFiles, ...walk(join(root, 'docs-site')).filter((p) => ['.html', '.json', '.js', '.css'].includes(extname(p)))]) {
  const text = readFileSync(file, 'utf8')
  for (const [pattern, label] of forbidden) if (pattern.test(text)) fail(`${label} in ${relative(root, file)}`)
}

const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g
for (const file of markdownFiles) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(linkPattern)) {
    const href = match[1]
    if (/^(?:https?:|mailto:|#)/i.test(href)) continue
    const clean = decodeURIComponent(href.split('#')[0])
    if (!clean) continue
    const target = resolve(file, '..', clean)
    if (!target.startsWith(`${root}/`)) fail(`Link escapes repository: ${relative(root, file)} -> ${href}`)
    else if (!existsSync(target)) fail(`Broken local link: ${relative(root, file)} -> ${href}`)
  }
}

for (const file of walk(join(root, 'docs-site')).filter((p) => extname(p) === '.html')) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\shref="([^"]+)"/g)) {
    const href = match[1]
    if (/^(?:https?:|mailto:|#|\/)/i.test(href)) continue
    const clean = decodeURIComponent(href.split('#')[0])
    if (!clean) continue
    const target = resolve(file, '..', clean)
    if (!target.startsWith(`${join(root, 'docs-site')}/`) || !existsSync(target)) {
      fail(`Broken generated link: ${relative(root, file)} -> ${href}`)
    }
  }
}

for (const file of markdownFiles) {
  const key = relative(root, file).replaceAll('\\', '/')
  const expected = key === 'README.md' ? 'index.html' : key.replace(/\.md$/, '.html')
  if (!existsSync(join(root, 'docs-site', expected))) fail(`Missing generated deep link: ${expected}`)
  if (manifest.markdown_sha256?.[key] !== sha256(file)) fail(`Stale generated page hash: ${key}`)
}

const imageFiles = walk(join(root, 'docs')).filter((p) => ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(p).toLowerCase()))
if (imageFiles.length !== 21 || manifest.image_count !== 21) fail(`Expected 21 documentation images, found ${imageFiles.length}`)
for (const file of imageFiles) {
  const bytes = readFileSync(file)
  const ext = extname(file).toLowerCase()
  if (ext === '.png') {
    const valid = bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    if (!valid) fail(`Undecodable PNG signature: ${relative(root, file)}`)
    if (file.includes('/docs/assets/terminal/') && (bytes.readUInt32BE(16) !== 960 || bytes.readUInt32BE(20) !== 540)) {
      fail(`Terminal figure is not 960x540: ${relative(root, file)}`)
    }
  }
  const copy = join(root, 'docs-site', relative(root, file))
  if (!existsSync(copy) || sha256(copy) !== sha256(file)) fail(`Generated image copy mismatch: ${relative(root, file)}`)
}

const releaseLinks = JSON.parse(readFileSync(join(root, 'scripts/docs/release-links.json'), 'utf8')).links
const stable = {
  play: 'https://play.tarka-meridian.workers.dev/',
  documentation: 'https://docs.tarka-meridian.workers.dev/',
  repository: 'https://github.com/th3Wh1t3Rabbit/tarka',
  downloads: 'https://github.com/th3Wh1t3Rabbit/tarka/releases/tag/v1.0.0-meridian',
}
for (const [key, url] of Object.entries(stable)) if (releaseLinks[key]?.url !== url) fail(`Stable ${key} URL changed or is missing`)
if (!existsSync(join(root, 'docs-site/404.html'))) fail('Generated 404 page is missing')

const report = {
  result: failures.length ? 'FAIL' : 'PASS',
  canonical_pages: markdownFiles.length,
  generated_pages: manifest.pages,
  requests: requests.length,
  records: records.length,
  terminal_figures: figures.length,
  documentation_images: imageFiles.length,
  failures,
}
console.log(JSON.stringify(report, null, 2))
process.exit(failures.length ? 1 : 0)
