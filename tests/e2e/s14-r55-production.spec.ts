import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { attachS13Runtime, buildFrozenFixture } from '../../src/investigation/fixture'
import type { S13Runtime } from '../../src/investigation/s13'
import { createInvestigationState, exportLocalSave, investigationReducer, type InvestigationState } from '../../src/investigation/state'
import { progressionChain } from '../fixtures/s2/domain-helpers'

const fromPublic = (name: string) => JSON.parse(readFileSync(`public/scenarios/euler-2023-false-exit/${name}`, 'utf8'))
const fixture = attachS13Runtime(buildFrozenFixture(fromPublic('scenario.json'), fromPublic('evidence-graph.json')), fromPublic('s13-runtime.json') as S13Runtime)
const storageKey = `trace-case-v1:${fixture.id}:${fixture.records.map(({ provenance }) => provenance.normalizedSha256).join(':')}`
const evidenceDir = resolve('artifacts/s14-r1/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

const reduce = (state: InvestigationState, command: Parameters<typeof investigationReducer>[2]) => investigationReducer(fixture, state, command)
function completedSave(brcg: boolean) {
  let state = reduce(createInvestigationState(fixture), { type: 'EARN_ACCESS' })
  state = reduce(state, { type: 'COLLECT_CASE_FILE' })
  if (brcg) {
    state = reduce(state, { type: 'COLLECT_SIDE_NOTE' })
    state = reduce(state, { type: 'SELECT_SIDE_TOKEN', tokenId: 'BRCG' })
    state = reduce(state, { type: 'REVIEW_BRCG_MARKET' })
    state = reduce(state, { type: 'REVIEW_BRCG_PROOF' })
  }
  state = reduce(state, { type: 'S16_RUN_QUERY', planId: 'Q2', semantics: 'R2', origin: 'CURRENT' })
  const q2 = state.s16Runs[0]!
  const early = fixture.s13!.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')!
  const exact = fixture.s13!.proof.exactRecord
  state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
  state = reduce(state, { type: 'S16_ADD_START', runId: q2.id, recordId: early.recordId })
  state = reduce(state, { type: 'S16_OPEN_RECORD', recordId: exact.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } })
  state = reduce(state, { type: 'S16_ADD_ROUTE', runId: q2.id, recordId: exact.recordId })
  state = reduce(state, { type: 'S16_RUN_QUERY', planId: 'Q3', semantics: 'R2', origin: 'CURRENT' })
  state = reduce(state, { type: 'S13_SELECT_RECORD', recordId: fixture.s13!.proof.exactRecord.recordId })
  state = reduce(state, { type: 'S13_VERIFY_RECORD', recordId: fixture.s13!.proof.exactRecord.recordId })
  state = reduce(state, { type: 'S16_FILE_FINDINGS' })
  expect(state.complete).toBe(true)
  return exportLocalSave(state)
}

async function blockExternalNetwork(page: Page) {
  const external: string[] = []
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await page.context().routeWebSocket('**/*', socket => socket.close())
  return external
}

async function drainExactSpeech(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 240 && quiet < 3; guard++) {
    const panel = page.getByTestId('speech-panel')
    if (await panel.count()) {
      await panel.click()
      quiet = 0
    } else if (await page.getByTestId('active-sequence').count() || await page.getByTestId('rook-sprite').getAttribute('data-animation') === 'walkEast') {
      quiet = 0
    } else quiet++
    await page.waitForTimeout(100)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
}

async function openCompletedTerminal(page: Page, brcg: boolean) {
  const saved = completedSave(brcg)
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value)
  }, { key: storageKey, value: saved })
  await page.goto('/?skipIntro=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  const shell = page.getByTestId('a0-shell')
  await expect(play.or(shell)).toBeVisible()
  if (await play.isVisible()) await play.click()
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  for (const [verb, hotspot, item, item2, , phase] of progressionChain) {
    await page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    if (hotspot) await page.getByTestId(`hotspot-${hotspot}`).click()
    else if (item2) await page.getByTestId(`inventory-${item2}`).click()
    if (phase === 'COMPLETE') {
      await drainExactSpeech(page)
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase))
    } else {
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase))
      await drainExactSpeech(page)
    }
  }
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click()
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('terminal-section-case').click()
  await expect(page.getByTestId('bounded-case-complete')).toBeVisible()
  await expect(page.getByRole('button', { name: 'CLOSE CASE', exact: true })).toBeVisible()
}

async function drainEnding(page: Page, mode: 'mouse' | 'touch') {
  for (let guard = 0; guard < 200 && await page.locator('.s14-ending-scene button').count(); guard++) {
    if (mode === 'touch') await page.locator('.s14-ending-scene button').tap()
    else await page.locator('.s14-ending-scene button').click()
  }
  await expect(page.getByTestId('s14-completion-screen')).toBeVisible({ timeout: 20_000 })
}

test('Principal-revised production opening reaches the haystack with keyboard advance', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  await play.focus()
  await page.keyboard.press('Enter')
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  const speech = page.getByTestId('speech-panel')
  await expect(speech).toHaveAttribute('aria-label', /Rook: This the Records Office\?$/)
  await page.keyboard.press('Space')
  await expect(speech).toHaveAttribute('aria-label', /No\. It’s a pizza restaurant/, { timeout: 10_000 })
  for (let guard = 0; guard < 160; guard++) {
    const label = await speech.getAttribute('aria-label')
    if (label?.includes('mathematically precise haystack')) break
    await page.keyboard.press('Space')
  }
  await expect(speech).toHaveAttribute('aria-label', /mathematically\s+precise haystack/)
  await page.keyboard.press('Space')
  await page.screenshot({ path: resolve(evidenceDir, '01-exact-opening-haystack.png') })
  expect((await speech.getAttribute('aria-label'))?.toLowerCase()).not.toContain('hieroglyph')
})

test('default close-case cancel/keyboard commit reaches persistent completion and caller-aware credits', async ({ page }) => {
  test.setTimeout(180_000)
  const external = await blockExternalNetwork(page)
  await openCompletedTerminal(page, false)
  const close = page.getByRole('button', { name: 'CLOSE CASE', exact: true })
  await close.click()
  const confirmation = page.getByRole('dialog', { name: 'CLOSE THE EULER CASE?' })
  await expect(confirmation).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, '02-close-case-confirmation.png') })
  await page.getByRole('button', { name: 'KEEP INVESTIGATING' }).click()
  await expect(close).toBeFocused()
  await close.click()
  await confirmation.getByRole('button', { name: 'CLOSE CASE' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await expect(page.getByTestId('case-terminal')).toHaveCount(0)
  await expect(page.locator('.s14-ending-scene')).toHaveCount(0)
  const endingRoom = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>('[data-testid="a0-shell"] .a0-frame')!.getBoundingClientRect()
    const room = document.querySelector<HTMLElement>('[data-testid="records-office"]')!.getBoundingClientRect()
    return { frame: { width: frame.width, height: frame.height }, room: { width: room.width, height: room.height } }
  })
  expect(endingRoom.frame.width).toBeGreaterThanOrEqual(480)
  expect(endingRoom.frame.height).toBeGreaterThanOrEqual(270)
  expect(Math.abs(endingRoom.room.width - endingRoom.frame.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(endingRoom.room.height - endingRoom.frame.height * 2 / 3)).toBeLessThanOrEqual(2)
  await expect(page.getByTestId('rook-sprite')).toBeVisible()
  await expect(page.getByTestId('mr-index-sprite')).toBeVisible()
  await expect(page.getByTestId('speech-panel')).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, '03-default-ending.png') })
  for (let guard = 0; guard < 80 && await page.getByTestId('speech-panel').count(); guard += 1) await page.getByTestId('talk-advance-catch').click()
  await drainEnding(page, 'mouse')
  const completion = page.getByTestId('s14-completion-screen')
  await expect(completion.getByRole('heading', { name: 'CASE CLOSED' })).toBeVisible()
  await expect(completion).not.toContainText('CASE RECORD')
  await expect(completion).not.toContainText('THE FALSE EXIT')
  await expect(completion).toContainText('ROUTES')
  await expect(completion).toContainText('CONNECTED')
  await expect(page.getByTestId('s14-side-lead-summary')).toContainText('PIGGY BANK FORTUNE')
  await expect(page.getByTestId('s14-side-lead-summary')).toContainText('NOT FOUND')
  await expect(page.getByTestId('s14-mission-02-stinger')).toContainText('CASE FILE 02')
  await expect(page.getByTestId('s14-mission-02-stinger')).toContainText('COMING SOON???')
  await expect(page.getByTestId('s14-mission-02-stinger')).toContainText('FUTURE ACCESS')
  await expect(page.getByTestId('s14-mission-02-stinger')).toContainText('HIGHLY UNLIKELY')
  const completionControls = completion.getByRole('navigation', { name: 'Completion controls' })
  await expect(completionControls.getByRole('button')).toHaveCount(3)
  const controlTops = await completionControls.getByRole('button').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().top)))
  expect(new Set(controlTops).size).toBe(1)
  await page.screenshot({ path: resolve(evidenceDir, '05-final-completion-stinger.png'), fullPage: true })
  await page.getByRole('button', { name: 'CREDITS', exact: true }).click()
  await expect(page.getByTestId('tarka-credits-screen')).toBeVisible()
  await page.getByRole('button', { name: '[ RETURN ]' }).click()
  await expect(page.getByTestId('s14-completion-screen')).toBeVisible()
  await page.getByRole('button', { name: '[ PLAY AGAIN ]' }).click()
  await page.getByRole('button', { name: '[ CANCEL ]' }).click()
  await expect(page.getByRole('button', { name: '[ PLAY AGAIN ]' })).toBeFocused()
  await page.getByRole('button', { name: 'MAIN MENU' }).click()
  await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
  expect(external).toEqual([])
})

test.describe('real touch BRCG ending and full reset', () => {
  test.use({ hasTouch: true })
  test('semantic BRCG state selects the BRCG variant and START OVER clears the run', async ({ page }) => {
    test.setTimeout(180_000)
    const external = await blockExternalNetwork(page)
    await openCompletedTerminal(page, true)
    await page.getByRole('button', { name: 'CLOSE CASE', exact: true }).tap()
    await page.getByRole('dialog', { name: 'CLOSE THE EULER CASE?' }).getByRole('button', { name: 'CLOSE CASE' }).tap()
    await expect(page.getByTestId('a0-shell')).toBeVisible()
    await expect(page.getByTestId('speech-panel')).toBeVisible()
    for (let guard = 0; guard < 40; guard++) {
      const speech = page.getByTestId('speech-panel')
      if (!(await speech.count())) break
      if (((await speech.getAttribute('aria-label')) ?? '').includes('rolling in the dough')) {
        await page.screenshot({ path: resolve(evidenceDir, '04-brcg-ending.png') })
      }
      await page.getByTestId('talk-advance-catch').tap()
    }
    await drainEnding(page, 'touch')
    await expect(page.getByTestId('s14-side-lead-summary')).toContainText('PIGGY BANK FORTUNE')
    await expect(page.getByTestId('s14-side-lead-summary')).toContainText('DISAPPOINTING')
    await page.getByRole('button', { name: '[ PLAY AGAIN ]' }).tap()
    await expect(page.getByTestId('s14-start-over-confirmation')).toBeVisible()
    await page.getByRole('button', { name: '[ START OVER ]' }).tap()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'false')
    const freshSave = await page.evaluate(key => localStorage.getItem(key), storageKey)
    expect(freshSave === null ? [] : JSON.parse(freshSave).commands.entries).toEqual([])
    expect(external).toEqual([])
  })
})
