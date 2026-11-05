import { booleanValue, readSpxFields } from '../shared/data-contract.js';

// Positions belong to the layout, never to the number of enabled plates.
export const LAYOUTS = Object.freeze({
  1: Object.freeze([762]),
  2: Object.freeze([352, 1170]),
  3: Object.freeze([150, 762, 1374]),
  4: Object.freeze([96, 540, 984, 1428])
});

export function defaults() {
  return {
    layout: 2,
    plates: ['HOST', 'COMMENTATOR', 'ANALYST', 'GUEST'].map((title) => ({
      enabled: true,
      name: 'FIRST LAST',
      title
    }))
  };
}

export function applyFields(state, input) {
  const fields = readSpxFields(input);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields))
    throw new TypeError('Expected SPX fields');
  const next = structuredClone(state);
  if (Object.hasOwn(fields, 'f2')) {
    if (!['1', '2', '3', '4'].includes(String(fields.f2)))
      throw new TypeError('Choose a layout from 1 to 4');
    next.layout = Number(fields.f2);
  }
  for (let index = 0; index < 4; index++) {
    const first = 3 + index * 3;
    if (Object.hasOwn(fields, `f${first}`))
      next.plates[index].enabled = booleanValue(fields[`f${first}`], 'spx');
    for (const [offset, key] of [
      [1, 'name'],
      [2, 'title']
    ]) {
      const field = `f${first + offset}`;
      if (!Object.hasOwn(fields, field)) continue;
      const value = fields[field];
      if (typeof value !== 'string' || value.length > 300)
        throw new TypeError(`${key} must be text of at most 300 characters`);
      next.plates[index][key] = value;
    }
  }
  return next;
}
