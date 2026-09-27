import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

const evidenceRoot = resolve('review/s15-r9')
const screenshots = resolve(evidenceRoot, 'SCREENSHOTS')
const observations = resolve(evidenceRoot, 'RECEIPTS/BROWSER_OBSERVATIONS.ndjson')

function writeReceipt(name: string, value: unknown) {
  if (process.env.S15_R9_EVIDENCE !== '1') return
  mkdirSync(resolve(evidenceRoot, 'RECEIPTS'), { recursive: true })
  writeFileSync(resolve(evidenceRoot, `RECEIPTS/${name}`), `${JSON.stringify(value, null, 2)}\n`)
}

async function start(page: Page, phase = 'START') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption(phase)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
}

async function act(page: Page, verb: string, target: string, item?: string) {
  await page.getByTestId(`verb-${verb}`).click()
  if (item) await page.getByTestId(`inventory-${item}`).click()
  await page.getByTestId(`hotspot-${target}`).click({ force: true })
}

async function settleSequence(page: Page) {
  await expect(page.getByTestId('active-sequence')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 15_000 })
}

async function drainSpeech(page: Page) {
  for (let guard = 0; guard < 120 && await page.getByTestId('speech-panel').count(); guard += 1) {
    await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(15)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
}

async function capture(page: Page, info: TestInfo, id: string, route: string) {
  if (process.env.S15_R9_EVIDENCE !== '1') return
  mkdirSync(screenshots, { recursive: true })
  mkdirSync(resolve(evidenceRoot, 'RECEIPTS'), { recursive: true })
  const state = await page.evaluate(() => {
    const node = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const attr = (id: string, name: string) => node(id)?.getAttribute(name) ?? null
    return {
      phase: attr('a0-shell', 'data-phase'), interfaceTreatment: attr('a0-shell', 'data-interface-treatment'),
      globe: { level: attr('a0-shell', 'data-globe-level'), pose: attr('a0-shell', 'data-globe-pose'), motion: attr('a0-shell', 'data-globe-motion'), elapsed: attr('a0-shell', 'data-globe-elapsed'), revision: attr('a0-shell', 'data-globe-revision'), startPhase: attr('a0-shell', 'data-globe-start-phase'), phase: attr('a0-shell', 'data-globe-phase'), surface: attr('a0-shell', 'data-globe-surface'), decay: attr('a0-shell', 'data-globe-decay'), source: attr('a0-shell', 'data-globe-source') },
      rook: { cue: attr('rook-sprite', 'data-cue'), facing: attr('rook-sprite', 'data-facing'), nativeFacing: attr('rook-sprite', 'data-native-facing'), mirrored: attr('rook-sprite', 'data-mirrored'), source: attr('rook-animation', 'data-requested-src') },
      arthur: { cue: attr('mr-index-sprite', 'data-cue'), facing: attr('mr-index-sprite', 'data-facing'), nativeFacing: attr('mr-index-sprite', 'data-native-facing'), mirrored: attr('mr-index-sprite', 'data-mirrored'), source: attr('mr-index-animation', 'data-requested-src') },
      contact: attr('active-sequence', 'data-contact'), pose: attr('active-sequence', 'data-physical-pose'),
      terminal: { powered: attr('records-office', 'data-terminal-powered'), authorized: attr('records-office', 'data-terminal-authorized'), canOpen: attr('records-office', 'data-terminal-can-open') },
    }
  })
  await page.screenshot({ path: resolve(screenshots, `${id}.png`), fullPage: true })
  appendFileSync(observations, `${JSON.stringify({ schema: 'tarka.s15-r9.browser-observation.v1', id, generatingTestId: info.title, sourceTestPath: 'tests/e2e/s15-r9-reconciliation.spec.ts', ordinaryUrlAndQuery: page.url(), route, ...state })}\n`)
}

test('R9-B01 opening paper is put away before Arthur owns opening speech', async ({ page }, info) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  const animation = page.getByTestId('mr-index-animation')
  await expect(animation).toHaveAttribute('data-animation-frames', '1')
  await expect(animation).toHaveAttribute('data-requested-src', /archivist_document_hold\.png$/)
  const paperSeries = [{ owner: 'PRE_ENTRY', frames: await animation.getAttribute('data-animation-frames'), source: await animation.getAttribute('data-requested-src') }]
  await capture(page, info, 'opening-paper-closed', 'PLAY → pre-entry hold → one closed-document frame')
  await expect(page.getByTestId('speech-panel')).toBeVisible({ timeout: 10_000 })
  while (await page.getByTestId('speech-panel').getAttribute('data-speaker') !== 'MR_INDEX') {
    await page.getByTestId('talk-advance-catch').click()
    await page.getByTestId('talk-advance-catch').click()
  }
  await expect(animation).toHaveAttribute('data-animation-frames', '2')
  await expect.poll(async () => animation.getAttribute('data-requested-src')).toMatch(/archivist_talk_(open|closed)\.png$/)
  paperSeries.push({ owner: 'MR_INDEX_SPEECH_PAPER_PUT_AWAY', frames: await animation.getAttribute('data-animation-frames'), source: await animation.getAttribute('data-requested-src') })
  writeReceipt('OPENING_PAPER_FRAME_SERIES.json', { schema: 'tarka.s15-r9.opening-paper-frame-series.v1', generatingTestId: info.title, samples: paperSeries })
  await capture(page, info, 'opening-paper-arthur-speech', 'PLAY → closed document through entry/Rook speech → Arthur owns speech → document family plays')
})

test('R9-B02 globe USE uses the neutral reach family at real contact', async ({ page }, info) => {
  await start(page)
  await act(page, 'use', 'office-globe')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-contact', 'CONTACT.GLOBE.PUSH', { timeout: 10_000 })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-cue', 'rook.reach.neutral')
  await expect(page.getByTestId('rook-animation')).toHaveAttribute('data-requested-src', /rook_use_reach\.png$/)
  await capture(page, info, 'globe-neutral-reach-contact', 'START → USE globe → neutral contact → L1 PUSH')
})

test('R9-B03 globe L1 runs while controls stay fully active', async ({ page }, info) => {
  await start(page)
  await act(page, 'push', 'office-globe')
  await settleSequence(page)
  const shell = page.getByTestId('a0-shell')
  await expect(shell).toHaveAttribute('data-globe-level', '1')
  await expect(shell).toHaveAttribute('data-globe-pose', 'PUSH')
  await expect(shell).toHaveAttribute('data-globe-motion', 'SPINNING')
  await expect(shell).toHaveAttribute('data-interface-treatment', 'ACTIVE')
  await expect(page.getByTestId('verb-pull')).toBeEnabled()
  await capture(page, info, 'globe-l1-controls-active', 'START → PUSH globe → contact settles → finite globe continues under ACTIVE controls')
})

test('R9-B04 same-direction globe touch promotes L1 to L2 inside 5000ms', async ({ page }, info) => {
  await start(page)
  await act(page, 'push', 'office-globe'); await settleSequence(page)
  await act(page, 'push', 'office-globe'); await settleSequence(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-level', '2')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-window', /^(?!0$)/)
  await capture(page, info, 'globe-l2-promoted', 'PUSH globe L1 → same-direction touch inside 5000ms → L2')
})

test('R9-B05 same-direction L3 touch does not reset, restart, or extend', async ({ page }, info) => {
  await start(page)
  for (let index = 0; index < 3; index += 1) { await act(page, 'push', 'office-globe'); await settleSequence(page) }
  const shell = page.getByTestId('a0-shell')
  await expect(shell).toHaveAttribute('data-globe-level', '3')
  const before = { revision: Number(await shell.getAttribute('data-globe-revision')), elapsed: Number(await shell.getAttribute('data-globe-elapsed')), start: await shell.getAttribute('data-globe-start-phase') }
  await act(page, 'push', 'office-globe'); await settleSequence(page)
  const after = { revision: Number(await shell.getAttribute('data-globe-revision')), elapsed: Number(await shell.getAttribute('data-globe-elapsed')), start: await shell.getAttribute('data-globe-start-phase') }
  expect(after.revision).toBe(before.revision)
  expect(after.elapsed).toBeGreaterThanOrEqual(before.elapsed)
  expect(after.start).toBe(before.start)
  await capture(page, info, 'globe-l3-no-reset', 'L3 PUSH → same-direction touch → unchanged revision/start with naturally advancing elapsed')
})

test('R9-B06 reverse touch preserves phase and returns the surface to sharp in the same handler', async ({ page }, info) => {
  await start(page)
  for (let index = 0; index < 3; index += 1) { await act(page, 'push', 'office-globe'); await settleSequence(page) }
  await page.waitForTimeout(400)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-level', '3')
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[data-testid="a0-shell"]')!
    const originalRevision = shell.dataset.globeRevision
    ;(window as unknown as { __r9Reverse?: Record<string, string | undefined> }).__r9Reverse = {}
    const observer = new MutationObserver(() => {
      if (shell.dataset.globeRevision !== originalRevision) {
        ;(window as unknown as { __r9Reverse?: Record<string, string | undefined> }).__r9Reverse = { start: shell.dataset.globeStartPhase, phase: shell.dataset.globePhase, surface: shell.dataset.globeSurface, level: shell.dataset.globeLevel, pose: shell.dataset.globePose }
        observer.disconnect()
      }
    })
    observer.observe(shell, { attributes: true })
  })
  await act(page, 'pull', 'office-globe')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __r9Reverse?: Record<string, string> }).__r9Reverse?.pose)).toBe('PULL')
  const receipt = await page.evaluate(() => (window as unknown as { __r9Reverse?: Record<string, string> }).__r9Reverse!)
  expect(receipt).toMatchObject({ level: '1', pose: 'PULL', surface: 'sharp' })
  expect(receipt.start).toBe(receipt.phase)
  await capture(page, info, 'globe-reverse-same-handler', 'active L3 PUSH → PULL contact → phase-preserved sharp L1 reversal in same commit')
})

test('R9-B07 globe plays the complete 9760ms schedule and holds the natural final angle', async ({ page }, info) => {
  await start(page)
  await act(page, 'pull', 'office-globe'); await settleSequence(page)
  const shell = page.getByTestId('a0-shell')
  const samples: Array<Record<string, string | null>> = []
  for (let guard = 0; guard < 80; guard += 1) {
    samples.push(await shell.evaluate(element => ({
      elapsed: element.getAttribute('data-globe-elapsed'),
      phase: element.getAttribute('data-globe-phase'),
      surface: element.getAttribute('data-globe-surface'),
      decay: element.getAttribute('data-globe-decay'),
      source: element.getAttribute('data-globe-source'),
      motion: element.getAttribute('data-globe-motion'),
    })))
    if (samples.at(-1)?.motion === 'FINAL_HOLD') break
    await page.waitForTimeout(175)
  }
  await expect(shell).toHaveAttribute('data-globe-motion', 'FINAL_HOLD', { timeout: 20_000 })
  await expect(shell).toHaveAttribute('data-globe-level', '1')
  await expect(shell).toHaveAttribute('data-globe-phase', '12')
  await expect(shell).toHaveAttribute('data-globe-decay', 'FINAL_HOLD')
  await expect(shell).toHaveAttribute('data-globe-surface', 'sharp')
  writeReceipt('GLOBE_L1_SLOWDOWN_FRAME_SERIES.json', { schema: 'tarka.s15-r9.globe-frame-series.v1', generatingTestId: info.title, expectedTotalMs: 9760, samples })
  await capture(page, info, 'globe-natural-final-hold', 'PULL globe → full 9760ms L1 schedule → natural half-turn final hold')
})

test('R9-B08 form pickup is a neutral reach and never an effort pose', async ({ page }, info) => {
  await start(page)
  await act(page, 'pick-up', 'blank-authorization-form')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-contact', 'CONTACT.ITEM.take-form', { timeout: 10_000 })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-cue', 'rook.reach.neutral')
  await expect(page.getByTestId('rook-animation')).toHaveAttribute('data-requested-src', /rook_use_reach\.png$/)
  await capture(page, info, 'form-neutral-reach', 'START → PICK UP form → neutral reach contact')
})

test('R9-B09 cabinet close is a neutral reach and never an effort pose', async ({ page }, info) => {
  await start(page, 'COMPLETE')
  await act(page, 'open', 'official-case-file-cabinet'); await settleSequence(page)
  await act(page, 'close', 'official-case-file-cabinet')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-contact', 'CONTACT.DRAWER.CASE.CLOSED', { timeout: 10_000 })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-cue', 'rook.reach.neutral')
  await expect(page.getByTestId('rook-animation')).toHaveAttribute('data-requested-src', /rook_use_reach\.png$/)
  await capture(page, info, 'cabinet-close-neutral-reach', 'COMPLETE → OPEN case drawer → CLOSE → neutral reach contact')
})

test('R9-B10 terminal is OFF before return and ON exactly when approved form returns', async ({ page }, info) => {
  await start(page, 'FORM_COMPLETED')
  const scene = page.getByTestId('records-office')
  await expect(scene).toHaveAttribute('data-terminal-powered', 'false')
  await capture(page, info, 'terminal-power-off-before-return', 'FORM_COMPLETED → approved return has not occurred → terminal remains OFF')
  await act(page, 'give', 'mr-index', 'signed-terminal-authorization-form-with-doodles')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-stage', 'FORM_REVIEW', { timeout: 12_000 })
  await expect(scene).toHaveAttribute('data-terminal-powered', 'false')
  await drainSpeech(page)
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-contact', 'CONTACT.FORM_RETURN', { timeout: 10_000 })
  await expect(scene).toHaveAttribute('data-terminal-powered', 'false')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-contact', 'CONTACT.FORM_STAMP', { timeout: 10_000 })
  await expect(scene).toHaveAttribute('data-terminal-authorized', 'true')
  await expect(scene).toHaveAttribute('data-terminal-powered', 'true')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-stage', 'POST_STAMP_AUTHORIZATION', { timeout: 10_000 })
  await drainSpeech(page)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 10_000 })
  await expect(scene).toHaveAttribute('data-terminal-powered', 'true')
  await expect(scene).toHaveAttribute('data-terminal-can-open', 'true')
  await capture(page, info, 'terminal-power-return-contact', 'FORM_COMPLETED → review → stamp remains OFF → CONTACT.FORM_RETURN turns ON once')
})

test('R9-B11 cabinet reprimand pixels face Arthur right and Rook left through Rook reply', async ({ page }, info) => {
  await start(page)
  await act(page, 'open', 'official-case-file-cabinet')
  const arthur = page.getByTestId('mr-index-sprite')
  const rook = page.getByTestId('rook-sprite')
  await expect(arthur).toHaveAttribute('data-cue', 'arthur.point', { timeout: 12_000 })
  await expect(arthur).toHaveAttribute('data-facing', 'RIGHT')
  await expect(arthur).toHaveAttribute('data-native-facing', 'LEFT')
  await expect(arthur).toHaveAttribute('data-mirrored', 'true')
  await expect(rook).toHaveAttribute('data-facing', 'LEFT')
  await expect(rook).toHaveAttribute('data-native-facing', 'RIGHT')
  await expect(rook).toHaveAttribute('data-mirrored', 'true')
  for (let guard = 0; guard < 30 && await page.getByTestId('speech-panel').getAttribute('data-speaker') !== 'ROOK'; guard += 1) await page.getByTestId('talk-advance-catch').click()
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-speaker', 'ROOK')
  await expect(arthur).toHaveAttribute('data-cue', 'arthur.point')
  await capture(page, info, 'cabinet-point-facing-hold', 'OPEN locked cabinet → Arthur points screen-right → Rook screen-left reply → point remains held')
})

test('R9-B12 terminal reprimand uses the same truthful facing and point ownership', async ({ page }, info) => {
  await start(page)
  await act(page, 'use', 'nansen-terminal')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-sequence', 'SEQUENCE.TERMINAL_REPRIMAND', { timeout: 12_000 })
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-cue', 'arthur.point')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'RIGHT')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-mirrored', 'true')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-facing', 'LEFT')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-mirrored', 'true')
  await capture(page, info, 'terminal-point-facing', 'START terminal OFF → USE → Arthur screen-right point / Rook screen-left reprimand')
})

test('R9-B13 TALK TO Arthur topics mutually face for the exchange', async ({ page }, info) => {
  await start(page)
  await act(page, 'talk-to', 'mr-index')
  await expect(page.getByTestId('dialogue-panel')).toBeVisible({ timeout: 12_000 })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-facing', 'RIGHT')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'LEFT')
  await page.getByTestId('dialogue-form-reminder').click()
  await expect(page.getByTestId('speech-panel')).toBeVisible()
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-facing', 'RIGHT')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'LEFT')
  await capture(page, info, 'talk-to-mutual-facing', 'TALK TO Arthur → topic → full character exchange mutual facing')
})

test('R9-B14 authorized returned-form state opens the terminal and emits no external traffic', async ({ page }, info) => {
  const external: string[] = []
  page.on('request', request => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url()) })
  await start(page, 'COMPLETE')
  await expect(page.getByTestId('records-office')).toHaveAttribute('data-terminal-powered', 'true')
  await act(page, 'use', 'nansen-terminal')
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 12_000 })
  expect(external).toEqual([])
  await capture(page, info, 'terminal-authorized-open', 'COMPLETE with returned approved form → USE terminal → real terminal route opens; network zero')
  if (process.env.S15_R9_EVIDENCE === '1') {
    mkdirSync(resolve(evidenceRoot, 'RECEIPTS'), { recursive: true })
    writeFileSync(resolve(evidenceRoot, 'RECEIPTS/TERMINAL_POWER_AUTHORITY_DELTA.json'), `${JSON.stringify({ schema: 'tarka.s15-r9.terminal-power-authority-delta.v1', supersedes: 'prior always-on presentation rule', offUntil: 'CONTACT.FORM_RETURN', powerSourceOfTruth: 'approved-stamped-terminal-authorization-form present in Rook inventory', preauthorization: 'OFF_AND_BLOCKED', postReturn: 'ON_AND_OPENABLE', generatingTestId: info.title }, null, 2)}\n`)
  }
})
