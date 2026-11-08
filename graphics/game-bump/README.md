# YCS Game Bump

A full-screen "GAME 2" bump, rebuilt from the CharacterWorks `FS - GAME BUMP` and styled like the
head-to-head (it shares that graphic's background still and fonts from `../head-to-head/assets`).

- **Play:** the blue and red "IT’S TIME TO DUEL!" outlines, turned on their sides with the tops of the
  letters facing the middle, slide out from behind the centre line (each is masked to its own half of
  the frame), hold, then ease out to the left and right edges and dim. A blue and a red bar draw down
  the middle and split sideways, opening onto the background, and the game number drops in from above.
  About 1.55s.
- **Hold:** the outlines keep running at 64 px a second (blue down, red up), as in the original.
- **Stop:** one clean wipe: a horizontal gap opens from the centre line until the frame is clear.
  About half a second, well inside SPX's 2s exit limit.

## Fields

| Field | What | Notes |
|---|---|---|
| f1 | Game number | Shows as "GAME 2". Links to the match's `/gameCount`, the current game number. A blank or odd value shows no text rather than a wrong number. It's a text field with a blank default on purpose: as a number field, SPX would swap a blank or 0 for the typed default. |

## Needs

- The `full-screen` slot (already set up for the head-to-head: order 40, exitMs 0).
- The head-to-head's font notes apply: the scroll uses the Owners Narrow trial file if it's present,
  otherwise Anybody Condensed Black Italic.
- Still worth one look on a real vMix output.
