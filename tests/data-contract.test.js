import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as contract from '../graphics/ticker/src/data-contract.js';
import { mapSpxUpdate } from '../graphics/ticker/src/spx-data.js';
import { syncContracts } from '../scripts/sync-data-contracts.mjs';

const fixtures = JSON.parse(await readFile(new URL('../contracts/fixtures.json', import.meta.url)));
const check = (fn, item, key = 'value', error = 'error') => {
  if (item[error]) assert.throws(fn);
  else assert.deepEqual(fn(), item[key]);
};

test('generated ticker contract matches its canonical source', async () => {
  await syncContracts({ check: true });
});

test('shared fixtures define boolean policies, finite numbers and SPX payloads', () => {
  for (const item of fixtures.booleans) {
    for (const policy of ['checkbox', 'published', 'spx']) {
      check(() => contract.booleanValue(item.input, policy), item, policy, policy + 'Error');
    }
    check(
      () => mapSpxUpdate({ f2: item.input }).patch.showRoundsRemaining,
      item,
      'spx',
      'spxError'
    );
  }
  for (const item of fixtures.numbers) {
    check(() => contract.finiteNumber(item.input), item);
    if (item.error || item.value >= 0)
      check(() => mapSpxUpdate({ f8: item.input }).patch.crawlSpeed, item);
    else assert.throws(() => mapSpxUpdate({ f8: item.input }), 'ticker timing remains nonnegative');
  }
  for (const item of fixtures.spxFields) check(() => contract.readSpxFields(item.input), item);
});

test('shared JSON Pointer fixtures preserve escaped keys and reject inherited properties', () => {
  for (const item of fixtures.pointers) {
    check(() => contract.jsonPointerTokens(item.pointer), item, 'tokens');
    if (item.error) continue;
    assert.equal(item.tokens.reduce(contract.appendJsonPointer, ''), item.pointer);
    assert.deepEqual(
      contract.readJsonPointer(item.data, item.pointer),
      item.missing ? undefined : item.value
    );
  }
});

test('shared story fixtures pass through the SPX boundary with explicit ticker defaults', () => {
  for (const item of fixtures.stories) {
    check(
      () => mapSpxUpdate({ f14: JSON.stringify(item.items) }).patch.tickerItems,
      item,
      'ticker'
    );
  }
});
