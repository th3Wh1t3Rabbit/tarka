import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { assertCleanA2uSourceCut } from '../../scripts/g6p-a2u-cut.mjs'

it('binds all root configuration bytes while preserving excluded art append and outputs', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'trace-a2u-cut-test-'))
  const git = (...args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' })
  try {
    git('init', '--quiet')
    writeFileSync(path.join(directory, 'AGENTS.md'), 'Fixture instructions.\n')
    writeFileSync(path.join(directory, 'vite.config.ts'), 'export default {}\n')
    writeFileSync(path.join(directory, 'package-lock.json'), '{}\n')
    git('add', '.')
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@invalid', 'commit', '--quiet', '-m', 'fixture')
    expect(assertCleanA2uSourceCut(directory).commit).toMatch(/^[a-f0-9]{40}$/)
    writeFileSync(path.join(directory, 'vite.config.ts'), 'export default { altered: true }\n')
    expect(() => assertCleanA2uSourceCut(directory)).toThrow(/dirty/)
    writeFileSync(path.join(directory, 'vite.config.ts'), 'export default {}\n')
    writeFileSync(path.join(directory, 'package-lock.json'), '{ "altered": true }\n')
    expect(() => assertCleanA2uSourceCut(directory)).toThrow(/dirty/)
    writeFileSync(path.join(directory, 'package-lock.json'), '{}\n')
    writeFileSync(path.join(directory, '.npmrc'), 'ignore-scripts=true\n')
    expect(() => assertCleanA2uSourceCut(directory)).toThrow(/dirty/)
    rmSync(path.join(directory, '.npmrc'))
    writeFileSync(path.join(directory, 'AGENTS.md'), 'Fixture instructions.\n\nUser art instructions.\n')
    for (const relative of ['ART_PRODUCTION', '.cursor', 'artifacts/g6p-a2u/current']) {
      mkdirSync(path.join(directory, relative), { recursive: true })
      writeFileSync(path.join(directory, relative, 'excluded-fixture.txt'), 'Not a source input.\n')
    }
    expect(assertCleanA2uSourceCut(directory).commit).toMatch(/^[a-f0-9]{40}$/)
    writeFileSync(path.join(directory, 'AGENTS.md'), 'Altered source instructions.\n')
    expect(() => assertCleanA2uSourceCut(directory)).toThrow(/AGENTS/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
