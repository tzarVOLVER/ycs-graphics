import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { defaults, applyFields } from '../graphics/match-status/data.js';
import { createMatchStatus } from '../graphics/match-status/main.js';

function harness(variant = 'siding') {
  const classes = new Set(),
    frames = new Map(),
    observers = [];
  let frame = 0;
  class Observer {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  const view = Object.assign(new EventTarget(), {
    ResizeObserver: Observer,
    MutationObserver: Observer,
    requestAnimationFrame(callback) {
      frames.set(++frame, callback);
      return frame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    }
  });
  const fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });
  const labels = [
    'leftName',
    'rightName',
    'currentRound',
    'roundsRemaining',
    ...(variant === 'siding' ? ['leftScore', 'rightScore'] : [])
  ].map((field) => ({
    dataset: { field },
    textContent: '',
    style: {},
    scrollWidth: 600,
    offsetWidth: 600,
    parentElement: { clientWidth: 300 }
  }));
  const images = ['leftFlag', 'rightFlag'].map((key) => ({
    dataset: { image: key },
    attributes: {},
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
    removeAttribute(key) {
      delete this.attributes[key];
    }
  }));
  const remaining = { hidden: false };
  const root = {
    dataset: { variant },
    ownerDocument: { defaultView: view, fonts },
    querySelectorAll: (selector) => (selector === '[data-fit]' ? labels : images),
    querySelector: () => remaining,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle(name, on) {
        on ? classes.add(name) : classes.delete(name);
      }
    }
  };
  const api = createMatchStatus(root);
  return {
    api,
    root,
    classes,
    frames,
    observers,
    labels,
    images,
    remaining,
    view,
    fonts,
    flush() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    }
  };
}

test('shuffling and siding accept classic SPX payloads with independent fields and scores', () => {
  for (const variant of ['shuffling', 'siding']) {
    const state = applyFields(
      defaults(variant),
      JSON.stringify({
        data: [
          { id: 'f2', value: '0' },
          { id: 'f3', value: '4 ROUNDS REMAINING' },
          { id: 'f4', value: 'LEFT NAME' },
          { id: 'f6', value: 'RIGHT NAME' },
          { id: 'f5', value: 'SWISS ROUND 11' },
          { id: 'f7', value: '/flags/ca.png' },
          { id: 'f8', value: './assets/us.png' },
          { id: 'f9', value: 2 },
          { id: 'f10', value: '0' }
        ]
      })
    );
    assert.equal(state.showRoundsRemaining, false);
    assert.equal(state.leftName, 'LEFT NAME');
    assert.equal(state.rightName, 'RIGHT NAME');
    assert.equal(state.currentRound, 'SWISS ROUND 11');
    assert.equal(state.leftFlag, '/flags/ca.png');
    if (variant === 'siding') {
      assert.equal(state.leftScore, '2');
      assert.equal(state.rightScore, '0');
    } else assert.equal(Object.hasOwn(state, 'leftScore'), false);
    assert.equal(Object.hasOwn(state, 'caption'), false);
  }
});

test('invalid updates fail atomically and all supported checkbox false values remain false', () => {
  const state = defaults('siding');
  for (const input of [
    { f4: 'x'.repeat(301) },
    { f2: 'yes' },
    { f7: 'javascript:alert(1)' },
    { f8: 'data:image/png,abc' },
    { f9: -1 },
    { f9: 'NaN' },
    { f10: {} },
    []
  ])
    assert.throws(() => applyFields(state, input));
  assert.deepEqual(state, defaults('siding'));
  for (const value of [false, 0, '0'])
    assert.equal(applyFields(state, { f2: value }).showRoundsRemaining, false);
  assert.throws(() => defaults('unknown'));
});

test('Update never plays a hidden graphic or replays its entrance; remaining toggle and flag values apply explicitly', (t) => {
  const r = harness();
  t.after(() => r.api.dispose());
  r.api.update({ f4: '<literal name>', f2: '0', f7: '' });
  assert.equal(r.classes.has('visible'), false);
  assert.equal(r.remaining.hidden, true);
  assert.equal(r.images[0].hidden, true);
  assert.equal(r.images[0].attributes.src, undefined);
  r.api.update({ f8: 'none' });
  assert.equal(r.images[1].hidden, true, 'SPX filelist’s empty option clears the flag');
  assert.equal(r.labels[0].textContent, '<literal name>');
  r.api.play();
  r.api.update({ f2: '1', f9: '3' });
  assert.equal(r.classes.has('visible'), true);
  assert.equal(r.remaining.hidden, false);
  assert.equal(r.api.getState().leftScore, '3');
  const before = r.api.getState();
  assert.throws(() => r.api.update({ f4: 'Changed', f9: -1 }));
  assert.deepEqual(r.api.getState(), before);
  r.api.stop();
  r.api.update({ f3: 'Saved text' });
  assert.equal(r.classes.has('visible'), false);
});

test('names, round labels and scores reuse horizontal fit and respond to font/layout changes', (t) => {
  const r = harness();
  t.after(() => r.api.dispose());
  r.flush();
  for (const label of r.labels) assert.equal(label.style.transform, `scaleX(${299 / 600})`);
  r.labels[0].scrollWidth = r.labels[0].offsetWidth = 50;
  r.fonts.dispatchEvent(new Event('loadingdone'));
  r.flush();
  assert.equal(r.labels[0].style.transform, 'scaleX(1)');
  r.labels[0].parentElement.clientWidth = 40;
  r.observers[0].callback();
  r.observers[1].callback();
  assert.equal(r.frames.size, 1);
  r.flush();
  assert.equal(r.labels[0].style.transform, `scaleX(${39 / 50})`);
  r.api.dispose();
  assert.equal(r.frames.size, 0);
  assert.ok(r.observers.every((observer) => observer.disconnected));
});

test('SPX lifecycle bridge queues Update/Play/Stop while loading and recovers from rejected data', async (t) => {
  const r = harness('shuffling');
  t.after(() => r.api.dispose());
  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = {};
  globalThis.document = { getElementById: () => r.root };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  await import('../graphics/match-status/spx.js');
  await Promise.all([window.update({ f4: 'STARTUP NAME' }), window.play(), window.stop()]);
  assert.equal(r.classes.has('visible'), false);
  assert.equal(r.labels[0].textContent, 'STARTUP NAME');
  const error = console.error;
  console.error = () => {};
  try {
    await assert.rejects(window.update({ f2: 'invalid' }));
  } finally {
    console.error = error;
  }
  await window.update({ f2: '0' });
  assert.equal(r.remaining.hidden, true);
  r.view.dispatchEvent(new Event('pagehide'));
});

test('two importable entry points have fixed captions, one checkbox, correct defaults and complete local assets', async () => {
  const root = new URL('../graphics/match-status/', import.meta.url);
  for (const variant of ['shuffling', 'siding']) {
    const html = await readFile(new URL(variant + '.html', root), 'utf8');
    const definition = runInNewContext(
      '(' + html.match(/window\.SPXGCTemplateDefinition = (\{[\s\S]*?\});/)[1] + ')'
    );
    const fields = Object.fromEntries(
      definition.DataFields.map((field) => [field.field, field.value])
    );
    assert.deepEqual(applyFields(defaults(variant), fields), defaults(variant));
    assert.equal(definition.DataFields.filter((field) => field.ftype === 'checkbox').length, 1);
    assert.equal(
      definition.DataFields.some((field) => /duelists|caption|animation|timing/i.test(field.title)),
      false
    );
    assert.equal(
      definition.DataFields.filter((field) => field.ftype === 'number').length,
      variant === 'siding' ? 2 : 0
    );
    assert.match(html, new RegExp('DUELISTS ' + variant.toUpperCase()));
    assert.equal(definition.ycsSlot, 'lower-third');
    for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g))
      assert.ok((await stat(new URL(match[1], root))).size > 0);
  }
});
