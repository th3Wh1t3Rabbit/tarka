import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { progressionChain } from '../fixtures/s2/domain-helpers'

type Input = 'mouse' | 'keyboard' | 'touch'
type AudioProbe = { instances: Array<{ src: string; loop: boolean; volume: number; muted: boolean; currentTime: number; playCalls: number; pauseCalls: number }> }
const evidenceDir = resolve('artifacts/s15-r1/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })
test.use({ trace: 'on' })

async function auditShot(page: Page, testInfo: TestInfo, id: string, route: string) {
  if (process.env.S15_R3_EVIDENCE !== '1') return
  const root = resolve('review/s15-r3'); const dir = resolve(root, 'SCREENSHOTS'); mkdirSync(dir, { recursive: true })
  const artifactPath = `SCREENSHOTS/terminal-${id}.png`
  await page.screenshot({ path: resolve(root, artifactPath), fullPage: true })
  appendFileSync(resolve(root, 'evidence-ownership.ndjson'), `${JSON.stringify({ artifactPath, generatingTestId: testInfo.title, ordinaryUrlAndQuery: '/', stateActionRoute: route, capturedTimestamp: new Date().toISOString(), candidateCommit: process.env.S15_R3_CANDIDATE_COMMIT, candidateTree: process.env.S15_R3_CANDIDATE_TREE, sourceTestPath: 'tests/e2e/s15-r1-production-journeys.spec.ts' })}\n`)
}

async function installAudioProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: AudioProbe = { instances: [] }
    class ProbedAudio extends EventTarget {
      src: string; loop = false; volume = 1; muted = false; preload = ''; currentTime = 0; playCalls = 0; pauseCalls = 0
      constructor(src = '') { super(); this.src = src; probe.instances.push(this) }
      async play() { this.playCalls += 1; this.dispatchEvent(new Event('play')) }
      pause() { this.pauseCalls += 1; this.dispatchEvent(new Event('pause')) }
    }
    Object.defineProperty(window, '__S15_R1_AUDIO__', { value: probe })
    Object.defineProperty(window, 'Audio', { value: ProbedAudio, configurable: true })
  })
}

async function blockExternalNetwork(page: Page) {
  const external: string[] = []
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await page.context().routeWebSocket('**/*', socket => socket.close())
  return external
}

async function act(page: Page, locator: Locator, input: Input) {
  await expect(locator).toBeVisible()
  if (input === 'touch') return locator.tap()
  if (input === 'mouse') return locator.click()
  await locator.focus()
  await expect(locator).toBeFocused()
  await page.keyboard.press('Enter')
}

async function drainWorld(page: Page, input: Input) {
  let quiet = 0
  for (let guard = 0; guard < 240 && quiet < 3; guard += 1) {
    const speech = page.getByTestId('speech-panel')
    if (await speech.count()) {
      const catchSurface = page.getByTestId('talk-advance-catch')
      const pointerTarget = await catchSurface.count() ? catchSurface : speech
      if (input === 'touch') await pointerTarget.tap()
      else if (input === 'mouse') await pointerTarget.click()
      else await page.keyboard.press('Space')
      quiet = 0
    } else {
      // The completed-case return now plays in the real office and then
      // intentionally unmounts that scene for the ending fade. Do not make a
      // missing Rook locator wait for the remainder of a marathon test.
      const shell = page.getByTestId('a0-shell')
      const opening = await shell.count() > 0 && await shell.getAttribute('data-intro-complete') === 'false'
      const rook = page.getByTestId('rook-sprite')
      const walking = await rook.count() > 0 && await rook.getAttribute('data-animation') === 'walkEast'
      if (opening || await page.getByTestId('active-sequence').count() || walking) quiet = 0
      else quiet += 1
    }
    await page.waitForTimeout(100)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
}

async function beginFromTitle(page: Page, input: Input, testInfo: TestInfo, captureTitle = false) {
  await installAudioProbe(page)
  const external = await blockExternalNetwork(page)
  await page.goto('/')
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/$/)
  await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
  if (captureTitle) await page.screenshot({ path: resolve(evidenceDir, `${testInfo.title.replaceAll(' ', '-')}-title-before-play.png`) })
  await act(page, page.getByRole('button', { name: 'PLAY', exact: true }), input)
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  if (input === 'touch') await page.getByTestId('mobile-playback-toggle').tap()
  await expect(page.getByTestId('background-music-control')).toBeVisible()
  const probe = await page.evaluate(() => (window as typeof window & { __S15_R1_AUDIO__: AudioProbe }).__S15_R1_AUDIO__)
  expect(probe.instances).toHaveLength(1)
  expect(probe.instances[0]).toMatchObject({ src: '/audio/background-main.ogg', loop: true, volume: 0.22, playCalls: 1 })
  await drainWorld(page, input)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'true')
  return external
}

async function authorize(page: Page, input: Input) {
  for (const [verb, hotspot, item, item2, , phase] of progressionChain) {
    await act(page, page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`), input)
    if (item) await act(page, page.getByTestId(`inventory-${item}`), input)
    if (hotspot) await act(page, page.getByTestId(`hotspot-${hotspot}`), input)
    else if (item2) await act(page, page.getByTestId(`inventory-${item2}`), input)
    if (phase === 'COMPLETE') {
      await drainWorld(page, input)
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
    } else {
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
      await drainWorld(page, input)
    }
  }
}

async function collectCaseFile(page: Page, input: Input) {
  await act(page, page.getByTestId('verb-open'), input)
  await act(page, page.getByTestId('hotspot-official-case-file-cabinet'), input)
  await drainWorld(page, input)
  await act(page, page.getByTestId('verb-pick-up'), input)
  await act(page, page.getByTestId('hotspot-disorderly-stack-of-confidential-files'), input)
  await drainWorld(page, input)
  await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible()
}

async function unlockBrcg(page: Page, input: Input) {
  await act(page, page.getByTestId('verb-open'), input)
  await act(page, page.getByTestId('hotspot-miscellaneous-drawer-cabinet'), input)
  await drainWorld(page, input)
  await act(page, page.getByTestId('verb-pick-up'), input)
  await act(page, page.getByTestId('hotspot-miscellaneous-catch-all-contents'), input)
  await drainWorld(page, input)
  await act(page, page.getByTestId('verb-open'), input)
  await act(page, page.getByTestId('inventory-small-toolbox-closed'), input)
  await drainWorld(page, input)
  await act(page, page.getByTestId('verb-use'), input)
  await act(page, page.getByTestId('inventory-hammer'), input)
  await act(page, page.getByTestId('inventory-piggy-bank-intact'), input)
  await drainWorld(page, input)
  await act(page, page.getByTestId('verb-look-at'), input)
  await act(page, page.getByTestId('inventory-fictional-token-note'), input)
  await drainWorld(page, input)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-note-read', 'BACK_READ')
}

async function enterTerminal(page: Page, input: Input) {
  await act(page, page.getByTestId('verb-use'), input)
  await act(page, page.getByTestId('hotspot-nansen-terminal'), input)
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('background-music-control')).toBeVisible()
}

async function section(page: Page, name: 'CASE' | 'RESULTS' | 'EXPLORE' | 'LEDGER', input: Input) {
  const testId = name === 'LEDGER' ? 'terminal-section-history' : `terminal-section-${name.toLowerCase()}`
  if (await page.getByTestId('case-terminal').getAttribute('data-section') !== name) await act(page, page.getByTestId(testId), input)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', name)
}

async function dispatchQuestions(page: Page, input: Input, testInfo?: TestInfo) {
  await section(page, 'CASE', input)
  await act(page, page.getByRole('button', { name: 'BUILD QUERY', exact: true }), input)
  const receipt = page.getByTestId('pre-dispatch-query-receipt')
  await expect(receipt).toBeVisible()
  if (testInfo) await auditShot(page, testInfo, 'query-1-receipt', 'CASE → token-and-amount Query Receipt')
  await act(page, page.getByRole('button', { name: 'RUN QUERY', exact: true }), input)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
  if (testInfo) await auditShot(page, testInfo, 'query-1-results', '98 → 74 → 3 CASE summary')
  await act(page, page.getByRole('button', { name: 'VIEW 3 MATCHES' }), input)
  await act(page, page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER' }), input)
  await act(page, page.getByRole('button', { name: 'SAVE TO CASE' }), input)
  await act(page, page.getByRole('button', { name: 'NEXT', exact: true }), input)
  await act(page, page.getByRole('button', { name: 'SAVE TO CASE' }), input)
  await section(page, 'CASE', input)
  await act(page, page.getByRole('button', { name: 'BUILD CONNECTION QUERY', exact: true }), input)
  await expect(receipt).toBeVisible()
  if (testInfo) await auditShot(page, testInfo, 'query-2-receipt', 'CASE → exact-link Query Receipt')
  await act(page, page.getByRole('button', { name: 'RUN QUERY', exact: true }), input)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
  if (testInfo) await auditShot(page, testInfo, 'query-2-results', '3 → 2 → 1 CASE summary')
  await act(page, page.getByRole('button', { name: 'OPEN TRANSACTION' }), input)
}

async function completeProof(page: Page, input: Input, testInfo?: TestInfo) {
  if (testInfo) await auditShot(page, testInfo, 'source-before-exact-verification', 'RESULTS → inspect SOURCE before verification')
  if (!await page.getByRole('button', { name: 'CONFIRM CONNECTION' }).count()) {
    await act(page, page.getByRole('button', { name: 'OPEN TRANSACTION', exact: true }), input)
  }
  await act(page, page.getByRole('button', { name: 'CONFIRM CONNECTION' }), input)
  if (testInfo) await auditShot(page, testInfo, 'source-after-exact-verification', 'SOURCE → verify exact receipt')
  await act(page, page.getByRole('button', { name: 'SAVE CASE' }), input)
  await expect(page.getByRole('dialog', { name: 'CLOSE THE EULER CASE?' })).toContainText(/THE FIRST TRAIL JOINED\s*THE SECOND ROUTE\./i)
  if (testInfo) await auditShot(page, testInfo, 'proof-ready-caseboard', 'CASE → file AMOUNT / RECEIVER / LINK → proof ready')
}

async function assertEndingBlackoutAndComplete(page: Page, input: Input, testInfo: TestInfo, cancelFirst = false) {
  const audioBeforeClose = await page.evaluate(() => (window as typeof window & { __S15_R1_AUDIO__: AudioProbe }).__S15_R1_AUDIO__)
  const terminalPausesBeforeClose = audioBeforeClose.instances[1]?.pauseCalls ?? 0
  const confirmation = page.getByRole('dialog', { name: 'CLOSE THE EULER CASE?' })
  await expect(confirmation).toBeVisible()
  if (cancelFirst) {
    await act(page, page.getByRole('button', { name: 'KEEP INVESTIGATING' }), input)
    await act(page, page.getByRole('button', { name: 'CLOSE CASE', exact: true }), input)
  }
  await act(page, confirmation.getByRole('button', { name: 'CLOSE CASE' }), input)
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await expect(page.getByTestId('rook-sprite')).toBeVisible()
  await expect(page.getByTestId('mr-index-sprite')).toBeVisible()
  await expect(page.getByTestId('speech-panel')).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, `${testInfo.title.replaceAll(' ', '-')}-blocking-ending-no-music-control.png`) })
  await drainWorld(page, input)
  const during = await page.evaluate(() => (window as typeof window & { __S15_R1_AUDIO__: AudioProbe }).__S15_R1_AUDIO__)
  expect(during.instances).toHaveLength(3)
  expect(during.instances[1]!.playCalls).toBeGreaterThan(0)
  expect(during.instances[1]!.pauseCalls).toBeGreaterThan(terminalPausesBeforeClose)
  expect(during.instances[2]).toMatchObject({ src: '/audio/case-closed.ogg', loop: true, pauseCalls: 0 })
  expect(during.instances[2]!.playCalls).toBeGreaterThan(0)
  await expect(page.getByTestId('s14-completion-screen')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('background-music-control')).toBeVisible()
  const after = await page.evaluate(() => (window as typeof window & { __S15_R1_AUDIO__: AudioProbe }).__S15_R1_AUDIO__)
  expect(after.instances).toHaveLength(3)
  expect(after.instances[1]!.pauseCalls).toBeGreaterThan(terminalPausesBeforeClose)
  expect(after.instances[2]).toMatchObject({ src: '/audio/case-closed.ogg', loop: true, pauseCalls: 0 })
}

test('DIRECT SOLVER ordinary pointer journey reaches persistent completion', async ({ page }, testInfo) => {
  test.setTimeout(360_000)
  const external = await beginFromTitle(page, 'mouse', testInfo, true)
  await page.screenshot({ path: resolve(evidenceDir, 'direct-solver-room-music-control.png') })
  await authorize(page, 'mouse')
  await enterTerminal(page, 'mouse')
  await auditShot(page, testInfo, 'authorized-before-euler-file', 'authorization complete → terminal before Euler file')
  await act(page, page.getByRole('button', { name: 'RETURN TO OFFICE' }), 'mouse')
  await collectCaseFile(page, 'mouse')
  await enterTerminal(page, 'mouse')
  await auditShot(page, testInfo, 'first-case-after-euler-file', 'collect Euler file → terminal CASE')
  await page.screenshot({ path: resolve(evidenceDir, 'direct-solver-case-terminal.png') })
  await section(page, 'EXPLORE', 'mouse'); await auditShot(page, testInfo, 'explore-before-dispatch', 'Euler CASE → EXPLORE before dispatch'); await section(page, 'CASE', 'mouse')
  await dispatchQuestions(page, 'mouse', testInfo)
  await section(page, 'EXPLORE', 'mouse'); await auditShot(page, testInfo, 'explore-after-dispatch', 'three dispatches → EXPLORE'); await section(page, 'LEDGER', 'mouse'); await auditShot(page, testInfo, 'ledger-call-atlas', 'three dispatches → LEDGER / Call Atlas'); await section(page, 'RESULTS', 'mouse')
  await completeProof(page, 'mouse', testInfo)
  await assertEndingBlackoutAndComplete(page, 'mouse', testInfo)
  await page.screenshot({ path: resolve(evidenceDir, 'direct-solver-completion-music-restored.png') })
  expect(external).toEqual([])
})

test('CURIOUS EXPLORER keyboard-only journey covers exploration, BRCG, Credits, and fresh reset', async ({ page }, testInfo) => {
  test.setTimeout(420_000)
  const external = await beginFromTitle(page, 'keyboard', testInfo)
  await act(page, page.getByTestId('verb-push'), 'keyboard')
  await act(page, page.getByTestId('hotspot-office-globe'), 'keyboard')
  await drainWorld(page, 'keyboard')
  await authorize(page, 'keyboard')
  await act(page, page.getByTestId('verb-talk-to'), 'keyboard')
  await act(page, page.getByTestId('hotspot-mr-index'), 'keyboard')
  await act(page, page.getByTestId('dialogue-case-file'), 'keyboard')
  await drainWorld(page, 'keyboard')
  await act(page, page.getByTestId('dialogue-leave'), 'keyboard')
  await drainWorld(page, 'keyboard')
  await collectCaseFile(page, 'keyboard')
  await act(page, page.getByTestId('verb-look-at'), 'keyboard')
  await act(page, page.getByTestId('inventory-euler-case-file'), 'keyboard')
  await drainWorld(page, 'keyboard')
  await unlockBrcg(page, 'keyboard')
  await enterTerminal(page, 'keyboard')
  for (const name of ['CASE', 'EXPLORE'] as const) await section(page, name, 'keyboard')
  for (const name of ['results', 'source', 'history'] as const) await expect(page.getByTestId(`terminal-section-${name}`)).toHaveCount(0)
  await section(page, 'EXPLORE', 'keyboard')
  await act(page, page.getByRole('button', { name: /OFFICE-NOTE TOKEN LEAD/ }), 'keyboard')
  await act(page, page.getByRole('button', { name: 'IDENTIFY BRCG' }), 'keyboard')
  await act(page, page.getByRole('button', { name: 'WHAT DOES THIS MEAN? →' }), 'keyboard')
  await act(page, page.getByRole('button', { name: 'FILE BRCG FINDING' }), 'keyboard')
  await expect(page.getByTestId('s16-screen-body')).toContainText('one cheap lunch...not a fortune')
  await auditShot(page, testInfo, 'brcg-optional-branch', 'EXPLORE → identify and review BRCG branch')
  await dispatchQuestions(page, 'keyboard')
  await completeProof(page, 'keyboard')
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await expect(page.getByTestId('case-terminal')).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, 'curious-explorer-200-percent-zoom.png') })
  await page.evaluate(() => { document.documentElement.style.zoom = '1' })
  await assertEndingBlackoutAndComplete(page, 'keyboard', testInfo)
  await act(page, page.getByRole('button', { name: 'CREDITS', exact: true }), 'keyboard')
  await expect(page.getByTestId('tarka-credits-screen')).toBeVisible()
  await act(page, page.getByRole('button', { name: '[ RETURN ]' }), 'keyboard')
  await act(page, page.getByRole('button', { name: '[ PLAY AGAIN ]' }), 'keyboard')
  await act(page, page.getByRole('button', { name: '[ START OVER ]' }), 'keyboard')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
  expect(external).toEqual([])
})

test.describe('real touch production journey', () => {
  test.use({ hasTouch: true })
  test('MISTAKEN INVESTIGATOR recovers from mistakes and returns to Main Menu', async ({ page }, testInfo) => {
    test.setTimeout(420_000)
    const external = await beginFromTitle(page, 'touch', testInfo)
    await act(page, page.getByTestId('verb-open'), 'touch')
    await act(page, page.getByTestId('hotspot-official-case-file-cabinet'), 'touch')
    await drainWorld(page, 'touch')
    await authorize(page, 'touch')
    await act(page, page.getByTestId('verb-give'), 'touch')
    await act(page, page.getByTestId('inventory-approved-stamped-terminal-authorization-form'), 'touch')
    await act(page, page.getByTestId('hotspot-mr-index'), 'touch')
    await drainWorld(page, 'touch')
    await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toBeVisible()
    await collectCaseFile(page, 'touch')
    await enterTerminal(page, 'touch')
    await dispatchQuestions(page, 'touch', testInfo)
    await completeProof(page, 'touch', testInfo)
    await assertEndingBlackoutAndComplete(page, 'touch', testInfo, true)
    await act(page, page.getByRole('button', { name: 'MAIN MENU' }), 'touch')
    await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
    const probe = await page.evaluate(() => (window as typeof window & { __S15_R1_AUDIO__: AudioProbe }).__S15_R1_AUDIO__)
    expect(probe.instances).toHaveLength(3)
    expect(probe.instances[0]!.pauseCalls).toBeGreaterThan(0)
    expect(probe.instances[0]!.currentTime).toBe(0)
    expect(probe.instances[1]!.currentTime).toBe(0)
    expect(probe.instances[2]).toMatchObject({ src: '/audio/case-closed.ogg', currentTime: 0 })
    expect(probe.instances[2]!.pauseCalls).toBeGreaterThan(0)
    expect(external).toEqual([])
  })
})
