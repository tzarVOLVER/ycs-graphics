import { fitHorizontal } from '../shared/fit.js';
import { gpuCompositing } from '../shared/gpu.js';
import { applyFields, defaults, gameLine } from './data.js';
import { createMotion } from './motion.js';

// A curly apostrophe: the Owners Narrow file has no straight one.
const PHRASE = 'IT’S TIME TO DUEL!';
// Each outline strip is 1080px long once turned on its side.
const STRIP = 1080;
// GAME 2 is about 980px wide; anything longer is squeezed to stay inside the frame's sides.
const MAX_TEXT_WIDTH = 1600;

export function createGameBump(root) {
  let state = defaults(), disposed = false, frame = null;
  const doc = root.ownerDocument, view = doc.defaultView;
  const motion = createMotion(root, { gpu: gpuCompositing(doc) });
  const label = root.querySelector('[data-field="game"]');
  const tracks = [...root.querySelectorAll('.scroll-track')];

  // Enough copies of the phrase to cover the strip plus one more, so the loop never shows a gap.
  function fillTracks() {
    for (const track of tracks) {
      if (!track.firstElementChild) {
        // data-text feeds the glow outlines drawn behind the phrase (see game-bump.css).
        const span = doc.createElement('span'); span.textContent = PHRASE; span.dataset.text = PHRASE; track.append(span);
      }
      const width = track.firstElementChild.offsetWidth;
      const wanted = width > 0 ? Math.ceil(STRIP / width) + 1 : 1;
      while (track.children.length < wanted) track.append(track.firstElementChild.cloneNode(true));
      while (track.children.length > wanted) track.lastElementChild.remove();
    }
  }
  const fit = () => { if (!disposed) fitHorizontal(label, MAX_TEXT_WIDTH); };
  const schedule = () => {
    if (!disposed && frame === null) frame = view.requestAnimationFrame(() => { frame = null; fit(); });
  };
  const render = () => { label.textContent = gameLine(state); fit(); schedule(); };
  const fontsChanged = () => { fillTracks(); motion.restartLoops(); schedule(); };
  doc.fonts?.addEventListener('loadingdone', fontsChanged);
  doc.fonts?.ready.then(fontsChanged);
  // A slow font or background must not hold Play longer than about one second.
  function bounded(promise, milliseconds = 1000) {
    let timer;
    const limit = new Promise((resolve) => { timer = view.setTimeout(resolve, milliseconds); });
    return Promise.race([promise, limit]).finally(() => view.clearTimeout(timer));
  }

  const api = {
    update(input) {
      if (disposed) return;
      state = applyFields(state, input);
      render();
      // SPX awaits this before showing the frame and calling Play. The background is decoded here too, so
      // the band doesn't stall the first time it opens onto it.
      const background = root.querySelector('.background').decode().catch(() => {});
      return bounded(Promise.all([doc.fonts?.ready, background])).then(() => { fillTracks(); fit(); });
    },
    play() { if (!disposed) { fillTracks(); motion.play(); schedule(); } },
    stop() { return motion.stop(); },
    getState() { return structuredClone(state); },
    dispose() {
      disposed = true; motion.dispose();
      if (frame !== null) view.cancelAnimationFrame(frame);
      doc.fonts?.removeEventListener('loadingdone', fontsChanged);
      view.removeEventListener('pagehide', api.dispose);
    }
  };
  view.addEventListener('pagehide', api.dispose, { once: true });
  fillTracks();
  render();
  return api;
}
