#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const archiveName = 'TRACE_ESCAPE_G4A_HISTORICAL_CANDIDATE_AUDITION_DELIVERY_v1.0.0.zip'
const repository = fileURLToPath(new URL('../', import.meta.url))
const projectRoot = path.resolve(repository, '..')
const privateStore = process.env.TRACE_ESCAPE_PRIVATE_STORE_ROOT
if (!privateStore || !path.isAbsolute(privateStore)) throw new Error('TRACE_ESCAPE_PRIVATE_STORE_ROOT must explicitly name the absolute private store')
const outputArchive = path.join(projectRoot, archiveName)
const stagingParent = mkdtempSync(path.join(os.tmpdir(), 'trace-escape-g4a-delivery-'))
const deliveryRoot = path.join(stagingParent, archiveName.replace(/\.zip$/, ''))
const sourceRoot = path.join(deliveryRoot, 'SOURCE')
const evidenceRoot = path.join(deliveryRoot, 'EVIDENCE_PUBLIC')
const annexRoot = path.join(deliveryRoot, 'PRIVATE_LEAD_REVIEW_ONLY')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: repository, encoding: 'utf8', ...options })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  return result.stdout
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function filesUnder(root) {
  const files = []
  const visit = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const full = path.join(directory, name)
      const stat = lstatSync(full)
      if (stat.isSymbolicLink()) throw new Error(`Symbolic link is not allowed in delivery content: ${full}`)
      if (stat.isDirectory()) visit(full)
      else files.push(full)
    }
  }
  visit(root)
  return files
}

try {
  if (run('git', ['status', '--porcelain']).trim() !== '') throw new Error('Repository must be clean before packaging')
  const head = run('git', ['rev-parse', 'HEAD']).trim()
  const parent = run('git', ['rev-parse', 'HEAD^']).trim()
  const reconstruction = JSON.parse(readFileSync(path.join(repository, 'artifacts', 'g4a', 'OFFLINE_RECONSTRUCTION_REPORT.json'), 'utf8'))
  const verification = JSON.parse(readFileSync(path.join(repository, 'artifacts', 'g4a', 'FINAL_VERIFICATION.json'), 'utf8'))
  const postcallReview = JSON.parse(readFileSync(path.join(repository, 'artifacts', 'g4a', 'POSTCALL_REVIEW.json'), 'utf8'))
  if (verification.status !== 'PASS' || postcallReview.status !== 'PASS' || postcallReview.acceptedP0P1Open !== 0) throw new Error('Final verification and post-call review must pass before packaging')
  const tracked = run('git', ['ls-files', '-z'], { encoding: 'buffer' }).toString('utf8').split('\0').filter(Boolean)
  for (const relative of tracked) {
    const destination = path.join(sourceRoot, relative)
    mkdirSync(path.dirname(destination), { recursive: true })
    copyFileSync(path.join(repository, relative), destination)
  }
  cpSync(path.join(repository, 'artifacts', 'g4a'), evidenceRoot, { recursive: true, errorOnExist: true })

  mkdirSync(annexRoot, { recursive: true })
  const copiedStore = path.join(annexRoot, 'acquisition-store')
  cpSync(privateStore, copiedStore, { recursive: true, errorOnExist: true })
  const sourceHashes = Object.fromEntries(filesUnder(privateStore).map((file) => [path.relative(privateStore, file), sha256(file)]))
  const copiedHashes = Object.fromEntries(filesUnder(copiedStore).map((file) => [path.relative(copiedStore, file), sha256(file)]))
  if (JSON.stringify(sourceHashes) !== JSON.stringify(copiedHashes)) throw new Error('Independent private-annex rehash mismatch')
  writeFileSync(path.join(annexRoot, 'README_NONPUBLIC.md'), '# PRIVATE — LEAD REVIEW ONLY\n\nThis annex contains acquired provider responses, response metadata, normalized durable objects, and the append-only call ledger. It is nonpublic, excludes credentials and request authentication headers, and must never be copied into a public release.\n', 'utf8')
  writeFileSync(path.join(annexRoot, 'MANIFEST.json'), `${JSON.stringify({ schemaVersion: '1.0.0', classification: 'PRIVATE_LEAD_REVIEW_ONLY_NONPUBLIC', credentialIncluded: false, requestAuthenticationHeadersIncluded: false, fileCount: Object.keys(copiedHashes).length, files: copiedHashes }, null, 2)}\n`, 'utf8')
  writeFileSync(path.join(deliveryRoot, 'PRIVATE_ANNEX_REHASH_REPORT.json'), `${JSON.stringify({ schemaVersion: '1.0.0', status: 'PASS', algorithm: 'SHA-256', sourceOutsideRepository: '<PRIVATE_STORE>', copiedFileCount: Object.keys(copiedHashes).length, everyCopiedHashMatched: true }, null, 2)}\n`, 'utf8')

  const bundlePath = path.join(deliveryRoot, 'TRACE_ESCAPE_G4A_COMPLETE_GIT.bundle')
  run('git', ['bundle', 'create', bundlePath, '--all'])
  run('git', ['bundle', 'verify', bundlePath])
  writeFileSync(path.join(deliveryRoot, 'DELIVERY_MANIFEST.json'), `${JSON.stringify({ schemaVersion: '1.0.0', status: 'DELIVERED_PENDING_LEAD_REVIEW', archiveName, commit: head, parentCommit: parent, acceptedBase: 'da56166bee7e14026a271741fceacbad2b3900db', acceptedImplementationCut: '107a37f82e86c8c4f3a18f15e0b8f0a7ef0944f7', implementationCut: '8b82f07f87cfedeac3c59816ec59d055e3497ea8', reconstructionCommit: reconstruction.currentCommit, heroSelected: false, candidateRecommendationOnly: 'EULER_2023_INITIAL_EXPLOIT', providerUse: { nansenHttpAttempts: 13, nansenCredits: 12, alchemyCalls: 0, buildathon1000LedgerCalls: 0 }, publicEvidence: 'EVIDENCE_PUBLIC', privateAnnex: 'PRIVATE_LEAD_REVIEW_ONLY', completeGitBundle: path.basename(bundlePath) }, null, 2)}\n`, 'utf8')

  run('node', ['scripts/scan-prohibitions.mjs', deliveryRoot])
  rmSync(outputArchive, { force: true })
  const zip = spawnSync('zip', ['-X', '-q', '-r', outputArchive, path.basename(deliveryRoot)], { cwd: stagingParent, encoding: 'utf8' })
  if (zip.status !== 0) throw new Error(`zip failed: ${zip.stderr || zip.stdout}`)
  process.stdout.write(`${JSON.stringify({ status: 'PASS', archive: outputArchive, sha256: sha256(outputArchive), commit: head }, null, 2)}\n`)
} finally {
  rmSync(stagingParent, { recursive: true, force: true })
}
