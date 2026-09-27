#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = new URL('..', import.meta.url)
const baseUrl = 'http://127.0.0.1:4174'
const previewArtPacks = new URL('../PRINCIPAL_PREVIEW/static-build/art-packs/', import.meta.url)

function contentDuplicateCandidate(template) {
  const manifest = structuredClone(template)
  manifest.id = 'content-duplicate-fixture'; manifest.label = 'Content duplicate negative control'; manifest.status = 'LEAD_SELECTED'
  const rewrite = (value) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(rewrite); return }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'src' && typeof child === 'string') value[key] = child.replace('/art-packs/placeholder/', '/art-packs/content-duplicate-fixture/')
      else rewrite(child)
    }
  }
  rewrite(manifest)
  return manifest
}

async function bytes(url) {
  let total = 0
  for (const name of await readdir(url)) {
    const child = new URL(`${name}${(await stat(new URL(name, url))).isDirectory() ? '/' : ''}`, url)
    const details = await stat(child)
    total += details.isDirectory() ? await bytes(child) : details.size
  }
  return total
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(baseUrl)).ok) return } catch { /* local preview is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Local A1 preview did not start')
}

const server = spawn(process.execPath, ['serve.mjs'], { cwd: new URL('../PRINCIPAL_PREVIEW/', import.meta.url), stdio: 'ignore' })
try {
  await waitForServer()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const consoleErrors = []; const nonlocalRequests = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('request', (request) => { if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) nonlocalRequests.push(request.url()) })
  const navigationStarted = performance.now()
  await page.goto(baseUrl)
  await page.getByTestId('a0-shell').waitFor({ state: 'visible' })
  const readyMs = performance.now() - navigationStarted
  const openingPresent = await page.getByTestId('a0-shell').getAttribute('data-intro-complete') === 'false'
  const startupRecordChecklistHidden = !(await page.locator('body').innerText()).includes('RECORDS 0/1')
  const openingFonts = await page.locator('.speech-panel strong, .speech-panel span, .speech-panel small').evaluateAll((elements) => elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)))
  for (let guard = 0; guard < 20 && await page.getByTestId('speech-panel').isVisible().catch(() => false); guard += 1) await page.getByTestId('speech-panel').click()
  const openingCompleted = await page.getByTestId('a0-shell').getAttribute('data-intro-complete') === 'true'
  const metrics = await page.evaluate(() => {
    const frame = document.querySelector('.a0-frame')?.getBoundingClientRect()
    const scene = document.querySelector('.adventure-scene')?.getBoundingClientRect()
    const controls = [...document.querySelectorAll('.verb-grid button, .inventory-panel header, .inventory-slot, .objective-card strong, .objective-card small, .a0-accessibility button')].map((element) => ({ fontPx: Number.parseFloat(getComputedStyle(element).fontSize), rect: element.getBoundingClientRect() }))
    return { frame: frame && { width: frame.width, height: frame.height }, scene: scene && { width: scene.width, height: scene.height }, verbCount: document.querySelectorAll('.verb-grid button').length, hotspotCount: Number(document.querySelector('.adventure-scene')?.getAttribute('data-hotspot-total')), visibleHotspotCount: document.querySelectorAll('.hotspot-button').length, canvasCount: document.querySelectorAll('canvas').length, rookVisible: Boolean(document.querySelector('[data-testid="rook-sprite"]')), indexVisible: Boolean(document.querySelector('[data-testid="mr-index-sprite"]')), minFontPx: Math.min(...controls.map(({ fontPx }) => fontPx)), controlsInViewport: controls.every(({ rect }) => rect.top >= 0 && rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight) }
  })
  const before = await page.getByTestId('rook-sprite').getAttribute('style')
  const walkStarted = performance.now()
  await page.getByTestId('records-office').click({ position: { x: 470, y: 315 } })
  await page.waitForTimeout(120)
  const after = await page.getByTestId('rook-sprite').getAttribute('style')
  const clickResponseMs = performance.now() - walkStarted
  const frameCadence = await page.evaluate(() => new Promise((resolve) => {
    const samples = []; let previous = performance.now()
    const step = (now) => { samples.push(now - previous); previous = now; if (samples.length >= 20) resolve(samples); else requestAnimationFrame(step) }
    requestAnimationFrame(step)
  }))
  await page.getByTestId('verb-talk-to').click(); await page.getByTestId('hotspot-mr-index').click(); await page.getByTestId('dialogue-panel').waitFor({ state: 'visible' })
  await page.getByTestId('dialogue-record').click(); await page.waitForTimeout(50)
  const talkingStarts = await page.getByTestId('a0-shell').getAttribute('data-talking') === 'ROOK'
  await page.keyboard.press('Space')
  const talkingStopsAfterReveal = await page.getByTestId('a0-shell').getAttribute('data-talking') === 'NONE'
  await page.goto(`${baseUrl}/?artLab=1`); await page.getByTestId('art-lab').waitFor({ state: 'visible' })
  const measureArtLab = () => page.evaluate(() => {
    const labels = [...document.querySelectorAll('.lab-props small, .lab-inventory small')]
    const rectangles = labels.map((label) => label.getBoundingClientRect())
    const overlapCount = rectangles.flatMap((left, index) => rectangles.slice(index + 1).filter((right) => left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top)).length
    const rows = [...document.querySelectorAll('[data-slot-status]')]
    const requiredRows = rows.filter((row) => row.querySelector('td:nth-of-type(2)')?.textContent === 'REQUIRED')
    const diagnosticOverlapCount = rows.filter((row) => {
      const fingerprint = row.querySelector('code')?.getBoundingClientRect()
      const status = row.querySelector('td:last-child strong')?.getBoundingClientRect()
      return Boolean(fingerprint && status && fingerprint.left < status.right && fingerprint.right > status.left && fingerprint.top < status.bottom && fingerprint.bottom > status.top)
    }).length
    const lab = document.querySelector('.art-lab')
    return {
      disposition: document.querySelector('#art-diagnostics-title')?.textContent,
      summary: document.querySelector('[data-testid="art-slot-summary"]')?.textContent,
      diagnosticsRows: rows.length,
      requiredRowsPass: requiredRows.length > 0 && requiredRows.every((row) => row.getAttribute('data-slot-status') === 'PASS'),
      actualDimensionsPresent: requiredRows.every((row) => row.querySelector('td:nth-of-type(4)')?.textContent !== '—'),
      fingerprintsPresent: requiredRows.every((row) => /^[a-f0-9]{64}$/.test(row.getAttribute('data-fingerprint') ?? '')),
      overlapCount,
      diagnosticOverlapCount,
      minimumLabelFontPx: Math.min(...labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize))),
      scrollable: Boolean(lab && lab.scrollHeight > lab.clientHeight),
    }
  })
  const artLab1920 = await measureArtLab()
  await page.setViewportSize({ width: 1280, height: 720 })
  const artLab1280 = await measureArtLab()
  const artLab = { canvasCount: await page.locator('canvas').count(), walkFrames: Number(await page.getByTestId('art-lab-rook').getAttribute('data-animation-frames')), nearest: await page.locator('.lab-scene img').first().evaluate((element) => getComputedStyle(element).imageRendering), packSlots: await page.locator('select[aria-label="Art Lab pack"] option').count(), propStateLabels: await page.locator('.lab-props small').count(), viewports: { '1280x720': artLab1280, '1920x1080': artLab1920 } }
  const negativePage = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  negativePage.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  negativePage.on('pageerror', (error) => consoleErrors.push(error.message))
  negativePage.on('request', (request) => { if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) nonlocalRequests.push(request.url()) })
  const placeholder = JSON.parse(await readFile(new URL('placeholder/manifest.json', previewArtPacks), 'utf8'))
  const candidate = contentDuplicateCandidate(placeholder)
  const negativeIndex = JSON.parse(await readFile(new URL('index.json', previewArtPacks), 'utf8'))
  negativeIndex.packs.push({ id: candidate.id, label: candidate.label, status: candidate.status })
  await negativePage.route('**/art-packs/content-duplicate-fixture/**/*.svg', async (route) => {
    const suffix = new URL(route.request().url()).pathname.split('/art-packs/content-duplicate-fixture/')[1]
    const mapped = suffix === 'characters/rook-walk-2.svg' ? 'characters/rook-walk.svg' : suffix
    await route.fulfill({ path: fileURLToPath(new URL(`placeholder/${mapped}`, previewArtPacks)), contentType: 'image/svg+xml' })
  })
  await negativePage.route('**/art-packs/content-duplicate-fixture/manifest.json', (route) => route.fulfill({ json: candidate }))
  await negativePage.route('**/art-packs/index.json', (route) => route.fulfill({ json: negativeIndex }))
  await negativePage.goto(`${baseUrl}/?artLab=1&artPack=content-duplicate-fixture`)
  await negativePage.getByTestId('art-pack-diagnostics').waitFor({ state: 'visible' })
  const contentIdentityNegativeControl = {
    disposition: await negativePage.locator('#art-diagnostics-title').textContent(),
    summary: await negativePage.getByTestId('art-slot-summary').textContent(),
    duplicateContentRows: await negativePage.locator('[data-slot-status="DUPLICATE_CONTENT"]').count(),
    loadedPackId: await negativePage.getByTestId('art-pack-diagnostics').locator('dd').nth(3).textContent(),
    requiredCompleteVisible: await negativePage.getByText('REQUIRED SLOTS COMPLETE', { exact: true }).count() > 0,
  }
  await negativePage.close()
  const report = {
    schemaVersion: '2.0.0', generatedAtUtc: new Date().toISOString(), activePresentation: 'CLASSIC_POINT_AND_CLICK_ADVENTURE', renderer: 'REACT_DOM_SVG_CSS_RASTER_READY', logicalFrame: '960x540', nativeArtPlane: '480x270', implementedScenes: ['RECORDS_OFFICE', 'BLANK_SHELL_NONPLAYABLE'], finalArtClaimed: false,
    staticBuildBytes: await bytes(new URL('../PRINCIPAL_PREVIEW/static-build/', import.meta.url)), frameAspectRatio: metrics.frame ? metrics.frame.width / metrics.frame.height : 0, sceneAspectRatio: metrics.scene ? metrics.scene.width / metrics.scene.height : 0,
    verbCount: metrics.verbCount, hotspotCount: metrics.hotspotCount, visibleHotspotCountAtStart: metrics.visibleHotspotCount, canvasCount: metrics.canvasCount, rookVisible: metrics.rookVisible, mrIndexVisible: metrics.indexVisible, clickToWalkVisible: before !== after, talkingStarts, talkingStopsAfterReveal, openingPresent, openingCompleted, startupRecordChecklistHidden,
    artLab, contentIdentityNegativeControl, readability1080p: { minimumObservedCriticalFontPx: Math.min(metrics.minFontPx, ...openingFonts), criticalControlsInViewport: metrics.controlsInViewport }, performance: { readyMs: Math.round(readyMs), clickResponseMs: Math.round(clickResponseMs), meanFrameIntervalMs: Math.round(frameCadence.reduce((sum, value) => sum + value, 0) / frameCadence.length * 10) / 10, sampleFrames: frameCadence.length }, screenshots: (await readdir(new URL('../PRINCIPAL_PREVIEW/screenshots/', import.meta.url))).filter((name) => name.endsWith('.png')).length,
    ordinaryPlayNonlocalRequests: nonlocalRequests.length, consoleErrors,
  }
  const artLabHealthy = Object.values(report.artLab.viewports).every((viewport) => viewport.disposition === 'COMPLETE_PLACEHOLDER' && viewport.summary === 'REQUIRED SLOTS COMPLETE' && viewport.diagnosticsRows > 30 && viewport.requiredRowsPass && viewport.actualDimensionsPresent && viewport.fingerprintsPresent && viewport.overlapCount === 0 && viewport.diagnosticOverlapCount === 0 && viewport.minimumLabelFontPx >= 16 && viewport.scrollable)
  const duplicateControlHealthy = report.contentIdentityNegativeControl.disposition === 'INVALID_REQUIRED_ASSETS' && report.contentIdentityNegativeControl.duplicateContentRows === 2 && report.contentIdentityNegativeControl.loadedPackId?.startsWith('placeholder /') && !report.contentIdentityNegativeControl.requiredCompleteVisible && !report.contentIdentityNegativeControl.summary?.includes('REQUIRED SLOTS COMPLETE')
  const failure = Math.abs(report.frameAspectRatio - 16 / 9) > 0.01 || report.verbCount !== 9 || report.hotspotCount !== 10 || report.visibleHotspotCountAtStart !== 9 || report.canvasCount !== 0 || !report.rookVisible || !report.mrIndexVisible || !report.clickToWalkVisible || !report.talkingStarts || !report.talkingStopsAfterReveal || !report.openingPresent || !report.openingCompleted || !report.startupRecordChecklistHidden || report.artLab.canvasCount !== 0 || report.artLab.walkFrames < 2 || report.artLab.packSlots < 4 || report.artLab.propStateLabels < 10 || !['pixelated', 'crisp-edges'].includes(report.artLab.nearest) || !artLabHealthy || !duplicateControlHealthy || report.readability1080p.minimumObservedCriticalFontPx < 16 || !report.readability1080p.criticalControlsInViewport || report.performance.readyMs > 5000 || report.performance.clickResponseMs > 500 || report.performance.meanFrameIntervalMs > 50 || report.screenshots !== 8 || report.ordinaryPlayNonlocalRequests !== 0 || report.consoleErrors.length > 0
  const result = { ...report, recommendation: failure ? 'RED' : 'GREEN' }
  await writeFile(new URL('../PRINCIPAL_PREVIEW/PRESENTATION_HEALTH_REPORT.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  await browser.close()
  if (failure) process.exitCode = 1
} finally { server.kill('SIGTERM') }
