# Game / match winner

Import `blue.html` and `red.html` as separate templates. They share the approved
center-out wipe, text reveals, geometry and easing. Both start hidden on a
transparent 1920 × 1080 canvas and default to L3 (stock SPX layer 2).

| Field | Purpose |
| --- | --- |
| f1 | Player name; horizontally fits long names |
| f2 | Game number, integer 1–3; linkable |
| f3 | Winning player's score, integer 0–2; linkable |
| f4 | Champion checkbox: turns the plate gold (#f3ce48) on both sides |
| f5 | Champion text: replaces the caption while Champion is ticked; blank shows CHAMPION |

Score 2 displays MATCH WINNER regardless of game number. Otherwise the caption is
GAME X WINNER. While Champion is ticked, the caption is the Champion text instead and
both Blue and Red look the same; unticking it restores the normal caption and colour. The score itself is never drawn. Player name, game number and
player score are all exposed together in the main template editor. Assign their
sources in Data Manager and enable the corresponding chain buttons.

Use the completed game's number and the winner's score after that game. Updates
change text without replaying the entrance or starting a stopped graphic.
Blue and Red replace each other when assigned the same L3 slot.

Build: `python scripts/package-spx.py --graphic winner`. Extract the entire YCS
folder from `dist/YCS-SPX-Winners.zip` into SPX ASSETS/templates. The package
includes shared helpers and both fonts in their expected relative locations.
It can also be extracted into an event bundle's `spx/ASSETS/templates` folder.
Import `YCS/winner/blue.html` and `YCS/winner/red.html` into the project, then add
the required items to its rundown. No existing rundown or mappings are modified.
