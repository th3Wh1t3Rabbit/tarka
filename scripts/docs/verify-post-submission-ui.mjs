import { createServer } from 'node:http'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { chromium } from 'playwright'

const ROOT = resolve(import.meta.dirname, '../..')
const SITE = join(ROOT, 'docs-site')
const args = new Map(process.argv.slice(2).map((value, index, values) => value.startsWith('--')
  ? [value, values[index + 1]?.startsWith('--') ? true : values[index + 1]]
  : [value, value]))
const requestedBase = args.get('--base-url')
const screenshotDir = resolve(String(args.get('--screenshots') || join(ROOT, '.docs-build/post-submission-screenshots')))
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

let server
let baseUrl = requestedBase ? String(requestedBase).replace(/\/$/, '') : ''
if (!baseUrl) {
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
      const relative = normalize(pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''))
      const candidate = resolve(SITE, relative)
      if (!candidate.startsWith(`${SITE}/`) && candidate !== SITE) throw new Error('invalid path')
      const info = await stat(candidate)
      const file = info.isDirectory() ? join(candidate, 'index.html') : candidate
      response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' })
      response.end(await readFile(file))
    } catch {
      response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      response.end(await readFile(join(SITE, '404.html')))
    }
  })
  await new Promise((accept) => server.listen(0, '127.0.0.1', accept))
  baseUrl = `http://127.0.0.1:${server.address().port}`
}

await mkdir(screenshotDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const checks = []
const check = (name, condition, detail = '') => {
  checks.push({ name, result: condition ? 'PASS' : 'FAIL', detail })
  if (!condition) throw new Error(`${name}: ${detail}`)
}

const xPost = 'https://x.com/th3Wh1t3Rabbit/status/2104292991699681304'
const navLabels = [
  'Complete Script Explorer',
  'Complete story script',
  'World hotspot and verb routes',
  'Inventory interactions',
  'Arthur dialogue',
  'Actions, terminal speech, and endings',
  'Coverage and exclusions',
  'How to read the explorer',
]

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  await desktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  const navGroup = desktop.locator('.navgroup', { hasText: 'SCRIPT EXPLORER · SPOILERS' })
  check('desktop first-class Script Explorer group', await navGroup.count() === 1)
  check('desktop Script Explorer navigation has eight exact entries',
    JSON.stringify(await navGroup.locator('a').allTextContents()) === JSON.stringify(navLabels))
  check('homepage Script Explorer card', await desktop.locator('.script-explorer-card').isVisible())
  check('homepage counts', /724[\s\S]*1,505[\s\S]*214/.test(await desktop.locator('.script-explorer-card').innerText()))
  check('exact X post link', await desktop.locator(`a[href="${xPost}"]`).count() > 0)
  check('submission snapshot navigation', await desktop.getByText('Submitted competition snapshot', { exact: true }).count() > 0)
  check('spoiler control', await desktop.locator('#spoilerSearch').isVisible())
  await desktop.screenshot({ path: join(screenshotDir, 'homepage-readme-desktop.png'), fullPage: true })
  await desktop.locator('.script-explorer-card').screenshot({ path: join(screenshotDir, 'readme-script-explorer-card.png') })

  await desktop.goto(`${baseUrl}/docs/script/index.html`, { waitUntil: 'networkidle' })
  check('Script Explorer deep page title', await desktop.locator('article h1').innerText() === 'Complete Script Explorer')
  await desktop.locator('.navgroup', { hasText: 'SCRIPT EXPLORER · SPOILERS' })
    .screenshot({ path: join(screenshotDir, 'script-explorer-sidebar-desktop.png') })

  const explorer = JSON.parse(await (await fetch(`${baseUrl}/docs/script/SCRIPT_EXPLORER_INDEX.json`)).text())
  const worldHtml = await (await fetch(`${baseUrl}/docs/script/world-routes.html`)).text()
  const inventoryHtml = await (await fetch(`${baseUrl}/docs/script/inventory-routes.html`)).text()
  check('27 hotspot metadata records', explorer.hotspots.length === 27)
  check('15 inventory metadata records', explorer.inventoryItems.length === 15)
  check('all hotspot headings render', explorer.hotspots.every((item) => worldHtml.includes(`>${item.displayName}</h2>`)))
  check('all inventory headings render', explorer.inventoryItems.every((item) => inventoryHtml.includes(`>${item.displayName}</h2>`)))
  check('no public undefined strings', !/undefined/i.test(`${worldHtml}\n${inventoryHtml}`))
  check('no empty scene fields', !/Scene:\s*<code>\s*<\/code>/.test(worldHtml))

  await desktop.goto(`${baseUrl}/#page=docs%2Fscript%2Fworld-routes.md&anchor=motivational-poster`, { waitUntil: 'networkidle' })
  check('stable Script Explorer anchor', await desktop.locator('#motivational-poster').count() === 1)
  await desktop.goto(`${baseUrl}/404.html`, { waitUntil: 'networkidle' })
  check('custom 404', await desktop.getByText('Page not found', { exact: true }).count() > 0)
  await desktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await desktop.locator('#spoilerSearch').check()
  await desktop.locator('#search').fill('motivational poster')
  await desktop.waitForTimeout(180)
  check('search finds Script Explorer route', /matching pages/.test(await desktop.locator('#article').innerText()))
  check('desktop has no horizontal viewport overflow', await desktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await mobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await mobile.locator('#menu').click()
  const mobileGroup = mobile.locator('.navgroup', { hasText: 'SCRIPT EXPLORER · SPOILERS' })
  check('mobile first-class Script Explorer group', await mobileGroup.isVisible())
  check('mobile Script Explorer navigation has eight entries', await mobileGroup.locator('a').count() === 8)
  check('mobile has no horizontal viewport overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await mobile.screenshot({ path: join(screenshotDir, 'script-explorer-mobile.png'), fullPage: true })

  const failures = checks.filter((entry) => entry.result !== 'PASS')
  console.log(JSON.stringify({
    result: failures.length ? 'FAIL' : 'PASS',
    baseUrl,
    desktopViewport: '1440x1100',
    mobileViewport: '390x844',
    screenshots: screenshotDir,
    checks,
  }, null, 2))
} finally {
  await browser.close()
  if (server) await new Promise((accept) => server.close(accept))
}
