import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page, type Route } from '@playwright/test'
import type { ArtPackIndex } from '../../src/adventure/types'
import { candidateFixture } from '../fixtures/art-pack'

const repository = path.resolve(import.meta.dirname, '../..')
const installedIndex = JSON.parse(readFileSync(path.join(repository, 'public/art-packs/index.json'), 'utf8')) as ArtPackIndex

type AssetFault = 'NONE' | 'MISSING' | 'DECODE_FAILED' | 'DIMENSION_MISMATCH' | 'DUPLICATE_WALK_CONTENT'

async function installCandidateRoutes(page: Page, fault: AssetFault = 'NONE', identityMismatch = false) {
  const { manifest, indexEntry } = candidateFixture()
  if (identityMismatch) manifest.label = 'Manifest-only label'
  const index = structuredClone(installedIndex)
  index.packs.push(indexEntry)
  const failedSuffix = 'cursor/crosshair.svg'

  await page.route('**/art-packs/lead-candidate/**/*.svg', async (route: Route) => {
    const suffix = new URL(route.request().url()).pathname.split('/art-packs/lead-candidate/')[1]!
    if (suffix === failedSuffix && fault === 'MISSING') return route.fulfill({ status: 404, body: 'missing fixture' })
    if (suffix === failedSuffix && fault === 'DECODE_FAILED') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<not-an-image>' })
    const source = suffix === 'characters/rook-walk-2.svg' && fault === 'DUPLICATE_WALK_CONTENT'
      ? path.join(repository, 'public/art-packs/placeholder/characters/rook-walk.svg')
      : suffix === failedSuffix && fault === 'DIMENSION_MISMATCH'
      ? path.join(repository, 'public/art-packs/placeholder/backgrounds/records-office.svg')
      : path.join(repository, 'public/art-packs/placeholder', suffix)
    return route.fulfill({ path: source, contentType: 'image/svg+xml' })
  })
  await page.route('**/art-packs/lead-candidate/manifest.json', (route) => route.fulfill({ json: manifest }))
  await page.route('**/art-packs/index.json', (route) => route.fulfill({ json: index }))
  await page.goto('/?artLab=1&artPack=lead-candidate')
  await expect(page.getByTestId('art-pack-diagnostics')).toBeVisible()
}

test.describe('G6P-A1-R2 Art Pack content integrity @g6p-r2', () => {
  for (const [fault, status] of [
    ['MISSING', 'MISSING'],
    ['DECODE_FAILED', 'DECODE_FAILED'],
    ['DIMENSION_MISMATCH', 'DIMENSION_MISMATCH'],
  ] as const) {
    test(`a Lead-selected candidate with ${fault} required art cannot report success`, async ({ page }) => {
      await installCandidateRoutes(page, fault)
      await expect(page.getByRole('heading', { name: 'INVALID_REQUIRED_ASSETS' })).toBeVisible()
      await expect(page.getByTestId('art-slot-summary')).toContainText('CANDIDATE NOT ACTIVE')
      await expect(page.getByTestId('art-lab')).not.toContainText('REQUIRED SLOTS COMPLETE')
      await expect(page.locator('[data-slot="cursor.crosshair"]')).toHaveAttribute('data-slot-status', status)
      await expect(page.getByTestId('art-pack-diagnostics')).toContainText('placeholder / PROVISIONAL_PLACEHOLDER')
    })
  }

  test('an index/manifest identity mismatch is explicit and skips candidate activation', async ({ page }) => {
    await installCandidateRoutes(page, 'NONE', true)
    await expect(page.getByRole('heading', { name: 'INVALID_INDEX_MANIFEST_MISMATCH' })).toBeVisible()
    await expect(page.getByTestId('art-slot-summary')).toContainText('CANDIDATE NOT ACTIVE')
    await expect(page.getByTestId('art-pack-diagnostics')).toContainText('CONSISTENCYFAIL')
  })

  test('different walk URLs with identical fetched bytes fail closed and expose fingerprints', async ({ page }) => {
    await installCandidateRoutes(page, 'DUPLICATE_WALK_CONTENT')
    await expect(page.getByRole('heading', { name: 'INVALID_REQUIRED_ASSETS' })).toBeVisible()
    await expect(page.getByTestId('art-slot-summary')).toContainText('CANDIDATE NOT ACTIVE')
    await expect(page.getByTestId('art-lab')).not.toContainText('COMPLETE_LEAD_SELECTED')
    await expect(page.getByTestId('art-lab')).not.toContainText('REQUIRED SLOTS COMPLETE')
    const first = page.locator('[data-slot="characters.rook.walkEast.frame1"]')
    const second = page.locator('[data-slot="characters.rook.walkEast.frame2"]')
    await expect(first).toHaveAttribute('data-slot-status', 'DUPLICATE_CONTENT')
    await expect(second).toHaveAttribute('data-slot-status', 'DUPLICATE_CONTENT')
    const firstFingerprint = await first.getAttribute('data-fingerprint')
    expect(firstFingerprint).toMatch(/^[a-f0-9]{64}$/)
    await expect(second).toHaveAttribute('data-fingerprint', firstFingerprint!)
  })

  test('an encoded path escape is invalid before any candidate resource can load', async ({ page }) => {
    const { manifest, indexEntry } = candidateFixture()
    manifest.cursor.crosshair.src = '/art-packs/lead-candidate/%2e%2e/placeholder/cursor/crosshair.svg'
    const index = structuredClone(installedIndex); index.packs.push(indexEntry)
    let candidateAssetRequests = 0
    page.on('request', (request) => { if (request.url().includes('/art-packs/lead-candidate/') && !request.url().endsWith('/manifest.json')) candidateAssetRequests += 1 })
    await page.route('**/art-packs/lead-candidate/manifest.json', (route) => route.fulfill({ json: manifest }))
    await page.route('**/art-packs/index.json', (route) => route.fulfill({ json: index }))
    await page.goto('/?artLab=1&artPack=lead-candidate')
    await expect(page.getByRole('heading', { name: 'INVALID_MANIFEST' })).toBeVisible()
    await expect(page.getByTestId('art-slot-summary')).toContainText('CANDIDATE NOT ACTIVE')
    expect(candidateAssetRequests).toBe(0)
  })

  test('empty audition descriptors say they inherit the placeholder and never claim completeness', async ({ page }) => {
    await page.goto('/?artLab=1&artPack=deco-archive-noir')
    await expect(page.getByRole('heading', { name: 'EMPTY_INHERITING_PLACEHOLDER' })).toBeVisible()
    await expect(page.getByTestId('art-slot-summary')).toHaveText('ZERO CANDIDATE ASSETS INSTALLED // PLACEHOLDER INHERITED')
    await expect(page.getByTestId('art-lab')).not.toContainText('REQUIRED SLOTS COMPLETE')
    await expect(page.locator('[data-slot-status="INHERITED_PLACEHOLDER"]').first()).toBeVisible()
  })

  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    test(`Art Lab diagnostics and labels do not overlap at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/?artLab=1')
      await expect(page.getByTestId('art-pack-diagnostics')).toBeVisible()
      const measurements = await page.evaluate(() => {
        const labels = [...document.querySelectorAll<HTMLElement>('.lab-props small, .lab-inventory small')]
        const rectangles = labels.map((label) => label.getBoundingClientRect())
        const overlaps = rectangles.flatMap((left, leftIndex) => rectangles.slice(leftIndex + 1).filter((right) =>
          left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top,
        ))
        const rows = [...document.querySelectorAll<HTMLElement>('[data-slot-status]')]
        const diagnosticOverlapCount = rows.filter((row) => {
          const fingerprint = row.querySelector('code')?.getBoundingClientRect()
          const status = row.querySelector('td:last-child strong')?.getBoundingClientRect()
          return Boolean(fingerprint && status && fingerprint.left < status.right && fingerprint.right > status.left && fingerprint.top < status.bottom && fingerprint.bottom > status.top)
        }).length
        return {
          overlapCount: overlaps.length,
          diagnosticOverlapCount,
          minimumLabelFontPx: Math.min(...labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize))),
          diagnosticsRows: rows.length,
          rowsHaveStatus: rows.every((row) => Boolean(row.dataset.slotStatus)),
          labScrollable: (() => {
            const lab = document.querySelector<HTMLElement>('.art-lab')
            return Boolean(lab && lab.scrollHeight > lab.clientHeight)
          })(),
        }
      })
      expect(measurements.overlapCount).toBe(0)
      expect(measurements.diagnosticOverlapCount).toBe(0)
      expect(measurements.minimumLabelFontPx).toBeGreaterThanOrEqual(16)
      expect(measurements.diagnosticsRows).toBeGreaterThan(30)
      expect(measurements.rowsHaveStatus).toBe(true)
      expect(measurements.labScrollable).toBe(true)
    })
  }
})
