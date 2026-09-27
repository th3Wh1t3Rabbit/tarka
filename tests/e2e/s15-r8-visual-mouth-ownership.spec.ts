import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

const evidenceRoot = resolve('review/s15-r8')
const receiptPath = resolve(evidenceRoot, 'RECEIPTS/ACTUAL_FRAME_SERIES.ndjson')
const screenshotRoot = resolve(evidenceRoot, 'SCREENSHOTS')

interface FrameSample {
  atMs: number
  frameIndex: number
  frameCount: number
  policyIdentity: string | null
  requestedSource: string | null
  imageRequestedSource: string | null
  renderedSource: string | null
  imageComplete: boolean
  naturalWidth: number
}

async function sampleFrames(animation: Locator, durationMs: number, intervalMs = 80): Promise<FrameSample[]> {
  const started = Date.now()
  const samples: FrameSample[] = []
  while (Date.now() - started <= durationMs) {
    samples.push(await animation.evaluate((node, atMs) => {
      const image = node.querySelector('img')
      return {
        atMs,
        frameIndex: Number(node.getAttribute('data-frame-index')),
        frameCount: Number(node.getAttribute('data-animation-frames')),
        policyIdentity: node.getAttribute('data-policy-identity'),
        requestedSource: node.getAttribute('data-requested-src'),
        imageRequestedSource: image?.getAttribute('data-requested-src') ?? null,
        renderedSource: image?.getAttribute('data-rendered-src') ?? null,
        imageComplete: image?.complete ?? false,
        naturalWidth: image?.naturalWidth ?? 0,
      }
    }, Date.now() - started))
    await animation.page().waitForTimeout(intervalMs)
  }
  return samples
}

function expectTwoCycles(samples: FrameSample[]) {
  const changes = samples.map(sample => sample.frameIndex).filter((value, index, all) => index === 0 || value !== all[index - 1])
  expect(changes.length).toBeGreaterThanOrEqual(5)
  expect(new Set(changes).size).toBeGreaterThanOrEqual(2)
  const requested = new Set(samples.map(sample => sample.requestedSource))
  const rendered = new Set(samples.map(sample => sample.renderedSource))
  expect(requested.size).toBe(2)
  expect(rendered).toEqual(requested)
  let consecutiveDecodeHolds = 0
  for (const sample of samples) {
    expect(sample.requestedSource).toBe(sample.imageRequestedSource)
    expect(requested.has(sample.renderedSource)).toBe(true)
    expect(sample.imageComplete).toBe(true)
    expect(sample.naturalWidth).toBeGreaterThan(0)
    consecutiveDecodeHolds = sample.renderedSource === sample.imageRequestedSource ? 0 : consecutiveDecodeHolds + 1
    expect(consecutiveDecodeHolds, 'the last decoded frame may be held briefly, but never blank or lag across multiple samples').toBeLessThanOrEqual(2)
  }
}

async function startReview(page: Page, phase = 'START') {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption(phase)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
}

async function revealCurrentLine(page: Page) {
  if (await page.getByTestId('speech-panel').getAttribute('data-revealing') === 'true') await page.getByTestId('talk-advance-catch').click()
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-revealing', 'false')
}

function recordSeries(info: TestInfo, id: string, route: string, samples: FrameSample[]) {
  if (process.env.S15_R8_EVIDENCE !== '1') return
  mkdirSync(resolve(evidenceRoot, 'RECEIPTS'), { recursive: true })
  appendFileSync(receiptPath, `${JSON.stringify({ schema: 'tarka.s15-r8.actual-frame-series.v1', id, generatingTestId: info.title, sourceTestPath: 'tests/e2e/s15-r8-visual-mouth-ownership.spec.ts', route, samples })}\n`)
}

async function capture(page: Page, id: string) {
  if (process.env.S15_R8_EVIDENCE !== '1') return
  mkdirSync(screenshotRoot, { recursive: true })
  await page.screenshot({ path: resolve(screenshotRoot, `${id}.png`), fullPage: true })
}

test('document review cycles while Arthur speaks and holds closed between lines and for Rook', async ({ page }, info) => {
  await startReview(page, 'FORM_COMPLETED')
  await page.getByTestId('verb-give').click()
  await page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles').click()
  await page.getByTestId('hotspot-mr-index').click()
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-stage', 'FORM_REVIEW', { timeout: 12_000 })
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-speaker', 'MR_INDEX')

  const animation = page.getByTestId('mr-index-animation')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-talking', 'true')
  expect(Number(await animation.getAttribute('data-animation-frames'))).toBeGreaterThan(1)
  await expect(animation).toHaveAttribute('data-policy-identity', /archivist_document_talk\.png/)
  const arthurSpeaking = await sampleFrames(animation, 420)
  recordSeries(info, 'document-arthur-speaking', 'FORM_COMPLETED → GIVE → review → Arthur speaks with the document held', arthurSpeaking)

  await revealCurrentLine(page)
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-talking', 'false')
  await expect(animation).toHaveAttribute('data-animation-frames', '1')
  const arthurWait = await sampleFrames(animation, 500)
  expect(new Set(arthurWait.map(sample => sample.frameIndex))).toEqual(new Set([0]))
  expect(arthurWait.every(sample => sample.requestedSource?.endsWith('/archivist_document_hold.png'))).toBe(true)
  recordSeries(info, 'document-arthur-fully-revealed', 'Arthur fully revealed MANUAL wait with a closed mouth', arthurWait)

  await page.getByTestId('talk-advance-catch').click()
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-speaker', 'MR_INDEX')
  expect(Number(await animation.getAttribute('data-animation-frames'))).toBeGreaterThan(1)
  await expect(animation).toHaveAttribute('data-policy-identity', /archivist_document_talk\.png/)
  const sameSpeaker = await sampleFrames(animation, 420)
  recordSeries(info, 'document-same-speaker-transition', 'Arthur review line 1 → consecutive Arthur review line 2', sameSpeaker)

  for (let guard = 0; guard < 20 && await page.getByTestId('speech-panel').getAttribute('data-speaker') === 'MR_INDEX'; guard += 1) {
    if (await page.getByTestId('speech-panel').getAttribute('data-revealing') === 'true') await revealCurrentLine(page)
    await page.getByTestId('talk-advance-catch').click()
  }
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-speaker', 'ROOK')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-cue', 'arthur.document')
  const rookReply = await sampleFrames(animation, 900)
  expect(new Set(rookReply.map(sample => sample.frameIndex))).toEqual(new Set([0]))
  expect(new Set(rookReply.map(sample => sample.frameCount))).toEqual(new Set([1]))
  expect(rookReply.every(sample => sample.requestedSource?.endsWith('/archivist_document_hold.png'))).toBe(true)
  recordSeries(info, 'document-rook-reply-static', 'Arthur review line 2 → Rook reply while Arthur holds document', rookReply)
  await capture(page, 'document-rook-reply-static')
})

test('held point alternates only for Arthur and rebases to the closed point frame for Rook', async ({ page }, info) => {
  await startReview(page)
  await page.getByTestId('verb-open').click()
  await page.getByTestId('hotspot-official-case-file-cabinet').click()
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-cue', 'arthur.point', { timeout: 12_000 })
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-speaker', 'MR_INDEX')
  const animation = page.getByTestId('mr-index-animation')
  await revealCurrentLine(page)
  const arthurPoint = await sampleFrames(animation, 1700)
  expectTwoCycles(arthurPoint)
  recordSeries(info, 'point-arthur-fully-revealed', 'OPEN locked cabinet → Arthur point reprimand → fully revealed MANUAL wait', arthurPoint)

  for (let guard = 0; guard < 20 && await page.getByTestId('speech-panel').getAttribute('data-speaker') !== 'ROOK'; guard += 1) {
    if (await page.getByTestId('speech-panel').getAttribute('data-revealing') === 'true') await revealCurrentLine(page)
    await page.getByTestId('talk-advance-catch').click()
  }
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-speaker', 'ROOK')
  await expect(page.getByTestId('mr-index-sprite')).not.toHaveAttribute('data-cue', 'arthur.point')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-talking', 'false')
  const rookReply = await sampleFrames(animation, 900)
  expect(new Set(rookReply.map(sample => sample.frameIndex))).toEqual(new Set([0]))
  expect(new Set(rookReply.map(sample => sample.frameCount))).toEqual(new Set([1]))
  expect(rookReply.every(sample => !sample.requestedSource?.endsWith('/archivist_gesture_point.png'))).toBe(true)
  recordSeries(info, 'point-rook-reply-static', 'Arthur point reprimand → Rook reply after Arthur releases the prolonged point', rookReply)
  await capture(page, 'point-rook-reply-static')

  for (let guard = 0; guard < 80 && await page.getByTestId('speech-panel').count(); guard += 1) {
    await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(20)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('mr-index-sprite')).not.toHaveAttribute('data-cue', 'arthur.point')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-talking', 'false')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-talking', 'false')
})

test('ordinary talk renders actual closed/open frames and clears the outgoing mouth at dismissal', async ({ page }, info) => {
  await startReview(page)
  await page.getByTestId('verb-talk-to').click()
  await page.getByTestId('hotspot-mr-index').click()
  await expect(page.getByTestId('dialogue-panel')).toBeVisible({ timeout: 12_000 })
  await page.getByTestId('dialogue-form-reminder').click()
  await expect(page.getByTestId('speech-panel')).toBeVisible()
  while (await page.getByTestId('speech-panel').getAttribute('data-speaker') !== 'ROOK') {
    await revealCurrentLine(page)
    await page.getByTestId('talk-advance-catch').click()
  }
  await revealCurrentLine(page)
  const rookTalk = await sampleFrames(page.getByTestId('rook-animation'), 700)
  expect(new Set(rookTalk.map(sample => sample.frameIndex))).toEqual(new Set([0, 1]))
  expect(new Set(rookTalk.map(sample => sample.renderedSource)).size).toBe(2)
  recordSeries(info, 'ordinary-rook-talk', 'TALK TO Arthur → form reminder → Rook fully revealed MANUAL wait', rookTalk)

  for (let guard = 0; guard < 80 && await page.getByTestId('speech-panel').count(); guard += 1) {
    await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(20)
  }
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-talking', 'false')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-talking', 'false')
  if (process.env.S15_R8_EVIDENCE === '1') {
    mkdirSync(resolve(evidenceRoot, 'RECEIPTS'), { recursive: true })
    writeFileSync(resolve(evidenceRoot, 'RECEIPTS/FINAL_DISMISSAL.json'), `${JSON.stringify({ schema: 'tarka.s15-r8.final-dismissal.v1', rookTalking: false, arthurTalking: false, route: 'ordinary dialogue → final dismissal' }, null, 2)}\n`)
  }
})
