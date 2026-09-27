# Office globe production guide

Status: **integrated and shipping in Tarka v1.0**.

## Art and recipe

- Native globe art is **32 × 48 pixels**, rendered in a **16 × 24 logical-pixel**
  scene box with nearest-neighbor scaling.
- Frames: [`frames/`](frames/)
- Machine-readable timing: [`LEVEL_RECIPE.json`](LEVEL_RECIPE.json)
- The runtime preloads all **73 unique globe images** before interactive motion.

## Interaction model

The globe has three promoted speed levels. A same-direction push or pull advances
level 1 → 2 → 3; reversing direction restarts at level 1 while preserving the
visible angle. Each finite spin slows naturally and lands on its authored final
hold. Approximate authored totals are:

- Level 1: **9,760 ms**
- Level 2: **9,159 ms**
- Level 3: **9,075 ms**

These are complete actions, not idle loops. The final hold remains until another
globe action begins.

## Mobile and suspended tabs

The production driver is visibility-aware and advances at a 30 fps logical cadence.
A long browser suspension is consumed as one normal frame rather than a burst of
catch-up animation. Preloading prevents network arrival order from changing the
sequence.

The frame driver remains live across in-flight promotion and reversal, avoiding a
mobile restart pause after repeated input. If the browser or operating system
throttles the page, the semantic level, direction, slowdown, and final state remain
correct when presentation resumes.

Do not convert the levels into infinite spins, shuffle frame order, or substitute
CSS rotation for the authored pixel animation.
