import { fitHorizontal } from '../shared/fit.js';
import { defaults, applyFields } from './data.js';

export function createMatchStatus(root) {
  let state = defaults(root.dataset.variant),
    disposed = false,
    frame = null;
  const doc = root.ownerDocument,
    view = doc.defaultView;
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

  function render() {
    for (const label of labels)
      if (label.dataset.field) label.textContent = state[label.dataset.field];
    for (const image of images) {
      const value = state[image.dataset.image];
      image.hidden = !value;
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
    },
    play() {
      root.classList.add('visible');
      scheduleFit();
    },
    stop() {
      root.classList.remove('visible');
    },
    getState() {
      return { ...state };
    },
    dispose() {
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
