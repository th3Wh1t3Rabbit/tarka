import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import projection from '../../src/story/r55/generated/r55-production.json'
import { R55_BRCG, R55_COMPLETION_SIDE_LEAD, R55_E03_COUNTS, R55_ENDING_BRCG, R55_ENDING_DEFAULT, R55_ENDING_UNIVERSAL, R55_MISSION_02_STINGER, R55_OPENING, R55_PRODUCTION_IDENTITY, r55Event } from '../../src/story/r55/production'
import { attachS13Runtime, buildFrozenFixture } from '../../src/investigation/fixture'
import { createInvestigationState, investigationReducer, type InvestigationState } from '../../src/investigation/state'
import type { S13Runtime } from '../../src/investigation/s13'
import { initialProductionNavigationState, productionNavigationReducer } from '../../src/app/productionNavigation'

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const fromPublic = (name: string) => JSON.parse(readFileSync(`public/scenarios/euler-2023-false-exit/${name}`, 'utf8'))
const fixture = attachS13Runtime(buildFrozenFixture(fromPublic('scenario.json'), fromPublic('evidence-graph.json')), fromPublic('s13-runtime.json') as S13Runtime)
const reduce = (state: InvestigationState, command: Parameters<typeof investigationReducer>[2]) => investigationReducer(fixture, state, command)
const sideLead = () => reduce(reduce(reduce(createInvestigationState(fixture), { type: 'EARN_ACCESS' }), { type: 'COLLECT_SIDE_NOTE' }), { type: 'SELECT_SIDE_TOKEN', tokenId: 'BRCG' })

describe('S14 R55 production binding', () => {
  it('pins the immutable archive, registry, and A1 identities', () => expect(R55_PRODUCTION_IDENTITY).toMatchObject({ archiveSha256: '8613c16b6f7df8fcae312b71237729b34eb4fd01619085c3ed0d28d336b01771', registrySha256: 'afb12dd571a083f577a341cf209150a0302152843171c1e7f996976843702052', a1Sha256: 'c665ad8150efb170452d177aba9cfa63be79ee3b9774dc15d1c2ecff850cfca5' }))
  it('projects all 590 executable copy nodes into 163 semantic events', () => expect(projection.coverage).toMatchObject({ executableCopyNodes: 590, eventGroups: 163, missing: 0, duplicateNodes: 0, unresolvedTokens: 0, playerVisibleFallbacks: 0 }))
  it('replays the self identity deterministically', () => { const copy = structuredClone(projection) as Record<string, unknown>; const expected = copy.projectionSha256; delete copy.projectionSha256; expect(sha(JSON.stringify(copy))).toBe(expected) })
  it('retains node and source identity for every projected line', () => { for (const event of projection.events) for (const line of event.lines) { expect(line.nodeId).toMatch(/^r55-/); expect(line.source.path).toMatch(/\.md$/); expect(line.source.byteEnd).toBeGreaterThan(line.source.byteStart); expect(line.sourceHashes.rawSha256).toMatch(/^[0-9a-f]{64}$/) } })
  it('retains authored line breaks and exact speaker identities', () => { const haystack = R55_OPENING.find(line => line.text.includes('mathematically'))!; expect(haystack.text).toBe('“It’s like trying\nto find a needle\n\nin a mathematically\nprecise haystack.”'); expect(haystack.speaker).toBe('MR_INDEX') })
  it('binds exact R43 arrival and pizza response', () => { expect(R55_OPENING[0]?.text).toBe('“This the Records Office?”'); expect(R55_OPENING[1]?.text).toBe('“No. It’s a pizza restaurant.”') })
  it('binds the exact Arthur and Mr. A introduction', () => expect(R55_OPENING.map(line => line.text).join('\n')).toContain('“I’m Mr. A,\nthe Archivist.\n\nMy friends\ncall me Arthur.”'))
  it('contains the haystack phrase and no hieroglyphs analogy', () => { const text = R55_OPENING.map(line => line.text).join('\n'); expect(text).toContain('mathematically\nprecise haystack'); expect(text.toLowerCase()).not.toContain('hieroglyph') })
  it('binds E03 data tokens to 98, 3, and 2', () => expect(R55_E03_COUNTS).toEqual({ q1PriorAccepted: 98, q2PriorAccepted: 3, q2CurrentAccepted: 2 }))
  it('preserves the S13 98→98, 98→3, and 3→1 summaries', () => { const runtime = fixture.s13!; expect(runtime.evidenceDelta.stages.map(row => row.newCount)).toEqual([98, 98, 74, 3, 2, 1]) })
  it('exposes all required opening, Hero, BRCG, and ending aliases once', () => expect(Object.keys(projection.aliases)).toHaveLength(17))
  it('keeps applicable cue fallback metadata non-semantic', () => { for (const event of projection.events) for (const line of event.lines) for (const cue of line.cues) expect(cue.changesStoryMeaning).toBe(false) })
  it('starts BRCG as discovered but semantically incomplete', () => expect(sideLead().sideLead).toMatchObject({ noteDiscovered: true, selectedTokenId: 'BRCG', marketContextReviewed: false, proofBoundaryReviewed: false, resolved: false }))
  it('does not resolve BRCG from a token click or one review', () => expect(reduce(sideLead(), { type: 'REVIEW_BRCG_MARKET' }).sideLead.resolved).toBe(false))
  it('resolves BRCG only after MARKET CONTEXT and WHAT THIS PROVES', () => { const market = reduce(sideLead(), { type: 'REVIEW_BRCG_MARKET' }); expect(reduce(market, { type: 'REVIEW_BRCG_PROOF' }).sideLead.resolved).toBe(true) })
  it('keeps BRCG review isolated from every Euler Hero field', () => { const before = sideLead(); const after = reduce(reduce(before, { type: 'REVIEW_BRCG_MARKET' }), { type: 'REVIEW_BRCG_PROOF' }); for (const key of ['query', 'result', 'workingTheory', 'exactEventIds', 'assembly', 'complete', 's13FilterStage'] as const) expect(after[key]).toEqual(before[key]) })
  it('binds the exact accepted BRCG snapshot and arithmetic', () => expect(R55_BRCG).toMatchObject({ contract: '0xd4c4407f3afb48d7d4ad954572f155f9237ae335', quantity: '888,888,888', snapshot: '2026-09-19T22:55:18Z', unitPrice: '$0.00000000798334585596466', theoreticalValue: '$7.09630742042783479469808', summaryValue: 'ABOUT $7.10', exactLiquidity: '$5,166.34', buyers7d: '0', sellers7d: '22', volume7d: '$13.16', netflow7d: '$13.16 OUT' }))
  it('binds the one-time world payoff sequence', () => expect(r55Event('brcg.payoff').lines).toHaveLength(9))
  it('binds one universal ending and exactly one selected final-script variant', () => { expect(R55_ENDING_UNIVERSAL).toHaveLength(40); expect(R55_ENDING_DEFAULT).toHaveLength(1); expect(R55_ENDING_BRCG).toHaveLength(6) })
  it('keeps the default ending free of the BRCG pizza beat', () => expect(R55_ENDING_DEFAULT.map(line => line.text).join(' ')).not.toContain('BRCG'))
  it('keeps Arthur’s broken-pen reply in both ending variants', () => {
    const reply = 'You broke my pen. I’d say you owe me.'
    expect(R55_ENDING_DEFAULT.map(line => line.text)).toEqual([reply])
    expect(R55_ENDING_BRCG[0]?.text).toBe(reply)
  })
  it('adds the BRCG aside only to the discovered ending', () => {
    expect(R55_ENDING_DEFAULT.map(line => line.text).join(' ')).not.toContain('And besides')
    expect(R55_ENDING_BRCG.map(line => line.text).join(' ')).toContain('And besides, you’re rolling in the dough now... with all that BRCG')
  })
  it('maps all four persistent side-lead summaries exactly', () => expect(R55_COMPLETION_SIDE_LEAD).toEqual({ RESOLVED: 'BITCOIN ROLLER COASTER GUY....... RESOLVED', BRCG_UNRESOLVED: 'BITCOIN ROLLER COASTER GUY....... UNRESOLVED', NOTE_UNRESOLVED: 'MYSTERIOUS NOTE.................. UNRESOLVED', UNDISCOVERED: 'UNDISCOVERED' }))
  it('keeps Mission 02 a static, nonplayable stinger only', () => { expect(projection.mission02.playable).toBe(false); expect(R55_MISSION_02_STINGER).toBe('CASE FILE 02...................... SEALED\n\nFUTURE ACCESS..................... PENDING'); expect(JSON.stringify(projection.events)).not.toContain('Mission 02') })
  it('returns completion-opened credits to completion', () => { const completed = productionNavigationReducer(initialProductionNavigationState, { type: 'COMPLETE', status: 'RESOLVED' }); const credits = productionNavigationReducer(completed, { type: 'OPEN_CREDITS', from: 'COMPLETION' }); expect(productionNavigationReducer(credits, { type: 'RETURN_FROM_CREDITS' }).screen).toBe('COMPLETION') })
  it('returns main menu to the title and starts the next run fresh', () => { const completed = productionNavigationReducer(initialProductionNavigationState, { type: 'COMPLETE', status: 'UNDISCOVERED' }); const menu = productionNavigationReducer(completed, { type: 'MAIN_MENU' }); expect(menu.screen).toBe('TITLE'); expect(productionNavigationReducer(menu, { type: 'PLAY' }).freshRunEpoch).toBe(1) })
  it('contains no required player-visible placeholder or obsolete public title in production owners', () => { const paths = ['src/adventure/content.ts','src/controller/content/lead-shell.ts','src/investigation/sideLead.ts','src/app/S14Ending.tsx']; const text = paths.map(path => readFileSync(path, 'utf8')).join('\n'); expect(text).not.toMatch(/\[PLACEHOLDER|LATE-BOUND TOKEN|LATE-BOUND ADDRESS/); expect(readFileSync('src/app/S14Ending.tsx','utf8')).not.toContain('TRACE//ESCAPE') })
  it('keeps runtime provider calls out of the production binding', () => expect(JSON.stringify(projection).toLowerCase()).not.toMatch(/fetch\(|xmlhttprequest|websocket|api[_-]?key/))
})
