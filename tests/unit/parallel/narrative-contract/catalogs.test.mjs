import {it,expect} from 'vitest'
import {execFileSync} from 'node:child_process'
it('runs the dependency-free narrative contract and mutation suite',()=>{
  const output=execFileSync(process.execPath,['--test','tests/unit/parallel/narrative-contract/catalogs.node.mjs'],{encoding:'utf8'})
  expect(output).toContain('# fail 0')
  expect(output).toContain('# tests 25')
})
