import { fitHorizontal } from '../shared/fit.js';
import { defaults, applyFields, roundText } from '../match-status/data.js';
import { createMotion } from './motion.js';

// The linked round reads "ADVANCED ROUND 10 OF 15"; this design shows "ADVANCED ROUND 10".
// Custom text is the operator's own wording, so it's shown exactly as typed.
export const roundLine = (state) => (state.useCustomRound ? roundText(state) : roundText(state).replace(/(\bROUND\s+\d+)\s+OF\s+\d+\s*$/i, '$1'));

// Takes the same fields as Siding, checked by the same rules, so links copy across directly.
export function createScoreBug(root) {
  let state = defaults('siding'), disposed = false, frame = null;
  const doc = root.ownerDocument, view = doc.defaultView, motion = createMotion(root);
  const texts = [...root.querySelectorAll('[data-field]')];
  const fitted = [...root.querySelectorAll('[data-fit]')];
  const images = [...root.querySelectorAll('[data-image]')];
  const fit = () => { if (!disposed) for (const label of fitted) fitHorizontal(label, label.parentElement.clientWidth); };
  const schedule = () => {
    if (!disposed && frame === null) frame = view.requestAnimationFrame(() => { frame = null; fit(); });
  };
  const resize = new view.ResizeObserver(schedule);
  for (const label of fitted) resize.observe(label);
  doc.fonts?.addEventListener('loadingdone', schedule);
  doc.fonts?.ready.then(schedule);
  // A broken flag hides instead of showing a broken-image icon.
  for (const image of images) {
    image.addEventListener('error', () => { image.hidden = true; });
    image.addEventListener('load', () => { image.hidden = !image.getAttribute('src'); });
  }
  // A slow font or remote flag must not hold Play longer than about one second.
  function bounded(promise, milliseconds = 1000) {
    let timer;
    const limit = new Promise((resolve) => { timer = view.setTimeout(resolve, milliseconds); });
    return Promise.race([promise, limit]).finally(() => view.clearTimeout(timer));
  }
  function render() {
    for (const label of texts) {
      const key = label.dataset.field;
      label.textContent = key === 'currentRound' ? roundLine(state) : state[key];
    }
    for (const image of images) {
      const value = state[image.dataset.image];
      if (image.getAttribute('src') === value && !(image.complete && image.naturalWidth === 0)) {
        // Still loading: leave it hidden, because the browser is still painting the old flag.
        if (image.complete) image.hidden = !value;
        continue;
      }
      // Stays hidden until the load event, so a slow flag never shows the previous player's flag.
      image.hidden = true;
      if (value) image.setAttribute('src', value);
      else image.removeAttribute('src');
    }
    fit();
    schedule();
  }
  const api = {
    update(input) {
      if (disposed) return;
      state = applyFields(state, input);
      render();
      // SPX awaits this before showing the frame and calling Play. Decode flags and fit text
      // here, because animation frames may not run on a page that isn't being drawn.
      const flags = images.filter((image) => image.getAttribute('src')).map((image) => image.decode().catch(() => {}));
      return bounded(Promise.all([doc.fonts?.ready, ...flags])).then(fit);
    },
    play() { if (!disposed) { motion.play(); schedule(); } },
    stop() { return motion.stop(); },
    getState() { return { ...state }; },
    dispose() {
      disposed = true; motion.dispose(); resize.disconnect();
      if (frame !== null) view.cancelAnimationFrame(frame);
      doc.fonts?.removeEventListener('loadingdone', schedule);
      view.removeEventListener('pagehide', api.dispose);
    }
  };
  view.addEventListener('pagehide', api.dispose, { once: true });
  render();
  return api;
}
