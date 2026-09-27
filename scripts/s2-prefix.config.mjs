import {defineConfig} from 'vitest/config'
export default defineConfig({test:{include:['tests/unit/s2-prefix.repro.ts'],environment:'node'}})
