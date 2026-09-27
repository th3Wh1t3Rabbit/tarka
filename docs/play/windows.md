# Play on Windows

## Preferred: hosted play

[Play in a current browser](https://play.tarka-meridian.workers.dev/) without
installing anything. The release does not claim a signed native Windows
executable.

## Alternative: an existing Python 3 installation

This alternative is for a player who already has Python 3. It does not require installing the project’s JavaScript dependencies.

Open a terminal in the **built game folder containing its index.html and assets**, not the repository root. Start a local file server:

```text
py -3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` in your browser. Leave the terminal open while playing, and press **Ctrl+C** there when finished. If port 8000 is occupied, do not stop unrelated software. Another unused port can serve the files, but it is a different browser origin and does not automatically share the previous address’s saved game. See [local saves](saves.md).

A source-code archive may not contain a ready-to-play build. Use the prepared release or follow the separate [build instructions](../testing.md). Opening index.html by double-click is not claimed to work for the production module/data-loading model.

The source commands are operating-system neutral, but this release's anonymous
fresh-clone qualification was performed on Linux. Windows users should treat
the local source route as supported by the toolchain rather than as a signed
native application. See [Build and test](../testing.md).

[Back to Play Tarka](../play.md)
