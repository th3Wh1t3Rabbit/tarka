# Play on Linux

## Preferred: hosted play

[Play in a current browser](https://play.tarka-meridian.workers.dev/) without
installing anything. The release does not claim a native Linux executable.

## Alternative: an existing Python 3 installation

This alternative is for a player who already has Python 3. It does not require installing the project’s JavaScript dependencies.

Open a terminal in the **built game folder containing its index.html and assets**, not the repository root. Start a local file server:

```text
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` in your browser. Leave the terminal open while playing, and press **Ctrl+C** there when finished. If port 8000 is occupied, do not stop unrelated software. Another unused port can serve the files, but it is a different browser origin and does not automatically share the previous address’s saved game. See [local saves](saves.md).

A source-code archive may not contain a ready-to-play build. Use the prepared release or follow the separate [build instructions](../testing.md). Opening index.html by double-click is not claimed to work for the production module/data-loading model.

The exact source route was also qualified from a fresh anonymous clone on
Linux with Node.js 20.19+ and npm 10+. See [Build and test](../testing.md).

[Back to Play Tarka](../play.md)
