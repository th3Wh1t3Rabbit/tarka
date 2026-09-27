import { expect, test, type Page } from '@playwright/test'

async function openRoom(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('trace-dialogue-delivery-v1', JSON.stringify({ mode: 'MANUAL', pace: 'NORMAL', display: 'FULL' }))
  })
  await page.goto('/?skipIntro=1&review=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  if (await play.isVisible()) await play.click()
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
}

async function act(page: Page, verb: string, target: string) {
  await page.getByTestId(`verb-${verb}`).click()
  await page.getByTestId(`hotspot-${target}`).click()
}

async function drainSpeech(page: Page) {
  for (let guard = 0; guard < 80 && await page.getByTestId('speech-panel').count(); guard += 1) {
    await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(20)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
}

test('official file extraction uses drawer 2, a normal empty-hand reach, and persistent remaining files', async ({ page }) => {
  await openRoom(page)
  await act(page, 'open', 'official-case-file-cabinet')
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 10_000 })
  const cabinet = page.getByTestId('layout-official-cabinet')
  const contents = page.getByTestId('hotspot-disorderly-stack-of-confidential-files')
  await expect(cabinet).toHaveAttribute('data-frame-src', /drawer_02_filed_open\.png/, { timeout: 10_000 })
  await expect(contents).toBeVisible()

  const band = await page.evaluate(() => {
    const outer = document.querySelector<HTMLElement>('[data-testid="hotspot-official-case-file-cabinet"]')!.getBoundingClientRect()
    const inner = document.querySelector<HTMLElement>('[data-testid="hotspot-disorderly-stack-of-confidential-files"]')!.getBoundingClientRect()
    return (inner.y - outer.y) / outer.height
  })
  expect(band).toBeCloseTo(.25, 1)

  await act(page, 'look-at', 'disorderly-stack-of-confidential-files')
  await expect(page.getByTestId('nonblocking-speech')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'talk', { timeout: 2_000 })
  await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-cue', 'rook.inspect-lean')

  await page.evaluate(() => {
    const samples: Array<{ action: string | null; contact: string | null; pose: string | null; animation: string | null; cue: string | null }> = []
    ;(window as typeof window & { __drawerRouteSamples?: typeof samples }).__drawerRouteSamples = samples
    const take = () => {
      const sequence = document.querySelector<HTMLElement>('[data-testid="active-sequence"]')
      const rook = document.querySelector<HTMLElement>('[data-testid="rook-sprite"]')
      samples.push({ action: sequence?.dataset.actionId ?? null, contact: sequence?.dataset.contact ?? null, pose: sequence?.dataset.physicalPose ?? null, animation: rook?.dataset.animation ?? null, cue: rook?.dataset.cue ?? null })
    }
    new MutationObserver(take).observe(document.body, { subtree: true, childList: true, attributes: true })
    take()
  })
  await act(page, 'pick-up', 'disorderly-stack-of-confidential-files')
  const sequence = page.getByTestId('active-sequence')
  await expect(sequence).toHaveAttribute('data-action-id', 'search-dialogue', { timeout: 10_000 })
  await expect(page.getByTestId('speech-panel')).toBeVisible({ timeout: 15_000 })
  await drainSpeech(page)
  await expect.poll(() => page.evaluate(() => {
    const samples = (window as typeof window & { __drawerRouteSamples?: Array<{ action: string | null; contact: string | null; pose: string | null; animation: string | null; cue: string | null }> }).__drawerRouteSamples ?? []
    return samples.some((sample) => sample.action === 'collect' && sample.contact === 'CONTACT.CASEFILE_COLLECT' && sample.pose === 'EMPTY_HAND_REACH' && sample.animation === 'reach' && sample.cue === 'rook.reach.neutral')
  })).toBe(true)
  await expect.poll(() => page.evaluate(() => {
    const rook = document.querySelector<HTMLElement>('[data-testid="rook-sprite"]')!
    const contents = document.querySelector<HTMLElement>('[data-testid="hotspot-disorderly-stack-of-confidential-files"]')!
    const rookCenter = rook.getBoundingClientRect().x + rook.getBoundingClientRect().width / 2
    const targetCenter = contents.getBoundingClientRect().x + contents.getBoundingClientRect().width / 2
    return rook.dataset.facing === (targetCenter < rookCenter ? 'LEFT' : 'RIGHT')
  })).toBe(true)
  await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible()
  await expect(sequence).toHaveAttribute('data-action-id', 'recite-file', { timeout: 10_000 })
  await drainSpeech(page)
  await expect(sequence).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-stack', 'SEARCHED_EULER_REMOVED')
  await expect(contents).toBeVisible()
  await expect(cabinet).toHaveAttribute('data-frame-src', /drawer_02_filed_open\.png/)

  await act(page, 'pick-up', 'disorderly-stack-of-confidential-files')
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
  await expect(page.getByTestId('inventory-euler-case-file')).toHaveCount(1)
  await expect(contents).toBeVisible()
  await expect(cabinet).toHaveAttribute('data-frame-src', /drawer_02_filed_open\.png/)

  await page.getByTestId('records-office').click({ position: { x: 200, y: 330 } })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
  await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-cue', 'rook.drawer-extract')
})

test('misc extraction uses the bottom drawer, keeps junk and hotspot, and releases its held pose', async ({ page }) => {
  test.setTimeout(120_000)
  await openRoom(page)
  await act(page, 'open', 'miscellaneous-drawer-cabinet')
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 10_000 })
  const cabinet = page.getByTestId('layout-misc-cabinet')
  const contents = page.getByTestId('hotspot-miscellaneous-catch-all-contents')
  await expect(cabinet).toHaveAttribute('data-frame-src', /drawer_04_open\.png/)
  await expect(page.getByTestId('misc-drawer-junk')).toHaveAttribute('data-frame-src', /misc_open_junk\.png/)
  await expect(page.getByTestId('misc-drawer-junk')).toHaveAttribute('data-persistence', 'always-while-open')
  await expect(contents).toBeVisible()

  const band = await page.evaluate(() => {
    const outer = document.querySelector<HTMLElement>('[data-testid="hotspot-miscellaneous-drawer-cabinet"]')!.getBoundingClientRect()
    const inner = document.querySelector<HTMLElement>('[data-testid="hotspot-miscellaneous-catch-all-contents"]')!.getBoundingClientRect()
    return (inner.y - outer.y) / outer.height
  })
  expect(band).toBeCloseTo(.63, 1)

  await act(page, 'pick-up', 'miscellaneous-catch-all-contents')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-contact', 'CONTACT.DRAWER_PICKUP_1', { timeout: 10_000 })
  await expect.poll(() => page.evaluate(() => {
    const rook = document.querySelector<HTMLElement>('[data-testid="rook-sprite"]')!
    const contents = document.querySelector<HTMLElement>('[data-testid="hotspot-miscellaneous-catch-all-contents"]')!
    const rookCenter = rook.getBoundingClientRect().x + rook.getBoundingClientRect().width / 2
    const targetCenter = contents.getBoundingClientRect().x + contents.getBoundingClientRect().width / 2
    return { actual: rook.dataset.facing, expected: targetCenter < rookCenter ? 'LEFT' : 'RIGHT', rookCenter, targetCenter }
  })).toMatchObject({ actual: 'RIGHT', expected: 'RIGHT' })
  for (let guard = 0; guard < 120 && await page.getByTestId('active-sequence').count(); guard += 1) {
    if (await page.getByTestId('speech-panel').count()) await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(50)
  }
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-contents', 'COLLECTED_GUM_REMAINS')
  await expect(contents).toBeVisible()
  await expect(cabinet).toHaveAttribute('data-frame-src', /drawer_04_open\.png/)
  await expect(page.getByTestId('misc-drawer-junk')).toHaveAttribute('data-persistence', 'always-while-open')

  await act(page, 'look-at', 'miscellaneous-catch-all-contents')
  await expect(page.getByTestId('nonblocking-speech')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'talk', { timeout: 2_000 })
  await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-cue', 'rook.inspect-lean')
  await expect(contents).toBeVisible()
  await act(page, 'pick-up', 'miscellaneous-catch-all-contents')
  await drainSpeech(page)
  for (const item of ['rubber-band', 'rubiks-cube', 'sharknado-2-vhs', 'piggy-bank-intact', 'small-toolbox-closed']) {
    await expect(page.getByTestId(`inventory-${item}`)).toHaveCount(1)
  }
  await expect(contents).toBeVisible()

  await page.getByTestId('records-office').click({ position: { x: 180, y: 330 } })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
  await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-cue', 'rook.drawer-extract')
})
