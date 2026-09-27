#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const requiredRuntimeFiles = [
  'public/audio/background-main.ogg',
  'public/audio/background-terminal.ogg',
  'public/audio/case-closed.ogg',
  'public/audio/degauss-sfx.mp3',
  'public/art-packs/production/files/production/characters/rook/frames/rook_talk_use_reach.png',
  'public/art-packs/production/manifest.json',
  'public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json',
  'public/scenarios/euler-2023-false-exit/scenario.json',
]
const allowedMissingFromDist = new Set(['public/scenarios/euler-2023-false-exit/world.json'])
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.xml'])
const localPathMarkers = [/\/(?:home|tmp|Users)\//, /file:\/\//i, /[A-Za-z]:\\(?:Users|Temp)\\/]

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Release content may not contain symlinks: ${relative(root, path)}`)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

if (!existsSync(join(dist, 'index.html'))) throw new Error('Run the production build before release portability verification')

for (const sourceRelative of requiredRuntimeFiles) {
  const source = join(root, sourceRelative)
  if (!existsSync(source) || !lstatSync(source).isFile()) throw new Error(`Required runtime file is missing: ${sourceRelative}`)
  const builtRelative = sourceRelative.replace(/^public\//, '')
  const built = join(dist, builtRelative)
  if (!existsSync(built)) throw new Error(`Required runtime file did not enter dist: ${builtRelative}`)
  if (sha256(source) !== sha256(built)) throw new Error(`Built runtime file changed bytes: ${builtRelative}`)
}

if (existsSync(join(root, '.git'))) {
  for (const sourceRelative of requiredRuntimeFiles) {
    try { execFileSync('git', ['ls-files', '--error-unmatch', sourceRelative], { cwd: root, stdio: 'ignore' }) }
    catch { throw new Error(`Required runtime file is not tracked by Git: ${sourceRelative}`) }
  }
}

for (const source of walk(join(root, 'public'))) {
  const sourceRelative = relative(root, source).replaceAll('\\', '/')
  if (allowedMissingFromDist.has(sourceRelative)) continue
  if (sourceRelative === 'public/fonts/KarmaFuture-Regular.otf') continue
  const built = join(dist, sourceRelative.replace(/^public\//, ''))
  if (!existsSync(built)) throw new Error(`Public file did not enter dist: ${sourceRelative}`)
  if (sha256(source) !== sha256(built)) throw new Error(`Public file changed bytes in dist: ${sourceRelative}`)
}

for (const file of walk(dist)) {
  if (!textExtensions.has(extname(file))) continue
  const text = readFileSync(file, 'utf8')
  const marker = localPathMarkers.find((candidate) => candidate.test(text))
  if (marker) throw new Error(`Local filesystem dependency entered the generated site: ${relative(dist, file)}`)
}

const index = readFileSync(join(dist, 'index.html'), 'utf8')
if (!index.includes('/assets/')) throw new Error('Built index does not reference its generated assets')

process.stdout.write(`PASS: release is self-contained (${walk(dist).length} built files); required art/audio are present, byte-identical, and free of local filesystem dependencies.\n`)
