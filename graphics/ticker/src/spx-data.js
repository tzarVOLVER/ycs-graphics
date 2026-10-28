import { validatePatch } from './data.js';
import { booleanValue, finiteNumber, readSpxFields } from './data-contract.js';
export { readSpxFields } from './data-contract.js';

const textFields = { f3: 'roundsRemaining', f4: 'status', f5: 'currentRound', f6: 'dayDate', f7: 'location', f11: 'logo', f12: 'background' };
const numberFields = { f8: 'crawlSpeed', f9: 'topicEntryDelayMs', f10: 'headerTransitionMs' };

export function mapSpxUpdate(input) {
  const fields = readSpxFields(input);
  const advanced = typeof fields.f1 === 'string' ? JSON.parse(fields.f1 || '{}') : fields.f1 ?? {};
  const patch = validatePatch(advanced);
  if (Object.hasOwn(fields, 'f14')) {
    let stories = fields.f14;
    if (typeof stories === 'string') {
      try { stories = JSON.parse(stories); }
      catch { stories = JSON.parse(stories.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#92;/g, '\\').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')); }
    }
    patch.tickerItems = validatePatch({ tickerItems: stories }).tickerItems;
  }
  for (const [field, name] of Object.entries(textFields)) {
    if (Object.hasOwn(fields, field)) patch[name] = fields[field];
  }
  for (const [field, name] of Object.entries(numberFields)) {
    if (Object.hasOwn(fields, field)) {
      try { patch[name] = finiteNumber(fields[field]); }
      catch { throw new TypeError(`${field} requires a number`); }
    }
  }
  if (Object.hasOwn(fields, 'f2')) {
    try { patch.showRoundsRemaining = booleanValue(fields.f2, 'spx'); }
    catch { throw new TypeError('f2 requires checkbox value 0 or 1'); }
  }
  if (fields.f0 !== undefined && !['broadcast-1', 'broadcast-2', 'broadcast-3'].includes(fields.f0)) throw new TypeError('Unknown broadcast instance');
  return { instanceId: fields.f0, patch: validatePatch(patch) };
}
