# Build and test

This page is for developers. Players should use [the hosted game or prepared download](play.md).

## Reproduce the source build

Use the release's tested tool versions and committed lockfile. Installing source dependencies is a different route from launching the prepared offline game.

Install Node.js 20.19+ and npm 10+, then use the committed lockfile:

```text
git clone https://github.com/th3Wh1t3Rabbit/tarka.git
cd tarka
npm ci
npm run dev
```

For the production gate, run `npm run release:verify`. Developers can also run
`npm run check`, `npm test`, and `npm run test:e2e`. The final release repeats
installation and production verification from a fresh anonymous clone.

## What a check establishes

| Check | What it tells you | What it does not establish |
|---|---|---|
| Source and artifact identity | Which source and output files were examined | That the game is correct or ready to publish |
| Production build | The documented build command completed | That every path through the game was exercised |
| Asset delivery | The requested files exist and have the expected bytes and media types | That all files are used, or that every runtime request was observed |
| Launch smoke | The tested input path reaches the title and room | That authorization, investigation, audio and ending all work |
| Complete journeys | The recorded puzzle and investigation paths complete | Compatibility with untested browsers or devices |
| Published-build checks | The actual public URL and downloadable archives were tested | An unconditional availability or performance guarantee |

A release report should identify the exact source and built artifact, test environment, command, result and any remaining limitations. Reference screenshots and development-test counts must not impersonate final-game qualification.

## Pre-release delivery rehearsal

Before the final game archive existed, the delivery mechanism was exercised with a harmless synthetic site. A static-host rehearsal verified two separate origins, revision replacement and restoration, relative navigation, browser storage separation, and complete cleanup. Native loopback-launcher mechanics were also exercised on Linux, Windows 2025 x64, and macOS 15 ARM64.

Those checks establish that the proposed plumbing can work. They do **not** establish that Tarka's actual assets, saves, complete journeys, signing, notarization, double-click behavior, or operating-system security prompts are ready. The real release must repeat the relevant checks against exact game and documentation artifact hashes.

## Gameplay coverage

Check office authorization, inventory interactions, every result page, query/history identity, detail/back navigation, exact-proof eligibility, report saving and closure cancellation. Exercise both guided progress and optional record exploration. After a return to the office, verify the retained investigation and the correct audio track.

Record keyboard, pointer and touch coverage at the level actually tested. Browser-emulated touch is not a physical-device result. A blocked-provider journey verifies that gameplay does not need fresh Nansen calls; local asset requests remain necessary.

Release qualification records 479 passing unit checks with three
private-provenance-only checks skipped, plus 127 passing browser journeys. The
browser result combines the complete 127-test sweep with focused green reruns
of five expectations updated for the final mobile settings menu, exact public
link casing, and uninterrupted globe timing; no failing current expectation is
waived. TypeScript, ESLint, the browser/provider boundary, release portability,
required-art/audio identity, documentation integrity, and local-path scans
pass. Browser journeys cover opening, office routes, drawers, inventory
combinations, terminal investigation, closeout, mobile layouts, and the
globe's repeated touch/promotion/reversal behavior. The release report keeps
those results separate from operating systems and physical devices that were
not tested.

## Size and loading

Keep uncompressed archive bytes, compressed transfer bytes, first-load requests and whole-session requests distinct. An asset inventory is not a browser loading trace. Developer source maps may be included in a build without being requested by an ordinary player; removing one does not establish an equal startup-speed gain.

## Documentation checks

The documentation build checks links, public terminology, stable request/record references, image provenance and unresolved publication tasks. The searchable website is generated from the same Markdown library as the repository documentation.

[Known limitations](limitations.md) · [Data method](data/method.md) · [Local saves](play/saves.md)
