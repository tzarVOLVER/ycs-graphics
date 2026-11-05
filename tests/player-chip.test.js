import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { defaults, applyFields, chipWidth, formatLogo, decktypeURL } from '../graphics/player-chip/data.js';
import { createPlayerChip } from '../graphics/player-chip/main.js';

function chipHarness() {
  class Observer { observe() {} disconnect() {} }
  const view = Object.assign(new EventTarget(), {
    ResizeObserver: Observer, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: id => clearTimeout(id)
  });
  const text = () => ({ textContent: '', style: {}, offsetWidth: 100, scrollWidth: 100 });
  const image = src => {
    const attributes = src ? { src } : {};
    const element = Object.assign(new EventTarget(), {
      hidden: false, decoded: [], pending: [], sets: 0,
      getAttribute: key => attributes[key] ?? null,
      setAttribute(key, value) { this.sets++; attributes[key] = value; },
      removeAttribute: key => { delete attributes[key]; },
      decode() { element.decoded.push(attributes.src); return new Promise((resolve, reject) => element.pending.push({ resolve, reject })); }
    });
    return element;
  };
  const elements = { '.name': text(), '.record': text(), '.name-mask': text(), '.record-mask': text(),
    '[data-image="flag"]': image('./assets/flag.png'), '[data-image="logo"]': image('./assets/genesys.png'), '[data-image="decktype"]': image() };
  const root = { style: {}, dataset: {}, classList: new Set(), ownerDocument: { defaultView: view }, querySelector: selector => elements[selector] };
  root.classList.remove = root.classList.delete;
  const api = createPlayerChip(root);
  const images = ['flag', 'logo', 'decktype'].map(key => elements[`[data-image="${key}"]`]);
  for (const element of images) element.pending.length = element.decoded.length = 0; // Ignore the construction-time render.
  return { api, view, images };
}
const settled = async promise => { let done = false; promise.then(() => { done = true; }); await new Promise(setImmediate); return done; };

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
  const next = applyFields(initial, { data: [{ id: 'f1', value: '<PLAYER>' }, { id: 'f2', value: '10W - 2L' }, { id: 'f5', value: 'ANCIENT GEAR' }] });
  assert.equal(next.name, '<PLAYER>'); assert.equal(next.record, '10W - 2L');
  assert.equal(next.flag, initial.flag);
  assert.equal(next.decktype, 'ANCIENT GEAR');
  assert.equal(applyFields(next, { f5: '' }).decktype, '');
  for (const patch of [{ f1: 3 }, { f2: 'X'.repeat(301) }, { f5: 'file:///C:/card.png' }, { f3: 'javascript:alert(1)' }, { f4: 'C:\\art\\logo.png' }, { f5: '\\\\ART-PC\\Decktypes\\card.png' }]) {
    assert.throws(() => applyFields(initial, patch));
    assert.deepEqual(initial, defaults());
  }
});

test('decktype names resolve to PNG URLs with safe encoding for spaces and punctuation', () => {
  for (const name of ['ANCIENT GEAR', '@IGNISTER MALISS', 'A+B & C#1', "KING'S DECK", '100% DECK']) {
    const state = applyFields(defaults(), { f5: name });
    assert.equal(decktypeURL(state.decktype), '/decktypes/' + encodeURIComponent(name + '.png'));
  }
  assert.equal(decktypeURL(applyFields(defaults(), { f5: '  ANCIENT GEAR  ' }).decktype), '/decktypes/ANCIENT%20GEAR.png');
  assert.equal(decktypeURL(''), '');
  for (const value of ['../secret', 'folder/deck', 'http://host/card.png', '.hidden', 'DECK.', 'DECK?']) assert.throws(() => applyFields(defaults(), { f5: value }));
});

test('chip width keeps a 410px minimum, expands with a 38px end margin and caps only at the screen edge', () => {
  assert.equal(chipWidth(170), 410);
  assert.equal(chipWidth(351), 476);
  assert.equal(chipWidth(500), 625);
  assert.equal(chipWidth(3000), 1775);
});

test('Blue and Red chips share code, expose all five linkable controls and use the BUG slot', async () => {
  for (const side of ['blue', 'red']) {
    const html = await readFile(new URL(`../graphics/player-chip/${side}.html`, import.meta.url), 'utf8');
    const definition = vm.runInNewContext('(' + html.match(/window\.SPXGCTemplateDefinition = (\{[\s\S]*?\});/)[1] + ')');
    assert.equal(definition.ycsSlot, 'ticker');
    assert.equal(definition.editorSections.length, 1);
    assert.equal(definition.DataFields.length, 5);
    assert.ok(definition.DataFields.every(field => field.ftype === 'textfield'));
    assert.equal(definition.DataFields.find(field => field.field === 'f4').title, 'Format');
    assert.equal(definition.DataFields.find(field => field.field === 'f5').title, 'Decktype');
    assert.equal(definition.DataFields.some(field => /format logo/i.test(field.title)), false);
    assert.match(html, new RegExp(`data-side="${side}"`));
    assert.match(html, /src="\.\/spx.js"/);
  }
});

test('Update resolves only after every shown chip image is decoded, so Play never decodes on air', async t => {
  const r = chipHarness();
  t.after(() => r.api.dispose());
  const [flag, logo, decktype] = r.images;
  const update = r.api.update({ f4: 'Advanced', f5: 'SNAKE-EYE' });
  assert.deepEqual([flag.decoded, logo.decoded, decktype.decoded], [['./assets/flag.png'], ['./assets/ycs-logo.png'], ['/decktypes/SNAKE-EYE.png']]);
  assert.equal(await settled(update), false);
  flag.pending[0].resolve(); logo.pending[0].reject(new Error('EncodingError'));
  assert.equal(await settled(update), false, 'still waiting for the decktype');
  decktype.pending[0].resolve();
  assert.equal(await settled(update), true, 'a failed image decode is not an update error');
  r.api.update({ f5: '' });
  assert.deepEqual(decktype.decoded, ['/decktypes/SNAKE-EYE.png'], 'images without a src are not decoded');
});

test('A slow chip image holds Update for at most about one second', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = chipHarness();
  t.after(() => r.api.dispose());
  const update = r.api.update({ f3: 'https://slow.example/flag.png' });
  t.mock.timers.tick(999);
  assert.equal(await settled(update), false);
  t.mock.timers.tick(1);
  assert.equal(await settled(update), true);
});
