# Immutable release snapshot

The public release is built from the named Git commit on `main` and tagged
`v1.0.0-meridian`. The release gate type-checks and builds the source, verifies
the browser/provider boundary, checks every public file against `dist/`, and
rejects machine-local filesystem dependencies. GitHub Actions deploys the game
and documentation from that same repository root.

The source archive, static browser build, documentation archive, submission
video, and SHA-256 manifest are attached to the
[GitHub Release](https://github.com/th3Wh1t3Rabbit/tarka/releases/tag/v1.0.0-meridian).
The public game requires origin-root hosting and has no service worker or PWA
installation behavior. No release step performs a live Nansen request.

[Build and test](../testing.md) · [Source and content](source-and-content.md)
