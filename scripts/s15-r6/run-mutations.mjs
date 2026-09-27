import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve('.')
const unit = (pattern, signature) => ({ command: 'npx', args: ['vitest', 'run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', 'tests/unit/s15-r6-physical-pose-closure.test.ts', '-t', pattern], signature })
const probes = [
  {
    id: 'MUT-R6-01', file: 'src/adventure/physicalChoreography.ts',
    from: "return { actor: 'ROOK', poseClass: route.poseClass }",
    to: "return { actor: 'ROOK', poseClass: route.routeId === 'required.take-form' ? 'PAPER_REACH' : route.poseClass }",
    test: unit('R6-02', 'R6_EMPTY_HAND_take-form'),
  },
  {
    id: 'MUT-R6-02', file: 'src/adventure/physicalChoreography.ts',
    from: "return { actor: 'ROOK', poseClass: route.poseClass }",
    to: "return { actor: 'ROOK', poseClass: route.routeId === 'required.take-pen' ? 'PAPER_REACH' : route.poseClass }",
    test: unit('R6-02', 'R6_EMPTY_HAND_take-pen'),
  },
  {
    id: 'MUT-R6-03', file: 'src/adventure/physicalChoreography.ts',
    from: "return { actor: 'ROOK', poseClass: route.poseClass }",
    to: "return { actor: 'ROOK', poseClass: route.routeId === 'required.take-form-2' ? 'PAPER_REACH' : route.poseClass }",
    test: unit('R6-02', 'R6_EMPTY_HAND_take-form-2'),
  },
  {
    id: 'MUT-R6-04', file: 'src/controller/mission/performance.ts',
    from: "{ id: 'pickup-3', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.DRAWER_PICKUP_3', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' }",
    to: "{ id: 'pickup-3', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.DRAWER_PICKUP_3', physicalPose: { actor: 'ROOK', poseClass: 'PAPER_REACH' }, fallback: 'GENERIC' }",
    test: unit('R6-03', 'R6_DRAWER_EMPTY_HAND_CONTACT.DRAWER_PICKUP_3'),
  },
  {
    id: 'MUT-R6-05', file: 'src/controller/mission/performance.ts',
    from: "{ id: 'collect', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.CASEFILE_COLLECT', physicalPose: { actor: 'ROOK', poseClass: 'ITEM_REACH' }, fallback: 'GENERIC' }",
    to: "{ id: 'collect', kind: 'CONTACT', actor: 'ROOK', intention: 'PICK_UP', contact: 'CONTACT.CASEFILE_COLLECT', physicalPose: { actor: 'ROOK', poseClass: 'EMPTY_HAND_REACH' }, fallback: 'GENERIC' }",
    test: unit('R6-04', 'R6_CASE_FILE_ITEM_POSE'),
  },
  {
    id: 'MUT-R6-06', file: 'src/controller/mission/performance.ts',
    from: "{ id: 'offer', kind: 'INTENTION', actor: 'ROOK', intention: 'GIVE', physicalPose: { actor: 'ROOK', poseClass: 'PAPER_REACH', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' }",
    to: "{ id: 'offer', kind: 'INTENTION', actor: 'ROOK', intention: 'GIVE', physicalPose: { poseClass: 'NO_REACH', releaseActors: ['ROOK', 'ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_INVENTORY', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' }",
    test: unit('R6-05', 'R6_FORM_OFFER_POSE'),
  },
  {
    id: 'MUT-R6-07', file: 'src/controller/mission/performance.ts',
    from: "{ id: 'handoff', kind: 'CONTACT', actor: 'ARTHUR', intention: 'READ', contact: 'CONTACT.FORM_HANDOFF', physicalPose: { actor: 'ARTHUR', poseClass: 'DOCUMENT_REVIEW', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' }",
    to: "{ id: 'handoff', kind: 'CONTACT', actor: 'ARTHUR', intention: 'READ', contact: 'CONTACT.FORM_HANDOFF', physicalPose: { poseClass: 'IDLE', releaseActors: ['ROOK', 'ARTHUR'], propOwners: { FORM_PAPER: 'NONE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' }",
    test: unit('R6-05', 'R6_FORM_HANDOFF_DOCUMENT'),
  },
  {
    id: 'MUT-R6-08', file: 'src/controller/mission/performance.ts', changes: [
      {
        from: "{ id: 'stamp-caption', kind: 'SOUND_CAPTION', actor: 'ARTHUR', intention: 'READ', sound: 'SFX.STAMP_THUNK', caption: '[THUNK.]', physicalPose: { actor: 'ARTHUR', poseClass: 'DOCUMENT_REVIEW', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' }",
        to: "{ id: 'stamp-caption', kind: 'SOUND_CAPTION', actor: 'ARTHUR', intention: 'STAMP', sound: 'SFX.STAMP_THUNK', caption: '[THUNK.]', physicalPose: { actor: 'ARTHUR', poseClass: 'STAMP_USE', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' } }, fallback: 'STATIC_TEXT' }",
      },
      {
        from: "{ id: 'return', kind: 'CONTACT', actor: 'ROOK', intention: 'GIVE', contact: 'CONTACT.FORM_RETURN', physicalPose: { actor: 'ROOK', poseClass: 'PAPER_REACH', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' }",
        to: "{ id: 'return', kind: 'CONTACT', actor: 'ROOK', intention: 'GIVE', contact: 'CONTACT.FORM_RETURN', physicalPose: { actor: 'ROOK', poseClass: 'PAPER_REACH', propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' } }, fallback: 'GENERIC' }",
      },
    ], test: unit('R6-05', 'R6_FORM_POST_STAMP_DOCUMENT'),
  },
  {
    id: 'MUT-R6-09', file: 'src/controller/mission/performance.ts',
    from: "{ id: 'stamp', kind: 'CONTACT', actor: 'ARTHUR', intention: 'STAMP', contact: 'CONTACT.FORM_STAMP', physicalPose: { actor: 'ARTHUR', poseClass: 'STAMP_USE', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' } }, fallback: 'GENERIC' }",
    to: "{ id: 'stamp', kind: 'CONTACT', actor: 'ARTHUR', intention: 'STAMP', contact: 'CONTACT.FORM_STAMP', physicalPose: { actor: 'ARTHUR', poseClass: 'STAMP_USE', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' }",
    test: unit('R6-05', 'R6_DESK_STAMP_HIDDEN_IN_USE'),
  },
  {
    id: 'MUT-R6-10', file: 'src/adventure/physicalChoreography.ts',
    from: '  return physicalPose ?? null',
    to: "  return expectedClass === 'PAPER_HANDOFF' ? routePoseDirective(route) : physicalPose ?? null",
    test: unit('R6-05', 'R6_FORM_OFFER_OWNER'),
  },
  {
    id: 'MUT-R6-11', file: 'tests/e2e/s15-r6-physical-pose-closure.spec.ts',
    from: "action: attr('active-sequence', 'data-action-id') || 'SETTLED'",
    to: "action: 'PASS'",
    test: {
      command: 'bash',
      args: ['-lc', "rm -f review/s15-r6/RECEIPTS/BROWSER_STAGE_OBSERVATIONS.ndjson; rm -rf review/s15-r6/SCREENSHOTS; S15_R6_EVIDENCE=1 PLAYWRIGHT_PORT=$R6_MUTATION_PORT npx playwright test --workers=1 tests/e2e/s15-r6-physical-pose-closure.spec.ts --grep 'truthful one-paper'; node scripts/s15-r6/verify-evidence.mjs --no-hardcoded"],
      signature: 'R6_HARDCODED_PASS_REJECTED', browser: true,
    },
  },
]

function run(cwd, spec, port = 0) {
  return spawnSync(spec.command, spec.args, { cwd, encoding: 'utf8', env: { ...process.env, R6_MUTATION_PORT: String(port) }, timeout: spec.browser ? 120_000 : 60_000 })
}

const baselineUnit = run(root, unit('S15-R6 true physical pose', ''))
if (baselineUnit.status !== 0) throw Error(`R6_MUTATION_BASELINE_UNIT_FAILED\n${baselineUnit.stdout}\n${baselineUnit.stderr}`)
const baselineBrowser = spawnSync('npx', ['playwright', 'test', '--workers=1', 'tests/e2e/s15-r6-physical-pose-closure.spec.ts', '--grep', 'pointer observes form and pen|truthful one-paper'], { cwd: root, encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_PORT: '4299' }, timeout: 120_000 })
if (baselineBrowser.status !== 0) throw Error(`R6_MUTATION_BASELINE_BROWSER_FAILED\n${baselineBrowser.stdout}\n${baselineBrowser.stderr}`)

const tree = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim()
const parent = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const snapshot = execFileSync('git', ['commit-tree', tree, '-p', parent, '-m', 's15-r6 isolated mutation snapshot'], { cwd: root, encoding: 'utf8' }).trim()
const results = []
for (let index = 0; index < probes.length; index += 1) {
  const probe = probes[index]
  const worktree = mkdtempSync(join(tmpdir(), `s15-r6-${probe.id.toLowerCase()}-`))
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktree, snapshot], { cwd: root, stdio: 'pipe' })
    symlinkSync(resolve(root, 'node_modules'), resolve(worktree, 'node_modules'), 'dir')
    const path = resolve(worktree, probe.file)
    let mutated = readFileSync(path, 'utf8')
    const changes = probe.changes ?? [{ from: probe.from, to: probe.to }]
    for (const change of changes) {
      if (!mutated.includes(change.from)) throw Error(`${probe.id}:MUTATION_TARGET_NOT_FOUND`)
      mutated = mutated.replace(change.from, change.to)
    }
    writeFileSync(path, mutated)
    const execution = run(worktree, probe.test, 4300 + index)
    const output = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`
    const caught = execution.status !== 0 && output.includes(probe.test.signature)
    results.push({ id: probe.id, productionOwner: probe.file, targetedCommand: [probe.test.command, ...probe.test.args].join(' '), exitCode: execution.status, expectedSemanticFailure: probe.test.signature, semanticFailureObserved: caught, outputTail: output.slice(-4000) })
    if (!caught) throw Error(`${probe.id}:MUTATION_NOT_CAUGHT_WITH_SIGNATURE:${probe.test.signature}\n${output}`)
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: root, stdio: 'pipe' }) } catch { rmSync(worktree, { recursive: true, force: true }) }
  }
}

const out = resolve(root, 'review/s15-r6/MUTATIONS')
mkdirSync(out, { recursive: true })
const remaining = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' }).split('\n').filter(line => line.startsWith('worktree ') && line.includes('/tmp/s15-r6-'))
const payload = { schema: 'tarka.s15-r6.real-isolated-mutations.v1', baseline: { unit: 'PASS', browser: 'PASS' }, snapshotTree: tree, snapshotCommit: snapshot, total: results.length, caught: results.filter(row => row.semanticFailureObserved).length, cleanTeardown: remaining.length === 0, remainingMutationWorktrees: remaining, results }
writeFileSync(resolve(out, 'MUTATION_RESULTS.json'), `${JSON.stringify(payload, null, 2)}\n`)
writeFileSync(resolve(out, 'MUTATION_RESULTS.md'), `# S15-R6 real isolated mutations\n\nBaseline unit/browser: PASS. ${payload.caught}/${payload.total} targeted production mutations were rejected with their required semantic signatures. Temporary worktrees remaining: ${remaining.length}.\n\n${results.map(row => `- ${row.id}: ${row.semanticFailureObserved ? 'CAUGHT' : 'SURVIVED'} — ${row.expectedSemanticFailure}`).join('\n')}\n`)
if (payload.caught !== probes.length || !payload.cleanTeardown) throw Error('R6_MUTATION_QUALIFICATION_FAILED')
console.log(JSON.stringify({ total: payload.total, caught: payload.caught, cleanTeardown: payload.cleanTeardown, snapshotTree: tree }))
