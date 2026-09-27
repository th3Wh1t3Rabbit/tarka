import { defineConfig, devices } from '@playwright/test'
// Never attach qualification to one of the preserved/frozen review previews.
// R3 reproduced that failure mode on 4175: source edits were correct while the
// browser suite silently exercised an older long-running process.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 43992)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 75_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
