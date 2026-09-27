import { expect, test } from '@playwright/test'

const exactDataSourceCopy = ['NANSEN API', 'ETHEREUM', 'EULER FINANCE · MARCH 13, 2023', 'FROZEN HISTORICAL CASE SNAPSHOT']
const exactAboutCopy = 'TARKA (तर्क) — REASONING, LOGIC, INQUIRY. TEST A VIEW, EXCLUDE UNTENABLE ALTERNATIVES, AND CLOSE ONLY WHAT EXACT EVIDENCE SUPPORTS.'

const exactTitleCopy = [
  'TARKA',
  'A PIXEL RETRO',
  'NANSEN INVESTIGATION',
  'CREATED FOR THE',
  'NANSEN MERIDIAN BUILDATHON',
  'SEPTEMBER 14 TO 27, 2026',
  '[ PLAY ]',
  'CREDITS',
  'POWERED BY NANSEN API',
]

test('Tarka title is the initial exact two-control production surface', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Tarka — A Pixel Retro Nansen Investigation')
  const title = page.getByTestId('tarka-title-screen')
  await expect(title).toBeVisible()
  await expect(title).toHaveAttribute('data-testid', 'tarka-title-screen')
  const text = await title.innerText()
  for (const line of exactTitleCopy) expect(text).toContain(line)
  await expect(title.getByRole('button')).toHaveCount(2)
  await expect(title.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible()
  await expect(title.getByRole('button', { name: 'CREDITS' })).toBeVisible()
  await expect(title.getByText(/CONTINUE|SAVE|LOAD|SETTINGS|OPTIONS|ACCESSIBILITY|PLAIN LIST/i)).toHaveCount(0)
  expect(text).not.toContain('TRACE//ESCAPE')

  await expect(title.getByRole('heading', { name: 'TARKA' })).toHaveCSS('font-size', '46px')
  await expect(title.getByText('A PIXEL RETRO', { exact: false })).toHaveCSS('font-size', '17px')
  await expect(title.getByText('CREATED FOR THE', { exact: false })).toHaveCSS('font-size', '13px')
  const date = title.getByText('SEPTEMBER 14 TO 27, 2026', { exact: true })
  await expect(date).toHaveCSS('font-size', '12px')
  expect(await date.evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size
  })).toBe(1)
  const [nativeBox, dateBox] = await Promise.all([
    title.locator('.tarka-launch-native').boundingBox(),
    date.boundingBox(),
  ])
  expect(nativeBox).not.toBeNull()
  expect(dateBox).not.toBeNull()
  expect(dateBox!.x).toBeGreaterThanOrEqual(nativeBox!.x)
  expect(dateBox!.x + dateBox!.width).toBeLessThanOrEqual(nativeBox!.x + nativeBox!.width)
})

test('pointer PLAY starts a fresh opening and ignores stale run state', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('trace-case-v1:stale', '{"complete":true}')
    localStorage.setItem('trace-escape.dev-library', 'preserved')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  const game = page.getByTestId('a0-shell')
  await expect(game).toBeVisible()
  await expect(game).toHaveAttribute('data-phase', 'START')
  await expect(page.getByTestId('case-terminal')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('trace-case-v1:stale'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('trace-escape.dev-library'))).toBe('preserved')
})

test('keyboard Credits opens, Escape returns, and focus restores to Credits', async ({ page }) => {
  await page.goto('/')
  const credits = page.getByRole('button', { name: 'CREDITS' })
  await credits.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('tarka-credits-screen')).toBeVisible()
  for (const heading of ['CREATED BY', 'CONTRIBUTORS', 'DATA / SOURCES / ATTRIBUTION', 'ABOUT THE TITLE']) await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  const createdBy = page.getByTestId('credits-created-by')
  await expect(createdBy).toContainText('th3Wh1t3Rabbit')
  await expect(createdBy.getByRole('link', { name: 'GitHub profile for th3Wh1t3Rabbit' })).toHaveAttribute('href', 'https://github.com/th3Wh1t3Rabbit/tarka')
  await expect(createdBy.getByRole('link', { name: 'X profile for th3Wh1t3Rabbit' })).toHaveAttribute('href', 'https://x.com/th3Wh1t3Rabbit')
  await expect(createdBy.getByRole('link', { name: 'Buy Me a Coffee profile for th3Wh1t3Rabbit' })).toHaveAttribute('href', 'https://buymeacoffee.com/th3Wh1t3Rabbit')
  await expect(page.getByTestId('credits-contributors')).toHaveText('CONTRIBUTORS')
  await expect(page.getByTestId('credits-data-sources').locator('p > span')).toHaveText(exactDataSourceCopy)
  await expect(page.getByTestId('credits-about-title').locator('p')).toHaveText(exactAboutCopy)
  await expect(page.getByText(/TRACE ESCAPE CODEX|TRACE ESCAPE CURSOR|TODO|PENDING|TO BE ADDED/i)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
  await expect(credits).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('tarka-credits-screen')).toBeVisible()
})

test('pointer Credits opens and RETURN restores focus', async ({ page }) => {
  await page.goto('/')
  const credits = page.getByRole('button', { name: 'CREDITS' })
  await credits.click()
  await expect(page.getByTestId('tarka-credits-screen')).toBeVisible()
  await page.getByRole('button', { name: 'RETURN' }).click()
  await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
  await expect(credits).toBeFocused()
})

test.describe('real touch title activation', () => {
  test.use({ hasTouch: true })
  test('touch PLAY reaches the current production opening', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'PLAY', exact: true }).tap()
    await expect(page.getByTestId('a0-shell')).toBeVisible()
  })
  test('touch Credits opens and RETURN restores focus', async ({ page }) => {
    await page.goto('/')
    const credits = page.getByRole('button', { name: 'CREDITS' })
    await credits.tap()
    await expect(page.getByTestId('tarka-credits-screen')).toBeVisible()
    await page.getByRole('button', { name: 'RETURN' }).tap()
    await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
    await expect(credits).toBeFocused()
  })
})

test('production title reaches authorized fullscreen CRT through ordinary controls', async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  expect(testInfo.project.use.baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  await page.goto('/')
  expect(new URL(page.url()).search).toBe('')
  await expect(page.getByTestId('tarka-title-screen')).toContainText('TARKA')
  await expect(page.getByLabel('Jump to puzzle state')).toHaveCount(0)
  await expect(page.getByText(/review=1|skipIntro=1|r55Review=1/i)).toHaveCount(0)
  const titlePath = testInfo.outputPath('01-title.png')
  await page.screenshot({ path: titlePath })
  await testInfo.attach('title', { path: titlePath, contentType: 'image/png' })
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  const drainSpeech = async () => {
    for (let round = 0; round < 260; round++) {
      await expect.poll(async () => page.getByTestId('rook-sprite').getAttribute('data-animation'), { timeout: 20_000 }).not.toBe('walkEast')
      const panel = page.getByTestId('speech-panel')
      if (await panel.count()) {
        const catchSurface = page.getByTestId('talk-advance-catch')
        await (await catchSurface.count() ? catchSurface : panel).click()
        continue
      }
      if (await page.getByTestId('active-sequence').count()) {
        await page.waitForTimeout(100)
        continue
      }
      await page.waitForTimeout(150)
      if (!(await panel.count())) return
    }
    throw new Error('Speech did not drain through visible pointer controls')
  }
  await drainSpeech()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'true')

  const act = async (verb: string, target: string, phase: string, item?: string) => {
    await page.getByTestId(`verb-${verb}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    await page.getByTestId(`hotspot-${target}`).click()
    if (phase === 'COMPLETE') {
      await drainSpeech()
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
    } else {
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
      await drainSpeech()
    }
  }
  await act('pick-up', 'blank-authorization-form', 'FORM_HELD')
  await act('pick-up', 'pen-stand', 'FORM_AND_PEN')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('inventory-blank-terminal-authorization-form').click()
  await page.getByTestId('inventory-loose-feather-pen').click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_COMPLETED')
  await expect(page.getByTestId('inventory-broken-feather-pen')).toBeVisible()
  await expect(page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles')).toBeVisible()
  await drainSpeech()
  await act('give', 'mr-index', 'COMPLETE', 'signed-terminal-authorization-form-with-doodles')
  await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toBeVisible()
  const authorizationPath = testInfo.outputPath('02-authorized.png')
  await page.screenshot({ path: authorizationPath })
  await testInfo.attach('authorization', { path: authorizationPath, contentType: 'image/png' })
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click()
  await expect(page.getByTestId('terminal-viewport')).toHaveAttribute('data-logical-size', '480x270')
  await expect(page.getByTestId('case-terminal')).toHaveClass(/mode-fullscreen_crt/)
  await expect(page.getByTestId('records-office')).toHaveCount(0)
  await expect(page.getByTestId('adventure-interface-band')).toHaveCount(0)
  const crtPath = testInfo.outputPath('03-fullscreen-crt.png')
  await page.screenshot({ path: crtPath })
  await testInfo.attach('fullscreen-crt', { path: crtPath, contentType: 'image/png' })
  await page.getByTestId('terminal-section-case').click()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'CASE')
})

test('authorized terminal remains one 480x270 fullscreen game surface', async ({ page }) => {
  await page.goto('/?review=1&skipIntro=1')
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click()
  await expect(page.getByTestId('terminal-viewport')).toHaveAttribute('data-logical-size', '480x270')
  await expect(page.getByTestId('case-terminal')).toHaveClass(/mode-fullscreen_crt/)
  await expect(page.getByTestId('records-office')).toHaveCount(0)
  await expect(page.getByTestId('adventure-interface-band')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /presentation/i })).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'BUILD QUERY', exact: true }).click()
  await page.getByRole('button', { name: 'RUN QUERY', exact: true }).click()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
  await expect(page.getByText(/THE THREE RECORDS DESCRIBE TWO STEPS/i).first()).toBeVisible()
})
