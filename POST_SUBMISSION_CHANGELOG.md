# Tarka post-submission changelog

This file distinguishes the competition snapshot from later maintenance. It
does not redefine or replace the submitted release.

## Submitted competition snapshot · September 27, 2026

- Tag: `v1.0.0-meridian`
- Commit: `3fe68360d59cfb553cd431da96d3e0238e8027c2`
- Tree: `090ba53b27e53e56938da185f1ac34b7f945f23b`
- Release assets and submission video remain unchanged.
- [Release](https://github.com/th3Wh1t3Rabbit/tarka/releases/tag/v1.0.0-meridian) · [submission post](https://x.com/th3Wh1t3Rabbit/status/2104292991699681304) · [snapshot receipt](docs/competition/submission-snapshot.md)

## Mobile globe lifecycle repair · post-submission

- Commit: `0f6d0c5a9cc2deeed316e781426f9ede297d4ec1`
- Corrected repeated mobile `Use → globe → Use → globe` timer ownership and
  foreground/background lifecycle behavior.
- Added focused unit and browser regressions while keeping the submitted tag
  fixed.

## Documentation and Script Explorer polish · post-submission

- Corrects every hotspot and inventory display label in the generated public
  Explorer and binds each item to its authoritative `LOOK AT` route.
- Removes visible `undefined` and empty scene metadata, and explains generic
  runtime performance fallback semantics without changing raw cue authority.
- Promotes the spoiler-labeled Explorer to first-class desktop/mobile
  navigation with direct README, homepage, and Creator's Note links.
- Records the exact public submission post and a machine-readable competition
  snapshot while keeping the submitted tag and release assets untouched.
- The exact published maintenance commit is the repository `main` revision
  containing this entry; the submitted competition commit remains the frozen
  identity above.
