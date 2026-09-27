import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { progressionChain } from '../fixtures/s2/domain-helpers'

const evidenceDir = resolve('review/s17-p1/PHASE_B/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function openRoom(page: Page) {
  await page.goto('/?skipIntro=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-art-pack', 'production')
}

async function drainRoom(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 600 && quiet < 4; guard += 1) {
    if (await page.getByTestId('speech-panel').count() || await page.getByTestId('nonblocking-speech').count()) {
      await page.keyboard.press('Space')
      quiet = 0
    } else if (await page.getByTestId('active-sequence').count() || await page.getByTestId('rook-sprite').getAttribute('data-animation') === 'walkEast') {
      quiet = 0
    } else quiet += 1
    await page.waitForTimeout(70)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
}

async function choose(page: Page, id: string) {
  await page.getByTestId(id).click()
}

test('B03/B04/B08 production walking, stable assets, verb isolation and terminal speech', async ({ page }) => {
  test.setTimeout(120_000)
  await openRoom(page)

  await choose(page, 'verb-open')
  await choose(page, 'hotspot-official-case-file-cabinet')
  const rook = page.getByTestId('rook-sprite')
  await expect(rook).toHaveAttribute('data-animation', 'walkEast')
  const walk = await page.evaluate(async () => {
    const sprite = document.querySelector<HTMLElement>('[data-testid="rook-sprite"]')!
    const animation = document.querySelector<HTMLElement>('[data-testid="rook-animation"]')!
    const image = animation.querySelector<HTMLImageElement>('img')!
    const spriteNode = sprite
    const animationNode = animation
    const samples: Array<{ frame: string | null; src: string | null; rendered: string | null; left: string; complete: boolean; width: number }> = []
    for (let index = 0; index < 28; index += 1) {
      samples.push({
        frame: animation.getAttribute('data-frame-index'),
        src: animation.getAttribute('data-requested-src'),
        rendered: image.getAttribute('data-rendered-src'),
        left: sprite.style.left,
        complete: image.complete,
        width: image.naturalWidth,
      })
      await new Promise(resolveWait => setTimeout(resolveWait, 45))
    }
    return { samples, sameSprite: sprite === spriteNode, sameAnimation: animation === animationNode }
  })
  expect(walk.sameSprite && walk.sameAnimation).toBe(true)
  expect(new Set(walk.samples.map(sample => sample.frame)).size).toBeGreaterThanOrEqual(3)
  expect(new Set(walk.samples.map(sample => sample.left)).size).toBeGreaterThan(1)
  expect(walk.samples.every(sample => sample.src?.includes('rook_walk_') && sample.rendered && sample.complete && sample.width > 0)).toBe(true)
  await page.screenshot({ path: resolve(evidenceDir, 'B03-walk-cycle-live.png') })
  await drainRoom(page)

  await choose(page, 'verb-talk-to')
  await choose(page, 'hotspot-nansen-terminal')
  await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-delivery-key', 'S17.P08.TERMINAL_TALK.ROOK')
  const firstKey = await page.getByTestId('nonblocking-speech').getAttribute('data-delivery-key')
  await choose(page, 'verb-use')
  await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-delivery-key', firstKey!)
  await page.keyboard.press('Space')
  await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-delivery-key', 'S17.P08.TERMINAL_TALK.REPLY_1')
  await expect(page.getByTestId('nonblocking-speech')).toHaveCSS('color', 'rgb(212, 215, 217)')
  expect(await page.getByTestId('nonblocking-speech').getAttribute('aria-label')).toContain('* AH-AH-AH *')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-delivery-key', 'S17.P08.TERMINAL_TALK.REPLY_2')
  expect(await page.getByTestId('nonblocking-speech').getAttribute('aria-label')).toContain("* YOU DIDN'T SAY THE MAGIC WORD! *")
  await page.screenshot({ path: resolve(evidenceDir, 'B08-terminal-literal-light-grey.png') })
  await page.keyboard.press('Space')
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)

  await choose(page, 'verb-look-at')
  await choose(page, 'hotspot-coffee-mug')
  await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
  const coffeeKey = await page.getByTestId('nonblocking-speech').getAttribute('data-delivery-key')
  await choose(page, 'verb-look-at')
  await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-delivery-key', coffeeKey!)
  await choose(page, 'hotspot-desk-lamp')
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
  await drainRoom(page)
})

test('B06 production form uses one signed paper through receive, review, return and stamp', async ({ page }) => {
  test.setTimeout(180_000)
  await openRoom(page)
  for (const [verb, hotspot, item, item2, , phase] of progressionChain.slice(0, -1)) {
    await choose(page, `verb-${String(verb).toLowerCase().replace('_', '-')}`)
    if (item) await choose(page, `inventory-${item}`)
    if (hotspot) await choose(page, `hotspot-${hotspot}`)
    else if (item2) await choose(page, `inventory-${item2}`)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
    await drainRoom(page)
  }
  const signed = page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles').locator('img')
  await expect(signed).toHaveAttribute('src', /ticket_filled\.png$/)
  await page.screenshot({ path: resolve(evidenceDir, 'B06-signed-form-inventory.png') })

  await choose(page, 'verb-give')
  await choose(page, 'inventory-signed-terminal-authorization-form-with-doodles')
  await choose(page, 'hotspot-mr-index')

  const observations: Array<{ action: string; owner: string; pose: string; src: string | null; approved: string | null }> = []
  const captured = new Set<string>()
  for (let guard = 0; guard < 900; guard += 1) {
    const sequence = page.getByTestId('active-sequence')
    if (await sequence.count()) {
      const action = await sequence.getAttribute('data-action-id') ?? ''
      const owner = await sequence.getAttribute('data-form-paper-owner') ?? ''
      const pose = await sequence.getAttribute('data-physical-pose') ?? ''
      const paper = page.getByTestId('visible-form-paper')
      const src = await paper.count() ? await paper.getAttribute('src') : null
      const approved = await paper.count() ? await paper.getAttribute('data-approved') : null
      observations.push({ action, owner, pose, src, approved })
      if (['receive', 'handoff', 'return', 'stamp'].includes(action) && !captured.has(action)) {
        captured.add(action)
        await page.screenshot({ path: resolve(evidenceDir, `B06-form-${action}.png`) })
      }
    }
    if (await page.getByTestId('speech-panel').count()) await page.keyboard.press('Space')
    if (!await sequence.count() && !await page.getByTestId('speech-panel').count() && await page.getByTestId('a0-shell').getAttribute('data-phase') === 'COMPLETE') break
    await page.waitForTimeout(70)
  }
  expect(captured).toEqual(new Set(['receive', 'handoff', 'return', 'stamp']))
  // Arthur's receive beat deliberately keeps Rook neutral so both characters
  // never appear to hold the same paper at the handoff instant.
  expect(observations.find(row => row.action === 'receive')).toMatchObject({ owner: 'ROOK_VISIBLE', pose: 'IDLE' })
  expect(observations.find(row => row.action === 'handoff')).toMatchObject({ owner: 'ARTHUR_VISIBLE', pose: 'EMPTY_HAND_REACH', src: null })
  expect(observations.find(row => row.action === 'return')).toMatchObject({ owner: 'ROOK_VISIBLE', pose: 'PAPER_REACH' })
  expect(observations.find(row => row.action === 'stamp')).toMatchObject({ owner: 'ROOK_VISIBLE', pose: 'STAMP_USE', approved: null, src: null })
  await expect(page.getByTestId('visible-form-paper')).toHaveCount(0)
  await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form').locator('img')).toHaveAttribute('src', /ticket_stamped_OK\.png$/)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE')
})
