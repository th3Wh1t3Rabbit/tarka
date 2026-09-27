import { cpSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const repo = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim()
const output = resolve(repo, 'review/s15-r3/RECEIPTS/REAL_MUTATION_PROBES.json')
const testFile = 'tests/unit/s15-r3-runtime-closure.test.ts'
const v = (id) => `node_modules/.bin/vitest run ${testFile} --reporter=verbose -t "${id}"`
const probes = [
  ['DOCUMENT_RENDERER','src/app/characterVisual.ts',"state.mrIndexPose === 'DOCUMENT' ? 'arthur.document' : null","state.mrIndexPose === 'DOCUMENT' ? null : null",v('PF1-001')],
  ['PRINCIPAL_TYPED_CUE_CONSUMER','src/story/s15r2/principalFeedback.ts',"selectedClip: 'arthur.glance-left'","selectedClip: null",v('PF1-011')],
  ['MANUAL_MOUTH_OWNER','src/adventure/reducer.ts',"state.dialogueMode === 'MANUAL'","state.dialogueMode === 'AUTO'",v('PF1-007')],
  ['CONTROL_CLUSTER_REDUCER_STATE','src/adventure/reducer.ts','return { ...state, dialogueMode: action.mode }',"return { ...state, dialogueMode: 'AUTO' }",v('PF1-003')],
  ['R55_BLANK_PARAGRAPH_NORMALIZATION','src/adventure/dialogueDelivery.ts',"raw.replace(/\\s*\\n\\s*/g, ' ')","raw.replace(/NEVER_MATCH/g, ' ')",v('PF1-004')],
  ['VISIBLE_ASTERISK_LEAK','src/story/s15r2/principalFeedback.ts',"if (char === '*')","if (char === '#')",v('PF1-006')],
  ['CHARACTER_NANSEN_TRADEMARK','src/story/s15r2/principalFeedback.ts','Nansen™ API','Nansen API',v('PF1-008')],
  ['POST_CONTACT_STAMP_LINGER','src/adventure/reducer.ts',"transcript: withCurrentTranscript(base, active.pendingSpeech[0], 'BLOCKING'), rookPose: 'IDLE', mrIndexPose: 'IDLE'","transcript: withCurrentTranscript(base, active.pendingSpeech[0], 'BLOCKING'), rookPose: 'IDLE', mrIndexPose: 'STAMP'",v('PF1-043')],
  ['COPIED_SCREENSHOT_OWNERSHIP','src/qualification/s15r3EvidencePolicy.ts',"ordinaryUrl: '/'","ordinaryUrl: '?review=1'",v('PF1-056')],
  ['STEAM_RECIPE_DIVERGENCE','src/adventure/animationCues.ts',"clip('mug.steam', 'mug', 'Coffee steam', MUG_STEAM_FRAMES","clip('mug.steam', 'mug', 'Coffee steam', MUG_STEAM_A",v('PF1-036')],
  ['GLOBE_NO_SEMANTIC_IDLE','src/adventure/reducer.ts',"globeMotion: 'IDLE',","globeMotion: 'SPINNING',",v('PF1-037')],
  ['PHYSICAL_ACTION_BYPASS','src/adventure/reducer.ts','if (!requiresProximity(pending)) {','if (true) {',v('PF1-039')],
  ['GENERIC_57_ROW_SELF_PASS','src/qualification/s15r3Pf1Catalog.ts',"'Relaunch Principal Playtest 2'","'Generic acceptance row'",v('rejects missing')],
  ['OPENING_ARRIVAL_ORDER','src/story/s15r2/principalFeedback.ts',"R('“This the Records Office?”')","R('“Wrong opening.”')",v('PF1-009')],
  ['AUTO_DEFAULT','src/adventure/reducer.ts',"dialogueMode: options.dialogue?.mode ?? 'AUTO'","dialogueMode: options.dialogue?.mode ?? 'MANUAL'",v('PF1-002')],
  ['CLOSER_DELIVERY','src/story/s15r2/principalFeedback.ts','by the end of this investigation, we’ll be closer than ever.','by the end of this investigation. We’ll be closer than ever.',v('PF1-013')],
  ['WITNESS_EXACT_COPY','src/story/s15r2/principalFeedback.ts',"A('“None.”')","A('“No witnesses.”')",v('PF1-021')],
  ['PF1_031_EXACT_DELIVERY','src/story/s15r2/principalFeedback.ts','And DO NOT touch anything else!','Do not touch anything else.',v('PF1-031')],
  ['FORM_SIGNED_LABEL','src/adventure/content.ts',"name: 'authorization form with scribbles'","name: 'signed form'",v('PF1-053')],
  ['LAMP_MUTATES_BEFORE_SPEECH','src/adventure/reducer.ts',"state.lampPower === 'ON' ? 'OFF' : 'ON'","state.lampPower",v('PF1-038')],
  ['TERMINAL_HOVER_TRADEMARK','src/adventure/scenes.ts',"name: 'Nansen™ terminal'","name: 'Nansen terminal'",v('PF1-049')],
  ['SHARED_CABINET_LABEL','src/adventure/scenes.ts',"id: 'miscellaneous-drawer-cabinet', name: 'office cabinet'","id: 'miscellaneous-drawer-cabinet', name: 'misc cabinet'",v('PF1-052')],
  ['LOWERCASE_WINDOW_LABEL','src/adventure/scenes.ts',"id: 'window', name: 'window'","id: 'window', name: 'Window'",v('PF1-051')],
  ['BROKEN_PEN_LABEL','src/adventure/content.ts',"name: 'poorly-handled broken feather pen'","name: 'broken pen'",v('PF1-048')],
  ['COFFEE_DELIVERY_SPLIT','src/story/s15r2/principalFeedback.ts',"R('“is generic store-brand coffee in your cup.”')","R('“coffee.”')",v('PF1-034')],
  ['FORM_COMPLETION_EXACT_COPY','src/adventure/content.ts',"'“Lead Investigator”'","'“Investigator”'",v('PF1-033')],
  ['DUPLICATE_GIVE_FORM_RULE','src/adventure/content.ts',"export const usefulRules: InteractionRule[] = [","export const usefulRules: InteractionRule[] = [\n  { id: 'give-form', verb: 'GIVE', targetId: 'mr-index', itemId: 'signed-terminal-authorization-form-with-doodles', phase: 'FORM_COMPLETED', nextPhase: 'COMPLETE', speech: [] },",v('PF1-044')],
  ['UNAUTHORIZED_TERMINAL_RULES','src/adventure/content.ts',"...(['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED'] as const)","...(['FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED'] as const)",v('PF1-041')],
  ['EVIDENCE_CLEAN_POLICY','src/qualification/s15r3EvidencePolicy.ts','cleanBeforeCapture: true','cleanBeforeCapture: false',v('PF1-056')],
].map(([id,path,search,replacement,command]) => ({ id,path,search,replacement,command }))

function run(command, cwd) { return spawnSync('bash', ['-lc', command], { cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }) }
function hash(path) { return createHash('sha256').update(readFileSync(path)).digest('hex') }
const patch = spawnSync('git', ['diff', '--binary', 'HEAD'], { cwd: repo, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 }).stdout
const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repo, encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean).filter((path) => !path.startsWith('review/'))
const results = []
for (const probe of probes) {
  const tempParent = mkdtempSync(join(tmpdir(), 's15-r3-mutation-'))
  const worktree = join(tempParent, 'worktree')
  try {
    const added = spawnSync('git', ['worktree', 'add', '--detach', worktree, 'HEAD'], { cwd: repo, encoding: 'utf8' })
    if (added.status !== 0) throw new Error(added.stderr)
    if (patch.trim()) { const applied = spawnSync('git', ['apply', '--binary', '-'], { cwd: worktree, input: patch, encoding: 'utf8' }); if (applied.status !== 0) throw new Error(applied.stderr) }
    for (const path of untracked) { const from = resolve(repo, path); const to = resolve(worktree, path); mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: lstatSync(from).isDirectory() }) }
    if (!existsSync(resolve(worktree, 'node_modules'))) symlinkSync(resolve(repo, 'node_modules'), resolve(worktree, 'node_modules'), 'dir')
    const baseline = run(probe.command, worktree)
    const target = resolve(worktree, probe.path); const original = readFileSync(target, 'utf8')
    if (!original.includes(probe.search)) throw new Error(`SEARCH_NOT_FOUND:${probe.id}`)
    const baselineHash = hash(target)
    writeFileSync(target, original.replace(probe.search, probe.replacement))
    const mutantHash = hash(target)
    const mutant = run(probe.command, worktree)
    const outputText = `${mutant.stdout}\n${mutant.stderr}`
    const passed = baseline.status === 0 && mutant.status !== 0 && /FAIL|AssertionError|expected|Error/.test(outputText)
    results.push({ ...probe, baseline: { exitCode: baseline.status, targetSha256: baselineHash }, mutant: { exitCode: mutant.status, targetSha256: mutantHash, failureSignature: outputText.split('\n').find((line) => /FAIL|AssertionError|expected|Error/.test(line))?.trim() ?? 'NO_SEMANTIC_FAILURE_SIGNATURE' }, isolatedGitWorktree: worktree, cleanup: 'PENDING', passed })
  } finally {
    const removed = spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repo, encoding: 'utf8' })
    rmSync(tempParent, { recursive: true, force: true })
    if (results.length && results.at(-1).id === probe.id) results.at(-1).cleanup = removed.status === 0 && !existsSync(worktree) ? 'REMOVED' : 'FAILED'
  }
}
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify({ schemaVersion: 's15-r3.real-mutation-probes.v1', required: probes.length, passed: results.filter((result) => result.passed && result.cleanup === 'REMOVED').length, allPassed: results.every((result) => result.passed && result.cleanup === 'REMOVED'), probes: results }, null, 2)}\n`)
if (!results.every((result) => result.passed && result.cleanup === 'REMOVED')) process.exitCode = 1
else console.log(`PASS_REAL_MUTATION_PROBES ${results.length}`)
