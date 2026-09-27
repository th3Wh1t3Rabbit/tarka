#!/usr/bin/env node
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { hasSecretLikeValue } from './secret-patterns.mjs'

const rootPath = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../', import.meta.url))
const ignoredDirectories = new Set(['.git', 'node_modules', 'playwright-report', 'test-results', '.acquisition-build'])
const forbiddenNames = [/(?:api|access|secret)[_-]?key/i, /credential/i, /^\.env(?:\.|$)/i]
const credentialArtifactExtensions = new Set(['.txt', '.env', '.key', '.pem', '.p12', '.pfx'])

const files = []
const failures = []
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue
    const fullPath = path.join(directory, entry)
    const stat = lstatSync(fullPath)
    if (stat.isSymbolicLink()) {
      failures.push(`symbolic link is not allowed in scanned delivery content: ${path.relative(rootPath, fullPath)}`)
      continue
    }
    if (stat.isDirectory()) walk(fullPath)
    else files.push(fullPath)
  }
}
walk(rootPath)

for (const file of files) {
  const relative = path.relative(rootPath, file)
  const basename = path.basename(file)
  const extension = path.extname(file).toLowerCase()
  if ((basename.toLowerCase().startsWith('.env') || credentialArtifactExtensions.has(extension)) && forbiddenNames.some((pattern) => pattern.test(basename))) failures.push(`forbidden credential filename: ${relative}`)
  const bytes = readFileSync(file)
  let content
  try {
    content = path.extname(file).toLowerCase() === '.gz' ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8')
  } catch {
    failures.push(`unreadable compressed artifact: ${relative}`)
    continue
  }
  if (hasSecretLikeValue(content)) failures.push(`secret-like credential value: ${relative}`)
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`PASS: scanned ${files.length} repository files; no credential files or secret-like values found.\n`)
}
