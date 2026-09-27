import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { devToolActive } from '../../src/adventure/developmentTools'
import { createInitialAdventureState } from '../../src/adventure/reducer'
import { advanceR55, chooseR55, clipAdmitted, createR55Session, displayedText, edgesOf, predicateAllows, r55Node, r55Registry, resetR55, validEdges, type R55Input } from '../../src/story/r55/engine'
import ledger from '../../src/story/r55/generated/r55-source-ledger.json'
import performanceMap from '../../src/story/r55/generated/r55-performance-map.json'

const ARCHIVE = '/path/to/local-user/Downloads/TRACE_ESCAPE_STORY_TO_MAIN_FINAL_INTEGRATION_HANDOFF_R55_TARKA_v1.0.0_2026-09-22.zip'
const REPO = '/tmp/trace-escape-s10-p1'
const PREFIX = 'TRACE_ESCAPE_STORY_TO_MAIN_FINAL_INTEGRATION_HANDOFF_R55_TARKA_v1.0.0_2026-09-22/'
const HISTORICAL_CATALOG_REF = '190d0ec0e48853871acfb2f70f97c4e61a9f4592'
const HAS_PRIVATE_R55_SOURCE = existsSync(ARCHIVE) && existsSync(REPO)
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')

function generate(out: string, insertion = false) {
  const args = ['scripts/s12-p3/generate_r55_registry.py', '--archive', ARCHIVE, '--repo', REPO, '--out', out, '--catalog-ref', HISTORICAL_CATALOG_REF]
  if (insertion) args.push('--insertion-fixture')
  return spawnSync('python3', args, { encoding: 'utf8' })
}

function menuNamed(name: string) {
  const node = r55Registry.graph.nodes.find((item) => item.kind === 'menu' && item.anchor === name)
  if (!node) throw new Error(`missing menu ${name}`)
  return node
}

describe('S12-P3-R4 subject-aware exact R55 ledger, graph, and engine', () => {
  it.skipIf(!HAS_PRIVATE_R55_SOURCE)('authenticates every raw span and exactly reconstructs all ten executable members', () => {
    expect(generate('/tmp/s12-p3-r3-clean').status).toBe(0)
    expect(generate('/tmp/s12-p3-r3-inserted', true).status).toBe(0)
    for (const name of ['r55-registry.json', 'r55-performance-map.json', 'r55-source-ledger.json', 'r55-provenance.json']) {
      expect(readFileSync(`/tmp/s12-p3-r3-clean/${name}`)).toEqual(readFileSync(`src/story/r55/generated/${name}`))
    }
    expect(ledger.entries).toEqual(r55Registry.sourceLedger)
    expect(ledger.coverage).toMatchObject({ executableMembers: 10, rawMismatchCount: 0, exactReconstructions: 10, uncoveredBytes: 0, overlappingBytes: 0 })
    for (const partition of ledger.coverage.partitions) {
      const entries = ledger.entries.filter((entry) => entry.path === partition.path && entry.semanticClass !== 'ARCHIVE_MEMBER').sort((a, b) => a.byteStart - b.byteStart)
      const chunks: Buffer[] = []
      let cursor = 0
      for (const entry of entries) {
        const raw = Buffer.from(entry.rawText)
        expect(entry.byteStart).toBe(cursor)
        expect(raw.length).toBe(entry.byteEnd - entry.byteStart)
        expect(sha256(raw)).toBe(entry.rawSha256)
        chunks.push(raw)
        cursor = entry.byteEnd
      }
      const admitted = execFileSync('unzip', ['-p', ARCHIVE, PREFIX + partition.path])
      const rebuilt = Buffer.concat(chunks)
      expect(cursor).toBe(admitted.length)
      expect(rebuilt).toEqual(admitted)
      expect(sha256(rebuilt)).toBe(partition.memberSha256)
      const missingTail = Buffer.concat(chunks.slice(0, -1))
      expect(missingTail.length).toBeLessThan(admitted.length)
      expect(sha256(missingTail)).not.toBe(partition.memberSha256)
    }
    const before = JSON.parse(readFileSync('/tmp/s12-p3-r3-clean/r55-registry.json', 'utf8')) as typeof r55Registry
    const after = JSON.parse(readFileSync('/tmp/s12-p3-r3-inserted/r55-registry.json', 'utf8')) as typeof r55Registry
    expect(after.graph.nodes.map((node) => node.id)).toEqual(before.graph.nodes.map((node) => node.id))
  }, 30000)

  it('parses exact independent arrow chains with no false or duplicate state edges', () => {
    const stateEdges = r55Registry.graph.edges.filter((edge) => edge.kind === 'STATE_MACHINE')
    const pairs = stateEdges.map((edge) => `${r55Node(edge.source).text} -> ${r55Node(edge.target).text}`)
    expect(r55Registry.graph.stateMachine).toEqual({ authoredOccurrences: 30, uniqueEdges: 27 })
    expect(stateEdges).toHaveLength(27)
    expect(new Set(pairs).size).toBe(27)
    expect(pairs).toContain('BOOT -> TARKA_TITLE_SCREEN')
    expect(pairs).toContain('TITLE_CREDITS -> TARKA_CREDITS')
    expect(pairs).toContain('ENDING_PLAY_AGAIN -> FULL_FRESH_RESET')
    expect(pairs).not.toContain('OPENING_CUTSCENE -> TITLE_CREDITS')
    expect(pairs).not.toContain('TARKA_TITLE_SCREEN -> ENDING_MAIN_MENU')
    expect(pairs).not.toContain('TARKA_TITLE_SCREEN -> ENDING_PLAY_AGAIN')
    for (const edge of stateEdges) expect(edge.effects).toEqual([{ type: 'SET_STORY_STATE', state: r55Node(edge.target).text, once: false, sourceId: edge.source }])
  })

  it('binds every node exactly to its ledger row and resolves cue owners from leading subjects only', () => {
    const entries = new Map(ledger.entries.map((entry) => [entry.id, entry]))
    for (const node of r55Registry.graph.nodes) {
      const entry = entries.get(node.ledgerId)!
      expect(entry).toBeDefined()
      expect(node.source).toEqual(Object.fromEntries(['path', 'byteStart', 'byteEnd', 'lineStart', 'lineEnd'].map((key) => [key, entry[key]])))
      if (node.kind === 'dialogueLine' || node.kind === 'choice') expect(node.id).toBe(node.ledgerId)
      if (node.kind === 'dialogueLine') expect({ text: node.text, speaker: node.speaker }).toEqual({ text: entry.displayText, speaker: entry.speaker })
      if (node.kind === 'choice') expect(node.text).toBe(entry.displayText)
    }
    const cues = r55Registry.graph.nodes.flatMap((node) => node.cues)
    const actorFor = (sourceText: string) => cues.find((cue) => cue.sourceText === sourceText)?.actor
    expect(actorFor('He looks back at Rook.]')).toBe('arthur')
    expect(actorFor('then back at Rook.]')).toBe('arthur')
    expect(actorFor('[Rook walks to Arthur.')).toBe('rook')
    expect(actorFor('Rook turns toward Arthur,\nbarely containing himself.]')).toBe('rook')
    const first = r55Registry.graph.nodes.find((node) => node.text === '“This the Records Office?”')!
    expect(first.cues.slice(0, 3).map((cue) => cue.actor)).toEqual(['arthur', 'arthur', 'rook'])
    expect(r55Registry.cueSubjectAudit.totalCues).toBe(cues.length)
    expect(r55Registry.cueSubjectAudit.records).toHaveLength(cues.length)
  })

  it('creates only the two exact topic menus and keeps interaction labels as actions', () => {
    const menus = r55Registry.graph.nodes.filter((node) => node.kind === 'menu')
    const choices = r55Registry.graph.nodes.filter((node) => node.kind === 'choice')
    expect(menus.map((node) => node.anchor)).toEqual(['1. Silent Arthur topic menu', 'Postauthorization root menu'])
    expect(edgesOf(menuNamed('1. Silent Arthur topic menu').id).map((edge) => r55Node(edge.target).text)).toEqual([
      'WHAT IS IT YOU NEED ME TO DO AGAIN?', 'TELL ME AGAIN HOW NANSEN ACCESS HELPS US WITH OUR CASE?', 'DID YOU CATCH THE GAME THIS WEEKEND?', 'SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?', 'I’LL GET BACK TO THE FORM.',
    ])
    expect(edgesOf(menuNamed('Postauthorization root menu').id).map((edge) => r55Node(edge.target).text)).toEqual([
      'WHAT SHOULD I BE DOING RIGHT NOW?', 'TELL ME AGAIN HOW NANSEN HELPS.', 'DID YOU CATCH THE GAME THIS WEEKEND?', 'SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?', 'CAN I CALL YOU ARTHUR YET?', 'I’LL GET BACK TO THE CASE.',
    ])
    expect(choices).toHaveLength(11)
    for (const label of ['OPEN / CLOSE', 'GIVE BLANK FORM TO ARTHUR']) {
      expect(ledger.entries.some((entry) => entry.semanticClass === 'INTERACTION_ACTION' && entry.displayText === label)).toBe(true)
      expect(choices.some((node) => node.text === label)).toBe(false)
    }
  })

  it('gates exhausted topics before selection, applies ask once, chooses exact state branches, and resets', () => {
    const pre = menuNamed('1. Silent Arthur topic menu')
    const post = menuNamed('Postauthorization root menu')
    const preWeekend = edgesOf(pre.id).find((edge) => r55Node(edge.target).text === 'DID YOU CATCH THE GAME THIS WEEKEND?')!
    let session = createR55Session(pre.id, 'FORM_AVAILABLE')
    session = chooseR55(session, preWeekend)
    expect(session.askedTopics).toEqual(['WEEKEND_GAME'])
    expect(session.appliedOnceIds).toHaveLength(1)
    const preResponse = validEdges(session)[0]!
    session = chooseR55(session, preResponse)
    expect(r55Node(session.nodeId).text).toContain('Did you catch')
    session = { ...session, nodeId: post.id, revealed: true }
    const postWeekend = edgesOf(post.id).find((edge) => r55Node(edge.target).text === 'DID YOU CATCH THE GAME THIS WEEKEND?')!
    expect(predicateAllows(session, postWeekend.predicate)).toBe(false)
    expect(validEdges(session)).not.toContain(postWeekend)
    const rejected = chooseR55(session, postWeekend)
    expect(rejected.nodeId).toBe(post.id)
    expect(rejected.rejectedEdge).toBe(true)
    expect(rejected.appliedOnceIds).toHaveLength(1)
    const guidance = edgesOf(post.id).find((edge) => r55Node(edge.target).text === 'WHAT SHOULD I BE DOING RIGHT NOW?')!
    const q2 = chooseR55({ ...session, askedTopics: [], nodeId: post.id, storyState: 'Q2' }, guidance)
    const branch = validEdges(q2)
    expect(branch).toHaveLength(1)
    expect(r55Node(branch[0]!.target).anchor).toBe('Question 1 complete, Question 2 incomplete')
    const reset = resetR55(session)
    expect(reset.askedTopics).toEqual([])
    expect(reset.appliedOnceIds).toEqual([])
    expect(reset.storyState).toBe('FORM_AVAILABLE')
  })

  it('enumerates current-node edges only, rejects foreign edges, and preserves paced pointer/keyboard/touch behavior', () => {
    const boot = r55Registry.graph.nodes.find((node) => node.kind === 'system' && node.text === 'BOOT')!
    let machine = createR55Session(boot.id)
    const edge = edgesOf(boot.id)[0]!
    machine = advanceR55({ ...machine, revealed: true }, 'pointer')
    expect(r55Node(machine.nodeId).text).toBe('TARKA_TITLE_SCREEN')
    expect(machine.storyState).toBe('TARKA_TITLE_SCREEN')
    expect(machine.lastSelectedEdge?.target).toBe(edge.target)
    const foreign = r55Registry.graph.edges.find((candidate) => candidate.source !== machine.nodeId)!
    expect(chooseR55(machine, foreign)).toMatchObject({ nodeId: machine.nodeId, rejectedEdge: true })
    const starter = r55Registry.graph.nodes.find((node) => node.kind === 'dialogueLine' && node.cues.length >= 2 && edgesOf(node.id).some((candidate) => candidate.kind === 'AUTHORED_FENCE_SEQUENCE'))!
    const channels: R55Input[] = ['pointer', 'keyboard', 'touch']
    const traces = channels.map((input) => advanceR55(advanceR55(createR55Session(starter.id), input), input))
    expect(traces[0]).toEqual(traces[1])
    expect(traces[1]).toEqual(traces[2])
    expect(displayedText(traces[0]!)).toBe(starter.text)
  })

  it.skipIf(!HAS_PRIVATE_R55_SOURCE)('cross-binds every cue and the exact standalone performance projection to the catalog', () => {
    const manifest = execFileSync('git', ['show', `${HISTORICAL_CATALOG_REF}:${r55Registry.catalog.manifestPath}`], { cwd: REPO })
    expect(r55Registry.catalog.manifestBlob).toBe(createHash('sha1').update(`blob ${manifest.length}\0`).update(manifest).digest('hex'))
    const cueProjection = new Map<string, Record<string, unknown>>()
    for (const node of r55Registry.graph.nodes) for (const cue of node.cues) {
      expect(cue).toMatchObject({ manifestBlob: '593d551a792faad0020a9817369b930393d49332', selectionBlob: '9a551a3da846cd62151c17298a653e71f87bf71d', manifestSha256: r55Registry.catalog.manifestSha256, selectionSha256: r55Registry.catalog.selectionSha256 })
      expect(cue.selectedClip === null || clipAdmitted(cue.selectedClip)).toBe(true)
      const key = `${cue.actor}\0${cue.intent}\0${cue.selectedClip ?? ''}`
      cueProjection.set(key, Object.fromEntries(Object.entries(cue).filter(([field]) => !['sourceText', 'subjectResolution', 'leadingSubject'].includes(field))))
    }
    expect(performanceMap.mappings).toHaveLength(cueProjection.size)
    for (const row of performanceMap.mappings) expect(row).toEqual(cueProjection.get(`${row.actor}\0${row.intent}\0${row.selectedClip ?? ''}`))
  })

  it('stays development-only and authenticates the current production bundle', () => {
    expect(readFileSync('src/adventure/reducer.ts', 'utf8')).not.toContain('r55-registry')
    expect(readFileSync('src/adventure/content.ts', 'utf8')).not.toContain('r55-registry')
    expect(devToolActive(true, new URLSearchParams('review=1'), 'r55Review')).toBe(false)
    expect(JSON.stringify(createInitialAdventureState({ skipIntro: true }))).not.toContain('mathematically')
    const index = readFileSync('dist/index.html', 'utf8')
    const scripts = [...index.matchAll(/<script\b[^>]*\bsrc="\/(assets\/index-[^"]+\.js)"/g)].map(match => match[1]!)
    expect(scripts).toHaveLength(1)
    const bundlePath = `dist/${scripts[0]}`
    expect(existsSync(bundlePath)).toBe(true)
    const bundle = readFileSync(bundlePath)
    expect(sha256(bundle)).toMatch(/^[a-f0-9]{64}$/)
    expect(existsSync(`${bundlePath}.map`)).toBe(false)
    const text = bundle.toString()
    // The haystack line is now Principal-approved final production dialogue.
    // Keep rejecting only the development review machinery and registry UI.
    for (const forbidden of ['r55-registry', 'R55 review', 'r55Review', 'createR55Session', 'advanceR55']) expect(text).not.toContain(forbidden)
  })
})
