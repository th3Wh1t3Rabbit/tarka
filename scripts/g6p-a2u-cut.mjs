import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export function assertCleanA2uSourceCut(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  const exclusions = [
    ':(exclude)AGENTS.md',
    ':(exclude).cursor', ':(exclude).cursor/**',
    ':(exclude)ART_PRODUCTION', ':(exclude)ART_PRODUCTION/**',
    ':(exclude)artifacts/g6p-a2p/verification/**',
    ':(exclude)artifacts/g6p-a2u/current/**',
  ]
  // All source and root configuration inputs are covered, not merely src/tests.
  // Git exclusions precede enumeration of the explicitly separate art lane.
  if (git('status', '--porcelain=v1', '--untracked-files=all', '--', '.', ...exclusions)) throw new Error('Source/configuration cut is dirty. Commit reviewed implementation inputs first.')
  const committedInstructions = execFileSync('git', ['show', 'HEAD:AGENTS.md'], { cwd: root, encoding: 'utf8' })
  const workingInstructions = readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
  if (!workingInstructions.startsWith(committedInstructions)) throw new Error('AGENTS.md differs beyond the preserved append-only user art instructions.')
  return { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}') }
}
