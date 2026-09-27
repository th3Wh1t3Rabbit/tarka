import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const projection = JSON.parse(readFileSync('src/story/r55/generated/r55-production.json', 'utf8'))
const source = Object.fromEntries([
  'app', 'src/app/App.tsx',
  'terminal', 'src/app/CaseTerminalWorkbench.tsx',
  'ending', 'src/app/S14Ending.tsx',
  'navigation', 'src/app/productionNavigation.ts',
  'investigation', 'src/investigation/state.ts',
  'adventure', 'src/adventure/reducer.ts',
  'production', 'src/story/r55/production.ts',
].reduce((rows, value, index, all) => index % 2 ? rows : [...rows, [value, readFileSync(all[index + 1], 'utf8')]], []))
const clone = value => structuredClone(value)
const fail = reason => { throw new Error(reason) }
const requireIt = (condition, reason) => { if (!condition) fail(reason) }
const allText = model => model.events.flatMap(event => event.lines.map(line => line.text)).join('\n')

function validateProjection(model) {
  requireIt(model.authority.registrySha256 === 'afb12dd571a083f577a341cf209150a0302152843171c1e7f996976843702052', 'REGISTRY_IDENTITY')
  requireIt(model.authority.a1Sha256 === 'c665ad8150efb170452d177aba9cfa63be79ee3b9774dc15d1c2ecff850cfca5', 'A1_IDENTITY')
  requireIt(model.coverage.executableCopyNodes === 590, 'COPY_NODE_COVERAGE')
  const nodes = model.events.flatMap(event => event.lines)
  requireIt(new Set(nodes.map(node => node.nodeId)).size === nodes.length, 'DUPLICATE_NODE')
  const requiredAliases = ['opening.a1_1','opening.a1_2','opening.a1_3','opening.a1_4','opening.a1_5','hero.prebrief','hero.delta_1','hero.delta_2','hero.theory_resolution','brcg.note','brcg.payoff','brcg.untested','brcg.resolved','ending.universal','ending.friendship','ending.default','ending.brcg']
  requireIt(requiredAliases.every(alias => typeof model.aliases[alias] === 'string') && Object.values(model.aliases).every(owner => model.events.some(event => event.key === owner)), 'MISSING_SEMANTIC_OWNER')
  requireIt(nodes.every(node => /^[0-9a-f]{64}$/.test(node.sourceHashes.rawSha256) && /^[0-9a-f]{64}$/.test(node.sourceHashes.displaySha256)), 'SOURCE_HASH')
  requireIt(nodes.every(node => node.source.byteEnd > node.source.byteStart && node.source.lineEnd >= node.source.lineStart), 'SOURCE_SPAN')
  requireIt(model.countSlots['{{E03_Q1_PRIOR_ACCEPTED_COUNT}}'] === 98 && model.countSlots['{{E03_Q2_PRIOR_ACCEPTED_COUNT}}'] === 3 && model.countSlots['{{E03_Q2_CURRENT_ACCEPTED_COUNT}}'] === 2, 'E03_TOKEN')
  requireIt(allText(model).includes('mathematically\nprecise haystack'), 'HAYSTACK_MISSING')
  requireIt(!allText(model).toLowerCase().includes('hieroglyph'), 'HIEROGLYPHS_REVIVED')
  requireIt(model.mission02.playable === false, 'MISSION02_PLAYABLE')
  requireIt(model.mission02.stingerText === 'CASE FILE 02...................... SEALED\n\nFUTURE ACCESS..................... PENDING', 'STINGER_CHANGED')
  requireIt(model.identity.publicTitle === 'Tarka' && model.identity.displayWordmark === 'TARKA', 'PUBLIC_TITLE')
}

const probe = (id, reason, mutation, expected) => ({ id, reason, run() { const model = clone(projection); mutation(model); try { validateProjection(model) } catch (error) { requireIt(String(error.message).includes(expected), `WRONG_REJECTION:${error.message}`); return } fail('FALSE_SUCCESS') } })
const sourceProbe = (id, reason, check) => ({ id, reason, run() { requireIt(check(), reason) } })
const firstText = fragment => projection.events.flatMap(event => event.lines).find(line => line.text.includes(fragment))

const probes = [
  probe('P01', 'A1 paraphrase rejected by exact display identity', m => { firstText('This the Records Office'); m.events.flatMap(e => e.lines).find(l => l.nodeId === firstText('This the Records Office').nodeId).sourceHashes.displaySha256 = 'x' }, 'SOURCE_HASH'),
  probe('P02', 'authored source span collapse rejected', m => { m.events[0].lines[0].source.byteEnd = m.events[0].lines[0].source.byteStart }, 'SOURCE_SPAN'),
  probe('P03', 'hieroglyphs analogy rejected', m => { m.events[0].lines[0].text += ' hieroglyphs' }, 'HIEROGLYPHS_REVIVED'),
  probe('P04', 'haystack removal rejected', m => { m.events.flatMap(e => e.lines).find(l => l.text.includes('mathematically\nprecise haystack')).text = 'missing' }, 'HAYSTACK_MISSING'),
  sourceProbe('P05', 'player-visible placeholders absent from S14 production owners', () => ![source.ending, source.production, readFileSync('src/investigation/sideLead.ts', 'utf8'), readFileSync('src/adventure/content.ts', 'utf8')].join('\n').match(/\[PLACEHOLDER|LATE-BOUND TOKEN|LATE-BOUND ADDRESS/)),
  probe('P06', 'missing semantic owner rejected', m => { delete m.aliases['ending.default'] }, 'MISSING_SEMANTIC_OWNER'),
  probe('P07', 'duplicate projected node rejected', m => { m.events[0].lines.push(clone(m.events[0].lines[0])) }, 'DUPLICATE_NODE'),
  probe('P08', 'wrong source hash rejected', m => { m.events[0].lines[0].sourceHashes.rawSha256 = '0'.repeat(64) + 'x' }, 'SOURCE_HASH'),
  probe('P09', 'unresolved E03 token rejected', m => { delete m.countSlots['{{E03_Q1_PRIOR_ACCEPTED_COUNT}}'] }, 'E03_TOKEN'),
  probe('P10', 'wrong 2/4 prior-count substitution rejected', m => { m.countSlots['{{E03_Q1_PRIOR_ACCEPTED_COUNT}}'] = 2; m.countSlots['{{E03_Q2_PRIOR_ACCEPTED_COUNT}}'] = 4 }, 'E03_TOKEN'),
  sourceProbe('P11', 'accepted S13 funnel remains six stages', () => JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/s13-runtime.json', 'utf8')).evidenceDelta.stages.map(row => row.newCount).join(',') === '98,98,74,3,2,1' && source.investigation.includes("case 'S13_VERIFY_RECORD'")),
  sourceProbe('P12', 'BRCG unlock remains COLLECT_SIDE_NOTE owned', () => source.investigation.includes("command.type === 'COLLECT_SIDE_NOTE'") && source.app.includes('piggyNoteReadState')),
  sourceProbe('P13', 'one token click cannot resolve BRCG', () => source.investigation.includes("selectedTokenId: command.tokenId") && !source.investigation.match(/SELECT_SIDE_TOKEN'[\s\S]{0,250}resolved: true/)),
  sourceProbe('P14', 'both semantic reviews are required', () => source.investigation.includes('sideLead.marketContextReviewed && sideLead.proofBoundaryReviewed')),
  sourceProbe('P15', 'BRCG commands do not write Euler proof', () => !source.investigation.match(/REVIEW_BRCG_[\s\S]{0,900}(assembly|exactEventIds|complete):/)),
  sourceProbe('P16', 'close case has point-of-no-return confirmation', () => source.terminal.includes('CLOSE THIS CASE') && source.terminal.includes('RETURN TO PROOF')),
  sourceProbe('P17', 'cancel restores close-case focus', () => source.terminal.includes('closeCaseButton.current?.focus()')),
  sourceProbe('P18', 'confirm is guarded against double commit', () => source.terminal.includes('if (closeCommitted) return')),
  sourceProbe('P19', 'ending replaces the world with a blocking scene', () => source.app.includes('if (endingStatus) return <S14EndingSequence')),
  sourceProbe('P20', 'ending variant derives from semantic resolved state', () => source.app.includes("presentedCase.sideLead.resolved ? 'RESOLVED'")),
  sourceProbe('P21', 'post-ending room freeplay is unreachable', () => source.app.includes("navigation.screen === 'COMPLETION'")),
  sourceProbe('P22', 'completion exposes exactly four side-lead labels', () => (source.production.match(/RESOLVED:|BRCG_UNRESOLVED:|NOTE_UNRESOLVED:|UNDISCOVERED:/g) ?? []).length === 4),
  sourceProbe('P23', 'print skip preserves a persistent completion screen', () => source.ending.includes("window.addEventListener('pointerdown', skip") && source.ending.includes('s14-completion-screen')),
  sourceProbe('P24', 'PLAY AGAIN routes through full persistence clearing', () => source.app.includes("clearProductionGameplayPersistence(browserStorage());") && source.navigation.includes("case 'PLAY_AGAIN'")),
  sourceProbe('P25', 'MAIN MENU returns to title', () => source.navigation.includes("case 'MAIN_MENU'") && source.navigation.includes("screen: 'TITLE'")),
  sourceProbe('P26', 'completion-opened credits retain completion caller', () => source.navigation.includes("creditsReturn: 'COMPLETION'")),
  sourceProbe('P27', 'no Continue Save Load Settings or alternate presentation controls on completion', () => !source.ending.match(/>\s*(CONTINUE|SAVE|LOAD|SETTINGS|PRESENTATION)\s*</i)),
  probe('P28', 'public TRACE title rejected', m => { m.identity.publicTitle = 'TRACE//ESCAPE' }, 'PUBLIC_TITLE'),
  probe('P29', 'playable Mission 02 rejected', m => { m.mission02.playable = true }, 'MISSION02_PLAYABLE'),
  probe('P30', 'changed static stinger rejected', m => { m.mission02.stingerText = 'COMING SOON' }, 'STINGER_CHANGED'),
  sourceProbe('P31', 'runtime provider requests absent', () => ![source.app, source.terminal, source.production].join('\n').match(/\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(/)),
  sourceProbe('P32', 'optional cue fallbacks never change story meaning', () => projection.events.every(e => e.lines.every(l => l.cues.every(c => c.changesStoryMeaning === false)))),
  sourceProbe('P33', 'R55 review harness remains DEV-only', () => source.app.includes('import.meta.env.DEV') && source.app.includes('R55ReviewHarness')),
  sourceProbe('P34', 'title route remains exactly PLAY and CREDITS', () => { const launch = readFileSync('src/app/LaunchScreen.tsx', 'utf8'); return launch.includes('aria-label="PLAY"') && (launch.match(/onClick={onCredits}/g) ?? []).length === 1 && !launch.match(/CONTINUE|SETTINGS/) }),
]

const results = []
for (const item of probes) {
  item.run()
  results.push({ id: item.id, status: 'REJECTED_FOR_INTENDED_SEMANTIC_REASON', reason: item.reason })
}
const receipt = JSON.stringify({ schemaVersion: 's14-negative-probes.v1', total: results.length, passed: results.length, results })
console.log(receipt)
console.log(`PASS_S14_NEGATIVE_PROBES total=${results.length} receiptSha256=${createHash('sha256').update(receipt).digest('hex')}`)
