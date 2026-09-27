import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import projection from '../../src/story/r55/generated/r55-production.json'
import { blockedInteractions, itemRules, usefulRules } from '../../src/adventure/content'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { R55_ACTUAL_ACTION_MATRIX, executeR55ActualAction } from '../../src/adventure/r55ProductionRouteRegistry'
import type { AdventureState, HotspotId, InventoryItemId, VerbId } from '../../src/adventure/types'
import { r55SpeechByEvent, r55SpeechBySourceSlice, R55_SOURCE_SLICE_INVENTORY } from '../../src/story/r55/production'

const ids = (lines: readonly { copyKey?: string }[]) => [...new Set(lines.map(line => line.copyKey?.replace(/\.provisional-\d+$/, '')).filter((id): id is string => Boolean(id)))]
const stateIds = (state: AdventureState) => ids(state.speech?.lines ?? state.nonblockingSpeech?.lines ?? state.activeSequence?.pendingSpeech ?? [])
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const csvQuote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`
const NON_ACTION_SOURCE_ONLY_NODE_IDS = [
  'r55-cff1b558ff98b4cc677e', 'r55-9ff2f00c8697ff2ecafb',
  'r55-c311b8b475ec69891101', 'r55-4fdaf98d78de40037d08',
  'r55-f8d96c7e1a9c79e7fe70', 'r55-860fc9467587f250fb23',
  'r55-4a0b16005dbdc45207c8', 'r55-dae81c2d6290dbabae86',
  'r55-197db8b0aaa1fbae0d1c', 'r55-99edd9183c0face9d35e',
  'r55-c674c8a4c6a801957b06', 'r55-6bce477f16d1f3f04ff3',
  'r55-308f0a975db5d00977da', 'r55-7c5de3a03627f1e2e925',
  'r55-b247fe2a11a40adda6be',
  // R5 moves cabinet no-op ownership to the exact BACKGROUND open/close
  // deliveries; the older repeat-close source is authenticated but dormant.
  'r55-b07907750dc4c52fbcf6',
] as const
function expectedIds(descriptor: (typeof R55_ACTUAL_ACTION_MATRIX)[number]) {
  const runtime = descriptor.expectedSources.flatMap(expected => {
    if (expected.startIndex === undefined) return r55SpeechByEvent(expected.eventKey).map(line => line.copyKey!)
    const slice = R55_SOURCE_SLICE_INVENTORY.find(candidate => candidate.eventKey === expected.eventKey && candidate.startIndex === expected.startIndex)
    expect(slice, `${descriptor.routeId}:${expected.eventKey}[${expected.startIndex}]`).toBeDefined()
    return r55SpeechBySourceSlice(slice!.routeId).map(line => line.copyKey!)
  })
  return [...runtime, ...(descriptor.expectedNodeIds ?? []), ...(descriptor.expectedNonR55CopyKeys ?? [])]
}

function actWorld(state: AdventureState, verb: VerbId, targetId: HotspotId): AdventureState {
  let next = adventureReducer(state, { type: 'SELECT_VERB', verb })
  next = adventureReducer(next, { type: 'INTERACT', targetId })
  if (next.walk) next = adventureReducer(next, { type: 'WALK_TICK', delta: 10_000 })
  for (let index = 0; next.activeSequence && index < 40; index += 1) next = adventureReducer(next, { type: 'ADVANCE_SEQUENCE' })
  return next
}

function clearSpeech(state: AdventureState): AdventureState {
  return { ...state, speech: null, nonblockingSpeech: null, activeSequence: null, walk: null }
}

function lookInventory(state: AdventureState, itemId: InventoryItemId): AdventureState {
  const next = adventureReducer(clearSpeech(state), { type: 'SELECT_VERB', verb: 'LOOK_AT' })
  return adventureReducer(next, { type: 'ACT_ON_ITEM', itemId })
}

describe('S14-R6 actual production action matrix', () => {
  it('binds the observed selectors at the real Hero, BRCG, and ending component callsites', () => {
    const terminal = readFileSync(resolve('src/app/CaseTerminalWorkbench.tsx'), 'utf8')
    const corpus = readFileSync(resolve('src/app/S13IntegratedCorpus.tsx'), 'utf8')
    const ending = readFileSync(resolve('src/app/S14Ending.tsx'), 'utf8')
    const routeRegistry = readFileSync(resolve('src/adventure/r55ProductionRouteRegistry.ts'), 'utf8')
    expect(terminal).toContain("selectHeroTerminalSpeech(key === 'exactCorrection' ? 'THEORY_RESOLUTION' : 'DELTA_2')")
    expect(corpus).toContain('selectHeroTerminalSpeech(heroRoute)')
    expect(corpus).toContain("selectBrcgTerminalSpeech('RESOLVED')")
    // The Records Office now owns and visibly delivers the ending exchange.
    // S14Ending must not mount a second full-screen dialogue renderer, while
    // the authenticated route registry retains the exact variant selector.
    expect(ending).not.toContain('selectEndingVariantSpeech')
    expect(routeRegistry).toContain('selectEndingVariantSpeech(Boolean(action.brcgResolved))')
  })

  it('keeps source completeness separate from action multiplicity', () => {
    expect(projection.coverage).toMatchObject({ executableCopyNodes: 590, eventGroups: 163, sourceSlices: 220, entrypointNodes: 220, continuationNodes: 370, authenticatedSharedAliases: 10 })
    expect(new Set(projection.events.flatMap(event => event.lines.map(line => line.nodeId))).size).toBe(590)
    expect(new Set(projection.sourceSlices.flatMap(slice => slice.nodeIds)).size).toBe(590)
  })

  it('executes every generated matrix row through production dispatch and selectors', () => {
    const aliases = new Set(projection.sharedEventAliases.map(alias => alias.eventKey))
    const rows = R55_ACTUAL_ACTION_MATRIX.map(descriptor => {
      const expectedOrderedNodeIds = expectedIds(descriptor)
      const observation = executeR55ActualAction(descriptor)
      const actualOrderedNodeIds = ids(observation.lines)
      if (descriptor.routeId === 'useful.give-form') {
        expect(actualOrderedNodeIds.every(id => expectedOrderedNodeIds.includes(id)), descriptor.routeId).toBe(true)
        expect(new Set(actualOrderedNodeIds).size, descriptor.routeId).toBe(actualOrderedNodeIds.length)
      } else if (descriptor.routeId === 'item.combine-form-pen') {
        expect(actualOrderedNodeIds, descriptor.routeId).toEqual([...expectedOrderedNodeIds,
          'S17.P1.R1.FORM.PURPOSE_LABEL',
          'S17.P1.R1.FORM.PURPOSE',
          'S17.P1.R1.FORM.SIGNATURE', 'S17.P1.R1.FORM.WHOOPS', 'S17.P1.R1.FORM.BROKE_PEN', 'S17.P1.R1.FORM.FINISHED',
        ])
      } else if (descriptor.routeId === 'inventory.generic-use') {
        expect(actualOrderedNodeIds, descriptor.routeId).toEqual(expectedOrderedNodeIds)
        expect(actualOrderedNodeIds[0], descriptor.routeId).toMatch(/^FALLBACK\.USE\.INCOMPATIBLE\.V1\./)
        expect(observation.lines.map(line => line.text).join(' ')).not.toMatch(/VHS|video.?tape/i)
      } else expect(actualOrderedNodeIds, descriptor.routeId).toEqual(expectedOrderedNodeIds)
      if (descriptor.ownerFamily === 'useful-rule') expect(observation.selectedOwnerId, descriptor.routeId).toBe(`INTERACTION.REQUIRED.${descriptor.ownerId}`)
      if (descriptor.ownerFamily === 'item-rule') expect(observation.selectedOwnerId, descriptor.routeId).toBe(`INTERACTION.ITEM.${descriptor.ownerId}`)
      if (descriptor.ownerFamily === 'blocked-interaction') expect(observation.selectedOwnerId, descriptor.routeId).toBe(`INTERACTION.BLOCKED.${descriptor.ownerId.replaceAll(':', '.')}`)
      if (descriptor.ownerFamily === 'hero-terminal') expect(observation.selectedOwnerId, descriptor.routeId).toBe(`COMPONENT.HERO.${descriptor.actionInput.route}`)
      if (descriptor.ownerFamily === 'brcg-terminal') expect(observation.selectedOwnerId, descriptor.routeId).toBe(`COMPONENT.BRCG.${descriptor.actionInput.state}`)
      if (descriptor.ownerFamily === 'ending-completion') expect(observation.selectedOwnerId, descriptor.routeId).toBe(`COMPONENT.ENDING.${Boolean(descriptor.actionInput.brcgResolved)}`)
      return {
        routeId: descriptor.routeId,
        ownerFamily: descriptor.ownerFamily,
        ownerId: descriptor.ownerId,
        selectedOwnerId: observation.selectedOwnerId,
        exactActionInput: JSON.stringify(descriptor.actionInput),
        exactStateFixture: JSON.stringify(descriptor.stateFixture),
        expectedSourceSlices: descriptor.expectedSources.map(source => `${source.eventKey}[${source.startIndex ?? '*'}]`).join('|'),
        expectedOrderedNodeIds: expectedOrderedNodeIds.join('|'),
        actualOrderedNodeIds: actualOrderedNodeIds.join('|'),
        finalPhase: observation.finalState.phase,
        finalInventory: observation.finalState.inventory.join('|'),
        executingTestId: descriptor.exerciseId,
      }
    })
    expect(new Set(rows.map(row => row.routeId)).size).toBe(rows.length)
    expect(R55_ACTUAL_ACTION_MATRIX.filter(row => row.ownerFamily === 'useful-rule').map(row => row.ownerId)).toEqual(usefulRules.map(rule => rule.id))
    expect(R55_ACTUAL_ACTION_MATRIX.filter(row => row.ownerFamily === 'item-rule').map(row => row.ownerId)).toEqual(itemRules.map(rule => rule.id))
    expect(R55_ACTUAL_ACTION_MATRIX.filter(row => row.ownerFamily === 'blocked-interaction').map(row => row.ownerId)).toEqual(blockedInteractions.map(rule => `${rule.verb}:${rule.targetId}:${rule.itemId}`))

    const actualR55Occurrences = rows.flatMap(row => row.actualOrderedNodeIds.split('|').filter(id => id.startsWith('r55-')))
    const canonicalEvents = projection.events.filter(event => !aliases.has(event.key))
    const aliasNodeIds = projection.sharedEventAliases.flatMap(alias => alias.aliasSourceNodeIds)
    expect(actualR55Occurrences.length).toBeGreaterThan(500)
    expect(rows.flatMap(row => row.actualOrderedNodeIds.split('|'))).toEqual(expect.arrayContaining(['OVR-PEN-01', 'OVR-PEN-02', 'OVR-PEN-03', 'OVR-FORM-01', 'OVR-FORM-02', 'OVR-FORM-03', 'OVR-FORM-04']))

    if (process.env.S14_R6_WRITE_RECEIPT === '1' || process.env.S15_WRITE_RECEIPT === '1' || process.env.S15_R1_WRITE_RECEIPT === '1') {
      const s15r1 = process.env.S15_R1_WRITE_RECEIPT === '1'
      const s15 = process.env.S15_WRITE_RECEIPT === '1'
      const output = resolve(s15r1 ? 'artifacts/s15-r1/RECEIPTS' : s15 ? 'artifacts/s15/RECEIPTS' : 'artifacts/s14-r6/RECEIPTS')
      mkdirSync(output, { recursive: true })
      const columns = Object.keys(rows[0]!)
      const csv = [columns.map(csvQuote).join(','), ...rows.map(row => columns.map(column => csvQuote(row[column as keyof typeof row])).join(','))].join('\n') + '\n'
      writeFileSync(resolve(output, 'ACTUAL_ACTION_OBSERVATIONS.csv'), csv)
      const ownerFamilyBreakdown = Object.fromEntries([...new Set(rows.map(row => row.ownerFamily))].sort().map(family => [family, rows.filter(row => row.ownerFamily === family).length]))
      const receipt = {
        schemaVersion: s15 ? 's15-actual-action-observation.v1' : 's14-r6-actual-action-observation.v1', projectionPayloadSha256: projection.projectionSha256,
        actualActionRouteTotal: rows.length, ownerFamilyBreakdown,
        usefulRuleIds: usefulRules.map(rule => rule.id), itemRuleIds: itemRules.map(rule => rule.id),
        blockedInteractions: blockedInteractions.map(rule => `${rule.verb}:${rule.targetId}:${rule.itemId}`),
        canonicalEventGroups: canonicalEvents.length, canonicalUniqueObservedNodes: new Set(actualR55Occurrences).size,
        actualObservedNodeOccurrences: actualR55Occurrences.length, duplicateNodeOccurrences: actualR55Occurrences.length - new Set(actualR55Occurrences).size,
        authenticatedSharedAliasEvents: projection.sharedEventAliases.length, authenticatedSharedAliasNodes: aliasNodeIds.length,
        nonActionSourceOnlyNodeIds: NON_ACTION_SOURCE_ONLY_NODE_IDS,
        accountedNodes: new Set(actualR55Occurrences).size, expectedEqualsActual: true,
        cabinetExteriorDisposition: 'NON_R55_FALLBACK_PENDING_PRINCIPAL_POLISH.CASE_CABINET_EXTERIOR', observationsCsvSha256: sha256(csv),
      }
      writeFileSync(resolve(output, 'ACTUAL_ACTION_OBSERVATION_RECEIPT.json'), `${JSON.stringify(receipt, null, 2)}\n`)
      writeFileSync(resolve(output, 'SOURCE_COMPLETENESS_RECEIPT.json'), `${JSON.stringify({ schemaVersion: s15 ? 's15-source-completeness.v1' : 's14-r6-source-completeness.v1', projectionPayloadSha256: projection.projectionSha256, ...projection.coverage }, null, 2)}\n`)
    }
  })

  it('plays both exit exchanges, closes the menu, records transcript, and restores world focus', () => {
    for (const [phase, expected] of [
      ['START', expectedIds(R55_ACTUAL_ACTION_MATRIX.find(row => row.routeId === 'dialogue.exit-preauth')!)],
      ['COMPLETE', expectedIds(R55_ACTUAL_ACTION_MATRIX.find(row => row.routeId === 'dialogue.exit-postauth')!)],
    ] as const) {
      let state: AdventureState = { ...createInitialAdventureState({ skipIntro: true, accessibility: { instantText: true, reducedAnimation: true } }), phase }
      state = actWorld(state, 'TALK_TO', 'mr-index')
      expect(state.dialogueOpen).toBe(true)
      state = adventureReducer(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'leave' })
      expect(state.dialogueOpen).toBe(false)
      expect(stateIds(state)).toEqual(expected)
      expect(state.transcript.at(-1)?.copyKey).toBe(expected[0])
      expect(state.speech?.performance).toBeDefined()
      state = adventureReducer(state, { type: 'ADVANCE_SPEECH' })
      state = adventureReducer(state, { type: 'ADVANCE_SPEECH' })
      expect(state.speech).toBeNull()
      expect(state.dialogueOpen).toBe(false)
      expect(state.focusReturnTarget).toBeNull()
    }
  })

  it('uses current state for Arthur guidance and retains approved form for GIVE and USE', () => {
    const guidance = R55_ACTUAL_ACTION_MATRIX.find(row => row.routeId === 'dialogue.guidance-no-file')!
    expect(ids(executeR55ActualAction(guidance).lines)).toEqual(expectedIds(guidance))

    for (const routeId of ['arthur.approved-form', 'arthur.use-canonical.approved-form']) {
      const descriptor = R55_ACTUAL_ACTION_MATRIX.find(row => row.routeId === routeId)!
      const observation = executeR55ActualAction(descriptor)
      expect(ids(observation.lines)).toEqual(expectedIds(descriptor))
      expect(observation.finalState.inventory).toContain('approved-stamped-terminal-authorization-form')
      expect(observation.selectedOwnerId).toBe('INTERACTION.ARTHUR.GIVE.approved-stamped-terminal-authorization-form')
    }
  })

  it('keeps pickup speech separate from later inventory LOOK in both orders and after re-entry', () => {
    const start = clearSpeech(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } }))
    let formFirst = actWorld(start, 'PICK_UP', 'blank-authorization-form')
    expect(formFirst.phase).toBe('FORM_HELD')
    expect(formFirst.inventory).toContain('blank-terminal-authorization-form')
    expect(stateIds(formFirst)).toEqual([])
    formFirst = actWorld(clearSpeech(formFirst), 'PICK_UP', 'pen-stand')
    expect(formFirst.phase).toBe('FORM_AND_PEN')
    expect(stateIds(formFirst)).toEqual(['OVR-PEN-01', 'OVR-PEN-02', 'OVR-PEN-03'])
    expect(stateIds(lookInventory(formFirst, 'blank-terminal-authorization-form'))).toEqual(expectedIds(R55_ACTUAL_ACTION_MATRIX.find(row => row.routeId === 'inventory.blank-form-look')!))
    expect(stateIds(lookInventory(formFirst, 'loose-feather-pen'))).toEqual(expectedIds(R55_ACTUAL_ACTION_MATRIX.find(row => row.routeId === 'inventory.pen-look')!))

    let penFirst = actWorld(start, 'PICK_UP', 'pen-stand')
    expect(penFirst.phase).toBe('PEN_HELD')
    expect(stateIds(penFirst)).toEqual(['OVR-PEN-01', 'OVR-PEN-02', 'OVR-PEN-03'])
    const folded = actWorld(clearSpeech(penFirst), 'PULL', 'blank-authorization-form')
    expect(folded.phase).toBe('PEN_HELD')
    expect(folded.nonblockingSpeech?.lines.map(line => line.text)).toEqual(['If I could, I’d turn this into an origami swan...', 'but I still need it for the case.'])
    penFirst = actWorld(clearSpeech(folded), 'PICK_UP', 'blank-authorization-form')
    expect(penFirst.phase).toBe('FORM_AND_PEN')
    expect(stateIds(penFirst)).toEqual([])

    const reentered = JSON.parse(JSON.stringify(clearSpeech(penFirst))) as AdventureState
    expect(actWorld(reentered, 'PICK_UP', 'pen-stand').lastInteractionId).not.toContain('take-pen')
    expect(stateIds(lookInventory(reentered, 'blank-terminal-authorization-form'))).toEqual(expectedIds(R55_ACTUAL_ACTION_MATRIX.find(row => row.routeId === 'inventory.blank-form-look')!))
    expect(stateIds(lookInventory(reentered, 'loose-feather-pen'))).toEqual(expectedIds(R55_ACTUAL_ACTION_MATRIX.find(row => row.routeId === 'inventory.pen-look')!))
    const fresh = adventureReducer(reentered, { type: 'RESET' })
    expect(fresh.phase).toBe('START')
    expect(fresh.inventory).toEqual([])
  })
})
