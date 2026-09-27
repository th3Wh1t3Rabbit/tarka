import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()
const buildRoot = path.join(repositoryRoot, '.acquisition-build', 'scripts', 'acquisition')
const networkGuard = path.join(repositoryRoot, 'tests', 'acquisition', 'network-guard.cjs')
let outputRoot = ''
let planRoot = ''
const verificationNow = '2026-09-14T12:00:00Z'

function run(command: string, args: string[] = []): Record<string, unknown> {
  const stdout = execFileSync(process.execPath, [path.join(buildRoot, command), ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: `--require=${networkGuard}` },
  })
  return JSON.parse(stdout) as Record<string, unknown>
}

function runFailure(command: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [path.join(buildRoot, command), ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: `--require=${networkGuard}` },
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

async function writePlan(name: string, mutate: (plan: Record<string, unknown>) => void): Promise<string> {
  const source = JSON.parse(await readFile(path.join(repositoryRoot, 'fixtures/acquisition/plans/evidence-happy-path.json'), 'utf8')) as Record<string, unknown>
  mutate(source)
  const target = path.join(planRoot, `${name}.json`)
  await writeFile(target, `${JSON.stringify(source, null, 2)}\n`, 'utf8')
  return path.relative(repositoryRoot, target)
}

beforeAll(async () => {
  execFileSync('npm', ['run', 'acquisition:compile', '--silent'], { cwd: repositoryRoot, stdio: 'pipe' })
  outputRoot = await mkdtemp(path.join(tmpdir(), 'trace-acquisition-cli-'))
  planRoot = await mkdtemp(path.join(repositoryRoot, 'fixtures', 'acquisition', 'plans', 'cli-review-'))
})

afterAll(async () => {
  if (outputRoot) await rm(outputRoot, { recursive: true, force: true })
  if (planRoot) await rm(planRoot, { recursive: true, force: true })
})

describe('fixture-only acquisition command surface', () => {
  it('passes preflight without credential resolution or provider calls', () => {
    expect(run('preflight.js')).toMatchObject({
      command: 'acquisition:preflight',
      status: 'PASS',
      mode: 'FIXTURE_ONLY_NO_NETWORK',
      credentialResolution: 'DISABLED_G3',
      providerCalls: 0,
    })
  })

  it('runs the complete fixture journey under a hard nonlocal-network guard', async () => {
    const first = run('dry-run.js', ['--plan', 'fixtures/acquisition/plans/evidence-happy-path.json', '--output', outputRoot, '--now', verificationNow])
    expect(first).toMatchObject({
      command: 'acquisition:dry-run',
      status: 'PASS',
      simulatedPages: 3,
      evidenceRecords: 3,
      providerCalls: 0,
      credentialResolution: 'DISABLED_G3',
      nonlocalNetwork: 'NONE',
    })

    const duplicatePlan = await writePlan('dedupe-without-fixture-read', (plan) => {
      const groups = plan.requests as Array<{ pages: Array<{ responseFixture: string }> }>
      groups[0]!.pages.forEach((page) => { page.responseFixture = 'fixtures/acquisition/pages/intentionally-absent.json' })
    })
    const second = run('dry-run.js', ['--plan', duplicatePlan, '--output', outputRoot, '--now', verificationNow])
    expect(second).toMatchObject({ status: 'PASS', simulatedPages: 3, providerCalls: 0 })

    const report = JSON.parse(await readFile(path.join(outputRoot, 'reports', 'dry-run-report.json'), 'utf8')) as Record<string, unknown>
    expect(report).toMatchObject({ providerCalls: 0, nonlocalNetwork: 'NONE' })
  })

  it('fails closed for expired allowances, escaped fixtures, exhausted refreshes, and malformed pagination', async () => {
    const expiredOutput = await mkdtemp(path.join(tmpdir(), 'trace-acquisition-expired-'))
    const expired = runFailure('dry-run.js', ['--plan', 'fixtures/acquisition/plans/evidence-happy-path.json', '--output', expiredOutput, '--now', '2026-09-19T00:00:00Z'])
    expect(expired.status).toBe(1)
    expect(expired.stderr).toMatch(/OUTSIDE_VALIDITY_WINDOW/)
    await rm(expiredOutput, { recursive: true, force: true })

    const escapedPlan = await writePlan('escaped-fixture', (plan) => {
      const groups = plan.requests as Array<{ pages: Array<{ responseFixture: string }> }>
      groups[0]!.pages[0]!.responseFixture = 'fixtures/acquisition/scores/passing.json'
    })
    const escaped = runFailure('dry-run.js', ['--plan', escapedPlan, '--output', path.join(outputRoot, 'escaped'), '--now', verificationNow])
    expect(escaped.status).toBe(1)
    expect(escaped.stderr).toMatch(/contained by fixtures\/acquisition\/pages/)

    const refreshedPlan = await writePlan('exhausted-refresh', (plan) => {
      const groups = plan.requests as Array<{ request: { refresh: unknown } }>
      groups[0]!.request.refresh = { reason: 'Synthetic review refresh', identity: 'review-refresh-2' }
    })
    const exhausted = runFailure('dry-run.js', ['--plan', refreshedPlan, '--output', outputRoot, '--now', verificationNow])
    expect(exhausted.status).toBe(1)
    expect(exhausted.stderr).toMatch(/REQUEST_LIMIT_EXCEEDED/)

    const skippedPagePlan = await writePlan('skipped-page', (plan) => {
      const groups = plan.requests as Array<{ pages: Array<{ page: number }> }>
      groups[0]!.pages[1]!.page = 3
    })
    const skipped = runFailure('dry-run.js', ['--plan', skippedPagePlan, '--output', path.join(outputRoot, 'skipped'), '--now', verificationNow])
    expect(skipped.status).toBe(1)
    expect(skipped.stderr).toMatch(/contiguous|differs from planned page/)

    const falseCursorPlan = await writePlan('false-cursor', (plan) => {
      const groups = plan.requests as Array<{ pages: Array<{ nextCursor: string | null; cursor: string | null }> }>
      groups[0]!.pages[0]!.nextCursor = null
      groups[0]!.pages[1]!.cursor = null
    })
    const falseCursor = runFailure('dry-run.js', ['--plan', falseCursorPlan, '--output', path.join(outputRoot, 'false-cursor'), '--now', verificationNow])
    expect(falseCursor.status).toBe(1)
    expect(falseCursor.stderr).toMatch(/differs from fixture response/)
  })

  it('reports ledger status and verifies primary, mirror, and normalized stores', () => {
    expect(run('status.js', ['--primary-root', path.join(outputRoot, 'primary')])).toMatchObject({
      command: 'acquisition:status',
      records: 9,
      completed: 6,
      providerCalls: 0,
    })
    expect(run('verify-store.js', ['--output', outputRoot])).toMatchObject({
      command: 'acquisition:verify-store',
      ok: true,
      checkedRecords: 9,
      checkedRawObjects: 6,
      checkedNormalizedObjects: 3,
    })
  })

  it('lints the generated export, rejects a prohibited export, and applies score gates', () => {
    expect(run('export-lint.js', ['--input', path.join(outputRoot, 'reports', 'public-scenario-draft.json')])).toMatchObject({ command: 'export:lint', ok: true })

    const rejected = spawnSync(process.execPath, [path.join(buildRoot, 'export-lint.js'), '--input', 'fixtures/acquisition/public/prohibited-field.json'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: `--require=${networkGuard}` },
    })
    expect(rejected.status).toBe(1)
    expect(JSON.parse(rejected.stdout)).toMatchObject({ command: 'export:lint', ok: false })

    expect(run('case-score.js', ['--input', 'fixtures/acquisition/scores/passing.json'])).toMatchObject({ result: { total: 92, eligible: true } })
    expect(run('case-score.js', ['--input', 'fixtures/acquisition/scores/fatal-override.json'])).toMatchObject({ result: { total: 100, eligible: false } })
  })

  it('verifies public, graph, and normalized provenance instead of accepting digest-shaped claims', async () => {
    const originalPath = path.join(outputRoot, 'reports', 'public-scenario-draft.json')
    const changedPath = path.join(outputRoot, 'reports', 'public-scenario-changed.json')
    const changed = JSON.parse(await readFile(originalPath, 'utf8')) as { provenance: { publicScenarioSha256: string; candidateGraphSha256: string; normalizedSha256: string[] } }
    changed.provenance.publicScenarioSha256 = 'a'.repeat(64)
    changed.provenance.candidateGraphSha256 = 'b'.repeat(64)
    changed.provenance.normalizedSha256 = ['c'.repeat(64)]
    await writeFile(changedPath, `${JSON.stringify(changed, null, 2)}\n`, 'utf8')
    const rejected = runFailure('export-lint.js', ['--input', changedPath])
    expect(rejected.status).toBe(1)
    expect(rejected.stdout).toMatch(/canonical public payload/)
    expect(rejected.stdout).toMatch(/supplied candidate graph/)
    expect(rejected.stdout).toMatch(/missing or unreadable/)
  })

  it('writes finalized standalone provenance equal to embedded provenance and rejects standalone drift', async () => {
    const draftPath = path.join(outputRoot, 'reports', 'public-scenario-draft.json')
    const provenancePath = path.join(outputRoot, 'reports', 'provenance.json')
    const draft = JSON.parse(await readFile(draftPath, 'utf8')) as { provenance: Record<string, unknown> }
    const standalone = JSON.parse(await readFile(provenancePath, 'utf8')) as Record<string, unknown>
    expect(standalone).toEqual(draft.provenance)
    const rerun = await mkdtemp(path.join(tmpdir(), 'trace-provenance-determinism-'))
    run('dry-run.js', ['--plan', 'fixtures/acquisition/plans/evidence-happy-path.json', '--output', rerun, '--now', verificationNow])
    expect(await readFile(path.join(rerun, 'reports', 'provenance.json'), 'utf8')).toBe(await readFile(provenancePath, 'utf8'))
    await rm(rerun, { recursive: true, force: true })

    const changedPath = path.join(outputRoot, 'reports', 'provenance-changed.json')
    await writeFile(changedPath, `${JSON.stringify({ ...standalone, publicScenarioSha256: 'f'.repeat(64) }, null, 2)}\n`)
    const rejected = runFailure('export-lint.js', ['--input', draftPath, '--provenance', changedPath])
    expect(rejected.status).toBe(1)
    expect(rejected.stdout).toMatch(/standalone provenance does not exactly match/)
  })
})
