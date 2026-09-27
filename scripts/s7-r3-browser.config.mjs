import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
export default defineConfig({
  testDir: '../tests/e2e', testMatch: 's7-r3-*.spec.ts', timeout: 180000, workers: 1, retries: 0,
  reporter: [['list']], outputDir: '../.s7-r3-browser-results',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4283', screenshot: 'off', trace: 'off', video: 'off' },
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4283 --strictPort', cwd, url: 'http://127.0.0.1:4283', reuseExistingServer: false },
    { command: 'node scripts/nq5-s7-r3/serve-principal.mjs', cwd, url: 'http://127.0.0.1:4293', reuseExistingServer: false },
  ],
})
