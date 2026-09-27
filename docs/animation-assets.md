# Production animation assets

The executable source of truth is
[`src/adventure/animationCues.ts`](../src/adventure/animationCues.ts). It maps each
semantic cue to the exact shipped PNGs, frame durations, loop policy, and fallback.
The guides below explain how to use those selections without accidentally mixing
historical review art into a coherent performance.

## Character and prop authorities

- [Rook production guide](../public/art-packs/production/files/production/characters/rook/ROOK_ANIMATION_USAGE_GUIDE.md)
- [Rook machine-readable frame policy](../public/art-packs/production/files/production/characters/rook/ROOK_FRAME_OVERLAYS.json)
- [Arthur production guide](../public/art-packs/production/files/production/characters/arthur/WHICH.md)
- [Office globe production guide](../public/art-packs/production/files/production/ambience/globe-life/USAGE.md)
- [Office globe timing recipe](../public/art-packs/production/files/production/ambience/globe-life/LEVEL_RECIPE.json)

Rook and Arthur use complete 48 × 88 pixel cels. The globe art is 32 × 48 pixels
and renders in a 16 × 24 logical-pixel scene box. All art uses nearest-neighbor
scaling.

## Coherent shipping families

Rook's ordinary idle, talk, walk, and reaction art comes from
`latest-clean-v0.1.14/frames`. Three older frames are intentional, named
exceptions: the silent camera grin, the empty-hand reach, and the reach-while-
talking cel. The broader `frames` directory is review provenance, not a menu of
interchangeable production art.

Arthur's everyday body comes from `coherent-core-v1.0.0`. Glasses, camera,
pointing, slouch, stamp, paperwork, and pickup actions each use the exact
continuity family named in the Arthur guide. Similarly named historical folders
must not be substituted frame-by-frame.

## Timing and performance rules

- Ordinary Rook and Arthur speech uses the same 8 fps cadence and ends closed.
- Rook's four-phase walk uses 8 fps; the idle breath is intentionally much slower.
- Walk, ordinary talk, and compatible quiet idle may loop. Reactions, reaches,
  camera takes, prop actions, glasses adjustments, and paperwork actions are finite.
- Enter an expression once, hold it across the intended beat, and settle. Do not
  restart it for every dialogue line or run catch-up flourishes after tab suspension.
- Preserve each actor's scene slot. Animation changes must not swap Rook and Arthur
  or leave one character obscuring the other during conversation.
- During a prop handoff, relinquish the giver's prop at contact before showing the
  receiver's held-prop pose.

## Inspection intent

World-object inspection may use Rook's physical inspect/reach acting. Routine
inventory `LOOK AT` responses should use neutral delivery. Small-note and large-
document holds are reserved for explicitly scripted reading passages. The reducer
enforces neutral delivery for routine inventory observations.

## Implementation rule

Do not infer a production family from a filename alone. Add or change a cue in
`animationCues.ts`, pin its path and timing in tests, and update the corresponding
shipping guide in the same change. This keeps source, documentation, and packaged
assets aligned.
