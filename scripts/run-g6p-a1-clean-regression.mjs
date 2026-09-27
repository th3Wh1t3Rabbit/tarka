#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const temporary = mkdtempSync(path.join(os.tmpdir(), 'trace-a1-regression-'))
const checkout = path.join(temporary, 'checkout')
const run = (command, args, cwd = repository, env = process.env) => spawnSync(command, args, { cwd, encoding: 'utf8', env })

try {
  const add = run('git', ['worktree', 'add', '--detach', checkout, 'HEAD'])
  if (add.status !== 0) throw new Error(add.stderr || add.stdout)
  symlinkSync(path.join(repository, 'node_modules'), path.join(checkout, 'node_modules'), 'dir')
  const excludes = path.join(temporary, 'verification-excludes')
  writeFileSync(excludes, 'node_modules\n')
  const verificationEnvironment = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.excludesFile', GIT_CONFIG_VALUE_0: excludes }
  const build = run('npm', ['run', 'build'], checkout, verificationEnvironment)
  if (build.status !== 0) throw new Error(build.stderr || build.stdout)
  const result = run('npm', ['run', 'g6p:a1:verify'], checkout, verificationEnvironment)
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  if (result.status !== 0) process.exitCode = result.status ?? 1
} finally {
  run('git', ['worktree', 'remove', '--force', checkout])
  rmSync(temporary, { recursive: true, force: true })
}
