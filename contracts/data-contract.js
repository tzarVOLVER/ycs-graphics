// Canonical, dependency-free data conversions shared by the graphics and SPX.
// Keep protocol policies explicit: a Published cell is more permissive than
// the classic SPX checkbox wire format. Consumers own their error messages.
export function booleanValue(value, policy = 'checkbox') {
  if (policy === 'spx') {
    if ([true, 1, '1'].includes(value)) return true;
    if ([false, 0, '0'].includes(value)) return false;
    throw new TypeError('Expected SPX checkbox value 0 or 1');
  }
  if (!['checkbox', 'published'].includes(policy)) throw new TypeError('Unknown boolean policy');
  const text =
    policy === 'published'
      ? String(value ?? '')
          .trim()
          .toLowerCase()
      : String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text) || (policy === 'published' && text === ''))
    return false;
  throw new TypeError('Expected true/false or 1/0');
}

export function checkboxValue(value) {
  return booleanValue(value) ? '1' : '0';
}

export function finiteNumber(value) {
  if (
    !['string', 'number'].includes(typeof value) ||
    String(value).trim() === '' ||
    !Number.isFinite(Number(value))
  ) {
    throw new TypeError('Expected a number');
  }
  return Number(value);
}

export function validJsonPointer(value) {
  return (
    typeof value === 'string' &&
    value.length <= 2048 &&
    (value === '' || /^\/(?:[^~]|~[01])*$/.test(value))
  );
}

export function jsonPointerTokens(pointer) {
  if (!validJsonPointer(pointer)) throw new TypeError('Choose a valid JSON path');
  return pointer === ''
    ? []
    : pointer
        .slice(1)
        .split('/')
        .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function appendJsonPointer(pointer, token) {
  return pointer + '/' + String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

export function readJsonPointer(value, pointer) {
  for (const token of jsonPointerTokens(pointer)) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, token))
      return undefined;
    value = value[token];
  }
  return value;
}

export function readSpxFields(input) {
  const payload = typeof input === 'string' ? JSON.parse(input) : input;
  if (Array.isArray(payload?.data))
    return Object.fromEntries(payload.data.map((field) => [field.id, field.value]));
  if (payload?.data && typeof payload.data === 'object') return payload.data;
  return payload || {};
}
