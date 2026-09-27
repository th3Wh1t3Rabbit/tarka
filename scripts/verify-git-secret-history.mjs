#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { hasSecretLikeValue } from './secret-patterns.mjs'

const forbiddenNames = [/(?:api|access|secret)[_-]?key/i, /credential/i, /^\.env(?:\.|$)/i]
const credentialArtifactExtensions = new Set(['.txt', '.env', '.key', '.pem', '.p12', '.pfx'])

// Exclude the explicitly separate user asset lanes before object enumeration,
// not after reading their filenames or bytes. Every governed source blob stays
// covered across reachable history; no broad file/content exemptions apply.
const rows = execFileSync('git', ['rev-list', '--objects', '--all', '--', '.', ':(exclude)ART_PRODUCTION', ':(exclude).cursor'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .trim().split('\n').filter(Boolean)
const failures = []
let blobsScanned = 0
for (const row of rows) {
  const [objectId, ...pathParts] = row.split(' ')
  const objectPath = pathParts.join(' ')
  // Git can still emit an excluded root tree ID. Do not inspect even its type.
  if (['ART_PRODUCTION', '.cursor'].some((lane) => objectPath === lane || objectPath.startsWith(`${lane}/`))) continue
  const basename = objectPath.split('/').at(-1) ?? ''
  const extension = basename.includes('.') ? `.${basename.split('.').at(-1)?.toLowerCase()}` : ''
  if (objectPath && (basename.toLowerCase().startsWith('.env') || credentialArtifactExtensions.has(extension)) && forbiddenNames.some((pattern) => pattern.test(basename))) failures.push(`forbidden credential-like historical path: ${objectPath}`)
  if (execFileSync('git', ['cat-file', '-t', objectId], { encoding: 'utf8' }).trim() !== 'blob') continue
  const bytes = execFileSync('git', ['cat-file', 'blob', objectId], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  blobsScanned += 1
  const content = bytes.toString('utf8')
  if (hasSecretLikeValue(content)) failures.push(`secret-like value in historical blob ${objectId}${objectPath ? ` (${objectPath})` : ''}`)
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`PASS: scanned ${blobsScanned} governed Git blobs; no credential filenames or secret-like values found; separate asset lanes excluded before enumeration.\n`)
}
