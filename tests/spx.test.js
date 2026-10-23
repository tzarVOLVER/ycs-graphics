import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSpxUpdate } from '../graphics/ticker/src/spx-data.js';

test('SPX checkbox handles checked and unchecked string, number and boolean values', () => {
  for (const value of ['0', 0, false]) assert.equal(mapSpxUpdate({ f2: value }).patch.showRoundsRemaining, false);
  for (const value of ['1', 1, true]) assert.equal(mapSpxUpdate({ f2: value }).patch.showRoundsRemaining, true);
  assert.equal(Object.hasOwn(mapSpxUpdate({ f4: 'COMING UP' }).patch, 'showRoundsRemaining'), false);
});

test('SPX accepts classic JSON data arrays and maps native operator fields', () => {
  const fields = { f0: 'broadcast-2', f2: '0', f3: '3 ROUNDS LEFT', f4: 'COMING UP', f5: 'ROUND 4', f6: 'DAY 2', f7: 'LOCATION', f8: '145', f9: '220', f10: '180', f11: './new-logo.png', f12: './new-background.png' };
  const result = mapSpxUpdate(JSON.stringify({ data: Object.entries(fields).map(([id, value]) => ({ id, value })) }));
  assert.equal(result.instanceId, 'broadcast-2');
  assert.deepEqual(result.patch, { roundsRemaining: '3 ROUNDS LEFT', status: 'COMING UP', currentRound: 'ROUND 4', dayDate: 'DAY 2', location: 'LOCATION', crawlSpeed: 145, topicEntryDelayMs: 220, headerTransitionMs: 180, logo: './new-logo.png', background: './new-background.png', showRoundsRemaining: false });
});

test('native SPX fields take precedence over additional JSON without clearing absent fields', () => {
  const result = mapSpxUpdate({ data: { f1: '{"status":"JSON","tickerItems":[],"showRoundsRemaining":true}', f4: 'NATIVE', f2: '0', f9: '0' } });
  assert.deepEqual(result.patch, { status: 'NATIVE', tickerItems: [], showRoundsRemaining: false, topicEntryDelayMs: 0 });
});

test('SPX rejects invalid values before selecting another output or updating its data', () => {
  for (const value of [{ f2: 'false' }, { f2: 2 }, { f9: '' }, { f8: true }, { f10: '-1' }, { f9: 'NaN' }, { f0: 'other' }, { f1: 'broken JSON' }, { f1: '[]' }]) assert.throws(() => mapSpxUpdate(value));
});
