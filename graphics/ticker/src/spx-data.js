import { validatePatch } from './data.js';

const textFields = { f3: 'roundsRemaining', f4: 'status', f5: 'currentRound', f6: 'dayDate', f7: 'location', f11: 'logo', f12: 'background' };
const numberFields = { f8: 'crawlSpeed', f9: 'topicEntryDelayMs', f10: 'headerTransitionMs' };

export function mapSpxUpdate(input) {
  const payload = typeof input === 'string' ? JSON.parse(input) : input;
  let fields = payload || {};
  if (Array.isArray(payload?.data)) fields = Object.fromEntries(payload.data.map(field => [field.id, field.value]));
  else if (payload?.data && typeof payload.data === 'object') fields = payload.data;
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
      const value = fields[field];
      if (!['string', 'number'].includes(typeof value) || String(value).trim() === '') throw new TypeError(`${field} requires a number`);
      patch[name] = Number(value);
    }
  }
  if (Object.hasOwn(fields, 'f2')) {
    const value = fields.f2;
    if ([true, 1, '1'].includes(value)) patch.showRoundsRemaining = true;
    else if ([false, 0, '0'].includes(value)) patch.showRoundsRemaining = false;
    else throw new TypeError('f2 requires checkbox value 0 or 1');
  }
  if (fields.f0 !== undefined && !['broadcast-1', 'broadcast-2', 'broadcast-3'].includes(fields.f0)) throw new TypeError('Unknown broadcast instance');
  return { instanceId: fields.f0, patch: validatePatch(patch) };
}
