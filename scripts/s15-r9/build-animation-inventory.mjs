import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, relative, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const outputRoot = resolve(root, 'public/art-packs/production/indexes')
mkdirSync(outputRoot, { recursive: true })

const authorityInputs = [
  'public/art-packs/production/files/production/characters/rook/ROOK_ANIMATION_USAGE_GUIDE.md',
  'public/art-packs/production/files/production/characters/rook/ROOK_FRAME_OVERLAYS.json',
  'public/art-packs/production/files/production/characters/arthur/WHICH.md',
  'public/art-packs/production/files/production/ambience/globe-life/USAGE.md',
  'public/art-packs/production/files/production/ambience/globe-life/LEVEL_RECIPE.json',
  'public/art-packs/production/indexes/ART_RUNTIME_INDEX.json',
  'public/art-packs/production/indexes/CLIP_AND_CAPABILITY_INDEX.json',
  'public/art-packs/production/indexes/LIVE_VS_STAGED_CAPABILITIES.json',
  'public/art-packs/production/indexes/SOURCE_TO_RUNTIME_PATH_MAP.json',
  'public/art-packs/production/manifest.json',
  'src/adventure/animationCues.ts',
  'src/adventure/performanceCatalog.ts',
  'src/adventure/sequenceEngine.ts',
  'src/adventure/physicalChoreography.ts',
  'src/app/characterVisual.ts',
  'src/app/renderedAnimationPolicy.ts',
  'src/story/r55/generated/r55-performance-map.json',
]

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex') }
function walk(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = resolve(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
function pngSize(bytes) {
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('not PNG')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
function familyFor(actor, rel) {
  if (actor === 'ARTHUR') return rel.split('/')[0]
  const stem = basename(rel, '.png').replace(/^rook_/, '')
  return stem.split('_').slice(0, stem.startsWith('talk_') ? 2 : 1).join('-')
}
function intendedUse(name) {
  if (/camera/.test(name)) return 'Reserved direct-to-camera performance; never auto-mirrored.'
  if (/walk/.test(name)) return 'Character locomotion with registered foot baseline.'
  if (/talk/.test(name)) return 'Speaker-owned mouth/performance frame paired only with a compatible hold.'
  if (/listen/.test(name)) return 'Listening hold or micro-loop while the other actor owns speech.'
  if (/point/.test(name)) return 'Arthur preauthorization reprimand point hold/talk family.'
  if (/document|paper|read/.test(name)) return 'Opening/form document hold, review, or item-reading performance.'
  if (/pickup/.test(name)) return 'Approved pickup contact/lift capability used only at an authored extraction contact.'
  if (/stamp/.test(name)) return 'Arthur form-stamp contact and post-stamp hold.'
  if (/push|pull|press|effort/.test(name)) return 'Force-capable pose; forbidden as a generic neutral-reach fallback.'
  if (/use_reach/.test(name)) return 'Neutral empty-hand reach/contact default.'
  if (/hold_key_item/.test(name)) return 'Euler case-file/key-item hold only.'
  return 'Approved character performance capability; use only at an authored route or script-binding seam.'
}
function consumers(name) {
  if (name === 'rook_use_reach.png') return ['ordinary PICK_UP', 'ordinary USE', 'cabinet OPEN/CLOSE/PUSH/PULL', 'lamp USE', 'globe USE/PUSH/PULL']
  if (name === 'rook_pickup_down.png' || name === 'rook_pickup_up.png') return ['miscellaneous-loot extraction contacts']
  if (name === 'rook_inspect_lean.png') return ['LOOK AT drawer contents and other empty-hand inspection']
  if (name === 'rook_hold_key_item.png') return ['Euler case-file collection']
  if (name === 'rook_give_offer.png') return ['signed-form handoff']
  if (name.startsWith('archivist_gesture_point')) return ['cabinet preauthorization reprimand', 'terminal preauthorization reprimand']
  if (name.startsWith('archivist_document_')) return ['opening paper read', 'form review']
  if (name.startsWith('archivist_stamp_')) return ['form approval stamp']
  if (/talk_neutral|archivist_talk_open|archivist_listening/.test(name)) return ['opening dialogue', 'TALK TO Arthur topics', 'scripted character exchanges']
  if (/walk_/.test(name)) return ['Rook room locomotion']
  return []
}
function guidance(name) {
  const talking = /talk|open_emphasis/.test(name)
  const hold = /idle|neutral|listen|hold|ready|closed|point\.png|slouch\.png/.test(name)
  return {
    entry: /enter|ready|down|contact|action/.test(name) ? 'AUTHORED_ENTRY_OR_CONTACT' : 'DIRECT_OR_FAMILY_DEFINED',
    loop: talking || /blink|breath|walk/.test(name) ? 'ONLY_WITH_COMPATIBLE_FAMILY_RECIPE' : 'DO_NOT_LOOP_BY_DEFAULT',
    hold: hold ? 'VALID_HOLD' : 'TRANSIENT_UNLESS_ROUTE_SAYS_HOLD',
    exit: /exit|up|lift|result/.test(name) ? 'AUTHORED_EXIT_OR_RESULT' : 'RETURN_TO_ROUTE_HOLD',
  }
}

const activeSources = ['src/adventure/animationCues.ts', 'src/app/App.tsx', 'src/app/characterVisual.ts', 'src/adventure/physicalChoreography.ts', 'public/art-packs/production/manifest.json']
  .map(path => readFileSync(resolve(root, path), 'utf8')).join('\n')
function exactRuntimeReferences(source) {
  const constants = new Map([...source.matchAll(/const\s+(\w+)\s*=\s*['"]([^'"]+)['"]/g)].map(match => [match[1], match[2]]))
  const references = new Set([...source.matchAll(/['"`](\/art-packs\/production\/files\/[^'"`]+?\.png)['"`]/g)].map(match => match[1]))
  for (const match of source.matchAll(/\$\{(\w+)\}\/([^`]+?\.png)/g)) {
    const base = constants.get(match[1])
    if (base) references.add(`${base}/${match[2]}`)
  }
  return references
}
const exactLiveReferences = exactRuntimeReferences(activeSources)

const roots = {
  ROOK: resolve(root, 'public/art-packs/production/files/production/characters/rook'),
  ARTHUR: resolve(root, 'public/art-packs/production/files/production/characters/arthur'),
}
const frames = Object.entries(roots).flatMap(([actor, directory]) => walk(directory).filter(path => path.endsWith('.png')).sort().map(path => {
  const bytes = readFileSync(path)
  const rel = relative(directory, path).split(sep).join('/')
  const name = basename(path)
  const runtimePath = `/art-packs/production/files/production/characters/${actor.toLowerCase()}/${rel}`
  const force = /effort|use_press|use_pull|pull_action|push_action/.test(name)
  const liveReference = exactLiveReferences.has(runtimePath) && !force
  const routeConsumers = consumers(name)
  const camera = name.includes('camera_')
  const disposition = force ? 'DO_NOT_USE_OR_SUPERSEDED' : liveReference || routeConsumers.length ? 'LIVE_REQUIRED_NOW' : /pickup|present|camera|slouch|smile|questioning|read_document|listening/.test(name) ? 'RESERVED_FOR_SCRIPT_BINDING' : 'OPTIONAL_POST_SUBMISSION'
  return {
    actor,
    relativePath: rel,
    runtimePath,
    family: familyFor(actor, rel),
    sha256: sha256(bytes),
    runtimeIdentity: `sha256:${sha256(bytes)}`,
    ...pngSize(bytes),
    authoritySource: actor === 'ROOK' ? 'ROOK_ANIMATION_USAGE_GUIDE.md + ROOK_FRAME_OVERLAYS.json' : 'WHICH.md + family checkpoint metadata',
    intendedUse: intendedUse(name),
    guidance: guidance(name),
    talkingCompatibility: /talk|open_emphasis/.test(name) ? 'SPEAKER_OWNED_ONLY' : 'NON_TALKING_OR_FAMILY_HOLD',
    listeningCompatibility: /talk|open_emphasis/.test(name) ? 'NOT_WHILE_OTHER_ACTOR_SPEAKS' : 'ALLOWED_IF_ROUTE_AND_FACING_MATCH',
    mirroringRule: camera ? 'CAMERA_FIXED_NEVER_MIRROR' : actor === 'ARTHUR' ? 'NATIVE_LEFT_MIRROR_FOR_SCREEN_RIGHT' : 'NATIVE_RIGHT_MIRROR_FOR_SCREEN_LEFT',
    currentLiveOwner: liveReference ? 'production renderer / animationClips' : null,
    currentRouteConsumers: routeConsumers,
    disposition,
  }
}))

const inputReceipts = authorityInputs.map(path => {
  const bytes = readFileSync(resolve(root, path))
  return { path, bytes: bytes.length, sha256: sha256(bytes) }
})
const inventory = {
  schema: 'tarka.s15-r10.approved-animation-capability-inventory.v1',
  basisCommit: '186ecc91e5cd6d6375d81ce6fa5fd013b3ca3d2f',
  ownershipIdentity: 'EXACT_NORMALIZED_RUNTIME_PATH',
  authorityInputs: inputReceipts,
  counts: { rook: frames.filter(frame => frame.actor === 'ROOK').length, arthur: frames.filter(frame => frame.actor === 'ARTHUR').length, total: frames.length },
  allowedDispositions: ['LIVE_REQUIRED_NOW', 'RESERVED_FOR_SCRIPT_BINDING', 'OPTIONAL_POST_SUBMISSION', 'DO_NOT_USE_OR_SUPERSEDED'],
  duplicateOrSupersededFamilies: ['generic rook.use mixing neutral reach with effort/press', 'effort variants as generic fallbacks', 'pre-cleanup Arthur paperwork alternate', 'Arthur pickup/present continuity alternates excluded by WHICH.md'],
  frames,
  runtimeFamilies: [
    { id: 'mug.steam', owner: 'src/adventure/animationCues.ts#mugSteamFrame', consumer: 'src/app/App.tsx#PublishedLayoutArt', disposition: 'LIVE_REQUIRED_NOW', paths: [...exactLiveReferences].filter(path => path.includes('/ambience/mug-steam/frames/mug_steam_')).sort() },
    { id: 'drawer.official.filed.02', owner: 'src/app/cabinetTransitionPolicy.ts#cabinetTransitionPlan', consumer: 'src/app/App.tsx#useTransitionFrame', disposition: 'LIVE_REQUIRED_NOW', paths: Array.from({ length: 6 }, (_, index) => `/art-packs/production/files/production/furniture/cabinet-contents/frames/cabinet_open__drawer_02_filed_phase_${String(index + 1).padStart(2, '0')}.png`) },
    { id: 'drawer.misc.04', owner: 'src/app/cabinetTransitionPolicy.ts#cabinetTransitionPlan', consumer: 'src/app/App.tsx#useTransitionFrame', disposition: 'LIVE_REQUIRED_NOW', paths: Array.from({ length: 6 }, (_, index) => `/art-packs/production/files/production/furniture/lower-drawers/drawer-04/frames/cabinet_open__drawer_04_phase_${String(index + 1).padStart(2, '0')}.png`) },
  ],
}
writeFileSync(resolve(outputRoot, 'APPROVED_ANIMATION_CAPABILITY_INVENTORY.json'), `${JSON.stringify(inventory, null, 2)}\n`)

const neutralRoutes = [
  ['take-form','PICK_UP','blank-authorization-form'], ['take-pen','PICK_UP','pen-stand'], ['take-form-2','PICK_UP','blank-authorization-form'], ['take-pen-2','PICK_UP','pen-stand'],
  ['open-case-drawer','OPEN','official-case-file-cabinet'], ['pull-case-drawer','PULL','official-case-file-cabinet'], ['close-case-drawer','CLOSE','official-case-file-cabinet'], ['push-case-drawer','PUSH','official-case-file-cabinet'], ['use-case-drawer-open','USE','official-case-file-cabinet'], ['use-case-drawer-shut','USE','official-case-file-cabinet'],
  ['open-misc-drawer','OPEN','miscellaneous-drawer-cabinet'], ['pull-misc-drawer','PULL','miscellaneous-drawer-cabinet'], ['close-misc-drawer','CLOSE','miscellaneous-drawer-cabinet'], ['push-misc-drawer','PUSH','miscellaneous-drawer-cabinet'], ['use-misc-drawer-open','USE','miscellaneous-drawer-cabinet'], ['use-misc-drawer-shut','USE','miscellaneous-drawer-cabinet'],
  ['dynamic.lamp.use','USE','desk-lamp'], ['dynamic.globe.use','USE','office-globe'], ['dynamic.globe.push','PUSH','office-globe'], ['dynamic.globe.pull','PULL','office-globe'],
]
const terminalRefusalRoutes = ['reprimand-start', 'reprimand-form-held', 'reprimand-pen-held', 'reprimand-form-and-pen', 'reprimand-form-completed', 'reprimand-form-submitted']
const rows = [
  ...neutralRoutes.map(([routeId, verb, target]) => ({ routeId, routeKind: 'PHYSICAL', verb, target, poseClass: 'EMPTY_HAND_REACH', clipId: 'rook.reach.neutral', frameFamily: 'rook_use_reach.png only', facingRule: 'face object', contactRule: 'mutation at named semantic contact', disposition: 'LIVE_REQUIRED_NOW' })),
  ...terminalRefusalRoutes.map(routeId => ({ routeId, routeKind: 'PHYSICAL_REFUSAL', verb: 'USE', target: 'nansen-terminal', poseClass: 'POINT_HOLD', clipId: 'arthur.point', frameFamily: 'pointing-v0.1.3', facingRule: 'Arthur RIGHT mirrored; Rook LEFT', contactRule: 'preauthorization block; no object mutation', disposition: 'LIVE_REQUIRED_NOW' })),
  { routeId: 'give-form', routeKind: 'PHYSICAL', verb: 'GIVE', target: 'mr-index', poseClass: 'PAPER_REACH', clipId: 'rook.give', frameFamily: 'rook_give_offer.png', facingRule: 'mutual character facing', contactRule: 'handoff/stamp/return contacts', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'pickup-case-stack', routeKind: 'PHYSICAL', verb: 'PICK_UP', target: 'disorderly-stack-of-confidential-files', poseClass: 'EMPTY_HAND_REACH', clipId: 'rook.drawer-extract', frameFamily: 'rook_pickup_down.png → rook_pickup_up.png', facingRule: 'face cabinet item', contactRule: 'Euler collect contact; return to neutral before dialogue', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'pickup-misc-contents', routeKind: 'PHYSICAL', verb: 'PICK_UP', target: 'miscellaneous-catch-all-contents', poseClass: 'EMPTY_HAND_REACH', clipId: 'rook.drawer-extract', frameFamily: 'rook_pickup_down.png → rook_pickup_up.png', facingRule: 'face drawer contents', contactRule: 'restart only at each authored extraction contact; return to neutral before dialogue', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'look-drawer-contents', routeKind: 'OBSERVATION', verb: 'LOOK_AT', target: 'drawer contents', poseClass: 'NO_REACH', clipId: 'rook.inspect-lean', frameFamily: 'rook_inspect_lean.png only', facingRule: 'face drawer contents', contactRule: 'no held-item or reach frame', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'opening-paper', routeKind: 'SEAM', verb: '', target: 'Arthur', poseClass: 'DOCUMENT_REVIEW', clipId: 'arthur.document', frameFamily: 'paperwork-v0.1.4', facingRule: 'native left; mirror only for screen-right', contactRule: 'closed frame until Arthur speech', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'cabinet-reprimand', routeKind: 'SEAM', verb: 'OPEN/USE/PULL', target: 'cabinet', poseClass: 'POINT_HOLD', clipId: 'arthur.point', frameFamily: 'pointing-v0.1.3', facingRule: 'Arthur RIGHT mirrored; Rook LEFT', contactRule: 'hold entire exchange; release once', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'terminal-reprimand', routeKind: 'SEAM', verb: 'USE', target: 'nansen-terminal', poseClass: 'POINT_HOLD', clipId: 'arthur.point', frameFamily: 'pointing-v0.1.3', facingRule: 'Arthur RIGHT mirrored; Rook LEFT', contactRule: 'hold entire exchange; release once', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'arthur-topics', routeKind: 'SEAM', verb: 'TALK_TO', target: 'Arthur', poseClass: 'TALK_LISTEN', clipId: 'arthur.talk / rook.talk', frameFamily: 'conversation families', facingRule: 'mutual for full exchange', contactRule: 'speaker-owned mouth', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'form-review', routeKind: 'SEAM', verb: 'GIVE', target: 'Arthur', poseClass: 'DOCUMENT_REVIEW', clipId: 'arthur.document / arthur.stamp', frameFamily: 'paperwork + stamp', facingRule: 'mutual character facing', contactRule: 'handoff/stamp/return', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'terminal-entry', routeKind: 'SEAM', verb: 'USE', target: 'nansen-terminal', poseClass: 'EMPTY_HAND_REACH', clipId: 'rook.reach.neutral', frameFamily: 'neutral reach', facingRule: 'face terminal', contactRule: 'only after approved-return receipt', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'ending', routeKind: 'SEAM', verb: '', target: 'ending', poseClass: 'TALK_LISTEN', clipId: 'authored performance or ordinary talk', frameFamily: 'conversation families', facingRule: 'mutual when both characters participate', contactRule: 'speaker-owned mouth', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'completion', routeKind: 'SEAM', verb: '', target: 'completion', poseClass: 'IDLE', clipId: 'idle families', frameFamily: 'idle', facingRule: 'route-authored; camera clips fixed', contactRule: 'no implicit force pose', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'ambient-mug-steam', routeKind: 'AMBIENT', verb: '', target: 'coffee-mug', poseClass: 'AMBIENT_LOOP', clipId: 'mug.steam', frameFamily: 'mug-steam exact paths', facingRule: 'not applicable', contactRule: 'live room timer', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'official-drawer-02-filed-transition', routeKind: 'PROP_TRANSITION', verb: 'OPEN/CLOSE', target: 'official-case-file-cabinet', poseClass: 'PROP', clipId: 'drawer.official.filed.02', frameFamily: 'drawer-02 filed exact paths', facingRule: 'not applicable', contactRule: 'files remain visible before and after Euler extraction', disposition: 'LIVE_REQUIRED_NOW' },
  { routeId: 'misc-drawer-04-transition', routeKind: 'PROP_TRANSITION', verb: 'OPEN/CLOSE', target: 'miscellaneous-drawer-cabinet', poseClass: 'PROP', clipId: 'drawer.misc.04', frameFamily: 'drawer-04 exact paths', facingRule: 'not applicable', contactRule: 'select from actual source visual', disposition: 'LIVE_REQUIRED_NOW' },
]
const columns = ['routeId','routeKind','verb','target','poseClass','clipId','frameFamily','facingRule','contactRule','disposition']
const csv = [columns.join(','), ...rows.map(row => columns.map(column => `"${String(row[column] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n')
writeFileSync(resolve(outputRoot, 'PRODUCTION_ROUTE_TO_ANIMATION_MATRIX.csv'), `${csv}\n`)

const clipIndexPath = resolve(outputRoot, 'CLIP_AND_CAPABILITY_INDEX.json')
const clipIndex = JSON.parse(readFileSync(clipIndexPath, 'utf8'))
clipIndex.schema = 'tarka.production.clip-capability-index.v3'
clipIndex.ownershipIdentity = 'EXACT_NORMALIZED_RUNTIME_PATH'
clipIndex.liveRuntimeFamilies = inventory.runtimeFamilies.map(({ id, owner, consumer, paths }) => ({ id, owner, consumer, paths }))
clipIndex.globe.sameDirectionAfterFinalHold = 'fresh level 1 from exact held angle'
clipIndex.globe.promotionAndReverseContinuity = 'angular phase plus fractional dwell progress mapped to destination sharp entry'
writeFileSync(clipIndexPath, `${JSON.stringify(clipIndex, null, 2)}\n`)

const stagedPath = resolve(outputRoot, 'LIVE_VS_STAGED_CAPABILITIES.json')
const staged = JSON.parse(readFileSync(stagedPath, 'utf8'))
staged.schema = 'tarka.production.live-vs-staged-capabilities.v3'
staged.ownershipIdentity = 'EXACT_NORMALIZED_RUNTIME_PATH'
staged.live = staged.live.filter(entry => !entry.startsWith('globe three-level') && !entry.startsWith('cabinet drawer state') && !entry.startsWith('mug steam plus'))
staged.live.push('globe three-level finite schedules with exact cursor, held-angle L1 restart, and fractional-dwell promotion/reversal continuity')
staged.live.push('mug steam plus official filed drawer-02 and miscellaneous bottom drawer-04 transition families, each with exact path owner and live consumer')
staged.optionalPostSubmission = staged.optionalPostSubmission.filter(entry => entry !== 'mug steam sequences' && entry !== 'drawer travel frames and exposure-mask animation' && entry !== 'unused drawer exposure masks, layer helpers, and unrouted drawer families')
staged.optionalPostSubmission.push('unused drawer exposure masks, layer helpers, and unrouted drawer families')
staged.liveRuntimeFamilyIds = inventory.runtimeFamilies.map(family => family.id)
writeFileSync(stagedPath, `${JSON.stringify(staged, null, 2)}\n`)

if (inventory.counts.rook === 0 || inventory.counts.arthur === 0 || inventory.counts.total !== inventory.counts.rook + inventory.counts.arthur) throw new Error(`unexpected character frame counts: ${JSON.stringify(inventory.counts)}`)
if (new Set(frames.map(frame => frame.relativePath + ':' + frame.actor)).size !== frames.length) throw new Error('duplicate actor/path inventory row')
const duplicateIdle = frames.filter(frame => frame.actor === 'ARTHUR' && frame.relativePath.endsWith('/archivist_idle_a.png'))
if (duplicateIdle.length < 2 || duplicateIdle.filter(frame => frame.currentLiveOwner).length !== 1) throw new Error('path-exact duplicate basename ownership failed')
if (inventory.runtimeFamilies.some(family => family.paths.length === 0)) throw new Error('live runtime family without exact paths')
if (rows.length < 30) throw new Error(`route matrix is incomplete: ${rows.length}`)
console.log(`PASS_S15_R9_ANIMATION_INVENTORY rook=${inventory.counts.rook} arthur=${inventory.counts.arthur} inputs=${inputReceipts.length} routes=${rows.length}`)
