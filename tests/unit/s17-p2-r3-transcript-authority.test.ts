import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditDialogueRepetition, type RepetitionAllowlistEntry } from '../../src/adventure/dialogueRepetitionAudit'
import { dialogueTopicsForState } from '../../src/adventure/content'
import { RUNTIME_TRANSCRIPT_AUTHORITY, RUNTIME_TRANSCRIPT_DELIVERIES, TRANSCRIPT_MANIFEST_POLICY, runtimeTranscriptRoute } from '../../src/adventure/runtimeTranscriptAuthority'
import { finalSpeechByEvent } from '../../src/story/s17/finalScript'

const serialize = () => JSON.stringify(RUNTIME_TRANSCRIPT_AUTHORITY.map(route => ({
  routeId: route.routeId,
  owner: route.owner,
  deliveries: route.deliveries,
})))

describe('S17-P2-R3 exact runtime transcript authority', () => {
  it('has stable, complete identities for every delivery and no duplicate route ids', () => {
    expect(new Set(RUNTIME_TRANSCRIPT_AUTHORITY.map(route => route.routeId)).size).toBe(RUNTIME_TRANSCRIPT_AUTHORITY.length)
    expect(RUNTIME_TRANSCRIPT_AUTHORITY.length).toBeGreaterThan(1_000)
    expect(RUNTIME_TRANSCRIPT_DELIVERIES.length).toBeGreaterThan(1_000)
    for (const delivery of RUNTIME_TRANSCRIPT_DELIVERIES) {
      expect(delivery.deliveryOrder).toBeGreaterThan(0)
      expect(delivery.deliveryId).not.toBe('')
      expect(delivery.sourceDeliveryId).not.toBe('')
      expect(delivery.text).not.toBe('')
      expect(delivery.sourceAuthority).toMatch(/^(FINAL_SCRIPT|R55|PRINCIPAL_|RUNTIME|FINAL_SCRIPT_RECONCILIATION|FINAL_APPROVED_FALLBACK_CONTRACT)/)
    }
    for (const route of RUNTIME_TRANSCRIPT_AUTHORITY) {
      expect(new Set(route.deliveries.map(delivery => delivery.deliveryId)).size, route.routeId).toBe(route.deliveries.length)
    }
  })

  it('pins the approved 34-delivery form route with no appended historical block', () => {
    const form = runtimeTranscriptRoute('useful.give-form')!
    expect(form.deliveries).toHaveLength(34)
    expect(form.deliveries[0]).toMatchObject({ speaker: 'MR_INDEX', text: 'Let’s see here.' })
    expect(form.deliveries.at(-1)).toMatchObject({ speaker: 'MR_INDEX', text: 'Good. Let’s see how long that lasts.' })
    for (const phrase of ['But just for TODAY.', 'Knew the dinosaurs would win you over.', 'They did not.', 'Do not snoop.', 'How much snooping counts as snooping?', 'What if I need another case file?']) {
      expect(form.deliveries.filter(line => line.text.includes(phrase)), phrase).toHaveLength(1)
    }
  })

  it('hard-limits every VHS phrase to a selected Sharknado route', () => {
    const vhsRoutes = RUNTIME_TRANSCRIPT_AUTHORITY.filter(route => route.lines.some(line => /VHS|videotape|doesn.t play them/i.test(line.text)))
    expect(vhsRoutes.map(route => route.routeId)).toEqual(TRANSCRIPT_MANIFEST_POLICY.vhsAllowedRoutes)
    for (const route of vhsRoutes) {
      const ownedPickup = route.routeId === 'useful.pickup-misc-contents'
      if (!ownedPickup) expect(route.routeId, route.lines.map(line => line.text).join(' ')).toContain('sharknado-2-vhs')
      expect(route.routeId).toMatch(/world\.USE|inventory\.(USE|LOOK_AT)|useful\.pickup-misc-contents/)
    }
  })

  it('sanitizes every effective manifest delivery and binds the COMPLETE weekend topic to final script', () => {
    const sports = runtimeTranscriptRoute('dialogue.COMPLETE.sports.initial')!
    const effectiveSports = dialogueTopicsForState({ phase: 'COMPLETE', inventory: [], exhaustedTopics: [], investigationMilestone: 'BEFORE_Q1' })
      .find(topic => topic.id === 'sports')!
    expect(sports.deliveries).toEqual([
      expect.objectContaining({
        deliveryOrder: 1,
        deliveryId: 'r55-a1e82ce440f96c2356cb',
        speaker: 'ROOK',
        text: 'Did you catch the game this weekend?',
        sourceAuthority: 'FINAL_SCRIPT:COPY.A1:4. Weekend-game topic:r55-a1e82ce440f96c2356cb',
      }),
      expect.objectContaining({
        deliveryOrder: 2,
        deliveryId: 'r55-4c490277ab0492dfa563',
        speaker: 'MR_INDEX',
        text: 'Which game?',
        sourceAuthority: 'FINAL_SCRIPT:COPY.A1:4. Weekend-game topic:r55-4c490277ab0492dfa563',
      }),
      expect.objectContaining({
        deliveryOrder: 3,
        deliveryId: 'r55-4cc09c6931dff5cb3805',
        speaker: 'ROOK',
        text: 'I was hoping you’d know.',
        sourceAuthority: 'FINAL_SCRIPT:COPY.A1:4. Weekend-game topic:r55-4cc09c6931dff5cb3805',
      }),
    ])
    expect(effectiveSports.lines.map(line => ({
      deliveryId: line.copyKey,
      sourceDeliveryId: line.sourceCopyKey ?? line.copyKey,
      speaker: line.speaker,
      text: line.text,
      sourceAuthority: line.finalScriptSource ? `FINAL_SCRIPT:${line.finalScriptSource.eventKey}:${line.finalScriptSource.sourceNodeId}` : null,
    }))).toEqual(sports.deliveries.map(delivery => ({
      deliveryId: delivery.deliveryId,
      sourceDeliveryId: delivery.sourceDeliveryId,
      speaker: delivery.speaker,
      text: delivery.text,
      sourceAuthority: delivery.sourceAuthority,
    })))

    for (const route of RUNTIME_TRANSCRIPT_AUTHORITY) for (const [index, line] of route.lines.entries()) {
      const effectiveKey = line.copyKey ?? line.finalScriptSource?.sourceNodeId ?? line.r55Source?.nodeId ?? ''
      expect(effectiveKey, `${route.routeId} delivery ${index + 1}`).not.toContain('.provisional-')
      expect(line.text, `${route.routeId} delivery ${index + 1}`).not.toMatch(/^(?:“[\s\S]*”|"[\s\S]*")$/)
    }

    const caseFiles = runtimeTranscriptRoute('useful.pickup-case-stack')!
    expect(caseFiles.lines.map(line => line.text).filter(text => /^[‘]/.test(text) || /[’]$/.test(text))).toEqual([
      '‘Notorious Ransomware Gang Claims “Dog Ate Their Decryption Key.”',
      'Responsible Breed Still Unknown and at Large.’',
      '‘The Great Break-Room Yogurt Heist:',
      '...at Deterring Stomach-Grumbling Coworkers.’',
      '‘The REAL Roswell Conspiracy:',
      'and Minimum State-Required Insurance Coverage at Time of Crash.’',
    ])

    expect(finalSpeechByEvent('COPY.BRCG:Unread Note — LOOK AT').slice(1, 10).map(line => line.text)).toEqual([
      '‘Abandon.’',
      '‘Ability.’',
      '‘Antique.’',
      '‘Bacon.’',
      '‘Voodoo.’',
      '‘Grog.’',
      '‘Carla.’',
      '‘Otis.’',
      '‘Elaine...’',
    ])

    if (process.env.S17_P2_R3_R1_EVIDENCE === '1') {
      const directory = resolve('review/s17-p2-r3-r1')
      mkdirSync(directory, { recursive: true })
      writeFileSync(resolve(directory, 'COMPLETE_WEEKEND_ROUTE_EXECUTION.json'), `${JSON.stringify({
        schema: 'tarka.s17-p2-r3-r1.route-execution.v1',
        routeId: sports.routeId,
        productionOwner: sports.owner,
        sourceEvent: 'COPY.A1:4. Weekend-game topic',
        deliveries: sports.deliveries,
        allEffectiveRouteSanitation: {
          routeCount: RUNTIME_TRANSCRIPT_AUTHORITY.length,
          deliveryCount: RUNTIME_TRANSCRIPT_DELIVERIES.length,
          provisionalKeys: 0,
          wholeLineSourceDoubleQuotes: 0,
          intentionalQuotedHeadlinesPreserved: true,
          intentionalSingleQuotedNoteContentsPreserved: true,
        },
        result: 'PASS_EXACT_FINAL_SCRIPT_BINDING_AND_GLOBAL_SANITATION',
      }, null, 2)}\n`)
    }
  })

  it('runs the permanent eight-bubble repetition detector against current owners', () => {
    expect(TRANSCRIPT_MANIFEST_POLICY.windowFloor).toBe(8)
    const effective = RUNTIME_TRANSCRIPT_AUTHORITY.filter(route => route.lines.length > 1)
    const intentionalCallbacks: RepetitionAllowlistEntry[] = [{
      routeId: 'opening.principal',
      kind: 'EXACT',
      leftLineIds: ['OPEN-045::2'],
      rightLineIds: ['OPEN-047'],
      expectedLeftText: 'The blockchain.',
      expectedRightText: 'The BLOCKCHAIN.',
      rationale: 'Arthur immediately repeats Rook’s confused term with corrective emphasis.',
    }]
    const audit = auditDialogueRepetition(effective, intentionalCallbacks)
    expect(audit.staleAllowlist).toEqual([])
    expect(audit.unallowlisted).toEqual([])
  })

  it('uses unique delivery keys rather than shared source provenance inside repetition windows', () => {
    const audit = auditDialogueRepetition([{ routeId: 'identity.guard', lines: [
      { speaker: 'ROOK', text: 'A sufficiently long repeated delivery for exact identity auditing.', copyKey: 'delivery-a', sourceCopyKey: 'shared-source' },
      { speaker: 'MR_INDEX', text: 'A separator line.', copyKey: 'separator' },
      { speaker: 'ROOK', text: 'A sufficiently long repeated delivery for exact identity auditing.', copyKey: 'delivery-b', sourceCopyKey: 'shared-source' },
    ] }])
    const exact = audit.findings.find((finding) => finding.kind === 'EXACT' && finding.left.text.startsWith('A sufficiently long'))
    expect(exact?.left.lineIds).toEqual(['delivery-a'])
    expect(exact?.right.lineIds).toEqual(['delivery-b'])
  })

  it('pins the complete manifest digest for explicit review', () => {
    const digest = createHash('sha256').update(serialize()).digest('hex')
    expect(digest).toBe('81de0c6078ba7db1913a756e1ee598ad66e95faa1677271bc1e24396910e6c26')
  })
})
