import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { defaults, applyFields, winnerLabel } from '../graphics/winner/data.js';

test('winner labels use the linked game number until a score of 2 takes precedence', () => {
  for (const game of [1, 2, 3]) for (const score of [0, 1, 2]) {
    const state = applyFields(defaults(), JSON.stringify({ f2: String(game), f3: String(score) }));
    assert.equal(winnerLabel(state), score === 2 ? 'MATCH WINNER' : `GAME ${game} WINNER`);
  }
  const state = applyFields(defaults(), { f3: '2' });
  assert.equal(winnerLabel(applyFields(state, { f2: '1' })), 'MATCH WINNER');
  assert.equal(winnerLabel(applyFields(state, { f3: '1' })), 'GAME 1 WINNER');
});

test('winner partial and classic SPX updates validate atomically and retain literal player text', () => {
  const state = defaults();
  assert.equal(applyFields(state, { f1: '<b>PLAYER</b>' }).name, '<b>PLAYER</b>');
  assert.equal(applyFields(state, { data: [{ id: 'f2', value: '2' }] }).game, 2);
  for (const fields of [{ f2: '' }, { f2: 'NaN' }, { f2: 0 }, { f2: 4 }, { f2: 1.5 }, { f3: -1 }, { f3: 3 }, { f3: 0.5 }, { f1: 12 }]) {
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
    assert.deepEqual(Array.from(definition.editorSections[0].fields), ['f1', 'f2', 'f3']);
    assert.notEqual(definition.editorSections[0].collapsed, true);
    assert.match(html, new RegExp(`data-side="${side}"`));
    assert.match(html, /src="\.\/spx.js"/);
  }
});

