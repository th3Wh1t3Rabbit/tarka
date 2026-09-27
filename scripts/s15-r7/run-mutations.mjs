import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve('.')
const testFile = 'tests/unit/s15-r7-opening-dialogue-form-terminal.test.ts'
const unit = (pattern, signature) => ({ command: 'npx', args: ['vitest', 'run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', testFile, '-t', pattern], signature })
const speakerOwner = `export function speakerTurnOwner(state: Pick<AdventureState, 'speech' | 'nonblockingSpeech'>): SpeechLine['speaker'] | 'NONE' {
  const active = state.speech ?? state.nonblockingSpeech
  return active?.lines[active.lineIndex]?.speaker ?? 'NONE'
}`
const review = `      { id: 'review', kind: 'DIALOGUE', actor: 'ARTHUR', intention: 'READ', speechStage: 'FORM_REVIEW', physicalPose: { actor: 'ARTHUR', poseClass: 'DOCUMENT_REVIEW', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },`
const stamp = `      { id: 'stamp', kind: 'CONTACT', actor: 'ARTHUR', intention: 'STAMP', contact: 'CONTACT.FORM_STAMP', sound: 'SFX.STAMP_THUNK', caption: '[THUNK.]', physicalPose: { actor: 'ARTHUR', poseClass: 'STAMP_USE', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' } }, fallback: 'GENERIC' },`
const probes = [
  { id: 'MUT-R7-01', description: 'remove frame-zero blackout', file: 'src/adventure/controlPolicy.ts', from: `  if (!state.introComplete || state.openingStage !== 'COMPLETE') return 'BLOCKING_CUTSCENE'`, to: `  if (state.openingStage !== 'ARTHUR_PAPER') return 'BLOCKING_CUTSCENE'`, test: unit('R7-01', 'R7_FRAME_ZERO_BLACKOUT') },
  { id: 'MUT-R7-02', description: 'remove Rook-entry blackout', file: 'src/adventure/controlPolicy.ts', from: `  if (!state.introComplete || state.openingStage !== 'COMPLETE') return 'BLOCKING_CUTSCENE'`, to: `  if (!state.introComplete && state.openingStage !== 'ROOK_ENTERING') return 'BLOCKING_CUTSCENE'`, test: unit('R7-01', 'R7_ENTRY_BLACKOUT') },
  { id: 'MUT-R7-03', description: 'permit production world mutation during opening', file: 'src/adventure/reducer.ts', from: `  if (openingWorldIsInert(state) && state.runtimeSession.layoutHash !== null && OPENING_WORLD_ACTIONS.has(action.type)) return state`, to: `  if (false && openingWorldIsInert(state) && state.runtimeSession.layoutHash !== null && OPENING_WORLD_ACTIONS.has(action.type)) return state`, test: unit('R7-01', 'R7_FRAME_ZERO_WORLD_INERT') },
  { id: 'MUT-R7-04', description: 'stop mouth after full reveal', file: 'src/adventure/reducer.ts', from: speakerOwner, to: `export function speakerTurnOwner(state: Pick<AdventureState, 'speech' | 'nonblockingSpeech'>): SpeechLine['speaker'] | 'NONE' {
  const active = state.speech ?? state.nonblockingSpeech
  const line = active?.lines[active.lineIndex]
  return line && active && active.visibleCharacters < line.text.length ? line.speaker : 'NONE'
}`, test: unit('R7-02', 'R7_FULL_REVEAL_MOUTH_CONTINUES') },
  { id: 'MUT-R7-05', description: 'drop mouth on same-speaker continuation', file: 'src/adventure/reducer.ts', from: speakerOwner, to: `export function speakerTurnOwner(state: Pick<AdventureState, 'speech' | 'nonblockingSpeech'>): SpeechLine['speaker'] | 'NONE' {
  const active = state.speech ?? state.nonblockingSpeech
  const current = active?.lines[active.lineIndex]
  const previous = active && active.lineIndex > 0 ? active.lines[active.lineIndex - 1] : null
  return current && previous?.speaker !== current.speaker ? current.speaker : active?.lineIndex === 0 ? current?.speaker ?? 'NONE' : 'NONE'
}`, test: unit('R7-02', 'R7_SAME_SPEAKER_MOUTH_CONTINUES') },
  { id: 'MUT-R7-06', description: 'leave stale outgoing speaker active', file: 'src/adventure/reducer.ts', from: speakerOwner, to: `export function speakerTurnOwner(state: Pick<AdventureState, 'speech' | 'nonblockingSpeech'>): SpeechLine['speaker'] | 'NONE' {
  const active = state.speech ?? state.nonblockingSpeech
  if (!active) return 'NONE'
  return active.lines[Math.max(0, active.lineIndex - 1)]?.speaker ?? 'NONE'
}`, test: unit('R7-02', 'R7_STALE_OUTGOING_SPEAKER_CLEARED') },
  { id: 'MUT-R7-07', description: 'defer both form dialogue blocks out of the action sequence', file: 'src/controller/mission/performance.ts', changes: [
    { from: `speechStage: 'FORM_REVIEW', `, to: '' },
    { from: `speechStage: 'POST_STAMP_AUTHORIZATION', `, to: '' },
  ], test: unit('R7-03', 'R7_REVIEW_DIALOGUE_BEFORE_STAMP') },
  { id: 'MUT-R7-08', description: 'stamp before review dialogue', file: 'src/controller/mission/performance.ts', changes: [
    { from: review, to: '      /* MUT-R7-08-REVIEW */' },
    { from: stamp, to: `${stamp}\n${review}` },
    { from: '      /* MUT-R7-08-REVIEW */', to: '' },
  ], test: unit('R7-03', 'R7_STAMP_CANNOT_PRECEDE_REVIEW') },
  { id: 'MUT-R7-09', description: 'duplicate staged dialogue replay', file: 'src/adventure/reducer.ts', from: `    const stageLines = [...FORM_SEQUENCE_SPEECH[scripted.speechStage]]`, to: `    const stageLines = [...FORM_SEQUENCE_SPEECH[scripted.speechStage], ...FORM_SEQUENCE_SPEECH[scripted.speechStage]]`, test: unit('R7-03', 'R7_REVIEW_DIALOGUE_NO_DUPLICATE_REPLAY') },
  { id: 'MUT-R7-10', description: 'render terminal power only after approval', file: 'src/adventure/reducer.ts', from: `export function terminalIsPowered(state: Pick<AdventureState, 'authorizationState'> | Pick<AdventureState, 'inventory'>) {
  void state
  return true
}`, to: `export function terminalIsPowered(state: Pick<AdventureState, 'authorizationState'>) {
  return state.authorizationState === 'APPROVED'
}`, test: unit('R7-05', 'R7_TERMINAL_POWERED_FROM_FRAME_ZERO') },
  { id: 'MUT-R7-11', description: 'allow terminal entry before authorization', file: 'src/adventure/reducer.ts', from: `  return terminalIsPowered(state) && terminalIsAuthorized(state) && state.phase === 'COMPLETE'`, to: `  return terminalIsPowered(state) && state.phase !== 'FORM_SUBMITTED'`, test: unit('R7-05', 'R7_TERMINAL_BLOCKED_BEFORE_AUTHORIZATION') },
  { id: 'MUT-R7-12', description: 'remove the production-visible form overlay binding', file: 'src/app/App.tsx', from: `data-testid="visible-form-paper"`, to: `data-testid="removed-form-paper"`, test: unit('R7-04', 'R7_VISIBLE_PAPER_OVERLAY_RENDERED') },
  { id: 'MUT-R7-13', description: 'mislabel return as Rook GIVE', file: 'src/controller/mission/performance.ts', from: `      { id: 'return', kind: 'CONTACT', actor: 'ARTHUR', receiver: 'ROOK', intention: 'RETURN', receiverIntention: 'RECEIVE', contact: 'CONTACT.FORM_RETURN', physicalPose: { actor: 'ROOK', poseClass: 'PAPER_REACH', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' },`, to: `      { id: 'return', kind: 'CONTACT', actor: 'ROOK', intention: 'GIVE', contact: 'CONTACT.FORM_RETURN', physicalPose: { actor: 'ROOK', poseClass: 'PAPER_REACH', releaseActors: ['ARTHUR'], propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'GENERIC' },`, test: unit('R7-03', 'R7_RETURN_DIRECTION_ARTHUR_TO_ROOK') },
  { id: 'MUT-R7-14', description: 'mislabel PICK_UP receipt as USE', file: 'src/adventure/reducer.ts', from: `    semanticIntention: physicalAction ? route.verb : scripted.intention ?? null,`, to: `    semanticIntention: physicalAction ? (route.verb === 'PICK_UP' ? 'USE' : route.verb) : scripted.intention ?? null,`, test: unit('R7-06', 'R7_PICKUP_RECEIPT_NOT_USE') },
  { id: 'MUT-R7-15', description: 'leave desk stamp hidden after stamp use', file: 'src/controller/mission/performance.ts', from: `      { id: 'stamp-caption', kind: 'DIALOGUE', actor: 'ARTHUR', intention: 'READ', speechStage: 'POST_STAMP_AUTHORIZATION', physicalPose: { actor: 'ARTHUR', poseClass: 'DOCUMENT_REVIEW', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' } }, fallback: 'STATIC_TEXT' },`, to: `      { id: 'stamp-caption', kind: 'DIALOGUE', actor: 'ARTHUR', intention: 'READ', speechStage: 'POST_STAMP_AUTHORIZATION', physicalPose: { actor: 'ARTHUR', poseClass: 'DOCUMENT_REVIEW', releaseActors: ['ROOK'], propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' } }, fallback: 'STATIC_TEXT' },`, test: unit('R7-04', 'R7_DESK_STAMP_RESTORED_AFTER_USE') },
]

function run(cwd, spec) {
  return spawnSync(spec.command, spec.args, { cwd, encoding: 'utf8', env: process.env, timeout: 60_000 })
}

const tree = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim()
const parent = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const snapshot = execFileSync('git', ['commit-tree', tree, '-p', parent, '-m', 's15-r7 isolated mutation snapshot'], { cwd: root, encoding: 'utf8' }).trim()
const results = []
for (const probe of probes) {
  const worktree = mkdtempSync(join(tmpdir(), `s15-r7-${probe.id.toLowerCase()}-`))
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktree, snapshot], { cwd: root, stdio: 'pipe' })
    symlinkSync(resolve(root, 'node_modules'), resolve(worktree, 'node_modules'), 'dir')
    const baseline = run(worktree, probe.test)
    if (baseline.status !== 0) throw Error(`${probe.id}:TARGETED_BASELINE_FAILED\n${baseline.stdout}\n${baseline.stderr}`)
    const path = resolve(worktree, probe.file)
    let mutated = readFileSync(path, 'utf8')
    for (const change of probe.changes ?? [{ from: probe.from, to: probe.to }]) {
      if (!mutated.includes(change.from)) throw Error(`${probe.id}:MUTATION_TARGET_NOT_FOUND:${change.from}`)
      mutated = mutated.replace(change.from, change.to)
    }
    writeFileSync(path, mutated)
    const execution = run(worktree, probe.test)
    const output = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`
    const caught = execution.status !== 0 && output.includes(probe.test.signature)
    results.push({ id: probe.id, description: probe.description, productionOwner: probe.file, baselineStatus: 'PASS', targetedCommand: [probe.test.command, ...probe.test.args].join(' '), exitCode: execution.status, expectedSemanticFailure: probe.test.signature, semanticFailureObserved: caught, outputTail: output.slice(-4000) })
    if (!caught) throw Error(`${probe.id}:MUTATION_NOT_CAUGHT_WITH_SIGNATURE:${probe.test.signature}\n${output}`)
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: root, stdio: 'pipe' }) } catch { rmSync(worktree, { recursive: true, force: true }) }
  }
}

const out = resolve(root, 'review/s15-r7/MUTATIONS')
mkdirSync(out, { recursive: true })
const remaining = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' }).split('\n').filter(line => line.startsWith('worktree ') && line.includes('/tmp/s15-r7-'))
const payload = { schema: 'tarka.s15-r7.real-isolated-mutations.v1', baselinePolicy: 'Each mutation began from a passing targeted test in its own detached worktree.', snapshotTree: tree, snapshotCommit: snapshot, total: results.length, caught: results.filter(row => row.semanticFailureObserved).length, cleanTeardown: remaining.length === 0, remainingMutationWorktrees: remaining, results }
writeFileSync(resolve(out, 'MUTATION_RESULTS.json'), `${JSON.stringify(payload, null, 2)}\n`)
writeFileSync(resolve(out, 'MUTATION_RESULTS.md'), `# S15-R7 real isolated mutations\n\nEvery probe began from a passing targeted baseline. ${payload.caught}/${payload.total} production mutations were rejected with the named semantic signature. Temporary mutation worktrees remaining: ${remaining.length}.\n\n${results.map(row => `- ${row.id}: ${row.semanticFailureObserved ? 'CAUGHT' : 'SURVIVED'} — ${row.description} — ${row.expectedSemanticFailure}`).join('\n')}\n`)
if (payload.total < 14 || payload.caught !== payload.total || !payload.cleanTeardown) throw Error('R7_MUTATION_QUALIFICATION_FAILED')
console.log(JSON.stringify({ total: payload.total, caught: payload.caught, cleanTeardown: payload.cleanTeardown, snapshotTree: tree }))
