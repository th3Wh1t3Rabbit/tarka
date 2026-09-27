import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = fileURLToPath(new URL('../../../', import.meta.url))
export default defineConfig({
  root, base: './',
  build: { outDir: resolve(root, 'docs/parallel/lane-c/evidence/harness-build'), emptyOutDir: true,
    rollupOptions: { input: resolve(root, 'src/app/corpus-presentation/harness.html') } },
  server: { hmr: false }, preview: { host: '127.0.0.1', port: 4187, strictPort: true },
})
