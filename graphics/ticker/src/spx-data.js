import { validatePatch } from './data.js';
import { booleanValue, finiteNumber, readSpxFields } from './data-contract.js';
export { readSpxFields } from './data-contract.js';

const textFields = { f3: 'roundsRemaining', f4: 'status', f5: 'currentRound', f6: 'dayDate', f7: 'location', f11: 'logo', f12: 'background', f16: 'customRound' };
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
  for (const [field, name] of [['f2', 'showRoundsRemaining'], ['f15', 'useCustomRound']]) {
    if (Object.hasOwn(fields, field)) {
      try { patch[name] = booleanValue(fields[field], 'spx'); }
      catch { throw new TypeError(`${field} requires checkbox value 0 or 1`); }
    }
  }
  return { patch: validatePatch(patch) };
}
