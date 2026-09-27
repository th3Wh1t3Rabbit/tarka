import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { animationClips } from '../../src/adventure/animationCues'
import { deadEndSpeech } from '../../src/adventure/content'
import { FORM_ART } from '../../src/adventure/formArt'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureAction, AdventureState, HotspotId, InventoryItemId, VerbId } from '../../src/adventure/types'
import { renderedAnimationPolicy } from '../../src/app/renderedAnimationPolicy'
import { SCRIPTED_SEQUENCES } from '../../src/controller/mission/performance'
import { FINAL_SCRIPT_IDENTITY, FINAL_SCRIPT_LINES } from '../../src/story/s17/finalScript'
import reachability from '../../src/story/s17/generated/reachability-corrections.json' with { type: 'json' }

const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
const ready = (patch: Partial<AdventureState> = {}): AdventureState => ({
  ...createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } }),
  ...patch,
})

function begin(state: AdventureState, verb: VerbId, targetId: HotspotId, itemId: InventoryItemId | null = null) {
  let next = state
  if (itemId) next = send(next, { type: 'SELECT_ITEM', itemId })
  next = send(next, { type: 'SELECT_VERB', verb })
  if (itemId) next = send(next, { type: 'SELECT_ITEM', itemId })
  next = send(next, { type: 'INTERACT', targetId })
  if (next.walk) next = send(next, { type: 'WALK_TICK', delta: 10_000 })
  return next
}

function applyPair(state: AdventureState, first: InventoryItemId, second: InventoryItemId) {
  let next = send(state, { type: 'SELECT_VERB', verb: 'USE' })
  next = send(next, { type: 'ACT_ON_ITEM', itemId: first })
  return send(next, { type: 'ACT_ON_ITEM', itemId: second })
}

describe('S17-P1 final script and room integration', () => {
  it('B01 binds all 724 final bubbles once with complete source identity', () => {
    expect(FINAL_SCRIPT_IDENTITY).toMatchObject({ bubbles: 724, eventGroups: 148, uniqueEventKeys: 141, sourceNodes: 500 })
    expect(FINAL_SCRIPT_LINES).toHaveLength(724)
    expect(new Set(FINAL_SCRIPT_LINES.map(line => line.copyKey)).size).toBe(724)
    for (const line of FINAL_SCRIPT_LINES) {
      expect(line.deliveryParts).toEqual([line.text])
      expect(line.finalScriptSource).toBeDefined()
      expect(line.authority).toBe('FINAL_SCRIPT_RECONCILIATION')
    }
  })

  it('B01/B08 keeps both late LOOK deliveries and the literal three-bubble terminal exchange exact', () => {
    const arthurLook = deadEndSpeech('LOOK_AT', 'mr-index', null)
    const terminalLook = deadEndSpeech('LOOK_AT', 'nansen-terminal', null)
    const terminalTalk = deadEndSpeech('TALK_TO', 'nansen-terminal', null)
    expect(arthurLook.map(line => line.text)).toEqual([
      'Arthur the Archivist. Officially, and chronically, unimpressed.',
      'And soon to be my new bestie.',
    ])
    expect(terminalLook).toHaveLength(5)
    expect(terminalLook.flatMap(line => line.emphasis ?? [])).toHaveLength(1)
    expect(terminalTalk.map(line => [line.speaker, line.text, line.literalMarkup ?? false])).toEqual([
      ['ROOK', 'Access main program grid.', false],
      ['TERMINAL', '* AH-AH-AH *', true],
      ['TERMINAL', "* YOU DIDN'T SAY THE MAGIC WORD! *", true],
    ])
  })

  it('B02 closes every one of the 43 admitted reachable-route corrections', () => {
    expect(reachability.count).toBe(43)
    expect(reachability.routes).toHaveLength(43)
    expect(new Set(reachability.routes.map(row => row.trigger_id)).size).toBe(43)
    for (const row of reachability.routes) {
      if (row.required_disposition === 'OPEN_ARTHUR_DIALOGUE_MENU') {
        expect(begin(ready(), 'TALK_TO', 'mr-index').dialogueOpen, row.trigger_id).toBe(true)
        continue
      }
      const delegatedItem = row.required_disposition.startsWith('DELEGATE_TO_') ? 'blank-terminal-authorization-form' : null
      const lines = deadEndSpeech(row.verb as VerbId, row.object_id as HotspotId, delegatedItem)
      expect(lines.length, row.trigger_id).toBeGreaterThan(0)
      expect(lines.map(line => line.text), row.trigger_id).not.toContain(row.current_wrong_copy)
      const supersededByApprovedTerminalTalk = row.object_id === 'nansen-terminal' && row.verb === 'TALK_TO'
      if (!supersededByApprovedTerminalTalk && ["It’s not mine to give.", 'It probably wouldn’t respond.', 'That won’t help.', 'There’s nothing to open.', 'There’s nothing to close.'].includes(row.required_copy_or_behavior)) {
        expect(lines.map(line => line.text), row.trigger_id).toContain(row.required_copy_or_behavior)
      }
    }
  })

  it('B02 preserves both broken-pen/signed-form orientations and only combines intact pen with blank form', () => {
    const inventory: InventoryItemId[] = ['broken-feather-pen', 'signed-terminal-authorization-form-with-doodles']
    for (const [first, second] of [[inventory[0]!, inventory[1]!], [inventory[1]!, inventory[0]!]] as const) {
      const state = applyPair(ready({ phase: 'FORM_COMPLETED', inventory: [...inventory] }), first, second)
      expect(state.phase).toBe('FORM_COMPLETED')
      expect(state.inventory).toEqual(inventory)
      expect(state.authorizationState).toBe('PENDING')
    }
    const combined = applyPair(ready({ phase: 'FORM_AND_PEN', inventory: ['blank-terminal-authorization-form', 'loose-feather-pen'] }), 'blank-terminal-authorization-form', 'loose-feather-pen')
    expect(combined).toMatchObject({ phase: 'FORM_COMPLETED', authorizationState: 'PENDING' })
    expect(combined.inventory).toEqual(['signed-terminal-authorization-form-with-doodles', 'broken-feather-pen'])
  })

  it('B02/P11 gives the broken-pen and signed-form pair the approved no-effect copy', () => {
    const broken = applyPair(ready({ phase: 'FORM_COMPLETED', inventory: ['broken-feather-pen', 'signed-terminal-authorization-form-with-doodles'] }), 'broken-feather-pen', 'signed-terminal-authorization-form-with-doodles')
    expect(broken.speech?.lines.map(line => line.text)).toEqual(['That won’t help.'])
  })

  it('B03 cycles all four admitted leg poses while walking and keeps rendered identity stable', () => {
    const walk = animationClips().find(clip => clip.id === 'rook.walk')!
    expect(walk.frames).toHaveLength(4)
    expect(walk.frames.map(frame => frame.match(/rook_walk_(\d)_/)?.[1])).toEqual(['1', '2', '3', '4'])
    const policy = renderedAnimationPolicy({ actor: 'ROOK', speakerOwner: 'ROOK', clipId: 'rook.walk', frames: walk.frames, active: true, loop: true })
    expect(policy).toMatchObject({ active: true, loop: true, frames: walk.frames })
    expect(renderedAnimationPolicy({ actor: 'ROOK', speakerOwner: 'ROOK', clipId: 'rook.walk', frames: walk.frames, active: true, loop: true }).identity).toBe(policy.identity)
  })

  it('B04 selecting a verb cannot cut blocking speech, while a committed action cancels nonblocking speech', () => {
    const blocking = begin(ready(), 'TALK_TO', 'mr-index')
    const topicId = 'nansen-benefit'
    const speaking = send(blocking, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId })
    expect(speaking.speech).not.toBeNull()
    const selectedDuringSpeech = send(speaking, { type: 'SELECT_VERB', verb: 'USE' })
    expect(selectedDuringSpeech.speech).toEqual(speaking.speech)
    expect(selectedDuringSpeech.selectedVerb).toBe(speaking.selectedVerb)

    let optional = begin(ready(), 'LOOK_AT', 'coffee-mug')
    expect(optional.nonblockingSpeech).not.toBeNull()
    const oldCopy = optional.nonblockingSpeech?.lines[0]?.copyKey
    const oldEpoch = optional.lifecycleEpoch
    optional = send(optional, { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    optional = send(optional, { type: 'INTERACT', targetId: 'desk-lamp' })
    expect(optional.nonblockingSpeech?.lines[0]?.copyKey).not.toBe(oldCopy)
    expect(optional.lifecycleEpoch).toBe(oldEpoch + 1)
  })

  it('B05 keeps a powered but unapproved terminal closed', () => {
    const poweredOnly = ready({ phase: 'COMPLETE', authorizationState: 'PENDING', inventory: ['approved-stamped-terminal-authorization-form'] })
    expect(send(poweredOnly, { type: 'ENTER_TERMINAL' }).worldQuiescent).toBe(false)
  })

  it('B06 transfers, reviews, returns and stamps the one form in the authored physical order', () => {
    const form = SCRIPTED_SEQUENCES.find(sequence => sequence.id === 'SEQUENCE.FORM_REVIEW_RETURN')!
    expect(form.actions.map(action => action.id)).toEqual(['reserve', 'rook-walk', 'arthur-face', 'offer', 'receive', 'handoff', 'review', 'return', 'stamp', 'stamp-caption', 'focus'])
    expect(form.actions.find(action => action.id === 'receive')?.physicalPose).toMatchObject({ poseClass: 'IDLE', propOwners: { FORM_PAPER: 'ROOK_VISIBLE' } })
    expect(form.actions.find(action => action.id === 'handoff')?.physicalPose).toMatchObject({ poseClass: 'EMPTY_HAND_REACH', propOwners: { FORM_PAPER: 'ARTHUR_VISIBLE' } })
    expect(form.actions.find(action => action.id === 'return')?.physicalPose).toMatchObject({ poseClass: 'PAPER_REACH', propOwners: { FORM_PAPER: 'ROOK_VISIBLE' } })
    expect(form.actions.find(action => action.id === 'stamp')?.physicalPose).toMatchObject({ poseClass: 'STAMP_USE', propOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' } })
  })

  it('B06 maps the three original form states to byte-authenticated source pixels', () => {
    expect(Object.keys(FORM_ART)).toEqual(['BLANK', 'SIGNED_DOODLED', 'APPROVED_OK'])
    for (const asset of Object.values(FORM_ART)) {
      const bytes = readFileSync(`public${asset.src}`)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256)
      expect(asset.width).toBeGreaterThan(0)
      expect(asset.height).toBeGreaterThan(0)
    }
  })

  it('B05 fixes both blocked routes to reach, contact-hold, reprimand, then focus', () => {
    for (const id of ['SEQUENCE.TERMINAL_REPRIMAND', 'SEQUENCE.CABINET_POLICY_BLOCK'] as const) {
      const sequence = SCRIPTED_SEQUENCES.find(candidate => candidate.id === id)!
      expect(sequence.actions.map(action => action.id)).toEqual(['reserve', 'reach', 'hold-blocked-reach', 'reprimand', 'focus'])
      expect(sequence.actions.find(action => action.id === 'reach')?.physicalPose?.poseClass).toBe('EMPTY_HAND_REACH')
      expect(sequence.actions.find(action => action.id === 'reprimand')?.physicalPose).toMatchObject({ poseClass: 'IDLE', releaseActors: ['ROOK'] })
    }
  })

  it('B07 puts Arthur’s opening paper away at OPEN-002 and keeps breathing transitions near 1750ms', () => {
    let state = createInitialAdventureState({ accessibility: { reducedAnimation: false, instantText: true } })
    state = send(state, { type: 'BEGIN_ROOK_ENTRY' })
    state = send(state, { type: 'WALK_TICK', delta: 10_000 })
    expect(state).toMatchObject({ openingStage: 'DIALOGUE', mrIndexPose: 'DOCUMENT' })
    expect(state.speech?.lines[state.speech.lineIndex]?.copyKey).toBe('OPEN-001')
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech?.lines[state.speech.lineIndex]?.copyKey).toBe('OPEN-002')
    expect(state.mrIndexPose).toBe('IDLE')
    for (const id of ['rook.idle.breath', 'arthur.idle.breath']) {
      const breath = animationClips().find(clip => clip.id === id)!
      expect(1000 / breath.defaultFps).toBeGreaterThanOrEqual(1700)
      expect(1000 / breath.defaultFps).toBeLessThanOrEqual(2000)
    }
  })
})
