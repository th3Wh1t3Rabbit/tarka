import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import projection from '../../src/story/r55/generated/r55-production.json'
import { blockedInteractions, deadEndSpeech, dialogueTopicsForState, inventoryItems, inventorySpeechForState, itemRules, usefulRules } from '../../src/adventure/content'
import { createInitialAdventureState } from '../../src/adventure/reducer'
import { livePerformanceAt } from '../../src/controller/mission/performance'
import { R55_BRCG, R55_COMPLETION, R55_COMPLETION_SIDE_LEAD, R55_E03_COUNTS, R55_ENDING_BRCG, R55_ENDING_DEFAULT, R55_ENDING_UNIVERSAL, R55_PRODUCTION_IDENTITY, r55SpeechByEvent } from '../../src/story/r55/production'
import type { HotspotId, InventoryItemId, VerbId } from '../../src/adventure/types'

const allSourceBound = (lines: readonly { copyKey?: string; r55Source?: unknown; finalScriptSource?: unknown; authority?: string }[]) => lines.length > 0 && lines.every(line => Boolean((line.copyKey?.startsWith('r55-') && line.r55Source) || (line.authority === 'FINAL_SCRIPT_RECONCILIATION' && (line.finalScriptSource || line.copyKey?.startsWith('S17.'))) || line.authority === 'PRINCIPAL_PLAYTEST_1_FEEDBACK' || line.authority === 'PRINCIPAL_S17_DELTA' || (line.authority === 'FINAL_APPROVED_FALLBACK_CONTRACT' && line.copyKey?.startsWith('FALLBACK.'))))
const base = createInitialAdventureState({ skipIntro: true })
type ProjectedLine = { nodeId: string; sourceHashes: { displaySha256: string }; cues: readonly unknown[] }
type ProjectedEvent = { key: string; lines: readonly ProjectedLine[] }
const projectedEvents = projection.events as unknown as readonly ProjectedEvent[]

describe('S14-R1 exact runtime consumer closure', () => {
  it('accounts for exactly 590 nodes, 163 groups, and 10 authenticated aliases', () => {
    expect(projection.events).toHaveLength(163)
    expect(projectedEvents.flatMap(event => event.lines)).toHaveLength(590)
    expect(projection.sharedEventAliases).toHaveLength(10)
    expect(projection.coverage).toMatchObject({ authenticatedSharedAliases: 10, productionOwnedGenericEnglish: 0 })
  })

  it('keeps every active node unique and every alias source receipt separate', () => {
    const nodeIds = projection.events.flatMap(event => event.lines.map(line => line.nodeId))
    expect(new Set(nodeIds).size).toBe(590)
    for (const alias of projection.sharedEventAliases) expect(alias.aliasSourceNodeIds).toEqual(projection.events.find(event => event.key === alias.eventKey)!.lines.map(line => line.nodeId))
  })

  it('binds every authorization and case-file useful rule to exact R55 nodes', () => {
    expect(usefulRules.length).toBeGreaterThan(20)
    for (const rule of usefulRules) {
      if (rule.id === 'take-form' || rule.id === 'take-form-2' || /^(open|pull|close|push|use)-(case|misc)-drawer/.test(rule.id)) expect(rule.speech, rule.id).toEqual([])
      else if (rule.id === 'look-case-cabinet') expect(rule.speech.map(line => line.copyKey), rule.id).toEqual(['NON_R55_FALLBACK_PENDING_PRINCIPAL_POLISH.CASE_CABINET_EXTERIOR'])
      else expect(allSourceBound(rule.speech), rule.id).toBe(true)
    }
  })

  it('binds all item transformations and blocked interactions to exact R55 nodes', () => {
    for (const rule of itemRules) expect(allSourceBound(rule.speech), rule.id).toBe(true)
    for (const blocked of blockedInteractions) expect(blocked.copyKey).toMatch(/^(?:r55-|S17\.)/)
  })

  it('binds every reachable inventory LOOK/OPEN/CLOSE/PUSH/PULL fallback', () => {
    const verbs: Array<VerbId | null> = ['LOOK_AT', 'OPEN', 'CLOSE', 'PUSH', 'PULL']
    for (const itemId of Object.keys(inventoryItems) as InventoryItemId[]) for (const verb of verbs) expect(allSourceBound(inventorySpeechForState(itemId, verb)), `${verb}:${itemId}`).toBe(true)
  })

  it('binds every frozen background hotspot and verb response', () => {
    const targets: HotspotId[] = ['wall-be-the-change', 'wall-think-outside', 'wall-clock', 'wall-employee', 'wall-city-bridge', 'wall-building', 'wall-preserve', 'wall-records-sign', 'wall-not-a-number', 'window', 'book-shelf', 'office-globe', 'desk-lamp', 'arthur-stamp', 'coffee-mug']
    const verbs: VerbId[] = ['LOOK_AT', 'TALK_TO', 'PICK_UP', 'USE', 'OPEN', 'CLOSE', 'PUSH', 'PULL', 'GIVE']
    for (const target of targets) for (const verb of verbs) expect(allSourceBound(deadEndSpeech(verb, target, null, base)), `${verb}:${target}`).toBe(true)
  })

  it('binds drawer repeat states and deterministic globe/lamp states', () => {
    expect(allSourceBound(deadEndSpeech('OPEN', 'official-case-file-cabinet', null, { ...base, caseFileDrawer: 'OPEN' }))).toBe(true)
    expect(allSourceBound(deadEndSpeech('CLOSE', 'miscellaneous-drawer-cabinet', null, { ...base, miscDrawer: 'CLOSED' }))).toBe(true)
    expect(allSourceBound(deadEndSpeech('PUSH', 'office-globe', null, { ...base, globeLevel: 3, globePose: 'PUSH' }))).toBe(true)
    expect(allSourceBound(deadEndSpeech('USE', 'desk-lamp', null, { ...base, lampPower: 'OFF' }))).toBe(true)
  })

  it('binds Arthur preauthorization and postauthorization menus and guidance', () => {
    for (const phase of ['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED', 'COMPLETE'] as const) {
      const topics = dialogueTopicsForState({ ...base, phase })
      expect(topics.length).toBeGreaterThan(0)
      for (const topic of topics.filter(topic => !topic.closes)) expect(allSourceBound(topic.lines), `${phase}:${topic.id}`).toBe(true)
    }
  })

  it('binds every Hero transition surface directly to R55', () => {
    for (const key of ['COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 'COPY.HERO:Evidence Delta 1', 'COPY.HERO:Evidence Delta 2', 'COPY.HERO:Theory resolution']) expect(allSourceBound(r55SpeechByEvent(key)), key).toBe(true)
  })

  it('binds BRCG unread, untested, resolved, payoff, and open/close states', () => {
    for (const key of ['COPY.BRCG:Unread Note — LOOK AT', 'COPY.BRCG:Read, BRCG untested', 'COPY.BRCG:BRCG resolved', 'COPY.BRCG:One-Time World-Side Payoff', 'COPY.BRCG:OPEN or CLOSE — untested', 'COPY.BRCG:OPEN or CLOSE — resolved']) expect(allSourceBound(r55SpeechByEvent(key)), key).toBe(true)
  })

  it('derives every accepted BRCG value from structured authenticated receipts', () => {
    expect(R55_BRCG).toMatchObject({ symbol: 'BRCG', contract: '0xd4c4407f3afb48d7d4ad954572f155f9237ae335', quantity: '888,888,888', exactLiquidity: '$5,166.34' })
    for (const value of Object.values(projection.structured.brcg)) expect(value.receipt).toBeTruthy()
  })

  it('derives ending, completion, four side summaries, stinger, reset, and E03 facts', () => {
    expect(R55_ENDING_UNIVERSAL).toHaveLength(40)
    expect(R55_ENDING_DEFAULT).toHaveLength(1)
    expect(R55_ENDING_BRCG).toHaveLength(6)
    expect(R55_ENDING_DEFAULT[0]?.text).toBe('You broke my pen. I’d say you owe me.')
    expect(R55_ENDING_BRCG[0]?.text).toBe(R55_ENDING_DEFAULT[0]?.text)
    expect(Object.keys(R55_COMPLETION_SIDE_LEAD)).toEqual(['RESOLVED', 'BRCG_UNRESOLVED', 'NOTE_UNRESOLVED', 'UNDISCOVERED'])
    expect(R55_COMPLETION).toMatchObject({ title: 'TARKA', caseName: 'THE FALSE EXIT', resetTitle: 'START A NEW INVESTIGATION?' })
    expect(R55_E03_COUNTS).toEqual({ q1PriorAccepted: 98, q2PriorAccepted: 3, q2CurrentAccepted: 2 })
  })

  it('preserves source identity and cue identity through speech', () => {
    const event = projectedEvents.find(candidate => candidate.lines.some(line => line.cues.length > 0))!
    const line = event.lines.find(candidate => candidate.cues.length > 0)!
    const speech = r55SpeechByEvent(event.key).find(candidate => candidate.copyKey === line.nodeId)!
    expect(speech.r55Source?.sourceHashes.displaySha256).toBe(line.sourceHashes.displaySha256)
    expect(speech.performanceCues?.map(cue => cue.cueId)).toEqual(line.cues.map((_, index) => `${line.nodeId}:cue:${index + 1}`))
    const live = livePerformanceAt(speech.copyKey, speech.text, 0, false, 'ROOK', speech.performanceCues)
    expect(live.crossedCueIds).toEqual(expect.arrayContaining(speech.performanceCues!.map(cue => cue.cueId)))
  })

  it('pins immutable authority and deterministic projection identity', () => {
    expect(R55_PRODUCTION_IDENTITY).toMatchObject({ archiveSha256: '8613c16b6f7df8fcae312b71237729b34eb4fd01619085c3ed0d28d336b01771', registrySha256: 'afb12dd571a083f577a341cf209150a0302152843171c1e7f996976843702052', a1Sha256: 'c665ad8150efb170452d177aba9cfa63be79ee3b9774dc15d1c2ecff850cfca5' })
    expect(R55_PRODUCTION_IDENTITY.projectionSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('keeps placeholder-era owners and stale public strings out of built JS and maps', () => {
    const text = readdirSync('dist/assets').filter(name => /\.js(?:\.map)?$/.test(name)).map(name => readFileSync(`dist/assets/${name}`, 'utf8')).join('\n')
    expect(text).not.toMatch(/s9-placeholders|TODO\.STORY|TODO\.LEAD_COPY|PLACEHOLDER — Story binds final copy|pneumatic tube|record canister|access strip/i)
  })
})
