import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const evidenceDir = resolve('review/s17-p2-r2/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })
const fallbackUse = [
  'I don’t think so.', 'Those don’t really go together.', 'I don’t see how that helps us with the case.',
  'That feels like a bad idea.', 'I should probably keep those separate.',
]
const vhs = /play VHS tapes|first piece of good news today|doesn’t play them/i

async function freshReview(page: Page, phase: 'PEN_HELD' | 'FORM_COMPLETED' | 'COMPLETE') {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption(phase)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
}
async function drain(page: Page) {
  for (let guard = 0, quiet = 0; guard < 240 && quiet < 3; guard += 1) {
    const speech = page.locator('[data-testid="speech-panel"], [data-testid="nonblocking-speech"]')
    if (await speech.count()) {
      await page.keyboard.press('Space')
      quiet = 0
    } else if (await page.getByTestId('active-sequence').count() || await page.getByTestId('rook-sprite').getAttribute('data-animation') === 'walkEast') quiet = 0
    else quiet += 1
    await page.waitForTimeout(100)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
}
async function act(page: Page, verb: string, target: string, item?: string, item2?: string) {
  await page.getByTestId(`verb-${verb}`).click()
  if (item) await page.getByTestId(`inventory-${item}`).click()
  if (item2) await page.getByTestId(`inventory-${item2}`).click()
  else if (target) await page.getByTestId(`hotspot-${target}`).click({ force: true })
}
async function speechText(page: Page) {
  const speech = page.locator('[data-testid="speech-panel"], [data-testid="nonblocking-speech"]')
  await expect(speech).toBeVisible({ timeout: 20_000 })
  let value = (await speech.innerText()).replace(/\s+/g, ' ').trim()
  if (/CLICK OR SPACE TO REVEAL|REVEAL OPTIONAL LINE/.test(value)) {
    await page.keyboard.press('Space')
    value = (await speech.innerText()).replace(/\s+/g, ' ').trim()
  }
  return value
}
async function enterTerminal(page: Page) {
  await act(page, 'use', 'nansen-terminal')
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 20_000 })
  await page.evaluate(() => document.fonts.ready)
}

test('R2 focused browser routing keeps approved fallback, VHS, pen, no-op, and custom owners separate', async ({ page }) => {
  test.setTimeout(180_000)
  await freshReview(page, 'COMPLETE')

  await page.getByTestId('text-speed-menu').click()
  await page.getByRole('button', { name: 'Manual', exact: true }).click()
  const display = page.getByTestId('dialogue-display-toggle')
  if (await display.textContent() !== 'TEXT · FULL') await display.click()
  await act(page, 'talk-to', '', 'approved-stamped-terminal-authorization-form')
  let copy = await speechText(page)
  expect(copy).toMatch(/doesn.t want to hear|focusing on the case|one-sided|not on speaking terms/i)
  expect(copy).not.toMatch(vhs)
  await page.screenshot({ path: resolve(evidenceDir, 'routing-generic-talk-full.png'), fullPage: true })
  await drain(page)

  await page.getByTestId('text-speed-menu').click()
  if (await display.textContent() !== 'TEXT · TYPED') await display.click()
  await act(page, 'use', 'nansen-terminal', 'approved-stamped-terminal-authorization-form')
  copy = await speechText(page)
  expect(fallbackUse.some(line => copy.includes(line))).toBe(true)
  expect(copy).not.toMatch(vhs)
  await expect(page.getByTestId('case-terminal')).toHaveCount(0)
  await page.screenshot({ path: resolve(evidenceDir, 'routing-non-vhs-terminal-typed.png'), fullPage: true })
  await drain(page)

  await act(page, 'use', 'desk-lamp')
  expect(await speechText(page)).not.toMatch(vhs)
  await drain(page)

  await act(page, 'open', 'miscellaneous-drawer-cabinet')
  await drain(page)
  await act(page, 'pick-up', 'miscellaneous-catch-all-contents')
  await drain(page)
  await act(page, 'use', 'nansen-terminal', 'sharknado-2-vhs')
  expect(await speechText(page)).toMatch(vhs)
  await drain(page)
  await page.getByTestId('verb-use').click()
  await page.getByTestId('inventory-small-toolbox-closed').click()
  await drain(page)
  await expect(page.getByTestId('inventory-hammer')).toBeVisible()

  await freshReview(page, 'PEN_HELD')
  await act(page, 'use', 'desk-lamp', 'loose-feather-pen')
  copy = await speechText(page)
  expect(copy).toMatch(/ink|pen|quill|write|scrib/i)
  expect(copy).not.toMatch(vhs)
  await drain(page)

  await freshReview(page, 'FORM_COMPLETED')
  for (const [first, second] of [['broken-feather-pen', 'signed-terminal-authorization-form-with-doodles'], ['signed-terminal-authorization-form-with-doodles', 'broken-feather-pen']] as const) {
    await page.getByTestId('verb-use').click()
    await page.getByTestId(`inventory-${first}`).click()
    await page.getByTestId(`inventory-${second}`).click()
    expect(await speechText(page)).toContain('That won’t help.')
    await drain(page)
    await expect(page.getByTestId(`inventory-${first}`)).toBeVisible()
    await expect(page.getByTestId(`inventory-${second}`)).toBeVisible()
  }
})

test('R2 terminal fidelity lock captures all representative v0.13 states with fixed geometry and source return', async ({ page }) => {
  test.setTimeout(150_000)
  await freshReview(page, 'COMPLETE')
  await enterTerminal(page)
  const locked = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!)
    const size = (selector: string) => ({ width: style(selector).width, height: style(selector).height })
    return {
      binding: document.querySelector<HTMLElement>('.s16-terminal')!.dataset.prototypeBinding,
      screen: size('.s16-terminal'), padding: style('.s16-terminal').padding,
      rows: style('.s16-terminal').gridTemplateRows, fontSize: style('.s16-terminal').fontSize,
      scan: style('.s16-scanlines').animationName, noise: style('.s16-noise').animationName,
      aperture: size('.s5-screen-aperture'), stage: size('.s5-native-terminal'),
    }
  })
  expect(locked).toEqual({
    binding: 'TARKA_S16_TERMINAL_FLOW_PROTOTYPE_v0.13.0', screen: { width: '393px', height: '219px' }, padding: '5px',
    rows: '21px 18px 27px 119px 24px', fontSize: '16px', scan: 'scan-drift', noise: 'noise-step',
    aperture: { width: '393px', height: '219px' }, stage: { width: '480px', height: '270px' },
  })
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-01-case-with-file.png'), fullPage: true })

  await page.getByRole('button', { name: 'BUILD QUERY', exact: true }).click()
  await page.getByRole('button', { name: 'RUN QUERY', exact: true }).click()
  await expect(page.getByText(/The three records describe two steps:/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'VIEW 3 MATCHES', exact: true })).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-02-post-query-case.png'), fullPage: true })

  const matches = page.getByRole('button', { name: 'VIEW 3 MATCHES', exact: true })
  await matches.focus()
  await matches.click()
  await expect(page.locator('.s16-match-row')).toHaveCount(3)
  await page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER', exact: true }).focus()
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-03-three-matches-focus-matched.png'), fullPage: true })

  await page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER', exact: true }).click()
  await expect(page.getByRole('button', { name: 'MORE DETAILS', exact: true })).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-04-record-summary.png'), fullPage: true })
  await page.getByRole('button', { name: 'MORE DETAILS', exact: true }).click()
  await expect(page.getByText('TRANSACTION DETAILS', { exact: true })).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-05-source-page.png'), fullPage: true })
  await page.getByRole('button', { name: /←/ }).click()
  await expect(page.getByRole('button', { name: 'MORE DETAILS', exact: true })).toBeVisible()

  const degauss = page.getByRole('button', { name: /DEGAUSS/i })
  const beforeMask = await page.locator('.s5-screen-aperture').boundingBox()
  await expect(page.locator('.s5-screen-aperture')).toHaveCSS('overflow', 'hidden')
  await degauss.click()
  await expect(page.locator('.s5-native-terminal')).toHaveClass(/is-degaussing/)
  await page.waitForTimeout(180)
  const mask = await page.locator('.s5-screen-aperture').boundingBox()
  const screen = await page.locator('.s16-terminal').boundingBox()
  expect(mask).toEqual(beforeMask)
  expect(screen).not.toEqual(mask)
  await page.screenshot({ path: resolve(evidenceDir, 'terminal-06-masked-degauss.png'), fullPage: true })
})
