import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { defaults, applyFields, winnerLabel } from '../graphics/winner/data.js';
import { createWinner } from '../graphics/winner/main.js';

// An output page that is not being drawn: animation frames never run.
function undrawn(fonts, toggles = []) {
  class Observer { observe() {} disconnect() {} }
  const view = Object.assign(new EventTarget(), {
    ResizeObserver: Observer,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    matchMedia: () => ({ matches: true }),
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: id => clearTimeout(id)
  });
  const label = () => ({ textContent: '', style: {}, scrollWidth: 429, offsetWidth: 429, parentElement: { clientWidth: 381 } });
  const name = label(), result = label();
  const root = {
    ownerDocument: { defaultView: view, fonts },
    classList: { add() {}, remove() {}, toggle: (name, on) => toggles.push([name, on]) },
    querySelector: selector => selector === '.name' ? name : selector === '.result' ? result : { animate: () => ({ cancel() {} }) }
  };
  return { winner: createWinner(root), name };
}

test('winner waits for its fonts before Play and fits without an animation frame', async () => {
  let fontsArrive;
  const fonts = Object.assign(new EventTarget(), { ready: new Promise(resolve => { fontsArrive = resolve; }) });
  const { winner, name } = undrawn(fonts);
  let updated = false;
  const update = winner.update({ f1: 'STEVEN DARLING' }).then(() => { updated = true; });
  assert.equal(name.style.transform, `scaleX(${380 / 429})`, 'measured with the wider fallback font');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(updated, false, 'SPX keeps the frame hidden until the fonts arrive');
  name.scrollWidth = name.offsetWidth = 218;
  fontsArrive();
  await update;
  assert.equal(name.style.transform, 'scaleX(1)', 'the real font fits at full width');
  winner.dispose();
});

test('a font that never arrives holds winner Play for about a second at most', async () => {
  const { winner } = undrawn(Object.assign(new EventTarget(), { ready: new Promise(() => {}) }));
  const started = Date.now();
  await winner.update({ f1: 'STEVEN DARLING' });
  assert.ok(Date.now() - started < 1500);
  winner.dispose();
});

test('a blank linked game number or score stays blank and does not reject the update', () => {
  const state = applyFields(defaults(), { f1: '', f2: '', f3: '' });
  assert.equal(state.name, '');
  assert.equal(winnerLabel(state), 'WINNER');
  assert.equal(winnerLabel(applyFields(state, { f2: '2' })), 'GAME 2 WINNER');
  assert.equal(winnerLabel(applyFields(state, { f3: '2' })), 'MATCH WINNER');
});

test('winner labels use the linked game number until a score of 2 takes precedence', () => {
  for (const game of [1, 2, 3]) for (const score of [0, 1, 2]) {
    const state = applyFields(defaults(), JSON.stringify({ f2: String(game), f3: String(score) }));
    assert.equal(winnerLabel(state), score === 2 ? 'MATCH WINNER' : `GAME ${game} WINNER`);
  }
  const state = applyFields(defaults(), { f3: '2' });
  assert.equal(winnerLabel(applyFields(state, { f2: '1' })), 'MATCH WINNER');
  assert.equal(winnerLabel(applyFields(state, { f3: '1' })), 'GAME 1 WINNER');
});

test('Champion replaces the caption with the typed text, or CHAMPION when blank, and unticking restores it', () => {
  const state = applyFields(defaults(), { f2: '2', f3: '2' });
  assert.equal(winnerLabel(applyFields(state, { f5: 'YCS CHAMPION' })), 'MATCH WINNER', 'the text needs the box ticked');
  const champion = applyFields(state, { f4: '1', f5: '  2026 YCS CHAMPION ' });
  assert.equal(champion.champion, true);
  assert.equal(winnerLabel(champion), '2026 YCS CHAMPION');
  assert.equal(winnerLabel(applyFields(champion, { f5: '   ' })), 'CHAMPION');
  assert.equal(winnerLabel(applyFields(champion, { f4: '0' })), 'MATCH WINNER');
  assert.equal(applyFields(champion, { f4: '' }).champion, false);
  assert.equal(applyFields(defaults(), { data: [{ id: 'f4', value: '1' }] }).champion, true);
  for (const fields of [{ f4: 'maybe' }, { f5: 7 }, { f5: 'X'.repeat(301) }]) assert.throws(() => applyFields(state, fields));
});

test('Champion turns the plate gold on both sides', async () => {
  const css = await readFile(new URL('../graphics/winner/winner.css', import.meta.url), 'utf8');
  assert.match(css, /#winner\.champion\{--side:#f3ce48\}/);
  // Declared after the red rule, so it wins on both sides.
  assert.ok(css.indexOf('#winner.champion') > css.indexOf('#winner[data-side=red]'));
  const toggles = [];
  const { winner } = undrawn(Object.assign(new EventTarget(), { ready: Promise.resolve() }), toggles);
  await winner.update({ f4: '1' });
  await winner.update({ f4: '0' });
  assert.deepEqual(toggles.slice(-2), [['champion', true], ['champion', false]]);
  winner.dispose();
});

test('winner partial and classic SPX updates validate atomically and retain literal player text', () => {
  const state = defaults();
  assert.equal(applyFields(state, { f1: '<b>PLAYER</b>' }).name, '<b>PLAYER</b>');
  assert.equal(applyFields(state, { data: [{ id: 'f2', value: '2' }] }).game, 2);
  for (const fields of [{ f2: 'NaN' }, { f2: 0 }, { f2: 4 }, { f2: 1.5 }, { f3: -1 }, { f3: 3 }, { f3: 0.5 }, { f1: 12 }]) {
    assert.throws(() => applyFields(state, fields));
    assert.deepEqual(state, defaults());
  }
});

test('both winner templates expose linkable numeric data, share a renderer and default to L3', async () => {
  for (const side of ['blue', 'red']) {
    const html = await readFile(new URL(`../graphics/winner/${side}.html`, import.meta.url), 'utf8');
    const definition = vm.runInNewContext('(' + html.match(/window\.SPXGCTemplateDefinition = (\{[\s\S]*?\});/)[1] + ')');
    assert.equal(definition.ycsSlot, 'lower-third');
    assert.equal(definition.DataFields.find(f => f.field === 'f3').ftype, 'number');
    assert.equal(definition.DataFields.find(f => f.field === 'f2').ftype, 'number');
    assert.equal(definition.editorSections.length, 1);
    assert.deepEqual(Array.from(definition.editorSections[0].fields), ['f1', 'f2', 'f3', 'f4', 'f5']);
    const champion = definition.DataFields.find(f => f.field === 'f4'), caption = definition.DataFields.find(f => f.field === 'f5');
    assert.deepEqual([champion.ftype, champion.title, champion.value], ['checkbox', 'Champion', '0']);
    assert.deepEqual([caption.ftype, caption.title, caption.value], ['textfield', 'Champion text', '']);
    assert.notEqual(definition.editorSections[0].collapsed, true);
    assert.match(html, new RegExp(`data-side="${side}"`));
    assert.match(html, /src="\.\/spx.js"/);
  }
});

