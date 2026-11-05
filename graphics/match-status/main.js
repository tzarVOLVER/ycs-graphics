import { fitHorizontal } from '../shared/fit.js';
import { defaults, applyFields, roundText } from './data.js';
import { createMotion } from './motion.js';

export function createMatchStatus(root) {
  let state = defaults(root.dataset.variant),
    disposed = false,
    frame = null;
  const doc = root.ownerDocument,
    view = doc.defaultView;
  const motion = createMotion(root);
  const labels = [...root.querySelectorAll('[data-fit]')];
  const images = [...root.querySelectorAll('[data-image]')];
  const round = root.querySelector('.remaining-box');
  const fit = () => {
    if (disposed) return;
    for (const label of labels) fitHorizontal(label, label.parentElement.clientWidth);
  };
  const scheduleFit = () => {
    if (!disposed && frame === null)
      frame = view.requestAnimationFrame(() => {
        frame = null;
        fit();
      });
  };
  const resize = new view.ResizeObserver(scheduleFit);
  for (const label of labels) resize.observe(label.parentElement);
  const mutation = new view.MutationObserver(scheduleFit);
  mutation.observe(root, { subtree: true, childList: true, characterData: true });
  doc.fonts?.addEventListener('loadingdone', scheduleFit);
  doc.fonts?.ready.then(scheduleFit);
  view.addEventListener('resize', scheduleFit);
  // A slow or failed font must not hold Play longer than about one second.
  function bounded(promise, milliseconds = 1000) {
    let timer;
    const limit = new Promise((resolve) => {
      timer = view.setTimeout(resolve, milliseconds);
    });
    return Promise.race([promise, limit]).finally(() => view.clearTimeout(timer));
  }

  function render() {
    for (const label of labels)
      if (label.dataset.field)
        label.textContent = label.dataset.field === 'currentRound' ? roundText(state) : state[label.dataset.field];
    for (const image of images) {
      const value = state[image.dataset.image];
      image.hidden = !value;
      // Reassigning an unchanged src reloads and re-rasterizes the flag on every
      // update. A failed image is still retried, as before.
      if (image.getAttribute('src') === value && !(image.complete && image.naturalWidth === 0)) continue;
      if (value) image.setAttribute('src', value);
      else image.removeAttribute('src');
    }
    root.classList.toggle('has-remaining', state.showRoundsRemaining);
    round.hidden = !state.showRoundsRemaining;
    fit();
    scheduleFit();
  }
  const api = {
    update(input) {
      state = applyFields(state, input);
      render();
      // SPX awaits update before showing the frame and calling Play. Let the fonts
      // this layout requested finish loading first, so names are not blank on air.
      return bounded(doc.fonts?.ready).then(fit);
    },
    play() {
      motion.play();
      scheduleFit();
    },
    stop() {
      motion.stop();
    },
    getState() {
      return { ...state };
    },
    dispose() {
      motion.dispose();
      disposed = true;
      if (frame !== null) view.cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      doc.fonts?.removeEventListener('loadingdone', scheduleFit);
      view.removeEventListener('resize', scheduleFit);
      view.removeEventListener('pagehide', api.dispose);
    }
  };
  render();
  view.addEventListener('pagehide', api.dispose, { once: true });
  return api;
}
