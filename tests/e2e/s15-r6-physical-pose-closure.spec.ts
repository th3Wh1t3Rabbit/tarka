import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

const root = resolve('review/s15-r6')
const shots = resolve(root, 'SCREENSHOTS')
const receipt = resolve(root, 'RECEIPTS/BROWSER_STAGE_OBSERVATIONS.ndjson')

async function start(page: Page, phase: string) {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption(phase)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
}

async function pointerAction(page: Page, verb: string, target: string, item?: string) {
  await page.evaluate(() => {
    type Observation = { contact: string; physicalPose: string; animation: string; cue: string }
    const scope = window as unknown as { __s15r6PoseHistory?: Observation[]; __s15r6PoseObserver?: MutationObserver }
    scope.__s15r6PoseObserver?.disconnect()
    scope.__s15r6PoseHistory = []
    const capture = () => {
      const sequence = document.querySelector<HTMLElement>('[data-testid="active-sequence"]')
      const rook = document.querySelector<HTMLElement>('[data-testid="rook-sprite"]')
      const observation = { contact: sequence?.dataset.contact ?? '', physicalPose: sequence?.dataset.physicalPose ?? '', animation: rook?.dataset.animation ?? '', cue: rook?.dataset.cue ?? '' }
      if (!scope.__s15r6PoseHistory?.some(value => JSON.stringify(value) === JSON.stringify(observation))) scope.__s15r6PoseHistory?.push(observation)
    }
    const observer = new MutationObserver(capture)
    observer.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-contact', 'data-physical-pose', 'data-animation', 'data-cue'] })
    scope.__s15r6PoseObserver = observer
    capture()
  })
  await page.getByTestId(`verb-${verb}`).click()
  if (item) await page.getByTestId(`inventory-${item}`).click()
  await page.getByTestId(`hotspot-${target}`).click()
}

async function stage(page: Page, actionId: string) {
  const sequence = page.getByTestId('active-sequence')
  await expect(sequence).toHaveAttribute('data-action-id', actionId, { timeout: 10_000 })
  return sequence
}

async function expectContactPose(page: Page, contact: string, physicalPose: string, animation: string, cue: string) {
  await expect.poll(() => page.evaluate(expected => {
    type Observation = { contact: string; physicalPose: string; animation: string; cue: string }
    const scope = window as unknown as { __s15r6PoseHistory?: Observation[] }
    const sequence = document.querySelector<HTMLElement>('[data-testid="active-sequence"]')
    const rook = document.querySelector<HTMLElement>('[data-testid="rook-sprite"]')
    const current = {
      contact: sequence?.dataset.contact ?? '',
      physicalPose: sequence?.dataset.physicalPose ?? '',
      animation: rook?.dataset.animation ?? '',
      cue: rook?.dataset.cue ?? '',
    }
    return [current, ...(scope.__s15r6PoseHistory ?? [])].some(observation => observation.contact === expected.contact && observation.physicalPose === expected.physicalPose && observation.animation === expected.animation && observation.cue === expected.cue)
  }, { contact, physicalPose, animation, cue })).toBe(true)
}

async function drainSpeechOnly(page: Page) {
  for (let guard = 0; guard < 80 && await page.getByTestId('speech-panel').count(); guard += 1) {
    await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(25)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
}

async function capture(page: Page, info: TestInfo, id: string, interactionMode: 'POINTER' | 'KEYBOARD' | 'TOUCH', route: string) {
  if (process.env.S15_R6_EVIDENCE !== '1') return
  mkdirSync(shots, { recursive: true })
  mkdirSync(resolve(root, 'RECEIPTS'), { recursive: true })
  const observed = await page.evaluate(() => {
    const node = (testId: string) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
    const attr = (testId: string, name: string) => node(testId)?.getAttribute(name) ?? ''
    return {
      phase: attr('a0-shell', 'data-phase'),
      action: attr('active-sequence', 'data-action-id') || 'SETTLED',
      semanticContact: attr('active-sequence', 'data-contact'),
      physicalPose: attr('active-sequence', 'data-physical-pose'),
      rook: { animation: attr('rook-sprite', 'data-animation'), cue: attr('rook-sprite', 'data-cue'), performance: attr('rook-sprite', 'data-performance'), facing: attr('rook-sprite', 'data-facing') },
      arthur: { animation: attr('mr-index-sprite', 'data-animation'), cue: attr('mr-index-sprite', 'data-cue'), performance: attr('mr-index-sprite', 'data-performance'), facing: attr('mr-index-sprite', 'data-facing') },
      inventory: [...document.querySelectorAll<HTMLElement>('[data-testid^="inventory-"]')].map(item => item.dataset.testid!.replace('inventory-', '')),
      formPaperOwner: attr('records-office', 'data-form-paper-owner'),
      deskStampOwner: attr('records-office', 'data-desk-stamp-owner'),
      deskStampVisible: attr('records-office', 'data-desk-stamp-visible'),
    }
  })
  const row = {
    schema: 'tarka.s15-r6.browser-stage-observation.v1',
    screenshot: `SCREENSHOTS/${id}.png`,
    generatingTestId: info.title,
    sourceTestPath: 'tests/e2e/s15-r6-physical-pose-closure.spec.ts',
    ordinaryUrlAndQuery: '/?skipIntro=1&review=1',
    interactionMode,
    stateActionRoute: route,
    ...observed,
    capturedTimestamp: new Date().toISOString(),
  }
  await page.screenshot({ path: resolve(shots, `${id}.png`), fullPage: true })
  appendFileSync(receipt, `${JSON.stringify(row)}\n`)
}

test('s15-r6:pointer observes form and pen empty-hand contacts', async ({ page }, info) => {
  await start(page, 'START')
  await pointerAction(page, 'pick-up', 'blank-authorization-form')
  await stage(page, 'contact')
  await expectContactPose(page, 'CONTACT.ITEM.take-form', 'EMPTY_HAND_REACH', 'reach', 'rook.reach.neutral')
  await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'useGive')
  await capture(page, info, 'take-form-empty-hand-contact', 'POINTER', 'START → PICK_UP blank-authorization-form → CONTACT.ITEM.take-form')

  await start(page, 'START')
  await pointerAction(page, 'pick-up', 'pen-stand')
  await stage(page, 'contact')
  await expectContactPose(page, 'CONTACT.ITEM.take-pen', 'EMPTY_HAND_REACH', 'reach', 'rook.reach.neutral')
  await capture(page, info, 'take-pen-empty-hand-contact', 'POINTER', 'START → PICK_UP pen-stand → CONTACT.ITEM.take-pen')
})

test('s15-r6:keyboard executes the alternate pen acquisition route', async ({ page }) => {
  await start(page, 'FORM_HELD')
  await page.keyboard.press('2')
  await expect(page.getByTestId('verb-pick-up')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('hotspot-pen-stand').focus()
  await page.keyboard.press('Enter')
  const sequence = await stage(page, 'contact')
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.ITEM.take-pen-2')
  await expect(sequence).toHaveAttribute('data-physical-pose', 'EMPTY_HAND_REACH')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_AND_PEN')
})

test.describe('real touch route', () => {
  test.use({ hasTouch: true })
  test('s15-r6:touch executes the alternate form acquisition route', async ({ page }) => {
    await start(page, 'PEN_HELD')
    await page.getByTestId('verb-pick-up').tap()
    await page.getByTestId('hotspot-blank-authorization-form').tap()
    const sequence = await stage(page, 'contact')
    await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.ITEM.take-form-2')
    await expect(sequence).toHaveAttribute('data-physical-pose', 'EMPTY_HAND_REACH')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_AND_PEN')
  })
})

test('s15-r6:pointer observes every drawer-loot contact and Euler item contact', async ({ page }, info) => {
  await start(page, 'COMPLETE')
  await pointerAction(page, 'open', 'miscellaneous-drawer-cabinet')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'OPEN')
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 10_000 })
  await pointerAction(page, 'pick-up', 'miscellaneous-catch-all-contents')
  const sequence = page.getByTestId('active-sequence')
  const steps = [
    ['CONTACT.DRAWER_PICKUP_1', 'describe-rubber-band', 'DRAWER_RUBBER_BAND', 'rubber-band'],
    ['CONTACT.DRAWER_PICKUP_2', 'describe-rubiks-cube', 'DRAWER_RUBIKS_CUBE', 'rubiks-cube'],
    ['CONTACT.DRAWER_PICKUP_3', 'describe-vhs', 'DRAWER_VHS', 'sharknado-2-vhs'],
    ['CONTACT.DRAWER_PICKUP_4', 'describe-piggy-bank', 'DRAWER_PIGGY_BANK', 'piggy-bank-intact'],
    ['CONTACT.DRAWER_PICKUP_5', 'describe-toolbox', 'DRAWER_TOOLBOX', 'small-toolbox-closed'],
  ] as const
  for (const [index, [contact, dialogueAction, speechStage, item]] of steps.entries()) {
    await expectContactPose(page, contact, 'EMPTY_HAND_REACH', 'reach', 'rook.drawer-extract')
    await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'useGive')
    if (index === 0) await capture(page, info, 'drawer-loot-empty-hand-contact', 'POINTER', `COMPLETE → OPEN misc drawer → PICK_UP contents → ${contact}`)
    await stage(page, dialogueAction)
    await expect(sequence).toHaveAttribute('data-stage', speechStage)
    await expect(sequence).toHaveAttribute('data-physical-pose', 'IDLE')
    await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'reach')
    await expect(page.getByTestId(`inventory-${item}`)).toBeVisible()
    await expect(page.getByTestId('speech-panel')).toBeVisible()
    await drainSpeechOnly(page)
  }
  await expect(sequence).toHaveCount(0, { timeout: 10_000 })
  const contacts = await page.evaluate(() => ((window as unknown as { __s15r6PoseHistory?: Array<{ contact: string }> }).__s15r6PoseHistory ?? []).map(entry => entry.contact).filter(Boolean))
  expect(contacts).not.toContain('CONTACT.DRAWER_ACQUIRE')

  await start(page, 'COMPLETE')
  await pointerAction(page, 'open', 'official-case-file-cabinet')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'OPEN')
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 10_000 })
  await pointerAction(page, 'pick-up', 'disorderly-stack-of-confidential-files')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-action-id', 'search-dialogue', { timeout: 10_000 })
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-cue', 'rook.reach.talk')
  await drainSpeechOnly(page)
  await expectContactPose(page, 'CONTACT.CASEFILE_COLLECT', 'EMPTY_HAND_REACH', 'reach', 'rook.reach.neutral')
  await capture(page, info, 'case-file-item-contact', 'POINTER', 'COMPLETE → OPEN case drawer → PICK_UP stack → CONTACT.CASEFILE_COLLECT')
})

test('s15-r6:pointer captures the truthful one-paper offer, review, bounded stamp, and return', async ({ page }, info) => {
  await start(page, 'FORM_COMPLETED')
  await pointerAction(page, 'give', 'mr-index', 'signed-terminal-authorization-form-with-doodles')
  const sequence = page.getByTestId('active-sequence')
  const rook = page.getByTestId('rook-sprite')
  const arthur = page.getByTestId('mr-index-sprite')
  const scene = page.getByTestId('records-office')

  await stage(page, 'offer')
  await expect(sequence).toHaveAttribute('data-physical-pose', 'PAPER_REACH')
  await expect(scene).toHaveAttribute('data-form-paper-owner', 'ROOK_VISIBLE')
  await expect(rook).toHaveAttribute('data-animation', 'useGive')
  await expect(rook).toHaveAttribute('data-cue', 'rook.give')
  await expect(arthur).toHaveAttribute('data-animation', 'idle')
  await capture(page, info, 'form-pre-handoff-rook-paper', 'POINTER', 'FORM_COMPLETED → GIVE signed form → offer')

  await stage(page, 'handoff')
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.FORM_HANDOFF')
  await expect(scene).toHaveAttribute('data-form-paper-owner', 'ARTHUR_VISIBLE')
  await expect(rook).toHaveAttribute('data-animation', 'idle')
  await expect(arthur).toHaveAttribute('data-animation', 'document')
  await expect(arthur).toHaveAttribute('data-cue', 'arthur.document')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_SUBMITTED')
  await capture(page, info, 'form-post-handoff-arthur-document', 'POINTER', 'offer → CONTACT.FORM_HANDOFF → Arthur document review')

  await stage(page, 'review')
  await expect(scene).toHaveAttribute('data-form-paper-owner', 'ARTHUR_VISIBLE')
  await expect(arthur).toHaveAttribute('data-animation', 'document')
  await drainSpeechOnly(page)

  await stage(page, 'return')
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.FORM_RETURN')
  await expect(scene).toHaveAttribute('data-form-paper-owner', 'ROOK_VISIBLE')
  await expect(arthur).toHaveAttribute('data-animation', 'idle')

  await stage(page, 'stamp')
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.FORM_STAMP')
  await expect(arthur).toHaveAttribute('data-animation', 'stamp')
  await expect(arthur).toHaveAttribute('data-cue', 'arthur.stamp')
  await expect(scene).toHaveAttribute('data-desk-stamp-owner', 'ARTHUR_IN_USE')
  await expect(scene).toHaveAttribute('data-desk-stamp-visible', 'false')
  await expect(page.getByTestId('layout-arthur-stamp')).toHaveCount(0)
  await capture(page, info, 'form-stamp-contact-desk-stamp-hidden', 'POINTER', 'review → CONTACT.FORM_STAMP → stamp in use')

  await stage(page, 'stamp-caption')
  await expect(arthur).not.toHaveAttribute('data-animation', 'document')
  await expect(scene).toHaveAttribute('data-form-paper-owner', 'ROOK_VISIBLE')
  await expect(scene).toHaveAttribute('data-desk-stamp-owner', 'DESK')
  await expect(scene).toHaveAttribute('data-desk-stamp-visible', 'true')
  await expect(page.getByTestId('layout-arthur-stamp')).toHaveCount(1)
  await capture(page, info, 'form-post-stamp-pre-return-desk-stamp-restored', 'POINTER', 'stamp complete → document hold → desk stamp restored')
  await drainSpeechOnly(page)

  await drainSpeechOnly(page)
  await expect(sequence).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toHaveCount(1)
  await expect(page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles')).toHaveCount(0)

  await expect(scene).toHaveAttribute('data-form-paper-owner', 'ROOK_APPROVED_INVENTORY')
  await expect(scene).toHaveAttribute('data-desk-stamp-visible', 'true')
  await expect(rook).toHaveAttribute('data-animation', 'idle')
  await expect(arthur).toHaveAttribute('data-animation', 'idle')
  await capture(page, info, 'form-approved-return-normal-staging', 'POINTER', 'CONTACT.FORM_RETURN → focus → normal staging')
})

test('s15-r6:blocked-network journey makes zero external or websocket requests', async ({ page }) => {
  const external: string[] = []
  const sockets: string[] = []
  page.on('request', request => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url()) })
  page.on('websocket', socket => { const url = new URL(socket.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) sockets.push(socket.url()) })
  await start(page, 'FORM_COMPLETED')
  await pointerAction(page, 'give', 'mr-index', 'signed-terminal-authorization-form-with-doodles')
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-action-id', 'review', { timeout: 10_000 })
  await drainSpeechOnly(page)
  await expect(page.getByTestId('active-sequence')).toHaveAttribute('data-contact', 'CONTACT.FORM_STAMP', { timeout: 10_000 })
  expect(external).toEqual([])
  expect(sockets).toEqual([])
})
