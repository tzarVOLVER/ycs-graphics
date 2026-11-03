import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDataStore, roundText } from '../graphics/ticker/src/data.js';
import { mapSpxUpdate } from '../graphics/ticker/src/spx-data.js';

test('custom round selection retains both sheet values across partial linked updates', () => {
  const store = createDataStore({ currentRound: 'GENESYS ROUND 1 OF 15', roundsRemaining: '7 ROUNDS REMAINING TODAY', showRoundsRemaining: true });
  const update = fields => store.patch('overrides', mapSpxUpdate(fields).patch);
  assert.equal(roundText(store.get()), 'GENESYS ROUND 1 OF 15');
  update({ f15: '0', f16: 'EXHIBITION MATCH' });
  assert.equal(roundText(store.get()), 'GENESYS ROUND 1 OF 15');
  update({ f15: '1' });
  assert.equal(roundText(store.get()), 'EXHIBITION MATCH');
  update({ f5: 'GENESYS ROUND 2 OF 15', f3: '6 ROUNDS REMAINING TODAY' });
  assert.equal(roundText(store.get()), 'EXHIBITION MATCH');
  assert.equal(store.get().roundsRemaining, '6 ROUNDS REMAINING TODAY');
  assert.equal(store.get().showRoundsRemaining, true);
  update({ f16: 'TOP 8' });
  assert.equal(roundText(store.get()), 'TOP 8');
  update({ f15: '0' });
  assert.equal(roundText(store.get()), 'GENESYS ROUND 2 OF 15');
  assert.equal(store.get().customRound, 'TOP 8');
});

test('custom checkbox uses classic SPX values and invalid updates leave previous state intact', () => {
  for (const v of [true, 1, '1']) assert.equal(mapSpxUpdate({ f15: v }).patch.useCustomRound, true);
  for (const v of [false, 0, '0']) assert.equal(mapSpxUpdate({ f15: v }).patch.useCustomRound, false);
  const store = createDataStore({ currentRound: 'ROUND 1' });
  for (const fields of [{ f15: 'false' }, { f15: 2 }, { f16: 5 }]) {
    assert.throws(() => store.patch('overrides', mapSpxUpdate(fields).patch));
    assert.equal(roundText(store.get()), 'ROUND 1');
  }
  const result = mapSpxUpdate({ data: [{ id: 'f15', value: '1' }, { id: 'f16', value: '<b>FINAL</b>' }] });
  assert.equal(roundText(store.patch('overrides', result.patch)), '<b>FINAL</b>');
  assert.equal(roundText(store.patch('overrides', { customRound: '' })), '');
});
