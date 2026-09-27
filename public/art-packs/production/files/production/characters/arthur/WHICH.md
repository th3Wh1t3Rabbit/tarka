# Arthur production animation guide

Status: **shipping reference for Tarka v1.0**. The executable authority is
[`src/adventure/animationCues.ts`](../../../../../../../src/adventure/animationCues.ts).

## Shipping sources

- Everyday coherent core: [`coherent-core-v1.0.0/frames/`](coherent-core-v1.0.0/frames/)
- Glasses adjustments: [`continuity-glasses-v0.1.5/frames/`](continuity-glasses-v0.1.5/frames/)
- Camera reactions: [`continuity-camera-v0.1.0/frames/`](continuity-camera-v0.1.0/frames/)
- Pointing: [`pointing-v0.1.3/frames/`](pointing-v0.1.3/frames/)
- Slouch/lean: [`slouch-v0.1.3/frames/`](slouch-v0.1.3/frames/)
- Stamp action: [`stamp-v0.1.1/frames/`](stamp-v0.1.1/frames/)
- Coherent paperwork: [`paperwork-coherent-v0.1.2/frames/`](paperwork-coherent-v0.1.2/frames/)
- Pickup: [`pickup-v0.1.1/frames/`](pickup-v0.1.1/frames/)

Other versioned folders remain as review provenance and compatibility material.
They are not interchangeable with these coherent production families. In
particular, do not mix old and cleaned idle outlines inside one performance.

## Geometry and cadence

- Each Arthur cel is a complete **48 × 88 pixel** PNG.
- Render with nearest-neighbor scaling; never crossfade or assemble hybrid cels.
- Ordinary speech uses the same **8 fps (125 ms per cel)** cadence as Rook and ends
  closed. Arthur is not intended to speak more slowly.
- Preserve Arthur's scene slot and facing. Rook and Arthur must remain separately
  readable during conversation.

## Acting rules

- Glasses adjustment/wiggle, camera looks, pointing, slouch, stamping, pickup, and
  paperwork are finite actions. They are not ambient loops.
- A glasses or camera reaction may enter once, hold for the scripted beat, and
  return to a compatible rest. Do not restart it per line.
- If a lean has no compatible talking cel, return to ordinary idle before speech.
- Keep the stamp in contact with the document during the impact pose; do not stamp
  empty air.
- During a handoff, the giver relinquishes the document at contact before the
  receiver's held-paper pose becomes visible. Never render duplicate paper.
- Use coherent paperwork frames as one family; do not substitute similarly named
  review cels from `paperwork-v0.1.4`.

## Looping and interruption

Only ordinary idle and speech may loop. All expressive and prop clips finish once,
settle, and cancel queued flourishes when dialogue or player control moves on.
After browser suspension, resume from the current semantic pose rather than racing
through every missed frame.

When a shipping family changes, update `animationCues.ts`, its timing/path tests,
and this guide in the same commit.
