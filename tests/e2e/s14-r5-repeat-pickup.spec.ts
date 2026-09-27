import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const evidenceDir = resolve('artifacts/s14-r5/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function drain(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 240; guard++) {
    const blocking = page.getByTestId('speech-panel')
    const nonblocking = page.getByTestId('nonblocking-speech')
    if (await blocking.count()) { await page.keyboard.press('Space'); quiet = 0 }
    else if (await nonblocking.count()) { await page.keyboard.press('Space'); quiet = 0 }
    else if (await page.getByTestId('active-sequence').count() || (await page.getByTestId('rook-sprite').getAttribute('data-animation'))?.startsWith('walk')) quiet = 0
    else if (++quiet >= 3) return
    await page.waitForTimeout(100)
  }
  throw new Error('S14-R5 speech did not drain')
}

async function act(page: Page, verb: string, target: string) {
  await page.getByTestId(`verb-${verb}`).click()
  await page.getByTestId(`hotspot-${target}`).click()
}

test('case-stack and miscellaneous repeat PICK UP remain target-specific through re-entry', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const external: string[] = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await context.routeWebSocket('**/*', socket => socket.close())
  await page.goto('/?skipIntro=1&review=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  if (await play.isVisible()) await play.click()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE')

  await act(page, 'open', 'official-case-file-cabinet')
  await drain(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'OPEN')
  await act(page, 'pick-up', 'disorderly-stack-of-confidential-files')
  await drain(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-stack', 'SEARCHED_EULER_REMOVED')
  await page.keyboard.press('2')
  await page.getByTestId('hotspot-disorderly-stack-of-confidential-files').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-copy-key', 'r55-1f6d1bb98c54539ca352', { timeout: 20_000 })
  await page.screenshot({ path: resolve(evidenceDir, '01-case-stack-repeat.png') })
  await drain(page)

  await act(page, 'open', 'miscellaneous-drawer-cabinet')
  await drain(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'OPEN')
  await act(page, 'pick-up', 'miscellaneous-catch-all-contents')
  await drain(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-contents', 'COLLECTED_GUM_REMAINS')
  await page.getByTestId('verb-pick-up').tap()
  await page.getByTestId('hotspot-miscellaneous-catch-all-contents').tap()
  await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-copy-key', 'r55-23e1467abef6cb642759', { timeout: 20_000 })
  await page.screenshot({ path: resolve(evidenceDir, '02-misc-contents-repeat.png') })
  expect(external).toEqual([])
  await context.close()
})
