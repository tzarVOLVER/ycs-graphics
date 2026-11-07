import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { tracks } from '../graphics/score-bug/motion.js';
import { roundLine } from '../graphics/score-bug/main.js';

const read = (path) => readFile(new URL('../graphics/' + path, import.meta.url), 'utf8');
const inlineScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const definition = (html) => {
  // The definition is always the first inline script. Later ones expect a real page.
  const window = {};
  runInNewContext(inlineScripts(html)[0], { window });
  return window.SPXGCTemplateDefinition;
};

test('import is safe: the only inline script is the field definition', async () => {
  const scripts = inlineScripts(await read('score-bug/score-bug.html'));
  assert.equal(scripts.length, 1);
  assert.match(scripts[0], /^\s*window\.SPXGCTemplateDefinition = \{/);
  assert.doesNotMatch(scripts[0], /\b(while|for|do|function|setInterval|setTimeout|import|fetch|require|process)\b/);
});

test('uses the BUG slot', async () => {
  assert.equal(definition(await read('score-bug/score-bug.html')).ycsSlot, 'ticker');
});

test("every field matches Siding's, so its links copy across", async () => {
  const bug = definition(await read('score-bug/score-bug.html'));
  const siding = definition(await read('match-status/siding.html'));
  for (const field of bug.DataFields) {
    const match = siding.DataFields.find((candidate) => candidate.field === field.field);
    assert.ok(match, field.field + ' exists on Siding');
    assert.equal(field.ftype, match.ftype, field.field);
    assert.equal(field.title, match.title, field.field);
  }
  const sections = bug.editorSections.flatMap((section) => section.fields).sort();
  assert.deepEqual(sections, bug.DataFields.map((field) => field.field).sort(), 'every field is in one editor section');
});

test('the round line drops the "of 15" ending but leaves Custom text alone', () => {
  const linked = (currentRound) => roundLine({ useCustomRound: false, currentRound, customRound: '' });
  assert.equal(linked('ADVANCED ROUND 10 OF 15'), 'ADVANCED ROUND 10');
  assert.equal(linked('Advanced Round 3 of 14'), 'Advanced Round 3');
  assert.equal(linked('TOP 8'), 'TOP 8');
  assert.equal(linked('BEST OF 3'), 'BEST OF 3');
  assert.equal(linked('TOP 8 - BEST OF 3'), 'TOP 8 - BEST OF 3');
  assert.equal(linked(''), '');
  assert.equal(roundLine({ useCustomRound: true, currentRound: 'ROUND 1 OF 15', customRound: 'BEST OF 3' }), 'BEST OF 3');
});

test('MATCH COMPLETE is fixed text, not a linked field', async () => {
  assert.match(await read('score-bug/score-bug.html'), /<span class="caption" data-fit>MATCH COMPLETE<\/span>/);
});

test('the reveal stays inside the package timing and never fades', () => {
  for (const [selector, frames, delay, duration] of tracks) {
    assert.ok(delay + duration <= 500, selector + ' finishes by 500ms');
    assert.ok(frames.every((frame) => !('opacity' in frame)), selector + ' has no fade');
  }
});
