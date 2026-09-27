import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('review/s15-r3')
const screenshotDir = resolve(root, 'SCREENSHOTS')

async function ownedScreenshot(page: Page, info: TestInfo, id: string, route: string) {
  if (process.env.S15_R3_EVIDENCE !== '1') return
  mkdirSync(screenshotDir, { recursive: true })
  const artifact = `SCREENSHOTS/${id}.png`
  await page.screenshot({ path: resolve(root, artifact), fullPage: true })
  appendFileSync(resolve(root, 'evidence-ownership.ndjson'), `${JSON.stringify({ artifactPath: artifact, generatingTestId: info.title, ordinaryUrlAndQuery: '/', stateActionRoute: route, capturedTimestamp: new Date().toISOString(), candidateCommit: process.env.S15_R3_CANDIDATE_COMMIT, candidateTree: process.env.S15_R3_CANDIDATE_TREE, sourceTestPath: 'tests/e2e/s15-r3-runtime-closure.spec.ts' })}\n`)
}

async function start(page: Page) {
  await page.goto('/')
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/$/)
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
}

async function drain(page: Page) {
  for (let guard = 0; guard < 300; guard += 1) {
    const speech = page.getByTestId('speech-panel')
    if (await speech.count()) await page.getByTestId('talk-advance-catch').click()
    else if (!await page.getByTestId('active-sequence').count()
      && await page.getByTestId('rook-sprite').getAttribute('data-animation') !== 'walkEast'
      && await page.getByTestId('a0-shell').getAttribute('data-intro-complete') === 'true'
      && await page.getByTestId('a0-shell').getAttribute('data-interface-treatment') === 'ACTIVE') return
    await page.waitForTimeout(40)
  }
  throw new Error('WORLD_DID_NOT_SETTLE')
}

async function action(page: Page, verb: string, target: string, item?: string) {
  await page.getByTestId(`verb-${verb}`).click()
  if (item) await page.getByTestId(`inventory-${item}`).click()
  await page.getByTestId(`hotspot-${target}`).click()
}

async function chooseTextSpeed(page: Page, testId: string) {
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId(testId).click()
}

test('S15-R3 ordinary opening proves paper hold, entrance, anchor, release, cues, and manual mouth owner', async ({ page }, info) => {
  await start(page)
  await expect(page.getByTestId('records-office')).toHaveAttribute('data-opening-stage', 'ARTHUR_PAPER')
  await expect(page.getByTestId('rook-sprite')).toHaveCount(0)
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-animation', 'document')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-cue', 'arthur.document')
  await chooseTextSpeed(page, 'dialogue-mode-manual')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-dialogue-mode', 'MANUAL')
  await ownedScreenshot(page, info, 'opening-arthur-paper', 'PLAY → Arthur alone → document hold')
  await page.waitForTimeout(1900)
  await expect(page.getByTestId('rook-sprite')).toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId('speech-panel')).toContainText('This the Records Office?', { timeout: 6000 })
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-animation', 'document')
  await expect(page.getByTestId('mr-index-animation')).toHaveAttribute('data-requested-src', /archivist_document_hold\.png$/)
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-talking', 'true')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-talking', 'false')
  await ownedScreenshot(page, info, 'opening-manual-mouth-owner', 'opening → MANUAL → reveal Rook delivery')
})

test('S15-R3 ordinary world captures steam, globe semantic lifecycle, lamp, cancellation, and unauthorized contact', async ({ page }, info) => {
  await start(page); await drain(page)
  await expect(page.getByTestId('dialogue-delivery-controls')).toBeVisible()
  await ownedScreenshot(page, info, 'world-authorized-controls-and-steam', 'PLAY → opening complete → ordinary office')
  await action(page, 'push', 'office-globe'); await drain(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-level', '1')
  await ownedScreenshot(page, info, 'world-globe-push-level-one', 'office → PUSH globe → contact → level 1')
  await action(page, 'use', 'desk-lamp')
  await expect(page.getByTestId('records-office')).toHaveAttribute('data-lamp-power', 'OFF')
  await ownedScreenshot(page, info, 'world-lamp-off-before-speech', 'office → USE lamp → contact → OFF → speech')
  await drain(page)
  await page.getByTestId('verb-give').click(); await page.getByTestId('records-office').click({ position: { x: 300, y: 330 } })
  await expect(page.getByTestId('verb-give')).toHaveAttribute('aria-pressed', 'false')
  await action(page, 'open', 'official-case-file-cabinet')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-sequence', 'SEQUENCE.CABINET_POLICY_BLOCK', { timeout: 5000 })
  await ownedScreenshot(page, info, 'world-unauthorized-cabinet-contact', 'office → OPEN cabinet → walk → blocked semantic contact')
})

test('S15-R3 ordinary form handoff owns receive, document, stamp, return, and control persistence', async ({ page }, info) => {
  await start(page); await drain(page)
  await chooseTextSpeed(page, 'dialogue-pace-slow')
  await action(page, 'pick-up', 'blank-authorization-form'); await drain(page)
  await action(page, 'pick-up', 'pen-stand'); await drain(page)
  await page.getByTestId('verb-use').click(); await page.getByTestId('inventory-blank-terminal-authorization-form').click(); await page.getByTestId('inventory-loose-feather-pen').click(); await drain(page)
  await action(page, 'give', 'mr-index', 'signed-terminal-authorization-form-with-doodles')
  const sequence = page.getByTestId('active-sequence')
  await expect(sequence).toHaveAttribute('data-sequence', 'SEQUENCE.FORM_REVIEW_RETURN', { timeout: 5000 })
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.FORM_HANDOFF', { timeout: 5000 })
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-animation', 'document', { timeout: 5000 })
  await ownedScreenshot(page, info, 'form-handoff-document-review', 'authorization → GIVE signed form → handoff → document review')
  await expect(sequence).toHaveAttribute('data-action-id', 'review', { timeout: 5000 })
  for (let guard = 0; guard < 80 && await page.getByTestId('speech-panel').count(); guard += 1) {
    await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(25)
  }
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.FORM_STAMP', { timeout: 5000 })
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-animation', 'stamp')
  await ownedScreenshot(page, info, 'form-stamp-contact', 'document review → stamp contact → stamp hidden')
  await drain(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE')
  await expect(page.getByTestId('mr-index-sprite')).not.toHaveAttribute('data-animation', 'stamp')
  await expect(page.getByTestId('dialogue-mode-manual')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('dialogue-pace-slow')).toHaveAttribute('aria-pressed', 'true')
  await ownedScreenshot(page, info, 'form-return-approved', 'stamp → return → approved form → approval dialogue')
  await action(page, 'use', 'nansen-terminal')
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('dialogue-mode-manual')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('dialogue-pace-slow')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'RETURN TO OFFICE' }).click()
  await expect(page.getByTestId('dialogue-mode-manual')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('dialogue-pace-slow')).toHaveAttribute('aria-pressed', 'true')
})
