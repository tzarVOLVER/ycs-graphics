# Shared data contracts

`data-contract.js` is the canonical dependency-free source for boolean and number conversions, JSON Pointer traversal/escaping, and classic SPX payload decoding. `fixtures.json` defines the same boundary cases for both repositories, including story collections. Story schema validation stays with each application: SPX preserves absent optional headers; the ticker supplies empty header strings for rendering.

From this repository, regenerate artifacts after changing the source or fixtures:

```powershell
npm run contracts:sync -- --spx ../ycs-spx
npm run contracts:check -- --spx ../ycs-spx
node --test tests/*.test.js
```

Commit the generated ticker module here and the generated Node/browser modules, fixtures and hash manifest in the SPX fork together. Each repository works independently after checkout. SPX never imports files from this checkout at runtime; it tests its vendored artifacts against the manifest. The generator's check mode compares both checkouts against the canonical source when the sibling fork exists. Use `--spx` for another checkout location. Hashes normalize Windows line endings.

Boolean policies are deliberately distinct. Native editor checkboxes accept case-insensitive `true/false`, `yes/no`, `on/off` and `1/0`, without trimming. Spreadsheet Published values trim whitespace and treat blanks as false. The classic SPX checkbox wire format accepts only boolean or numeric/string `1/0`. Consumers retain their field-specific validation messages and limits; ticker timing also rejects negative numbers.

JSON Pointers decode `~1` and `~0` once, traverse own properties only, support the empty root path and empty keys, and reject invalid escapes. Never substitute dotted-path access or evaluate source values as JavaScript or HTML.
