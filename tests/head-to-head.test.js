import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { inTracks, outTracks, trackEnd, STOP_LIMIT } from '../graphics/head-to-head/motion.js';
import { applyFields, deckFraming, defaults, framingValue, recordLine, roundLine, savedFraming } from '../graphics/head-to-head/data.js';

const read = (path) => readFile(new URL('../graphics/' + path, import.meta.url), 'utf8');
const inlineScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const definition = (html) => {
  const window = {};
  runInNewContext(inlineScripts(html)[0], { window });
  return window.SPXGCTemplateDefinition;
};
const fields = (data) => JSON.stringify(data);

test('import is safe: the only inline script is the field definition', async () => {
  const scripts = inlineScripts(await read('head-to-head/head-to-head.html'));
  assert.equal(scripts.length, 1);
  assert.match(scripts[0], /^\s*window\.SPXGCTemplateDefinition = \{/);
  assert.doesNotMatch(scripts[0], /\b(while|for|do|function|setInterval|setTimeout|import|fetch|require|process)\b/);
});

test("fields shared with Siding keep Siding's meaning, so its links copy across", async () => {
  const h2h = definition(await read('head-to-head/head-to-head.html'));
  const siding = definition(await read('match-status/siding.html'));
  for (const name of ['f4', 'f5', 'f6', 'f7', 'f8', 'f15', 'f16']) {
    const mine = h2h.DataFields.find((field) => field.field === name);
    const theirs = siding.DataFields.find((field) => field.field === name);
    assert.equal(mine.ftype, theirs.ftype, name);
    assert.equal(mine.title, theirs.title, name);
  }
  const sections = h2h.editorSections.flatMap((section) => section.fields).sort();
  assert.deepEqual(sections, h2h.DataFields.map((field) => field.field).sort(), 'every field is in one editor section');
  assert.equal(h2h.ycsSlot, 'full-screen');
});

test('the whole out finishes inside SPX\'s 2s exit limit, with room to spare', () => {
  assert.ok(trackEnd(outTracks) <= STOP_LIMIT - 100, 'out ends by ' + (STOP_LIMIT - 100) + 'ms, got ' + trackEnd(outTracks));
  assert.ok(trackEnd(inTracks) <= 2000, 'the build finishes within 2s');
});

test('round: the linked line drops "OF 14", Custom text shows as typed', () => {
  const linked = (currentRound) => roundLine({ useCustomRound: false, currentRound, customRound: '' });
  assert.equal(linked('ADVANCED ROUND 9 OF 14'), 'ADVANCED ROUND 9');
  assert.equal(linked('TOP 8 - BEST OF 3'), 'TOP 8 - BEST OF 3');
  assert.equal(roundLine({ useCustomRound: true, currentRound: 'ROUND 1 OF 15', customRound: '' }), '');
  const custom = applyFields(defaults(), fields({ f15: '1', f16: 'GRAND FINALS' }));
  assert.equal(roundLine(custom), 'GRAND FINALS');
});

test('records drop draws and close the spaces round the dash', () => {
  const state = applyFields(defaults(), fields({ f11: '7W - 1L - 0D', f12: '12 W - 2 L' }));
  assert.equal(recordLine(state.leftRecord), '7W-1L');
  assert.equal(recordLine(state.rightRecord), '12 W-2 L');
});

test('an odd decktype or flag shows blank instead of stopping the graphic', () => {
  const apply = (data) => applyFields(defaults(), fields(data));
  assert.equal(apply({ f13: 'BLUE-EYES BRANDED' }).leftDecktype, 'BLUE-EYES BRANDED');
  // Kept exactly, so "R.B." finds R.B..png and non-breaking spaces match files named with them.
  assert.equal(apply({ f13: 'R.B.' }).leftDecktype, 'R.B.');
  assert.equal(apply({ f13: '  Power Patron\u00a0Ars Magna\u00a0Artmage ' }).leftDecktype, 'Power Patron\u00a0Ars Magna\u00a0Artmage');
  assert.equal(apply({ f14: 'Snake-Eye/Fire King' }).rightDecktype, '');
  assert.equal(apply({ f14: 'Branded: Despia' }).rightDecktype, '');
  assert.equal(apply({ f14: '../secret' }).rightDecktype, '');
  assert.equal(apply({ f7: 'C:\\flags\\us.png' }).leftFlag, '');
  assert.equal(apply({ f8: 'file:///C:/flags/us.png' }).rightFlag, '');
  assert.equal(apply({ f8: 'none' }).rightFlag, '');
  assert.equal(apply({ f8: 'https://flagcdn.com/h80/us.png' }).rightFlag, 'https://flagcdn.com/h80/us.png');
});

test('every animated selector matches something in the page', async () => {
  const html = await read('head-to-head/head-to-head.html');
  const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)));
  for (const [selector] of [...inTracks, ...outTracks])
    for (const part of selector.split(','))
      for (const name of part.match(/\.[\w-]+/g)) assert.ok(classes.has(name.slice(1)), `${part.trim()}: .${name.slice(1)} is in the page`);
});

test('deck framing: typed values win, then the saved file, then centred and filling the window', () => {
  const library = { decks: { 'Blue-Eyes  Branded': { zoom: 130, x: 40, y: 25 } } };
  assert.deepEqual(savedFraming(library, 'BLUE-EYES BRANDED'), { zoom: 130, x: 40, y: 25 });
  assert.deepEqual(deckFraming(library, 'blue-eyes branded'), { zoom: 1.3, x: '40%', y: '25%' });
  assert.deepEqual(deckFraming(library, 'BLUE-EYES BRANDED', { y: 60 }), { zoom: 1.3, x: '40%', y: '60%' });
  assert.deepEqual(deckFraming(library, 'UNKNOWN DECK'), { zoom: 1, x: '50%', y: '50%' });
  assert.deepEqual(deckFraming({}, ''), { zoom: 1, x: '50%', y: '50%' });
});

test('a framing typo is ignored and out-of-range values are clamped, so the graphic still plays', () => {
  assert.equal(framingValue('zoom', 'abc'), undefined);
  assert.equal(framingValue('zoom', ''), undefined);
  assert.equal(framingValue('zoom', '120%'), 120);
  assert.equal(framingValue('zoom', '9000'), 400);
  assert.equal(framingValue('zoom', '5'), 100, 'never smaller than filling the window');
  assert.equal(framingValue('y', '-5'), 0);
  const state = applyFields(defaults(), fields({ f17: '150', f18: 'oops', f19: '30' }));
  assert.deepEqual(state.leftFraming, { zoom: 150, y: 30 });
  assert.deepEqual(applyFields(state, fields({ f17: '' })).leftFraming, { y: 30 });
});

test('the saved framing file is valid and every entry is in range', async () => {
  const library = JSON.parse(await read('head-to-head/decktype-framing.json'));
  assert.equal(typeof library.decks, 'object');
  for (const [name, framing] of Object.entries(library.decks)) {
    assert.deepEqual(savedFraming(library, name), framing, name);
  }
});
