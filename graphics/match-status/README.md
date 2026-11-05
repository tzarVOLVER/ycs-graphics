# Shuffling and Siding

Two independent SPX template imports share one renderer and stylesheet:

- `shuffling.html`: player names, flags and round information; fixed **DUELISTS SHUFFLING** caption.
- `siding.html`: the same fields plus two scores; fixed **DUELISTS SIDING** caption.

Both use a transparent 1920 × 1080 canvas and the Figma artwork's fixed coordinates.
The colored panels open outward from the center; player details rise through
clipping frames and the caption slides down through its own frame. The round
panel rises through a separate mask, including its optional remaining-rounds line.
There are no opacity fades, per-player switches, appearance controls or timing fields.
**Show rounds remaining** is the only checkbox. Clearing it hides that line and
centers the current round within its existing panel. All labels shrink horizontally
when necessary and retain their original size for shorter values.

Play animates in; Stop reverses the entrance at double speed (about 224 ms,
within the controller's existing 250 ms slot retirement). Updating
values never plays a hidden template or restarts an entrance. SPX previews edits;
Play/Update commits them to Program. Companion uses saved rundown values.

Names, round and remaining text use regular SPX text fields. Scores are nonnegative
number fields. The flag selectors use local PNG files in `assets/`; `us.png` is
included, and additional flag files can be added there. The `-` option clears a
flag while retaining the name layout. The optional `ycsPrimary: true` field metadata
keeps flags and scores inline in the YCS fork's editor. Stock SPX retains its own
field layout. There is no SPX field for either fixed caption.

## Install

```powershell
python scripts/package-spx.py --graphic match-status
```

Extract the entire `YCS` folder from `dist/YCS-SPX-Match-Status.zip` into
`SPX/ASSETS/templates/`. Import `YCS/match-status/shuffling.html` and
`YCS/match-status/siding.html` separately. Keep their assets, `YCS/shared` and
the included `YCS/ticker/assets/Anybody-Bold.otf` file in place. Both use the
YCS fork's existing `lower-third` slot, so playing one replaces another graphic
in that slot. Stock SPX defaults to layer 2. The same imports can be reused in
different stage rundowns with independent data.

## Design and assets

Built from the user's revised Figma frames:

- [Shuffling, node 1:20](https://www.figma.com/design/H5MkSqv4bz6txKLV7i2Zvn/Untitled?node-id=1-20)
- [Siding, node 1:64](https://www.figma.com/design/H5MkSqv4bz6txKLV7i2Zvn/Untitled?node-id=1-64)

The original blue-panel SVGs are used unmodified at their intrinsic 490 × 67 size
(nodes 1:47 and 1:74), with the original flag bitmap at both flag locations. Red
panels, the round box and Shuffling's gradient backing follow the native shapes
in the Figma definitions. Siding has no gradient backing in the revised design.
The reference artboard fill and earlier camera photographs are not output artwork.

Fonts are bundled for portable playout: Apotek Comp Medium for round/caption,
Apotek Bold for scores, Anybody Bold for names/remaining text, and Anybody Expanded
ExtraBold for VS. The existing Anybody Bold asset is reused; Apotek styles came
from the user's registered FontBase files. Runtime assets have no temporary Figma
URLs or external font-service dependency. This is an SPX template; OGraf compliance
is not claimed.

## Motion reference

The Shuffling Motion tab (node 1:20) supplies the entrance: 2 s total with motion
complete at 22.426% (448.52 ms), followed by a hold. Its panel scaling origins,
translation tracks and cubic-bezier curves are preserved in `match-status.css`.
Repeated tracks share keyframes. Real positioned wrappers carry group animation;
inner text spans retain independent horizontal auto-fit transforms.

SPX plays once and holds instead of repeating Figma's preview loop. Siding uses
the same choreography; its Figma frame had no authored motion yet. The round panel
and scores extend the supplied motion style. VS retains the reference translation
but reveals through a clip rather than using the exported opacity track, preserving
the no-fades requirement. Reduced-motion rendering shows the final layout directly.

`motion.js` reverses actual browser animation positions, skipping the trailing
hold. An interrupted exit resumes from its current frame; stale completion
callbacks cannot hide a replayed graphic. Updates never restart these tracks.
