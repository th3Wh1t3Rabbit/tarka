# Rook production animation guide

Status: **shipping reference for Tarka v1.0**. The executable authority is
[`src/adventure/animationCues.ts`](../../../../../../../src/adventure/animationCues.ts).
This guide describes the art that the game actually loads; it is not a catalog of
historical review experiments.

## Shipping sources

- Canonical core: [`latest-clean-v0.1.14/frames/`](latest-clean-v0.1.14/frames/)
- Intentional legacy exceptions:
  [`rook_camera_grin.png`](frames/rook_camera_grin.png),
  [`rook_use_reach.png`](frames/rook_use_reach.png), and
  [`rook_talk_use_reach.png`](frames/rook_talk_use_reach.png)
- Machine-readable selection policy: [`ROOK_FRAME_OVERLAYS.json`](ROOK_FRAME_OVERLAYS.json)

Everything else in this directory is review history or compatibility material. It
may document useful acting ideas, but it is not selected by the production runtime
unless `animationCues.ts` names it explicitly.

## Geometry and rendering

- Each Rook cel is a complete **48 × 88 pixel** PNG.
- Render with nearest-neighbor scaling. Do not interpolate, crossfade, rotate, or
  assemble new poses from unrelated body parts.
- Mirror only world-facing poses. Camera-facing expressions and prop/contact poses
  keep their authored orientation.
- Keep Rook in his scene slot. Animation changes must not move him into Arthur's
  slot or exchange the actors' positions.

## Everyday motion and speech

- Ordinary speech alternates the compatible closed/open pair at **8 fps (125 ms
  per cel)** and always ends closed.
- The approved four-phase walk also runs at **8 fps**. Preserve its phase order and
  mirror the rendered cel for the opposite travel direction.
- The idle breath is deliberately slow (about **0.57 fps**). Blinks are sparse,
  brief interruptions, not a repeating metronome.
- Do not restart a gesture, camera glance, or expression for every dialogue line.
  Enter once, hold across the intended beat, then return through a compatible rest.

## Reactions and camera asides

Thinking, proud, emphasis, shrug, confusion, surprise, and similar reactions are
finite acting clips. Play them once, use any authored hold deliberately, and then
settle. They must not become ambient loops.

The camera grin is a rare fourth-wall aside. It is an intentional legacy exception
because no clean replacement was completed. Hold it long enough to read, do not
talk from it, and do not fire it repeatedly across adjacent lines.

## Reaching, inspection, and paper

- `rook.inspect-lean` is for an empty-hand **world-object** inspection.
- Routine **inventory LOOK AT** dialogue should use neutral delivery; selecting an
  inventory item is not permission to mime its physical world action.
- `rook.note-read` is reserved for explicitly scripted small-note reading.
- `rook.case-file` is reserved for explicitly scripted large-document reading.
- The two reach PNGs above are intentional exceptions for object contact and
  reach-while-talking. Hold contact only while the script requires it, then retract.
- Never show two owners holding the same transferred prop on the same frame.

## Looping and cancellation

- Loop only walk, ordinary talk, or the compatible quiet idle selected by the
  runtime. Reactions, reaches, camera takes, and prop actions are finite.
- On interruption, finish on a compatible closed/rest cel. Do not catch up missed
  blinks or replay skipped flourishes after a tab resumes.
- Reduced-animation mode preserves the semantic pose and final state while
  shortening intermediate motion.

When adding a new production cue, update `animationCues.ts`, the tests that pin its
timing and source path, this guide, and `ROOK_FRAME_OVERLAYS.json` together.
