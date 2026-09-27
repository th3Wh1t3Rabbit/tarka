#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const required = [
  'README.md', 'LICENSE.md', 'LICENSE-CODE-MIT.md', 'LICENSE-CONTENT.md',
  'RIGHTS_MANIFEST.md', 'THIRD_PARTY_NOTICES.md', 'docs/index.md',
  'docs/play.md', 'docs/controls.md', 'docs/architecture.md',
  'docs/nansen-integration.md', 'docs/testing.md', 'docs/limitations.md',
  'docs/credits.md', 'docs-site/index.html', 'docs-site/assets/site.css',
  'docs-site/assets/site.js', 'docs-site/assets/library.js',
  'docs-site/build-manifest.json', 'docs-site/404.html',
  'wrangler.game.jsonc', 'wrangler.docs.jsonc',
  'artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json',
  'artifacts/g6p-s3/REPORTS/SYNTHETIC_SEMANTIC_FIXTURE.json',
]

for (const relative of required) {
  const path = join(root, relative)
  if (!statSync(path).isFile()) throw new Error(`Missing public release file: ${relative}`)
}

const publicText = []
for (const relative of ['README.md', ...required.filter((item) => item.startsWith('docs/')), 'docs-site/index.html']) {
  publicText.push(readFileSync(join(root, relative), 'utf8'))
}
const text = publicText.join('\n')
for (const forbidden of ['DOC-TODO', '{{PLAY_URL}}', '{{GITHUB_URL}}', '/home/']) {
  if (text.includes(forbidden)) throw new Error(`Public release text contains forbidden marker: ${forbidden}`)
}
for (const requiredText of [
  'th3Wh1t3Rabbit',
  'https://github.com/th3Wh1t3Rabbit/tarka',
  'https://play.tarka-meridian.workers.dev/',
  'https://docs.tarka-meridian.workers.dev/',
  'zero live provider calls',
]) {
  if (!text.toLocaleLowerCase().includes(requiredText.toLocaleLowerCase())) {
    throw new Error(`Public release text is missing: ${requiredText}`)
  }
}

const topLevel = new Set(readdirSync(root))
for (const privateName of ['review', 'AGENTS.md', 'PRINCIPAL_PREVIEW', 'ART_DROP']) {
  if (topLevel.has(privateName)) throw new Error(`Internal-only release entry remains: ${privateName}`)
}

const artifactFiles = readdirSync(join(root, 'artifacts/g6p-s3/REPORTS')).sort()
const expectedArtifacts = ['SYNTHETIC_SEMANTIC_FIXTURE.json', 'TE_IFACE_CORPUS_FINAL_CANDIDATE.json']
if (JSON.stringify(artifactFiles) !== JSON.stringify(expectedArtifacts)) {
  throw new Error(`Only compile-required public fixtures may remain under artifacts/: ${artifactFiles.join(', ')}`)
}

process.stdout.write('PASS: public documentation, licensing, identities, links, and internal-file exclusions verified.\n')
