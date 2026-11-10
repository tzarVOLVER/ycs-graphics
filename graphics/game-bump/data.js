import { readSpxFields } from '../shared/data-contract.js';

export const defaults = () => ({ game: '' });

// The linked value is the match's current game number (gameCount). A blank, missing or odd value shows
// nothing rather than a wrong number, and never stops the graphic. f1 is a text field with a blank default
// on purpose: SPX refuses blank or out-of-range values for number fields and falls back to the typed
// default, which could show a wrong game.
export function gameNumber(value) {
  if (typeof value === 'number') value = String(value);
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return /^[1-9]\d{0,2}$/.test(text) ? text : '';
}

export const gameLine = (state) => (state.game ? 'GAME ' + state.game : '');

export function applyFields(state, input) {
  const fields = readSpxFields(input);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new TypeError('Expected SPX fields');
  const next = { ...state };
  if (Object.hasOwn(fields, 'f1')) next.game = gameNumber(fields.f1);
  return next;
}
