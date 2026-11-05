import { fitHorizontal } from '../shared/fit.js';
import { defaults, applyFields, LAYOUTS } from './data.js';

export function createLowerThird(root) {
  let state = defaults(),
    disposed = false,
    frame = null;
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const plates = [...root.querySelectorAll('.nameplate')];
  const labels = plates.flatMap((plate) => [...plate.querySelectorAll('.fit-text')]);
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
    const positions = LAYOUTS[state.layout];
    plates.forEach((plate, index) => {
      const data = state.plates[index];
      plate.style.left = `${positions[index] ?? 0}px`;
      plate.hidden = index >= state.layout || !data.enabled;
      plate.querySelector('.name').textContent = data.name;
      plate.querySelector('.title').textContent = data.title;
    });
    fit();
    scheduleFit();
  }
  const api = {
    update(input) {
      // Validate the complete patch before touching the visible graphic.
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
      return structuredClone(state);
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
