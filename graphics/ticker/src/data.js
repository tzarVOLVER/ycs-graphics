export const DEFAULT_TIMING = Object.freeze({
  topicEntryDelayMs: 180,
  headerTransitionMs: 180,
  headerSwapGapMs: 10
});

const textFields = ['logo', 'background', 'dayDate', 'location', 'status', 'currentRound', 'roundsRemaining'];

export function validatePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Ticker data must be an object');
  const result = {};
  for (const field of textFields) {
    if (Object.hasOwn(patch, field)) {
      if (typeof patch[field] !== 'string') throw new TypeError(`${field} must be text`);
      result[field] = patch[field];
    }
  }
  for (const field of ['crawlSpeed', ...Object.keys(DEFAULT_TIMING)]) {
    if (Object.hasOwn(patch, field)) {
      if (!Number.isFinite(patch[field]) || patch[field] < 0) throw new TypeError(`${field} must be a finite nonnegative number`);
      result[field] = patch[field];
    }
  }
  if (Object.hasOwn(patch, 'showRoundsRemaining')) {
    if (typeof patch.showRoundsRemaining !== 'boolean') throw new TypeError('showRoundsRemaining must be boolean');
    result.showRoundsRemaining = patch.showRoundsRemaining;
  }
  if (Object.hasOwn(patch, 'tickerItems')) {
    if (!Array.isArray(patch.tickerItems)) throw new TypeError('tickerItems must be an array');
    if (patch.tickerItems.length > 200 || new TextEncoder().encode(JSON.stringify(patch.tickerItems)).length > 65536) throw new TypeError('Playlist exceeds 200 stories or 64 KB');
    const ids = new Set();
    result.tickerItems = patch.tickerItems.map(item => {
      if (!item || typeof item.subtopic !== 'string' || !item.subtopic.trim()) throw new TypeError('Every ticker item needs nonempty subtopic text');
      for (const field of ['category', 'topic']) {
        if (item[field] !== undefined && typeof item[field] !== 'string') throw new TypeError(`Item ${field} must be text`);
      }
      for (const key of ['category', 'topic', 'subtopic']) if ((item[key] || '').length > 4000) throw new TypeError('Story text exceeds 4000 characters');
      if (item.id !== undefined) {
        if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200 || ids.has(item.id)) throw new TypeError('Story IDs must be nonempty and unique');
        ids.add(item.id);
      }
      return { category: item.category || '', topic: item.topic || '', subtopic: item.subtopic, ...(item.id === undefined ? {} : { id: item.id }) };
    });
  }
  return result;
}

// Scalar settings use stage precedence. Stage items append to shared items;
// direct instance overrides can replace the entire resulting playlist.
export function resolveData(shared = {}, stage = {}, overrides = {}) {
  const base = validatePatch(shared), specific = validatePatch(stage), local = validatePatch(overrides);
  return structuredClone({
    ...DEFAULT_TIMING, crawlSpeed: 145, ...base, ...specific,
    tickerItems: [...(base.tickerItems || []), ...(specific.tickerItems || [])],
    ...local
  });
}

export function createDataStore(shared = {}, stage = {}, overrides = {}) {
  let layers = { shared: validatePatch(shared), stage: validatePatch(stage), overrides: validatePatch(overrides) };
  return {
    get: () => resolveData(layers.shared, layers.stage, layers.overrides),
    patch(layer, patch) {
      if (!Object.hasOwn(layers, layer)) throw new Error(`Unknown data layer: ${layer}`);
      const next = { ...layers[layer], ...validatePatch(patch) };
      layers = { ...layers, [layer]: next };
      return this.get();
    },
    replace(shared, stage, overrides = layers.overrides) {
      const next = { shared: validatePatch(shared), stage: validatePatch(stage), overrides: validatePatch(overrides) };
      layers = next;
      return this.get();
    }
  };
}
