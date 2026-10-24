# YCS SPX ticker templates

Three SPX templates for 1920 x 1080 broadcast output:

- `graphics/ticker/YCS-Ticker-1.html` — broadcast-1, default layer 7
- `graphics/ticker/YCS-Ticker-2.html` — broadcast-2, default layer 8
- `graphics/ticker/YCS-Ticker-3.html` — broadcast-3, default layer 9

Each template starts hidden and uses SPX Play, Update and Stop. Controls include status, current round, date/location, rounds-remaining toggle/text, logo/background and timing. Additional JSON data can supply `tickerItems`. Each template is assigned to its own instance; route its layer to the intended output in SPX.

## Package

```powershell
python scripts/package-spx.py
```

The resulting `dist/YCS-SPX-Tickers.zip` contains the three HTML templates and all shared assets, CSS, JavaScript and data. Extract its `YCS` folder into SPX `ASSETS/templates/`, then import the three HTML files. Keep the shared folders beside them. No separate app or server is required beyond SPX.

## Layout and behavior

The fixed bar is 1586 x 80 at x=202, y=974 on a 1920 x 1080 canvas, following the supplied broadcast reference. The logo and centered left labels use the same reference placement. The right text box has 9 px side margins; round text keeps its base size and shrinks horizontally only when needed. The crawler keeps moving through category/topic transitions. Text fitting automatically refreshes after text edits, font loads, CSS/layout changes, and hidden-to-visible transitions. Measurements use layout widths so renderer/display scaling does not cause clipped labels.

Shared ticker data is in `graphics/ticker/data/shared.json`. Stage-specific data is in `data/stages/`, with per-instance mappings in `data/instances.json`. SPX fields override the resolved data. The ticker and header timing defaults are 145 px/s crawl speed, 180 ms topic entry delay, 180 ms header transitions and 10 ms label-swap gap.

## Validation

```powershell
node --test tests/*.test.js
```

SPX field/lifecycle bridges are tested in isolation. Live SPX playout still needs host validation. This is an SPX package; OGraf compliance is not claimed. OGraf preparation notes remain in `graphics/ticker/adapters/ograf/README.md` and are excluded from the SPX ZIP.
