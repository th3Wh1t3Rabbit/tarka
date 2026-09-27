import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/{unit,acquisition}/**/*.{test,spec}.{ts,tsx,mjs}'],
    environment: 'node',
  },
})
