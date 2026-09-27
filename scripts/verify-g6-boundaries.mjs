#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const genericFiles = ['src/app/App.tsx', 'src/game/compiler/compile.ts', 'src/game/domain/reducer.ts', 'src/game/domain/types.ts', 'src/game/render/VaultScene.tsx', 'src/game/render/presentationAdapter.ts', 'src/game/debug/debug.ts']
const forbidden = [
  ['Hero scenario ID', /EULER_2023_FALSE_EXIT/],
  ['Hero transaction', /c310a0affe|298bde3f|dae809e4|32be972b/i],
  ['Hero address', /ebc29199|b66cd966|5f259d0b|b2698c2d|c66dfa84/i],
  ['Hero exact amount', /8877507|34186225|88752\.697/],
  ['Hero title', /THE FALSE EXIT/],
  ['scenario branch identity', /first-breach|second-breach/],
  ['superseded synthetic identity', /Quiet Reservoir|High Activity|Prism Converter|Prism Archive/],
]
const errors = []
for (const relative of genericFiles) {
  const content = await readFile(path.join(root, relative), 'utf8')
  for (const [label, pattern] of forbidden) if (pattern.test(content)) errors.push(`${label} is hard-coded in ${relative}`)
}
const domain = await readFile(path.join(root, 'src/game/domain/types.ts'), 'utf8')
if (/playerLocation|cameraPosition|worldPosition|position\s*:/.test(domain)) errors.push('Logical domain exposes presentation coordinates')
const renderer = await readFile(path.join(root, 'src/game/render/VaultScene.tsx'), 'utf8')
if (!renderer.includes('guidedProbe3dAdapter')) errors.push('Renderer does not use presentation adapter')
const contracts = await readFile(path.join(root, 'src/game/scenario/contracts.ts'), 'utf8')
if (!contracts.includes("implementedProfiles: ['GUIDED_PROBE_3D']")) errors.push('Implemented profile contract is not limited to GUIDED_PROBE_3D')
if (errors.length) throw new Error(`G6 boundary verification failed: ${errors.join('; ')}`)
process.stdout.write('PASS: generic stages, logical navigation, presentation seam, and Hero-content boundaries are intact.\n')

