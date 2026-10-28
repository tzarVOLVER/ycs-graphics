# YCS SPX ticker

A separate [Current round data-link pilot](integrations/spx-data-link/README.md) tests chain-button Linked/Manual controls in an isolated SPX 1.4.1 rundown. It uses local test data; Sheets/API connectors are not included yet.

One reusable template for 1920 x 1080 broadcast output:

- `graphics/ticker/ticker.html` — use the same file in every stage rundown.

The template starts hidden and uses SPX Play, Update and Stop. Controls include status, current round, date/location, rounds-remaining toggle/text, logo/background and timing. The Stories field (`f14`) supplies a JSON story list; additional JSON (`f1`) remains available for other overrides. Each output owns an independent iframe and its rundown supplies its own values/mappings. The template has no fixed broadcast identity and loads neutral defaults with an empty playlist. Routing belongs to the controller, not the template. Stock SPX still requires its own layer/output routing.

`YCS-Ticker-1.html`, `YCS-Ticker-2.html` and `YCS-Ticker-3.html` are retained for older imports and their original instance/layer defaults. New imports should use `ticker.html`. The fork's `node ycs/share-ticker.cjs` migrates existing saved imports and template-default mapping keys with exact backups, preserving fields, manual/linked modes and graphic IDs. Run it while SPX is stopped. Legacy hidden `f0` metadata is ignored by the shared template.

## Package

```powershell
python scripts/package-spx.py
```

The resulting `dist/YCS-SPX-Tickers.zip` contains `ticker.html`, the legacy entry points and all shared assets, CSS, JavaScript and data. Extract its `YCS` folder into SPX `ASSETS/templates/`, then import `ticker.html`. Keep the shared folders beside it. No separate app or server is required beyond SPX.

## Layout and behavior

The fixed bar is 1586 x 80 at x=202, y=974 on a 1920 x 1080 canvas, following the supplied broadcast reference. The logo and centered left labels use the same reference placement. The right text box has 9 px side margins; round text keeps its base size and shrinks horizontally only when needed. The crawler keeps moving through category/topic transitions. Text fitting automatically refreshes after text edits, font loads, CSS/layout changes, and hidden-to-visible transitions. Measurements use layout widths so renderer/display scaling does not cause clipped labels.

The shared template loads only `data/defaults.json`; event content comes from SPX saved fields and data mappings. The legacy entry points still resolve `data/shared.json`, `data/stages/` and `data/instances.json` for compatibility. The ticker and header timing defaults are 145 px/s crawl speed, 180 ms topic entry delay, 180 ms header transitions and 10 ms label-swap gap.

## Validation

```powershell
node --test tests/*.test.js
```

SPX field/lifecycle bridges are tested in isolation. Live SPX playout still needs host validation. This is an SPX package; OGraf compliance is not claimed. OGraf preparation notes remain in `graphics/ticker/adapters/ograf/README.md` and are excluded from the SPX ZIP.

The ticker and controller share generated data helpers and the same contract fixtures. See [contracts/README.md](contracts/README.md) for regeneration and cross-repository checks. Both repositories remain independently deployable.


## Linked story playlists

The custom [YCS SPX fork](https://github.com/tzarVOLVER/ycs-spx/pull/1) adds a visual playlist mapper to Data Manager. Open the ticker's **Stories → Map story list**, choose a Sheets range or JSON array, then map its columns/properties to Category, Topic and Crawler text. For the current sheet, Published controls inclusion and Subtopic maps to Crawler text. Header names are configurable and remain stable when columns move. Missing/renamed/duplicated headers trigger a remapping warning.

Order and Story ID are optional. Without Order the source sequence is used; without IDs, content identity is used. Optional fields can be unused or fixed, with fallbacks for blank source values. Preview shows published, excluded and invalid records. Lists support up to 200 stories / 64 KB and 4000 characters per story text. Invalid live lists hold the previous valid playlist; all-unpublished is a valid empty list and drains the crawler.

A field's `ycsCollection` metadata declares its record keys to the mapper. This is an optional extension in the custom SPX fork, not a standard SPX field type or an OGraf compliance declaration. Stock SPX can still edit the Stories textarea as JSON. Each item has `category`, `topic`, `subtopic`, and optional unique `id`. The separate scalar controls still work.

Save mapping remains off air. Enable the Stories field link in the rundown and explicitly Play/Update to commit it. Switching to manual restores its saved JSON list. Later source refreshes keep visible/entering text moving and replace only the offscreen queue. The renderer continues after the last visible Story ID when possible; changing category/topic timing never pauses the crawl.

Before the first Play, a mapped story list replaces the hidden bootstrap queue and header completely, so bundled sample stories cannot enter program. After the ticker has been shown, live updates retain the continuous-crawl behavior described above.

For a three-stage test on one computer, the fork provides `npm run ycs:rehearsal` and a separate loopback monitor at `http://127.0.0.1:5661/rehearsal`. It uses these templates with disposable rundowns and simulated Sheets/JSON data. See the fork's YCS.md for playback, source-outage, reload/reconnect and server-restart checks; it leaves saved event configuration untouched.

Existing fork demo rundowns need the additive upgrade documented in the fork's YCS.md. Reimport/update the template definition for other SPX installations. Rebuild the SPX ZIP after template changes.
