import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['delivery/**', 'artifacts/**', 'node_modules/**'],
    passWithNoTests: false,
    // The persistence stress case intentionally replays more than two hundred
    // optional runs. Give it headroom when the complete suite runs in parallel.
    testTimeout: 15_000,
  },
})
