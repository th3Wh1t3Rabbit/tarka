import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

const evidenceRoot = resolve('review/s15-r7')
const screenshots = resolve(evidenceRoot, 'SCREENSHOTS')
const observations = resolve(evidenceRoot, 'RECEIPTS/BROWSER_STAGE_OBSERVATIONS.ndjson')

async function capture(page: Page, info: TestInfo, id: string, route: string) {
  if (process.env.S15_R7_EVIDENCE !== '1') return
  mkdirSync(screenshots, { recursive: true })
  mkdirSync(resolve(evidenceRoot, 'RECEIPTS'), { recursive: true })
  const state = await page.evaluate(() => {
    const node = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const attr = (id: string, name: string) => node(id)?.getAttribute(name) ?? null
    return {
      phase: attr('a0-shell', 'data-phase'), openingStage: attr('records-office', 'data-opening-stage'),
      interfaceTreatment: attr('a0-shell', 'data-interface-treatment'), talking: attr('a0-shell', 'data-talking'),
      actionId: attr('active-sequence', 'data-action-id'), sequenceStatus: attr('active-sequence', 'data-status'),
      selectedVerb: attr('active-sequence', 'data-selected-verb'), actorIntentions: attr('active-sequence', 'data-actor-intentions'),
      contact: attr('active-sequence', 'data-contact'), pose: attr('active-sequence', 'data-physical-pose'),
      paperOwner: attr('records-office', 'data-form-paper-owner'), deskStampOwner: attr('records-office', 'data-desk-stamp-owner'),
      paperOverlayCount: document.querySelectorAll('[data-testid="visible-form-paper"]').length,
      terminalPowered: attr('records-office', 'data-terminal-powered'), terminalAuthorized: attr('records-office', 'data-terminal-authorized'), terminalCanOpen: attr('records-office', 'data-terminal-can-open'),
    }
  })
  await page.screenshot({ path: resolve(screenshots, `${id}.png`), fullPage: true })
  appendFileSync(observations, `${JSON.stringify({ schema: 'tarka.s15-r7.browser-stage-observation.v1', screenshot: `SCREENSHOTS/${id}.png`, generatingTestId: info.title, sourceTestPath: 'tests/e2e/s15-r7-opening-dialogue-form-terminal.spec.ts', ordinaryUrlAndQuery: page.url(), stateActionRoute: route, ...state, capturedTimestamp: new Date().toISOString() })}\n`)
}

async function play(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
}

async function reviewState(page: Page, phase: string) {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption(phase)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
}

async function chooseDelivery(page: Page, testId: string) {
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId(testId).click()
}

async function drainStageSpeech(page: Page) {
  for (let guard = 0; guard < 120 && await page.getByTestId('speech-panel').count(); guard += 1) {
    await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(20)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
}

async function formStage(page: Page, id: string) {
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-action-id', id, { timeout: 12_000 })
}

async function observeSequenceReceipts(page: Page) {
  await page.evaluate(() => {
    type Receipt = { selectedVerb: string; actorIntentions: string; physicalPose: string; contact: string }
    const scope = window as unknown as { __s15r7SequenceReceipts?: Receipt[]; __s15r7SequenceObserver?: MutationObserver }
    scope.__s15r7SequenceObserver?.disconnect()
    scope.__s15r7SequenceReceipts = []
    const capture = () => {
      const sequence = document.querySelector<HTMLElement>('[data-testid="active-sequence"]')
      if (!sequence) return
      const receipt = { selectedVerb: sequence.dataset.selectedVerb ?? '', actorIntentions: sequence.dataset.actorIntentions ?? '', physicalPose: sequence.dataset.physicalPose ?? '', contact: sequence.dataset.contact ?? '' }
      if (!scope.__s15r7SequenceReceipts?.some(value => JSON.stringify(value) === JSON.stringify(receipt))) scope.__s15r7SequenceReceipts?.push(receipt)
    }
    const observer = new MutationObserver(capture)
    observer.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-selected-verb', 'data-actor-intentions', 'data-physical-pose', 'data-contact'] })
    scope.__s15r7SequenceObserver = observer
  })
}

test('S15-R7 ordinary opening is blacked out and inert through the final dialogue dismissal', async ({ page }, info) => {
  await play(page)
  const shell = page.getByTestId('a0-shell')
  const scene = page.getByTestId('records-office')
  await expect(scene).toHaveAttribute('data-opening-stage', 'ARTHUR_PAPER')
  await expect(shell).toHaveAttribute('data-interface-treatment', 'BLACKOUT')
  await expect(page.getByTestId('adventure-interface-band')).toHaveClass(/interface-blackout/)
  await expect(page.getByTestId('rook-sprite')).toHaveCount(0)
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-animation', 'document')
  await capture(page, info, 'opening-frame-zero-blackout', 'PLAY → first office frame → Arthur document hold + BLACKOUT')

  await page.keyboard.press('2')
  await expect(page.getByTestId('verb-pick-up')).toHaveAttribute('aria-pressed', 'false')
  await expect(scene).toHaveAttribute('data-lamp-power', 'ON')
  await expect(scene).toHaveAttribute('data-opening-stage', 'ROOK_ENTERING', { timeout: 5_000 })
  await page.getByTestId('hotspot-desk-lamp').click({ force: true })
  await expect(scene).toHaveAttribute('data-lamp-power', 'ON')
  await expect(shell).toHaveAttribute('data-interface-treatment', 'BLACKOUT')
  await capture(page, info, 'opening-entry-blackout-inert', 'Arthur paper → Rook entry → forced world input ignored')

  await chooseDelivery(page, 'dialogue-mode-manual')
  await expect(page.getByTestId('speech-panel')).toBeVisible({ timeout: 8_000 })
  let sameSpeakerTransition = false
  let changedSpeakerTransition = false
  for (let guard = 0; guard < 600 && await page.getByTestId('speech-panel').count(); guard += 1) {
    const panel = page.getByTestId('speech-panel')
    const speaker = await panel.getAttribute('data-speaker')
    await expect(panel).toHaveAttribute('data-revealing', 'false')
    await expect(page.getByTestId(speaker === 'ROOK' ? 'rook-sprite' : 'mr-index-sprite')).toHaveAttribute('data-talking', 'true')
    await page.getByTestId('talk-advance-catch').click()
    if (await page.getByTestId('speech-panel').count()) {
      await expect(shell).toHaveAttribute('data-interface-treatment', 'BLACKOUT')
      const next = await page.getByTestId('speech-panel').getAttribute('data-speaker')
      sameSpeakerTransition ||= next === speaker
      changedSpeakerTransition ||= next !== speaker
      await expect(page.getByTestId(next === 'ROOK' ? 'rook-sprite' : 'mr-index-sprite')).toHaveAttribute('data-talking', 'true')
    }
  }
  expect(sameSpeakerTransition).toBe(true)
  expect(changedSpeakerTransition).toBe(true)
  await expect(shell).toHaveAttribute('data-intro-complete', 'true')
  await expect(shell).toHaveAttribute('data-interface-treatment', 'ACTIVE')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-talking', 'false')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-talking', 'false')
  await capture(page, info, 'opening-final-dismissal-active', 'manual opening → same-speaker + changed-speaker turns → final dismissal → ACTIVE')
})

test('S15-R7 AUTO opening preserves the mouth owner after reveal and across a same-speaker bubble', async ({ page }, info) => {
  await play(page)
  await chooseDelivery(page, 'dialogue-pace-fast')
  await expect(page.getByTestId('speech-panel')).toBeVisible({ timeout: 8_000 })
  const series = await page.evaluate(() => new Promise<Array<Record<string, string | boolean | null>>>((resolve, reject) => {
    const rows: Array<Record<string, string | boolean | null>> = []
    let previousKey = ''
    let previousSpeaker: string | null = null
    let sawSame = false
    let sawRevealed = false
    const started = Date.now()
    const timer = window.setInterval(() => {
      const panel = document.querySelector<HTMLElement>('[data-testid="speech-panel"]')
      if (!panel) return
      const speaker = panel.dataset.speaker ?? null
      const lineIndex = panel.dataset.lineIndex ?? null
      const key = `${lineIndex}:${speaker}:${panel.dataset.revealing}`
      const rookTalking = document.querySelector('[data-testid="rook-sprite"]')?.getAttribute('data-talking') ?? null
      const arthurTalking = document.querySelector('[data-testid="mr-index-sprite"]')?.getAttribute('data-talking') ?? null
      if (key !== previousKey) rows.push({ lineIndex, speaker, revealing: panel.dataset.revealing ?? null, rookTalking, arthurTalking })
      if (previousSpeaker === speaker && previousKey && !previousKey.startsWith(`${lineIndex}:`)) sawSame = true
      if (panel.dataset.revealing === 'false') sawRevealed = true
      previousKey = key
      previousSpeaker = speaker
      if (sawSame && sawRevealed) { window.clearInterval(timer); resolve(rows) }
      if (Date.now() - started > 30_000) { window.clearInterval(timer); reject(new Error(`AUTO_MOUTH_EVIDENCE_TIMEOUT ${JSON.stringify(rows)}`)) }
    }, 20)
  }))
  for (const row of series) {
    expect(row.speaker === 'ROOK' ? row.rookTalking : row.arthurTalking).toBe('true')
  }
  if (process.env.S15_R7_EVIDENCE === '1') {
    mkdirSync(resolve(evidenceRoot, 'RECEIPTS'), { recursive: true })
    writeFileSync(resolve(evidenceRoot, 'RECEIPTS/MOUTH_FRAME_SERIES.json'), `${JSON.stringify({ schema: 'tarka.s15-r7.mouth-frame-series.v1', mode: 'AUTO', ordinaryUrlAndQuery: '/', samples: series }, null, 2)}\n`)
  }
  await capture(page, info, 'opening-auto-mouth-owner', 'PLAY → AUTO FAST → revealed hold + same-speaker transition')
})

test('S15-R7 one form sequence interleaves review, stamp, continuation, and truthful return', async ({ page }, info) => {
  await reviewState(page, 'FORM_COMPLETED')
  await page.getByTestId('verb-give').click()
  await page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles').click()
  await page.getByTestId('hotspot-mr-index').click()
  const sequence = page.getByTestId('active-sequence')
  const scene = page.getByTestId('records-office')

  await formStage(page, 'offer')
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await formStage(page, 'review')
  await expect(sequence).toHaveAttribute('data-status', 'WAITING_FOR_SPEECH')
  await expect(sequence).toHaveAttribute('data-stage', 'FORM_REVIEW')
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await expect(scene).toHaveAttribute('data-terminal-powered', 'false')
  await expect(scene).toHaveAttribute('data-terminal-authorized', 'false')
  await capture(page, info, 'form-review-dialogue-one-paper', 'FORM_COMPLETED → GIVE → handoff → FORM_REVIEW speech')
  await drainStageSpeech(page)

  await formStage(page, 'return')
  await expect(sequence).toHaveAttribute('data-selected-verb', 'GIVE')
  await expect(sequence).toHaveAttribute('data-actor-intentions', 'ARTHUR:RETURN,ROOK:RECEIVE')
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.FORM_RETURN')
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await capture(page, info, 'form-truthful-return', 'review dismissed → Arthur RETURN → Rook RECEIVE')

  await formStage(page, 'stamp')
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.FORM_STAMP')
  await expect(scene).toHaveAttribute('data-desk-stamp-owner', 'ARTHUR_IN_USE')
  await expect(scene).toHaveAttribute('data-desk-stamp-visible', 'false')
  await expect(scene).toHaveAttribute('data-terminal-authorized', 'true')
  await expect(scene).toHaveAttribute('data-terminal-can-open', 'true')
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await capture(page, info, 'form-stamp-approval-commit', 'FORM_REVIEW dismissed → CONTACT.FORM_STAMP → approval commit')

  await formStage(page, 'stamp-caption')
  await expect(sequence).toHaveAttribute('data-status', 'WAITING_FOR_SPEECH')
  await expect(sequence).toHaveAttribute('data-stage', 'POST_STAMP_AUTHORIZATION')
  await expect(scene).toHaveAttribute('data-desk-stamp-owner', 'DESK')
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await capture(page, info, 'form-post-stamp-continuation', 'stamp → desk stamp restored → post-stamp authorization speech')
  await drainStageSpeech(page)

  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 12_000 })
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toHaveCount(1)
  await expect(scene).toHaveAttribute('data-terminal-can-open', 'true')
})

test('S15-R7 terminal obeys the superseding OFF-until-approved-return authority', async ({ page }, info) => {
  await reviewState(page, 'START')
  const scene = page.getByTestId('records-office')
  await expect(scene).toHaveAttribute('data-terminal-powered', 'false')
  await expect(scene).toHaveAttribute('data-terminal-authorized', 'false')
  await expect(scene).toHaveAttribute('data-terminal-can-open', 'false')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click()
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-sequence', 'SEQUENCE.TERMINAL_REPRIMAND', { timeout: 10_000 })
  await expect(page.getByTestId('case-terminal')).toHaveCount(0)
  await capture(page, info, 'terminal-off-unauthorized', 'START → terminal OFF art → USE → reprimand; no terminal entry')

  await reviewState(page, 'COMPLETE')
  await expect(scene).toHaveAttribute('data-terminal-powered', 'true')
  await expect(scene).toHaveAttribute('data-terminal-authorized', 'true')
  await expect(scene).toHaveAttribute('data-terminal-can-open', 'true')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click()
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 12_000 })
})

test('S15-R7 browser receipt exposes PICK_UP semantics and blocked-network closure', async ({ page }) => {
  const external: string[] = []
  const sockets: string[] = []
  page.on('request', request => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url()) })
  page.on('websocket', socket => { const url = new URL(socket.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) sockets.push(socket.url()) })
  await reviewState(page, 'START')
  await observeSequenceReceipts(page)
  await page.getByTestId('verb-pick-up').click()
  await page.getByTestId('hotspot-blank-authorization-form').click()
  await formStage(page, 'contact')
  await expect.poll(() => page.evaluate(() => {
    type Receipt = { selectedVerb: string; actorIntentions: string; physicalPose: string; contact: string }
    const receipts = (window as unknown as { __s15r7SequenceReceipts?: Receipt[] }).__s15r7SequenceReceipts ?? []
    return receipts.some(receipt => receipt.selectedVerb === 'PICK_UP' && receipt.actorIntentions === 'ROOK:PICK_UP' && receipt.physicalPose === 'EMPTY_HAND_REACH' && receipt.contact === 'CONTACT.ITEM.take-form')
  })).toBe(true)
  expect(external).toEqual([])
  expect(sockets).toEqual([])
})
