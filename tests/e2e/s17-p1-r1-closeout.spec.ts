import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const evidenceDir = resolve('review/s17-p1-r1/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function openRoom(page: Page, review = false) {
  await page.goto(`/?skipIntro=1${review ? '&review=1' : ''}`)
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-art-pack', 'production')
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
}

async function drainSpeech(page: Page) {
  for (let guard = 0; guard < 180 && (await page.getByTestId('speech-panel').count() || await page.getByTestId('nonblocking-speech').count()); guard += 1) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(20)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
}

async function settleWorld(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 300 && quiet < 4; guard += 1) {
    if (await page.getByTestId('speech-panel').count() || await page.getByTestId('nonblocking-speech').count()) {
      await page.keyboard.press('Space')
      quiet = 0
    } else if (await page.getByTestId('active-sequence').count() || await page.getByTestId('rook-sprite').getAttribute('data-animation') === 'walkEast') quiet = 0
    else quiet += 1
    await page.waitForTimeout(40)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
}

async function act(page: Page, verb: string, target?: string, item?: string, item2?: string) {
  await page.getByTestId(`verb-${verb}`).click()
  if (item) await page.getByTestId(`inventory-${item}`).click()
  if (target) await page.getByTestId(`hotspot-${target}`).click()
  else if (item2) await page.getByTestId(`inventory-${item2}`).click()
}

test('R1 browser display control fits and owns Full/Typed delivery at three supported viewports', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => localStorage.removeItem('trace-dialogue-delivery-v1'))
  for (const [label, viewport] of [
    ['small', { width: 640, height: 480 }],
    ['middle', { width: 960, height: 640 }],
    ['large', { width: 1440, height: 900 }],
  ] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: 'PLAY', exact: true }).click()
    const speech = page.getByTestId('speech-panel')
    await expect(speech).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('text-speed-menu').click()
    await page.getByTestId('dialogue-mode-manual').click()
    const display = page.getByTestId('dialogue-display-toggle')
    await expect(display).toHaveText('TEXT · FULL')
    await expect(speech).toHaveAttribute('data-revealing', 'false')
    const fit = await page.getByTestId('dialogue-delivery-controls').locator('xpath=..').evaluate((node) => {
      const rect = node.getBoundingClientRect()
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight }
    })
    expect(fit.left).toBeGreaterThanOrEqual(0)
    expect(fit.right).toBeLessThanOrEqual(fit.width)
    expect(fit.top).toBeGreaterThanOrEqual(0)
    expect(fit.bottom).toBeLessThanOrEqual(fit.height)

    const currentKey = await speech.getAttribute('data-delivery-key')
    if (label === 'small') {
      await display.focus()
      await page.keyboard.press('Enter')
    } else await display.click()
    await expect(display).toHaveText('TEXT · TYPED')
    await expect(speech).toHaveAttribute('data-delivery-key', currentKey!)
    await expect(speech).toHaveAttribute('data-revealing', 'false')
    await page.getByTestId('talk-advance-catch').click()
    await expect(speech).toHaveAttribute('data-revealing', 'true')
    await page.screenshot({ path: resolve(evidenceDir, `display-${label}-typed.png`), fullPage: true })
  }
})

test('Principal correction keeps Full speech geometry atomic across speaker and same-speaker transitions', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('trace-dialogue-delivery-v1'))
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('speech-panel')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  await expect(page.getByTestId('dialogue-display-toggle')).toHaveText('TEXT · FULL')
  const transitions = await page.evaluate(async () => {
    const snapshot = () => {
      const panel = document.querySelector<HTMLElement>('[data-testid="speech-panel"]')!
      const rect = panel.getBoundingClientRect()
      return { key: panel.dataset.deliveryKey, speaker: panel.dataset.speaker, geometryKey: panel.dataset.fullDeliveryKey, x: rect.x, y: rect.y, width: rect.width }
    }
    const rows = []
    for (let index = 0; index < 4; index += 1) {
      const outgoing = snapshot()
      document.querySelector<HTMLButtonElement>('[data-testid="talk-advance-catch"]')!.click()
      // Let React commit the event update while remaining in the same browser
      // turn, before the next animation frame can hide a stale-geometry paint.
      await Promise.resolve()
      await Promise.resolve()
      const immediate = snapshot()
      await new Promise<void>(resolveFrame => requestAnimationFrame(() => resolveFrame()))
      const painted = snapshot()
      rows.push({ outgoing, immediate, painted })
    }
    return rows
  })
  expect(transitions[0]?.outgoing.speaker).toBe('ROOK')
  expect(transitions[0]?.immediate.speaker).toBe('MR_INDEX')
  expect(transitions[3]?.outgoing.speaker).toBe('MR_INDEX')
  expect(transitions[3]?.immediate.speaker).toBe('MR_INDEX')
  for (const row of transitions) {
    expect(row.immediate.key).not.toBe(row.outgoing.key)
    expect(row.immediate.geometryKey).toBe(row.painted.geometryKey)
    expect(Math.abs(row.immediate.x - row.painted.x)).toBeLessThan(0.5)
    expect(Math.abs(row.immediate.y - row.painted.y)).toBeLessThan(0.5)
    expect(Math.abs(row.immediate.width - row.painted.width)).toBeLessThan(0.5)
  }
})

test('Principal animation portal exposes every clip and searchable script direction with portable timing notes', async ({ page }) => {
  await page.goto('/?animDirector=1')
  await expect(page.getByTestId('animation-director')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('REVIEW-ONLY FORK', { exact: true })).toBeVisible()
  await expect(page.getByTestId('animation-default')).toContainText('Current implemented game animation bindings')
  await expect(page.getByRole('button', { name: /GAME DEFAULT/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Actions & handoffs' }).click()
  await expect(page.locator('.clip-browser').getByRole('button', { name: /Drawer extraction/ })).toBeVisible()
  await page.getByPlaceholder('drawer, authorization, copy key...').fill('What if I need another case file')
  const scriptMoment = page.getByRole('button', { name: /What if I need another case file/ })
  await expect(scriptMoment).toHaveCount(1)
  await scriptMoment.click()
  await page.getByRole('button', { name: 'Arthur', exact: true }).click()
  await page.getByRole('button', { name: 'Reactions & camera' }).click()
  await page.getByRole('button', { name: /Angry point/ }).click()
  await page.getByLabel('Beat before milliseconds').fill('250')
  await page.getByLabel('Beat after milliseconds').fill('600')
  await page.getByLabel('Direction note').fill('Principal review: keep the point only if Arthur owns this warning.')
  await page.getByRole('button', { name: 'UPDATE REVIEW BINDING' }).click()
  await expect(page.locator('.binding')).toContainText('before 0.5 beats / 250 ms')
  await expect(page.locator('.binding')).toContainText('after 1.2 beats / 600 ms')
  await expect(page.getByTestId('animation-scene-preview')).toContainText('What if I need another case file?')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'EXPORT REVIEW JSON' }).click()
  const exported = await download
  expect(exported.suggestedFilename()).toBe('trace-escape-current-game-review-fork.json')
  const exportedPath = await exported.path()
  const payload = JSON.parse(readFileSync(exportedPath!, 'utf8'))
  expect(payload).toMatchObject({ schema: 'trace-escape.animation-review-export.v3', safety: { reviewOnly: true, liveGameApplied: false }, beatDefinition: { defaultBeatMs: 500 } })
  expect(payload.project.baseSheet.cues.length).toBeGreaterThan(10)
  await page.locator('input[type=file]').setInputFiles(exportedPath!)
  await expect(page.getByTestId('animation-status')).toContainText('isolated working copy')
  const storageKeys = await page.evaluate(() => ({ review: localStorage.getItem('trace-escape.animation-review-workspace.v3'), game: localStorage.getItem('trace-escape.animation-cues.v1') }))
  expect(storageKeys.review).toContain('imported working copy')
  expect(storageKeys.game).toBeNull()
})

test('animation review studio composes held-pose talk on an isolated per-character timeline', async ({ page }) => {
  await page.goto('/?animDirector=1')
  await expect(page.getByTestId('animation-director')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Speech & listening' }).click()
  await page.getByRole('button', { name: /Talk thinking — chin held/ }).click()
  const frames = await page.locator('.frame-strip img').evaluateAll((images) => images.map((image) => image.getAttribute('src')))
  expect(frames).toEqual([expect.stringMatching(/rook_thinking_chin\.png$/), expect.stringMatching(/rook_talk_thinking\.png$/)])
  await expect(page.getByText('Pose-preserving talk:', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ADD POSE + TALK RECIPE' }).click()
  const timeline = page.getByTestId('animation-timeline')
  await expect(timeline).toContainText('Raise hand to chin')
  await expect(timeline).toContainText('Talk thinking — chin held')
  await expect(timeline).toContainText('4.00 beats')
  await page.getByRole('button', { name: 'Arthur', exact: true }).click()
  await page.getByRole('button', { name: 'Speech & listening', exact: true }).click()
  await page.locator('.clip-row').filter({ hasText: 'Present / explain' }).click()
  await expect(page.getByText('Pose-preserving talk:', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ADD POSE + TALK RECIPE' }).click()
  await expect(timeline).toContainText('Present / explain')
  await page.getByLabel('Cue sheet name').fill('Principal chin-pose experiment')
  await page.getByRole('button', { name: 'SAVE REVIEW VERSION' }).click()
  const keys = await page.evaluate(() => ({ review: localStorage.getItem('trace-escape.animation-review-workspace.v3'), game: localStorage.getItem('trace-escape.animation-cues.v1') }))
  expect(keys.review).toContain('Principal chin-pose experiment')
  expect(keys.game).toBeNull()
})

test('R1 browser blocked reach holds clean pixels, turns only at speech, and never replays the reprimand', async ({ page }) => {
  test.setTimeout(120_000)
  await openRoom(page, true)
  const initialArthurFacing = await page.getByTestId('mr-index-sprite').getAttribute('data-facing')
  await act(page, 'use', 'nansen-terminal')
  const sequence = page.getByTestId('active-sequence')
  await expect(sequence).toHaveAttribute('data-action-id', 'hold-blocked-reach', { timeout: 15_000 })
  const holdStart = Date.now()
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-facing', 'RIGHT')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'reach')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', initialArthurFacing!)
  await expect(page.getByTestId('mr-index-sprite')).not.toHaveAttribute('data-cue', 'arthur.point')
  const samples = await page.evaluate(async () => {
    const rows: Array<{ frame: string | null; rendered: string | null; complete: boolean; width: number }> = []
    for (let index = 0; index < 4; index += 1) {
      const animation = document.querySelector<HTMLElement>('[data-testid="rook-animation"]')!
      const image = animation.querySelector<HTMLImageElement>('img')!
      rows.push({ frame: animation.dataset.frameIndex ?? null, rendered: image.dataset.renderedSrc ?? null, complete: image.complete, width: image.naturalWidth })
      await new Promise(resolveWait => setTimeout(resolveWait, 60))
    }
    return rows
  })
  expect(samples.every(sample => sample.rendered && sample.complete && sample.width > 0)).toBe(true)
  expect(new Set(samples.map(sample => sample.rendered)).size).toBe(1)
  await expect(sequence).toHaveAttribute('data-action-id', 'reprimand', { timeout: 5_000 })
  // The production timer begins before Playwright observes the rendered hold.
  // The unit contract asserts the exact 750 ms; the browser must still observe
  // a substantial remainder after the DOM becomes visible.
  expect(Date.now() - holdStart).toBeGreaterThanOrEqual(400)
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-facing', 'LEFT')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'RIGHT')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-cue', 'arthur.point')
  await page.screenshot({ path: resolve(evidenceDir, 'blocked-terminal-reprimand-facing.png'), fullPage: true })
  await drainSpeech(page)
  await expect(sequence).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  const reprimands = await page.getByTestId('dialogue-transcript').locator('li').allTextContents()
  const normalized = reprimands.map(value => value.replace(/\s+/g, ' ').trim())
  expect(normalized.some((value, index) => index > 0 && value === normalized[index - 1])).toBe(false)

  await openRoom(page, true)
  const cabinetIdleFacing = await page.getByTestId('mr-index-sprite').getAttribute('data-facing')
  await act(page, 'open', 'official-case-file-cabinet')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-action-id', 'hold-blocked-reach', { timeout: 15_000 })
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', cabinetIdleFacing!)
  await expect(page.getByTestId('mr-index-sprite')).not.toHaveAttribute('data-cue', 'arthur.point')
  await expect(page.getByTestId('mr-index-animation')).not.toHaveAttribute('data-policy-identity', /arthur\.listen/)
})

test('R1 browser form uses only baked animation paper through receive, review, return, and stamp', async ({ page }) => {
  test.setTimeout(150_000)
  await openRoom(page, true)
  await page.getByLabel('Jump to puzzle state').selectOption('FORM_COMPLETED')
  await act(page, 'give', 'mr-index', 'signed-terminal-authorization-form-with-doodles')
  const sequence = page.getByTestId('active-sequence')
  await expect(sequence).toHaveAttribute('data-action-id', 'receive', { timeout: 15_000 })
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-cue', 'arthur.receive')

  await expect(sequence).toHaveAttribute('data-action-id', 'handoff', { timeout: 10_000 })
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-animation', 'document')
  await expect.poll(() => page.getByTestId('mr-index-animation').locator('img').evaluate(image => ({ complete: (image as HTMLImageElement).complete, width: (image as HTMLImageElement).naturalWidth, requested: (image as HTMLElement).dataset.requestedSrc, rendered: (image as HTMLElement).dataset.renderedSrc }))).toMatchObject({ complete: true, width: 48 })
  await page.screenshot({ path: resolve(evidenceDir, 'form-handoff-baked-paper-only.png'), fullPage: true })

  await expect(sequence).toHaveAttribute('data-action-id', 'review', { timeout: 10_000 })
  await drainSpeech(page)
  await expect(sequence).toHaveAttribute('data-action-id', 'return', { timeout: 10_000 })
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await expect(page.getByTestId('mr-index-sprite')).not.toHaveAttribute('data-animation', 'document')
  await expect(sequence).toHaveAttribute('data-action-id', 'stamp', { timeout: 10_000 })
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-animation', 'stamp')
  await page.screenshot({ path: resolve(evidenceDir, 'form-stamp-rook-paper.png'), fullPage: true })
})

test('R1 browser TALK approaches, verb-only input preserves speech, and literal terminal replies are visibly raised', async ({ page }) => {
  test.setTimeout(120_000)
  await openRoom(page)
  await act(page, 'talk-to', 'nansen-terminal')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
  await expect.poll(() => page.getByTestId('rook-animation').locator('img').evaluate(image => {
    const element = image as HTMLImageElement
    return Boolean(element.dataset.renderedSrc?.includes('rook_walk_') && element.complete && element.naturalWidth > 0)
  })).toBe(true)
  const walk = await page.evaluate(async () => {
    const sprite = document.querySelector<HTMLElement>('[data-testid="rook-sprite"]')!
    const animation = document.querySelector<HTMLElement>('[data-testid="rook-animation"]')!
    const samples: Array<{ frame: string | undefined; left: string; requested: string | undefined; rendered: string | undefined; complete: boolean; width: number }> = []
    for (let index = 0; index < 14; index += 1) {
      const image = animation.querySelector<HTMLImageElement>('img')!
      samples.push({ frame: animation.dataset.frameIndex, left: sprite.style.left, requested: animation.dataset.requestedSrc, rendered: image.dataset.renderedSrc, complete: image.complete, width: image.naturalWidth })
      await new Promise(resolveWait => setTimeout(resolveWait, 45))
    }
    return samples
  })
  expect(new Set(walk.map(sample => sample.frame)).size).toBeGreaterThanOrEqual(3)
  expect(new Set(walk.map(sample => sample.left)).size).toBeGreaterThan(1)
  expect(new Set(walk.map(sample => sample.rendered)).size).toBeGreaterThanOrEqual(3)
  expect(walk.every(sample => sample.requested?.includes('rook_walk_') && sample.rendered && sample.complete && sample.width > 0)).toBe(true)
  const speech = page.getByTestId('nonblocking-speech')
  await expect(speech).toHaveAttribute('data-delivery-key', 'S17.P08.TERMINAL_TALK.ROOK', { timeout: 15_000 })
  const firstKey = await speech.getAttribute('data-delivery-key')
  await page.getByTestId('verb-use').click()
  await expect(speech).toHaveAttribute('data-delivery-key', firstKey!)
  await page.keyboard.press('Space')
  await expect(speech).toHaveAttribute('data-delivery-key', 'S17.P08.TERMINAL_TALK.REPLY_1')
  await expect(speech).toHaveCSS('color', 'rgb(212, 215, 217)')
  expect(await speech.locator(':scope > span[aria-hidden="true"]:not(.full-delivery-measure)').textContent()).toBe('* AH-AH-AH *')
  const replyBox = (await speech.boundingBox())!
  const frameBox = (await page.locator('.a0-frame').boundingBox())!
  expect(replyBox.x).toBeGreaterThanOrEqual(frameBox.x)
  expect(replyBox.y).toBeGreaterThanOrEqual(frameBox.y)
  expect(replyBox.x + replyBox.width).toBeLessThanOrEqual(frameBox.x + frameBox.width)
  expect(replyBox.y + replyBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height)
  await page.keyboard.press('Space')
  await expect(speech).toHaveAttribute('data-delivery-key', 'S17.P08.TERMINAL_TALK.REPLY_2')
  expect(await speech.locator(':scope > span[aria-hidden="true"]:not(.full-delivery-measure)').textContent()).toBe("* YOU DIDN'T SAY THE MAGIC WORD! *")
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-visible-reply-raised.png'), fullPage: true })
})

test('R1 browser preserves the one Full-mode globe reveal exception and final-line BRCG unlock', async ({ page }) => {
  test.setTimeout(180_000)
  await openRoom(page, true)
  const optional = page.getByTestId('nonblocking-speech')
  for (let index = 0; index < 3; index += 1) {
    await act(page, 'push', 'office-globe')
    // Wait for semantic contact, not a transient "no sequence yet" before the
    // first approach has even reached the globe.
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-revision', String(index + 1), { timeout: 15_000 })
    if (index === 2) {
      await expect(optional).toHaveAttribute('data-delivery-key', 'r55-06f7c85f1a47a3c7bf5f')
      await expect(optional).toHaveAttribute('data-display-policy', 'TYPED')
    }
    await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 3_000 })
  }
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-level', '3')
  await expect(optional).toHaveAttribute('data-delivery-key', 'r55-06f7c85f1a47a3c7bf5f')
  await expect(optional.locator(':scope > span[aria-hidden="true"]:not(.full-delivery-measure)')).toHaveText('Wheeeeeeee!', { timeout: 2_000 })
  await drainSpeech(page)

  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await act(page, 'open', 'miscellaneous-drawer-cabinet'); await settleWorld(page)
  await act(page, 'pick-up', 'miscellaneous-catch-all-contents'); await settleWorld(page)
  await act(page, 'open', undefined, 'small-toolbox-closed'); await settleWorld(page)
  await act(page, 'use', undefined, 'hammer', 'piggy-bank-intact'); await settleWorld(page)
  await act(page, 'look-at', undefined, 'fictional-token-note')
  await expect(page.getByTestId('speech-panel')).toBeVisible()
  await page.keyboard.press('Space')
  // The full-screen advance catcher correctly blocks a physical click. Invoke
  // the underlying verb handler to prove even a delivered verb-only action
  // cannot mutate or prematurely finish the protected final note passage.
  await page.getByTestId('verb-use').dispatchEvent('click')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-note-read', 'UNREAD')
  await expect(page.getByTestId('speech-panel')).toBeVisible()
  await drainSpeech(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-note-read', 'BACK_READ')
  await page.screenshot({ path: resolve(evidenceDir, 'brcg-final-line-unlock.png'), fullPage: true })
})

test('Principal drawer correction binds each open-front hotspot and releases inspect before walking', async ({ page }) => {
  test.setTimeout(120_000)
  await openRoom(page, true)
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await act(page, 'open', 'official-case-file-cabinet'); await settleWorld(page)
  await act(page, 'open', 'miscellaneous-drawer-cabinet'); await settleWorld(page)

  const boxes = await page.evaluate(() => {
    const box = (id: string) => {
      const rect = document.querySelector<HTMLElement>(`[data-testid="hotspot-${id}"]`)!.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    return {
      official: box('official-case-file-cabinet'),
      officialContents: box('disorderly-stack-of-confidential-files'),
      misc: box('miscellaneous-drawer-cabinet'),
      miscContents: box('miscellaneous-catch-all-contents'),
    }
  })
  expect(boxes.officialContents.x).toBe(boxes.official.x)
  expect(boxes.officialContents.width).toBeLessThan(boxes.official.width)
  expect((boxes.officialContents.y - boxes.official.y) / boxes.official.height).toBeCloseTo(.25, 1)
  expect(boxes.miscContents.x).toBe(boxes.misc.x)
  expect(boxes.miscContents.width).toBeLessThan(boxes.misc.width)
  expect((boxes.miscContents.y - boxes.misc.y) / boxes.misc.height).toBeCloseTo(.63, 1)

  await act(page, 'look-at', 'miscellaneous-catch-all-contents')
  await settleWorld(page)
  await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'inspect')
  await page.getByTestId('records-office').click({ position: { x: 400, y: 300 } })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-facing', 'LEFT')
  const walkFrames = await page.evaluate(async () => {
    const values: string[] = []
    for (let index = 0; index < 9; index += 1) {
      values.push(document.querySelector<HTMLImageElement>('[data-testid="rook-animation"] img')?.dataset.renderedSrc ?? '')
      await new Promise(resolveWait => setTimeout(resolveWait, 45))
    }
    return values
  })
  expect(new Set(walkFrames.filter(Boolean)).size).toBeGreaterThanOrEqual(3)
  expect(walkFrames.every(frame => !frame || frame.includes('rook_walk_'))).toBe(true)
  await page.screenshot({ path: resolve(evidenceDir, 'drawer-hotspots-and-released-walk.png'), fullPage: true })
})

test('Routine inventory commentary stays neutral for every hammer line', async ({ page }) => {
  test.setTimeout(120_000)
  await openRoom(page, true)
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await act(page, 'open', 'miscellaneous-drawer-cabinet'); await settleWorld(page)
  await act(page, 'pick-up', 'miscellaneous-catch-all-contents'); await settleWorld(page)
  await act(page, 'open', undefined, 'small-toolbox-closed'); await settleWorld(page)

  await act(page, 'look-at', undefined, 'hammer')
  const optional = page.getByTestId('nonblocking-speech')
  const rook = page.getByTestId('rook-animation')
  await expect(optional).toHaveAttribute('data-delivery-key', 'r55-6ba2e71934277f9dfc24')
  await expect(rook).not.toHaveAttribute('data-requested-src', /rook_inspect_lean\.png/)
  await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'inspect')

  await page.keyboard.press('Space')
  await expect(optional).toHaveAttribute('data-delivery-key', 'r55-6ba2e71934277f9dfc24::2')
  await expect(rook).not.toHaveAttribute('data-requested-src', /rook_inspect_lean\.png/)
  await page.waitForTimeout(550)
  await expect(rook).not.toHaveAttribute('data-requested-src', /rook_inspect_lean\.png/)

  await page.keyboard.press('Space')
  await expect(optional).toHaveAttribute('data-delivery-key', 'r55-6ba2e71934277f9dfc24::3')
  await expect(rook).not.toHaveAttribute('data-requested-src', /rook_inspect_lean\.png/)
})

test('Principal terminal correction holds contact then renders the approved v0.13 shell contract', async ({ page }) => {
  test.setTimeout(120_000)
  await openRoom(page, true)
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await act(page, 'use', 'nansen-terminal')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-cue', 'rook.reach.neutral', { timeout: 15_000 })
  const reachAt = Date.now()
  await expect(page.getByTestId('case-terminal')).toHaveCount(0)
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 2_000 })
  // The semantic timer starts at the state commit just before Playwright can
  // observe the painted reach. Unit coverage owns the exact 750 ms contract.
  expect(Date.now() - reachAt).toBeGreaterThanOrEqual(250)

  const contract = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!)
    const image = document.querySelector<HTMLImageElement>('.s5-terminal-chrome')!
    return {
      binding: document.querySelector<HTMLElement>('.s16-terminal')!.dataset.prototypeBinding,
      screen: {
        width: style('.s16-terminal').width,
        height: style('.s16-terminal').height,
        padding: style('.s16-terminal').padding,
        grid: style('.s16-terminal').gridTemplateRows,
        fontSize: style('.s16-terminal').fontSize,
      },
      nav: { gap: style('.s16-nav').gap, margin: style('.s16-nav').margin, wrap: style('.s16-nav').flexWrap },
      degauss: { left: style('.s16-degauss').left, top: style('.s16-degauss').top, width: style('.s16-degauss').width, radius: style('.s16-degauss').borderRadius },
      effects: { scan: style('.s16-scanlines').animationName, noise: style('.s16-noise').animationName, band: Boolean(document.querySelector('.s16-signal-band')) },
      chrome: { src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight },
    }
  })
  expect(contract).toEqual({
    binding: 'TARKA_S16_TERMINAL_FLOW_PROTOTYPE_v0.13.0',
    screen: { width: '393px', height: '219px', padding: '5px', grid: '21px 18px 27px 119px 24px', fontSize: '16px' },
    nav: { gap: '13px', margin: '0px', wrap: 'nowrap' },
    degauss: { left: '386px', top: '238px', width: '19px', radius: '50%' },
    effects: { scan: 'scan-drift', noise: 'noise-step', band: true },
    chrome: { src: '/art-packs/production/files/included/core-v2.1/terminal/frame_on_480x270.png', width: 480, height: 270 },
  })
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-prototype-v013-binding.png'), fullPage: true })
  await page.getByRole('button', { name: 'BUILD QUERY', exact: true }).click()
  await page.getByRole('button', { name: 'RUN QUERY', exact: true }).click()
  await expect(page.getByText(/The three records describe two steps/)).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-prototype-post-query-case.png'), fullPage: true })
  await page.getByRole('button', { name: 'VIEW 3 MATCHES', exact: true }).click()
  await expect(page.locator('.s16-match-row')).toHaveCount(3)
  const matchColumns = await page.locator('.s16-match-row').evaluateAll(rows => rows.map(row => {
    const cells = [...row.children].map(cell => cell.getBoundingClientRect())
    return cells.every((cell, index) => index === 0 || cell.left >= cells[index - 1]!.right)
  }))
  expect(matchColumns).toEqual([true, true, true])
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-prototype-three-matches.png'), fullPage: true })
})

test.describe('R1 touch display input', () => {
  test.use({ hasTouch: true })
  test('touch can switch the compact Full/Typed control without advancing speech', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('trace-dialogue-delivery-v1'))
    await page.goto('/')
    await page.getByRole('button', { name: 'PLAY', exact: true }).tap()
    const speech = page.getByTestId('speech-panel')
    await expect(speech).toBeVisible({ timeout: 20_000 })
    const key = await speech.getAttribute('data-delivery-key')
    await page.getByTestId('mobile-playback-toggle').tap()
    const display = page.getByTestId('dialogue-display-toggle')
    await expect(display).toHaveText('TEXT · FULL')
    await display.tap()
    await expect(display).toHaveText('TEXT · TYPED')
    await expect(speech).toHaveAttribute('data-delivery-key', key!)
  })
})

test('R1 browser writer upgrades a migrated envelope and preserves it through a second reload', async ({ page }) => {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('trace-case-v1:')).length)).toBe(1)
  const storageKey = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith('trace-case-v1:'))!
    const current = JSON.parse(localStorage.getItem(key)!)
    const source = { fixtureId: current.fixtureId, fixtureMode: current.fixtureMode, fixtureOrigin: current.fixtureOrigin }
    const entries = [{ type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' }]
    localStorage.setItem(key, JSON.stringify({ ...source, saveVersion: 2, commands: { source, entries } }))
    return key
  })
  const expected = {
    saveVersion: 5,
    legacySource: {
      saveVersion: 2,
      entries: [{ type: 'EARN_ACCESS' }, { type: 'COLLECT_CASE_FILE' }],
    },
  }
  await page.reload()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey)).toMatchObject(expected)
  await page.reload()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey)).toMatchObject(expected)
})
