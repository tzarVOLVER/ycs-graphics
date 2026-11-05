import { finiteNumber, readSpxFields } from '../shared/data-contract.js';

export const defaults = () => ({ name: 'STEVEN DARLING', game: 1, score: 1 });
export const winnerLabel = state => state.score === 2 ? 'MATCH WINNER' : state.game ? `GAME ${state.game} WINNER` : 'WINNER';

export function applyFields(state, input) {
  const fields = readSpxFields(input);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new TypeError('Expected SPX fields');
  const next = { ...state };
  if (Object.hasOwn(fields, 'f1')) {
    if (typeof fields.f1 !== 'string' || fields.f1.length > 300) throw new TypeError('Player name must be text of at most 300 characters');
    next.name = fields.f1;
  }
  for (const [field, key, min, max] of [['f2', 'game', 1, 3], ['f3', 'score', 0, 2]]) {
    if (!Object.hasOwn(fields, field)) continue;
    // A linked value the data source does not have arrives blank.
    if (fields[field] === '') { next[key] = null; continue; }
    const value = finiteNumber(fields[field]);
    if (!Number.isInteger(value) || value < min || value > max) throw new TypeError(`${key} must be an integer from ${min} to ${max}`);
    next[key] = value;
  }
  return next;
}
