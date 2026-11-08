import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TickerRenderer, FRAME_BEAT_OPACITY } from '../graphics/ticker/src/renderer.js';

function harness(run, options = { gpu: true }) {
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
  const beats = [{ style: {} }, { style: {} }];
  const root = {
    ownerDocument: { fonts, querySelectorAll: selector => selector === '.frame-beat' ? beats : [] },
    querySelector: selector => elements[selector.match(/id="([^"]+)"/)[1]],
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) }
  };
  globalThis.window = new EventTarget();
  globalThis.ResizeObserver = globalThis.MutationObserver = Observer;
  globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); };
  let renderer;
  try {
    renderer = new TickerRenderer(root, options);
    run({ renderer, root, elements, fonts, observers, frames, flush, beats });
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

test('both corners change on every frame once shown, including when paused or hidden', () => harness(({ renderer, flush, beats }) => {
  renderer.start();
  flush();
  assert.deepEqual(beats.map(beat => beat.style.opacity), [undefined, undefined], 'nothing runs before Play');
  renderer.show();
  const seen = [];
  const frame = () => { flush(); assert.equal(beats[0].style.opacity, beats[1].style.opacity); seen.push(beats[0].style.opacity); };
  frame();
  frame();
  renderer.pause();
  frame();
  renderer.resume();
  renderer.hide();
  frame();
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1]);
}));

test('with GPU acceleration off the corners are left alone', () => harness(({ renderer, flush, beats }) => {
  renderer.start();
  renderer.show();
  flush();
  flush();
  assert.deepEqual(beats.map(beat => beat.style.opacity), [undefined, undefined]);
}, { gpu: false }));

test('the corner elements cannot show in an 8-bit frame or be repositioned by the ticker', () => {
  for (const opacity of FRAME_BEAT_OPACITY) assert.ok(Number(opacity) > 0 && Number(opacity) * 255 < 0.5, opacity);
  const html = readFileSync(new URL('../graphics/ticker/ticker.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../graphics/ticker/ticker.css', import.meta.url), 'utf8');
  // Fixed children of #ticker would follow its transform, so they must sit outside it.
  assert.match(html, /<\/div>\s*<div class="frame-beat start"><\/div>\s*<div class="frame-beat end"><\/div>\s*<\/body>/);
  const rule = css.match(/\.frame-beat \{([^}]*)\}/)[1];
  assert.match(rule, /position: fixed/);
  assert.match(rule, /pointer-events: none/);
  assert.ok(Number(rule.match(/opacity: ([.\d]+)/)[1]) * 255 < 0.5);
  // Each of these is needed for the corners to count as a change in the delivered frame.
  assert.match(rule, /width: 1px/);
  assert.match(rule, /height: 1px/);
  assert.match(rule, /background: #000/);
  assert.match(rule, /will-change: opacity/);
  assert.match(css, /\.frame-beat\.start \{\s*left: 0;\s*top: 0\s*\}/);
  assert.match(css, /\.frame-beat\.end \{\s*right: 0;\s*bottom: 0\s*\}/);
});

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
