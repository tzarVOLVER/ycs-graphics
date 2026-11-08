import { booleanValue, readSpxFields } from '../shared/data-contract.js';
import { decktypeName, decktypeURLs, imageURL, recordText } from '../player-chip/data.js';

export const defaults = () => ({
  leftName: 'BILLY L.',
  rightName: 'RONALD L.',
  leftFlag: './assets/flag.png',
  rightFlag: './assets/flag.png',
  leftRecord: '7W - 1L',
  rightRecord: '7W - 1L',
  leftDecktype: '',
  rightDecktype: '',
  currentRound: 'ADVANCED ROUND 9 OF 14',
  useCustomRound: false,
  customRound: '',
  leftFraming: {},
  rightFraming: {}
});

// Field numbers shared with Siding keep Siding's meaning, so its links copy across.
const textFields = { f4: 'leftName', f5: 'currentRound', f6: 'rightName', f16: 'customRound' };
const flagFields = { f7: 'leftFlag', f8: 'rightFlag' };
const recordFields = { f11: 'leftRecord', f12: 'rightRecord' };
const deckFields = { f13: 'leftDecktype', f14: 'rightDecktype' };
const framingFields = {
  f17: ['leftFraming', 'zoom'], f18: ['leftFraming', 'x'], f19: ['leftFraming', 'y'],
  f20: ['rightFraming', 'zoom'], f21: ['rightFraming', 'x'], f22: ['rightFraming', 'y']
};
// Below 100% the art would no longer fill the window.
const framingLimits = { zoom: [100, 400], x: [0, 100], y: [0, 100] };

// A full-screen graphic must still play when one value is odd, so a decktype or flag that can't be used
// is shown blank instead of stopping the update (the chips are stricter).
export function deckName(value) {
  // The name is kept exactly as it arrives, non-breaking spaces and a final period included: some files
  // are named that way. main.js also tries the spellings with the other kind of space.
  try { return decktypeName(value); } catch { return ''; }
}
export function flagURL(value) {
  if (value === 'none') return '';
  try { return imageURL(value); } catch { return ''; }
}

// Same rule as the score bug: the linked round drops an "OF 14" ending; Custom text is shown as typed.
export function roundLine(state) {
  if (state.useCustomRound) return state.customRound;
  return state.currentRound.replace(/(\bROUND\s+\d+)\s+OF\s+\d+\s*$/i, '$1');
}

// The design spaces the record out letter by letter, so "7W - 1L" shows as "7W-1L".
export const recordLine = (record) => record.trim().replace(/\s*[-–—]\s*/g, '-').replace(/\s+/g, ' ');

// A framing number that's blank or not a number is ignored, so a typo on air never stops the graphic.
export function framingValue(key, value) {
  const text = String(value ?? '').trim().replace(/%$/, '');
  if (text === '') return undefined;
  const number = Number(text);
  if (!Number.isFinite(number)) return undefined;
  const [min, max] = framingLimits[key];
  return Math.min(max, Math.max(min, number));
}

const text = (key, value) => {
  if (typeof value !== 'string' || value.length > 300) throw new TypeError(`${key} must be text of at most 300 characters`);
  return value;
};

export function applyFields(state, input) {
  const fields = readSpxFields(input);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new TypeError('Expected SPX fields');
  const next = { ...state, leftFraming: { ...state.leftFraming }, rightFraming: { ...state.rightFraming } };
  for (const [field, key] of Object.entries(textFields)) if (Object.hasOwn(fields, field)) next[key] = text(key, fields[field]);
  for (const [field, key] of Object.entries(flagFields)) if (Object.hasOwn(fields, field)) next[key] = flagURL(text(key, fields[field]));
  for (const [field, key] of Object.entries(recordFields)) if (Object.hasOwn(fields, field)) next[key] = recordText(text(key, fields[field]));
  for (const [field, key] of Object.entries(deckFields)) if (Object.hasOwn(fields, field)) next[key] = deckName(text(key, fields[field]));
  for (const [field, [side, key]] of Object.entries(framingFields)) {
    if (!Object.hasOwn(fields, field)) continue;
    const value = framingValue(key, fields[field]);
    if (value === undefined) delete next[side][key];
    else next[side][key] = value;
  }
  if (Object.hasOwn(fields, 'f15')) next.useCustomRound = booleanValue(fields.f15, 'spx');
  return next;
}

// Saved framing is keyed by decktype name, ignoring case and extra spaces.
const deckKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();
export function savedFraming(library, name) {
  if (!name || !library || typeof library !== 'object') return {};
  const decks = library.decks && typeof library.decks === 'object' ? library.decks : {};
  const wanted = deckKey(name);
  const match = Object.entries(decks).find(([key]) => deckKey(key) === wanted);
  if (!match || !match[1] || typeof match[1] !== 'object') return {};
  const out = {};
  for (const key of Object.keys(framingLimits)) {
    const value = framingValue(key, match[1][key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// Editor values win over the saved framing, which wins over the default: centred, filling the window.
export function deckFraming(library, name, override = {}) {
  const framing = { zoom: 100, x: 50, y: 50, ...savedFraming(library, name), ...override };
  return { zoom: framing.zoom / 100, x: framing.x + '%', y: framing.y + '%' };
}

export { decktypeURLs };
