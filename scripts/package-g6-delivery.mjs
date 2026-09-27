#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const archiveName = 'TRACE_ESCAPE_G6_P0_GAMEPLAY_AND_PRINCIPAL_PREVIEW_DELIVERY_v1.0.0.zip'
const output = path.resolve(repository, '..', archiveName)
const temporary = mkdtempSync(path.join(os.tmpdir(), 'trace-g6-delivery-'))
const deliveryRoot = path.join(temporary, archiveName.replace(/\.zip$/, ''))
const head = git(['rev-parse', 'HEAD'])

function git(args) { return execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim() }
function run(command, args, cwd = repository) { const result = spawnSync(command, args, { cwd, encoding: 'utf8' }); if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`); return result.stdout.trim() }
function json(file) { return JSON.parse(readFileSync(file, 'utf8')) }
function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex') }
function filesBelow(root) { return readdirSync(root, { withFileTypes: true }).flatMap((entry) => { const target = path.join(root, entry.name); return entry.isDirectory() ? filesBelow(target) : [target] }) }

try {
  const dirty = git(['status', '--porcelain=v1', '--untracked-files=normal'])
  if (dirty !== '') throw new Error(`Refusing to package a dirty repository:\n${dirty}`)
  const verification = json(path.join(repository, 'artifacts/g6/verification/FINAL_VERIFICATION.json'))
  const reviews = json(path.join(repository, 'artifacts/g6/reviews/REVIEW_FINDINGS_RESOLUTIONS.json'))
  if (verification.result !== 'PASSED') throw new Error('Final verification did not pass')
  run('git', ['merge-base', '--is-ancestor', verification.candidateCommit, head])
  const postVerificationChanges = git(['diff', '--name-only', verification.candidateCommit, head]).split('\n').filter(Boolean)
  const generatedEvidence = /^(?:artifacts\/g6\/verification\/|artifacts\/screenshots\/|PRINCIPAL_PREVIEW\/(?:static-build\/|screenshots\/|CONTACT_SHEET\.png$|PRESENTATION_HEALTH_REPORT\.json$))/
  const unverifiedSource = postVerificationChanges.filter((file) => !generatedEvidence.test(file))
  if (unverifiedSource.length) throw new Error(`Source changed after final verification: ${unverifiedSource.join(', ')}`)
  if (reviews.summary?.passesCompleted !== 11 || reviews.summary?.unresolvedAcceptedP0P1 !== 0) throw new Error('Eleven review passes with zero unresolved accepted P0/P1 findings are required')
  const preview = path.join(repository, 'PRINCIPAL_PREVIEW')
  const requiredCaptures = ['01-prelaunch-no-spoiler.png', '02-opening-camera-response.png', '03-case-frame-no-amount.png', '04-nansen-record.png', '05-twin-breach-index.png', '06-first-engine-before-echo.png', '07-first-engine-after-echo.png', '08-unwind-chamber.png', '09-rewind.png', '10-both-breach-records.png', '11-working-hypothesis.png', '12-counter-reconstruction.png', '13-receiving-vault.png', '14-build-the-case.png', '15-truth-isolate.png', '16-truth-reveal.png', '17-truth-verify.png', '18-solved-title.png', '19-guided-approach.png', '20-extraction-engine-before-map.png', '21-extraction-engine-after-map.png', '22-confirmed-joining-gate.png', '23-synthetic-case-index.png', '24-euler-case-index.png']
  if (!existsSync(path.join(preview, 'CONTACT_SHEET.png')) || requiredCaptures.some((name) => !existsSync(path.join(preview, 'screenshots', name)))) throw new Error('Principal Preview required-beat captures are incomplete')
  mkdirSync(path.join(deliveryRoot, 'SOURCE'), { recursive: true })
  const sourceTar = path.join(temporary, 'source.tar')
  run('git', ['archive', '--format=tar', '-o', sourceTar, 'HEAD'])
  run('tar', ['-xf', sourceTar, '-C', path.join(deliveryRoot, 'SOURCE')])
  const fixtureProofRoot = path.join(deliveryRoot, 'SOURCE/artifacts/acquisition/g3-network-proof')
  rmSync(path.join(fixtureProofRoot, 'primary/raw'), { recursive: true, force: true })
  rmSync(path.join(fixtureProofRoot, 'mirror/raw'), { recursive: true, force: true })
  cpSync(preview, path.join(deliveryRoot, 'PRINCIPAL_PREVIEW'), { recursive: true })
  cpSync(path.join(repository, 'public/scenarios/euler-2023-false-exit'), path.join(deliveryRoot, 'PUBLIC_HERO_PACK'), { recursive: true })
  cpSync(path.join(repository, 'artifacts/g6'), path.join(deliveryRoot, 'EVIDENCE/G6'), { recursive: true })
  const provenance = json(path.join(repository, 'public/scenarios/euler-2023-false-exit/provenance.json'))
  const manifest = { schemaVersion: '1.0.0', status: 'DELIVERED_PENDING_LEAD_REVIEW', archiveName, candidateCommit: head, verifiedSourceCommit: verification.candidateCommit, acceptedRepositoryEvidenceBase: '58088d5d897ec39ddebd357f0e747222847d51b7', acceptedG5ImplementationCut: '51f42fc03d7d96ca081ae3e11a20e3f21aec2cd0', leadAcceptanceClaimed: false, mission02AdmissionClaimed: false, providerUse: { priorNansenAttempts: 24, priorNansenCredits: 18, g6NansenAttempts: 8, g6NansenCredits: 19, totalNansenAttempts: 32, totalNansenCredits: 37, g6AlchemyCalls: 0, buildathon1000LedgerCalls: 0 }, precision: 'NANSEN_PROVIDER_PRECISION', publicPack: { scenarioHash: provenance.scenarioHash, worldHash: provenance.worldHash, normalizedGraphHash: provenance.normalizedGraphHash }, rawProviderResponsesIncluded: false, credentialMaterialIncluded: false }
  writeFileSync(path.join(deliveryRoot, 'DELIVERY_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const prohibitedName = /(?:NANSEN_API_KEY\.txt|ALCHEMY_API_KEY\.txt|\.env(?:\.|$)|raw\/.*\.gz$)/i
  const staged = filesBelow(deliveryRoot)
  for (const file of staged) {
    const relative = path.relative(deliveryRoot, file).replaceAll(path.sep, '/')
    if (prohibitedName.test(relative)) throw new Error(`Prohibited delivery file: ${relative}`)
    if (statSync(file).size <= 8_000_000 && !/\.(?:png|webm|bundle)$/i.test(file)) {
      const text = readFileSync(file, 'utf8')
      const privateLinuxPath = new RegExp(['', 'home', 'al', ''].join('/'))
      if (privateLinuxPath.test(text) || /(?:\/Users\/|[A-Z]:\\\\Users\\\\)/.test(text)) throw new Error(`Absolute private path in delivery: ${relative}`)
      if (/(?:^|\W)sk-[A-Za-z0-9_-]{16,}(?:$|\W)/.test(text)) throw new Error(`Credential-like material in delivery: ${relative}`)
    }
  }
  writeFileSync(path.join(deliveryRoot, 'DELIVERY_CONTENTS.sha256'), `${staged.map((file) => `${sha256(file)}  ${path.relative(deliveryRoot, file).replaceAll(path.sep, '/')}`).sort().join('\n')}\n`)
  rmSync(output, { force: true })
  run('zip', ['-X', '-q', '-r', output, path.basename(deliveryRoot)], temporary)
  run('unzip', ['-t', output])
  if (prohibitedName.test(run('unzip', ['-Z1', output]))) throw new Error('Archive listing contains a prohibited file')
  process.stdout.write(`${JSON.stringify({ status: 'DELIVERED_PENDING_LEAD_REVIEW', archiveName, sha256: sha256(output), candidateCommit: head }, null, 2)}\n`)
} finally { rmSync(temporary, { recursive: true, force: true }) }
