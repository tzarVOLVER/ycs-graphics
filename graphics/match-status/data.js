import { booleanValue, finiteNumber, readSpxFields } from '../shared/data-contract.js';

export function defaults(variant) {
  if (!['shuffling', 'siding'].includes(variant)) throw new TypeError('Unknown match template');
  return {
    variant,
    leftName: 'CREIGHTON P.',
    rightName: 'THOMAS G.',
    leftFlag: './assets/us.png',
    rightFlag: './assets/us.png',
    currentRound: 'ADVANCED ROUND 10 OF 15',
    showRoundsRemaining: true,
    roundsRemaining: '13 ROUNDS REMAINING TODAY',
    ...(variant === 'siding' ? { leftScore: '0', rightScore: '1' } : {})
  };
}

const textFields = { f3: 'roundsRemaining', f4: 'leftName', f5: 'currentRound', f6: 'rightName' };
const flagFields = { f7: 'leftFlag', f8: 'rightFlag' };
const scoreFields = { f9: 'leftScore', f10: 'rightScore' };

export function applyFields(state, input) {
  const fields = readSpxFields(input);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields))
    throw new TypeError('Expected SPX fields');
  const next = { ...state };
  for (const [field, key] of Object.entries({ ...textFields, ...flagFields })) {
    if (!Object.hasOwn(fields, field)) continue;
    const value = fields[field];
    if (typeof value !== 'string' || value.length > 300)
      throw new TypeError(`${key} must be text of at most 300 characters`);
    const normalized = Object.hasOwn(flagFields, field) && value === 'none' ? '' : value;
    if (Object.hasOwn(flagFields, field) && normalized) {
      const url = new URL(normalized, 'https://templates.local/');
      if (!['http:', 'https:'].includes(url.protocol))
        throw new TypeError('Unsupported flag image URL');
    }
    next[key] = normalized;
  }
  if (Object.hasOwn(fields, 'f2')) next.showRoundsRemaining = booleanValue(fields.f2, 'spx');
  if (state.variant === 'siding')
    for (const [field, key] of Object.entries(scoreFields)) {
      if (!Object.hasOwn(fields, field)) continue;
      const score = finiteNumber(fields[field]);
      if (score < 0) throw new TypeError('Scores must be non-negative numbers');
      next[key] = String(score);
    }
  return next;
}
