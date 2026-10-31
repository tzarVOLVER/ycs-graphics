import { createDataStore } from './data.js';
import { TickerRenderer } from './renderer.js';

const renderer = new TickerRenderer(document.getElementById('ticker'));
// The containing output owns routing; SPX supplies this frame's content.
let store;
let disposed = false;
let loadRevision = 0;

async function readJson(path) {
  const response = await fetch(new URL(path, import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  return response.json();
}

async function loadDefaults() {
  const revision = ++loadRevision;
  const defaults = await readJson('../data/defaults.json');
  if (disposed || revision !== loadRevision) return;
  const next = createDataStore(defaults);
  renderer.apply(next.get());
  store = next;
}

function change(layer, patch) {
  if (disposed) throw new Error('Ticker is disposed');
  renderer.apply(store.patch(layer, patch));
}

const ready = (async () => {
  await loadDefaults();
  await document.fonts.ready;
  if (disposed) return;
  renderer.fitRound();
  renderer.start();
  // SPX owns visibility. Loading or updating a template must never put it on air.
  document.documentElement.dataset.ready = 'true';
})();

window.Ticker = {
  ready,
  show: () => ready.then(() => renderer.show()),
  hide: () => ready.then(() => renderer.hide()),
  pause: () => ready.then(() => renderer.pause()),
  resume: () => ready.then(() => renderer.resume()),
  update: patch => ready.then(() => change('overrides', patch)),
  updateShared: patch => ready.then(() => change('shared', patch)),
  updateStage: patch => ready.then(() => change('stage', patch)),
  reloadData: () => ready.then(() => loadDefaults()),
  getData: () => store?.get(),
  getState: () => renderer.getState(),
  dispose: () => { disposed = true; renderer.dispose(); window.removeEventListener('message', onMessage); }
};

function reportError(error) {
  console.error('[YCS ticker]', error);
  document.documentElement.dataset.error = error.message;
  window.dispatchEvent(new CustomEvent('ycs-ticker-error', { detail: error.message }));
}

function onMessage(event) {
  // Only the containing controller on the same origin can operate this output.
  if (event.source !== window.parent || event.origin !== location.origin || event.origin === 'null') return;
  const message = event.data;
  if (!message || message.type !== 'YCS_TICKER') return;
  const actions = {
    show: () => window.Ticker.show(), hide: () => window.Ticker.hide(),
    pause: () => window.Ticker.pause(), resume: () => window.Ticker.resume(),
    update: () => window.Ticker.update(message.data),
    shared: () => window.Ticker.updateShared(message.data),
    stage: () => window.Ticker.updateStage(message.data),
    reload: () => window.Ticker.reloadData()
  };
  if (Object.hasOwn(actions, message.action)) actions[message.action]().catch(reportError);
}
window.addEventListener('message', onMessage);
ready.then(() => window.dispatchEvent(new Event('ycs-ticker-ready'))).catch(reportError);
