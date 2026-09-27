import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = process.cwd()
const output = resolve(root, process.argv[2] ?? 'review/s17-p1/PHASE_C/MUTATIONS/semantic-mutants.json')
const unit = (file) => ['vitest', 'run', file, '--reporter=dot']
const mutations = [
  {
    id: 'M01_UNAUTHORIZED_TERMINAL_GRANT',
    test: unit('tests/unit/s17-p1-final-integration.test.ts'),
    edits: [{ file: 'src/adventure/reducer.ts', from: "return terminalIsPowered(state) && terminalIsAuthorized(state) && state.phase === 'COMPLETE'", to: "return terminalIsPowered(state) && state.phase === 'COMPLETE'" }],
  },
  {
    id: 'M02_SAVE_LATER_VIEW_ADVANCES_START',
    test: unit('tests/unit/s16-guided-terminal.test.ts'),
    edits: [{ file: 'src/investigation/state.ts', from: "return { ...state, s16RouteAdded: true, s16RouteRecordId: command.recordId, candidateRouteResolved: true", to: "return { ...state, s16StartAdded: true, s16RouteAdded: true, s16RouteRecordId: command.recordId, candidateRouteResolved: true" }],
  },
  {
    id: 'M03_LATER_CONTEXTUAL_RECORD_BECOMES_PROOF',
    test: unit('tests/unit/s16-guided-terminal.test.ts'),
    edits: [
      { file: 'src/investigation/state.ts', from: "case 'S13_VERIFY_RECORD': {\n      if (fixture.s13", to: "case 'S13_VERIFY_RECORD': {\n      if (fixture.s13 && command.recordId === fixture.s13.proof.contextualCorroboration.recordId) return { ...state, s13VerifiedRecordId: command.recordId, exactEventIds: ['EXACT.CONTEXTUAL'], error: null }\n      if (fixture.s13" },
      { file: 'src/investigation/state.ts', from: "state.s13SelectedRecordId === c.recordId && c.recordId === fixture.s13.proof.exactRecord.recordId && state.s13FilterStage", to: "state.s13SelectedRecordId === c.recordId && state.s13FilterStage" },
    ],
  },
  {
    id: 'M04_WRONG_ORIGIN_VERIFICATION',
    test: unit('tests/unit/s16-guided-terminal.test.ts'),
    edits: [{ file: 'src/investigation/state.ts', from: "state.s16RecordContext?.recordId !== command.recordId || state.s16RecordContext.origin.kind !== 'RUN' || state.s16RecordContext.origin.runId !== command.runId) return { ...state, error: 'Review the matching first transfer", to: "state.s16RecordContext?.recordId !== command.recordId) return { ...state, error: 'Review the matching first transfer" }],
  },
  {
    id: 'M05_OPTIONAL_QUERIES_STARVE_GUIDED',
    test: unit('tests/unit/s16-guided-terminal.test.ts'),
    edits: [{ file: 'src/investigation/state.ts', from: "if (!plan) return false\n  if (planId === 'P_VIEWS'", to: "if (!plan) return false\n  if (state.s16Runs.length >= 100) return false\n  if (planId === 'P_VIEWS'" }],
  },
  {
    id: 'M06_LEGACY_MIGRATION_DROPS_HISTORY',
    test: unit('tests/unit/s16-guided-terminal.test.ts'),
    edits: [{ file: 'src/investigation/state.ts', from: "s16LegacyHistory: v2LegacyHistory(source.entries),", to: "s16LegacyHistory: []," }],
  },
  {
    id: 'M07_LATE_AUDIO_DECODE_REVIVES',
    test: unit('tests/unit/s16-terminal-audio.test.ts'),
    edits: [{ file: 'src/app/terminalAudio.ts', from: "return this.mounted && generation === this.generation && epoch === this.manualEpoch && context === this.context", to: "return this.mounted && context === this.context" }],
  },
  {
    id: 'M08_WRONG_GENERIC_PAIR_COPY',
    test: unit('tests/unit/s17-p1-final-integration.test.ts'),
    edits: [{ file: 'src/adventure/content.ts', from: "text: 'That won’t help.', copyKey: 'S17.P11.BROKEN_PEN_SIGNED_FORM', deliveryParts: ['That won’t help.']", to: "text: 'It probably wouldn’t respond.', copyKey: 'S17.P11.BROKEN_PEN_SIGNED_FORM', deliveryParts: ['It probably wouldn’t respond.']" }],
  },
  {
    id: 'M09_STAMP_WITH_ARTHUR_OWNING_PAPER',
    test: unit('tests/unit/s17-p1-final-integration.test.ts'),
    edits: [{ file: 'src/controller/mission/performance.ts', from: "contact: 'CONTACT.FORM_STAMP', sound: 'SFX.STAMP_THUNK', caption: '[THUNK.]', physicalPose: { actor: 'ARTHUR', poseClass: 'STAMP_USE', propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' }", to: "contact: 'CONTACT.FORM_STAMP', sound: 'SFX.STAMP_THUNK', caption: '[THUNK.]', physicalPose: { actor: 'ARTHUR', poseClass: 'STAMP_USE', propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' }" }],
  },
  {
    id: 'M10_VERB_SELECTION_CANCELS_SPEECH',
    test: unit('tests/unit/s17-p1-final-integration.test.ts'),
    edits: [
      { file: 'src/adventure/reducer.ts', from: "if (state.speech || state.dialogueOpen || state.activeSequence || state.worldQuiescent) return state\n      { const previous", to: "if (state.dialogueOpen || state.activeSequence || state.worldQuiescent) return state\n      { const previous" },
      { file: 'src/adventure/reducer.ts', from: "return { ...noted, selectedVerb: action.verb, selectedItemId: null, walk:", to: "return { ...noted, speech: null, selectedVerb: action.verb, selectedItemId: null, walk:" },
    ],
  },
  {
    id: 'M11_ADVANCE_SKIPS_UNREVEALED_TEXT',
    test: unit('tests/unit/s10-p2-dialogue.test.ts'),
    edits: [{ file: 'src/adventure/reducer.ts', from: "if (state.speech.visibleCharacters < current.text.length) {", to: "if (false && state.speech.visibleCharacters < current.text.length) {" }],
  },
  {
    id: 'M12_TERMINAL_REPLY_WRONG_SPEAKER',
    test: unit('tests/unit/s17-p1-final-integration.test.ts'),
    edits: [{ file: 'src/adventure/content.ts', from: "{ speaker: 'TERMINAL', text: '* AH-AH-AH *', copyKey: 'S17.P08.TERMINAL_TALK.REPLY_1'", to: "{ speaker: 'ROOK', text: '* AH-AH-AH *', copyKey: 'S17.P08.TERMINAL_TALK.REPLY_1'" }],
  },
  {
    id: 'M13_TERMINAL_ASTERISKS_PARSED_AS_EMPHASIS',
    test: unit('tests/unit/s17-p1-final-integration.test.ts'),
    edits: [{ file: 'src/adventure/content.ts', from: "copyKey: 'S17.P08.TERMINAL_TALK.REPLY_2', deliveryParts: [\"* YOU DIDN'T SAY THE MAGIC WORD! *\"], literalMarkup: true", to: "copyKey: 'S17.P08.TERMINAL_TALK.REPLY_2', deliveryParts: [\"* YOU DIDN'T SAY THE MAGIC WORD! *\"], literalMarkup: false" }],
  },
  {
    id: 'M14_DEGAUSS_CSS_MASK_DISABLED',
    test: unit('tests/unit/s16-guided-terminal.test.ts'),
    edits: [{ file: 'src/app/terminal-viewport.css', from: '.s5-native-terminal.is-degaussing .s5-degauss-surface { animation:s16-degauss-screen 2.1s', to: '.s5-native-terminal.is-degaussing-disabled .s5-degauss-surface { animation:s16-degauss-screen 2.1s' }],
  },
]

const sha = (value) => createHash('sha256').update(value).digest('hex')
const reports = []

for (const mutation of mutations) {
  const originals = new Map()
  let setupError = null
  let result = null
  try {
    for (const edit of mutation.edits) {
      const path = resolve(root, edit.file)
      if (!originals.has(path)) originals.set(path, readFileSync(path))
      const before = readFileSync(path, 'utf8')
      const occurrences = before.split(edit.from).length - 1
      if (occurrences !== 1) throw new Error(`${edit.file}: expected one match, found ${occurrences}`)
      writeFileSync(path, before.replace(edit.from, edit.to))
    }
    result = spawnSync('npx', mutation.test, { cwd: root, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } })
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error)
  } finally {
    for (const [path, bytes] of originals) writeFileSync(path, bytes)
  }
  const files = mutation.edits.map(({ file }) => {
    const original = originals.get(resolve(root, file))
    const restored = readFileSync(resolve(root, file))
    return { file, originalSha256: original ? sha(original) : null, restoredSha256: sha(restored), byteRestored: original ? Buffer.compare(original, restored) === 0 : false }
  })
  const combined = `${result?.stdout ?? ''}${result?.stderr ?? ''}`
  reports.push({
    id: mutation.id,
    command: `npx ${mutation.test.join(' ')}`,
    killed: !setupError && result?.status !== 0,
    exitCode: result?.status ?? null,
    setupError,
    files,
    outputTail: combined.slice(-3000),
  })
}

const report = {
  schemaVersion: '1.0.0',
  method: 'Each semantic fault was applied in isolation; its focused test had to fail; original bytes were restored and hash-checked before the next fault.',
  total: reports.length,
  killed: reports.filter(({ killed }) => killed).length,
  survived: reports.filter(({ killed }) => !killed).map(({ id }) => id),
  allByteRestored: reports.every(({ files }) => files.every(({ byteRestored }) => byteRestored)),
  mutations: reports,
}
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ output, total: report.total, killed: report.killed, survived: report.survived, allByteRestored: report.allByteRestored }))
process.exit(report.killed === report.total && report.allByteRestored ? 0 : 1)
