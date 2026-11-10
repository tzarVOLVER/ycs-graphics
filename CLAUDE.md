# ycs-graphics

On-air HTML graphics for YCS events, played by the SPX controller in the sibling
`ycs-spx` repository. Also holds Decktype Composer (`index.html`), preview pages
and the event packager.

Keep both repositories side by side:

```text
GitHub/
  ycs-graphics/   this repo: templates and assets
  ycs-spx/        controller (SPX fork) that serves these templates
```

## Layout

- `graphics/<name>/` – one folder per graphic: ticker, winner, score-bug,
  head-to-head, game-bump, lower-third, match-status, player-chip, stage-monitor
- `graphics/shared/` – helpers shared by several graphics
- `contracts/` – the data contract source (`data-contract.js`) and `fixtures.json`
- `integrations/spx-data-link/` – SPX field/data-link bridge
- `previews/` – standalone preview pages for chips and winner
- `scripts/` – packaging and contract sync
- `tests/` – Node test runner tests, one file per graphic or feature

## Commands

- `npm test` – all tests (no dependencies to install)
- `npm run contracts:check` – confirm generated contract copies, here and in
  `../ycs-spx`, match `contracts/data-contract.js`
- `npm run contracts:sync` – regenerate those copies after changing the contract.
  Commit the regenerated files in **both** repositories.
- `python scripts/package-event.py --output dist/YCS-<Event>-Snapshot` – full
  event bundle (see `EVENT-DEPLOYMENT.md`)
- `python scripts/package-spx.py` – ticker-only ZIP for a stock SPX install

Node version: see `.nvmrc`. The event bundle copies the Node executable from the
exporting computer, so export with that version.

## Rules

- Never commit to `main` directly. Use a short branch (`fix/...`, `feature/...`),
  open a pull request, let the Tests check pass, merge. Branches are deleted on merge.
- Merge finished work promptly; don't start a new branch on top of an unmerged one.
- Edit the contract only in `contracts/data-contract.js`, then run
  `npm run contracts:sync`. Never hand-edit generated copies (they start with
  `// Generated from ycs-graphics/contracts/data-contract.js`).
- Graphics must keep working when data is blank or a source is offline: show blank,
  never `undefined`, and never reject the update.
- Text from data is rendered as text, not HTML.
- Before an event, follow `../ycs-spx/SHOW-DAY.md` (freeze, rehearse, package, tag).

## Testing in SPX

Tests cover templates in isolation. To see a graphic live, run ycs-spx's dev
server or rehearsal (`npm run ycs:rehearsal` in `../ycs-spx`), which serves the
templates straight from this checkout.
