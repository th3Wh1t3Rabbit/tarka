#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const preview = path.join(repository, 'PRINCIPAL_PREVIEW')
const staticBuild = path.join(preview, 'static-build')
const screenshots = path.join(preview, 'screenshots')

rmSync(staticBuild, { recursive: true, force: true })
cpSync(path.join(repository, 'dist'), staticBuild, { recursive: true })
for (const file of walk(staticBuild)) if (file.endsWith('.map')) rmSync(file)

rmSync(screenshots, { recursive: true, force: true })
mkdirSync(screenshots, { recursive: true })
const sources = [
  ...readdirSync(path.join(repository, 'artifacts/screenshots/g6-hero')).filter((name) => name.endsWith('.png')).sort().map((name) => [path.join(repository, 'artifacts/screenshots/g6-hero', name), name]),
  ...readdirSync(path.join(repository, 'artifacts/screenshots/g6-comparison')).filter((name) => name.endsWith('.png')).sort().map((name, index) => [path.join(repository, 'artifacts/screenshots/g6-comparison', name), `${String(index + 23).padStart(2, '0')}-${name.replace(/^\d+-/, '')}`]),
]
for (const [source, name] of sources) cpSync(source, path.join(screenshots, name))
const ordered = sources.map(([, name]) => path.join(screenshots, name))
execFileSync('montage', [...ordered, '-thumbnail', '320x180', '-tile', '4x6', '-geometry', '+8+8', '-background', '#05080a', path.join(preview, 'CONTACT_SHEET.png')])
process.stdout.write(`PASS: synchronized production build, ${ordered.length} captures, and contact sheet.\n`)

function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}
