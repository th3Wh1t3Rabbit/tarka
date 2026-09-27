import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const evidenceDir = resolve('artifacts/s14-r6/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function guardedPage(context: BrowserContext) {
  const external: string[] = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await context.routeWebSocket('**/*', socket => socket.close())
  const page = await context.newPage()
  await page.goto('/?skipIntro=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  if (await play.isVisible()) await play.click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
  return { page, external }
}

async function drain(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 240; guard += 1) {
    const blocking = page.getByTestId('speech-panel')
    const nonblocking = page.getByTestId('nonblocking-speech')
    if (await blocking.count()) { await page.keyboard.press('Space'); quiet = 0 }
    else if (await nonblocking.count()) { await page.keyboard.press('Space'); quiet = 0 }
    else if (await page.getByTestId('active-sequence').count() || (await page.getByTestId('rook-sprite').getAttribute('data-animation'))?.startsWith('walk')) quiet = 0
    else if (++quiet >= 3) return
    await page.waitForTimeout(100)
  }
  throw new Error('S14-R6 action did not settle')
}

async function currentCopy(page: Page, copyKey: string) {
  await expect(page.locator(`[data-copy-key="${copyKey}"], [data-delivery-key="${copyKey}"]`)).toBeVisible({ timeout: 20_000 })
}

async function inspectForm(page: Page) {
  await page.getByTestId('verb-look-at').click()
  await page.getByTestId('inventory-blank-terminal-authorization-form').click()
  await currentCopy(page, 'r55-e238d1412af172db544e')
  await page.keyboard.press('Space')
  await currentCopy(page, 'r55-e238d1412af172db544e::2')
  await page.keyboard.press('Space')
  await currentCopy(page, 'r55-63348fda31585c92f1ff')
  await drain(page)
}

async function inspectPen(page: Page) {
  await page.getByTestId('verb-look-at').click()
  await page.getByTestId('inventory-loose-feather-pen').click()
  await currentCopy(page, 'r55-b5485c6a346b96e0542d')
  await drain(page)
}

test('form then pen uses silent mouse pickup, keyboard pen pickup, and separate inventory LOOK copy', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const { page, external } = await guardedPage(context)

  await page.getByTestId('verb-pick-up').click()
  await page.getByTestId('hotspot-blank-authorization-form').click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_HELD', { timeout: 20_000 })
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
  await expect(page.getByTestId('hotspot-blank-authorization-form')).toHaveCount(0)
  await expect(page.getByTestId('hotspot-request-dispenser')).toBeVisible()
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 20_000 })

  await page.keyboard.press('2')
  await page.getByTestId('hotspot-pen-stand').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_AND_PEN', { timeout: 20_000 })
  await currentCopy(page, 'OVR-PEN-01')
  await expect(page.getByTestId('hotspot-pen-stand')).toHaveCount(0)
  await drain(page)

  await inspectForm(page)
  await inspectPen(page)
  await page.screenshot({ path: resolve(evidenceDir, '01-form-then-pen-mouse-keyboard.png') })
  expect(external).toEqual([])
  await context.close()
})

test('pen then PULL preserves the form, then real-touch PICK UP works and survives re-entry', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })
  const { page, external } = await guardedPage(context)

  await page.getByTestId('verb-pick-up').tap()
  await page.getByTestId('hotspot-pen-stand').tap()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'PEN_HELD', { timeout: 20_000 })
  await currentCopy(page, 'OVR-PEN-01')
  await drain(page)

  await page.getByTestId('verb-pull').tap()
  await page.getByTestId('hotspot-blank-authorization-form').tap()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'PEN_HELD', { timeout: 20_000 })
  await expect(page.getByTestId('hotspot-blank-authorization-form')).toBeVisible()
  await drain(page)

  await page.getByTestId('verb-pick-up').tap()
  await page.getByTestId('hotspot-blank-authorization-form').tap()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_AND_PEN', { timeout: 20_000 })
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
  await expect(page.getByTestId('hotspot-blank-authorization-form')).toHaveCount(0)
  await expect(page.getByTestId('hotspot-pen-stand')).toHaveCount(0)

  await inspectForm(page)
  await inspectPen(page)
  await page.reload()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
  await expect(page.getByTestId('hotspot-pen-stand')).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, '02-pen-then-form-touch-reentry.png') })
  expect(external).toEqual([])
  await context.close()
})
