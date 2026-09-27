import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const output = path.join(root, 'artifacts/principal-review')
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const files = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]).sort()
const snapshot = () => Object.fromEntries(files(output).map((name) => [name, sha(path.join(output, name))]))
const generate = () => { execFileSync(process.execPath, ['scripts/nq5-s7-r3/review-principal-r1.mjs'], { cwd: root, stdio: 'pipe' }); execFileSync(process.execPath, ['scripts/nq5-s7-r3/build-renderer.mjs'], { cwd: root, stdio: 'pipe' }) }
generate()
const first = snapshot()
generate()
const second = snapshot()
if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('PRINCIPAL_WORKBENCH_NONDETERMINISTIC')
console.log(JSON.stringify({ status: 'PASS', deterministic: true, files: Object.keys(first).length, sha256: first }))
