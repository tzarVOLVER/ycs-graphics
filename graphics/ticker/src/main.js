import { createDataStore } from './data.js';
import { TickerRenderer } from './renderer.js';

const renderer = new TickerRenderer(document.getElementById('ticker'));
const templateInstanceId = document.documentElement.dataset.instance || 'broadcast-1';
let instanceId = templateInstanceId;
let stageId;
let store;
let disposed = false;
let loadRevision = 0;

async function readJson(path) {
  const response = await fetch(new URL(path, import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  return response.json();
}

async function loadInstance(id) {
  const revision = ++loadRevision;
  const [config, shared] = await Promise.all([readJson('../data/instances.json'), readJson('../data/shared.json')]);
  if (!Object.hasOwn(config, id)) throw new Error(`Unknown instance: ${id}`);
  const selected = config[id];
  if (!/^[a-z0-9-]+$/i.test(selected.stage)) throw new Error('Invalid stage ID');
  const stage = await readJson(`../data/stages/${selected.stage}.json`);
  if (disposed || revision !== loadRevision) return;
  const next = createDataStore(shared, stage, selected.overrides || {});
  renderer.apply(next.get());
  store = next;
  instanceId = id;
  stageId = selected.stage;
  document.documentElement.dataset.instance = id;
  document.documentElement.dataset.stage = stageId;
}

function change(layer, patch) {
  if (disposed) throw new Error('Ticker is disposed');
  renderer.apply(store.patch(layer, patch));
}

const ready = (async () => {
  await loadInstance(instanceId);
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
  selectInstance: id => ready.then(() => {
    if (id !== templateInstanceId) throw new Error(`This template is assigned to ${templateInstanceId}`);
    return loadInstance(id);
  }),
  reloadData: () => ready.then(() => loadInstance(instanceId)),
  getData: () => store?.get(),
  getState: () => ({ instanceId, stageId, ...renderer.getState() }),
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
  if (message.instanceId && message.instanceId !== instanceId) return;
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
