#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const archiveName = 'TRACE_ESCAPE_G6P_A1_R2_ANIMATION_CONTENT_IDENTITY_CLOSURE_DELIVERY_v1.0.0.zip'
const output = path.resolve(repository, '..', archiveName)
const temporary = mkdtempSync(path.join(os.tmpdir(), 'trace-g6p-a1-delivery-'))
const deliveryRoot = path.join(temporary, archiveName.replace(/\.zip$/, ''))
const head = git(['rev-parse', 'HEAD'])

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

  const verification = json(path.join(repository, 'artifacts/g6p-a1-r2/verification/FINAL_VERIFICATION.json'))
  const reviews = json(path.join(repository, 'artifacts/g6p-a1-r2/reviews/REVIEW_FINDINGS_RESOLUTIONS.json'))
  if (verification.result !== 'PASSED') throw new Error('Final verification did not pass')
  run('git', ['merge-base', '--is-ancestor', verification.candidateCommit, head])
  const postVerificationChanges = git(['diff', '--name-only', verification.candidateCommit, head]).split('\n').filter(Boolean)
  const generatedEvidence = /^(?:artifacts\/g6p-a1-r2\/verification\/|artifacts\/screenshots\/g6p-a1\/|PRINCIPAL_PREVIEW\/(?:static-build\/|screenshots\/|CONTACT_SHEET\.png$|PRESENTATION_HEALTH_REPORT\.json$))/
  const unverifiedSource = postVerificationChanges.filter((file) => !generatedEvidence.test(file))
  if (unverifiedSource.length) throw new Error(`Source changed after final verification: ${unverifiedSource.join(', ')}`)
  if (reviews.summary?.passesCompleted !== 8 || reviews.summary?.targetedAnimationContentIntegrityReviewCompleted !== true || reviews.summary?.unresolvedAcceptedP0P1 !== 0) {
    throw new Error('Eight review passes with zero unresolved accepted P0/P1 findings are required')
  }

  const requiredCaptures = [
    '01-1280-opening-dialogue.png',
    '02-1280-records-office.png',
    '03-1280-art-lab-diagnostics.png',
    '04-1280-blank-scene-fixture.png',
    '05-1280-terminal-unlocked.png',
    '06-1280-factual-record.png',
    '07-1920-art-lab-diagnostics.png',
    '08-1920-engine-proof-complete.png',
  ]
  const preview = path.join(repository, 'PRINCIPAL_PREVIEW')
  if (!existsSync(path.join(preview, 'CONTACT_SHEET.png')) || requiredCaptures.some((name) => !existsSync(path.join(preview, 'screenshots', name)))) {
    throw new Error('Principal Preview captures are incomplete')
  }
  const health = json(path.join(preview, 'PRESENTATION_HEALTH_REPORT.json'))
  if (
    health.recommendation !== 'GREEN'
    || Object.values(health.artLab?.viewports ?? {}).length !== 2
    || Object.values(health.artLab.viewports).some((viewport) => viewport.overlapCount !== 0 || viewport.diagnosticOverlapCount !== 0 || viewport.minimumLabelFontPx < 16 || !viewport.actualDimensionsPresent || !viewport.fingerprintsPresent || !viewport.requiredRowsPass)
    || health.contentIdentityNegativeControl?.disposition !== 'INVALID_REQUIRED_ASSETS'
    || health.contentIdentityNegativeControl.duplicateContentRows < 2
    || !health.contentIdentityNegativeControl.loadedPackId?.startsWith('placeholder /')
    || health.contentIdentityNegativeControl.requiredCompleteVisible !== false
  ) {
    throw new Error('Art Lab diagnostic and no-overlap health evidence is incomplete')
  }

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
  cpSync(path.join(repository, 'artifacts/g6p-a1-r2'), path.join(deliveryRoot, 'EVIDENCE/G6P_A1_R2'), { recursive: true })

  const gitDirectory = path.join(deliveryRoot, 'GIT')
  mkdirSync(gitDirectory, { recursive: true })
  const bundle = path.join(gitDirectory, 'trace-escape-complete.bundle')
  // Git's parallel pack heuristics can choose different delta orderings across
  // invocations. A single pack thread makes the complete bundle byte-stable.
  run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundle, '--all'])
  const bundleVerification = run('git', ['bundle', 'verify', bundle]).replaceAll(bundle, 'trace-escape-complete.bundle').replaceAll(temporary, '<STAGING>')
  writeFileSync(path.join(gitDirectory, 'BUNDLE_VERIFICATION.txt'), `${bundleVerification}\n`)
  writeFileSync(path.join(gitDirectory, 'README.md'), [
    '# Complete Git bundle',
    '',
    'This bundle contains every repository ref and the complete reachable history at delivery time.',
    '',
    'Restore with:',
    '',
    '```sh',
    'git clone trace-escape-complete.bundle trace-escape',
    'cd trace-escape',
    'git checkout g6p-a0-point-click',
    '```',
    '',
    `Delivery HEAD: ${head}`,
    `Bundle SHA-256: ${sha256(bundle)}`,
    '',
  ].join('\n'))

  const candidateTree = git(['rev-parse', 'HEAD^{tree}'])
  const ancestry = ['426a0bd8bde68c00c2746af3b45710bfb2f61a7d', '9ec4bce8c6d05fe69982bbacbf3bad2250b42939', '4ae7e10d0f094b9d47308b5365cadb4504ab0702', '4e72475c1e4245099cf8adc7396b2f28c501f6eb', '6229c7b1fca80bc38da00ee2b7aa8a46f43b0b0b'].map((commit) => {
    run('git', ['merge-base', '--is-ancestor', commit, head])
    return { commit, directAncestorOfCandidate: true }
  })
  writeFileSync(path.join(gitDirectory, 'ANCESTRY_EVIDENCE.json'), `${JSON.stringify({ candidateCommit: head, candidateTree, ancestry }, null, 2)}\n`)

  const manifest = {
    schemaVersion: '1.0.0',
    status: 'DELIVERED_PENDING_LEAD_REVIEW',
    archiveName,
    candidateCommit: head,
    candidateTree,
    verifiedSourceCommit: verification.candidateCommit,
    reviewedR1CandidateHead: '426a0bd8bde68c00c2746af3b45710bfb2f61a7d',
    reviewedR1ArchiveSha256: '049e2080ccf547c68d81cf9c08dcb8c2c454677c1d92da509a8b6662b1382d7d',
    acceptedA0DeliveryEvidenceCommit: '4e72475c1e4245099cf8adc7396b2f28c501f6eb',
    acceptedA0ImplementationCut: '6229c7b1fca80bc38da00ee2b7aa8a46f43b0b0b',
    acceptedA0ArchiveSha256: 'c5bf4512dfdc10280af9a75d641723cfade861d2044971945129ab553795c18f',
    activePresentation: 'CLASSIC_POINT_AND_CLICK_ADVENTURE',
    implementedScenes: ['RECORDS_OFFICE', 'BLANK_SHELL_NONPLAYABLE'],
    artPackSchema: '2.0.0',
    artPackStatus: 'PROVISIONAL_PLACEHOLDER',
    completeGitBundleIncluded: true,
    byteReproducibleArchive: true,
    artAcceptanceClaimed: false,
    fullMissionPortAuthorized: false,
    mission02AdmissionClaimed: false,
    providerUse: {
      priorNansenAttempts: 32,
      priorNansenCredits: 37,
      a1NansenCalls: 0,
      a1AlchemyCalls: 0,
      buildathon1000LedgerCalls: 0,
    },
    rawProviderResponsesIncludedOutsideCompleteGitHistory: false,
    credentialMaterialIncluded: false,
  }
  writeFileSync(path.join(deliveryRoot, 'DELIVERY_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(path.join(deliveryRoot, 'ZERO_PROVIDER_CALL_ATTESTATION.json'), `${JSON.stringify({ gate: 'G6P_A1_R2', nansenCalls: 0, alchemyCalls: 0, credentialResolution: false }, null, 2)}\n`)

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

  writeFileSync(
    path.join(deliveryRoot, 'DELIVERY_CONTENTS.sha256'),
    `${staged.map((file) => `${sha256(file)}  ${path.relative(deliveryRoot, file).replaceAll(path.sep, '/')}`).sort().join('\n')}\n`,
  )
  const fixedTimestamp = new Date('2000-01-01T00:00:00.000Z')
  const archiveFiles = filesBelow(deliveryRoot).sort()
  for (const file of archiveFiles) utimesSync(file, fixedTimestamp, fixedTimestamp)
  const archiveEntries = archiveFiles.map((file) => path.relative(temporary, file).replaceAll(path.sep, '/'))
  const reproducibilityCheck = path.join(temporary, 'reproducibility-check.zip')
  rmSync(output, { force: true })
  run('zip', ['-X', '-q', output, ...archiveEntries], temporary)
  run('zip', ['-X', '-q', reproducibilityCheck, ...archiveEntries], temporary)
  if (sha256(output) !== sha256(reproducibilityCheck)) throw new Error('Consecutive deterministic archive builds produced different SHA-256 digests')
  run('unzip', ['-t', output])
  if (prohibitedName.test(run('unzip', ['-Z1', output]))) throw new Error('Archive listing contains a prohibited file')
  process.stdout.write(`${JSON.stringify({ status: 'DELIVERED_PENDING_LEAD_REVIEW', archiveName, sha256: sha256(output), candidateCommit: head }, null, 2)}\n`)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
