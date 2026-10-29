import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { defaults, applyFields, LAYOUTS } from '../graphics/lower-third/data.js';
import { createLowerThird } from '../graphics/lower-third/main.js';

function harness() {
  const frames = new Map(),
    observers = [],
    classes = new Set();
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
  const plates = Array.from({ length: 4 }, () => {
    const labels = ['name', 'title'].map(() => ({
      textContent: '',
      style: {},
      offsetWidth: 600,
      scrollWidth: 600,
      parentElement: { clientWidth: 344 }
    }));
    return {
      labels,
      hidden: false,
      style: {},
      querySelectorAll: () => labels,
      querySelector: (selector) => labels[selector === '.name' ? 0 : 1]
    };
  });
  const fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });
  const root = {
    ownerDocument: { defaultView: view, fonts },
    querySelectorAll: () => plates,
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) }
  };
  const api = createLowerThird(root);
  return {
    api,
    root,
    classes,
    plates,
    fonts,
    observers,
    frames,
    view,
    flush() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    }
  };
}

test('lower third maps all four SPX nameplates and rejects invalid patches atomically', () => {
  for (const layout of [1, 2, 3, 4]) {
    const state = applyFields(
      defaults(),
      JSON.stringify({
        data: [
          { id: 'f2', value: String(layout) },
          { id: 'f3', value: '0' },
          { id: 'f4', value: '<Name & text>' },
          { id: 'f5', value: 'Host' },
          { id: 'f12', value: '1' },
          { id: 'f13', value: 'Fourth name' }
        ]
      })
    );
    assert.equal(state.layout, layout);
    assert.equal(state.plates[0].enabled, false);
    assert.equal(state.plates[0].name, '<Name & text>');
    assert.equal(state.plates[0].title, 'Host');
    assert.equal(state.plates[3].name, 'Fourth name');
  }
  const state = defaults();
  for (const patch of [{ f2: '5' }, { f3: 'false' }, { f4: {} }, { f5: 'x'.repeat(301) }, []])
    assert.throws(() => applyFields(state, patch));
  assert.deepEqual(state, defaults());
});

test('updates and Show flags never play or replay; hiding plates does not reflow their neighbours', (t) => {
  const r = harness();
  t.after(() => r.api.dispose());
  r.api.update({ f2: '4', f4: 'JACKI JING', f5: 'YCS HOUSTON HOST' });
  assert.equal(r.classes.has('visible'), false);
  r.api.play();
  for (const layout of [1, 2, 3, 4]) {
    r.api.update({ f2: String(layout), f3: '1', f6: '1', f9: '1', f12: '1' });
    assert.deepEqual(
      r.plates.filter((plate) => !plate.hidden).map((plate) => parseInt(plate.style.left)),
      LAYOUTS[layout]
    );
    const before = r.plates.map((plate) => plate.style.left);
    r.api.update({ f3: '0' });
    assert.equal(r.plates[0].hidden, true);
    assert.deepEqual(
      r.plates.map((plate) => plate.style.left),
      before
    );
    assert.equal(r.classes.has('visible'), true);
  }
  const before = r.api.getState();
  assert.throws(() => r.api.update({ f4: 'Changed', f5: { invalid: true } }));
  assert.deepEqual(r.api.getState(), before);
  r.api.stop();
  r.api.update({ f3: '1' });
  assert.equal(r.classes.has('visible'), false);
});

test('both labels shrink horizontally and refit on font/layout/text changes without stretching', (t) => {
  const r = harness();
  t.after(() => r.api.dispose());
  r.api.update({ f4: 'Long name', f5: 'Long title' });
  r.flush();
  for (const label of r.plates[0].labels)
    assert.equal(label.style.transform, `scaleX(${343 / 600})`);
  const name = r.plates[0].labels[0];
  name.scrollWidth = name.offsetWidth = 100;
  r.fonts.dispatchEvent(new Event('loadingdone'));
  r.flush();
  assert.equal(name.style.transform, 'scaleX(1)');
  name.scrollWidth = name.offsetWidth = 700;
  r.observers[1].callback();
  r.observers[0].callback();
  assert.equal(r.frames.size, 1);
  r.flush();
  assert.equal(name.style.transform, `scaleX(${343 / 700})`);
  r.api.dispose();
  assert.equal(r.frames.size, 0);
  assert.ok(r.observers.every((observer) => observer.disconnected));
});

test('SPX bridge queues startup Update/Play/Stop and recovers after invalid data', async (t) => {
  const r = harness();
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
  await import('../graphics/lower-third/spx.js');
  await Promise.all([window.update({ f4: 'Startup name' }), window.play(), window.stop()]);
  assert.equal(r.plates[0].labels[0].textContent, 'Startup name');
  assert.equal(r.classes.has('visible'), false);
  const log = console.error;
  console.error = () => {};
  try {
    await assert.rejects(window.update({ f2: '99' }));
  } finally {
    console.error = log;
  }
  await window.update({ f5: 'Recovered' });
  assert.equal(r.plates[0].labels[1].textContent, 'Recovered');
  assert.equal(r.classes.has('visible'), false);
  r.view.dispatchEvent(new Event('pagehide'));
});

test('template declares four Show controls with draft-only edits and no appearance/timing fields', async () => {
  const html = await readFile(
    new URL('../graphics/lower-third/lower-third.html', import.meta.url),
    'utf8'
  );
  const definition = runInNewContext('(' + html.match(/window\.SPXGCTemplateDefinition = (\{[\s\S]*?\});/)[1] + ')');
  assert.equal(definition.ycsPreviewOnEdit, false);
  assert.equal(definition.ycsSlot, 'lower-third');
  assert.equal(definition.DataFields.filter((field) => field.ftype === 'checkbox').length, 4);
  assert.equal(definition.DataFields.filter((field) => field.ftype === 'textfield').length, 8);
  assert.equal(
    definition.DataFields.some((field) => ['number', 'textarea', 'filelist'].includes(field.ftype)),
    false
  );
});
