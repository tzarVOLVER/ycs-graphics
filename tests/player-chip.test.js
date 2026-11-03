import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { defaults, applyFields, chipWidth, formatLogo } from '../graphics/player-chip/data.js';

test('format chooses its built-in logo case-insensitively without exposing image paths', () => {
  for (const value of ['Advanced', ' ADVANCED ', 'advanced']) {
    const next = applyFields(defaults(), { f4: value });
    assert.equal(next.format, 'advanced');
    assert.equal(formatLogo(next.format), './assets/ycs-logo.png');
  }
  const genesys = applyFields(defaults(), { data: [{ id: 'f4', value: 'GENESYS' }] });
  assert.equal(formatLogo(genesys.format), './assets/genesys.png');
  assert.equal(formatLogo(applyFields(genesys, { f4: '' }).format), '');
  assert.throws(() => applyFields(genesys, { f1: 'NEW NAME', f4: 'unknown' }));
  assert.equal(genesys.name, 'SAM A.');
});

test('player chip data preserves partial updates, accepts classic SPX fields and validates atomically', () => {
  const initial = defaults();
  const next = applyFields(initial, { data: [{ id: 'f1', value: '<PLAYER>' }, { id: 'f2', value: '10W - 2L' }, { id: 'f5', value: 'http://assets.local/decks/card.png' }] });
  assert.equal(next.name, '<PLAYER>'); assert.equal(next.record, '10W - 2L');
  assert.equal(next.flag, initial.flag);
  assert.equal(next.decktype, 'http://assets.local/decks/card.png');
  assert.equal(applyFields(next, { f5: '' }).decktype, '');
  for (const patch of [{ f1: 3 }, { f2: 'X'.repeat(301) }, { f5: 'file:///C:/card.png' }, { f3: 'javascript:alert(1)' }, { f4: 'C:\\art\\logo.png' }, { f5: '\\\\ART-PC\\Decktypes\\card.png' }]) {
    assert.throws(() => applyFields(initial, patch));
    assert.deepEqual(initial, defaults());
  }
});

test('chip width keeps a 410px minimum, expands with a 38px end margin and caps only at the screen edge', () => {
  assert.equal(chipWidth(170), 410);
  assert.equal(chipWidth(351), 476);
  assert.equal(chipWidth(500), 625);
  assert.equal(chipWidth(3000), 1775);
});

test('Blue and Red chips share code, expose all five linkable controls and use independent slots', async () => {
  for (const side of ['blue', 'red']) {
    const html = await readFile(new URL(`../graphics/player-chip/${side}.html`, import.meta.url), 'utf8');
    const definition = vm.runInNewContext('(' + html.match(/window\.SPXGCTemplateDefinition = (\{[\s\S]*?\});/)[1] + ')');
    assert.equal(definition.ycsSlot, 'chip-' + side);
    assert.equal(definition.editorSections.length, 1);
    assert.equal(definition.DataFields.length, 5);
    assert.ok(definition.DataFields.every(field => field.ftype === 'textfield'));
    assert.equal(definition.DataFields.find(field => field.field === 'f4').title, 'Format');
    assert.equal(definition.DataFields.some(field => /format logo/i.test(field.title)), false);
    assert.match(html, new RegExp(`data-side="${side}"`));
    assert.match(html, /src="\.\/spx.js"/);
  }
});
