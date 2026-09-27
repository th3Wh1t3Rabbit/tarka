# Reading the complete Script Explorer

> **Full story and puzzle spoilers:** Script Explorer pages are marked as spoilers. Hosted documentation search excludes them unless **Include evidence / spoilers** is enabled.

## Stable identities

- **Event keys** group the authored story deliveries in effective runtime order.
- **Delivery IDs** are stable copy/source identities for individual speech panels.
- **Route IDs** identify a verb, hotspot, inventory pairing, dialogue state, terminal route, or ending variant.
- **Owner** identifies the runtime function or catalog that supplies the route.
- **Action input** and **state fixture** describe represented trigger/state conditions.

## Timing and performance

Each story delivery records the authored panel boundary, speaker, text, before/after beat duration, and any represented animation/expression cue. Runtime route pages preserve effective output after dialogue normalization. A dash means no extra timing or performance cue is authored for that delivery.

Raw machine-readable cue authority preserves the token `UNRESOLVED`. In the human tables, that token is rendered as **generic runtime fallback; no bespoke cue bound**: the shipped runtime falls back to its ordinary speaker/talking presentation rather than selecting a dedicated authored expression or body clip.

Inventory metadata intentionally omits the legacy `description` field because several values are stale or shifted. The exact `LOOK AT` route shown for each item is the authoritative player-facing writing.

## Source authority

The explorer is regenerated from the final script authority, final runtime corrections, transcript route authority, production action registry, hotspot/verb inventory, and runtime selectors. The coverage receipt hashes each source input and fails generation if a final bubble disappears, an executable action errors, or expected world/inventory route totals drift.

## Deep links and cross-links

Event, delivery, hotspot, inventory, route, and action anchors are stable within this release. The explorer index links directly to every hotspot, inventory item, and story event. The hosted documentation also retains page-level search and spoiler filtering.

[Back to Script Explorer](index.md) · [Coverage](coverage.md)
