#!/usr/bin/env node
import { rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('..', import.meta.url))
const captureRoot = fileURLToPath(new URL('../artifacts/g5/final-captures/', import.meta.url))

rmSync(captureRoot, { recursive: true, force: true })

const captures = [
  {
    spec: 'tests/e2e/capture.spec.ts',
    directory: `${captureRoot}synthetic`,
  },
  {
    spec: 'tests/e2e/g5-hero.spec.ts',
    directory: `${captureRoot}g5-hero`,
  },
]

for (const capture of captures) {
  const result = spawnSync(
    'npx',
    ['playwright', 'test', capture.spec, '--grep', '@capture'],
    {
      cwd: repository,
      encoding: 'utf8',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        TRACE_CAPTURE_DIRECTORY: capture.directory,
      },
    },
  )
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  if (result.status !== 0) process.exit(result.status ?? 1)
}
