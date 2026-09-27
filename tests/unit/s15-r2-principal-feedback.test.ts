import { describe, expect, it } from 'vitest'
import { createInitialAdventureState, adventureReducer, isTalking } from '../../src/adventure/reducer'
import { PRINCIPAL_INTERACTION_COPY, PRINCIPAL_OPENING, dialogueAdvanceDelayMs } from '../../src/story/s15r2/principalFeedback'
import { globeTimeline, globeFrameAt } from '../../src/adventure/globeVisual'
import { MUG_STEAM_A } from '../../src/adventure/animationCues'
import { deadEndSpeech, inventoryItems } from '../../src/adventure/content'
import { normalizeProductionDialogue } from '../../src/adventure/dialogueDelivery'
import { layoutPropHotspots, sceneDefinitions } from '../../src/adventure/scenes'
import { authoredPerformanceClip } from '../../src/app/characterVisual'

describe('S15-R2 Principal Playtest 1 feedback', () => {
  it('stages Arthur alone before Rook enters and begins the exact revised opening only on arrival', () => {
    const initial = createInitialAdventureState()
    expect(initial.openingStage).toBe('ARTHUR_PAPER')
    expect(initial.speech).toBeNull()
    expect(initial.rookPosition.x).toBeLessThan(0)
    const entering = adventureReducer(initial, { type: 'BEGIN_ROOK_ENTRY' })
    expect(entering.openingStage).toBe('ROOK_ENTERING')
    expect(entering.walk).not.toBeNull()
    const arrived = adventureReducer(entering, { type: 'WALK_TICK', delta: 2000 })
    expect(arrived.openingStage).toBe('DIALOGUE')
    expect(arrived.speech?.lines.map(({ speaker, text, copyKey }) => ({ speaker, text, copyKey }))).toEqual(normalizeProductionDialogue(PRINCIPAL_OPENING).map(({ speaker, text, copyKey }) => ({ speaker, text, copyKey })))
    expect(arrived.speech?.lines.slice(0, 5).map((line) => line.text)).toEqual([
      'This the Records Office?', 'No. It’s a pizza restaurant.', 'Right...',
      'We’re closed to the public.', 'I’m waiting for a top-tier lead investigator.',
    ])
    const cameraLine = arrived.speech?.lines.find((line) => line.text === 'This is going to be a long day.') ?? null
    expect(cameraLine?.copyKey).toBe('OPEN-037')
    expect(authoredPerformanceClip(cameraLine, 'MR_INDEX')).toBe('arthur.camera-talk')
  })

  it('defaults to automatic normal delivery, offers deterministic pacing, and keeps the mouth active through the revealed-bubble wait', () => {
    const state = createInitialAdventureState({ skipIntro: true })
    expect([state.dialogueMode, state.dialoguePace]).toEqual(['AUTO', 'NORMAL'])
    expect(dialogueAdvanceDelayMs({ text: 'Short.' }, 'FAST')).toBeLessThan(dialogueAdvanceDelayMs({ text: 'A considerably longer delivered sentence.' }, 'FAST'))
    expect(dialogueAdvanceDelayMs({ text: 'Same line.' }, 'SLOW')).toBeGreaterThan(dialogueAdvanceDelayMs({ text: 'Same line.' }, 'NORMAL'))
    const spoken = { ...state, speech: { lines: [{ speaker: 'ROOK' as const, text: 'Hello.' }], lineIndex: 0, visibleCharacters: 6, returnTo: 'SCENE' as const, control: 'BLOCKING_WORLD_DIALOGUE' as const, performance: { copyKey: null, actor: 'ROOK' as const, crossedCueIds: [], intentions: {}, activeActor: 'ROOK' as const, afterLineHold: false, reducedMotion: false } } }
    expect(isTalking(spoken, 'ROOK')).toBe(true)
    expect(isTalking({ ...spoken, speech: null }, 'ROOK')).toBe(false)
  })

  it('uses semantic emphasis and Nansen trademark copy without literal asterisks', () => {
    expect(PRINCIPAL_OPENING.some((line) => line.text.includes('Nansen™'))).toBe(true)
    expect(PRINCIPAL_OPENING.every((line) => !line.text.includes('*'))).toBe(true)
    expect(PRINCIPAL_OPENING.some((line) => line.emphasis?.length)).toBe(true)
    expect(normalizeProductionDialogue(PRINCIPAL_OPENING).map((line) => line.text)).toEqual(expect.arrayContaining(['Well...by the end of this investigation...', "we'll be closer than ever."]))
    expect(PRINCIPAL_OPENING.map((line) => line.text)).toContain('Fill it out COMPLETELY, then bring it back to me.')
    expect(PRINCIPAL_INTERACTION_COPY.penPickup.map((line) => line.text)).toEqual([
      'Careful with that.', 'It’s an antique collector’s item.', 'Supposedly, it dates back to the signing of the Declaration of Independence.',
    ])
    expect(deadEndSpeech('TALK_TO', 'wall-be-the-change', null).map((line) => line.text)).toEqual([
      'I’m not discussing personal growth with a poster.', 'That’s what performance reviews are for.', 'Nah.', 'It’d probably want to put whatever I’d say to it into that box, too.',
    ])
  })

  it('restores full steam order and a 24-phase accelerating/settling globe timeline', () => {
    expect(MUG_STEAM_A.map((src) => src.match(/phase_(\d+)/)?.[1] ?? '00')).toEqual(['00', '01', '02', '04', '05', '06', '07'])
    for (const level of [1, 2, 3] as const) {
      const timeline = globeTimeline('PUSH', level)
      expect(new Set(timeline.map((entry) => entry.phase)).size).toBe(24)
      expect(timeline.at(-1)!.dwellMs).toBeGreaterThan(timeline[0]!.dwellMs)
      expect(globeFrameAt('PUSH', level, 100)).toMatch(/globe_spin_|phase_/)
    }
  })

  it('binds corrected public labels and inventory identities', () => {
    const labels = [...sceneDefinitions['records-office'].hotspots, ...layoutPropHotspots].map(({ name }) => name)
    expect(labels).toContain('Nansen™ terminal')
    expect(labels).toContain('historical-looking feather pen')
    expect(labels).toContain('stanchion sign')
    expect(inventoryItems['signed-terminal-authorization-form-with-doodles'].name).toBe('scribbled authorization form')
    expect(inventoryItems['approved-stamped-terminal-authorization-form'].name).toBe('approved dinosaur-doodled authorization form')
  })
})
