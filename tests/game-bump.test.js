import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { inTracks, outTracks, trackEnd, STOP_LIMIT } from '../graphics/game-bump/motion.js';
import { applyFields, defaults, gameLine, gameNumber } from '../graphics/game-bump/data.js';

const read = (path) => readFile(new URL('../graphics/' + path, import.meta.url), 'utf8');
const inlineScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const definition = (html) => {
  const window = {};
  runInNewContext(inlineScripts(html)[0], { window });
  // Copied out of the script's own context, so its arrays compare like ordinary ones.
  return JSON.parse(JSON.stringify(window.SPXGCTemplateDefinition));
};

test('import is safe: the only inline script is the field definition', async () => {
  const scripts = inlineScripts(await read('game-bump/game-bump.html'));
  assert.equal(scripts.length, 1);
  assert.match(scripts[0], /^\s*window\.SPXGCTemplateDefinition = \{/);
  assert.doesNotMatch(scripts[0], /\b(while|for|do|function|setInterval|setTimeout|import|fetch|require|process)\b/);
});

test('one game number field, in the full-screen slot', async () => {
  const bump = definition(await read('game-bump/game-bump.html'));
  assert.equal(bump.ycsSlot, 'full-screen');
  // A text field with a blank default: SPX would swap a blank or 0 in a number field for the typed default,
  // showing a wrong game; as text, the graphic gets the value and shows blank for anything odd.
  assert.deepEqual(bump.DataFields.map((field) => [field.field, field.ftype, field.title, field.value]), [['f1', 'textfield', 'Game number', '']]);
  assert.equal(bump.DataFields[0].min, undefined);
  assert.deepEqual(bump.editorSections.flatMap((section) => section.fields), ['f1']);
});

test("the out finishes well inside SPX's 2s exit limit, and the build within 2s", () => {
  assert.ok(trackEnd(outTracks) <= STOP_LIMIT - 100, 'out ends by ' + (STOP_LIMIT - 100) + 'ms, got ' + trackEnd(outTracks));
  assert.ok(trackEnd(inTracks) <= 2000, 'the build finishes within 2s');
});

test('the game number shows as GAME n; blank or odd values show nothing', () => {
  const show = (value) => gameLine(applyFields(defaults(), JSON.stringify({ f1: value })));
  assert.equal(show('2'), 'GAME 2');
  assert.equal(show(3), 'GAME 3');
  assert.equal(show(' 1 '), 'GAME 1');
  assert.equal(show(''), '');
  assert.equal(show('0'), '');
  assert.equal(show('-1'), '');
  assert.equal(show('2.5'), '');
  assert.equal(show('abc'), '');
  assert.equal(show(null), '');
  assert.equal(gameNumber(undefined), '');
  // SPX's array form of the fields works too, and a field that isn't sent keeps the last value.
  const state = applyFields(defaults(), { data: [{ id: 'f1', value: '4' }] });
  assert.equal(gameLine(state), 'GAME 4');
  assert.equal(gameLine(applyFields(state, JSON.stringify({}))), 'GAME 4');
});

test('every animated selector matches something in the page', async () => {
  const html = await read('game-bump/game-bump.html');
  const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)));
  for (const [selector] of [...inTracks, ...outTracks])
    for (const part of selector.split(','))
      for (const name of part.match(/\.[\w-]+/g)) assert.ok(classes.has(name.slice(1)), `${part.trim()}: .${name.slice(1)} is in the page`);
});

test('the shared head-to-head assets it uses exist', async () => {
  const css = await read('game-bump/game-bump.css');
  const html = await read('game-bump/game-bump.html');
  const paths = [...css.matchAll(/url\('([^']+)'\)/g), ...html.matchAll(/src="(\.\.\/[^"]+)"/g)].map((match) => match[1]);
  assert.ok(paths.length >= 3);
  for (const path of paths) {
    if (path.includes('OwnersNarrow')) continue; // a trial font that's deliberately not committed; falls back
    await assert.doesNotReject(readFile(new URL('../graphics/game-bump/' + path, import.meta.url)), path);
  }
});
