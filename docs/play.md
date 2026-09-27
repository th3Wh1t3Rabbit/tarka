# Play Tarka

## Just play in your browser

The hosted game is the shortest route: [play Tarka](https://play.tarka-meridian.workers.dev/).
No Nansen key, wallet connection, account creation, or source-code setup is required.

## Download and keep a local copy

The [GitHub Release](https://github.com/th3Wh1t3Rabbit/tarka/releases/tag/v1.0.0-meridian)
contains a browser-build archive, source archive, documentation archive, and
SHA-256 checksums. The browser build is static and self-contained, but it must
be served over HTTP rather than opened through `file://`. Extract it, keep the
folder intact, and serve it on loopback with an existing local web server such
as Python's `http.server`.

Choose your platform: **[Windows](play/windows.md) · [macOS](play/macos.md) · [Linux](play/linux.md)**.

The game’s evidence and media are bundled. Local play needs no provider access;
the first install of source dependencies still requires normal npm registry
access unless those dependencies are already cached.

## Looking for the source?

[Build and test](testing.md) documents the verified source route using Node.js
20.19+ and npm 10+.

For continuing a local session or resolving a port conflict, read [Keeping your local progress](play/saves.md).
