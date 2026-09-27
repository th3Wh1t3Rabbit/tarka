# Keeping your local progress

## Return through the same browser address

Use the same browser profile and the same play address when continuing a local game. Browser storage is associated with an origin: the scheme, hostname and port. Switching from a hosted page to a local copy, from `localhost` to `127.0.0.1`, or to another port does not automatically bring the same stored data along.

Private browsing and clearing site data can remove browser-held progress. Do not delete site data as the first response to a loading problem.

## When a local port is occupied

Do not stop unrelated software just to free a port. Use the launcher's documented collision behavior. For the manual-server fallback, choosing another unused port creates a different play address; return to the original address later to look for its earlier progress.

Copying the game folder alone does not copy a browser profile's saved data. Cross-browser or hosted-to-local migration should only be promised when the released game provides and tests a supported export/import route.

The released game persists progress and preferences in origin-scoped browser
storage. It does not provide cross-origin, cross-browser, or cross-device
export/import. Changing the hosted domain, local hostname, or port creates a
different storage origin and therefore a separate save.

These browser-origin rules are described in [MDN's storage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy). They are not a claim that untested game-save migration works.

[Back to Play Tarka](../play.md) · [Windows](windows.md) · [macOS](macos.md) · [Linux](linux.md)
