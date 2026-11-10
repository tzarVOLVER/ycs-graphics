# Orlando event snapshot

`scripts/package-event.py` captures the adjacent `ycs-spx` checkout and its current
`.local/ycs-dev.json`, stage project JSON files, connections, mappings and restart
cache. It preserves item IDs, manual/linked modes, field values and slot settings.
The bundle includes graphics, installed SPX assets, dereferenced dependencies,
the current Windows Node executable and its official license.

Pause show edits while exporting:

```powershell
python scripts/package-event.py --output dist/YCS-Orlando-Snapshot
```

Use a new output directory for each export. A changed show file causes export to
fail rather than accepting inconsistent content. Generated bundles are ignored
by Git and contain a command API key; transfer the ZIP privately. The exporter
requires the Node license cache or internet access to obtain the version's license.
Local-file connections require additional explicit packaging and are rejected.

On the destination Windows x64 machine, extract the entire ZIP into a writable
local folder and run **Start Orlando.cmd**. **Stop Orlando.cmd** stops that copy.
No Node installation or dependency download is needed. Do not run another SPX
instance on port 5660. All application and graphics paths are bundle-relative.

The event configuration listens on all network interfaces, preserves the existing
controller login policy, and requires the configured `ycs.apiKey` for remote
Companion API requests. Allow inbound TCP 5660 on the production LAN. Retrieve
the key from `spx/.local/ycs-dev.json`; do not put it in URLs. Companion uses a
GET action with `Authorization: Bearer YOUR_KEY`.

Program URLs are `http://SERVER-IP:5660/output/stage-N/program` for N = 1, 2, 3.
Preview URLs end in `/preview`. Google Sheets live refresh needs internet access.
Program starts stopped. Review preserved test/event text before going on air.

This is a snapshot at export time. Later edits to the working checkout do not
update an existing ZIP. Export again after finalizing the show, then rehearse on
the actual LAN and vMix machines. `manifest.json` records the application commit
and SHA-256 hashes for the bundled files.

The bundle copies the Node executable from the exporting computer. Export with
the version in `.nvmrc` (`node --version`), so every event ships a tested Node.

## Tag the release

After the final export, tag both repositories with the same event name, so the
exact code that ran can always be found and rebuilt:

```powershell
git -C ../ycs-spx tag orlando-2026-11
git -C ../ycs-spx push origin orlando-2026-11
git tag orlando-2026-11
git push origin orlando-2026-11
```

Use `EVENT-YYYY-MM` (for example `orlando-2026-11`). Export from a clean
`master`/`main` with all tests passing; tag only what was exported.

Decktype artwork served through `ycs.decktypeFolders` is external to the template
assets. The exporter preserves that ordered folder configuration, but does not
copy those external image folders. Before running on another computer, copy or
make the PNG folders available there and update `spx/.local/ycs-dev.json` with
that machine's paths. Restart SPX after changing the list. A local event copy is
recommended when using Google Drive streamed folders during development.
