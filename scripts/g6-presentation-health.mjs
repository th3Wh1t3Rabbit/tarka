#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { readdir, stat, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const root = new URL('..', import.meta.url)
const baseUrl = 'http://127.0.0.1:4174'

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
    try { if ((await fetch(baseUrl)).ok) return } catch { /* local preview is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Local Principal Preview did not start')
}

async function clickReady(page, testId) {
  const target = page.getByTestId(testId)
  await target.waitFor({ state: 'visible', timeout: 12_000 })
  await target.click()
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174'], { cwd: root, stdio: 'ignore' })
try {
  await waitForServer()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const consoleErrors = []
  const nonlocalRequests = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('request', (request) => { if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) nonlocalRequests.push(request.url()) })
  await page.goto(`${baseUrl}/?review=1`)
  await page.getByTestId('enter-vault').click()
  await page.waitForTimeout(120)
  const cameraBefore = await page.locator('canvas').getAttribute('data-camera-sample')
  await page.mouse.move(420, 310)
  await page.mouse.move(1500, 700, { steps: 8 })
  await page.waitForTimeout(350)
  const cameraAfter = await page.locator('canvas').getAttribute('data-camera-sample')
  const openingResponsive = cameraBefore !== null && cameraAfter !== null && cameraBefore !== cameraAfter
  await clickReady(page, 'follow-first-trail')
  await clickReady(page, 'route-scan')
  const clickArrivalNode = (await page.evaluate(() => window.__TRACE_ESCAPE__?.getState().navigation.currentNodeId)) ?? null
  await clickReady(page, 'open-case-index')
  await page.getByTestId('twin-breach-index').waitFor({ state: 'visible' })
  await page.waitForTimeout(8_000)
  const stats = await page.evaluate(() => window.__TRACE_ESCAPE__?.getRenderStats())
  const webglVersion = await page.locator('canvas').evaluate((canvas) => canvas.getContext('webgl2') ? 'WebGL 2' : canvas.getContext('webgl') ? 'WebGL 1' : 'UNAVAILABLE')
  await page.getByRole('button', { name: /MOTION FULL/ }).click()
  const reducedMotion = await page.getByRole('button', { name: /MOTION REDUCED/ }).getAttribute('aria-pressed') === 'true'
  await clickReady(page, 'branch-1'); await clickReady(page, 'analyze-branch'); await clickReady(page, 'complete-branch'); await clickReady(page, 'leave-unwind'); await clickReady(page, 'rewind')
  await clickReady(page, 'branch-2'); await clickReady(page, 'analyze-branch'); await clickReady(page, 'complete-branch'); await clickReady(page, 'rewind')
  await clickReady(page, 'bring-records')
  await page.locator('input[value="FIRST_TRAIL_JOINS_SECOND_ROUTE"]').check(); await clickReady(page, 'sweep-forward'); await clickReady(page, 'continue-after-hypothesis'); await clickReady(page, 'build-case')
  const criticalReadability = await page.getByTestId('case-assembly').locator('legend, label > span, [data-testid="verify-case"]').evaluateAll((elements) => elements.map((element) => { const rect = element.getBoundingClientRect(); return { fontPx: Number.parseFloat(getComputedStyle(element).fontSize), inViewport: rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth } }))
  const minimumCriticalFontPx = Math.min(...criticalReadability.map(({ fontPx }) => fontPx))
  const criticalContentInViewport = criticalReadability.every(({ inViewport }) => inViewport)
  const keyboardPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await keyboardPage.goto(`${baseUrl}/?review=1`)
  await keyboardPage.getByRole('button', { name: /MOTION FULL/ }).click()
  await keyboardPage.getByTestId('enter-vault').click(); await keyboardPage.getByTestId('follow-first-trail').waitFor({ state: 'visible' })
  await keyboardPage.keyboard.down('w'); await keyboardPage.waitForTimeout(60); await keyboardPage.keyboard.up('w'); await keyboardPage.waitForTimeout(60)
  const pausedProgress = (await keyboardPage.evaluate(() => window.__TRACE_ESCAPE__?.getState().navigation.travelProgress)) ?? 0
  await keyboardPage.waitForTimeout(160)
  const heldTravelPausesOnRelease = Math.abs(((await keyboardPage.evaluate(() => window.__TRACE_ESCAPE__?.getState().navigation.travelProgress)) ?? 0) - pausedProgress) < 0.02
  await keyboardPage.keyboard.down('w'); await keyboardPage.getByTestId('route-scan').waitFor({ state: 'visible', timeout: 4_000 }); await keyboardPage.keyboard.up('w')
  const keyboardArrivalNode = (await keyboardPage.evaluate(() => window.__TRACE_ESCAPE__?.getState().navigation.currentNodeId)) ?? null
  const keyboardClickParity = heldTravelPausesOnRelease && clickArrivalNode !== null && clickArrivalNode === keyboardArrivalNode
  await keyboardPage.close()
  const cameraFindings = [!openingResponsive ? 'Pointer motion did not produce a measurable opening camera response.' : null, !cameraBefore || !cameraAfter || [...cameraBefore.split(','), ...cameraAfter.split(',')].some((value) => !Number.isFinite(Number(value))) ? 'Camera samples were missing or non-finite.' : null].filter(Boolean)
  const functionalFailure = consoleErrors.length > 0 || nonlocalRequests.length > 0 || webglVersion === 'UNAVAILABLE' || !reducedMotion || !keyboardClickParity || minimumCriticalFontPx < 11 || !criticalContentInViewport || cameraFindings.length > 0
  const performanceFailure = (stats?.fps ?? 0) < 24
  const report = {
    schemaVersion: '1.0.0',
    generatedAtUtc: new Date().toISOString(),
    activePresentationProfile: 'GUIDED_PROBE_3D',
    implementedProfiles: ['GUIDED_PROBE_3D'],
    documentedFallbacks: ['FIRST_PERSON_RAIL_3D', 'ORTHOGRAPHIC_2_5D', 'TOP_DOWN_VECTOR_2D'],
    staticBuildBytes: await bytes(new URL('../PRINCIPAL_PREVIEW/static-build/', import.meta.url)),
    webglVersion,
    representativeSample: stats,
    performanceInterpretation: 'Rolling 120-frame high-effects sample after an eight-second warm-up in automated headless Chromium; Principal review hardware remains the final decision environment.',
    openingCameraResponseInsideTenSeconds: openingResponsive,
    openingCameraSamples: { before: cameraBefore, after: cameraAfter },
    cameraClippingOrientationFindings: cameraFindings,
    keyboardClickParity: keyboardClickParity ? 'PASS' : 'FAIL',
    heldTravelPausesOnRelease,
    reducedMotion: reducedMotion ? 'PASS' : 'FAIL',
    readability1080p: { result: minimumCriticalFontPx >= 11 && criticalContentInViewport ? 'PASS' : 'FAIL', minimumObservedCriticalFontPx: minimumCriticalFontPx, criticalContentInViewport, measuredElements: criticalReadability.length, viewport: '1920x1080' },
    screenshots: (await readdir(new URL('../PRINCIPAL_PREVIEW/screenshots/', import.meta.url))).filter((name) => name.endsWith('.png')).length,
    ordinaryPlayNonlocalRequests: nonlocalRequests.length,
    consoleErrors,
    recommendation: functionalFailure || performanceFailure ? 'RED' : 'GREEN',
  }
  await writeFile(new URL('../PRINCIPAL_PREVIEW/PRESENTATION_HEALTH_REPORT.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  await browser.close()
  if (report.recommendation === 'RED') process.exitCode = 1
} finally {
  server.kill('SIGTERM')
}
