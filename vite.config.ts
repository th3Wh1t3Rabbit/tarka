import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

function gitIdentity(args: string[], fallback: string): string {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || fallback
  }
  catch { return fallback }
}

const buildCommit = process.env.VITE_TARKA_BUILD_COMMIT || gitIdentity(['rev-parse', 'HEAD'], 'SOURCE_ARCHIVE')
const buildTree = process.env.VITE_TARKA_BUILD_TREE || gitIdentity(['rev-parse', 'HEAD^{tree}'], 'SOURCE_ARCHIVE')
const buildId = process.env.VITE_TARKA_BUILD_ID || `tarka-${buildCommit.slice(0, 12).toLowerCase()}`
const buildRoot = process.env.VITE_TARKA_BUILD_ROOT || 'static-dist'

const removeRetiredWorldFromPublicBuild = {
  name: 'remove-retired-world-from-public-build',
  closeBundle() {
    rmSync(path.resolve('dist/scenarios/euler-2023-false-exit/world.json'), { force: true })
  },
}

export default defineConfig({
  plugins: [react(), removeRetiredWorldFromPublicBuild],
  define: {
    'import.meta.env.VITE_TARKA_BUILD_COMMIT': JSON.stringify(buildCommit),
    'import.meta.env.VITE_TARKA_BUILD_TREE': JSON.stringify(buildTree),
    'import.meta.env.VITE_TARKA_BUILD_ID': JSON.stringify(buildId),
    'import.meta.env.VITE_TARKA_BUILD_ROOT': JSON.stringify(buildRoot),
  },
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { sourcemap: false },
})
