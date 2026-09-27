import { expect, test } from '@playwright/test'

test('S12-P1-R1 accessibility survives reload and ephemeral adventure state does not', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (message) => { if (message.type() === 'error' || /setState|Cannot update a component/i.test(message.text())) problems.push(message.text()) })
  page.on('pageerror', (error) => problems.push(error.message))
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await page.getByLabel('Dialogue presentation').selectOption('PLAIN_LIST')
  await page.getByRole('button', { name: 'LOOK AT 5' }).click()
  await page.getByRole('button', { name: 'Official case-file cabinet' }).click()
  await expect(page.getByTestId('dialogue-transcript')).toContainText('PLACEHOLDER', { timeout: 15000 })
  const before = await page.evaluate(() => ({
    access: localStorage.getItem('trace-escape.accessibility.v1'),
    layout: localStorage.getItem('trace-escape.layout-library.v1'),
  }))
  expect(before.access).toContain('PLAIN_LIST')
  expect(before.access).not.toContain('"walk"')
  expect(before.access).not.toContain('"speech"')
  await page.reload()
  await expect(page.getByLabel('Dialogue presentation')).toHaveValue('PLAIN_LIST')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
  const after = await page.evaluate(() => localStorage.getItem('trace-escape.accessibility.v1'))
  expect(after).toBe(before.access)
  expect(before.layout).toBeNull()
  expect(problems).toEqual([])
})
