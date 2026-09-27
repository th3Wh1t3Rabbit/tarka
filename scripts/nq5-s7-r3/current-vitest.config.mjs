import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/{unit,acquisition}/**/*.{test,spec}.{ts,tsx,mjs}'],
    environment: 'node',
    exclude: [
      ...configDefaults.exclude,
      '**/tests/unit/parallel/narrative-contract/catalogs.test.mjs',
      '**/tests/unit/s4-r1-remediation.test.ts',
    ],
  },
})
