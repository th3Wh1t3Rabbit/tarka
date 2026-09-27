# Documentation tools

The public documentation site is generated from `README.md` and every Markdown
file under `docs/`. It makes no provider calls and does not require the game to
be running.

Install the one pinned Python dependency and rebuild:

```bash
python3 -m pip install -r scripts/docs/requirements.txt
python3 scripts/docs/BUILD_DOCUMENTATION.py
npm run docs:verify
```

`navigation.json` and `reading-order.json` control organization. The builder
writes the searchable static site to `docs-site/`, copies the public data and
figures, and records source hashes in `docs-site/build-manifest.json`.

`npm run docs:verify` is deliberately independent of private production
folders. It validates page/request/record/figure counts, local links, release
markers, generated deep links and assets, public URLs, image decoding, and the
absence of machine-specific paths or private creator identity.
