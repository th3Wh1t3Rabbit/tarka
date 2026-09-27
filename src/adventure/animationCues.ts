import { dialogueTopicsForState, itemRules, usefulRules } from './content'
import type { LayoutStore } from './sceneComposition'
import { FINAL_SCRIPT_LINES } from '../story/s17/finalScript'

export const CUE_SHEET_KEY = 'trace-escape.animation-cues.v1'

// Runtime continuity locks. The broad /rook/frames directory and Arthur's
// later conversation cleanup contain individually useful art, but the two
// directories mix different contour passes. These explicit families were
// approved as coherent sets and are the only source for neutral life, speech
// and walking in the live game.
const ROOK_CLEAN = '/art-packs/production/files/production/characters/rook/latest-clean-v0.1.14/frames'
// These are the two deliberately admitted pre-cleanup exceptions. They are
// sparse authored actions, never the source for neutral life, speech or walk.
const ROOK_LEGACY_EXCEPTIONS = '/art-packs/production/files/production/characters/rook/frames'
const ARTHUR = '/art-packs/production/files/production/characters/arthur/coherent-core-v1.0.0/frames'
const ARTHUR_GLASSES = '/art-packs/production/files/production/characters/arthur/continuity-glasses-v0.1.5/frames'
const ARTHUR_CAMERA = '/art-packs/production/files/production/characters/arthur/continuity-camera-v0.1.0/frames'
const ARTHUR_POINT = '/art-packs/production/files/production/characters/arthur/pointing-v0.1.3/frames'
const ARTHUR_SLOUCH = '/art-packs/production/files/production/characters/arthur/slouch-v0.1.3/frames'
const STAMP = '/art-packs/production/files/production/characters/arthur/stamp-v0.1.1/frames'
const PAPER = '/art-packs/production/files/production/characters/arthur/paperwork-coherent-v0.1.2/frames'
const PICKUP = '/art-packs/production/files/production/characters/arthur/pickup-v0.1.1/frames'
const MUG = '/art-packs/production/files/production/ambience/mug-steam/frames'
const GLOBE = '/art-packs/production/files/production/ambience/globe-life/frames'

export type CueMode = 'LOOP' | 'ONCE' | 'HOLD'
export type AnimationCategory = 'Idle & life' | 'Speech & listening' | 'Movement' | 'Actions & handoffs' | 'Props & paperwork' | 'Reactions & camera' | 'Environment'

export interface AnimationClip {
  id: string
  actorId: string
  label: string
  frames: string[]
  width: number
  height: number
  defaultFps: number
  category: AnimationCategory
  intendedUse: string
  frameLabels: string[]
  /** Optional authored per-cel timing for finite reactions. */
  frameDurationsMs?: number[]
}

export interface AnimationCue {
  momentId: string
  actorId: string
  clipId: string
  fps: number
  holdMs: number
  mode: CueMode
  beatBeforeMs?: number
  beatAfterMs?: number
  note?: string
}

export interface CueSheet {
  cues: AnimationCue[]
}

export interface SavedCueVersion {
  id: string
  name: string
  savedAt: string
  sheet: CueSheet
}

export interface CueLibrary {
  versions: SavedCueVersion[]
  defaultVersionId: string | null
}

export interface CueMoment {
  id: string
  group: 'Life' | 'Interactions' | 'Dialogue' | 'Script'
  label: string
  detail: string
  speaker?: string
  text?: string
  eventKey?: string
}

export interface GameCueInput {
  walking: boolean
  speechReturn: string | null
  lineIndex: number
  lastInteractionId: string | null
  deliveryKey?: string | null
}

function categoryFor(id: string, actorId: string): AnimationCategory {
  if (actorId === 'mug' || actorId === 'globe') return 'Environment'
  if (id.includes('walk')) return 'Movement'
  if (id.includes('document') || id.includes('paper') || id.includes('stamp') || id.includes('case-file')) return 'Props & paperwork'
  if (id.includes('camera') || id.includes('point') || id.includes('glasses') || id.includes('sardonic') || id.includes('slouch') || id.includes('present') || id.includes('confused') || id.includes('startled') || id.includes('surprised') || id.includes('embarrassed') || id.includes('proud') || id.includes('arms-crossed')) return 'Reactions & camera'
  if (id.includes('talk') || id.includes('listen') || id.includes('explain') || id.includes('think')) return 'Speech & listening'
  if (id.includes('reach') || id.includes('inspect') || id.includes('drawer') || id.includes('give') || id.includes('receive')) return 'Actions & handoffs'
  return 'Idle & life'
}

function frameLabel(path: string, index: number) {
  const file = path.split('/').at(-1)?.replace(/\.png$/, '').replace(/^(rook_|archivist_)/, '').replaceAll('_', ' ') ?? `frame ${index + 1}`
  return `${index + 1}. ${file}`
}

function clip(id: string, actorId: string, label: string, frames: string[], width: number, height: number, defaultFps: number, intendedUse = '', frameDurationsMs?: number[]): AnimationClip {
  const category = categoryFor(id, actorId)
  return { id, actorId, label, frames, width, height, defaultFps, category, intendedUse: intendedUse || `${category} sequence`, frameLabels: frames.map(frameLabel), ...(frameDurationsMs ? { frameDurationsMs } : {}) }
}

export function animationClips(): AnimationClip[] {
  return [
    clip('rook.idle.breath', 'rook', 'Idle breath', [`${ROOK_CLEAN}/rook_idle_neutral_a.png`, `${ROOK_CLEAN}/rook_idle_neutral_b.png`, `${ROOK_CLEAN}/rook_idle_neutral_a.png`], 48, 88, 0.57),
    clip('rook.blink', 'rook', 'Blink', [`${ROOK_CLEAN}/rook_idle_neutral_a.png`, `${ROOK_CLEAN}/rook_idle_blink.png`, `${ROOK_CLEAN}/rook_idle_neutral_a.png`], 48, 88, 8),
    clip('rook.posture', 'rook', 'Posture adjust', [`${ROOK_CLEAN}/rook_idle_posture_adjust.png`, `${ROOK_CLEAN}/rook_idle_neutral_a.png`], 48, 88, 2),
    clip('rook.arms-crossed', 'rook', 'Arms crossed', [`${ROOK_CLEAN}/rook_annoyed_arms_crossed.png`], 48, 88, 1),
    clip('rook.idle.still', 'rook', 'Idle still', [`${ROOK_CLEAN}/rook_idle_neutral_a.png`], 48, 88, 1),
    clip('rook.talk', 'rook', 'Talk', [`${ROOK_CLEAN}/rook_talk_neutral_closed.png`, `${ROOK_CLEAN}/rook_talk_neutral_open.png`], 48, 88, 8),
    clip('rook.talk.think', 'rook', 'Talk thinking — chin held', [`${ROOK_CLEAN}/rook_thinking_chin.png`, `${ROOK_CLEAN}/rook_talk_thinking.png`], 48, 88, 8, 'Standard closed/open mouth cycle while the hand remains at the chin.'),
    clip('rook.thinking-delivery', 'rook', 'Thinking delivery — finite', [`${ROOK_CLEAN}/rook_thinking_chin.png`, `${ROOK_CLEAN}/rook_talk_thinking.png`, `${ROOK_CLEAN}/rook_thinking_chin.png`, `${ROOK_CLEAN}/rook_talk_thinking.png`, `${ROOK_CLEAN}/rook_thinking_chin.png`], 48, 88, 8, 'One restrained chin-held delivery. It closes the mouth before yielding to the next line and never loops.', [260, 170, 150, 190, 520]),
    clip('rook.proud-delivery', 'rook', 'Proud delivery — finite', [`${ROOK_CLEAN}/rook_proud_pose.png`, `${ROOK_CLEAN}/rook_talk_proud_pose.png`, `${ROOK_CLEAN}/rook_proud_pose.png`, `${ROOK_CLEAN}/rook_talk_proud_pose.png`, `${ROOK_CLEAN}/rook_proud_pose.png`], 48, 88, 8, 'A single confident boast with two mouth openings, then a closed-mouth hold.', [260, 150, 130, 180, 620]),
    clip('rook.emphasis-delivery', 'rook', 'One-hand emphasis — finite', [`${ROOK_CLEAN}/rook_talk_emphasis_closed.png`, `${ROOK_CLEAN}/rook_talk_emphasis_open.png`, `${ROOK_CLEAN}/rook_talk_emphasis_closed.png`, `${ROOK_CLEAN}/rook_talk_emphasis_open.png`, `${ROOK_CLEAN}/rook_talk_emphasis_closed.png`], 48, 88, 8, 'A restrained one-hand speaking gesture for an important explanation. Use once within a longer exchange, finish closed, and do not restart it on adjacent bubbles.', [240, 160, 140, 180, 520]),
    clip('rook.case-cracked-delivery', 'rook', 'Case cracked — triumphant delivery', [`${ROOK_CLEAN}/rook_proud_pose.png`, `${ROOK_CLEAN}/rook_talk_proud_pose.png`, `${ROOK_CLEAN}/rook_triumphant_point.png`, `${ROOK_CLEAN}/rook_talk_triumphant_point.png`, `${ROOK_CLEAN}/rook_triumphant_point.png`], 48, 88, 8, 'The earned success accent: gather proudly, extend the hand into a triumphant point, articulate once more, then hold the clean ending pose. One shot only.', [300, 160, 200, 180, 850]),
    clip('rook.pizza-invite-delivery', 'rook', 'Open-hand pizza invitation — finite', [`${ROOK_CLEAN}/rook_questioning_shrug.png`, `${ROOK_CLEAN}/rook_talk_shrug.png`, `${ROOK_CLEAN}/rook_questioning_shrug.png`, `${ROOK_CLEAN}/rook_talk_shrug.png`, `${ROOK_CLEAN}/rook_questioning_shrug.png`], 48, 88, 8, 'Rook opens his hands toward Arthur while making the invitation, speaks through two restrained mouth openings, then holds the offer without looping.', [260, 160, 160, 180, 700]),
    clip('rook.shrug-delivery', 'rook', 'Questioning shrug — finite', [`${ROOK_CLEAN}/rook_questioning_shrug.png`, `${ROOK_CLEAN}/rook_talk_shrug.png`, `${ROOK_CLEAN}/rook_questioning_shrug.png`, `${ROOK_CLEAN}/rook_talk_shrug.png`, `${ROOK_CLEAN}/rook_questioning_shrug.png`], 48, 88, 8, 'A single spoken shrug for a doubtful suggestion. It resolves closed and does not repeat.', [240, 160, 140, 180, 560]),
    clip('rook.embarrassed-reaction', 'rook', 'Embarrassed scratch — finite', [`${ROOK_CLEAN}/rook_embarrassed.png`, `${ROOK_CLEAN}/rook_embarrassed_scratch_b.png`, `${ROOK_CLEAN}/rook_embarrassed.png`], 48, 88, 4, 'Silent listening reaction for an awkward question. One scratch, one hold, then release.', [260, 520, 700]),
    clip('rook.talk.smirk', 'rook', 'Smirk (silent hold)', [`${ROOK_CLEAN}/rook_talk_smirk.png`], 48, 88, 1, 'A silent expression only. Never cycle this as a talking mouth.'),
    clip('rook.camera-cheeky-hold', 'rook', 'Cheeky camera grin — held', [`${ROOK_LEGACY_EXCEPTIONS}/rook_camera_grin.png`], 48, 88, 1, 'A rare, explicitly admitted pre-cleanup exception. Enter once, hold across the assigned joke, then release; never restart it on every adjacent line and never use it as a talking mouth.'),
    clip('rook.walk', 'rook', 'Walk', [`${ROOK_CLEAN}/rook_walk_1_contact_a.png`, `${ROOK_CLEAN}/rook_walk_2_passing_a.png`, `${ROOK_CLEAN}/rook_walk_3_contact_b.png`, `${ROOK_CLEAN}/rook_walk_4_passing_b.png`], 48, 88, 8),
    clip('rook.inspect', 'rook', 'Inspect', [`${ROOK_CLEAN}/rook_inspect_lean.png`, `${ROOK_CLEAN}/rook_inspect_hold_item.png`], 48, 88, 4),
    clip('rook.inspect-lean', 'rook', 'Lean and inspect (empty hands)', [`${ROOK_CLEAN}/rook_inspect_lean.png`], 48, 88, 1),
    clip('rook.note-read', 'rook', 'Read small note', [`${ROOK_CLEAN}/rook_inspect_hold_item.png`, `${ROOK_CLEAN}/rook_talk_inspect_hold_item.png`], 48, 88, 8, 'Use the small-item inspect silhouette only while Rook reads the key words or the back of the note. Release it during commentary and before the rich reaction.'),
    clip('rook.drawer-extract', 'rook', 'Drawer extraction', [`${ROOK_CLEAN}/rook_idle_neutral_a.png`, `${ROOK_CLEAN}/rook_pickup_down.png`, `${ROOK_CLEAN}/rook_pickup_up.png`, `${ROOK_CLEAN}/rook_idle_neutral_a.png`], 48, 88, 6),
    clip('rook.give', 'rook', 'Give', [`${ROOK_CLEAN}/rook_give_offer.png`], 48, 88, 1),
    clip('rook.reach.neutral', 'rook', 'Neutral reach', [`${ROOK_LEGACY_EXCEPTIONS}/rook_use_reach.png`], 48, 88, 1, 'Explicit pre-cleanup exception for the missing clean reach. Use only at the contact instant, then release to the clean core.'),
    clip('rook.reach.talk', 'rook', 'Reach while talking', [`${ROOK_LEGACY_EXCEPTIONS}/rook_use_reach.png`, `${ROOK_LEGACY_EXCEPTIONS}/rook_talk_use_reach.png`], 48, 88, 8, 'Closed/open mouth pair on one fixed empty-hand reach silhouette. Use while Rook verbally sorts the case drawer; do not retract the arm between adjacent search lines.'),
    clip('rook.case-file', 'rook', 'Read Euler case file', [`${ROOK_CLEAN}/rook_read_document.png`, `${ROOK_CLEAN}/rook_talk_read_document.png`], 48, 88, 8, 'Large document hold/talk pair. Use only after the file has been found and granted, during the immediate Euler-detail recitation; release to idle when the reading ends.'),
    clip('rook.foot-tap', 'rook', 'Foot tap', Array.from({ length: 8 }, () => [`${ROOK_CLEAN}/rook_foot_tap_a.png`, `${ROOK_CLEAN}/rook_foot_tap_b.png`]).flat(), 48, 88, 4),
    clip('rook.confused', 'rook', 'Confused', [`${ROOK_CLEAN}/rook_confused_headscratch.png`, `${ROOK_CLEAN}/rook_confused_scratch_b.png`, `${ROOK_CLEAN}/rook_confused_headscratch_blink.png`], 48, 88, 4),
    clip('arthur.idle.breath', 'arthur', 'Idle breath', [`${ARTHUR}/archivist_idle_a.png`, `${ARTHUR}/archivist_idle_b.png`, `${ARTHUR}/archivist_idle_a.png`], 48, 88, 0.57),
    clip('arthur.blink', 'arthur', 'Blink', [`${ARTHUR}/archivist_idle_a.png`, `${ARTHUR}/archivist_idle_blink.png`, `${ARTHUR}/archivist_idle_a.png`], 48, 88, 8),
    clip('arthur.paper.idle', 'arthur', 'Paper check idle', [`${PAPER}/archivist_document_hold.png`, `${PAPER}/archivist_check_document.png`, `${PAPER}/archivist_document_hold.png`], 48, 88, 0.57),
    clip('arthur.glance-left', 'arthur', 'Glance left', [`${ARTHUR}/archivist_glance_left.png`], 48, 88, 1),
    clip('arthur.glance-right', 'arthur', 'Glance right', [`${ARTHUR}/archivist_glance_right.png`], 48, 88, 1),
    clip('arthur.idle.still', 'arthur', 'Idle still', [`${ARTHUR}/archivist_idle_a.png`], 48, 88, 1),
    clip('arthur.listen', 'arthur', 'Listen', [`${ARTHUR}/archivist_listening.png`], 48, 88, 1),
    clip('arthur.talk', 'arthur', 'Talk', [`${ARTHUR}/archivist_talk_closed.png`, `${ARTHUR}/archivist_talk_open.png`], 48, 88, 8),
    clip('arthur.explain', 'arthur', 'Explain', [`${ARTHUR}/archivist_gesture_explain.png`, `${ARTHUR}/archivist_talk_open_emphasis.png`], 48, 88, 4),
    clip('arthur.present-delivery', 'arthur', 'Explain — finite', [`${ARTHUR}/archivist_gesture_explain.png`, `${ARTHUR}/archivist_talk_open_emphasis.png`, `${ARTHUR}/archivist_gesture_explain.png`, `${ARTHUR}/archivist_talk_open_emphasis.png`, `${ARTHUR}/archivist_gesture_explain.png`], 48, 88, 8, 'One deliberate empty-handed explanation from the coherent core, with a closed-mouth finish; never an ambient loop and never introduces a paper prop.', [260, 170, 150, 190, 560]),
    clip('arthur.sardonic-reaction', 'arthur', 'Sardonic reaction — finite', [`${ARTHUR_POINT}/archivist_sardonic_closed.png`, `${ARTHUR_POINT}/archivist_sardonic_blink.png`, `${ARTHUR_POINT}/archivist_sardonic_closed.png`], 48, 88, 4, 'Silent, raised-brow disbelief used while Rook boasts. Blink once, hold, then release.', [300, 110, 760]),
    clip('arthur.slouch-delivery', 'arthur', 'Slouched delivery — finite', [`${ARTHUR_SLOUCH}/archivist_slouch.png`, `${ARTHUR_SLOUCH}/archivist_slouch_talk.png`, `${ARTHUR_SLOUCH}/archivist_slouch.png`, `${ARTHUR_SLOUCH}/archivist_slouch_talk.png`, `${ARTHUR_SLOUCH}/archivist_slouch.png`], 48, 88, 8, 'One weary spoken beat. Enter the approved slouch directly, articulate twice, and finish closed.', [300, 180, 160, 210, 700]),
    clip('arthur.point', 'arthur', 'Angry point', ['/art-packs/production/files/production/characters/arthur/pointing-v0.1.3/frames/archivist_gesture_point.png', '/art-packs/production/files/production/characters/arthur/pointing-v0.1.3/frames/archivist_gesture_point_talk.png'], 48, 88, 8, 'Stable pointing silhouette with the same closed/open mouth rate as Rook, used only while Arthur is actively delivering the warning.'),
    clip('arthur.stamp', 'arthur', 'Stamp', [`${STAMP}/archivist_stamp_up.png`, `${STAMP}/archivist_stamp_down.png`, `${STAMP}/archivist_stamp_up.png`], 48, 88, 6, 'One quick contact and release. The retired near-duplicate ready pose is deliberately excluded.'),
    clip('arthur.document', 'arthur', 'Hold document', [`${PAPER}/archivist_document_hold.png`, `${PAPER}/archivist_document_talk.png`], 48, 88, 8),
    clip('arthur.document-adjust', 'arthur', 'Adjust document', [`${PAPER}/archivist_document_hold.png`, `${PAPER}/archivist_document_talk.png`, `${PAPER}/archivist_check_document.png`, `${PAPER}/archivist_document_talk.png`, `${PAPER}/archivist_document_hold.png`], 48, 88, 3),
    clip('arthur.receive', 'arthur', 'Empty-hand receive', [`${PICKUP}/archivist_pickup_lift.png`, `${PICKUP}/archivist_pickup_contact.png`], 48, 88, 4),
    clip('arthur.glasses-adjust', 'arthur', 'Adjust glasses — one finite beat', [
      `${ARTHUR}/archivist_idle_a.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_reach.png`,
      `${ARTHUR_GLASSES}/archivist_adjust_glasses.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_press.png`,
      `${ARTHUR_GLASSES}/archivist_adjust_glasses.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_reach.png`,
      `${ARTHUR}/archivist_idle_a.png`,
    ], 48, 88, 6, 'Continuity-cleaned adjustment for incredulity or refocusing. Play once and finish; do not loop or combine with another large reaction.', [900, 160, 220, 140, 480, 160, 1000]),
    clip('arthur.glasses-wiggle', 'arthur', 'Glasses wiggle — optional one-shot', [
      `${ARTHUR_GLASSES}/archivist_adjust_glasses.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_shift_left.png`,
      `${ARTHUR_GLASSES}/archivist_adjust_glasses.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_shift_right.png`,
      `${ARTHUR_GLASSES}/archivist_adjust_glasses.png`,
    ], 48, 88, 6, 'Optional dry-comedy accent. One left/right cycle only, never an ambient loop; the larger contour change is acceptable only because the action is unmistakably intentional.', [220, 130, 130, 130, 360]),
    clip('arthur.you-incredulous', 'arthur', '“You?!?” — speak, glasses wiggle, camera take', [
      `${ARTHUR}/archivist_idle_a.png`,
      `${ARTHUR}/archivist_talk_open.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_reach.png`,
      `${ARTHUR_GLASSES}/archivist_adjust_glasses.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_shift_left.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_shift_right.png`,
      `${ARTHUR_GLASSES}/archivist_adjust_glasses.png`,
      `${ARTHUR_GLASSES}/archivist_glasses_reach.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral_blink.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR}/archivist_idle_a.png`,
    ], 48, 88, 8, 'Authored OPEN-009 composite: visibly deliver the two-word outburst, give the glasses exactly one restrained left/right correction, then turn to the player, blink once, hold the disbelief, and return. Never loop.', [100, 220, 140, 180, 120, 120, 180, 140, 400, 110, 700, 220]),
    clip('arthur.camera-glance', 'arthur', 'Camera glance — finite aside', [
      `${ARTHUR}/archivist_idle_a.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral_talk.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral_talk.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral_blink.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR}/archivist_idle_a.png`,
    ], 48, 88, 8, 'OPEN-015 camera quip: turn once, articulate “I never threw it” at the shared 125ms mouth rate, blink once, sustain the dry look, and return before the next line. Never loop or stop the spoken mouth early.', [100, 160, 125, 125, 125, 420, 90, 300, 150]),
    clip('arthur.camera-talk', 'arthur', 'Camera talk — finite aside', [
      `${ARTHUR}/archivist_idle_a.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral_blink.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral_talk.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral_talk.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral_talk.png`,
      `${ARTHUR_CAMERA}/archivist_camera_neutral.png`,
      `${ARTHUR}/archivist_idle_a.png`,
    ], 48, 88, 6, 'A short, authored camera-facing sentence: turn, blink once, then use three restrained mouth openings. It is finite and must not chatter for the entire reading hold.', [400, 500, 100, 180, 140, 220, 140, 170, 700, 500]),
    clip('mug.steam', 'mug', 'Coffee steam', MUG_STEAM_FRAMES, 24, 32, MUG_STEAM_FPS),
    clip('mug.still', 'mug', 'Mug still', [`${MUG}/mug_idle.png`], 24, 32, 1),
    clip('globe.idle', 'globe', 'Globe still', [`${GLOBE}/globe_idle.png`], 32, 48, 1),
    clip('globe.spin', 'globe', 'Globe spin', [`${GLOBE}/globe_spin_right.png`, `${GLOBE}/globe_spin_left.png`, `${GLOBE}/globe_settle.png`], 32, 48, 8),
  ]
}

function unit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

/** One-shot breaths separated by stable, deterministically varied rest windows. */
export function ambientClip(actorId: 'rook' | 'arthur', inactiveSeconds: number) {
  const beats = actorId === 'rook'
      ? [
        { id: 'rook.idle.still', min: 12, span: 6 },
        { id: 'rook.blink', min: 1, span: 0 },
        { id: 'rook.idle.still', min: 14, span: 8 },
        { id: 'rook.idle.breath', min: 6, span: 0 },
      ]
    : [
        { id: 'arthur.idle.still', min: 15, span: 7 },
        { id: 'arthur.blink', min: 1, span: 0 },
        { id: 'arthur.idle.still', min: 15, span: 9 },
        { id: 'arthur.idle.breath', min: 6, span: 0 },
      ]
  // Both actors restart from a genuine rest window after activity. Their
  // deterministic seeds already keep the durations from marching in lockstep;
  // shifting Arthur's clock forward made his first breath arrive up to four
  // seconds too early after every reset.
  const clock = inactiveSeconds
  let elapsed = 0
  for (let index = 0; index < 500; index += 1) {
    const beat = beats[index % beats.length]!
    const duration = beat.min + Math.floor(unit(index * 19 + (actorId === 'rook' ? 3 : 47)) * (beat.span + 1))
    if (clock < elapsed + duration) return clipById(beat.id)
    elapsed += duration
  }
  return clipById(actorId === 'rook' ? 'rook.idle.still' : 'arthur.idle.still')
}

export const MUG_STEAM_FPS = 5
export const MUG_STEAM_REST_MS = 10000
/** Left wisp. These three drawings actually connect. */
export const MUG_STEAM_A = [
  `${MUG}/mug_steam_a.png`,
  `${MUG}/mug_steam_a__phase_01.png`,
  `${MUG}/mug_steam_a__phase_02.png`,
  `${MUG}/mug_steam_a__phase_04.png`,
  `${MUG}/mug_steam_a__phase_05.png`,
  `${MUG}/mug_steam_a__phase_06.png`,
  `${MUG}/mug_steam_a__phase_07.png`,
]
/** The B drawing, held. It does not connect to the A wisp or to phase 4. */
export const MUG_STEAM_B = [
  `${MUG}/mug_steam_b.png`,
  `${MUG}/mug_steam_b.png`,
  `${MUG}/mug_steam_b.png`,
  `${MUG}/mug_steam_b.png`,
  `${MUG}/mug_steam_b.png`,
]
export const MUG_STEAM_FRAMES = [...MUG_STEAM_A, ...MUG_STEAM_B]

/** A puff, ten seconds still, B puff, ten seconds still. */
export function mugSteamFrame(elapsedMs: number): string | null {
  const frameMs = 1000 / MUG_STEAM_FPS
  const playA = MUG_STEAM_A.length * frameMs
  const playB = MUG_STEAM_B.length * frameMs
  let t = elapsedMs % (playA + MUG_STEAM_REST_MS + playB + MUG_STEAM_REST_MS)
  if (t < playA) return MUG_STEAM_A[Math.floor(t / frameMs)] ?? null
  t -= playA
  if (t < MUG_STEAM_REST_MS) return null
  t -= MUG_STEAM_REST_MS
  if (t < playB) return MUG_STEAM_B[Math.floor(t / frameMs)] ?? null
  return null
}

export function clipById(id: string) {
  return animationClips().find((clip) => clip.id === id) ?? null
}

export function clipsForActor(actorId: string) {
  return animationClips().filter((clip) => clip.actorId === actorId)
}

export function animationActors() {
  return [
    { id: 'rook', label: 'Rook' },
    { id: 'arthur', label: 'Arthur' },
    { id: 'mug', label: 'Mug' },
    { id: 'globe', label: 'Globe' },
  ]
}

export function builtinCues(): AnimationCue[] {
  return [
    { momentId: 'idle:rook', actorId: 'rook', clipId: 'rook.idle.breath', fps: 2, holdMs: 0, mode: 'LOOP' },
    { momentId: 'idle:arthur', actorId: 'arthur', clipId: 'arthur.idle.breath', fps: 2, holdMs: 0, mode: 'LOOP' },
    { momentId: 'idle:mug', actorId: 'mug', clipId: 'mug.steam', fps: 5, holdMs: 0, mode: 'LOOP' },
    { momentId: 'walk:rook', actorId: 'rook', clipId: 'rook.walk', fps: 8, holdMs: 0, mode: 'LOOP' },
  ]
}

export function cueMoments(): CueMoment[] {
  const life: CueMoment[] = [
    { id: 'idle:rook', group: 'Life', label: 'Rook waiting', detail: 'Plays whenever Rook is not walking or in a line.' },
    { id: 'idle:arthur', group: 'Life', label: 'Arthur waiting', detail: 'Plays whenever Arthur is not in a line.' },
    { id: 'idle:mug', group: 'Life', label: 'Mug steam', detail: 'Keeps the mug lively in the live scene.' },
    { id: 'idle:globe', group: 'Life', label: 'Globe ambient', detail: 'Optional motion for the globe when nothing else is using it.' },
    { id: 'walk:rook', group: 'Life', label: 'Rook walking', detail: 'Plays while Rook walks.' },
  ]
  const interactions: CueMoment[] = [...usefulRules, ...itemRules].map((rule) => ({
    id: `interaction:${rule.id}`,
    group: 'Interactions' as const,
    label: rule.id.replaceAll('-', ' '),
    detail: `${rule.verb} · ${'targetId' in rule ? rule.targetId : rule.itemId}`,
  }))
  const seen = new Set<string>()
  const dialogue: CueMoment[] = []
  for (const phase of ['START', 'COMPLETE'] as const) {
    for (const topic of dialogueTopicsForState({ phase, exhaustedTopics: [], inventory: [] })) {
      topic.lines.forEach((line, lineIndex) => {
        const id = `dialogue:${topic.id}:${lineIndex}`
        if (seen.has(id)) return
        seen.add(id)
        dialogue.push({ id, group: 'Dialogue', label: `${topic.label} · line ${lineIndex + 1}`, detail: `${line.speaker}: ${line.text.replace(/\s+/g, ' ').slice(0, 90)}`, speaker: line.speaker, text: line.text })
      })
    }
  }
  const script = FINAL_SCRIPT_LINES.flatMap((line, index): CueMoment[] => {
    if (!line.copyKey) return []
    const eventKey = line.finalScriptSource?.eventKey ?? 'Unsorted script'
    return [{
      id: `delivery:${line.copyKey}`,
      group: 'Script',
      label: `${eventKey} · ${index + 1}`,
      detail: `${line.speaker}: ${line.text.replace(/\s+/g, ' ')}`,
      speaker: line.speaker,
      text: line.text,
      eventKey,
    }]
  })
  return [...life, ...interactions, ...dialogue, ...script]
}

export function activeMomentId(input: GameCueInput, actorId: string) {
  if (input.deliveryKey) return `delivery:${input.deliveryKey}`
  if (input.walking && actorId === 'rook') return 'walk:rook'
  if (input.speechReturn === 'DIALOGUE' && input.lastInteractionId?.startsWith('DIALOGUE.')) return `dialogue:${input.lastInteractionId.slice('DIALOGUE.'.length)}:${input.lineIndex}`
  if (input.speechReturn && input.lastInteractionId) {
    const id = input.lastInteractionId.split('.').pop()
    if (id) return `interaction:${id}`
  }
  return `idle:${actorId}`
}

export function resolveCue(sheet: CueSheet | null, momentId: string, actorId: string): AnimationCue | null {
  return sheet?.cues.find((cue) => cue.momentId === momentId && cue.actorId === actorId) ?? builtinCues().find((cue) => cue.momentId === momentId && cue.actorId === actorId) ?? null
}

/** Production passes null. A development cue sheet is opt-in and never the default. */
export function resolveActorCue(input: GameCueInput, actorId: string, sheet: CueSheet | null = null) {
  const momentId = activeMomentId(input, actorId)
  const cue = sheet?.cues.find((item) => item.momentId === momentId && item.actorId === actorId) ?? null
  const clip = cue ? clipById(cue.clipId) : null
  return cue && clip?.actorId === actorId ? { cue, clip, momentId } : null
}

function browserStore(): LayoutStore | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

function emptyLibrary(): CueLibrary {
  return { versions: [], defaultVersionId: null }
}

function validCue(cue: AnimationCue): cue is AnimationCue {
  const before = cue.beatBeforeMs ?? 0
  const after = cue.beatAfterMs ?? 0
  const selected = clipById(cue.clipId)
  return Boolean(cue.momentId && cue.actorId && selected?.actorId === cue.actorId && cue.fps >= 1 && cue.fps <= 24 && cue.holdMs >= 0 && cue.holdMs <= 10000 && before >= 0 && before <= 10000 && after >= 0 && after <= 10000 && ['LOOP', 'ONCE', 'HOLD'].includes(cue.mode))
}

function normalizeSheet(sheet: CueSheet): CueSheet {
  return { cues: sheet.cues.filter(validCue).map((cue) => ({ ...cue, fps: Math.round(cue.fps), holdMs: Math.round(cue.holdMs), beatBeforeMs: Math.round(cue.beatBeforeMs ?? 0), beatAfterMs: Math.round(cue.beatAfterMs ?? 0), note: cue.note?.trim() ?? '' })) }
}

export function readCueLibrary(storage: LayoutStore | null = browserStore()): CueLibrary {
  if (!storage) return emptyLibrary()
  try {
    const raw = storage.getItem(CUE_SHEET_KEY)
    if (!raw) return emptyLibrary()
    const parsed = JSON.parse(raw) as CueLibrary
    const versions = Array.isArray(parsed.versions) ? parsed.versions.flatMap((version) => {
      if (!version?.id || !version.name || !version.sheet || !Array.isArray(version.sheet.cues)) return []
      return [{ id: version.id, name: version.name, savedAt: version.savedAt || '', sheet: normalizeSheet(version.sheet) }]
    }) : []
    const defaultVersionId = versions.some((version) => version.id === parsed.defaultVersionId) ? parsed.defaultVersionId : null
    return { versions, defaultVersionId }
  } catch { return emptyLibrary() }
}

function writeCueLibrary(storage: LayoutStore, library: CueLibrary) {
  storage.setItem(CUE_SHEET_KEY, JSON.stringify(library))
}

export function saveCueVersion(storage: LayoutStore, name: string, sheet: CueSheet, makeDefault: boolean): CueLibrary {
  const library = readCueLibrary(storage)
  const version: SavedCueVersion = {
    id: `cues-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `Cue sheet ${library.versions.length + 1}`,
    savedAt: new Date().toISOString(),
    sheet: normalizeSheet(sheet),
  }
  const next: CueLibrary = { versions: [...library.versions, version], defaultVersionId: makeDefault ? version.id : library.defaultVersionId }
  writeCueLibrary(storage, next)
  return next
}

export function setDefaultCueVersion(storage: LayoutStore, versionId: string | null): CueLibrary {
  const library = readCueLibrary(storage)
  const next = { ...library, defaultVersionId: versionId && library.versions.some((version) => version.id === versionId) ? versionId : null }
  writeCueLibrary(storage, next)
  return next
}

export function removeCueVersion(storage: LayoutStore, versionId: string): CueLibrary {
  const library = readCueLibrary(storage)
  const next: CueLibrary = {
    versions: library.versions.filter((version) => version.id !== versionId),
    defaultVersionId: library.defaultVersionId === versionId ? null : library.defaultVersionId,
  }
  writeCueLibrary(storage, next)
  return next
}

export function readDefaultCueSheet(storage: LayoutStore | null = browserStore()): CueSheet | null {
  const library = readCueLibrary(storage)
  return library.versions.find((version) => version.id === library.defaultVersionId)?.sheet ?? null
}

export function upsertCue(sheet: CueSheet, cue: AnimationCue): CueSheet {
  const next = normalizeSheet({ cues: [...sheet.cues.filter((item) => item.momentId !== cue.momentId || item.actorId !== cue.actorId), cue] })
  return next
}
