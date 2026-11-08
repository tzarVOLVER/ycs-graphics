import { booleanValue, finiteNumber, readSpxFields } from '../shared/data-contract.js';

export const defaults = () => ({ name: 'STEVEN DARLING', game: 1, score: 1, champion: false, championText: '' });
// Champion turns both sides gold and shows the typed caption, or CHAMPION when it's blank.
export const winnerLabel = state => state.champion ? state.championText.trim() || 'CHAMPION'
  : state.score === 2 ? 'MATCH WINNER' : state.game ? `GAME ${state.game} WINNER` : 'WINNER';

const text = (value, title) => {
  if (typeof value !== 'string' || value.length > 300) throw new TypeError(`${title} must be text of at most 300 characters`);
  return value;
};

export function applyFields(state, input) {
  const fields = readSpxFields(input);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new TypeError('Expected SPX fields');
  const next = { ...state };
  if (Object.hasOwn(fields, 'f1')) next.name = text(fields.f1, 'Player name');
  for (const [field, key, min, max] of [['f2', 'game', 1, 3], ['f3', 'score', 0, 2]]) {
    if (!Object.hasOwn(fields, field)) continue;
    // A linked value the data source does not have arrives blank.
    if (fields[field] === '') { next[key] = null; continue; }
    const value = finiteNumber(fields[field]);
    if (!Number.isInteger(value) || value < min || value > max) throw new TypeError(`${key} must be an integer from ${min} to ${max}`);
    next[key] = value;
  }
  // A blank checkbox value counts as unticked.
  if (Object.hasOwn(fields, 'f4')) next.champion = fields.f4 === '' ? false : booleanValue(fields.f4, 'spx');
  if (Object.hasOwn(fields, 'f5')) next.championText = text(fields.f5, 'Champion text');
  return next;
}
