import { defineConfig } from '@playwright/test'
import { createRequire } from 'node:module'
import path from 'node:path'
const require = createRequire(import.meta.url)
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')
export default defineConfig({
  testDir: '.', testMatch: 'corpus.spec.ts', timeout: 60000, workers: 1,
  outputDir: '../../../docs/parallel/lane-c/evidence/browser-results',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4187', browserName: 'chromium', serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
  webServer: { command: `${JSON.stringify(process.execPath)} ${JSON.stringify(vite)} preview --config tests/e2e/lane-c/vite.config.ts`,
    cwd: '../../..', url: 'http://127.0.0.1:4187/src/app/corpus-presentation/harness.html', reuseExistingServer: false, timeout: 30000 },
})
