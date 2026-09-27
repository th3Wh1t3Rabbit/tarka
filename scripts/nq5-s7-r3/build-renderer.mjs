import { build } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'renderer-review')
await build({
  root,
  base: './',
  logLevel: 'warn',
  build: {
    outDir: path.resolve(root, '../../../artifacts/principal-review/actual-renderer'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
})
const output = path.resolve(root, '../../../artifacts/principal-review')
const rendererRoot = path.join(output, 'actual-renderer')
async function files(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) result.push(...(entry.isDirectory() ? await files(path.join(directory, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]))
  return result.sort()
}
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const identityPath = path.join(output, 'BUILD_IDENTITY.json')
const identity = JSON.parse(await readFile(identityPath, 'utf8'))
identity.actualRenderer = {
  sharedComponent: 'src/app/GameDialoguePresentation.tsx',
  files: await Promise.all((await files(rendererRoot)).map(async (name) => { const bytes = await readFile(path.join(rendererRoot, name)); return { path: `actual-renderer/${name}`, bytes: bytes.length, sha256: sha(bytes) } })),
}
await writeFile(identityPath, JSON.stringify(identity, null, 2) + '\n')
console.log('Actual game renderer review emitted at artifacts/principal-review/actual-renderer')
