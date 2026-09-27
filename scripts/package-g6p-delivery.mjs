#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const archiveName = 'TRACE_ESCAPE_G6P_A0_POINT_AND_CLICK_ENGINE_AND_ART_HARNESS_DELIVERY_v1.0.0.zip'
const output = path.resolve(repository, '..', archiveName)
const temporary = mkdtempSync(path.join(os.tmpdir(), 'trace-g6p-a0-delivery-'))
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
  const verification = json(path.join(repository, 'artifacts/g6p-a0/verification/FINAL_VERIFICATION.json'))
  const reviews = json(path.join(repository, 'artifacts/g6p-a0/reviews/REVIEW_FINDINGS_RESOLUTIONS.json'))
  if (verification.result !== 'PASSED') throw new Error('Final verification did not pass')
  run('git', ['merge-base', '--is-ancestor', verification.candidateCommit, head])
  const postVerificationChanges = git(['diff', '--name-only', verification.candidateCommit, head]).split('\n').filter(Boolean)
  const generatedEvidence = /^(?:artifacts\/g6p-a0\/verification\/|artifacts\/screenshots\/g6p-a0\/|PRINCIPAL_PREVIEW\/(?:static-build\/|screenshots\/|CONTACT_SHEET\.png$|PRESENTATION_HEALTH_REPORT\.json$))/
  const unverifiedSource = postVerificationChanges.filter((file) => !generatedEvidence.test(file))
  if (unverifiedSource.length) throw new Error(`Source changed after final verification: ${unverifiedSource.join(', ')}`)
  if (reviews.summary?.passesCompleted !== 8 || reviews.summary?.unresolvedAcceptedP0P1 !== 0) throw new Error('Eight review passes with zero unresolved accepted P0/P1 findings are required')
  const requiredCaptures = ['01-1280-records-office.png', '02-1280-dialogue-mode.png', '03-1280-review-art-harness.png', '04-1280-terminal-unlocked.png', '05-1280-factual-record.png', '06-1920-records-office.png', '07-1920-canister-open.png', '08-1920-engine-proof-complete.png']
  const preview = path.join(repository, 'PRINCIPAL_PREVIEW')
  if (!existsSync(path.join(preview, 'CONTACT_SHEET.png')) || requiredCaptures.some((name) => !existsSync(path.join(preview, 'screenshots', name)))) throw new Error('Principal Preview captures are incomplete')
  for (const stale of ['VISUAL_REVIEW_GUIDE.md', 'WHAT_CHANGED_FROM_G5.md', 'ART_DIRECTION_CHANGELOG.md']) if (existsSync(path.join(preview, stale))) throw new Error(`Stale G6 preview guide remains: ${stale}`)
  mkdirSync(path.join(deliveryRoot, 'SOURCE'), { recursive: true })
  const sourceTar = path.join(temporary, 'source.tar')
  run('git', ['archive', '--format=tar', '-o', sourceTar, 'HEAD'])
  run('tar', ['-xf', sourceTar, '-C', path.join(deliveryRoot, 'SOURCE')])
  const fixtureProofRoot = path.join(deliveryRoot, 'SOURCE/artifacts/acquisition/g3-network-proof')
  rmSync(path.join(fixtureProofRoot, 'primary/raw'), { recursive: true, force: true })
  rmSync(path.join(fixtureProofRoot, 'mirror/raw'), { recursive: true, force: true })
  cpSync(preview, path.join(deliveryRoot, 'PRINCIPAL_PREVIEW'), { recursive: true })
  cpSync(path.join(repository, 'ART_DROP'), path.join(deliveryRoot, 'ART_DROP'), { recursive: true })
  cpSync(path.join(repository, 'public/art-packs'), path.join(deliveryRoot, 'ART_PACKS'), { recursive: true })
  cpSync(path.join(repository, 'public/scenarios/euler-2023-false-exit'), path.join(deliveryRoot, 'PUBLIC_ACCEPTED_EVIDENCE_PACK'), { recursive: true })
  cpSync(path.join(repository, 'artifacts/g6p-a0'), path.join(deliveryRoot, 'EVIDENCE/G6P_A0'), { recursive: true })
  const manifest = { schemaVersion: '1.0.0', status: 'DELIVERED_PENDING_LEAD_AND_PRINCIPAL_REVIEW', archiveName, candidateCommit: head, verifiedSourceCommit: verification.candidateCommit, acceptedDeliveryEvidenceBase: 'cdbb8a8eef4ea02fc271a272e16510cd311d56e3', acceptedReviewedSourceCut: '611c8db966f679ef959a91841f41c610fe35f6a8', activePresentation: 'CLASSIC_POINT_AND_CLICK_ADVENTURE', implementedScene: 'RECORDS_OFFICE', artPackStatus: 'PROVISIONAL_PLACEHOLDER', artAcceptanceClaimed: false, fullMissionPortAuthorized: false, mission02AdmissionClaimed: false, providerUse: { priorNansenAttempts: 32, priorNansenCredits: 37, a0NansenCalls: 0, a0AlchemyCalls: 0, buildathon1000LedgerCalls: 0 }, rawProviderResponsesIncluded: false, credentialMaterialIncluded: false }
  writeFileSync(path.join(deliveryRoot, 'DELIVERY_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const prohibitedName = /(?:NANSEN_API_KEY\.txt|ALCHEMY_API_KEY\.txt|\.env(?:\.|$)|raw\/.*\.gz$)/i
  const staged = filesBelow(deliveryRoot)
  for (const file of staged) {
    const relative = path.relative(deliveryRoot, file).replaceAll(path.sep, '/')
    if (prohibitedName.test(relative)) throw new Error(`Prohibited delivery file: ${relative}`)
    if (statSync(file).size <= 8_000_000 && !/\.(?:png|webm|bundle)$/i.test(file)) {
      const content = readFileSync(file, 'utf8')
      const privateLinuxPath = new RegExp(['', 'home', 'al', ''].join('/'))
      if (privateLinuxPath.test(content) || /(?:\/Users\/|[A-Z]:\\Users\\)/.test(content)) throw new Error(`Absolute private path in delivery: ${relative}`)
      if (/(?:^|\W)sk-[A-Za-z0-9_-]{16,}(?:$|\W)/.test(content)) throw new Error(`Credential-like material in delivery: ${relative}`)
    }
  }
  writeFileSync(path.join(deliveryRoot, 'DELIVERY_CONTENTS.sha256'), `${staged.map((file) => `${sha256(file)}  ${path.relative(deliveryRoot, file).replaceAll(path.sep, '/')}`).sort().join('\n')}\n`)
  rmSync(output, { force: true })
  run('zip', ['-X', '-q', '-r', output, path.basename(deliveryRoot)], temporary)
  run('unzip', ['-t', output])
  if (prohibitedName.test(run('unzip', ['-Z1', output]))) throw new Error('Archive listing contains a prohibited file')
  process.stdout.write(`${JSON.stringify({ status: 'DELIVERED_PENDING_LEAD_AND_PRINCIPAL_REVIEW', archiveName, sha256: sha256(output), candidateCommit: head }, null, 2)}\n`)
} finally { rmSync(temporary, { recursive: true, force: true }) }
