#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const buildRoot = path.resolve('dist')
const forbiddenMarkers = ['FUTURE_NANSEN_BUILD_TIME', 'FIXTURE_ONLY_NO_NETWORK', 'leadAuthorizationId', 'requestFingerprint']
const acquisitionRoots = [path.resolve('src/acquisition'), path.resolve('scripts/acquisition')]
const forbiddenNetworkImports = new Set(['node:net', 'net', 'node:tls', 'tls', 'node:dns', 'dns', 'node:dgram', 'dgram', 'node:http', 'http', 'node:https', 'https', 'node:http2', 'http2', 'undici', 'axios', 'got', 'node-fetch', 'ws'])
const authorizedTransportFile = path.resolve('src/acquisition/live/transport.ts')
const files = []

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const target = path.join(directory, entry)
    if (statSync(target).isDirectory()) walk(target)
    else files.push(target)
  }
}

walk(buildRoot)
for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const marker = forbiddenMarkers.find((candidate) => content.includes(candidate))
  if (marker) throw new Error(`Private acquisition marker entered browser build: ${marker}`)
}

const acquisitionFiles = []
for (const root of acquisitionRoots) {
  const previousFiles = files.splice(0)
  walk(root)
  acquisitionFiles.push(...files.splice(0))
  files.push(...previousFiles)
}
for (const file of acquisitionFiles) {
  const content = readFileSync(file, 'utf8')
  for (const match of content.matchAll(/(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)) {
    if (forbiddenNetworkImports.has(match[1]) && path.resolve(file) !== authorizedTransportFile) throw new Error(`Network-capable dependency entered acquisition code: ${match[1]} in ${path.relative(process.cwd(), file)}`)
  }
  if (/\bfetch\s*\(/.test(content) && path.resolve(file) !== authorizedTransportFile) throw new Error(`Network-capable fetch entered unauthorized acquisition code: ${path.relative(process.cwd(), file)}`)
}
process.stdout.write(`PASS: ${files.length} browser build files contain no private acquisition markers; network capability is isolated to the reviewed G4A transport boundary.\n`)
