import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { defaults, applyFields, roundText } from '../graphics/match-status/data.js';
import { createMatchStatus } from '../graphics/match-status/main.js';
import { createMotion } from '../graphics/match-status/motion.js';

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
    },
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (id) => clearTimeout(id)
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
    getAttribute(key) {
      return this.attributes[key] ?? null;
    },
    setAttribute(key, value) {
      this.sets = (this.sets || 0) + 1;
      this.attributes[key] = value;
    },
    removeAttribute(key) {
      delete this.attributes[key];
    }
  }));
  const remaining = { hidden: false };
  const root = {
    getAnimations: () => [],
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

test('custom round text replaces the round label only while Custom is on, keeping both strings', async () => {
  for (const variant of ['shuffling', 'siding']) {
    const r = harness(variant);
    const round = () => r.labels.find((label) => label.dataset.field === 'currentRound').textContent;
    await r.api.update({ f5: 'ROUND 2' });
    assert.equal(round(), 'ROUND 2');
    await r.api.update({ f15: '0', f16: 'TOP 8' });
    assert.equal(round(), 'ROUND 2', 'custom text waits for the checkbox');
    await r.api.update({ f15: '1' });
    assert.equal(round(), 'TOP 8');
    await r.api.update({ f5: 'ROUND 3' });
    assert.equal(round(), 'TOP 8', 'a new round does not replace custom text');
    await r.api.update({ f16: '' });
    assert.equal(round(), '', 'Custom with blank text shows blank');
    await r.api.update({ f16: 'FINALS', f15: '0' });
    assert.equal(round(), 'ROUND 3', 'turning Custom off restores the latest round');
    assert.equal(r.api.getState().customRound, 'FINALS');
    r.api.dispose();
  }
});

test('without the custom fields the round label is unchanged, and bad values are refused', () => {
  for (const variant of ['shuffling', 'siding']) {
    assert.equal(roundText(defaults(variant)), defaults(variant).currentRound);
    assert.equal(roundText(applyFields(defaults(variant), { f5: 'ROUND 9' })), 'ROUND 9');
    for (const fields of [{ f15: 'yes' }, { f15: 2 }, { f16: 5 }, { f16: 'x'.repeat(301) }])
      assert.throws(() => applyFields(defaults(variant), fields), JSON.stringify(fields));
    assert.equal(applyFields(defaults(variant), { f15: '1' }).useCustomRound, true);
  }
});

test('shuffling and siding declare Custom and Custom text like the ticker', async () => {
  const load = async (name) => {
    const html = await readFile(new URL('../graphics/' + name, import.meta.url), 'utf8');
    const script = html.match(/<script>\s*window\.SPXGCTemplateDefinition[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');
    const window = {};
    runInNewContext(script, { window });
    return window.SPXGCTemplateDefinition;
  };
  const ticker = await load('ticker/ticker.html');
  const shape = (definition, field) => {
    const { ftype, title, value } = definition.DataFields.find((candidate) => candidate.field === field);
    return { ftype, title, value };
  };
  for (const name of ['match-status/shuffling.html', 'match-status/siding.html']) {
    const definition = await load(name);
    for (const field of ['f15', 'f16']) assert.deepEqual(shape(definition, field), shape(ticker, field), name + ' ' + field);
    assert.deepEqual(Array.from(definition.editorSections[0].fields), ['f2', 'f15'], name);
    assert.deepEqual(Array.from(definition.editorSections[1].fields), ['f3', 'f5', 'f16'], name);
    assert.deepEqual(Array.from(definition.DataFields).slice(-2).map((field) => field.field), ['f15', 'f16'], 'added at the end, so row labels do not change');
  }
});

test('blank linked names, flags and scores stay blank and do not reject the update', () => {
  const state = applyFields(defaults('siding'), { f4: '', f6: '', f7: '', f8: '', f9: '', f10: '' });
  for (const key of ['leftName', 'rightName', 'leftFlag', 'rightFlag', 'leftScore', 'rightScore']) assert.equal(state[key], '', key);
});

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

function motionHarness(times = [2000]) {
  const classes = new Set();
  const tracks = times.map((currentTime) => {
    let finish;
    return {
      currentTime,
      playbackRate: 1,
      effect: { getTiming: () => ({ duration: 2000 }) },
      finished: new Promise((resolve) => {
        finish = resolve;
      }),
      finish: () => finish(),
      reverse() {
        this.playbackRate = -1;
      },
      play() {
        this.played = true;
      },
      cancel() {
        this.cancelled = true;
        finish();
      }
    };
  });
  const root = {
    getAnimations: () => tracks,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name)
    }
  };
  return { api: createMotion(root), classes, tracks };
}

test('Stop skips the timeline hold, reverses from the current frame, then hides', async () => {
  const r = motionHarness([2000, 100]);
  r.api.play();
  r.api.stop();
  assert.equal(r.tracks[0].currentTime, 448.52);
  assert.equal(r.tracks[1].currentTime, 100);
  assert.ok(r.tracks.every((track) => track.playbackRate === -2));
  assert.equal(r.classes.has('visible'), true, 'exit remains visible until finished');
  r.tracks.forEach((track) => track.finish());
  await new Promise(setImmediate);
  assert.equal(r.classes.has('visible'), false);
});

test('rapid Play/Stop/Play resumes without a stale exit hiding the graphic', async () => {
  const r = motionHarness([0]);
  r.api.play();
  r.api.stop();
  assert.equal(r.tracks[0].currentTime, 0.001, 'avoid reverse auto-rewind at zero');
  r.api.play();
  assert.equal(r.tracks[0].playbackRate, 1);
  assert.equal(r.tracks[0].played, true);
  r.tracks[0].finish();
  await new Promise(setImmediate);
  assert.equal(r.classes.has('visible'), true);
  r.api.dispose();
  assert.equal(r.tracks[0].cancelled, true);
  assert.equal(r.classes.has('visible'), false);
});

test('reduced-motion with no animation tracks shows and stops immediately', () => {
  const r = motionHarness([]);
  r.api.play();
  assert.equal(r.classes.has('visible'), true);
  r.api.stop();
  assert.equal(r.classes.has('visible'), false);
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

test('two importable entry points have fixed captions, two checkboxes, correct defaults and complete local assets', async () => {
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
    assert.equal(definition.DataFields.filter((field) => field.ftype === 'checkbox').length, 2);
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

const settled = async (promise) => {
  let done = false;
  promise.then(() => {
    done = true;
  });
  await new Promise(setImmediate);
  return done;
};

test('Update waits for the frame’s own fonts before SPX shows it, then refits', async (t) => {
  const r = harness('shuffling');
  t.after(() => r.api.dispose());
  let loaded;
  r.fonts.ready = new Promise((resolve) => {
    loaded = resolve;
  });
  const update = r.api.update({ f4: 'CREIGHTON PAPADOPOULOS' });
  assert.equal(await settled(update), false);
  r.labels[0].scrollWidth = r.labels[0].offsetWidth = 50; // Real font metrics arrive.
  loaded();
  assert.equal(await settled(update), true);
  assert.equal(r.labels[0].style.transform, 'scaleX(1)', 'fit runs before Play');
});

test('Update waits at most about one second for a font that never loads', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = harness();
  t.after(() => r.api.dispose());
  r.fonts.ready = new Promise(() => {});
  const update = r.api.update({ f4: 'NAME' });
  t.mock.timers.tick(999);
  assert.equal(await settled(update), false);
  t.mock.timers.tick(1);
  assert.equal(await settled(update), true);
});

test('text-only updates keep unchanged flag src attributes; changed or failed flags still load', async (t) => {
  const r = harness();
  t.after(() => r.api.dispose());
  const [left, right] = r.images;
  const before = [left.sets, right.sets];
  for (let i = 0; i < 5; i++) await r.api.update({ f5: 'ROUND ' + i, f9: String(i) });
  assert.deepEqual([left.sets, right.sets], before);
  await r.api.update({ f7: '/flags/ca.png' });
  assert.equal(left.attributes.src, '/flags/ca.png');
  assert.equal(right.sets, before[1]);
  Object.assign(right, { complete: true, naturalWidth: 0 }); // Broken image: retry as before.
  await r.api.update({ f5: 'ROUND 6' });
  assert.equal(right.sets, before[1] + 1);
});
