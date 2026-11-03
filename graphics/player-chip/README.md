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
| f5 | Decktype image URL |

All controls are exposed together and linkable. RECORD is a fixed caption.
The format automatically selects the YCS logo for Advanced or the Genesys logo
for Genesys. There is no exposed logo selector. Blank format hides the logo;
unsupported format values reject the update and retain the previous graphic.
Image fields accept HTTP(S) or relative asset URLs. The included Figma artwork
is sample data. A network image folder must be served over HTTP by the SPX
computer or another asset server; direct UNC/drive/file URLs do not work in the
remote browser outputs. Hosting that folder is a separate deployment setting.

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
