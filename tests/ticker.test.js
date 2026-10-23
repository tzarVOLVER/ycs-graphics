import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveData, createDataStore, validatePatch } from '../graphics/ticker/src/data.js';
import { TopicTiming, topicKey, crossedRightEdge, advanceOffset } from '../graphics/ticker/src/timing.js';

const item = (topic, subtopic = topic) => ({ category: 'YCS', topic, subtopic });

test('header waits after entry at the right edge, including a configurable zero delay', () => {
  const timing = new TopicTiming(180);
  timing.reset(item('A'));
  assert.equal(crossedRightEdge(1001, 999, 1000), true);
  assert.equal(crossedRightEdge(undefined, 999, 1000), false);
  assert.equal(crossedRightEdge(900, 898, 1000), false);
  timing.entered(item('B'), 1000);
  assert.equal(timing.takeDue(1179), null);
  assert.deepEqual(timing.takeDue(1180), item('B'));
  assert.equal(timing.takeDue(1181), null);
  timing.delayMs = 0;
  timing.entered(item('C'), 1200);
  assert.deepEqual(timing.takeDue(1200), item('C'));
});

test('same-topic subtopics do not restart the delay or animate the same label', () => {
  const timing = new TopicTiming(180);
  timing.reset(item('A'));
  timing.entered(item('B', 'first subtopic'), 0);
  timing.entered(item('B', 'second subtopic'), 100);
  assert.equal(timing.takeDue(180).topic, 'B');
  timing.entered(item('B', 'third subtopic'), 200);
  assert.equal(timing.takeDue(1000), null);
});

test('rapid boundaries replace stale transitions, including returning to the active topic', () => {
  const timing = new TopicTiming(180);
  timing.reset(item('A'));
  timing.entered(item('B'), 0);
  timing.entered(item('C'), 50);
  assert.equal(timing.takeDue(180), null);
  assert.equal(timing.takeDue(230).topic, 'C');
  timing.entered(item('B'), 300);
  timing.entered(item('C'), 350);
  assert.equal(timing.takeDue(1000), null);
});

test('topic events leave continuous motion independent of header timing', () => {
  const timing = new TopicTiming(180);
  timing.reset(item('A'));
  let offset = 0;
  for (let frame = 0; frame < 100; frame++) {
    if (frame === 10) timing.entered(item('B'), frame * 10);
    timing.takeDue(frame * 10);
    const previous = offset;
    offset = advanceOffset(offset, 10, 145);
    assert.ok(offset < previous);
  }
  assert.ok(Math.abs(offset + 145) < 1e-8);
  assert.equal(advanceOffset(0, 2000, 145), -7.25);
});

test('shared items append stage items while stage settings override shared settings', () => {
  const shared = { status: 'SHARED', crawlSpeed: 145, tickerItems: [item('A')] };
  const stage = { status: 'STAGE', tickerItems: [item('B')] };
  const result = resolveData(shared, stage);
  assert.equal(result.status, 'STAGE');
  assert.equal(result.crawlSpeed, 145);
  assert.deepEqual(result.tickerItems.map(value => value.topic), ['A', 'B']);
  assert.equal(result.topicEntryDelayMs, 180);
  assert.deepEqual(resolveData(shared, stage, { tickerItems: [item('C')] }).tickerItems, [item('C')]);
});

test('three broadcasts have independent data, playlists, and topic schedulers', () => {
  const shared = { status: 'SHARED', tickerItems: [item('A')] };
  const stores = Array.from({ length: 3 }, () => createDataStore(shared));
  const clocks = Array.from({ length: 3 }, () => new TopicTiming());
  stores[0].patch('stage', { status: 'STAGE 1' });
  stores[1].patch('overrides', { tickerItems: [item('B')] });
  const copy = stores[2].get();
  copy.tickerItems[0].topic = 'MUTATED';
  assert.deepEqual(stores.map(store => store.get().status), ['STAGE 1', 'SHARED', 'SHARED']);
  assert.deepEqual(stores.map(store => store.get().tickerItems[0].topic), ['A', 'B', 'A']);
  clocks[0].entered(item('B'), 0);
  assert.equal(clocks[0].takeDue(180).topic, 'B');
  assert.equal(clocks[1].takeDue(180), null);
  assert.equal(clocks[2].takeDue(180), null);
});

test('bad updates fail atomically and text stays data rather than HTML', () => {
  const store = createDataStore({ status: 'VALID' });
  assert.throws(() => store.patch('shared', { status: 'BROKEN', crawlSpeed: -1 }));
  assert.equal(store.get().status, 'VALID');
  for (const invalid of [null, [], { tickerItems: [null] }, { tickerItems: [{ subtopic: '' }] }, { showRoundsRemaining: 'false' }, { headerTransitionMs: Infinity }]) {
    assert.throws(() => validatePatch(invalid));
  }
  const html = '<img src=x onerror=alert(1)>';
  assert.equal(validatePatch({ tickerItems: [item(html)] }).tickerItems[0].subtopic, html);
  assert.notEqual(topicKey({ category: 'a|b', topic: 'c' }), topicKey({ category: 'a', topic: 'b|c' }));
});

test('all configured broadcasts resolve existing stage JSON files', async () => {
  const config = JSON.parse(await readFile(new URL('../graphics/ticker/data/instances.json', import.meta.url)));
  assert.deepEqual(Object.keys(config), ['broadcast-1', 'broadcast-2', 'broadcast-3']);
  for (const value of Object.values(config)) {
    const stage = JSON.parse(await readFile(new URL(`../graphics/ticker/data/stages/${value.stage}.json`, import.meta.url)));
    assert.deepEqual(stage, {});
  }
});
