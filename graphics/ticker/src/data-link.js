// Optional one-field SPX data-link pilot. Templates without f13 are unaffected.
export const LINK_FIELD = 'f13';
export const LINK_SOURCE = 'test.currentRound';
export const LINK_ENDPOINT = 'http://127.0.0.1:8787';

export function readFields(input) {
  const payload = typeof input === 'string' ? JSON.parse(input) : input;
  if (Array.isArray(payload?.data)) return Object.fromEntries(payload.data.map(({ id, value }) => [id, value]));
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
}

export function parseLinkState(value) {
  let state = value;
  if (typeof value === 'string') {
    try { state = JSON.parse(value); }
    catch {
      // SPX 1.4.1 escapes saved field strings on Play, while Update carries raw
      // strings. Decode exactly one layer, only when the original is not JSON.
      const decoded = value.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#92;/g, '\\')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      state = JSON.parse(decoded);
    }
  }
  if (state?.v !== 1 || !['manual', 'linked'].includes(state.mode) || state.source !== LINK_SOURCE || typeof state.manual !== 'string') {
    throw new TypeError('Invalid Current round link settings');
  }
  return { v: 1, mode: state.mode, source: state.source, manual: state.manual };
}

export function readLinkedValue(snapshot) {
  const value = snapshot?.values?.[LINK_SOURCE];
  if (typeof value !== 'string' || !value.trim() || value.length > 300) throw new TypeError('Source must supply a nonempty round label (maximum 300 characters)');
  return value;
}

export class RoundDataLink {
  constructor({ apply, fetchSnapshot, intervalMs = 2000, schedule = (callback, ms) => setTimeout(callback, ms), cancel = timer => clearTimeout(timer) }) {
    this.apply = apply;
    this.fetchSnapshot = fetchSnapshot;
    this.intervalMs = intervalMs;
    this.schedule = schedule;
    this.cancel = cancel;
    this.generation = 0;
    this.state = null;
    this.timer = null;
    this.disposed = false;
    this.lastValue = undefined;
  }

  async configure(raw, fallback) {
    if (this.disposed) throw new Error('Data link is disposed');
    const next = parseLinkState(raw);
    this.cancel(this.timer);
    const generation = ++this.generation;
    this.state = next;
    if (next.mode === 'manual') return fallback ?? next.manual;
    // Every explicit SPX update starts from its own saved snapshot, not another item.
    this.lastValue = fallback;
    const value = await this.read(generation);
    if (generation === this.generation && !this.disposed) this.arm(generation);
    return value;
  }

  async read(generation) {
    try {
      const value = readLinkedValue(await this.fetchSnapshot());
      if (this.disposed || generation !== this.generation) return undefined;
      this.lastValue = value;
      this.error = null;
      return value;
    } catch (error) {
      if (generation !== this.generation || this.disposed) return undefined;
      this.error = error;
      return this.lastValue;
    }
  }

  arm(generation) {
    this.timer = this.schedule(async () => {
      const previous = this.lastValue;
      const value = await this.read(generation);
      if (this.disposed || generation !== this.generation) return;
      try {
        if (value !== undefined && value !== previous) await this.apply(value);
      } catch (error) {
        this.error = error;
        if (generation === this.generation) this.lastValue = previous;
      }
      if (!this.disposed && generation === this.generation) this.arm(generation);
    }, this.intervalMs);
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    this.cancel(this.timer);
  }
}
