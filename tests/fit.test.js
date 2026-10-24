import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitHorizontal } from '../graphics/ticker/src/fit.js';

function label(width, transform = 'none') {
  return { scrollWidth: width, offsetWidth: width, style: { transform }, getBoundingClientRect() { throw new Error('Scaled screen bounds must not be used'); } };
}

test('long round labels compress using layout widths independent of displayed scale', () => {
  const text = label(294);
  const scale = fitHorizontal(text, 236);
  assert.equal(scale, 235 / 294);
  assert.equal(text.style.transform, `scaleX(${scale})`);
  assert.ok(294.5 * scale < 236);
});

test('short labels keep their base size and recover from an earlier compressed value', () => {
  const text = label(38, 'scaleX(0.3)');
  assert.equal(fitHorizontal(text, 236), 1);
  assert.equal(text.style.transform, 'scaleX(1)');
});

test('hidden or unmeasurable labels retain their previous scale until measurable', () => {
  const text = label(294, 'scaleX(0.8)');
  assert.equal(fitHorizontal(text, 0), null);
  assert.equal(text.style.transform, 'scaleX(0.8)');
  text.scrollWidth = text.offsetWidth = 0;
  assert.equal(fitHorizontal(text, 236), null);
  assert.equal(text.style.transform, 'scaleX(0.8)');
});

test('refitting responds to changed font widths and changed box widths without vertical scaling', () => {
  const text = label(294);
  fitHorizontal(text, 236);
  text.scrollWidth = text.offsetWidth = 480;
  assert.equal(fitHorizontal(text, 236), 235 / 480);
  assert.equal(fitHorizontal(text, 200), 199 / 480);
  assert.match(text.style.transform, /^scaleX\(/);
});
