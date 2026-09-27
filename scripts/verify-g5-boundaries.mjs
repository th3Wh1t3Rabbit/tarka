#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const implementationFiles = [
  'src/app/App.tsx',
  'src/game/domain/reducer.ts',
  'src/game/render/VaultScene.tsx',
  'src/game/debug/debug.ts',
]
const forbidden = [
  ['Euler scenario ID', /EULER_2023_FALSE_EXIT/],
  ['Euler transaction', /c310a0affe|298bde3f|dae809e4|32be972b/i],
  ['Euler address', /ebc29199|b66cd966|5f259d0b|b2698c2d|c66dfa84/i],
  ['Euler exact amount', /8877507\.348306697|34186225\.91950095|88752\.69745982855/],
  ['Hero theory answer', /early-engine-main-receiver|exact-net-transfer-state/],
  ['Hero title', /THE FALSE EXIT/],
]
const errors = []
for (const relative of implementationFiles) {
  const content = await readFile(path.join(root, relative), 'utf8')
  for (const [label, pattern] of forbidden) if (pattern.test(content)) errors.push(`${label} is hard-coded in ${relative}`)
}
if (errors.length) throw new Error(errors.join('; '))
process.stdout.write(`PASS: renderer, reducer, and debug boundary contain no Hero-specific truth or coordinates.\n`)
