# Script Explorer coverage

> **Full story and puzzle spoilers.** This is the human-readable companion to the machine coverage receipt. The documentation search excludes Script Explorer pages unless **Include evidence / spoilers** is enabled.

[Script Explorer](index.md) · [Reading guide](how-to-read.md) · [Story](story.md) · [World routes](world-routes.md) · [Inventory](inventory-routes.md) · [Arthur dialogue](dialogue-routes.md) · [Actions & endings](actions-and-endings.md) · [Coverage](coverage.md)


Coverage result: **PASS**

## What is represented

- 724 of 724 final authority bubbles.
- 141 runtime event keys and 730 final event deliveries.
- 1505 runtime transcript routes and 2211 deliveries.
- 214 executable production action routes and 764 deliveries.
- 27 hotspots × 9 verbs, including 1053 bare and selected-item world routes.
- 15 inventory items and 345 direct/pair interaction routes.
- 57 phase/topic/repeat dialogue routes and 50 special/terminal/ending routes.

## Exclusions

- **rendering and geometry data:** Pixel coordinates, polygons, animation frame tables, and layout geometry are not authored dialogue; hotspot identities remain indexed.
- **terminal interface labels and evidence records:** Static terminal controls and the separately published Nansen request/record catalogs are not character dialogue; terminal-triggered speech and endings remain indexed.
- **development provenance and private acquisition inputs:** Historical build ledgers and private acquisition inputs are not shipped player-facing dialogue and are outside the public creative-writing explorer.

There are **zero unexplained omissions**. The machine receipt preserves source and explorer hashes, expected-versus-actual route counts, missing-ID checks, and action execution errors.

[Download the machine-readable coverage receipt](SCRIPT_EXPLORER_COVERAGE.json) · [Back to Script Explorer](index.md)
