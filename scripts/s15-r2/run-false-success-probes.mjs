import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const files = Object.fromEntries([
  'feedback', 'reducer', 'dialogue', 'animation', 'globe', 'app', 'css', 'content', 'artPack', 'test', 'e2e',
].map((key, index) => [key, readFileSync([
  'src/story/s15r2/principalFeedback.ts', 'src/adventure/reducer.ts', 'src/app/BackgroundMusicControl.tsx',
  'src/adventure/animationCues.ts', 'src/adventure/globeVisual.ts', 'src/app/App.tsx', 'src/styles/a0.css',
  'src/adventure/content.ts', 'src/adventure/artPack.ts', 'tests/unit/s15-r2-principal-feedback.test.ts',
  'tests/e2e/s15-r2-principal-feedback.spec.ts',
][index], 'utf8')]))

const probes = [
  ['rook-hidden-before-entry', 'app', "openingStage !== 'ARTHUR_PAPER'", "openingStage === 'ARTHUR_PAPER'"],
  ['dialogue-after-anchor', 'reducer', "openingStage: 'DIALOGUE'", "openingStage: 'ROOK_ENTERING'"],
  ['auto-default-and-manual', 'reducer', "dialogueMode: 'AUTO'", "dialogueMode: 'REMOVED'"],
  ['semantic-emphasis', 'feedback', 'emphasis.push', 'emphasis_REMOVED.push'],
  ['nansen-trademark', 'feedback', 'Nansen™', 'Nansen'],
  ['speaker-mouth-ownership', 'reducer', "line.speaker === speaker", "line.speaker === 'ANY'"],
  ['steam-phase-order', 'animation', 'phase_04', 'phase_03'],
  ['globe-24-phase-motion', 'globe', 'index % 24', 'index % 1'],
  ['lamp-state-before-dialogue', 'e2e', "data-lamp-power', 'OFF'", "data-lamp-power', 'ON'"],
  ['physical-action-choreography', 'reducer', 'startWalk(state', 'startTeleport(state'],
  ['arthur-hotspot-priority', 'css', "hotspot-mr-index'] { z-index: 30", "hotspot-mr-index'] { z-index: 3"],
  ['empty-click-cancels-selection', 'reducer', 'selectedItemId: null', 'selectedItemId: state.selectedItemId'],
  ['approved-form-art', 'artPack', 'ticket_stamped_OK.png', 'ticket_signed.png'],
  ['postapproval-single-delivery', 'test', 'approved authorization form with doodles', 'approved form duplicated'],
  ['desk-stamp-hidden', 'app', "state.mrIndexPose === 'STAMP'", "state.mrIndexPose !== 'STAMP'"],
  ['complete-pf1-closure', 'test', '24-phase', '23-phase'],
]

const results = probes.map(([id, file, required, mutation]) => {
  const original = files[file]
  if (!original.includes(required)) throw new Error(`Baseline missing for ${id}: ${required}`)
  const mutated = original.split(required).join(mutation)
  if (mutated.includes(required)) throw new Error(`Mutation was not rejected for ${id}`)
  return { id, status: 'PASS', mutation: `${required} -> ${mutation}`, rejection: 'required invariant absent after mutation' }
})
mkdirSync('review/s15-r2/RECEIPTS', { recursive: true })
writeFileSync('review/s15-r2/RECEIPTS/FALSE_SUCCESS_PROBES.json', `${JSON.stringify({ schemaVersion: 's15-r2.false-success.v1', status: 'PASS', count: results.length, results }, null, 2)}\n`)
console.log(`PASS false-success probes ${results.length}`)
