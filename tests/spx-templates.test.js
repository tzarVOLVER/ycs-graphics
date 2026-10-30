import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

test('three SPX entry points have separate instances/layers and complete dependencies', async () => {
  const root = new URL('../graphics/ticker/', import.meta.url);
  for (let index = 1; index <= 3; index++) {
    const html = await readFile(new URL(`YCS-Ticker-${index}.html`, root), 'utf8');
    const definition = JSON.parse(html.match(/window\.SPXGCTemplateDefinition = (\{[\s\S]*?\});/)[1]);
    assert.match(html, new RegExp(`data-instance="broadcast-${index}"`));
    assert.equal(definition.webplayout, String(6 + index));
    assert.equal(definition.playlayer, String(6 + index));
    assert.deepEqual(definition.DataFields[0], { field: 'f0', ftype: 'hidden', title: `Broadcast ${index}`, value: `broadcast-${index}` });
    assert.equal(definition.DataFields.find(field => field.field === 'f2').ftype, 'checkbox');
    for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)) await access(new URL(match[1], root));
  }
});

test('the shared ticker has no broadcast identity, neutral defaults and complete dependencies', async () => {
  const root = new URL('../graphics/ticker/', import.meta.url);
  const html = await readFile(new URL('ticker.html', root), 'utf8');
  const definition = JSON.parse(html.match(/window\.SPXGCTemplateDefinition = (\{[\s\S]*?\});/)[1]);
  assert.doesNotMatch(html, /data-instance|broadcast-[123]/);
  assert.equal(definition.DataFields.some(field => field.field === 'f0'), false);
  assert.equal(definition.DataFields.find(field => field.field === 'f14').value, '[]');
  const defaults = JSON.parse(await readFile(new URL('data/defaults.json', root), 'utf8'));
  assert.deepEqual(defaults.tickerItems, []); assert.equal(defaults.location, ''); assert.equal(defaults.currentRound, '');
  for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)) await access(new URL(match[1], root));
});

test('SPX lifecycle bridge serializes Update, Play and Stop with normalized fields', async () => {
  const calls = [];
  const oldWindow = globalThis.window;
  globalThis.window = {
    Ticker: {
      ready: Promise.resolve(),
      getState: () => ({ instanceId: null }),
      selectInstance: () => { throw new Error('A shared template must not select a broadcast from legacy f0'); },
      update: async patch => calls.push(['update', patch]),
      show: async () => calls.push(['play']),
      hide: async () => calls.push(['stop'])
    }
  };
  try {
    await import('../graphics/ticker/adapters/spx.js');
    const pending = [window.update({ f0: 'broadcast-2', f2: '0', f5: 'SWISS ROUND 11' }), window.play(), window.stop()];
    await Promise.all(pending);
    assert.deepEqual(calls, [
      ['update', { currentRound: 'SWISS ROUND 11', showRoundsRemaining: false }],
      ['play'], ['stop']
    ]);
  } finally {
    globalThis.window = oldWindow;
  }
});
