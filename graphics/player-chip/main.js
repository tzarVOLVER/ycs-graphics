import { defaults, applyFields, chipWidth, formatLogo, decktypeURLs } from './data.js';
import { fitHorizontal } from '../shared/fit.js';
import { imageSources } from '../shared/image-sources.js';
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
  for (const [, image] of images) image.addEventListener('load', () => { image.hidden = !image.getAttribute('src'); });
  // The decktype tries each spelling of the name in turn (see shared/image-sources.js).
  const decktype = images.find(([key]) => key === 'decktype')[1], deckSources = imageSources(decktype);
  function render() {
    name.textContent = state.name; record.textContent = state.record;
    root.dataset.format = state.format;
    for (const [key, image] of images) {
      if (key === 'decktype') {
        const urls = decktypeURLs(state.decktype);
        if (deckSources.set(urls)) image.hidden = !urls.length;
        continue;
      }
      const value = key === 'logo' ? formatLogo(state.format) : state[key];
      if (image.getAttribute('src') === value) continue;
      image.hidden = !value;
      if (value) image.setAttribute('src', value); else image.removeAttribute('src');
    }
    fit(); schedule();
    // Decode while the output still hides this frame, so the first on-air frame
    // does not decode multi-megapixel artwork and stall the shared output page.
    // The decktype first waits for its other spellings to be tried.
    const decode = (image) => image.getAttribute('src') ? image.decode().catch(() => {}) : undefined;
    return Promise.all(images.map(([, image]) => image === decktype ? deckSources.ready().then((current) => current && decode(image)) : decode(image)));
  }
  // A slow remote flag must not hold Play longer than about one second.
  function bounded(promise, milliseconds = 1000) {
    let timer;
    const limit = new Promise(resolve => { timer = view.setTimeout(resolve, milliseconds); });
    return Promise.race([promise, limit]).finally(() => view.clearTimeout(timer));
  }
  const api = {
    update(input) { if (disposed) return; state = applyFields(state, input); return bounded(render()); },
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
