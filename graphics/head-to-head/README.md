# YCS Head to Head

A full-screen versus graphic, rebuilt from the CharacterWorks `FS - HEAD2HEAD` motion.

- **Play:** two "IT’S TIME TO DUEL!" outlines open in the middle, a blue and a red bar split the
  screen open onto the hieroglyph background, and both players build in from the centre. About 1.6s.
- **Hold:** the outlines keep running (blue left, red right, 64 px a second, as in the original).
- **Stop:** the players leave towards the sides, the round rises into the middle and holds, then
  the bars close the screen back to the centre. About 1.8s, inside SPX's 2s exit limit (with the
  slot's exitMs at 0 to 100, see below), so one Stop does the whole out. Stop doesn't wait behind a
  data update that's still loading.

## Fields

| Field | What | Notes |
|---|---|---|
| f5 | Current round | "ADVANCED ROUND 9 OF 14" shows as "ADVANCED ROUND 9" |
| f15, f16 | Custom, Custom text | Custom text is shown exactly as typed |
| f4, f6 | Left (blue) and right (red) player | Squeezed to fit if long |
| f7, f8 | Flags | |
| f11, f12 | Records | Draws are dropped; "7W - 1L" shows as "7W-1L" |
| f13, f14 | Decktypes | A deck name, loaded from SPX's `/decktypes/` folders; a name that can't be a file shows no art rather than stopping the graphic |
| f17 to f22 | Deck framing | Zoom %, left to right %, top to bottom % for each side |

f4 to f8, f15 and f16 have the same numbers and meanings as Siding, so Siding's links copy across.
The records and decktypes link like the player chips' (`/blueDuelist/record`, `/blueDuelist/deckType`
and the red equivalents).

## Deck framing

Every decktype image is the same size, but the art sits differently in each, and the window only
shows a wide strip of it. Framing is saved once per deck in `decktype-framing.json`:

```json
{ "decks": { "BLUE-EYES BRANDED": { "zoom": 130, "x": 50, "y": 30 } } }
```

`zoom` is a percentage of the size that just fills the window (100 to 400). `x` and `y` are the point
of the picture to keep in view, from the left and from the top (50, 50 is the centre). Deck names
ignore capitals and extra spaces. The file is read with every data update, so a change is used the
next time the graphic loads its data.

Numbers typed in a graphic's Deck framing fields override the saved framing for that graphic, whatever
deck it shows, so clear them when the match changes; blank uses the saved framing. A typo there is
ignored rather than stopping the graphic.

## Needs before it goes on air

- **A `full-screen` slot** in SPX's settings, above L3 (for example order 40, exitMs 0). SPX waits
  for Stop and then exitMs, and removes the graphic at 2s whatever happens, so a larger exitMs only
  adds a timeout warning. Adding a slot needs an SPX restart, so do it off air, then import the
  template and add it to a rundown.
- **Fonts:** Anybody stands in for the original's Loos fonts. The scroll uses Owners Narrow Black
  Italic, but the copy in `assets` is a trial marked "Personal Use Only", so it needs a proper licence
  for broadcast. Delete `assets/OwnersNarrow-BlackItalic.otf` and it falls back to Anybody Condensed
  Black Italic with no other change.
- **Background:** a still of frame 51 of the CharacterWorks background loop, which matches the
  original's hold. The moving loop could later be a short MP4 instead of 950 PNGs.
- **vMix:** measured in vMix's own browser engine (Chromium 115) at 60fps with GPU acceleration off,
  as the stages run: the hold is a steady 60fps, the build and out about 53fps with an occasional
  dropped frame. With GPU acceleration on, the start of the close froze for about a quarter of a
  second; the ticker's two-corner-pixel fix clears that, and the graphic turns it on by itself when
  it finds it has the GPU (`shared/gpu.js`), so either vMix setting works. Still worth one look on a
  real vMix output.
