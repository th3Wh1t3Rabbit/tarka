#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const preview = path.join(repository, 'PRINCIPAL_PREVIEW')
const staticBuild = path.join(preview, 'static-build')
const screenshots = path.join(preview, 'screenshots')
const source = path.join(repository, 'artifacts/screenshots/g6p-a1')

rmSync(staticBuild, { recursive: true, force: true })
cpSync(path.join(repository, 'dist'), staticBuild, { recursive: true })
for (const file of walk(staticBuild)) if (file.endsWith('.map')) rmSync(file)
rmSync(screenshots, { recursive: true, force: true })
mkdirSync(screenshots, { recursive: true })
const names = readdirSync(source).filter((name) => name.endsWith('.png')).sort()
if (names.length !== 8) throw new Error(`Expected 8 G6P-A1 captures, found ${names.length}`)
for (const name of names) cpSync(path.join(source, name), path.join(screenshots, name))
execFileSync('montage', [...names.map((name) => path.join(screenshots, name)), '-thumbnail', '480x270', '-tile', '4x2', '-geometry', '+10+10', '-background', '#071014', path.join(preview, 'CONTACT_SHEET.png')])
process.stdout.write(`PASS: synchronized static build, ${names.length} captures, and contact sheet.\n`)

function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}
