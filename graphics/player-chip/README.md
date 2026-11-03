# Blue and Red player chips

Two entry points share their renderer, styles, fonts and approved 500ms reveal.
There is no positional settle or opacity animation. Blue anchors at x=145, y=815;
Red anchors 145px from the right edge of the 1920 × 1080 canvas and mirrors the
layout/direction while keeping text and artwork readable. Exit finishes within
220ms. Loading, updating and switching linked values never starts playback.

Width is at least 410px and grows to fit the full name with 38px end padding.
The end artwork region is 196px wide; names can overlap it. Extremely long names
are horizontally fitted only once the chip reaches the screen edge (1775px).
Images can be blank; failed images hide without a broken-image icon.

| Field | Control |
| --- | --- |
| f1 | Player name |
| f2 | Record, such as 9W - 2L |
| f3 | Flag image URL |
| f4 | Format: Advanced or Genesys (case-insensitive) |
| f5 | Decktype name, matching its PNG filename without .png |

All controls are exposed together and linkable. RECORD is a fixed caption.
The format automatically selects the YCS logo for Advanced or the Genesys logo
for Genesys. There is no exposed logo selector. Blank format hides the logo;
unsupported format values reject the update and retain the previous graphic.
Flag image accepts HTTP(S) or a relative asset URL. Decktype accepts the API's
name, for example ANCIENT GEAR, and requests `/decktypes/ANCIENT%20GEAR.png` from
the SPX server. Spaces and punctuation are URL-encoded. Empty names hide artwork;
missing images leave the name and record visible. Decktype names are filenames,
not paths or URLs. There is no exposed image path for decktype or format logo.

The SPX fork serves multiple image folders through `ycs.decktypeFolders`:

```json
"decktypeFolders": [
  "C:/YCS/Decktypes/Event",
  "H:/Shared drives/YCS 2024/CHARACTERWORKS/ASSETS/DECKTYPES"
]
```

Folders are searched in order; the first matching PNG wins. Missing/unavailable
folders fall through to the next folder. Files are matched directly in each
folder, not recursively. Filename case follows the server filesystem (normally
case-insensitive on Windows). Only the central SPX computer needs access to
these folders. Change paths for the event machine, then restart SPX. The route
is read-only, exposes no directory listing, and cannot follow a file symlink
outside its configured folder. Templates use the same origin as their output.

The template ZIP includes the overlay and assets, but the `/decktypes` endpoint
requires the updated SPX fork or an equivalent HTTP asset route on another host.

Build with `python scripts/package-spx.py --graphic player-chip`. Extract the
whole YCS folder into SPX ASSETS/templates, preserving shared helpers and assets,
then import `YCS/player-chip/blue.html` and `YCS/player-chip/red.html`.

For simultaneous playback, add these slots to `ycs.slots` in the SPX configuration:

```json
"chip-blue": {"label":"BUG Blue","order":11,"exitMs":250},
"chip-red": {"label":"BUG Red","order":12,"exitMs":250}
```

The templates default to those independent slots; restart SPX after adding them.
Other forks/configurations need equivalent assignments. Stock SPX uses separate
web layers 3 and 4. Existing projects/rundowns are not imported or rewritten by
extracting the package. Rebuild the Orlando deployment snapshot after final setup.
