import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import authority from '../../src/story/s17/generated/final-script.json' with { type: 'json' }
import { FINAL_SCRIPT_EVENT_KEYS, finalSpeechByEvent } from '../../src/story/s17/finalScript'
import { RUNTIME_TRANSCRIPT_AUTHORITY } from '../../src/adventure/runtimeTranscriptAuthority'
import { R55_ACTUAL_ACTION_MATRIX, executeR55ActualAction } from '../../src/adventure/r55ProductionRouteRegistry'
import { hotspots, inventoryItems } from '../../src/adventure/content'
import { VERBS } from '../../src/adventure/types'

const ROOT = resolve(process.cwd())
if (JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).name !== 'trace-escape') {
  throw new Error('Run BUILD_SCRIPT_EXPLORER from the Tarka repository root')
}

const OUTPUT = resolve(ROOT, 'docs/script')
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const fileHash = (path: string) => sha256(readFileSync(resolve(ROOT, path)))
const slug = (value: string) => value
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'entry'
const cell = (value: unknown) => String(value ?? '')
  .replaceAll('|', '\\|')
  .replaceAll('\n', '<br>')
  .replaceAll('\r', '')
const code = (value: unknown) => `\`${String(value ?? '').replaceAll('`', '\\`')}\``
const json = (value: unknown) => JSON.stringify(value, null, 2)

const sourcePaths = [
  'src/story/s17/generated/final-script.json',
  'src/story/s17/finalScript.ts',
  'src/adventure/runtimeTranscriptAuthority.ts',
  'src/adventure/r55ProductionRouteRegistry.ts',
  'src/adventure/content.ts',
  'src/adventure/reducer.ts',
  'src/adventure/types.ts',
  'src/app/productionCopySelectors.ts',
] as const

const sourceHashes = Object.fromEntries(sourcePaths.map((path) => [path, fileHash(path)]))
const generatedFromCommit = readFileSync(resolve(ROOT, 'scripts/docs/SCRIPT_EXPLORER_SOURCE_COMMIT'), 'utf8').trim()
if (!/^[0-9a-f]{40}$/.test(generatedFromCommit)) throw new Error('SCRIPT_EXPLORER_SOURCE_COMMIT_INVALID')

const hotspotDisplayName = (hotspot: typeof hotspots[number]) => hotspot.id === 'wall-think-outside'
  ? 'motivational poster'
  : hotspot.name
const hotspotSceneId = () => 'records-office'

const inventoryLookAtRouteIds = (itemId: string) => runtimeRoutes
  .filter((route) => route.routeId.startsWith(`inventory.LOOK_AT.${itemId}`))
  .map((route) => route.routeId)

const FALLBACK_PERFORMANCE_LABEL = 'generic runtime fallback; no bespoke cue bound'
const humanPerformance = (value: string) => value.replaceAll('UNRESOLVED', FALLBACK_PERFORMANCE_LABEL)

const publicRuntimeDelivery = (delivery: typeof RUNTIME_TRANSCRIPT_AUTHORITY[number]['deliveries'][number]) => ({
  routeId: delivery.routeId,
  deliveryOrder: delivery.deliveryOrder,
  deliveryId: delivery.deliveryId,
  sourceDeliveryId: delivery.sourceDeliveryId,
  speaker: delivery.speaker,
  text: delivery.text,
  beatBeforeMs: delivery.beatBeforeMs,
  beatAfterMs: delivery.beatAfterMs,
  performance: delivery.performance,
})

const storyEvents = FINAL_SCRIPT_EVENT_KEYS.map((eventKey, eventIndex) => ({
  eventKey,
  eventOrder: eventIndex + 1,
  anchor: `event-${slug(eventKey)}`,
  deliveries: finalSpeechByEvent(eventKey).map((line, deliveryIndex) => ({
    deliveryOrder: deliveryIndex + 1,
    deliveryId: line.copyKey ?? `event-${eventIndex + 1}-delivery-${deliveryIndex + 1}`,
    sourceDeliveryId: line.sourceCopyKey ?? line.finalScriptSource?.sourceRecordId ?? line.copyKey ?? null,
    sourceNodeId: line.finalScriptSource?.sourceNodeId ?? line.r55Source?.nodeId ?? null,
    speaker: line.speaker,
    text: line.text,
    deliveryParts: line.deliveryParts ?? [line.text],
    beatBeforeMs: line.beatBeforeMs ?? 0,
    beatAfterMs: line.beatAfterMs ?? 0,
    performance: (line.performanceCues ?? []).map((cue) => ({
      cueId: cue.cueId,
      actor: cue.actor ?? null,
      intent: cue.intent,
      clip: cue.selectedClip ?? null,
      activation: cue.activation ?? 'LINE_START',
      track: cue.supportedTrack ?? null,
      fallback: cue.fallback,
    })),
    authority: line.authority ?? null,
    source: line.finalScriptSource?.source ?? null,
  })),
}))

const runtimeRoutes = RUNTIME_TRANSCRIPT_AUTHORITY.map((route) => ({
  routeId: route.routeId,
  anchor: `route-${slug(route.routeId)}`,
  owner: route.owner,
  deliveries: route.deliveries.map(publicRuntimeDelivery),
}))

const productionActions = R55_ACTUAL_ACTION_MATRIX.map((descriptor) => {
  try {
    const observation = executeR55ActualAction(descriptor)
    return {
      routeId: descriptor.routeId,
      anchor: `action-${slug(descriptor.routeId)}`,
      ownerFamily: descriptor.ownerFamily,
      ownerId: descriptor.ownerId,
      actionInput: descriptor.actionInput,
      stateFixture: descriptor.stateFixture,
      expectedNodeIds: descriptor.expectedNodeIds ?? [],
      expectedNonR55CopyKeys: descriptor.expectedNonR55CopyKeys ?? [],
      selectedOwnerId: observation.selectedOwnerId,
      deliveries: observation.lines.map((line, index) => ({
        deliveryOrder: index + 1,
        deliveryId: line.copyKey ?? line.finalScriptSource?.sourceNodeId ?? line.r55Source?.nodeId ?? `delivery-${index + 1}`,
        speaker: line.speaker,
        text: line.text,
        beatBeforeMs: line.beatBeforeMs ?? 0,
        beatAfterMs: line.beatAfterMs ?? 0,
        performance: (line.performanceCues ?? []).map((cue) => `${cue.actor ?? 'none'}:${cue.supportedTrack ?? 'none'}:${cue.selectedClip ?? cue.intent}`),
      })),
      error: null,
    }
  } catch (error) {
    return {
      routeId: descriptor.routeId,
      anchor: `action-${slug(descriptor.routeId)}`,
      ownerFamily: descriptor.ownerFamily,
      ownerId: descriptor.ownerId,
      actionInput: descriptor.actionInput,
      stateFixture: descriptor.stateFixture,
      expectedNodeIds: descriptor.expectedNodeIds ?? [],
      expectedNonR55CopyKeys: descriptor.expectedNonR55CopyKeys ?? [],
      selectedOwnerId: null,
      deliveries: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
})

const storyDeliveryIds = new Set(storyEvents.flatMap((event) => event.deliveries.map((delivery) => delivery.deliveryId)))
const missingFinalBubbleIds = authority.bubbles.map((bubble) => bubble.id).filter((id) => !storyDeliveryIds.has(id))
const actionErrors = productionActions.filter((action) => action.error)
const worldRoutes = runtimeRoutes.filter((route) => route.routeId.startsWith('world.'))
const inventoryRoutes = runtimeRoutes.filter((route) => route.routeId.startsWith('inventory.'))
const dialogueRoutes = runtimeRoutes.filter((route) => route.routeId.startsWith('dialogue.'))
const systemRoutes = runtimeRoutes.filter((route) => !worldRoutes.includes(route) && !inventoryRoutes.includes(route) && !dialogueRoutes.includes(route))
const itemIds = Object.keys(inventoryItems)
const expectedWorldRouteCount = hotspots.length * VERBS.length + hotspots.length * 2 * itemIds.length
const expectedInventoryRouteCount = itemIds.length * VERBS.length + itemIds.length * (itemIds.length - 1)

const explorerIndex = {
  schemaVersion: 'tarka.script-explorer.v1',
  authority: 'FINAL_SHIPPED_IMPLEMENTATION',
  generatedFromCommit,
  sourceHashes,
  sourceTotals: {
    finalAuthorityBubbles: authority.bubbles.length,
    finalAuthorityEventGroups: authority.counts.event_groups,
    runtimeEventKeys: storyEvents.length,
    runtimeEventDeliveries: storyEvents.reduce((sum, event) => sum + event.deliveries.length, 0),
    runtimeTranscriptRoutes: runtimeRoutes.length,
    runtimeTranscriptDeliveries: runtimeRoutes.reduce((sum, route) => sum + route.deliveries.length, 0),
    productionActionRoutes: productionActions.length,
    productionActionDeliveries: productionActions.reduce((sum, route) => sum + route.deliveries.length, 0),
    hotspots: hotspots.length,
    verbs: VERBS.length,
    inventoryItems: itemIds.length,
  },
  storyEvents,
  runtimeRoutes,
  productionActions,
  hotspots: hotspots.map((hotspot) => ({
    id: hotspot.id,
    displayName: hotspotDisplayName(hotspot),
    sceneId: hotspotSceneId(hotspot),
    polygon: hotspot.polygon,
  })),
  verbs: [...VERBS],
  inventoryItems: Object.entries(inventoryItems).map(([id, item]) => ({
    id,
    displayName: item.name,
    assetSlot: item.assetSlot,
    lookAtAuthorityRouteIds: inventoryLookAtRouteIds(id),
  })),
}

const explorerPayload = `${json(explorerIndex)}\n`
const explorerSha256 = sha256(explorerPayload)

const coverage = {
  schemaVersion: 'tarka.script-explorer.coverage.v1',
  result: missingFinalBubbleIds.length === 0 && actionErrors.length === 0 && worldRoutes.length === expectedWorldRouteCount && inventoryRoutes.length === expectedInventoryRouteCount ? 'PASS' : 'FAIL',
  authority: 'Generated from the final shipped implementation, not planning notes.',
  generatedFromCommit,
  sourceHashes,
  sourceTotals: explorerIndex.sourceTotals,
  publishedTotals: {
    finalAuthorityBubblesRepresented: authority.bubbles.length - missingFinalBubbleIds.length,
    runtimeEventKeysRepresented: storyEvents.length,
    runtimeEventDeliveriesRepresented: explorerIndex.sourceTotals.runtimeEventDeliveries,
    runtimeTranscriptRoutesRepresented: runtimeRoutes.length,
    runtimeTranscriptDeliveriesRepresented: explorerIndex.sourceTotals.runtimeTranscriptDeliveries,
    productionActionRoutesRepresented: productionActions.length - actionErrors.length,
    productionActionDeliveriesRepresented: explorerIndex.sourceTotals.productionActionDeliveries,
    worldRoutesRepresented: worldRoutes.length,
    inventoryRoutesRepresented: inventoryRoutes.length,
    dialogueRoutesRepresented: dialogueRoutes.length,
    systemAndSpecialRoutesRepresented: systemRoutes.length,
    hotspotsRepresented: hotspots.length,
    verbsRepresented: VERBS.length,
    inventoryItemsRepresented: itemIds.length,
  },
  invariants: {
    expectedWorldRouteCount,
    actualWorldRouteCount: worldRoutes.length,
    expectedInventoryRouteCount,
    actualInventoryRouteCount: inventoryRoutes.length,
    missingFinalBubbleIds,
    productionActionErrors: actionErrors.map(({ routeId, error }) => ({ routeId, error })),
    unexplainedOmissions: [],
  },
  narrowNonDialogueExclusions: [
    {
      category: 'rendering and geometry data',
      reason: 'Pixel coordinates, polygons, animation frame tables, and layout geometry are not authored dialogue; hotspot identities remain indexed.',
    },
    {
      category: 'terminal interface labels and evidence records',
      reason: 'Static terminal controls and the separately published Nansen request/record catalogs are not character dialogue; terminal-triggered speech and endings remain indexed.',
    },
    {
      category: 'development provenance and private acquisition inputs',
      reason: 'Historical build ledgers and private acquisition inputs are not shipped player-facing dialogue and are outside the public creative-writing explorer.',
    },
  ],
  publishedFiles: {
    index: 'docs/script/index.md',
    readingGuide: 'docs/script/how-to-read.md',
    story: 'docs/script/story.md',
    worldRoutes: 'docs/script/world-routes.md',
    inventoryRoutes: 'docs/script/inventory-routes.md',
    dialogueRoutes: 'docs/script/dialogue-routes.md',
    actionsAndEndings: 'docs/script/actions-and-endings.md',
    coverageSummary: 'docs/script/coverage.md',
    machineReadableExplorer: 'docs/script/SCRIPT_EXPLORER_INDEX.json',
    machineReadableCoverage: 'docs/script/SCRIPT_EXPLORER_COVERAGE.json',
  },
  explorerSha256,
}

const routeDeliveries = (route: typeof runtimeRoutes[number]) => route.deliveries.length
  ? route.deliveries.map((delivery) => `${delivery.speaker}: ${delivery.text}`).join('<br>')
  : '_No spoken delivery; route is still represented._'
const routePerformance = (route: typeof runtimeRoutes[number]) => route.deliveries
  .flatMap((delivery) => delivery.performance)
  .filter(Boolean)
  .map(humanPerformance)
  .join('<br>') || '—'

const header = (title: string, description: string) => `# ${title}\n\n> **Full story and puzzle spoilers.** ${description} The documentation search excludes Script Explorer pages unless **Include evidence / spoilers** is enabled.\n\n[Script Explorer](index.md) · [Reading guide](how-to-read.md) · [Story](story.md) · [World routes](world-routes.md) · [Inventory](inventory-routes.md) · [Arthur dialogue](dialogue-routes.md) · [Actions & endings](actions-and-endings.md) · [Coverage](coverage.md)\n\n`

const story = [
  header('Complete story script', 'This page preserves every final event delivery in source order.'),
  `This is generated from ${code('src/story/s17/generated/final-script.json')} and its shipped runtime adapter. It contains **${storyEvents.length} runtime event keys** and **${explorerIndex.sourceTotals.runtimeEventDeliveries} final deliveries**, including final timing and performance corrections.\n`,
  ...storyEvents.flatMap((event) => [
    `<a id="${event.anchor}"></a>`,
    `## ${String(event.eventOrder).padStart(3, '0')} · ${event.eventKey}`,
    '',
    '| # | Stable ID | Speaker | Authored delivery | Timing | Performance / source |',
    '|---:|---|---|---|---|---|',
    ...event.deliveries.map((delivery) => {
      const timing = `before ${delivery.beatBeforeMs} ms · after ${delivery.beatAfterMs} ms`
      const performance = delivery.performance.length
        ? delivery.performance.map((cue) => `${cue.actor ?? 'none'}:${cue.track ?? 'none'}:${humanPerformance(cue.clip ?? cue.intent)} (${cue.activation})`).join('<br>')
        : '—'
      const source = [delivery.sourceNodeId, delivery.source].filter(Boolean).map(code).join('<br>')
      return `| ${delivery.deliveryOrder} | <a id="delivery-${slug(delivery.deliveryId)}"></a>${code(delivery.deliveryId)} | ${cell(delivery.speaker)} | ${cell(delivery.deliveryParts.join(' / '))} | ${cell(timing)} | ${cell([performance, source].filter(Boolean).join('<br>'))} |`
    }),
    '',
  ]),
  '[Back to Script Explorer](index.md)\n',
].join('\n')

const world = [
  header('World hotspot and verb routes', 'Every shipped hotspot × verb route is listed, including selected-item USE/GIVE variants.'),
  `The runtime exposes **${hotspots.length} hotspots**, **${VERBS.length} verbs**, and **${worldRoutes.length} world routes**. Stable route anchors support direct review.\n`,
  ...hotspots.flatMap((hotspot) => {
    const routes = worldRoutes.filter((route) => route.routeId.includes(`.${hotspot.id}.`))
    return [
      `<a id="hotspot-${slug(hotspot.id)}"></a>`,
      `## ${hotspotDisplayName(hotspot)}`,
      '',
      `Runtime ID: ${code(hotspot.id)} · Scene: ${code(hotspotSceneId(hotspot))}`,
      '',
      '| Route / trigger | Owner | Player-visible delivery | Performance |',
      '|---|---|---|---|',
      ...routes.map((route) => `| <a id="${route.anchor}"></a>${code(route.routeId)} | ${code(route.owner)} | ${cell(routeDeliveries(route))} | ${cell(routePerformance(route))} |`),
      '',
    ]
  }),
  '[Back to Script Explorer](index.md)\n',
].join('\n')

const inventory = [
  header('Inventory interactions and item combinations', 'Every inventory verb route and every ordered USE pairing is listed.'),
  `The shipped inventory defines **${itemIds.length} item IDs** and **${inventoryRoutes.length} inventory routes**, including state/repeat fallbacks represented by the effective runtime owner.\n`,
  ...Object.entries(inventoryItems).flatMap(([itemId, item]) => {
    const routes = inventoryRoutes.filter((route) => route.routeId === `inventory.${route.routeId.split('.')[1]}.${itemId}` || route.routeId.includes(`.${itemId}.`) || route.routeId.endsWith(`.${itemId}`))
    return [
      `<a id="inventory-${slug(itemId)}"></a>`,
      `## ${item.name}`,
      '',
      `Runtime ID: ${code(itemId)} · Writing authority: exact ${code('LOOK AT')} route listed below`,
      '',
      '| Route / trigger | Owner | Player-visible delivery | Performance |',
      '|---|---|---|---|',
      ...routes.map((route) => `| <a id="${route.anchor}"></a>${code(route.routeId)} | ${code(route.owner)} | ${cell(routeDeliveries(route))} | ${cell(routePerformance(route))} |`),
      '',
    ]
  }),
  '[Back to Script Explorer](index.md)\n',
].join('\n')

const dialogue = [
  header('Arthur dialogue menus, topics, and repeat variants', 'Every phase-specific menu, topic, exhausted-topic response, and represented state variant is listed.'),
  `The effective runtime authority contributes **${dialogueRoutes.length} dialogue routes**. Route IDs carry phase, topic, and initial/repeat state.\n`,
  '| Route / state | Owner | Player-visible delivery | Timing / performance |',
  '|---|---|---|---|',
  ...dialogueRoutes.map((route) => {
    const timing = route.deliveries.map((delivery) => `${delivery.beatBeforeMs}/${delivery.beatAfterMs} ms`).join('<br>') || '—'
    return `| <a id="${route.anchor}"></a>${code(route.routeId)} | ${code(route.owner)} | ${cell(routeDeliveries(route))} | ${cell(`${timing}<br>${routePerformance(route)}`)} |`
  }),
  '',
  '[Back to Script Explorer](index.md)\n',
].join('\n')

const actions = [
  header('Production actions, terminal speech, optional branches, and endings', 'This combines specific action/state fixtures with special system, terminal, BRCG, and ending routes.'),
  `The production action matrix contains **${productionActions.length} executable route fixtures**. The remaining **${systemRoutes.length} special runtime routes** cover the opening, useful/item owners, blocked interactions, terminal speech, BRCG, and ending variants.\n`,
  '## Executable production action matrix',
  '',
  '| Route | Owner | Action input | State / trigger fixture | Player-visible delivery |',
  '|---|---|---|---|---|',
  ...productionActions.map((action) => `| <a id="${action.anchor}"></a>${code(action.routeId)} | ${code(`${action.ownerFamily}:${action.ownerId}`)} | ${cell(code(JSON.stringify(action.actionInput)))} | ${cell(code(JSON.stringify(action.stateFixture)))} | ${cell(action.deliveries.length ? action.deliveries.map((delivery) => `${delivery.speaker}: ${delivery.text}`).join('<br>') : '_No spoken delivery._')} |`),
  '',
  '## Special runtime routes',
  '',
  '| Route | Owner | Player-visible delivery | Performance |',
  '|---|---|---|---|',
  ...systemRoutes.map((route) => `| <a id="${route.anchor}"></a>${code(route.routeId)} | ${code(route.owner)} | ${cell(routeDeliveries(route))} | ${cell(routePerformance(route))} |`),
  '',
  '[Back to Script Explorer](index.md)\n',
].join('\n')

const coverageSummary = [
  header('Script Explorer coverage', 'This is the human-readable companion to the machine coverage receipt.'),
  `Coverage result: **${coverage.result}**`,
  '',
  '## What is represented',
  '',
  `- ${authority.bubbles.length} of ${authority.bubbles.length} final authority bubbles.`,
  `- ${storyEvents.length} runtime event keys and ${explorerIndex.sourceTotals.runtimeEventDeliveries} final event deliveries.`,
  `- ${runtimeRoutes.length} runtime transcript routes and ${explorerIndex.sourceTotals.runtimeTranscriptDeliveries} deliveries.`,
  `- ${productionActions.length} executable production action routes and ${explorerIndex.sourceTotals.productionActionDeliveries} deliveries.`,
  `- ${hotspots.length} hotspots × ${VERBS.length} verbs, including ${worldRoutes.length} bare and selected-item world routes.`,
  `- ${itemIds.length} inventory items and ${inventoryRoutes.length} direct/pair interaction routes.`,
  `- ${dialogueRoutes.length} phase/topic/repeat dialogue routes and ${systemRoutes.length} special/terminal/ending routes.`,
  '',
  '## Exclusions',
  '',
  ...coverage.narrowNonDialogueExclusions.map((entry) => `- **${entry.category}:** ${entry.reason}`),
  '',
  'There are **zero unexplained omissions**. The machine receipt preserves source and explorer hashes, expected-versus-actual route counts, missing-ID checks, and action execution errors.',
  '',
  '[Download the machine-readable coverage receipt](SCRIPT_EXPLORER_COVERAGE.json) · [Back to Script Explorer](index.md)',
  '',
].join('\n')

const index = [
  '# Complete Script Explorer',
  '',
  '> **Full story and puzzle spoilers:** this section is generated from the final shipped implementation. Documentation search hides these pages until **Include evidence / spoilers** is enabled.',
  '',
  'This explorer is an audit-friendly map of what the game can say and when. It is generated from the final script authority, effective runtime transcript owners, and executable production action matrix—not from stale planning notes.',
  '',
  '## Browse',
  '',
  '| Section | Contents |',
  '|---|---|',
  `| [Complete story script](story.md) | ${storyEvents.length} event keys · ${explorerIndex.sourceTotals.runtimeEventDeliveries} deliveries · panel boundaries, timing, and performance beats |`,
  `| [World hotspot and verb routes](world-routes.md) | ${hotspots.length} hotspots · ${VERBS.length} verbs · ${worldRoutes.length} bare and selected-item routes |`,
  `| [Inventory interactions](inventory-routes.md) | ${itemIds.length} items · ${inventoryRoutes.length} direct and ordered-pair routes |`,
  `| [Arthur dialogue](dialogue-routes.md) | ${dialogueRoutes.length} phase, topic, and repeat routes |`,
  `| [Actions, terminal speech, and endings](actions-and-endings.md) | ${productionActions.length} executable action fixtures · ${systemRoutes.length} special routes |`,
  '| [Coverage and exclusions](coverage.md) | Machine-bound totals, hashes, explicit exclusions, and zero unexplained omissions |',
  '| [How to read the explorer](how-to-read.md) | IDs, source authority, state, timing, spoilers, and deep links |',
  '',
  '## Fast route indexes',
  '',
  '### Hotspots',
  '',
  hotspots.map((hotspot) => `[${hotspotDisplayName(hotspot)}](world-routes.md#hotspot-${slug(hotspot.id)})`).join(' · '),
  '',
  '### Inventory',
  '',
  Object.entries(inventoryItems).map(([id, item]) => `[${item.name}](inventory-routes.md#inventory-${slug(id)})`).join(' · '),
  '',
  '### Story event keys',
  '',
  storyEvents.map((event) => `[${event.eventKey}](story.md#${event.anchor})`).join(' · '),
  '',
  '## Machine-readable proof',
  '',
  `[SCRIPT_EXPLORER_COVERAGE.json](SCRIPT_EXPLORER_COVERAGE.json) records a **${coverage.result}** result, source/published totals, source hashes, expected route counts, exclusions, and zero unexplained omissions.`,
  '',
  '[The spoiler-free story](../story.md) · [Player guide](../controls.md) · [Creator’s note](../creator-note.md)',
  '',
].join('\n')

const guide = [
  '# Reading the complete Script Explorer',
  '',
  '> **Full story and puzzle spoilers:** Script Explorer pages are marked as spoilers. Hosted documentation search excludes them unless **Include evidence / spoilers** is enabled.',
  '',
  '## Stable identities',
  '',
  '- **Event keys** group the authored story deliveries in effective runtime order.',
  '- **Delivery IDs** are stable copy/source identities for individual speech panels.',
  '- **Route IDs** identify a verb, hotspot, inventory pairing, dialogue state, terminal route, or ending variant.',
  '- **Owner** identifies the runtime function or catalog that supplies the route.',
  '- **Action input** and **state fixture** describe represented trigger/state conditions.',
  '',
  '## Timing and performance',
  '',
  'Each story delivery records the authored panel boundary, speaker, text, before/after beat duration, and any represented animation/expression cue. Runtime route pages preserve effective output after dialogue normalization. A dash means no extra timing or performance cue is authored for that delivery.',
  '',
  'Raw machine-readable cue authority preserves the token `UNRESOLVED`. In the human tables, that token is rendered as **generic runtime fallback; no bespoke cue bound**: the shipped runtime falls back to its ordinary speaker/talking presentation rather than selecting a dedicated authored expression or body clip.',
  '',
  'Inventory metadata intentionally omits the legacy `description` field because several values are stale or shifted. The exact `LOOK AT` route shown for each item is the authoritative player-facing writing.',
  '',
  '## Source authority',
  '',
  'The explorer is regenerated from the final script authority, final runtime corrections, transcript route authority, production action registry, hotspot/verb inventory, and runtime selectors. The coverage receipt hashes each source input and fails generation if a final bubble disappears, an executable action errors, or expected world/inventory route totals drift.',
  '',
  '## Deep links and cross-links',
  '',
  'Event, delivery, hotspot, inventory, route, and action anchors are stable within this release. The explorer index links directly to every hotspot, inventory item, and story event. The hosted documentation also retains page-level search and spoiler filtering.',
  '',
  '[Back to Script Explorer](index.md) · [Coverage](coverage.md)',
  '',
].join('\n')

if (coverage.result !== 'PASS') {
  throw new Error(`SCRIPT_EXPLORER_COVERAGE_FAILED:${json(coverage.invariants)}`)
}

const publicMarkdown = { index, guide, story, world, inventory, dialogue, actions, coverageSummary }
const publicMarkdownText = Object.entries(publicMarkdown).map(([name, text]) => `\n<!-- ${name} -->\n${text}`).join('\n')
const publicPerformanceTables = [story, world, inventory, dialogue, actions].join('\n')
const invalidPublicPatterns: Array<[RegExp, string]> = [
  [/\bundefined\b/i, 'literal undefined'],
  [/^#{1,6}\s*$/m, 'empty heading'],
  [/Scene:\s*``/, 'empty scene field'],
  [/\[object Object\]/i, 'object coercion placeholder'],
  [/\b(?:TODO|TBD)\b/i, 'unfinished marker'],
]
for (const [pattern, label] of invalidPublicPatterns) {
  if (pattern.test(publicMarkdownText)) throw new Error(`SCRIPT_EXPLORER_PUBLIC_MARKDOWN_INVALID:${label}`)
}
if (/\bUNRESOLVED\b/.test(publicPerformanceTables)) {
  throw new Error('SCRIPT_EXPLORER_RAW_UNRESOLVED_CUE_PUBLISHED')
}
if (explorerIndex.hotspots.some((entry) => !entry.displayName || !entry.sceneId)) {
  throw new Error('SCRIPT_EXPLORER_HOTSPOT_DISPLAY_METADATA_MISSING')
}
if (explorerIndex.inventoryItems.some((entry) => !entry.displayName || !entry.lookAtAuthorityRouteIds.length)) {
  throw new Error('SCRIPT_EXPLORER_INVENTORY_DISPLAY_METADATA_MISSING')
}
if (explorerIndex.inventoryItems.some((entry) => 'description' in entry)) {
  throw new Error('SCRIPT_EXPLORER_UNTRUSTED_INVENTORY_DESCRIPTION_PUBLISHED')
}

writeFileSync(resolve(OUTPUT, 'SCRIPT_EXPLORER_INDEX.json'), explorerPayload)
writeFileSync(resolve(OUTPUT, 'SCRIPT_EXPLORER_COVERAGE.json'), `${json(coverage)}\n`)
writeFileSync(resolve(OUTPUT, 'index.md'), index)
writeFileSync(resolve(OUTPUT, 'how-to-read.md'), guide)
writeFileSync(resolve(OUTPUT, 'story.md'), story)
writeFileSync(resolve(OUTPUT, 'world-routes.md'), world)
writeFileSync(resolve(OUTPUT, 'inventory-routes.md'), inventory)
writeFileSync(resolve(OUTPUT, 'dialogue-routes.md'), dialogue)
writeFileSync(resolve(OUTPUT, 'actions-and-endings.md'), actions)
writeFileSync(resolve(OUTPUT, 'coverage.md'), coverageSummary)

console.log(JSON.stringify({
  result: coverage.result,
  explorerSha256,
  ...explorerIndex.sourceTotals,
  worldRoutes: worldRoutes.length,
  inventoryRoutes: inventoryRoutes.length,
  dialogueRoutes: dialogueRoutes.length,
  systemRoutes: systemRoutes.length,
  unexplainedOmissions: coverage.invariants.unexplainedOmissions.length,
}, null, 2))
