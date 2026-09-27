import { expect, test, type Page } from '@playwright/test'
import { drainBrowserSpeech } from '../fixtures/s2/browser-helpers'
test.setTimeout(180_000)

const verbTestId = (verb: string) => `verb-${verb.toLowerCase().replace('_', '-')}`

async function waitForApp(page: Page, query = '', skipIntro = true) {
  const params = new URLSearchParams(query.replace(/^\?/, ''))
  if (skipIntro) params.set('skipIntro', '1')
  await page.goto(`/?${params}`)
  await expect(page.getByTestId('a0-shell')).toBeVisible()
}

async function dismissSpeech(page: Page) {
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
  await page.waitForTimeout(400)
  for (let guard = 0; guard < 16 && await page.getByTestId('speech-panel').isVisible().catch(() => false); guard += 1) {
    await page.getByTestId('speech-panel').click()
    await page.waitForTimeout(200)
  }
}

async function mouseAction(page: Page, verb: string, hotspot: string, phase: string, item?: string) {
  await page.getByTestId(verbTestId(verb)).click()
  if (item) await page.getByTestId(`inventory-${item}`).click()
  await page.getByTestId(`hotspot-${hotspot}`).hover()
  await page.getByTestId(`hotspot-${hotspot}`).click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
  await dismissSpeech(page)
}

async function keyboardAction(page: Page, key: string, hotspot: string, phase: string, item?: string) {
  await page.keyboard.press(key)
  if (item) await page.getByTestId(`inventory-${item}`).press('Enter')
  await page.getByTestId(`hotspot-${hotspot}`).press('Enter')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
  await page.waitForTimeout(300)
  while (await page.getByTestId('speech-panel').isVisible().catch(() => false)) await page.getByTestId('speech-panel').press('Enter')
}

test.describe('G6P-A0 Records Office @g6p', () => {
  test('Lead-authored opening is exact, player-paced, and yields the objective', async ({ page }) => {
    await waitForApp(page, '', false)
    const panel = page.getByTestId('speech-panel')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'false')
    await expect(page.getByText('COMPLETE THE AUTHORIZATION FORM.')).toHaveCount(0)
    await expect(page.getByText(/RECORDS 0\/1/)).toHaveCount(0)
    await expect(panel).toHaveAttribute('data-line-index', '0')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-talking', 'ROOK')
    await page.waitForTimeout(300)
    await expect(panel).toHaveAttribute('data-line-index', '0')
    const lines = [
      'This is the Records Office?', 'It is the office in which records are kept. The sign was our first record.', 'Right. Mr. A—', 'Arthur.', 'Efficient.', 'Less efficient now.', 'Your case was misfiled. To retrieve its opening record, submit a request.', 'To request a record, I need a record requesting the record.', 'You are learning the system.',
    ]
    for (let index = 0; index < lines.length; index += 1) {
      await panel.click()
      await expect(panel).toContainText(lines[index]!.replace('\n', ' '))
      await expect(panel).toHaveAttribute('data-line-index', String(index))
      await page.keyboard.press('Space')
    }
    await expect(panel).toHaveCount(0)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'true')
    await expect(page.getByText('COMPLETE THE AUTHORIZATION FORM.')).toBeVisible()
  })

  test('classic interface, cursor, command grammar, cancellation, and empty-scene walk', async ({ page }) => {
    await waitForApp(page)
    await expect(page.getByTestId('verb-grid').getByRole('button')).toHaveCount(9)
    await expect(page.getByTestId('records-office')).toHaveAttribute('data-hotspot-total', '12')
    await expect(page.getByTestId('command-sentence')).toHaveText('Walk to')
    await page.getByTestId('hotspot-official-case-file-cabinet').hover()
    await expect(page.getByTestId('command-sentence')).toHaveText('Walk to official case-file cabinet')
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-official-case-file-cabinet').hover()
    await expect(page.getByTestId('command-sentence')).toHaveText('Use official case-file cabinet')
    await page.getByTestId('records-office').click({ position: { x: 500, y: 320 }, button: 'right' })
    await expect(page.getByTestId('command-sentence')).toContainText('Walk to')
    await page.getByTestId('verb-pull').click()
    await page.getByTestId('hotspot-request-dispenser').click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(900)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    await page.getByTestId('records-office').hover({ position: { x: 420, y: 315 } })
    await expect(page.locator('.cross-cursor')).toBeVisible()
    await expect(page.locator('.cross-cursor')).toHaveCSS('pointer-events', 'none')
    const before = await page.getByTestId('rook-sprite').getAttribute('style')
    await page.getByTestId('records-office').click({ position: { x: 580, y: 330 } })
    await expect.poll(() => page.getByTestId('rook-sprite').getAttribute('style')).not.toBe(before)
    await page.waitForTimeout(900)
    await page.getByTestId('records-office').click({ position: { x: 100, y: 315 } })
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-mirrored', 'true')
    await expect(page.locator('[data-prop="penStand"]')).toHaveAttribute('data-depth-band', 'front')
    await expect(page.locator('[data-prop="penStand"]')).toHaveCSS('z-index', '6')
  })

  test('optional dialogue is player-paced and talking animation follows active text only', async ({ page }) => {
    await waitForApp(page)
    await page.getByTestId('verb-talk-to').click()
    await page.getByTestId('hotspot-mr-index').click()
    await expect(page.getByTestId('dialogue-panel')).toBeVisible()
    await page.getByTestId('dialogue-form-reminder').click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-talking', 'MR_INDEX')
    await page.keyboard.press('Space')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-talking', 'NONE')
    await expect(page.getByTestId('speech-panel')).toContainText('blank form')
    await page.keyboard.press('Space')
    await expect(page.getByTestId('dialogue-panel')).toBeVisible()
    await page.getByTestId('dialogue-leave').click()
    await expect(page.getByTestId('dialogue-panel')).toBeHidden()
  })

  test('pointer journey completes the approved authorization puzzle and keeps exact values out of the office', async ({ page }) => {
    const nonlocal: string[] = []
    page.on('request', (request) => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) nonlocal.push(request.url()) })
    await waitForApp(page)
    await page.getByRole('button', { name: 'TEXT PACED' }).click()
    await expect(page.getByText('8,877,507.3483067 DAI')).toHaveCount(0)
    await mouseAction(page, 'TALK_TO', 'mr-index', 'START')
    await page.getByTestId('dialogue-leave').click()
    await mouseAction(page, 'PULL', 'request-dispenser', 'FORM_HELD')
    await mouseAction(page, 'PICK_UP', 'pen-stand', 'FORM_AND_PEN')
    await page.getByTestId(verbTestId('USE')).click()
    await page.getByTestId('inventory-blank-terminal-authorization-form').click()
    await page.getByTestId('inventory-loose-feather-pen').click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_COMPLETED')
    await dismissSpeech(page)
    await expect(page.getByText('8,877,507.3483067 DAI')).toHaveCount(0)
    await mouseAction(page, 'GIVE', 'mr-index', 'COMPLETE', 'signed-terminal-authorization-form-with-doodles')
    await mouseAction(page, 'OPEN', 'official-case-file-cabinet', 'COMPLETE')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'OPEN')
    await dismissSpeech(page)
    await mouseAction(page, 'PICK_UP', 'disorderly-stack-of-confidential-files', 'COMPLETE')
    await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible({ timeout: 15000 })
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(page.getByText('8,877,507.3483067 DAI')).toHaveCount(0)
    await expect(page.getByTestId('authorization-complete')).toContainText('TERMINAL AUTHORIZED')
    expect(nonlocal).toEqual([])
  })

  test('invalid actions preserve critical items and dead-end responses are deterministic', async ({ page }) => {
    await waitForApp(page, 'review=1')
    await page.getByLabel('Jump to puzzle state').selectOption('FORM_COMPLETED')
    await page.getByTestId('verb-give').click()
    await page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles')).toBeVisible()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_COMPLETED')
  })

  test('keyboard journey reaches completion without Talk hints', async ({ page }) => {
    await waitForApp(page)
    await page.getByRole('button', { name: 'TEXT PACED' }).press('Enter')
    await keyboardAction(page, '9', 'request-dispenser', 'FORM_HELD')
    await keyboardAction(page, '2', 'pen-stand', 'FORM_AND_PEN')
    await page.keyboard.press('3')
    await page.getByTestId('inventory-blank-terminal-authorization-form').press('Enter')
    await page.getByTestId('inventory-loose-feather-pen').press('Enter')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_COMPLETED')
    while (await page.getByTestId('speech-panel').isVisible().catch(() => false)) await page.getByTestId('speech-panel').press('Enter')
    await keyboardAction(page, '1', 'mr-index', 'COMPLETE', 'signed-terminal-authorization-form-with-doodles')
    await expect(page.getByTestId('authorization-complete')).toBeVisible()
  })

  test('review diagnostics remain hidden in ordinary play and art pack fallback is explicit', async ({ page }) => {
    await waitForApp(page)
    await expect(page.getByTestId('review-mode')).toHaveCount(0)
    await waitForApp(page, 'review=1&artPack=deco-archive-noir')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-art-status', 'AUDITION_EMPTY')
    await expect(page.getByTestId('review-mode')).toContainText('AUDITION_EMPTY')
  })

  test('Art Lab swaps empty packs, cycles frames, exposes prop states, and loads blank fixture', async ({ page }) => {
    await page.goto('/?artLab=1')
    await expect(page.getByTestId('art-lab')).toBeVisible()
    await expect(page.getByTestId('art-lab-rook')).toHaveAttribute('data-animation-frames', '2')
    const before = await page.getByTestId('art-lab-rook').getAttribute('data-frame-index')
    await expect.poll(() => page.getByTestId('art-lab-rook').getAttribute('data-frame-index')).not.toBe(before)
    await expect(page.getByTestId('art-lab')).toContainText('nansenTerminal:unlocked')
    await page.getByLabel('Art Lab scene').selectOption('blank-shell')
    await expect(page.locator('.lab-scene')).toHaveAttribute('data-scene', 'blank-shell')
    await expect(page.getByTestId('art-lab')).toContainText('NONPLAYABLE PORTABILITY FIXTURE')
    await page.getByLabel('Art Lab pack').selectOption('whimsical-forensic-gothic')
    await expect(page.getByTestId('art-lab')).toContainText('AUDITION_EMPTY')
  })
})
