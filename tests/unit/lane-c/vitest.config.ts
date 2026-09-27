import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['tests/unit/lane-c/*.test.ts'], environment: 'node' } })
