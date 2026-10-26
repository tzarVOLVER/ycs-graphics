import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoundDataLink, parseLinkState, readLinkedValue } from '../graphics/ticker/src/data-link.js';
import { createDataService } from '../integrations/spx-data-link/server.mjs';

const settings = mode => ({ v: 1, mode, source: 'test.currentRound', manual: 'FEATURE MATCH' });
const snapshot = value => ({ values: { 'test.currentRound': value } });

function pilot(fetchSnapshot) {
  const updates = [];
  let callback;
  const link = new RoundDataLink({ fetchSnapshot, apply: value => updates.push(value), schedule: next => { callback = next; return 1; }, cancel: () => {} });
  return { link, updates, tick: () => callback() };
}

test('manual mode never fetches a source and preserves custom operator text', async () => {
  const { link, updates } = pilot(() => { throw new Error('Must not fetch in manual mode'); });
  assert.equal(await link.configure(settings('manual'), 'CUSTOM ROUND'), 'CUSTOM ROUND');
  assert.deepEqual(updates, []);
});

test('linked mode publishes changed values only and keeps the last valid value through outages', async () => {
  let value = 'ROUND 12';
  let fail = false;
  const { link, updates, tick } = pilot(async () => { if (fail) throw new Error('Offline'); return snapshot(value); });
  assert.equal(await link.configure(settings('linked'), 'FALLBACK'), 'ROUND 12');
  await tick();
  assert.deepEqual(updates, []);
  value = 'ROUND 13';
  await tick();
  assert.deepEqual(updates, ['ROUND 13']);
  fail = true;
  await tick();
  assert.equal(link.lastValue, 'ROUND 13');
  assert.deepEqual(updates, ['ROUND 13']);
  fail = false;
  value = 'ROUND 14';
  await tick();
  assert.deepEqual(updates, ['ROUND 13', 'ROUND 14']);
});

test('an in-flight source response cannot overwrite a manual override or revive a disposed link', async () => {
  let resolve;
  const { link, updates } = pilot(() => new Promise(done => { resolve = done; }));
  const pending = link.configure(settings('linked'), 'FALLBACK');
  assert.equal(await link.configure(settings('manual'), 'MY CUSTOM LABEL'), 'MY CUSTOM LABEL');
  resolve(snapshot('LATE ROUND'));
  assert.equal(await pending, undefined);
  assert.deepEqual(updates, []);
  const second = link.configure(settings('linked'), 'FALLBACK');
  link.dispose();
  resolve(snapshot('EVEN LATER'));
  assert.equal(await second, undefined);
  assert.deepEqual(updates, []);
});

test('invalid source values and metadata are rejected without treating text as HTML', () => {
  for (const state of [{ ...settings('linked'), v: 2 }, { ...settings('linked'), mode: 'anything' }, { ...settings('linked'), source: 'other' }, { ...settings('manual'), manual: null }]) assert.throws(() => parseLinkState(state));
  for (const value of ['', ' ', null, 15, 'x'.repeat(301)]) assert.throws(() => readLinkedValue(snapshot(value)));
  assert.equal(readLinkedValue(snapshot('<img src=x>')), '<img src=x>');
});

test('saved SPX Play metadata decodes once while Update metadata keeps literal entities', () => {
  const state = { ...settings('manual'), manual: 'ROUND "A" & <Final> \\ literal &quot;' };
  const raw = JSON.stringify(state);
  const saved = raw.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/\\/g, '&#92;');
  assert.deepEqual(parseLinkState(raw), state);
  assert.deepEqual(parseLinkState(saved), state);
});

test('data service persists accepted values, rejects invalid writes and untrusted browser origins, and survives restart', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'ycs-data-link-'));
  const stateFile = join(folder, 'source.json');
  let server;
  async function start() {
    server = await createDataService({ stateFile });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  const close = () => new Promise(resolve => server.close(resolve));
  const post = (base, value, headers = {}) => fetch(base + '/test-value', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-YCS-Link': '1', ...headers }, body: JSON.stringify({ value })
  });
  try {
    let base = await start();
    assert.equal((await fetch(base + '/snapshot', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await post(base, 'ROUND 20', { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await post(base, 'ROUND 20', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(base, '')).status, 400);
    const response = await post(base, 'ROUND 14', { Origin: 'http://127.0.0.1:5657' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5657');
    assert.equal(readLinkedValue(await response.json()), 'ROUND 14');
    const revision = JSON.parse(await readFile(stateFile, 'utf8')).revision;
    assert.equal((await post(base, 'x'.repeat(301))).status, 400);
    assert.equal(JSON.parse(await readFile(stateFile, 'utf8')).revision, revision);
    await close();
    base = await start();
    assert.equal(readLinkedValue(await (await fetch(base + '/snapshot')).json()), 'ROUND 14');
  } finally {
    if (server?.listening) await close();
    await rm(folder, { recursive: true, force: true });
  }
});
