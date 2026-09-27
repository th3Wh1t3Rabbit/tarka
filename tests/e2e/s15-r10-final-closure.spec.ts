import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const shots = resolve('review/s15-r10/SCREENSHOTS')
mkdirSync(shots, { recursive: true })

async function start(page: Page, phase = 'START') {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption(phase)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
}
async function act(page: Page, verb: string, target: string) {
  await page.getByTestId(`verb-${verb.toLowerCase().replace('_', '-')}`).click()
  await page.getByTestId(`hotspot-${target}`).click({ force: true })
}
async function settle(page: Page) {
  await expect(page.getByTestId('active-sequence')).toBeVisible({ timeout: 12_000 })
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 15_000 })
}
async function drainSpeech(page: Page) {
  for (let guard = 0; guard < 80 && await page.getByTestId('speech-panel').count(); guard += 1) {
    await page.getByTestId('talk-advance-catch').click({ force: true })
    await page.waitForTimeout(20)
  }
}
async function observeNextGlobeRevision(page: Page) {
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[data-testid="a0-shell"]')!
    const revision = shell.dataset.globeRevision
    const state = { previousPhase: shell.dataset.globePhase ?? '', start: '', surface: '', pose: '', level: '' }
    ;(window as unknown as { __r10Globe?: typeof state }).__r10Globe = state
    const observer = new MutationObserver((records) => {
      if (shell.dataset.globeRevision === revision) {
        state.previousPhase = shell.dataset.globePhase ?? state.previousPhase
        return
      }
      const phaseChange = records.find(record => record.attributeName === 'data-globe-phase')
      if (phaseChange?.oldValue !== null && phaseChange?.oldValue !== undefined) state.previousPhase = phaseChange.oldValue
      state.start = shell.dataset.globeStartPhase ?? ''
      state.surface = shell.dataset.globeSurface ?? ''
      state.pose = shell.dataset.globePose ?? ''
      state.level = shell.dataset.globeLevel ?? ''
      observer.disconnect()
    })
    observer.observe(shell, { attributes: true, attributeOldValue: true, attributeFilter: ['data-globe-revision', 'data-globe-phase'] })
  })
}
async function observeFrameSeries(page: Page, testId: string) {
  await page.evaluate((id) => {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
    const frames = [node.dataset.frameSrc ?? '']
    ;(window as unknown as { __r10Frames?: string[] }).__r10Frames = frames
    new MutationObserver(() => frames.push(node.dataset.frameSrc ?? '')).observe(node, { attributes: true, attributeFilter: ['data-frame-src'] })
  }, testId)
}

test('R10-B01 pointer PUSH starts finite L1 while controls remain active', async ({ page }) => {
  await start(page); await act(page, 'PUSH', 'office-globe'); await settle(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-level', '1')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-interface-treatment', 'ACTIVE')
  await page.screenshot({ path: resolve(shots, 'globe-pointer-l1-active.png') })
})

test('R10-B02 pointer USE follows the approved PUSH globe route', async ({ page }) => {
  await start(page); await act(page, 'USE', 'office-globe'); await settle(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-pose', 'PUSH')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-motion', 'SPINNING')
})

test('R10-B03 keyboard-selected PULL starts the reverse direction', async ({ page }) => {
  await start(page); await page.keyboard.press('9'); await page.getByTestId('hotspot-office-globe').click({ force: true }); await settle(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-pose', 'PULL')
  await page.screenshot({ path: resolve(shots, 'globe-keyboard-pull.png') })
})

test('R10-B04 touch activation reaches the same authoritative globe route', async ({ page }) => {
  await start(page)
  await page.getByTestId('verb-push').evaluate((element) => { element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); (element as HTMLElement).click(); element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })) })
  await page.getByTestId('hotspot-office-globe').evaluate((element) => { element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); (element as HTMLElement).click(); element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })) })
  await settle(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-level', '1')
})

test('R10-B05 promotion preserves the visible angular phase at contact', async ({ page }) => {
  await start(page); await act(page, 'PULL', 'office-globe'); await settle(page)
  const shell = page.getByTestId('a0-shell'); await observeNextGlobeRevision(page)
  await act(page, 'PULL', 'office-globe')
  await expect(shell).toHaveAttribute('data-globe-level', '2', { timeout: 12_000 })
  const observed = await page.evaluate(() => (window as unknown as { __r10Globe: { previousPhase: string; start: string } }).__r10Globe)
  expect(observed.start).toBe(observed.previousPhase)
  await settle(page)
})

test('R10-B06 reversal is synchronously sharp and preserves the visible angle', async ({ page }) => {
  await start(page); await act(page, 'PUSH', 'office-globe'); await settle(page)
  const shell = page.getByTestId('a0-shell'); await observeNextGlobeRevision(page)
  await act(page, 'PULL', 'office-globe')
  await expect(shell).toHaveAttribute('data-globe-pose', 'PULL', { timeout: 12_000 })
  await expect(shell).toHaveAttribute('data-globe-level', '1')
  const observed = await page.evaluate(() => (window as unknown as { __r10Globe: { previousPhase: string; start: string; surface: string } }).__r10Globe)
  expect(observed.start).toBe(observed.previousPhase)
  expect(observed.surface).toBe('sharp')
  await settle(page)
})

test('R10-B07 FINAL_HOLD same-direction input starts fresh L1 at the held angle', async ({ page }) => {
  await start(page); await act(page, 'PULL', 'office-globe'); await settle(page)
  const shell = page.getByTestId('a0-shell')
  await expect(shell).toHaveAttribute('data-globe-motion', 'FINAL_HOLD', { timeout: 20_000 })
  const held = await shell.getAttribute('data-globe-phase'); const revision = Number(await shell.getAttribute('data-globe-revision'))
  await act(page, 'PULL', 'office-globe')
  await expect(shell).toHaveAttribute('data-globe-motion', 'SPINNING', { timeout: 12_000 })
  await expect(shell).toHaveAttribute('data-globe-level', '1')
  await expect(shell).toHaveAttribute('data-globe-start-phase', held ?? '0')
  await expect.poll(async () => Number(await shell.getAttribute('data-globe-revision'))).toBe(revision + 1)
  await page.screenshot({ path: resolve(shots, 'globe-final-hold-fresh-l1.png') })
})

test('R10-B08 official filed close reverses paper-bearing drawer-01 frames', async ({ page }) => {
  await start(page, 'COMPLETE'); await act(page, 'OPEN', 'official-case-file-cabinet'); await settle(page)
  await observeFrameSeries(page, 'layout-official-cabinet'); await act(page, 'CLOSE', 'official-case-file-cabinet'); await settle(page)
  const frames = await page.evaluate(() => (window as unknown as { __r10Frames: string[] }).__r10Frames)
  expect(frames.some(frame => /drawer_02_filed_phase_0[1-6]\.png/.test(frame))).toBe(true)
  await page.screenshot({ path: resolve(shots, 'official-filed-close-papers.png') })
})

test('R10-B09 official post-collection close retains the drawer-02 filed family', async ({ page }) => {
  await start(page, 'COMPLETE'); await act(page, 'OPEN', 'official-case-file-cabinet'); await settle(page)
  await act(page, 'PICK_UP', 'disorderly-stack-of-confidential-files')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-action-id', 'search-dialogue', { timeout: 12_000 })
  await drainSpeech(page)
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-action-id', 'recite-file', { timeout: 12_000 })
  await drainSpeech(page)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 15_000 })
  await observeFrameSeries(page, 'layout-official-cabinet'); await act(page, 'CLOSE', 'official-case-file-cabinet'); await settle(page)
  // Contents remain in the drawer, but the contents hotspot is only selectable
  // while the drawer is actually open.
  await expect(page.getByTestId('hotspot-disorderly-stack-of-confidential-files')).toHaveCount(0)
  const frames = await page.evaluate(() => (window as unknown as { __r10Frames: string[] }).__r10Frames)
  expect(frames.some(frame => /drawer_02_filed_phase_0[1-6]\.png/.test(frame))).toBe(true)
  await act(page, 'OPEN', 'official-case-file-cabinet'); await settle(page)
  await expect(page.getByTestId('hotspot-disorderly-stack-of-confidential-files')).toBeVisible()
  await expect(page.getByTestId('layout-official-cabinet')).toHaveAttribute('data-frame-src', /drawer_02_filed_open\.png/)
  await page.screenshot({ path: resolve(shots, 'official-drawer02-filed-close.png') })
})

test('R10-B10 misc bottom drawer-04 and mug steam are both live production consumers', async ({ page }) => {
  await start(page, 'COMPLETE')
  await expect.poll(async () => page.getByTestId('layout-mug').getAttribute('data-frame-src')).toMatch(/mug_steam_[ab]/)
  await observeFrameSeries(page, 'layout-misc-cabinet'); await act(page, 'OPEN', 'miscellaneous-drawer-cabinet'); await settle(page)
  const frames = await page.evaluate(() => (window as unknown as { __r10Frames: string[] }).__r10Frames)
  expect(frames.some(frame => /drawer_04_phase_0[1-6]\.png/.test(frame))).toBe(true)
  await page.screenshot({ path: resolve(shots, 'misc-drawer04-and-live-steam.png') })
})
