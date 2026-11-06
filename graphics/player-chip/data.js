import { readSpxFields } from '../shared/data-contract.js';

export const defaults = () => ({ name: 'SAM A.', record: '9W - 2L', flag: './assets/flag.png', format: 'genesys', decktype: '' });
const fields = { f1: 'name', f2: 'record', f3: 'flag', f4: 'format', f5: 'decktype' };

export function normalizeFormat(value) {
  const format = value.trim().toLowerCase();
  if (!['', 'advanced', 'genesys'].includes(format)) throw new TypeError('Format must be Advanced or Genesys');
  return format;
}

export function formatLogo(format) {
  return ({ advanced: './assets/ycs-logo.png', genesys: './assets/genesys.png' })[format] || '';
}

export function decktypeName(value) {
  const name = value.trim();
  if (/[<>:"/\\|?*\u0000-\u001f\u007f]/.test(name) || name.startsWith('.') || /[. ]$/.test(name))
    throw new TypeError('Decktype must be a name, not a file path or URL');
  if (name.length > 240) throw new TypeError('Decktype name is too long');
  return name;
}

export function decktypeURL(name) {
  return name ? '/decktypes/' + encodeURIComponent(name + '.png') : '';
}

export function imageURL(value) {
  if (!value) return '';
  if (/^(?:[a-z]:[\\/]|\\\\)/i.test(value)) throw new TypeError('Use an HTTP image URL, not a Windows or network file path');
  const url = new URL(value, 'https://templates.local/');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new TypeError('Use an HTTP image URL or a relative asset path');
  return value;
}

// The show displays wins and losses only, so "12 W - 2 L - 1 D" reads "12 W - 2 L".
export function recordText(value) {
  return value.replace(/(?<=\d\s*L)\s*[-–—]\s*\d+\s*D(?:RAWS?)?\s*$/i, '');
}

export function applyFields(state, input) {
  const data = readSpxFields(input);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Expected SPX fields');
  const next = { ...state };
  for (const [field, key] of Object.entries(fields)) {
    if (!Object.hasOwn(data, field)) continue;
    const value = data[field];
    if (typeof value !== 'string' || value.length > 300) throw new TypeError(`${key} must be text of at most 300 characters`);
    next[key] = key === 'format' ? normalizeFormat(value) : key === 'decktype' ? decktypeName(value) : key === 'flag' ? imageURL(value) : key === 'record' ? recordText(value) : value;
  }
  return next;
}

export function chipWidth(nameWidth) {
  return Math.min(1775, Math.max(410, Math.ceil(87 + nameWidth + 38)));
}
