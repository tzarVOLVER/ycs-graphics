# SPX Current round data-link pilot

This one-field test adds a chain button to the normal SPX rundown editor. It runs a separate copy of the installed SPX Solo 1.4.1 binary on port **5657**. The original installation, projects, and port 5656 are not modified. No SPX server source is patched.

The data service on **127.0.0.1:8787** supplies editable local test data. **Google Sheets and API connectors are not implemented yet.** No account or credentials are needed. The browser, SPX, and service must run on the same computer for this pilot.

## Start and use

With Node.js available, run from the repository root:

```powershell
.\integrations\spx-data-link\start-test.ps1
```

Pass `-NodePath` with a full executable path if Node is not on PATH. Use `-SpxInstallation` if SPX is installed somewhere other than `C:\SPX1.4.1`. Processes launch hidden. Open:

<http://127.0.0.1:5657/gc/YCSLinkTest/CurrentRound>

1. Double-click the test item. Only **Current round** has the chain button.
2. Gray chain means manual: enter custom text. Its value and link settings are saved without applying to program.
3. Click the chain. Green means linked: the field shows source text and becomes read-only. The embedded SPX preview updates.
4. **DATA MANAGER · LINK TEST** opens the source editor inside SPX. Publish a new test value there.
5. **Play** shows the graphic. **Update / F5** commits the editor's mode and values without restarting the graphic. Once linked on program, subsequent source changes arrive within roughly two seconds automatically.
6. Unlink to restore your saved manual text, edit it, then Update to apply the override on air.
7. Reopen the rundown to check persistence. Automatic program replay on reopening is deliberately off in this isolated instance.

An amber chain means the service is unavailable or its data is invalid. Linked graphics retain their last valid round and retry; manual fields never follow the source. Before the first successful source read, the saved SPX field supplies the fallback.

Link mode is an editor setting until Update/Play. If program was already linked, it continues following the source while an unlinked manual edit is pending. Save and reopening do not commit editor changes on air.

Do not point a production browser source at this test renderer. This test has no CasparCG server configured.

## Stop

```powershell
.\integrations\spx-data-link\stop-test.ps1
```

The stop script checks recorded executable paths before stopping processes. If Windows denies access, use a normal terminal with sufficient permissions. Saved source data remains in `.local/spx-data-link/`; the separate SPX project is in `.local/spx-data-link-test/`.

## Implementation and scope

- The plugin enhances only `YCS-Ticker-Link-Test.html`. Current round is `f5`; hidden field `f13` stores versioned mode, source ID, and separate manual text in the rundown, rather than browser storage.
- The adapter connects only when `f13` is present. The three production entry points do not declare it and make no data-service requests.
- The service atomically saves validated source values. It listens on loopback, checks Host/Origin, caps request size, and requires JSON plus a custom header for writes. It stores no credentials.
- The plugin uses the controller's ordinary save/playout routes, not licensed automation APIs. It explicitly includes `projectFormat: SPX` to avoid 1.4.1's OGraf default for prepopulated updates.
- Saved Play escapes field strings while Update sends raw strings. Link metadata supports both. Read-only inputs remain collectable by SPX.
- Live updates patch only the round. They do not reload, Play/Stop, or replace the crawler playlist. After initial loading, preview updates also reuse the graphic.
- This is a single-operator, one-source pilot. General source mapping, multiple stages/sources, API authentication, Google Sheets, cross-machine access, and multiple-controller conflict handling remain future work.
- Editor DOM and controller routes are specific to SPX 1.4.1; revalidate after upgrading SPX.

Run `node --test tests/*.test.js` for regression checks.
