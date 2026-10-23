# OGraf adapter preparation

Status: preparation only. Neither `ticker.html` nor the SPX adapter is an OGraf entry point, and no compliance claim is made.

The [EBU OGraf v1 specification](https://github.com/ebu/ograf/blob/main/v1/specification/docs/Specification.md) requires a `.ograf.json` manifest and an exported Graphic Web Component, with the resources it uses. HTML alone does not satisfy those requirements. Check the then-current v1 schema and interface when implementing the adapter; this note was checked on October 23, 2026.

The reusable pieces are already separated:

- `src/data.js` resolves and validates the graphic's input data.
- `src/timing.js` controls entry-trigger timing without affecting the crawler.
- `src/renderer.js` owns one graphic's animation state, show/hide/update behavior, and disposal.
- `src/main.js` is the standalone browser bootstrap and should not be imported as the OGraf entry point.

Remaining work:

1. Export an isolated Web Component from a dedicated JavaScript module. Put the markup and styles in its own root; adapt font registration and asset URLs to the host's package base URL. Keep all mutable state per graphic instance.
2. Implement the exact current OGraf `load`, `playAction`, `updateAction`, `stopAction`, `customAction`, and `dispose` contracts, including action arguments, promise completion, and error behavior. Await font/asset readiness in `load`; await the whole-ticker animation for play/stop completion. Do not map `stopAction` to a crawler pause.
3. Create a manifest pointing at that module, with the required schema URI, ID/name, real-time flags, and a JSON Schema for its data. Declare only supported rendering modes. This renderer currently uses wall-clock frame callbacks, so **do not claim non-real-time support** without implementing scheduled actions and time seeking.
4. Package all fonts, logo/background assets, CSS, and JavaScript as local resources. Avoid reliance on the standalone preview server, parent frame, or SPX globals.
5. Validate the manifest against the EBU JSON Schema and test lifecycle behavior, multiple instances, cancellation, repeated play/update/stop, disposal, missing assets, and offline loading in an actual OGraf-compatible renderer.
6. Record the exact spec/schema revision and renderer versions that passed validation before calling the package compliant.

The adapter is deliberately deferred until there is a concrete target OGraf renderer and a chance to validate the actual package there.
