# A small system overview

Tarka combines an office adventure with a data-investigation terminal. Both are browser interfaces built with React, TypeScript, and a static asset pipeline. Pure state transitions keep saved clues, queries, records, and case completion separate from how the current screen is drawn.

The office provides walking, the verb tray, inventory, dialogue, and authored character/prop animation. Low-resolution raster assets and nearest-neighbour scaling support the intended pixel-art look. Animation presentation does not decide which historical fact is true.

The terminal searches the bundled case collection. CASE owns earned progress; a query owns its input and matches; navigation owns which list, record, or detail page is open. Reopening history is not a new request. Looking at a possible lead is not verification. Saving the report is not closing the case.

Acquisition and compilation run outside ordinary browser play. Original provider responses and credentials remain outside public assets. Selected records carry source associations and limits into the game.

This separation is also useful for delivery: the runtime can be served as static files, with no database, model session, or per-player Nansen request. The [data method](data/method.md) contains the deeper technical explanation where it matters most.

The production build is a static single-page application. It has no service
worker, backend, wallet connection, runtime API key, or live provider call.
Required art, audio, fonts, scenario data, and the frozen evidence collection
ship under `public/` and are copied byte-for-byte into the production build.
