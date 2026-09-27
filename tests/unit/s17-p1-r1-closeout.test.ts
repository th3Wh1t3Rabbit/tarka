import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ambientClip, animationClips } from '../../src/adventure/animationCues'
import { deadEndSpeech, hotspots, inventoryItems, inventorySpeechForState } from '../../src/adventure/content'
import { normalizeProductionDialogue } from '../../src/adventure/dialogueDelivery'
import { readDialoguePreferences } from '../../src/adventure/dialoguePreferences'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { EMPTY_RUNTIME_SESSION } from '../../src/adventure/runtimeSession'
import type { AdventureAction, AdventureState, HotspotId, InventoryItemId, RuntimeSessionConfig, VerbId } from '../../src/adventure/types'
import { dialogueAdvanceDelayMs, PRINCIPAL_OPENING } from '../../src/story/s15r2/principalFeedback'
import { FINAL_FORM_COMPLETION, FINAL_SCRIPT_LINES, finalSpeechByEvent } from '../../src/story/s17/finalScript'
import { renderedAnimationPolicy } from '../../src/app/renderedAnimationPolicy'
import { authoredPerformanceClip, inspectInteractionDeliveryKey, rookReadsSmallNote } from '../../src/app/characterVisual'
import { TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS, TERMINAL_AUTOMATIC_EFFECT_GAIN, TERMINAL_EFFECT_GAIN, TERMINAL_EFFECT_PEAK_BEFORE_LOOP_END_SECONDS } from '../../src/app/terminalAudio'

const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)

const session: RuntimeSessionConfig = {
  ...EMPTY_RUNTIME_SESSION,
  layoutHash: 'layout7-regression',
  arthurCenterX: 460,
  targets: {
    'nansen-terminal': { centerX: 730, centerY: 120, left: 710, width: 40, footY: 330, visible: true, approachLeft: 18, approachRight: 18, lookRange: 58 },
    'official-case-file-cabinet': { centerX: 792, centerY: 128, left: 760, width: 64, footY: 330, visible: true, approachLeft: 36, approachRight: 36, lookRange: 68 },
    'miscellaneous-drawer-cabinet': { centerX: 852, centerY: 130, left: 824, width: 56, footY: 330, visible: true, approachLeft: 38, approachRight: 38, lookRange: 68 },
    'coffee-mug': { centerX: 545, centerY: 215, left: 535, width: 20, footY: 330, visible: true, approachLeft: 28, approachRight: 28, lookRange: 64 },
    'desk-lamp': { centerX: 610, centerY: 170, left: 600, width: 20, footY: 330, visible: true, approachLeft: 28, approachRight: 28, lookRange: 64 },
  },
}

function ready(fromX = 100, patch: Partial<AdventureState> = {}) {
  return { ...createInitialAdventureState({ skipIntro: true, session, accessibility: { reducedAnimation: false, instantText: false } }), rookPosition: { x: fromX, y: 330 }, ...patch }
}

function begin(state: AdventureState, verb: VerbId, targetId: HotspotId) {
  let next = send(state, { type: 'SELECT_VERB', verb })
  next = send(next, { type: 'INTERACT', targetId })
  if (next.walk) next = send(next, { type: 'WALK_TICK', delta: 10_000 })
  return next
}

function driveToSpeech(state: AdventureState) {
  let next = state
  for (let guard = 0; guard < 12 && !next.speech; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  return next
}

describe('S17-P1-R1 speech display and final-room closeout', () => {
  it('F01 preserves object-facing through blocked reach/hold, then turns both actors only for Arthur speech', () => {
    const routes: Array<{ target: 'nansen-terminal' | 'official-case-file-cabinet' | 'miscellaneous-drawer-cabinet'; verb: VerbId }> = [
      { target: 'nansen-terminal', verb: 'USE' },
      ...(['official-case-file-cabinet', 'miscellaneous-drawer-cabinet'] as const).flatMap(target => (['OPEN', 'PULL', 'USE'] as const).map(verb => ({ target, verb }))),
    ]
    for (const { target, verb } of routes) {
      for (const fromX of [100, 920]) {
        const initial = ready(fromX)
        const durableBefore = { phase: initial.phase, inventory: initial.inventory, authorizationState: initial.authorizationState, caseFileDrawer: initial.caseFileDrawer, miscDrawer: initial.miscDrawer, caseStack: initial.caseStack, miscContents: initial.miscContents }
        let state = begin(initial, verb, target)
        const towardObject = state.rookPosition.x < session.targets[target]!.centerX ? 'RIGHT' : 'LEFT'
        expect(state.rookFacing, `${target} from ${fromX} arrival`).toBe(towardObject)
        expect(state.mrIndexFacing, `${target} from ${fromX} no pre-turn`).toBe(initial.mrIndexFacing)
        expect(state.arthurPointHold).toBe(false)
        state = send(state, { type: 'ADVANCE_SEQUENCE' })
        state = send(state, { type: 'ADVANCE_SEQUENCE' })
        expect(state).toMatchObject({ rookFacing: towardObject, mrIndexFacing: initial.mrIndexFacing, rookPose: 'REACH', arthurPointHold: false })
        state = send(state, { type: 'ADVANCE_SEQUENCE' })
        expect(state).toMatchObject({ rookFacing: towardObject, mrIndexFacing: initial.mrIndexFacing, rookPose: 'REACH', arthurPointHold: false })
        state = send(state, { type: 'ADVANCE_SEQUENCE' })
        expect(state.speech).not.toBeNull()
        expect(state.rookPose).toBe('IDLE')
        expect(state.arthurPointHold).toBe(true)
        expect(state.rookFacing).toBe(state.rookPosition.x < 460 ? 'RIGHT' : 'LEFT')
        expect(state.mrIndexFacing).toBe(state.rookPosition.x < 460 ? 'LEFT' : 'RIGHT')
        expect({ phase: state.phase, inventory: state.inventory, authorizationState: state.authorizationState, caseFileDrawer: state.caseFileDrawer, miscDrawer: state.miscDrawer, caseStack: state.caseStack, miscContents: state.miscContents }).toEqual(durableBefore)
      }
    }
  })

  it('F01 does not overreach into separate LOOK/TALK routes', () => {
    for (const target of ['nansen-terminal', 'official-case-file-cabinet', 'miscellaneous-drawer-cabinet'] as const) {
      for (const verb of ['LOOK_AT', 'TALK_TO'] as const) {
        const state = begin(ready(), verb, target)
        expect(state.activeSequence?.id ?? '').not.toMatch(/REPRIMAND|CABINET_POLICY_BLOCK/)
      }
    }
  })

  it('does not repeat adjacent reprimand or snooping deliveries', () => {
    for (const target of ['nansen-terminal', 'official-case-file-cabinet'] as const) {
      const lines = driveToSpeech(begin(ready(), 'USE', target)).speech?.lines ?? []
      expect(lines.length).toBeGreaterThan(0)
      expect(lines.some((line, index) => index > 0 && line.text === lines[index - 1]!.text)).toBe(false)
    }
    const snooping = FINAL_SCRIPT_LINES.filter(line => /snoop/i.test(line.text))
    expect(snooping.some((line, index) => index > 0 && line.text === snooping[index - 1]!.text && line.finalScriptSource?.eventKey === snooping[index - 1]!.finalScriptSource?.eventKey)).toBe(false)

    let terminal = driveToSpeech(begin(ready(), 'USE', 'nansen-terminal'))
    const delivered = terminal.speech?.lines.map(line => line.text) ?? []
    while (terminal.speech) terminal = send(terminal, { type: 'ADVANCE_SPEECH' })
    expect(terminal.activeSequence?.completedSpeechStages).toContain('BLOCKED_REPRIMAND')
    terminal = send(terminal, { type: 'ADVANCE_SEQUENCE' })
    expect(terminal.speech, `replayed terminal reprimand: ${delivered.join(' | ')}`).toBeNull()
    expect(terminal.activeSequence).toBeNull()
  })

  it('F02 never asks the renderer for a loose overlay while Arthur uses baked-paper document frames', () => {
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).not.toContain('visible-form-paper')
    expect(app).not.toContain('FormPaperOverlay')
    expect(app).not.toContain('FORM_ART')
  })

  it('F03 binds the exact Bacon beat, staged vault reach, and two-bubble blank-form PUSH/PULL delivery', () => {
    const bacon = FINAL_SCRIPT_LINES.find(line => line.copyKey === 'r55-1325b81ac9f2ea385e43')
    const vault = FINAL_SCRIPT_LINES.find(line => line.copyKey === 'r55-244598e54ce46059ead0')
    expect(bacon?.beatAfterMs).toBe(250)
    expect(vault?.beatAfterMs).toBe(350)
    for (const verb of ['PUSH', 'PULL'] as const) {
      expect(deadEndSpeech(verb, 'blank-authorization-form', null).map(line => line.text)).toEqual([
        'If I could, I’d turn this into an origami swan...',
        'but I still need it for the case.',
      ])
      let form = ready(100, { phase: 'FORM_HELD', inventory: ['blank-terminal-authorization-form'] })
      const durableBefore = { phase: form.phase, inventory: form.inventory }
      form = send(form, { type: 'SELECT_VERB', verb })
      form = send(form, { type: 'ACT_ON_ITEM', itemId: 'blank-terminal-authorization-form' })
      expect(form.nonblockingSpeech?.lines.map(line => line.text)).toEqual([
        'If I could, I’d turn this into an origami swan...',
        'but I still need it for the case.',
      ])
      expect({ phase: form.phase, inventory: form.inventory }).toEqual(durableBefore)
    }

    let note = ready(100, { inventory: ['fictional-token-note'], piggyNoteReadState: 'UNREAD' })
    note = send(note, { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    note = send(note, { type: 'ACT_ON_ITEM', itemId: 'fictional-token-note' })
    const baconIndex = note.speech?.lines.findIndex(line => line.copyKey === 'r55-1325b81ac9f2ea385e43') ?? -1
    expect(baconIndex).toBeGreaterThanOrEqual(0)
    expect(note.speech?.lines[baconIndex]?.beatAfterMs).toBe(250)
    expect(note.speech?.lines[baconIndex + 1]?.text).toBe('‘Voodoo.’')

    for (const verb of ['USE', 'OPEN', 'PULL'] as const) {
      let vaultRoute = begin(ready(), verb, 'wall-preserve')
      expect(vaultRoute.activeSequence?.id).toBe('SEQUENCE.PRESERVE_REACH')
      vaultRoute = send(vaultRoute, { type: 'ADVANCE_SEQUENCE' })
      vaultRoute = send(vaultRoute, { type: 'ADVANCE_SEQUENCE' })
      expect(vaultRoute.speech?.lines.map(line => line.text)).toEqual(["Maybe there’s a secret vault behind it. Let me see."])
      while (vaultRoute.speech) vaultRoute = send(vaultRoute, { type: 'ADVANCE_SPEECH' })
      vaultRoute = send(vaultRoute, { type: 'ADVANCE_SEQUENCE' })
      expect(vaultRoute).toMatchObject({ rookPose: 'REACH', activeSequence: { currentActionId: 'reach-preserve' } })
      vaultRoute = send(vaultRoute, { type: 'ADVANCE_SEQUENCE' })
      expect(vaultRoute).toMatchObject({ rookPose: 'REACH', activeSequence: { currentActionId: 'hold-preserve-reach' } })
      vaultRoute = send(vaultRoute, { type: 'ADVANCE_SEQUENCE' })
      expect(vaultRoute.speech?.lines.map(line => line.text)).toEqual(['Nah. We’ll save that for the next game.'])
      expect(vaultRoute.rookPose).toBe('IDLE')
    }
  })

  it('defaults old, missing and malformed preferences to Full while retaining an explicit Typed choice', () => {
    const storage = (value: string | null) => ({ getItem: () => value })
    expect(readDialoguePreferences(null)).toMatchObject({ display: 'FULL' })
    expect(readDialoguePreferences(storage(JSON.stringify({ mode: 'MANUAL', pace: 'FAST' })))).toEqual({ mode: 'MANUAL', pace: 'FAST', display: 'FULL' })
    expect(readDialoguePreferences(storage(JSON.stringify({ mode: 'AUTO', pace: 'SLOW', display: 'BROKEN' })))).toEqual({ mode: 'AUTO', pace: 'SLOW', display: 'FULL' })
    expect(readDialoguePreferences(storage(JSON.stringify({ mode: 'AUTO', pace: 'NORMAL', display: 'TYPED' })))).toEqual({ mode: 'AUTO', pace: 'NORMAL', display: 'TYPED' })
  })

  it('shows ordinary Full speech on its first state frame and retains Typed reveal', () => {
    let full = createInitialAdventureState({ skipIntro: true })
    full = send(full, { type: 'APPLY_CONTROL_FIXTURE', fixture: 'ROOK_BLOCKING_BEAT' })
    expect(full.speech?.visibleCharacters).toBe(full.speech?.lines[0]!.text.length)

    let typed = createInitialAdventureState({ skipIntro: true, dialogue: { mode: 'AUTO', pace: 'NORMAL', display: 'TYPED' } } as never)
    typed = send(typed, { type: 'APPLY_CONTROL_FIXTURE', fixture: 'ROOK_BLOCKING_BEAT' })
    expect(typed.speech?.visibleCharacters).toBe(0)
  })

  it('uses word-sensitive Full dwell and keeps authored beats additive at every pace', () => {
    expect(dialogueAdvanceDelayMs({ text: 'One.' }, 'FAST', 'FULL')).toBe(1100)
    expect(dialogueAdvanceDelayMs({ text: 'One.' }, 'NORMAL', 'FULL')).toBe(1430)
    expect(dialogueAdvanceDelayMs({ text: 'One.' }, 'SLOW', 'FULL')).toBe(1760)
    expect(dialogueAdvanceDelayMs({ text: 'One.', beatAfterMs: 250 }, 'NORMAL', 'FULL')).toBe(1680)
    const medium = dialogueAdvanceDelayMs({ text: 'This is a medium line, with enough words to read.' }, 'NORMAL', 'FULL')
    const long = dialogueAdvanceDelayMs({ text: 'This deliberately longer production delivery contains many more spoken words and punctuation, so its reading budget remains materially longer than the medium example.' }, 'NORMAL', 'FULL')
    expect(long).toBeGreaterThan(medium)
    expect(dialogueAdvanceDelayMs({ text: 'Beat.', beatAfterMs: 350 }, 'FAST', 'FULL') - dialogueAdvanceDelayMs({ text: 'Beat.' }, 'FAST', 'FULL')).toBe(350)
    expect(dialogueAdvanceDelayMs({ text: 'Beat.', beatAfterMs: 350 }, 'SLOW', 'FULL') - dialogueAdvanceDelayMs({ text: 'Beat.' }, 'SLOW', 'FULL')).toBe(350)
  })

  it('remaps Typed dwell so Fast is the old Normal, Normal is the old Slow, and Slow is slower again', () => {
    expect(dialogueAdvanceDelayMs({ text: 'One.' }, 'FAST', 'TYPED')).toBe(986)
    expect(dialogueAdvanceDelayMs({ text: 'One.' }, 'NORMAL', 'TYPED')).toBe(1233)
    expect(dialogueAdvanceDelayMs({ text: 'One.' }, 'SLOW', 'TYPED')).toBe(1479)
  })

  it('makes TALK TO approach like LOOK AT before delivering object dialogue', () => {
    const start = ready(100)
    const looked = send(send(start, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'coffee-mug' })
    const talked = send(send(start, { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'coffee-mug' })
    expect(talked.walk).not.toBeNull()
    expect(talked.nonblockingSpeech).toBeNull()
    expect(talked.walk?.to).toEqual(looked.walk?.to)
  })

  it('uses reach-distance drawer LOOK geometry and releases held poses before any walk', () => {
    const contentSession: RuntimeSessionConfig = {
      ...session,
      targets: {
        ...session.targets,
        'miscellaneous-catch-all-contents': { centerX: 850, centerY: 170, left: 824, width: 40, footY: 330, visible: true, approachLeft: 14, approachRight: 14, lookRange: 68 },
      },
    }
    let state = { ...ready(100, { miscDrawer: 'OPEN', rookPose: 'INSPECT' }), runtimeSession: contentSession }
    state = send(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    state = send(state, { type: 'INTERACT', targetId: 'miscellaneous-catch-all-contents' })
    expect(state.walk?.to).toEqual({ x: 810, y: 340 })
    expect(state.rookPose).toBe('IDLE')

    const floorWalk = send({ ...state, walk: null, rookPose: 'INSPECT' }, { type: 'WALK_TO', point: { x: 400, y: 330 } })
    expect(floorWalk.walk).not.toBeNull()
    expect(floorWalk.rookPose).toBe('IDLE')
  })

  it('stands beside the authorized terminal, holds an empty-hand reach, then clears it on presentation', () => {
    let state = ready(100, { phase: 'COMPLETE', authorizationState: 'APPROVED', inventory: ['approved-stamped-terminal-authorization-form'] })
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.walk?.to).toEqual({ x: 692, y: 340 })
    state = send(state, { type: 'WALK_TICK', delta: 10_000 })
    expect(state).toMatchObject({ terminalEntryPending: true, worldQuiescent: true, rookPose: 'REACH' })
    state = send(state, { type: 'ACK_TERMINAL_PRESENTATION' })
    expect(state).toMatchObject({ terminalEntryPending: false, worldQuiescent: true, rookPose: 'IDLE' })
  })

  it('applies the Principal form, opening split and approved Arthur performance deliveries', () => {
    expect(normalizeProductionDialogue(FINAL_FORM_COMPLETION).map(line => line.text)).toEqual([
      'Role:', 'Lead Investigator', 'Name:', 'Rook', 'Purpose:', 'Investigate official things...officially.', 'Annnd...my signature.', 'Whoops...',
      'I think I pressed too hard, and broke the pen.', 'At least I finished the form though.',
    ])
    expect(normalizeProductionDialogue(PRINCIPAL_OPENING).map(line => line.text)).toContain('Well...by the end of this investigation...')
    expect(normalizeProductionDialogue(PRINCIPAL_OPENING).map(line => line.text)).toContain("we'll be closer than ever.")
    const clips = new Set(animationClips().map(clip => clip.id))
    expect(clips).toContain('arthur.camera-talk')
    expect(clips).toContain('arthur.glasses-wiggle')
    expect(clips).toContain('rook.note-read')
    const cues = PRINCIPAL_OPENING.flatMap(line => line.performanceCues ?? []).filter(cue => cue.actor === 'arthur')
    expect(PRINCIPAL_OPENING.find(line => line.text === 'I never threw it.')?.performanceCues).toBeUndefined()
    expect(PRINCIPAL_OPENING.find(line => line.text === 'You?!?')?.beatAfterMs).toBe(900)
    expect(cues.filter(cue => cue.intent === 'ARTHUR_CAMERA_TALK' || cue.intent === 'ARTHUR_ADJUST_GLASSES')).toEqual(expect.arrayContaining([
      expect.objectContaining({ selectedClip: 'arthur.camera-talk', fallback: false }),
      expect.objectContaining({ selectedClip: 'arthur.you-incredulous', fallback: false }),
    ]))
    expect(PRINCIPAL_OPENING.flatMap(line => line.performanceCues ?? []).map(cue => cue.selectedClip)).toEqual(expect.arrayContaining([
      'rook.proud-delivery', 'arthur.sardonic-reaction', 'rook.shrug-delivery',
      'arthur.present-delivery', 'rook.thinking-delivery', 'arthur.glasses-adjust', 'arthur.slouch-delivery',
    ]))
    const ending = [...finalSpeechByEvent('COPY.END:Exact copy'), ...finalSpeechByEvent('COPY.END:3. Friendship and pizza continuation')]
    const endingByKey = new Map(ending.map(line => [line.copyKey, line]))
    expect(endingByKey.get('r55-1ed81e32d6ba819d9791')?.performanceCues).toEqual(expect.arrayContaining([
      expect.objectContaining({ selectedClip: 'rook.case-cracked-delivery', fallback: false }),
    ]))
    expect(endingByKey.get('r55-9b5bf8d20b134d48072d')?.performanceCues).toEqual(expect.arrayContaining([
      expect.objectContaining({ selectedClip: 'rook.pizza-invite-delivery', fallback: false }),
    ]))
    expect(endingByKey.get('r55-66e1d346ac05e4659673')).toEqual(expect.objectContaining({ beatAfterMs: 700 }))
    expect(endingByKey.get('r55-66e1d346ac05e4659673')?.performanceCues).toEqual(expect.arrayContaining([
      expect.objectContaining({ selectedClip: 'arthur.glasses-wiggle', fallback: false }),
    ]))
    expect(authoredPerformanceClip(endingByKey.get('r55-66e1d346ac05e4659673') ?? null, 'MR_INDEX')).toBe('arthur.glasses-wiggle')
  })

  it('uses ordinary speech poses for inventory tools, a continuous note-reading pose, and a neutral stamp reply', () => {
    let toolbox = ready(100, { inventory: ['small-toolbox-closed'] })
    toolbox = send(toolbox, { type: 'SELECT_VERB', verb: 'OPEN' })
    toolbox = send(toolbox, { type: 'ACT_ON_ITEM', itemId: 'small-toolbox-closed' })
    expect(toolbox).toMatchObject({ rookPose: 'IDLE', lastInteractionId: 'INTERACTION.ITEM.open-toolbox' })
    expect(toolbox.speech).not.toBeNull()

    let piggy = ready(100, { inventory: ['hammer', 'piggy-bank-intact'] })
    piggy = send(piggy, { type: 'SELECT_VERB', verb: 'USE' })
    piggy = send(piggy, { type: 'ACT_ON_ITEM', itemId: 'hammer' })
    piggy = send(piggy, { type: 'ACT_ON_ITEM', itemId: 'piggy-bank-intact' })
    expect(piggy).toMatchObject({ rookPose: 'IDLE', lastInteractionId: 'INTERACTION.ITEM.smash-piggy' })
    const tinyChip = piggy.speech?.lines.find(line => line.copyKey === 'r55-f1d5092bf604006fdd94::2') ?? null
    expect(tinyChip).toEqual(expect.objectContaining({
      performanceCues: expect.arrayContaining([
        expect.objectContaining({ selectedClip: 'rook.embarrassed-reaction', activation: 'AFTER_SPEECH' }),
      ]),
    }))
    expect(tinyChip?.beatAfterMs).toBeUndefined()
    expect(authoredPerformanceClip(tinyChip, 'ROOK', true)).toBeNull()
    expect(authoredPerformanceClip(tinyChip, 'ROOK', false)).toBe('rook.embarrassed-reaction')
    expect(piggy.speech?.lines.find(line => line.text === 'What did you do?')?.performanceCues).toEqual(expect.arrayContaining([
      expect.objectContaining({ selectedClip: 'rook.camera-cheeky-hold' }),
    ]))

    let note = ready(100, { inventory: ['fictional-token-note'], piggyNoteReadState: 'UNREAD' })
    note = send(note, { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    note = send(note, { type: 'ACT_ON_ITEM', itemId: 'fictional-token-note' })
    expect(note).toMatchObject({ rookPose: 'IDLE', lastInteractionId: 'INTERACTION.ITEM.look-fictional-token-note' })
    expect(rookReadsSmallNote(note.speech?.lines.find(line => line.copyKey === 'r55-03712d5bd06101148df7::2') ?? null)).toBe(true)
    expect(deadEndSpeech('TALK_TO', 'arthur-stamp', null).map(line => line.text)).toEqual(['It probably wouldn’t respond.'])

    let brokenPig = ready(100, { inventory: ['fictional-token-note'], piggyNoteReadState: 'BACK_READ' })
    brokenPig = send(brokenPig, { type: 'SELECT_VERB', verb: 'TALK_TO' })
    brokenPig = send(brokenPig, { type: 'ACT_ON_ITEM', itemId: 'fictional-token-note' })
    expect(brokenPig.rookPose).toBe('IDLE')
    expect((brokenPig.speech ?? brokenPig.nonblockingSpeech)?.lines.map(line => line.text)).toEqual([
      'I should be focusing on the case...',
      'instead of making small talk with inanimate objects.',
    ])
  })

  it('keeps one inspect entrance identity across every line of one inventory interaction', () => {
    const keys = [
      inspectInteractionDeliveryKey({ channel: 'blocking', transcriptLength: 41, lineIndex: 0, interactionId: 'INTERACTION.ITEM.look-hammer' }),
      inspectInteractionDeliveryKey({ channel: 'blocking', transcriptLength: 42, lineIndex: 1, interactionId: 'INTERACTION.ITEM.look-hammer' }),
      inspectInteractionDeliveryKey({ channel: 'blocking', transcriptLength: 43, lineIndex: 2, interactionId: 'INTERACTION.ITEM.look-hammer' }),
    ]
    expect(new Set(keys)).toEqual(new Set(['blocking:41:INTERACTION.ITEM.look-hammer']))
    expect(inspectInteractionDeliveryKey({ channel: 'blocking', transcriptLength: 50, lineIndex: 0, interactionId: 'INTERACTION.ITEM.look-hammer' })).not.toBe(keys[0])
  })

  it('keeps routine inventory LOOK AT commentary in the neutral stance', () => {
    let state = ready(100, { inventory: ['hammer'] })
    state = send(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    state = send(state, { type: 'ACT_ON_ITEM', itemId: 'hammer' })
    expect(state).toMatchObject({ rookPose: 'IDLE', lastInteractionId: 'INTERACTION.ITEM.look-hammer' })
    expect(state.speech ?? state.nonblockingSpeech).not.toBeNull()
  })

  it('sorts files with an empty reach, grants Euler only after it is found, then reads the large document aloud', () => {
    let state = ready(700, {
      phase: 'COMPLETE',
      authorizationState: 'APPROVED',
      inventory: ['approved-stamped-terminal-authorization-form'],
      caseFileDrawer: 'OPEN',
      caseStack: 'UNSEARCHED',
    })
    state = begin(state, 'PICK_UP', 'disorderly-stack-of-confidential-files')
    expect(state.activeSequence?.id).toBe('SEQUENCE.CASEFILE_COLLECTION')
    for (let index = 0; index < 4; index += 1) state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state).toMatchObject({ rookPose: 'REACH', activeSequence: { currentActionId: 'scan-beat-2', currentPhysicalPoseClass: 'EMPTY_HAND_REACH' } })
    expect(state.inventory).not.toContain('euler-case-file')
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state).toMatchObject({ rookPose: 'REACH', activeSequence: { currentActionId: 'search-dialogue', waitingSpeechStage: 'CASEFILE_SEARCH' } })
    expect(state.inventory).not.toContain('euler-case-file')
    const reachTalkClip = animationClips().find(clip => clip.id === 'rook.reach.talk')!
    expect(reachTalkClip.frames.map(frame => frame.split('/').at(-1))).toEqual(['rook_use_reach.png', 'rook_talk_use_reach.png'])
    while (state.speech) state = send(state, { type: 'ADVANCE_SPEECH' })
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.inventory).toContain('euler-case-file')
    expect(state.rookPose).toBe('REACH')
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state).toMatchObject({ rookPose: 'INSPECT', activeSequence: { currentActionId: 'recite-file', currentPhysicalPoseClass: 'ITEM_REACH', waitingSpeechStage: 'CASEFILE_RECITATION' } })
    expect(state.speech?.lines[0]?.text).toContain('March 13, 2023')
    const caseFileClip = animationClips().find(clip => clip.id === 'rook.case-file')!
    expect(caseFileClip.frames.map(frame => frame.split('/').at(-1))).toEqual(['rook_read_document.png', 'rook_talk_read_document.png'])
    while (state.speech) state = send(state, { type: 'ADVANCE_SPEECH' })
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state).toMatchObject({ rookPose: 'IDLE', activeSequence: null, caseStack: 'SEARCHED_EULER_REMOVED' })
  })

  it('publishes the approved pink hammer asset in the live inventory manifest', () => {
    const manifest = JSON.parse(readFileSync('public/art-packs/production/manifest.json', 'utf8')) as { inventory: Record<string, { src: string }> }
    expect(manifest.inventory.hammer?.src).toMatch(/hammer_pink\.png$/)
  })

  it('moves Rook out of Arthur’s silhouette before opening TALK TO', () => {
    const arthurSession: RuntimeSessionConfig = {
      ...session,
      targets: {
        ...session.targets,
        'mr-index': { centerX: 460, centerY: 250, left: 436, width: 48, footY: 330, visible: true, approachLeft: 24, approachRight: 24, lookRange: 120 },
      },
    }
    let state = ready(458, { runtimeSession: arthurSession })
    state = send(state, { type: 'SELECT_VERB', verb: 'TALK_TO' })
    state = send(state, { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.walk).not.toBeNull()
    expect(Math.abs((state.walk?.to.x ?? 460) - 460)).toBeGreaterThanOrEqual(72)
    state = send(state, { type: 'WALK_TICK', delta: 10_000 })
    expect(state.dialogueOpen).toBe(true)
    expect(Math.abs(state.rookPosition.x - 460)).toBeGreaterThanOrEqual(72)
  })

  it('keeps Arthur paper-reading eyes stable while listening or speaking', () => {
    const document = animationClips().find(clip => clip.id === 'arthur.document')!
    const listening = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'ROOK', clipId: document.id, frames: document.frames, active: true, loop: true })
    const speaking = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'MR_INDEX', clipId: document.id, frames: document.frames, active: true, loop: true })
    expect(listening).toMatchObject({ frames: [document.frames[0]], active: false, loop: false })
    expect(speaking.loop).toBe(true)
    expect(speaking.active).toBe(true)
    expect(speaking.frames.filter(frame => frame === document.frames.at(-1))).toHaveLength(1)
    expect(speaking.frames.at(-1)).toBe(document.frames[0])
  })

  it('does not route bare USE of the form to VHS copy and keeps manual lamp lines dismissible', () => {
    for (const targetId of ['blank-authorization-form', 'pen-stand'] as const) {
      const worldUse = deadEndSpeech('USE', targetId, null, ready(100, { phase: 'START' })).map(line => line.text).join(' ')
      expect(worldUse).toBe('I should pick it up first.')
      expect(worldUse).not.toMatch(/VHS|videotape|tape/i)
    }
    const stampBeforeApproval = deadEndSpeech('USE', 'arthur-stamp', null, ready(100, { phase: 'START' })).map(line => line.text).join(' ')
    const stampAfterApproval = deadEndSpeech('USE', 'arthur-stamp', null, ready(100, { phase: 'COMPLETE' })).map(line => line.text).join(' ')
    expect(stampBeforeApproval).toContain('Tempting')
    expect(stampBeforeApproval).not.toContain('already approved')
    expect(stampAfterApproval).toContain('already approved')

    for (const target of hotspots) {
      for (const itemId of [null, ...(Object.keys(inventoryItems) as InventoryItemId[])]) {
        const copy = deadEndSpeech('USE', target.id, itemId, ready()).map(line => line.text).join(' ')
        if (/VHS|videotape|tape/i.test(copy)) expect(itemId, `${target.id}: ${copy}`).toBe('sharknado-2-vhs')
      }
    }

    let form = ready(100, { phase: 'FORM_HELD', inventory: ['blank-terminal-authorization-form'], dialogueMode: 'MANUAL' })
    form = send(form, { type: 'SELECT_VERB', verb: 'USE' })
    form = send(form, { type: 'ACT_ON_ITEM', itemId: 'blank-terminal-authorization-form' })
    form = send(form, { type: 'INTERACT', targetId: 'coffee-mug' })
    if (form.walk) form = send(form, { type: 'WALK_TICK', delta: 10_000 })
    const formUseText = [...(form.speech?.lines ?? []), ...(form.nonblockingSpeech?.lines ?? [])].map(line => line.text).join(' ')
    expect(formUseText).not.toMatch(/VHS|videotape|tape/i)
    expect(formUseText.length).toBeGreaterThan(0)
    for (const item of ['blank-terminal-authorization-form', 'signed-terminal-authorization-form-with-doodles', 'approved-stamped-terminal-authorization-form'] as const) {
      expect(inventorySpeechForState(item, 'USE').map(line => line.text).join(' ')).not.toMatch(/VHS|videotape|tape/i)
      expect(deadEndSpeech('USE', 'coffee-mug', item).map(line => line.text).join(' ')).not.toMatch(/VHS|videotape|tape/i)
    }

    let lamp = begin(ready(100, { dialogueMode: 'MANUAL', dialogueDisplay: 'FULL' } as Partial<AdventureState>), 'USE', 'desk-lamp')
    for (let guard = 0; guard < 8 && lamp.activeSequence; guard += 1) lamp = send(lamp, { type: 'ADVANCE_SEQUENCE' })
    expect(lamp.nonblockingSpeech).not.toBeNull()
    for (let guard = 0; guard < 4 && lamp.nonblockingSpeech; guard += 1) lamp = send(lamp, { type: 'ADVANCE_SPEECH', channel: 'NONBLOCKING' })
    expect(lamp.nonblockingSpeech).toBeNull()
  })

  it('does not let a bare verb selection interrupt an active Rook line', () => {
    let state = createInitialAdventureState({ skipIntro: true })
    state = send(state, { type: 'APPLY_CONTROL_FIXTURE', fixture: 'ROOK_BLOCKING_BEAT' })
    const speech = state.speech
    state = send(state, { type: 'SELECT_VERB', verb: 'USE' })
    expect(state.speech).toBe(speech)
    expect(state.selectedVerb).toBeNull()
  })

  it('raises terminal speech by exactly 15 layout pixels', () => {
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).toContain('terminal.centerY - 35')
  })

  it('keeps manual degauss gain while lowering and realigning only the automatic seam', () => {
    const audio = readFileSync('src/app/terminalAudio.ts', 'utf8')
    expect(TERMINAL_EFFECT_GAIN).toBe(.375)
    expect(TERMINAL_AUTOMATIC_EFFECT_GAIN).toBe(.225)
    expect(TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS).toBe(.25)
    expect(TERMINAL_EFFECT_PEAK_BEFORE_LOOP_END_SECONDS).toBe(.15)
    expect(audio).toContain("kind === 'AUTO' ? TERMINAL_AUTOMATIC_EFFECT_GAIN : TERMINAL_EFFECT_GAIN")
    expect(audio).toContain('audio.volume = TERMINAL_EFFECT_GAIN')
  })

  it('paces camera blinks, holds angry pointing brows, and gives ambient breaths a real rest window', () => {
    const camera = animationClips().find(clip => clip.id === 'arthur.camera-talk')!
    expect(camera.frames).toHaveLength(10)
    expect(camera.frames.some(frame => frame.includes('continuity-camera-v0.1.0'))).toBe(true)
    expect(camera.frames.at(0)).toContain('coherent-core-v1.0.0')
    expect(camera.frames.at(-1)).toContain('coherent-core-v1.0.0')
    expect(camera.frameDurationsMs).toEqual([400, 500, 100, 180, 140, 220, 140, 170, 700, 500])
    expect(camera.defaultFps).toBe(6)
    const point = animationClips().find(clip => clip.id === 'arthur.point')!
    expect(point.label).toBe('Angry point')
    expect(point.frames).toEqual(expect.arrayContaining([
      expect.stringMatching(/archivist_gesture_point\.png$/),
      expect.stringMatching(/archivist_gesture_point_talk\.png$/),
    ]))
    for (const actor of ['rook', 'arthur'] as const) {
      const samples = Array.from({ length: 240 }, (_, second) => ambientClip(actor, second)?.id ?? '')
      expect(samples.slice(0, 5)).toEqual(Array(5).fill(`${actor}.idle.still`))
      expect(samples).toContain(`${actor}.idle.breath`)
      const breathStarts = samples.flatMap((id, second) => id === `${actor}.idle.breath` && samples[second - 1] !== id ? [second] : [])
      for (const start of breathStarts) {
        let priorBreathEnd = -1
        for (let second = 0; second < start; second += 1) if (samples[second] === `${actor}.idle.breath`) priorBreathEnd = second
        expect(start - priorBreathEnd - 1, `${actor} rest before breath at ${start}s`).toBeGreaterThanOrEqual(5)
      }
    }
  })

  it('delivers each post-authorization snooping exchange exactly once', () => {
    const signed = 'signed-terminal-authorization-form-with-doodles' as const
    let state = ready(100, { phase: 'FORM_COMPLETED', inventory: [signed, 'broken-feather-pen'], instantText: true })
    state = send(state, { type: 'SELECT_VERB', verb: 'GIVE' })
    state = send(state, { type: 'SELECT_ITEM', itemId: signed })
    state = send(state, { type: 'INTERACT', targetId: 'mr-index' })
    if (state.walk) state = send(state, { type: 'WALK_TICK', delta: 10_000 })
    const delivered: string[] = []
    for (let guard = 0; guard < 240 && (state.activeSequence || state.speech); guard += 1) {
      if (state.speech) {
        const line = state.speech.lines[state.speech.lineIndex]!
        if (state.speech.visibleCharacters < line.text.length) state = send(state, { type: 'REVEAL_FULL' })
        else { delivered.push(line.text); state = send(state, { type: 'ADVANCE_SPEECH' }) }
      } else state = send(state, { type: 'ADVANCE_SEQUENCE' })
    }
    expect(delivered.filter(line => line === 'Do not snoop.')).toHaveLength(1)
    expect(delivered.filter(line => line === 'How much snooping counts as snooping?')).toHaveLength(1)
    expect(delivered.filter(line => line === 'What if I need another case file?')).toHaveLength(1)
    for (const phrase of ['But just for TODAY.', 'Knew the dinosaurs would win you over.', 'They did not.', 'Do not snoop.', 'How much snooping counts as snooping?', 'What if I need another case file?']) {
      expect(delivered.filter(line => line.includes(phrase)), `POST_AUTH_EXACTLY_ONCE:${phrase}`).toHaveLength(1)
    }
    expect(state.activeSequence).toBeNull()
  })
})
