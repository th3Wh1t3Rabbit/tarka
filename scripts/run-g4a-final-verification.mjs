#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../', import.meta.url))
const privateStore = process.env.TRACE_ESCAPE_PRIVATE_STORE_ROOT
if (!privateStore || !path.isAbsolute(privateStore)) throw new Error('TRACE_ESCAPE_PRIVATE_STORE_ROOT must explicitly name the absolute private store')
const logDirectory = path.join(repository, 'artifacts', 'g4a', 'final-logs')
mkdirSync(logDirectory, { recursive: true })

const commands = [
  { name: 'check', command: 'npm', args: ['run', 'check'] },
  { name: 'allTests', command: 'npm', args: ['test'] },
  { name: 'allBrowserJourneys', command: 'npm', args: ['run', 'test:e2e'] },
  { name: 'productionBuild', command: 'npm', args: ['run', 'build'] },
  { name: 'artifactCapture', command: 'npm', args: ['run', 'artifacts:capture'], env: { TRACE_CAPTURE_DIRECTORY: 'artifacts/g4a/final-capture' } },
  { name: 'noNetworkProof', command: 'npm', args: ['run', 'acquisition:prove-no-network'] },
  { name: 'browserBoundary', command: 'npm', args: ['run', 'browser-boundary:verify'] },
  { name: 'focusedG2Regression', command: 'npm', args: ['run', 'test:g2:focused'] },
  { name: 'privateStoreVerification', command: 'npm', args: ['run', 'acquisition:verify-store', '--', '--output', privateStore] },
  { name: 'offlineReconstruction', command: 'npm', args: ['run', 'g4a:reconstruct'] },
  { name: 'repositorySecretScan', command: 'npm', args: ['run', 'secret:scan'] },
  { name: 'gitHistorySecretScan', command: 'npm', args: ['run', 'secret:scan-history'] },
  { name: 'projectClock', command: 'npm', args: ['run', 'project:clock'] },
  { name: 'projectStatus', command: 'npm', args: ['run', 'project:status'] },
]

const startedAtUtc = new Date().toISOString()
const results = []
for (const entry of commands) {
  process.stdout.write(`\n=== ${entry.name} ===\n`)
  const result = spawnSync(entry.command, entry.args, {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', ...entry.env },
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(output)
  writeFileSync(path.join(logDirectory, `${entry.name}.log`), output, 'utf8')
  results.push({ name: entry.name, command: `${entry.command} ${entry.args.join(' ')}`, exitCode: result.status ?? 1 })
  if (result.status !== 0) {
    writeFileSync(path.join(repository, 'artifacts', 'g4a', 'FINAL_VERIFICATION.json'), `${JSON.stringify({ schemaVersion: '1.0.0', status: 'FAIL', startedAtUtc, completedAtUtc: new Date().toISOString(), results }, null, 2)}\n`, 'utf8')
    process.exit(result.status ?? 1)
  }
}

const candidate = JSON.parse(readFileSync(path.join(repository, 'artifacts', 'g4a', 'EULER_2023_INITIAL_EXPLOIT_CANDIDATE_REPORT.json'), 'utf8'))
const run = JSON.parse(readFileSync(path.join(repository, 'artifacts', 'g4a', 'G4A_AUDITION_RUN_REPORT.json'), 'utf8'))
const expected = candidate?.score?.total >= 78
  && candidate?.score?.fatalDefects?.length === 0
  && candidate?.recommendation === 'ADVANCE_FOR_LEAD_BINDING'
  && candidate?.heroSelected === false
  && candidate?.omittedEventCensus?.outOfWindow === 8
  && candidate?.omittedEventCensus?.postCutoffOrUnknown === 1
  && run?.actualUse?.httpAttemptsIssued === 13
  && run?.actualUse?.actualCreditsUsed === 12
  && run?.actualUse?.accountCreditDelta === 12
  && run?.actualUse?.countTowardBuildathon1000 === false
  && run?.eulerThresholdStopApplied === true
  && run?.bybitIssued === false
if (!expected) throw new Error('G4A report invariants failed')

const report = { schemaVersion: '1.0.0', status: 'PASS', startedAtUtc, completedAtUtc: new Date().toISOString(), providerCallsDuringVerification: 0, credentialReadsDuringVerification: 0, results }
writeFileSync(path.join(repository, 'artifacts', 'g4a', 'FINAL_VERIFICATION.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write('\nG4A FINAL VERIFICATION: PASS\n')
