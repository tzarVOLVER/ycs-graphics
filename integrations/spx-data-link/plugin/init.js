// SPX 1.4.1 editor enhancement. Only templates declaring the pilot f13 opt in.
import { LINK_ENDPOINT, LINK_SOURCE, parseLinkState, readLinkedValue } from '/templates/ycs-link-test/ticker/src/data-link.js';

const controls = new Map();
let snapshot;
let sourceError = 'Connecting to test source';
let polling = false;
const css = document.createElement('style');
css.textContent = `
.ycs-link-line{display:flex;align-items:center;gap:6px;margin:4px 0 0}
.ycs-link-line .gcinput{flex:1;min-width:0;margin:0}
.ycs-link-button{background:transparent;border:0;color:#a6afb4;width:30px;height:32px;cursor:pointer;padding:3px;flex:none}
.ycs-link-button svg{width:24px;height:24px;stroke:currentColor;stroke-width:2.3;fill:none}
.ycs-link-button[aria-pressed=true]{color:#79df58}
.ycs-link-button[data-stale=true]{color:#efbd55}
.ycs-link-line input[readonly]{background:#424e56;color:#f2f4f5;cursor:default;opacity:1}
.ycs-link-hint{font-size:11px;color:#b9c6ce;margin:3px 0 6px 36px;line-height:1.45}
.ycs-link-hint[data-error=true]{color:#efbd55}
.ycs-link-preview{overflow:hidden;position:relative;background:repeating-conic-gradient(#20272d 0% 25%,#252e35 0% 50%) 50%/16px 16px;margin:5px 0 10px;border:1px solid #53616d}
.ycs-link-preview iframe{width:1920px;height:1080px;border:0;position:absolute;left:0;top:0;transform-origin:top left;pointer-events:none}
.ycs-link-manager{position:fixed;inset:15% 20%;z-index:10000;background:#25323c;color:#edf1f4;border:1px solid #607582;border-radius:8px;padding:24px;box-shadow:0 12px 60px #000a;overflow:auto;font:15px sans-serif}
.ycs-link-manager input{width:100%;box-sizing:border-box;padding:10px;margin:12px 0;color:#111;background:#fff}
.ycs-link-manager button{padding:9px 14px;cursor:pointer;margin-right:8px}
.ycs-link-manager p{line-height:1.5}.ycs-link-manager code{color:#f2d65c}
`;
document.head.append(css);

async function sourceRequest(path, options = {}) {
  const response = await fetch(LINK_ENDPOINT + path, { cache: 'no-store', signal: AbortSignal.timeout(1500), ...options });
  if (!response.ok) throw new Error('Data service unavailable');
  return response.json();
}

function markPending(row) {
  row.setAttribute('data-spx-changed', 'true');
  row.querySelector('[data-spx-name="updatebutton"]')?.classList.remove('disabled');
}

function collect(row) {
  return [...row.querySelectorAll('[data-update]')].map(input => ({
    field: input.getAttribute('data-update'),
    value: input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value
  }));
}

async function spxPost(path, body) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error('SPX could not save or preview the link change');
  return response;
}

function draw(control) {
  const linked = control.state.mode === 'linked';
  control.input.readOnly = linked;
  control.button.setAttribute('aria-pressed', String(linked));
  control.button.dataset.stale = String(linked && !!sourceError);
  control.button.setAttribute('aria-label', linked ? 'Unlink Current round' : 'Link Current round');
  control.button.title = linked ? 'Unlink and restore your saved manual text' : 'Link to Local test source → Current round';
  control.hint.dataset.error = String(!!control.error || (linked && !!sourceError));
  control.hint.textContent = control.error || (linked
    ? `${sourceError ? 'Stale — retaining last value' : 'Linked · Local test source'} · Update applies changes on air`
    : 'Manual · Live source cannot overwrite this text');
  control.metadata.value = JSON.stringify(control.state);
}

function persist(control) {
  // Save only this field and its metadata; do not save unrelated pending edits.
  const body = {
    rundownfile: document.getElementById('datafile').value,
    epoch: control.row.getAttribute('data-spx-epoch'),
    DataFields: [{ field: 'f5', value: control.input.value }, { field: 'f13', value: control.metadata.value }]
  };
  control.saving = control.saving.catch(() => {}).then(() => spxPost('/gc/saveItemChanges', body));
  return control.saving.catch(error => { control.error = error.message; draw(control); throw error; });
}

async function preview(control) {
  // SPX's regular preview reads the saved rundown. Prepopulated preview carries
  // this item's working fields and is routed exclusively to preview renderers.
  const value = name => control.row.querySelector(`[name="RundownItem[${name}]"]`)?.value;
  await spxPost('/gc/playout', {
    prepopulated: 'true', projectFormat: 'SPX', command: control.previewStarted ? 'update' : 'preview',
    playmode: 'preview', fields: collect(control.row),
    datafile: document.getElementById('datafile').value,
    epoch: control.row.getAttribute('data-spx-epoch'),
    relpath: value('relpath'), playserver: '-', playchannel: '1', playlayer: '1', webplayout: '1', dataformat: 'json'
  });
  control.previewStarted = true;
}

async function updatePilot(control) {
  try {
    clearTimeout(control.debounce);
    draw(control);
    await persist(control);
    const value = name => control.row.querySelector(`[name="RundownItem[${name}]"]`)?.value;
    // The packaged 1.4.1 renderer defaults prepopulated updates to OGRAF when
    // projectFormat is absent. Include SPX explicitly for this opt-in template.
    await spxPost('/gc/playout', {
      prepopulated: 'true', projectFormat: 'SPX', command: 'update', fields: collect(control.row),
      datafile: document.getElementById('datafile').value,
      epoch: control.row.getAttribute('data-spx-epoch'), relpath: value('relpath'),
      playserver: '-', playchannel: value('playchannel'), playlayer: value('playlayer'),
      webplayout: value('webplayout'), dataformat: 'json'
    });
    control.error = '';
    control.row.setAttribute('data-spx-changed', 'false');
    control.row.querySelector('[data-spx-name="updatebutton"]')?.classList.add('disabled');
    draw(control);
  } catch (error) { control.error = error.message; draw(control); }
}

function attach(row) {
  if (controls.has(row)) return;
  const templatePath = row.querySelector('[name="RundownItem[relpath]"]')?.value || '';
  if (!templatePath.endsWith('/YCS-Ticker-Link-Test.html')) return;
  const input = row.querySelector('[data-update="f5"]');
  const field = [...row.querySelectorAll('input[name$="[field]"]')].find(element => element.value === 'f13');
  const metadata = field && row.querySelector(`[name="${field.name.replace(/\[field\]$/, '[value]')}"]`);
  if (!input || !metadata || !document.getElementById('datafile')) return;
  let state;
  try { state = parseLinkState(metadata.value); } catch { return; }
  metadata.setAttribute('data-update', 'f13');
  metadata.setAttribute('data-role', 'userEditable');
  // SPX 1.4.1 renders hidden-field debugging captions; keep pilot metadata hidden.
  let previous = metadata.previousElementSibling;
  if (previous?.tagName === 'BR') previous = previous.previousElementSibling;
  if (previous?.classList.contains('caption')) previous.hidden = true;

  const line = document.createElement('div');
  line.className = 'ycs-link-line';
  input.before(line);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ycs-link-button';
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/></svg>';
  line.append(button, input);
  const hint = document.createElement('div');
  hint.className = 'ycs-link-hint';
  hint.setAttribute('role', 'status');
  line.after(hint);

  const previewLabel = document.createElement('div');
  previewLabel.className = 'ycs-link-hint';
  previewLabel.textContent = 'PREVIEW · Current round link test';
  const pane = document.createElement('div');
  pane.className = 'ycs-link-preview';
  const frame = document.createElement('iframe');
  frame.title = 'Current round graphic preview';
  frame.src = '/renderer?preview=true';
  pane.append(frame);
  hint.after(previewLabel, pane);
  const resize = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    const scale = width / 1920;
    pane.style.height = `${150 * scale}px`;
    frame.style.transform = `scale(${scale}) translateY(-930px)`;
  });
  resize.observe(pane);

  const control = { row, input, metadata, state, button, hint, resize, saving: Promise.resolve(), error: '' };
  controls.set(row, control);
  button.addEventListener('click', async event => {
    event.stopPropagation();
    if (button.disabled) return;
    button.disabled = true;
    clearTimeout(control.debounce);
    try {
      control.error = '';
      if (control.state.mode === 'manual') {
        const fresh = await sourceRequest('/snapshot');
        const value = readLinkedValue(fresh);
        snapshot = fresh;
        sourceError = '';
        control.state.manual = input.value;
        control.state.mode = 'linked';
        input.value = value;
      } else {
        control.state.mode = 'manual';
        input.value = control.state.manual;
      }
      draw(control);
      markPending(row);
      await persist(control);
      await preview(control);
    } catch (error) { control.error = error.message; draw(control); }
    finally { button.disabled = false; }
  });
  button.addEventListener('dblclick', event => event.stopPropagation());
  input.addEventListener('input', () => {
    if (control.state.mode !== 'manual') return;
    control.state.manual = input.value;
    control.error = '';
    draw(control);
    markPending(row);
    clearTimeout(control.debounce);
    control.debounce = setTimeout(() => persist(control).then(() => preview(control)).catch(() => {}), 400);
  });
  frame.addEventListener('load', () => { control.previewStarted = false; preview(control).catch(error => { control.error = error.message; draw(control); }); });
  draw(control);
}

function scan() {
  document.querySelectorAll('.itemrow').forEach(attach);
  for (const [row, control] of controls) {
    if (!row.isConnected) { control.resize.disconnect(); clearTimeout(control.debounce); controls.delete(row); }
  }
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    snapshot = await sourceRequest('/snapshot');
    const value = readLinkedValue(snapshot);
    sourceError = '';
    for (const control of controls.values()) {
      if (control.state.mode === 'linked' && !control.button.disabled && control.input.value !== value) {
        control.input.value = value;
        // Source refreshes do not commit pending link/manual changes to program.
        await preview(control);
      }
      draw(control);
    }
  } catch (error) {
    sourceError = error.message;
    controls.forEach(draw);
  } finally { polling = false; }
}

function openManager() {
  if (document.querySelector('.ycs-link-manager')) return;
  const panel = document.createElement('section');
  panel.className = 'ycs-link-manager';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Data Manager test');
  panel.innerHTML = '<h2>Data Manager · Test</h2><p>Current round is mapped to <strong>Local test source</strong>.<br>Change the source here, then use the chain beside Current round in the rundown.</p><label>Source round text<input aria-label="Source round text" maxlength="300"></label><button type="button" data-action="publish">Publish test value</button><button type="button" data-action="close">Close</button><p role="status"></p><p>Sheets and API connectors are the next step. This pilot uses local test data only.</p>';
  document.body.append(panel);
  const editor = panel.querySelector('input');
  editor.value = snapshot?.values?.[LINK_SOURCE] || 'SWISS ROUND 12 OF 15';
  const status = panel.querySelector('[role="status"]');
  status.textContent = sourceError || 'Connected · Source data is saved locally';
  panel.querySelector('[data-action="close"]').onclick = () => panel.remove();
  panel.querySelector('[data-action="publish"]').onclick = async event => {
    event.target.disabled = true;
    try {
      snapshot = await sourceRequest('/test-value', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-YCS-Link': '1' }, body: JSON.stringify({ value: editor.value }) });
      status.textContent = 'Published · Linked graphics receive this value within two seconds';
      await poll();
    } catch (error) { status.textContent = error.message; }
    finally { event.target.disabled = false; }
  };
  editor.focus();
}

const pluginArea = document.getElementById('controllerPluginButtons');
if (pluginArea) {
  const nativeUpdate = window.updateItem;
  if (typeof nativeUpdate === 'function') {
    window.updateItem = function (row) {
      const selected = row || document.querySelector('.itemrow.inFocus');
      const control = controls.get(selected);
      return control ? updatePilot(control) : nativeUpdate.apply(this, arguments);
    };
  }
  const managerButton = document.createElement('button');
  managerButton.type = 'button';
  managerButton.className = 'btn wide bg_grey15';
  managerButton.textContent = 'DATA MANAGER · LINK TEST';
  managerButton.addEventListener('click', openManager);
  pluginArea.append(managerButton);
  scan();
  // Observe additions/removals only. Text and status updates do not trigger rescans.
  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches?.('.itemrow') || node.querySelector?.('.itemrow'))))) scan();
  });
  observer.observe(document.getElementById('itemList') || document.body, { childList: true, subtree: true });
  poll();
  const timer = setInterval(poll, 2000);
  window.addEventListener('pagehide', () => { observer.disconnect(); clearInterval(timer); controls.forEach(control => control.resize.disconnect()); }, { once: true });
}
