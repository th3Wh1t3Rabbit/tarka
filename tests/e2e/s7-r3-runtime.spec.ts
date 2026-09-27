import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { activate, tabTo } from '../fixtures/s2/browser-helpers'

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])])) : value
const nodeCommentIdentity = (value: unknown) => createHash('sha256').update(`${JSON.stringify(stable(value))}\n`).digest('hex')
const nodeValidUtcTimestamp = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value)
  if (!match) return false
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) return false
  return match[7] ? instant.toISOString() === value : instant.toISOString() === value.replace(/Z$/, '.000Z')
}

test('optional dialogue control is in ordinary Tab order and terminal TALK is structured without future transcript preload', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await activate(page, page.getByTestId('verb-talk-to'), 'KEYBOARD')
  await activate(page, page.getByTestId('hotspot-nansen-terminal'), 'KEYBOARD')
  const optional = page.getByTestId('nonblocking-speech')
  await expect(optional).toBeVisible()
  await expect(optional.locator('strong')).toHaveText('Rook')
  await expect(page.getByTestId('dialogue-transcript')).toContainText('TRANSCRIPT · 1 LINES')
  const control = optional.getByRole('button')
  await tabTo(page, control)
  await page.keyboard.press('Enter')
  if (await optional.locator('strong').textContent() === 'Rook') await page.keyboard.press('Enter')
  await expect(optional.locator('strong')).toHaveText('System')
  await expect(optional).toContainText('[BZZZT.]')
  await expect(page.getByTestId('dialogue-transcript')).toContainText('TRANSCRIPT · 2 LINES')
  for (let i = 0; i < 2 && await optional.locator('strong').textContent() === 'System'; i++) await control.click()
  await expect(optional.locator('strong')).toHaveText('Arthur')
  await expect(optional).toContainText('It prefers structured questions.')
  await expect(page.getByTestId('dialogue-transcript')).toContainText('TRANSCRIPT · 3 LINES')
  await expect(page.locator('body')).not.toContainText('NONPRODUCTION COPY')
  const origin = new URL(page.url()).origin
  expect(requests.every((url) => url.startsWith(`${origin}/`))).toBe(true)
})

test('ordinary game speech crosses opening phrase cues and transfers cleanly to Arthur', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const panel = page.getByTestId('speech-panel')
  await expect(panel).toBeVisible()
  for (let index = 0; index < 2; index++) { await panel.click(); await panel.click() }
  await expect(panel).toHaveAttribute('data-copy-key', 'lane_a.s7r2b.opening.3')
  await expect(panel).toHaveAttribute('data-crossed-cues', /PERF\.OPEN\.ROOK\.CONFIDENCE/)
  await page.clock.runFor(200)
  await expect(panel).toHaveAttribute('data-crossed-cues', /PERF\.OPEN\.RIGHT\.BEAT/)
  await expect(panel).toHaveAttribute('data-performance', /ROOK:GAZE:LOOK_TO_ARTHUR/)
  await page.clock.runFor(100)
  await expect(panel).toHaveAttribute('data-crossed-cues', /PERF\.OPEN\.NICKNAME\.LEAN/)
  await panel.click()
  await panel.click()
  await expect(panel).toHaveAttribute('data-copy-key', 'lane_a.s7r2b.opening.4')
  await expect(panel).toHaveAttribute('data-crossed-cues', /PERF\.OPEN\.INTERRUPT/)
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-performance', /RESTRAINED_IRRITATION|INTERRUPT_CLEAN/)
  await panel.click()
  await expect(panel).toHaveAttribute('data-after-line-hold', 'true')
  await expect(panel).toHaveAttribute('data-copy-key', 'lane_a.s7r2b.opening.4')
})

test('Principal Workbench exposes complete review views, direct anchors, and safe review-book round trips', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('http://127.0.0.1:4293/')
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await expect(page.getByRole('heading', { name: 'Principal Review Workbench' })).toBeVisible()
  for (const label of ['Acts / scenes', 'Puzzle dependency', 'State / inventory', 'Nine-verb desk', 'Dialogue tree', 'Performance score', 'Nansen evidence', 'Journey simulator', 'Art capability', 'Renderer risk', 'Review-only concepts']) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.locator('main h2').first()).toBeVisible()
  }
  await expect(page.getByText('E-01 · Piggy bank recovery-note vignette')).toBeVisible()
  await expect(page.getByText('NOT IN RUNTIME').first()).toBeVisible()
  await page.getByRole('button', { name: 'Nine-verb desk', exact: true }).click()
  await expect(page.locator('[data-review-anchor^="interaction:"]')).toHaveCount(81)
  await page.getByRole('button', { name: 'Nansen evidence', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All 25 semantic views' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seven bounded no-match controls' })).toBeVisible()
  await expect(page.locator('[data-review-anchor^="evidence:"]')).toHaveCount(32)
  await page.getByRole('button', { name: 'Performance score', exact: true }).click()
  await page.locator('[data-review-anchor="performance:PERF.OPEN.RIGHT.BEAT"] button').first().click()
  await expect(page.getByLabel('Stable anchor')).toHaveValue('performance:PERF.OPEN.RIGHT.BEAT')
  await page.getByLabel('Category').selectOption('TIMING')
  await page.getByLabel('Approval').selectOption('APPROVE_WITH_NOTE')
  await page.getByLabel('Comment').fill('Keep the micro-beat player-paced in reduced motion.')
  await page.getByRole('button', { name: 'Save locally' }).click()
  await page.getByLabel('Import review book').setInputFiles({ name: 'mismatch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: '1.0.0', revision: 'wrong', sourceIdentity: {}, comments: [] })) })
  await expect(page.getByText(/QUARANTINED/)).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const download = await downloadPromise
  const path = await download.path()
  const exported = JSON.parse(await readFile(path!, 'utf8'))
  expect(exported.comments).toHaveLength(1)
  await page.getByLabel('Import review book').setInputFiles(path!)
  await expect(page.getByText('Keep the micro-beat player-paced in reduced motion.')).toBeVisible()
  expect(requests.every((url) => url.startsWith('http://127.0.0.1:4293/'))).toBe(true)
})

test('Principal Workbench uses explicit act ownership and never hides unresolved owned children', async ({ page }) => {
  await page.goto('http://127.0.0.1:4293/')
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await page.getByRole('button', { name: 'Puzzle dependency', exact: true }).click()
  await page.locator('[data-review-anchor="puzzle:NODE.REQUEST"] button').first().click()
  await page.getByLabel('Category').selectOption('PUZZLE')
  await page.getByLabel('Approval').selectOption('REVISE')
  await page.getByLabel('Comment').fill('Request node remains unresolved.')
  await page.getByRole('button', { name: 'Save locally' }).click()
  await page.getByRole('button', { name: 'Puzzle dependency', exact: true }).click()
  await page.locator('[data-review-anchor="puzzle:NODE.TUBE"] button').nth(1).click()
  await page.getByRole('button', { name: 'Acts / scenes', exact: true }).click()
  const act = page.locator('[data-act="ACT-1"]')
  await expect(act).toContainText('Computed approval: UNRESOLVED')
  await expect(act).toContainText('unresolved: 1')
  await expect(act.getByRole('button', { name: 'puzzle:NODE.REQUEST' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
})

test('Principal Workbench rejects malformed JSON and Markdown atomically and migrates prior comments deliberately', async ({ page }) => {
  await page.goto('http://127.0.0.1:4293/#comments')
  await page.getByLabel('Comment').fill('Current local note must survive failed imports.')
  await page.getByRole('button', { name: 'Save locally' }).click()
  const malformed = JSON.parse(await readFile('artifacts/principal-review/FIXTURE_MIXED_INVALID_REVIEW_BOOK.json', 'utf8'))
  await page.getByLabel('Import review book').setInputFiles({ name: 'mixed-invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malformed)) })
  await expect(page.getByText(/QUARANTINED/)).toBeVisible()
  await expect(page.getByText('Current local note must survive failed imports.')).toBeVisible()
  const encoded = Buffer.from(JSON.stringify(malformed), 'utf8').toString('base64')
  await page.getByLabel('Import review book').setInputFiles({ name: 'mixed-invalid.md', mimeType: 'text/markdown', buffer: Buffer.from(`# Invalid\n<!-- REVIEW_BOOK_JSON ${encoded} -->\n`) })
  await expect(page.getByText(/QUARANTINED/)).toBeVisible()
  await expect(page.getByText('Current local note must survive failed imports.')).toBeVisible()

  await page.getByLabel('Import review book').setInputFiles('artifacts/principal-review/FIXTURE_PRIOR_REVIEW_BOOK.json')
  await expect(page.getByText(/COMPARISON READY/)).toBeVisible()
  await expect(page.locator('[data-comparison-status="SAME"]').first()).toBeVisible()
  await expect(page.locator('[data-comparison-status="CHANGED"]').first()).toContainText(/Prior:.*Current:/s)
  await expect(page.locator('[data-comparison-status="MISSING"]').first()).toContainText('never attached')
  await expect(page.locator('[data-comparison-status="NEW"]').first()).toContainText('New and unreviewed')
  await expect(page.getByText('Prior SAME item fixture comment.')).toBeVisible()
  await page.getByRole('button', { name: 'Select all SAME comments' }).click()
  await expect(page.getByText('Prior SAME item fixture comment.')).toHaveCount(1)
  await page.getByRole('button', { name: 'Apply selected comments' }).click()
  await expect(page.getByText('Prior SAME item fixture comment.')).toHaveCount(2)
  await expect(page.getByText('Prior CHANGED item fixture comment.')).toHaveCount(1)
  await page.locator('[data-comparison-anchor="puzzle:NODE.REQUEST"] [data-select-changed]').click()
  await page.getByRole('button', { name: 'Apply selected comments' }).click()
  await expect(page.getByText('Prior CHANGED item fixture comment.')).toHaveCount(2)
  await expect(page.getByText('Prior MISSING item fixture comment.')).toHaveCount(1)
})

test('Principal Workbench binds imports to the accepted registry and blocks altered prior self-description', async ({ page }) => {
  await page.goto('http://127.0.0.1:4293/#comments')
  await page.getByLabel('Comment').fill('Active comment survives registry rejection.')
  await page.getByRole('button', { name: 'Save locally' }).click()
  const before = await page.evaluate(() => {
    const model = (window as typeof window & { __WORKBENCH_MODEL__: { revision: string } }).__WORKBENCH_MODEL__
    return localStorage.getItem(`trace-principal-review:${model.revision}`)
  })
  await page.getByLabel('Import review book').setInputFiles('artifacts/principal-review/FIXTURE_ALTERED_PRIOR_ITEM_IDENTITY.json')
  await expect(page.getByText(/QUARANTINED.*ANCHOR_IDENTITIES_REGISTRY_MISMATCH/)).toBeVisible()
  await expect(page.getByText('Active comment survives registry rejection.')).toBeVisible()
  await expect(page.getByText(/COMPARISON READY/)).toHaveCount(0)
  expect(await page.evaluate(() => {
    const model = (window as typeof window & { __WORKBENCH_MODEL__: { revision: string } }).__WORKBENCH_MODEL__
    return localStorage.getItem(`trace-principal-review:${model.revision}`)
  })).toBe(before)
})

test('Principal Workbench uses strict calendar timestamps and canonical browser/Node comment identities', async ({ page }) => {
  const prior = JSON.parse(await readFile('artifacts/principal-review/FIXTURE_PRIOR_REVIEW_BOOK.json', 'utf8'))
  const ordered = prior.comments[0]
  const reversed = Object.fromEntries(Object.entries(ordered).reverse())
  await page.goto('http://127.0.0.1:4293/#comments')
  const browser = await page.evaluate(([first, second]) => {
    const api = (window as typeof window & { __WORKBENCH_TEST_API__: { commentIdentity: (value: unknown) => string; validUtcTimestamp: (value: string) => boolean; validateBook: (value: unknown) => { ok: boolean; duplicatesRemoved: number; value: { comments: unknown[] } } } }).__WORKBENCH_TEST_API__
    const model = (window as typeof window & { __WORKBENCH_MODEL__: { revisionRegistry: { entries: Array<{ revision: string; sourceIdentity: unknown; anchorSourceIdentities: unknown }> } } }).__WORKBENCH_MODEL__
    const entry = model.revisionRegistry.entries.find((item) => item.revision === (first as { sourceRevision: string }).sourceRevision)!
    const result = api.validateBook({ schemaVersion: '3.0.0', revision: entry.revision, sourceIdentity: entry.sourceIdentity, anchorSourceIdentities: entry.anchorSourceIdentities, comments: [first, second] })
    const invalid = ['2026-02-29T00:00:00.000Z','2026-02-31T00:00:00.000Z','2026-02-00T00:00:00.000Z','2026-04-31T00:00:00.000Z','2026-01-01T24:00:00.000Z','2026-01-01T00:60:00.000Z','2026-01-01T00:00:60.000Z','2026-01-01T00:00:00.0Z','2026-01-01T00:00:00.00Z','2026-01-01T00:00:00.0000Z','2026-01-01T00:00:00+00:00','x2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Zx']
    const valid = ['2024-02-29T00:00:00.000Z','2026-09-19T00:00:00Z',new Date().toISOString()]
    return { first: api.commentIdentity(first), second: api.commentIdentity(second), validation: result, invalid: invalid.map((value) => api.validUtcTimestamp(value)), valid: valid.map((value) => api.validUtcTimestamp(value)) }
  }, [ordered, reversed])
  expect(browser.first).toBe(nodeCommentIdentity(ordered))
  expect(browser.second).toBe(nodeCommentIdentity(reversed))
  expect(browser.first).toBe(browser.second)
  expect(browser.validation.ok).toBe(true)
  expect(browser.validation.duplicatesRemoved).toBe(1)
  expect(browser.validation.value.comments).toEqual([ordered])
  expect(browser.invalid.every((value) => value === false)).toBe(true)
  expect(browser.valid.every((value) => value === true)).toBe(true)
  expect(nodeValidUtcTimestamp('2026-02-31T00:00:00.000Z')).toBe(false)
  await mkdir('artifacts/g6p-s7-r3-r3/REPORTS', { recursive: true })
  await writeFile('artifacts/g6p-s7-r3-r3/REPORTS/BROWSER_NODE_CANONICAL_IDENTITY_PARITY.json', JSON.stringify({ status: 'PASS', nodeIdentity: nodeCommentIdentity(ordered), browserIdentity: browser.first, keyOrderDuplicateCollapsed: browser.validation.duplicatesRemoved === 1, strictTimestampParity: true }, null, 2) + '\n')
})

test('Principal Workbench quarantines invalid local storage and failed migration without changing stored bytes', async ({ page }) => {
  const model = JSON.parse(await readFile('artifacts/principal-review/WORKBENCH_MODEL.json', 'utf8'))
  const key = `trace-principal-review:${model.revision}`
  await page.addInitScript(({ storageKey }) => localStorage.setItem(storageKey, '{not-json'), { storageKey: key })
  await page.goto('http://127.0.0.1:4293/#comments')
  await expect(page.getByRole('heading', { name: 'Principal comment book' })).toBeVisible()
  await expect(page.getByText(/LOCAL STORAGE QUARANTINED/)).toBeVisible()
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe('{not-json')
  expect(await page.locator('#book article').count()).toBe(0)

  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key)
  await page.reload()
  await page.getByLabel('Import review book').setInputFiles('artifacts/principal-review/FIXTURE_PRIOR_REVIEW_BOOK.json')
  await page.getByRole('button', { name: 'Select all SAME comments' }).click()
  const beforeMigration = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
  await page.evaluate(() => { (window as typeof window & { __WORKBENCH_MODEL__: { revisionRegistry: { digest: string } } }).__WORKBENCH_MODEL__.revisionRegistry.digest = '0'.repeat(64) })
  await page.getByRole('button', { name: 'Apply selected comments' }).click()
  await expect(page.getByText(/MIGRATION QUARANTINED/)).toBeVisible()
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(beforeMigration)
  await mkdir('artifacts/g6p-s7-r3-r3/REPORTS', { recursive: true })
  await writeFile('artifacts/g6p-s7-r3-r3/REPORTS/STARTUP_AND_LOCAL_STORAGE_QUARANTINE.json', JSON.stringify({ status: 'PASS', invalidCurrentStorageOpenedEmpty: true, invalidStorageBytesPreserved: true, failedMigrationStoragePreserved: true }, null, 2) + '\n')
})

test('actual shared game renderer preserves all thirteen lines in every mode, zoom, and motion setting', async ({ page }) => {
  const output = 'artifacts/g6p-s7-r3-r1/SCREENSHOTS'
  await mkdir(output, { recursive: true })
  await page.goto('http://127.0.0.1:4293/actual-renderer/index.html')
  await expect(page.getByTestId('actual-game-renderer')).toBeVisible()
  await expect(page.locator('[data-renderer-line]')).toHaveCount(13)
  const measurements: Array<{ mode: string; zoomPercent: number; reducedMotion: boolean; rows: Array<{ key: string | undefined; clientWidth: number; scrollWidth: number; clientHeight: number; scrollHeight: number; text: string; aria: string | null }>; bodyHorizontalOverflow: boolean; focusRetained: boolean }> = []
  for (const zoom of [1, 2]) for (const reduced of [false, true]) for (const mode of ['FULLSCREEN_CRT', 'DOCKED_OVERLAY', 'PLAIN_LIST']) {
    await page.evaluate((value) => { document.documentElement.style.zoom = String(value) }, zoom)
    const select = page.getByLabel('Presentation')
    await select.focus()
    await select.selectOption(mode)
    expect(await select.evaluate((element) => element === document.activeElement)).toBe(true)
    const checkbox = page.getByLabel('Reduced motion')
    if (await checkbox.isChecked() !== reduced) await checkbox.click()
    await expect(page.getByTestId('actual-game-renderer')).toHaveAttribute('data-mode', mode)
    await expect(page.getByTestId('actual-game-renderer')).toHaveAttribute('data-reduced', String(reduced))
    const rows = await page.locator('[data-renderer-line]').evaluateAll((elements) => elements.map((element) => ({ key:(element as HTMLElement).dataset.rendererLine, clientWidth:(element as HTMLElement).clientWidth, scrollWidth:(element as HTMLElement).scrollWidth, clientHeight:(element as HTMLElement).clientHeight, scrollHeight:(element as HTMLElement).scrollHeight, text:(element.textContent ?? '').trim(), aria:element.getAttribute('aria-label') })))
    expect(rows.every((row) => row.scrollWidth <= row.clientWidth + 1 && row.scrollHeight <= row.clientHeight + 1 && Boolean(row.aria) && row.text.length > 0)).toBe(true)
    measurements.push({ mode, zoomPercent: zoom * 100, reducedMotion: reduced, rows, bodyHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), focusRetained: true })
    await page.locator('.actual-renderer-lines').screenshot({ path: `${output}/${mode.toLowerCase()}_${zoom * 100}_${reduced ? 'reduced' : 'ordinary'}.png` })
  }
  expect(measurements.every((entry) => entry.bodyHorizontalOverflow === false)).toBe(true)
  await writeFile('artifacts/g6p-s7-r3-r1/REPORTS/ACTUAL_THIRTEEN_LINE_RENDERER_MEASUREMENTS.json', JSON.stringify({ status: 'PASS', sharedProductionComponent: 'src/app/GameDialoguePresentation.tsx', combinations: measurements }, null, 2) + '\n')
})
