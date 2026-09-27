import { expect, test, type Page } from '@playwright/test'
import { setup, tabTo } from '../fixtures/s2/browser-helpers'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'

test.use({ hasTouch: true })
test.setTimeout(180_000)

const STORY_KEY = 'TODO.STORY.PREAUTH_CABINET_POLICY_BLOCK'
const PAIRS = [
  ['OPEN', 'Official case-file cabinet'],
  ['USE', 'Official case-file cabinet'],
  ['PULL', 'Official case-file cabinet'],
  ['OPEN', 'Miscellaneous drawer cabinet'],
  ['USE', 'Miscellaneous drawer cabinet'],
  ['PULL', 'Miscellaneous drawer cabinet'],
] as const

async function plainOffice(page: Page) {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
  await page.getByLabel('Dialogue presentation').selectOption('PLAIN_LIST')
  await expect(page.getByLabel('Dialogue presentation')).toHaveValue('PLAIN_LIST')
}

const verbButton = (page: Page, verb: 'OPEN' | 'USE' | 'PULL') => page.getByRole('button', { name: new RegExp(`^${verb}\\b`) })
const cabinetButton = (page: Page, target: string) => page.getByRole('button', { name: target, exact: true })

async function closed(page: Page) {
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'CLOSED')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
  await expect(page.getByTestId('inventory-euler-case-file')).toHaveCount(0)
  await expect(page.getByTestId('inventory-fictional-token-note')).toHaveCount(0)
  await expect(page.getByTestId('inventory-small-toolbox-closed')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /euler case file|fictional token|toolbox|rubber band|hammer|nails/i })).toHaveCount(0)
}

async function armOrderTrace(page: Page) {
  await page.evaluate(() => {
    const host = window as unknown as { __r1: unknown[]; __r1obs?: MutationObserver }
    const snap = () => {
      const statuses = [...document.querySelectorAll('[role="status"]')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      const speech = document.querySelector('[data-testid="speech-panel"]')
      const seq = document.querySelector('[data-testid="active-sequence"]')
      const row = {
        reach: statuses.some((text) => text.includes('Reach attempted')),
        contact: statuses.some((text) => text.includes('Cabinet contact blocked')),
        speech: Boolean(speech),
        copyKey: speech?.getAttribute('data-copy-key') ?? null,
        mode: speech?.getAttribute('data-presentation-mode') ?? null,
        label: speech?.getAttribute('aria-label') ?? null,
        index: seq?.getAttribute('data-action-index') ?? null,
        contactId: seq?.getAttribute('data-contact') ?? null,
      }
      const last = host.__r1?.[host.__r1.length - 1]
      if (!last || JSON.stringify(last) !== JSON.stringify(row)) host.__r1.push(row)
    }
    host.__r1 = []
    if (!host.__r1obs) {
      host.__r1obs = new MutationObserver(snap)
      host.__r1obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
    }
    snap()
  })
}

test.describe('S10-P1-R1 plain-list reload and interruption', () => {
  test('S10-P1-R1 plain-list screen-reader cabinet block', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) external.push(request.url()) })
    const data = await setup(page, 161)
    await plainOffice(page)
    data.freeze()
    for (const [index, [verb, target]] of PAIRS.entries()) {
      await armOrderTrace(page)
      const verbControl = verbButton(page, verb)
      const targetControl = cabinetButton(page, target)
      if (index === 0) {
        await tabTo(page, verbControl)
        await page.keyboard.press('Enter')
        await tabTo(page, targetControl)
        await page.keyboard.press('Enter')
      } else if (index === 1) {
        await verbControl.tap()
        await targetControl.tap()
      } else {
        await verbControl.click()
        await targetControl.click()
      }
      const speech = page.getByRole('button', { name: /The cabinet stays closed\. \[PLACEHOLDER — Story binds final copy\]/ })
      await expect(speech).toHaveAttribute('data-presentation-mode', 'PLAIN_LIST')
      await expect(speech).toHaveAttribute('data-copy-key', STORY_KEY)
      await expect(speech).toHaveClass(/mode-plain-list/)
      const trace = await page.evaluate(() => (window as unknown as { __r1: Array<{ reach: boolean; contact: boolean; speech: boolean; copyKey: string | null; mode: string | null; label: string | null; contactId: string | null }> }).__r1)
      const reach = trace.findIndex((row) => row.reach && !row.speech)
      const contact = trace.findIndex((row) => row.contact && !row.speech && row.contactId === 'CONTACT.CABINET_POLICY_BLOCK')
      const spoken = trace.findIndex((row) => row.copyKey === STORY_KEY && row.mode === 'PLAIN_LIST' && (row.label ?? '').includes('PLACEHOLDER'))
      expect(reach).toBeGreaterThanOrEqual(0)
      expect(contact).toBeGreaterThan(reach)
      expect(spoken).toBeGreaterThan(contact)
      for (let step = 0; step < 4 && await speech.count(); step += 1) await speech.click()
      await expect(speech).toHaveCount(0)
      await expect(targetControl).toBeFocused()
      await closed(page)
    }
    expect(external).toEqual([])
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('S10-P1-R1 reload at walk reach contact and speech stays closed', async ({ page }) => {
    const data = await setup(page, 162)
    await plainOffice(page)
    const checkpoints = [
      {
        verb: 'OPEN' as const,
        target: 'Official case-file cabinet',
        predicate: `() => document.querySelector('[data-testid="rook-sprite"]')?.getAttribute('data-animation') === 'walkEast' && !document.querySelector('[data-testid="active-sequence"]') && !document.querySelector('[data-testid="speech-panel"]')`,
        expectShot: { walk: 'walkEast', speech: false, copyKey: null },
      },
      {
        verb: 'USE' as const,
        target: 'Miscellaneous drawer cabinet',
        predicate: `() => { const seq = document.querySelector('[data-testid="active-sequence"]'); return seq?.getAttribute('data-action-index') === '1' && !seq.getAttribute('data-contact') && !document.querySelector('[data-testid="speech-panel"]') }`,
        expectShot: { index: '1', contact: '', speech: false },
      },
      {
        verb: 'PULL' as const,
        target: 'Official case-file cabinet',
        predicate: `() => { const seq = document.querySelector('[data-testid="active-sequence"]'); return seq?.getAttribute('data-contact') === 'CONTACT.CABINET_POLICY_BLOCK' && !document.querySelector('[data-testid="speech-panel"]') }`,
        expectShot: { contact: 'CONTACT.CABINET_POLICY_BLOCK', speech: false, copyKey: null },
      },
      {
        verb: 'OPEN' as const,
        target: 'Miscellaneous drawer cabinet',
        predicate: `() => document.querySelector('[data-testid="speech-panel"]')?.getAttribute('data-copy-key') === '${STORY_KEY}'`,
        expectShot: { speech: true, copyKey: STORY_KEY },
      },
    ]
    for (const checkpoint of checkpoints) {
      await page.evaluate((source) => {
        const pred = new Function(`return (${source})`)() as () => boolean
        sessionStorage.removeItem('r1-reload')
        const fire = () => {
          if (sessionStorage.getItem('r1-reload') || !pred()) return
          const shell = document.querySelector('[data-testid="a0-shell"]')
          const seq = document.querySelector('[data-testid="active-sequence"]')
          const speech = document.querySelector('[data-testid="speech-panel"]')
          sessionStorage.setItem('r1-reload', JSON.stringify({
            walk: document.querySelector('[data-testid="rook-sprite"]')?.getAttribute('data-animation') ?? null,
            index: seq?.getAttribute('data-action-index') ?? null,
            contact: seq?.getAttribute('data-contact') ?? '',
            speech: Boolean(speech),
            copyKey: speech?.getAttribute('data-copy-key') ?? null,
            phase: shell?.getAttribute('data-phase') ?? null,
            caseDrawer: shell?.getAttribute('data-case-drawer') ?? null,
            miscDrawer: shell?.getAttribute('data-misc-drawer') ?? null,
          }))
          location.reload()
        }
        new MutationObserver(fire).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
      }, checkpoint.predicate)
      const loaded = page.waitForEvent('load')
      await verbButton(page, checkpoint.verb).click()
      await cabinetButton(page, checkpoint.target).click()
      await loaded
      await expect(page.getByTestId('a0-shell')).toBeVisible()
      const shot = JSON.parse(await page.evaluate(() => sessionStorage.getItem('r1-reload') || 'null'))
      expect(shot).toMatchObject({ ...checkpoint.expectShot, phase: 'START', caseDrawer: 'CLOSED', miscDrawer: 'CLOSED' })
      await closed(page)
    }
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('S10-P1-R1 competing input cannot open a second cabinet sequence', async ({ page }) => {
    const data = await setup(page, 163)
    await plainOffice(page)
    data.freeze()
    await verbButton(page, 'OPEN').click()
    await cabinetButton(page, 'Official case-file cabinet').click()
    await page.waitForFunction(() => document.querySelector('[data-testid="active-sequence"]')?.getAttribute('data-sequence') === 'SEQUENCE.CABINET_POLICY_BLOCK')
    const during = await page.evaluate(() => {
      const before = document.querySelector('[data-testid="active-sequence"]')
      if (!before) return { ok: false, count: 0, id: null, speech: null }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true }))
      document.querySelector<HTMLButtonElement>('[data-testid="hotspot-miscellaneous-drawer-cabinet"]')?.click()
      const sequences = document.querySelectorAll('[data-testid="active-sequence"]')
      return {
        ok: sequences.length === 1,
        count: sequences.length,
        id: sequences[0]?.getAttribute('data-sequence') ?? null,
        speech: document.querySelector('[data-testid="speech-panel"]')?.getAttribute('data-copy-key') ?? null,
      }
    })
    expect(during).toEqual({ ok: true, count: 1, id: 'SEQUENCE.CABINET_POLICY_BLOCK', speech: null })
    const speech = page.getByRole('button', { name: /The cabinet stays closed\. \[PLACEHOLDER — Story binds final copy\]/ })
    await expect(speech).toHaveAttribute('data-copy-key', STORY_KEY)
    await expect(speech).toHaveAttribute('data-presentation-mode', 'PLAIN_LIST')
    for (let step = 0; step < 4 && await speech.count(); step += 1) await speech.click()
    await expect(speech).toHaveCount(0)
    await page.getByText(/TRANSCRIPT/, { exact: false }).click()
    const text = await page.getByTestId('dialogue-transcript').innerText()
    expect(text.match(/Cabinet contact blocked/g)).toHaveLength(1)
    expect(text.match(/The cabinet stays closed\. \[PLACEHOLDER — Story binds final copy\]/g)).toHaveLength(1)
    await closed(page)
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })
})
