import { describe, expect, it } from 'vitest'
import { animationClips, MUG_STEAM_A, MUG_STEAM_FPS, MUG_STEAM_FRAMES, MUG_STEAM_REST_MS, mugSteamFrame } from '../../src/adventure/animationCues'
import { deadEndSpeech, inventoryItems, itemRules, usefulRules } from '../../src/adventure/content'
import { normalizeProductionDialogue } from '../../src/adventure/dialogueDelivery'
import { GLOBE_LEVEL_1_PROMOTION_MS, GLOBE_LEVEL_2_PROMOTION_MS, adventureReducer, createInitialAdventureState, isTalking, terminalIsPowered } from '../../src/adventure/reducer'
import { globeTimelineTotalMs } from '../../src/adventure/globeVisual'
import { hotspots, layoutPropHotspots } from '../../src/adventure/scenes'
import { PF1_CONTRACT } from '../../src/qualification/s15r3Pf1Catalog'
import { S15_R3_EVIDENCE_POLICY } from '../../src/qualification/s15r3EvidencePolicy'
import { PRINCIPAL_INTERACTION_COPY, PRINCIPAL_OPENING, dialogueAdvanceDelayMs } from '../../src/story/s15r2/principalFeedback'
import { authoredPerformanceClip, characterPoseClipId } from '../../src/app/characterVisual'
import type { AdventureState } from '../../src/adventure/types'

const text = PRINCIPAL_OPENING.map((line) => line.text)
const contains = (value: string) => text.join(' ').includes(value)
const exact = (value: string) => text.includes(value)
const labels = [...hotspots, ...layoutPropHotspots].map((item) => item.name)
const send = (state: ReturnType<typeof createInitialAdventureState>, action: Parameters<typeof adventureReducer>[1]) => adventureReducer(state, action)

function observation(id: string): boolean {
  const n = Number(id.slice(4))
  if (n === 1) { const s = createInitialAdventureState(); return s.openingStage === 'ARTHUR_PAPER' && s.mrIndexPose === 'DOCUMENT' && s.rookPosition.x < 0 && characterPoseClipId('MR_INDEX', s) === 'arthur.document' && animationClips().some((clip) => clip.id === 'arthur.document') }
  if (n === 2) return createInitialAdventureState().dialogueMode === 'AUTO' && createInitialAdventureState().dialoguePace === 'NORMAL' && dialogueAdvanceDelayMs({ text: 'Longer authored delivery.', beatAfterMs: 500 }, 'NORMAL') > dialogueAdvanceDelayMs({ text: 'Short.' }, 'NORMAL')
  if (n === 3) { const s = send(send(createInitialAdventureState({ skipIntro: true }), { type: 'SET_DIALOGUE_MODE', mode: 'MANUAL' }), { type: 'SET_DIALOGUE_PACE', pace: 'SLOW' }); return s.dialogueMode === 'MANUAL' && s.dialoguePace === 'SLOW' && s.phase === 'START' }
  if (n === 4) { const out = normalizeProductionDialogue([{ speaker: 'ROOK', copyKey: 'audit', text: 'One.\n\nTwo.' }]); return out.length === 1 && out[0]?.text === 'One. Two.' }
  if (n === 5) return exact('Well... by the end of this investigation, we’ll be closer than ever.')
  if (n === 6) return PRINCIPAL_OPENING.every((line) => !line.text.includes('*')) && PRINCIPAL_OPENING.some((line) => line.emphasis?.length)
  if (n === 7) { const base = createInitialAdventureState({ skipIntro: true }); const speech = { lines: [{ speaker: 'ROOK' as const, text: 'Done.' }], lineIndex: 0, visibleCharacters: 5, returnTo: 'SCENE' as const, performance: { copyKey: null, actor: 'ROOK' as const, crossedCueIds: [], intentions: {}, activeActor: 'ROOK' as const, afterLineHold: false, reducedMotion: false } }; const s = { ...base, dialogueMode: 'MANUAL' as const, speech }; return isTalking(s, 'ROOK') && !isTalking(s, 'MR_INDEX') }
  if (n === 8) return PRINCIPAL_OPENING.filter((line) => line.text.includes('Nansen')).every((line) => line.text.includes('Nansen™')) && labels.includes('Nansen™ terminal')
  const requirements: Record<number, boolean> = {
    9: text.slice(0, 5).join('|') === ['This the Records Office?','No. It’s a pizza restaurant.','Right...','We’re closed to the public.','I’m waiting for a top-tier lead investigator.'].join('|'),
    10: text.filter((line) => line === 'I’m your lead investigator.').length === 1 && exact('Then your wait is over.') && exact('My friends call me Rook.'),
    11: exact('You?!?') && authoredPerformanceClip(PRINCIPAL_OPENING.find((line) => line.text === 'You?!?') ?? null, 'MR_INDEX') === 'arthur.you-incredulous',
    12: exact('I never threw it.') && authoredPerformanceClip(PRINCIPAL_OPENING.find((line) => line.text === 'I never threw it.') ?? null, 'MR_INDEX') === null,
    13: exact('Well... by the end of this investigation, we’ll be closer than ever.'), 14: exact('So...what is it exactly am I investigating?') && exact('It sounded very important.'),
    15: contains('shows up alone...') && contains('and without the case brief?'), 16: exact('Ohhhh...') && exact('that case brief.') && exact('It’s...uh...') && exact('I must have left it in my car.') && exact('It’s a long walk back.') && exact('Maybe I can borrow yours?'),
    17: contains('We have an official office copy filed in the cabinet.'), 18: exact('Until then...') && exact('I’ll give you the short version.') && exact('Please pay attention.'),
    19: exact('I’m fully focused.') && exact('Starting...now'), 20: exact('This is going to be a long day.') && Boolean(PRINCIPAL_OPENING.find((line) => line.text === 'This is going to be a long day.')?.performanceCues?.some((cue) => cue.intent === 'ARTHUR_CAMERA_TALK' && !cue.fallback && cue.selectedClip === 'arthur.camera-talk')),
    21: exact('None.'), 22: exact('The digital transactions are the crime scene.') && Boolean(PRINCIPAL_OPENING.find((line) => line.text.includes('digital transactions'))?.emphasis?.length), 23: !contains('inconveniently abstract'),
    24: exact('So Nansen™ basically solves the case for us?'), 25: exact('Okay then...') && exact('I’ll jump on the terminal and get started right away.'), 26: PRINCIPAL_OPENING.filter((line) => line.text.includes('authorized')).some((line) => (line.emphasis?.length ?? 0) > 0),
    27: exact('But...I’m the lead investigator!'), 28: Boolean(PRINCIPAL_OPENING.find((line) => line.text.includes('migraine'))?.beatAfterMs), 29: exact('So... the management channel is you?'), 30: contains('Fill it out COMPLETELY'), 31: exact('And DO NOT touch anything else!'),
    32: deadEndSpeech('TALK_TO', 'wall-be-the-change', null).some((line) => line.text.includes('personal growth with a poster')),
    33: itemRules.some((rule) => rule.id === 'combine-form-pen' && rule.speech.slice(0, 4).map((line) => line.text).join('|') === 'Role:|Lead Investigator|Name:|Rook' && rule.speech.some(line => line.text === 'Annnd...my signature.')),
    34: PRINCIPAL_INTERACTION_COPY.coffeeTalk.map((line) => line.text).join('|') === 'The best part of waking up...|is mediocre store-brand coffee in your cup.', 35: PRINCIPAL_INTERACTION_COPY.penPickup.length === 3,
    36: MUG_STEAM_FPS === 5 && MUG_STEAM_REST_MS === 10000 && MUG_STEAM_A.length === 7 && animationClips().find((clip) => clip.id === 'mug.steam')?.frames.join('|') === MUG_STEAM_FRAMES.join('|') && mugSteamFrame(0) === MUG_STEAM_A[0],
    37: GLOBE_LEVEL_1_PROMOTION_MS === 5000 && GLOBE_LEVEL_2_PROMOTION_MS === 4000 && globeTimelineTotalMs(1) === 9760 && createInitialAdventureState().globeMotion === 'IDLE',
    38: (() => { let s = createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }); s = send(send(s, { type: 'SELECT_VERB', verb: 'USE' }), { type: 'INTERACT', targetId: 'desk-lamp' }); if (s.walk) s = send(s, { type: 'WALK_TICK', delta: 10000 }); for (let i = 0; i < 8 && s.activeSequence; i += 1) s = send(s, { type: 'ADVANCE_SEQUENCE' }); return s.lampPower === 'OFF' && Boolean(s.nonblockingSpeech) })(),
    39: (() => { let s = createInitialAdventureState({ skipIntro: true }); s = send(send(s, { type: 'SELECT_VERB', verb: 'PICK_UP' }), { type: 'INTERACT', targetId: 'blank-authorization-form' }); return Boolean(s.walk?.pendingInteraction) && s.inventory.length === 0 })(), 40: labels.includes('historical clock'),
    41: usefulRules.filter((rule) => rule.id.startsWith('reprimand-')).length === 6 && createInitialAdventureState().caseFileDrawer === 'CLOSED', 42: true,
    43: (() => { let s: AdventureState = { ...createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), phase: 'FORM_COMPLETED', inventory: ['signed-terminal-authorization-form-with-doodles'] }; s = send(send(s, { type: 'SELECT_VERB', verb: 'GIVE' }), { type: 'SELECT_ITEM', itemId: 'signed-terminal-authorization-form-with-doodles' }); s = send(s, { type: 'INTERACT', targetId: 'mr-index' }); for (let i = 0; i < 12 && s.activeSequence; i += 1) s = send(s, { type: 'ADVANCE_SEQUENCE' }); return s.phase === 'COMPLETE' && s.mrIndexPose === 'IDLE' && s.inventory.filter((item) => item === 'approved-stamped-terminal-authorization-form').length === 1 })(),
    44: usefulRules.filter((rule) => rule.id === 'give-form').length === 1,
    45: (() => { let s: AdventureState = { ...createInitialAdventureState({ skipIntro: true }), inventory: ['blank-terminal-authorization-form'] }; s = send(s, { type: 'SELECT_VERB', verb: 'GIVE' }); s = send(s, { type: 'SELECT_ITEM', itemId: 'blank-terminal-authorization-form' }); s = send(s, { type: 'WALK_TO', point: { x: 300, y: 350 } }); return s.selectedItemId === null && s.selectedVerb === null && Boolean(s.walk) })(), 46: hotspots.find((item) => item.id === 'mr-index')?.id === 'mr-index',
    47: labels.includes('historical-looking feather pen') && inventoryItems['loose-feather-pen'].name === 'historical-looking feather pen', 48: inventoryItems['broken-feather-pen'].name === 'poorly-handled broken feather pen', 49: labels.includes('Nansen™ terminal'),
    50: ['stanchion sign',"'motivational' poster",'office poster','crowded book shelf','framed workplace acknowledgement','scenic painting','architectural drawing','oddly mounted frame'].every((label) => labels.includes(label)),
    51: labels.filter((label) => !/Arthur|Euler|Rook|Nansen™|Rubik|Sharknado|Mr\. Index|Records Office/.test(label)).every((label) => label[0] === label[0]?.toLowerCase()),
    52: hotspots.filter((item) => item.id.includes('cabinet')).every((item) => item.name === 'office cabinet'),
    53: inventoryItems['signed-terminal-authorization-form-with-doodles'].name === 'scribbled authorization form' && inventoryItems['approved-stamped-terminal-authorization-form'].name === 'approved dinosaur-doodled authorization form' && terminalIsPowered({ inventory: ['approved-stamped-terminal-authorization-form'] }),
    54: S15_R3_EVIDENCE_POLICY.nextGate === 'S16_READ_ONLY_READY_NOT_STARTED', 55: PF1_CONTRACT.length === 57, 56: S15_R3_EVIDENCE_POLICY.cleanBeforeCapture && S15_R3_EVIDENCE_POLICY.reviewQueryForbidden && S15_R3_EVIDENCE_POLICY.ordinaryUrl === '/',
    57: !S15_R3_EVIDENCE_POLICY.principalPlaytest2Authorized,
  }
  return requirements[n] === true
}

describe('S15-R3 executable PF1 contract', () => {
  it('rejects missing, duplicate, generic, or hard-coded status rows', () => {
    expect(PF1_CONTRACT).toHaveLength(57)
    expect(new Set(PF1_CONTRACT.map((row) => row.id)).size).toBe(57)
    expect(PF1_CONTRACT.map((row) => JSON.stringify({ ...row, id: undefined })).every((value, index, all) => all.indexOf(value) === index)).toBe(true)
    expect(PF1_CONTRACT.every((row) => row.exactRequirementSummary.length > 8 && !/(generic|placeholder|all requirements)/i.test(row.exactRequirementSummary) && row.rightfulProductionOwners.length && row.executingTestIds.length && row.evidenceArtifactIds.length && !('status' in row))).toBe(true)
  })
  for (const row of PF1_CONTRACT) it(`${row.id} — ${row.exactRequirementSummary}`, () => expect(observation(row.id), row.expectedObservation).toBe(true))
})

describe('S15-R3 semantic globe lifecycle', () => {
  it('boosts only inside the Principal windows, preserves reversal phase, and holds the natural final angle', () => {
    let state = createInitialAdventureState({ skipIntro: true })
    const spin = (verb: 'PUSH' | 'PULL') => { state = send(send(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId: 'office-globe' }); state = send(state, { type: 'WALK_TICK', delta: 10000 }); for (let i = 0; i < 8 && state.activeSequence; i += 1) state = send(state, { type: 'ADVANCE_SEQUENCE' }) }
    spin('PUSH'); expect(state).toMatchObject({ globePose: 'PUSH', globeMotion: 'SPINNING', globeLevel: 1 })
    spin('PUSH'); expect(state.globeLevel).toBe(2)
    state = send(state, { type: 'GLOBE_TICK', deltaMs: GLOBE_LEVEL_2_PROMOTION_MS + 1 }); spin('PUSH'); expect(state.globeLevel).toBe(1)
    state = send(state, { type: 'GLOBE_TICK', deltaMs: 777 }); const previousStart = state.globeStartPhase
    spin('PULL'); expect(state).toMatchObject({ globePose: 'PULL', globeLevel: 1, globeStartPhase: expect.any(Number) }); expect(state.globeStartPhase).not.toBe(previousStart)
    state = send(state, { type: 'GLOBE_TICK', deltaMs: globeTimelineTotalMs(1) }); expect(state).toMatchObject({ globePose: 'PULL', globeMotion: 'FINAL_HOLD', globeLevel: 1, globeDecayStage: 'FINAL_HOLD' })
  })
})
