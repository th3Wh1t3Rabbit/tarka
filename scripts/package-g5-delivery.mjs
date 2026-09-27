#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const archiveName = 'TRACE_ESCAPE_G5_EULER_REAL_DATA_GOLDEN_PATH_DELIVERY_v1.0.0.zip'
const output = path.resolve(repository, '..', archiveName)
const temp = mkdtempSync(path.join(os.tmpdir(), 'trace-g5-delivery-'))
const deliveryRoot = path.join(temp, archiveName.replace(/\.zip$/, ''))
const evidenceRoot = path.join(deliveryRoot, 'EVIDENCE')
const head = git(['rev-parse', 'HEAD'])
const parent = git(['rev-parse', 'HEAD^'])

function git(args) {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim()
}

function run(command, args, cwd = repository) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`)
  return result.stdout.trim()
}

function json(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function filesBelow(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name)
    return entry.isDirectory() ? filesBelow(target) : [target]
  })
}

try {
  const dirty = git(['status', '--porcelain=v1', '--untracked-files=normal'])
  if (dirty !== '') throw new Error(`Refusing to package a dirty repository:\n${dirty}`)

  const verificationPath = path.join(repository, 'artifacts/g5/verification/FINAL_VERIFICATION.json')
  const reviewPath = path.join(repository, 'artifacts/g5/reviews/REVIEW_FINDINGS_RESOLUTIONS.json')
  const verification = json(verificationPath)
  const reviews = json(reviewPath)
  if (verification.result !== 'PASSED' || verification.candidateCommit !== head) throw new Error('Final verification does not pass for the exact candidate commit')
  if (reviews.summary?.passesCompleted !== 7 || reviews.summary?.unresolvedAcceptedP0P1 !== 0) throw new Error('Seven reviews with zero unresolved accepted P0/P1 findings are required')
  const heroCaptures = path.join(repository, 'artifacts/g5/final-captures/g5-hero')
  const syntheticCaptures = path.join(repository, 'artifacts/g5/final-captures/synthetic')
  if (!existsSync(heroCaptures) || filesBelow(heroCaptures).filter((file) => file.endsWith('.png')).length < 13) throw new Error('The complete real-Hero capture set is missing')
  if (!existsSync(syntheticCaptures) || filesBelow(syntheticCaptures).filter((file) => file.endsWith('.png')).length < 11) throw new Error('The complete synthetic regression capture set is missing')

  mkdirSync(deliveryRoot, { recursive: true })
  const sourceTar = path.join(temp, 'source.tar')
  run('git', ['archive', '--format=tar', '-o', sourceTar, 'HEAD'])
  mkdirSync(path.join(deliveryRoot, 'SOURCE'))
  run('tar', ['-xf', sourceTar, '-C', path.join(deliveryRoot, 'SOURCE')])
  const fixtureProofRoot = path.join(deliveryRoot, 'SOURCE/artifacts/acquisition/g3-network-proof')
  rmSync(path.join(fixtureProofRoot, 'primary/raw'), { recursive: true, force: true })
  rmSync(path.join(fixtureProofRoot, 'mirror/raw'), { recursive: true, force: true })
  const bundlePath = path.join(deliveryRoot, 'TRACE_ESCAPE_COMPLETE_GIT.bundle')
  run('git', ['bundle', 'create', bundlePath, '--all'])
  run('git', ['bundle', 'verify', bundlePath])

  mkdirSync(evidenceRoot, { recursive: true })
  cpSync(path.join(repository, 'artifacts/g5'), path.join(evidenceRoot, 'G5'), { recursive: true })
  cpSync(heroCaptures, path.join(evidenceRoot, 'G5_HERO_CAPTURES'), { recursive: true })
  cpSync(syntheticCaptures, path.join(evidenceRoot, 'SYNTHETIC_REGRESSION_CAPTURES'), { recursive: true })
  cpSync(path.join(repository, 'artifacts/screenshots/g2-regression'), path.join(evidenceRoot, 'G2_REGRESSION_CAPTURES'), { recursive: true })
  cpSync(path.join(repository, 'public/scenarios/euler-2023-false-exit'), path.join(deliveryRoot, 'PUBLIC_HERO_PACK'), { recursive: true })

  const scenario = json(path.join(repository, 'public/scenarios/euler-2023-false-exit/scenario.json'))
  const world = json(path.join(repository, 'public/scenarios/euler-2023-false-exit/world.json'))
  const provenance = json(path.join(repository, 'public/scenarios/euler-2023-false-exit/provenance.json'))
  const manifest = {
    schemaVersion: '1.0.0',
    status: 'DELIVERED_PENDING_LEAD_REVIEW',
    archiveName,
    candidateCommit: head,
    parentCommit: parent,
    acceptedRepositoryEvidenceBase: 'bd3cfdcaebe41725acddea72c688bc595ff3f093',
    acceptedG4aImplementationCut: '8b82f07f87cfedeac3c59816ec59d055e3497ea8',
    leadAcceptanceClaimed: false,
    mission02AdmissionClaimed: false,
    providerUse: { nansenHttpAttempts: 24, nansenCredits: 18, alchemyCalls: 0, buildathon1000LedgerCalls: 0 },
    publicPack: { scenarioId: scenario.scenarioId, scenarioHash: provenance.scenarioHash, worldHash: provenance.worldHash, normalizedGraphHash: provenance.normalizedGraphHash, omittedEventCount: scenario.omittedEventManifest.count, proceduralOnly: world.proceduralOnly },
    completeGitBundle: path.basename(bundlePath),
    rawProviderResponsesIncluded: false,
    credentialMaterialIncluded: false,
  }
  writeFileSync(path.join(deliveryRoot, 'DELIVERY_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  const prohibitedName = /(?:NANSEN_API_KEY\.txt|\.env(?:\.|$)|raw\/.*\.gz$)/i
  const stagedFiles = filesBelow(deliveryRoot)
  for (const file of stagedFiles) {
    const relative = path.relative(deliveryRoot, file).replaceAll(path.sep, '/')
    if (prohibitedName.test(relative)) throw new Error(`Prohibited delivery file: ${relative}`)
    if (statSync(file).size <= 8_000_000 && !/\.(?:png|webm|bundle)$/i.test(file)) {
      const text = readFileSync(file, 'utf8')
      if (/(?:\/home\/al\/|\/Users\/|[A-Z]:\\\\Users\\\\)/.test(text)) throw new Error(`Absolute private path in delivery: ${relative}`)
      if (/(?:^|\W)sk-[A-Za-z0-9_-]{16,}(?:$|\W)/.test(text)) throw new Error(`Credential-like material in delivery: ${relative}`)
    }
  }
  const digests = stagedFiles.map((file) => `${sha256(file)}  ${path.relative(deliveryRoot, file).replaceAll(path.sep, '/')}`).sort()
  writeFileSync(path.join(deliveryRoot, 'DELIVERY_CONTENTS.sha256'), `${digests.join('\n')}\n`)

  rmSync(output, { force: true })
  run('zip', ['-X', '-q', '-r', output, path.basename(deliveryRoot)], temp)
  run('unzip', ['-t', output])
  const listing = run('unzip', ['-Z1', output])
  if (prohibitedName.test(listing)) throw new Error('Archive listing contains a prohibited file')
  process.stdout.write(`${JSON.stringify({ status: 'DELIVERED_PENDING_LEAD_REVIEW', archive: output, sha256: sha256(output), candidateCommit: head }, null, 2)}\n`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
