import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TickerRenderer } from '../graphics/ticker/src/renderer.js';

function harness(run) {
  const keys = ['window', 'ResizeObserver', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = new Map(keys.map(key => [key, globalThis[key]]));
  const frames = new Map();
  let nextFrame = 0;
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.targets = []; this.disconnected = true; }
  }
  const elements = Object.fromEntries(['crawl-track', 'crawl-viewport', 'left', 'round-box', 'date', 'location', 'status', 'round', 'remaining'].map(id => [id, { id, clientWidth: 236, scrollWidth: 294, offsetWidth: 294, style: {}, children: [] }]));
  const fonts = new EventTarget();
  const classes = new Set();
  const root = {
    ownerDocument: { fonts },
    querySelector: selector => elements[selector.match(/id="([^"]+)"/)[1]],
    classList: { add: name => classes.add(name), contains: name => classes.has(name) }
  };
  globalThis.window = new EventTarget();
  globalThis.ResizeObserver = globalThis.MutationObserver = Observer;
  globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); };
  let renderer;
  try {
    renderer = new TickerRenderer(root);
    run({ renderer, root, elements, fonts, observers, frames, flush });
  } finally {
    renderer?.dispose();
    for (const [key, value] of previous) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('text, font and box changes automatically refit without a data update', () => harness(({ renderer, elements, fonts, observers, frames, flush }) => {
  renderer.fitRound();
  assert.equal(elements.round.style.transform, `scaleX(${235 / 294})`);
  elements.round.scrollWidth = elements.round.offsetWidth = 480;
  observers[1].callback(); // Direct text edit, independent of Ticker.update().
  observers[0].callback(); // Font/layout change in the same frame.
  assert.equal(frames.size, 1);
  flush();
  assert.equal(elements.round.style.transform, `scaleX(${235 / 480})`);
  elements['round-box'].clientWidth = 200;
  observers[0].callback();
  flush();
  assert.equal(elements.round.style.transform, `scaleX(${199 / 480})`);
  elements.round.scrollWidth = elements.round.offsetWidth = 38;
  fonts.dispatchEvent(new Event('loadingdone'));
  flush();
  assert.equal(elements.round.style.transform, 'scaleX(1)');
}));

test('show retries hidden measurements and dispose releases fitting callbacks', () => harness(({ renderer, root, elements, observers, frames, flush }) => {
  elements['round-box'].clientWidth = 0;
  elements.round.style.transform = 'scaleX(0.8)';
  renderer.show();
  assert.equal(root.classList.contains('visible'), true);
  assert.equal(elements.round.style.transform, 'scaleX(0.8)');
  elements['round-box'].clientWidth = 236;
  flush();
  assert.equal(elements.round.style.transform, `scaleX(${235 / 294})`);
  renderer.scheduleFit();
  renderer.dispose();
  assert.equal(frames.size, 0);
  assert.ok(observers.every(observer => observer.disconnected));
  renderer.scheduleFit();
  assert.equal(frames.size, 0);
}));
