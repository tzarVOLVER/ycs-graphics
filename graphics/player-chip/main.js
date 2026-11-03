import { defaults, applyFields, chipWidth, formatLogo } from './data.js';
import { fitHorizontal } from '../shared/fit.js';
import { createMotion } from './motion.js';

export function createPlayerChip(root) {
  let state = defaults(), disposed = false, frame = null;
  const doc = root.ownerDocument, view = doc.defaultView, motion = createMotion(root);
  const name = root.querySelector('.name'), record = root.querySelector('.record');
  function fit() {
    if (disposed) return;
    const width = chipWidth(Math.max(name.offsetWidth, name.scrollWidth));
    root.style.width = width + 'px';
    root.querySelector('.name-mask').style.width = width - 125 + 'px';
    root.querySelector('.record-mask').style.width = width - 125 + 'px';
    fitHorizontal(name, width - 125);
    fitHorizontal(record, width - 125);
  }
  function schedule() {
    if (disposed || frame !== null) return;
    frame = view.requestAnimationFrame(() => { frame = null; fit(); });
  }
  const resize = new view.ResizeObserver(schedule);
  for (const element of [name, record]) resize.observe(element);
  const images = ['flag', 'logo', 'decktype'].map(key => [key, root.querySelector(`[data-image="${key}"]`)]);
  for (const [, image] of images) image.addEventListener('error', () => { image.hidden = true; });
  function render() {
    name.textContent = state.name; record.textContent = state.record;
    root.dataset.format = state.format;
    for (const [key, image] of images) {
      const value = key === 'logo' ? formatLogo(state.format) : state[key];
      if (image.getAttribute('src') === value) continue;
      image.hidden = !value;
      if (value) image.setAttribute('src', value); else image.removeAttribute('src');
    }
    fit(); schedule();
  }
  const api = {
    update(input) { if (disposed) return; state = applyFields(state, input); render(); },
    play() { if (!disposed) { motion.play(); schedule(); } },
    stop() { return motion.stop(); },
    getState() { return structuredClone(state); },
    dispose() {
      disposed = true; motion.dispose(); resize.disconnect();
      if (frame !== null) view.cancelAnimationFrame(frame);
      doc.fonts?.removeEventListener('loadingdone', schedule); view.removeEventListener('resize', schedule); view.removeEventListener('pagehide', api.dispose);
    }
  };
  doc.fonts?.addEventListener('loadingdone', schedule); doc.fonts?.ready.then(schedule);
  view.addEventListener('resize', schedule); view.addEventListener('pagehide', api.dispose, { once: true });
  render(); return api;
}
