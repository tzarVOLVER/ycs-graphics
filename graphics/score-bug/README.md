# Score Bug

A final-score graphic centred at the bottom of the 1920 × 1080 frame. Two bars sit
side by side with name, flag and score, scores towards the middle. Left player is
the blue bar and right player is the red bar, matching the chips and Siding. A small
box above the middle shows the round, with `MATCH COMPLETE` underneath.

`MATCH COMPLETE` is fixed text and shows whatever the score is. The round drops an
ending like ` OF 15` after a round number, so `ADVANCED ROUND 10 OF 15` shows as
`ADVANCED ROUND 10`. Custom text is shown exactly as typed.

It uses the existing BUG slot (internal ID `ticker`), so playing it replaces the
ticker or a player chip on that output. No new slot is needed.

Stop any L3 graphic before playing this. Siding, Shuffling and the Winner are in the
L3 slot, so playing this doesn't take them off. They use the same part of the screen
and L3 draws on top, so they would cover it.

## Fields

The fields use the same numbers, types and rules as Siding (`match-status/data.js`),
so Siding's data links copy across one for one.

| Field | Control |
| --- | --- |
| f4, f6 | Left and right player |
| f7, f8 | Left and right flag |
| f9, f10 | Left and right score |
| f5 | Current round |
| f15, f16 | Custom, and Custom text in place of the current round |

Siding's rounds-remaining fields (f2, f3) aren't used because this graphic doesn't
show that line. Flags can be HTTP(S) URLs or relative paths; a failed flag hides.

## Motion

The package's reveal: same easing, wipes and short slides, no opacity animation,
finished by 500 ms. Both bars open outward from the centre and the round box rises
into place. Stop reverses it from its current position in about 220 ms.

## Importing

SPX runs a template's inline scripts inside the server during import. Keep this
template's only inline script to the field definition, with nothing that loops or
waits. `tests/score-bug.test.js` checks this. There are no server changes, so adding
this template doesn't need an SPX restart. Changing the layout, as opposed to the
fields, doesn't need a re-import either.
