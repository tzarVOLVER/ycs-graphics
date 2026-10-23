# YCS Graphics

Reusable broadcast graphics. The first graphic is the YCS ticker, based on the supplied ChatGPT prototype.

## Run locally

Requires Node.js 22 or later. No packages or build step are required.

```powershell
node scripts/serve.mjs
```

Open [the three-broadcast preview](http://127.0.0.1:8000/graphics/ticker/preview.html). Use a transparent 2048 × 1080 browser source for each output. The bar and its background remain exactly 2048 × 103 pixels, matching the supplied PNG at native size:

- [Broadcast 1](http://127.0.0.1:8000/graphics/ticker/ticker.html?instance=broadcast-1)
- [Broadcast 2](http://127.0.0.1:8000/graphics/ticker/ticker.html?instance=broadcast-2)
- [Broadcast 3](http://127.0.0.1:8000/graphics/ticker/ticker.html?instance=broadcast-3)

Set the SPX/browser source canvas to 2048 × 1080 to see the full width. The bar stays 65 pixels above the bottom of the canvas. Narrower windows crop the output rather than shrinking it. The preview is read-only, has no operator controls, and scrolls horizontally to show the complete native-width bar.

Serve over HTTP; opening the files directly does not support JSON/module loading. Bind the supplied server to localhost only. A production graphics server can serve the same static files.

## Ticker behavior

The crawler moves right to left at the prototype's default 145 px/s. A topic change is detected when the leading edge of the next subtopic crosses the crawler viewport's **right edge**. After a configurable delay, the old category/topic fades and slides up, the labels swap, and the new labels animate in. This never changes the track's opacity, playback state, position, or animation clock. Consecutive subtopics with the same category/topic do not reanimate the header.

The supplied logo, background, Anybody/Apotek fonts, colors, native PNG dimensions, spacing, round fitting, and 650 ms whole-ticker entrance/exit are retained. `graphics/ticker/prototype.html` is a comparison reference with only its asset paths adjusted. The new output fixes the bar dimensions and fits the date/location horizontally within the left panel so they do not clip. The default content, including the original 2024 event date, is sample content from that prototype.

Timing settings, in milliseconds:

| Setting | Default | Purpose |
| --- | --- | --- |
| `topicEntryDelayMs` | 180 | Wait after text enters from the right before starting the header's exit |
| `headerTransitionMs` | 180 | Duration of the existing opacity/vertical transition, in each direction |
| `headerSwapGapMs` | 10 | Extra wait between the outgoing transition and label replacement |

The new label starts animating in 370 ms after entry at the defaults: 180 ms entry delay + 180 ms exit + 10 ms gap. A value of zero is supported. These settings affect the header only. The prototype's 50 ms frame-gap cap is preserved after a browser stall; keep the actual broadcast output rendered and unthrottled.

## Shared, stage, and instance data

Edit `graphics/ticker/data/shared.json` for event-wide fields and messages. Edit `data/stages/stage-1.json`, `stage-2.json`, or `stage-3.json` for stage fields/messages. `data/instances.json` maps each of the three broadcasts to a stage and optional overrides. Stage names are placeholders and can be changed in that mapping.

Scalar precedence is **shared → stage → instance override**. Shared ticker items are followed by stage ticker items. An explicit instance `tickerItems` override replaces the combined playlist. Each item is `{ "category": "…", "topic": "…", "subtopic": "…" }`.

For example, stage-2.json can contain:

```json
{
  "currentRound": "FEATURE MATCH — ROUND 4",
  "tickerItems": [
    { "category": "STAGE 2", "topic": "NEXT MATCH", "subtopic": "Please return to the feature match area." }
  ]
}
```

For a different timing on broadcast 3, use `"overrides": { "topicEntryDelayMs": 250, "headerTransitionMs": 180 }` in its instance configuration.

JSON is read on load or explicit `Ticker.reloadData()`; there is no automatic polling or backend. SPX fields control rundown output; direct API updates are in memory. To persist changes, edit the JSON and commit them to GitHub. Playlist changes join at the offscreen tail, after text already queued; they do not replace visible text or rewind the crawler. Existing queued content can take some time to drain, especially at low speeds. An empty playlist drains gracefully. Asset/font changes should be rehearsed off air.

## Control API

The original browser API remains available, with operations returning promises:

```javascript
await Ticker.ready;
await Ticker.show();
await Ticker.update({ status: 'COMING UP', topicEntryDelayMs: 200 });
await Ticker.update({ logo: './assets/another-logo.png', background: './assets/another-background.png' });
await Ticker.updateShared({ location: 'YCS LOCATION' });
await Ticker.updateStage({ currentRound: 'SWISS ROUND 7 OF 14' });
await Ticker.hide();
// Explicit operator controls, never invoked by a topic change:
await Ticker.pause();
await Ticker.resume();
Ticker.getData();
Ticker.getState();
```

Use `?autoplay=0` to start hidden. `hide()` hides the whole ticker using the original entrance/exit animation and leaves its crawler running. `Ticker.dispose()` releases frame callbacks and listeners. Selecting another configured instance or calling `reloadData()` reloads its data and discards temporary overrides.

A same-origin parent frame can send `{ type: 'YCS_TICKER', action: 'update', data: { status: 'COMING UP' } }` via `postMessage`, using the exact origin as `targetOrigin`. Supported actions: `update`, `shared`, `stage`, `show`, `hide`, `pause`, `resume`, `reload`. An optional `instanceId` targets one broadcast. Cross-origin control is intentionally unsupported; use a trusted host adapter if it becomes necessary.

## Integration status

`adapters/spx.js` exposes `update`, `play`, `stop`, `runAnimationIN`, and `runAnimationOUT`; the HTML includes an SPX template definition. The adapter accepts classic SPX `{"data":[{"id":"f0","value":"broadcast-1"},{"id":"f1","value":"{}"}]}` payloads or field objects. Native SPX fields:

| Field | Control | Data |
| --- | --- | --- |
| `f0` | Dropdown | Broadcast instance |
| `f2` | Checkbox | Show rounds remaining; checked = `"1"`, unchecked = `"0"` |
| `f3` | Text | Rounds-remaining label |
| `f4` | Text | Status |
| `f5` | Text | Current round |
| `f6` / `f7` | Text | Day/date and location |
| `f8` | Number | Crawl speed (px/s) |
| `f9` / `f10` | Number | Topic entry delay and header transition (ms) |
| `f11` / `f12` | File list | Logo and background PNGs |
| `f1` | JSON text | Additional data, including `tickerItems` and `headerSwapGapMs` |

Native fields take precedence over the same properties in `f1`. Omitted fields retain their current data; an unchecked rounds checkbox is treated as false rather than a truthy string. Hiding the remaining line expands the status/current-round typography, and toggling it leaves the crawler running.

Copy the complete `graphics/ticker/` directory into an SPX template folder, retaining its `src`, `adapters`, `data`, and `assets` directories. Import `ticker.html` into the SPX project, or re-import it if already added, so SPX discovers the new field definitions. Use SPX Update for field changes and Play/Stop for the whole ticker. Incoming SPX commands before initialization suppress standalone autoplay; use `?autoplay=0` for explicitly controlled startup where the host supports it.

 Assign distinct SPX layers/channels to independently controlled outputs. The default layer 7 is a template default, not three separate SPX deployments. Start controlled output hidden with `?autoplay=0` where the host supports it. The native field mapping and bridge are browser-tested, **not yet tested in an installed SPX playout session**. See the [SPX template documentation](https://docs.spxgraphics.com/Documentation/Graphic%2BTemplates/Formats/HTML).

This is **not an OGraf-compliant package**. The core renderer and its lifecycle are separated to support a future OGraf adapter. The [OGraf preparation notes](graphics/ticker/adapters/ograf/README.md) describe the remaining manifest, Web Component, packaging, and renderer validation work, based on the [EBU specification](https://github.com/ebu/ograf/blob/main/v1/specification/docs/Specification.md).

## Validation

```powershell
node --test tests/*.test.js
```

With the local server running, open [browser checks](http://127.0.0.1:8000/graphics/ticker/qa.html) and click **Run checks**. It compares prototype styling at the native width and checks fixed dimensions in smaller windows, label fitting, timing, uninterrupted motion, instance isolation, shared updates, and the SPX lifecycle/rounds checkbox. The test temporarily changes content/speed inside its own frames. These checks do not establish live broadcast frame pacing or SPX/OGraf host compatibility.

## Project layout

- `graphics/ticker/`: broadcast HTML, preserved styling/assets, and preview
- `graphics/ticker/src/`: reusable renderer, timing, data, and browser entry point
- `graphics/ticker/data/`: shared content, stage content, and three instance mappings
- `graphics/ticker/adapters/`: host-specific integration
- `tests/`: timing/data unit tests and browser checks
- `scripts/`: dependency-free local preview server

Future graphics can live alongside `graphics/ticker/` without sharing mutable output state.
