import { fitHorizontal } from '../shared/fit.js';
import { gpuCompositing } from '../shared/gpu.js';
import { applyFields, deckFraming, decktypeURL, defaults, recordLine, roundLine } from './data.js';
import { createMotion } from './motion.js';

// A curly apostrophe: the Owners Narrow file has no straight one.
const PHRASE = 'IT’S TIME TO DUEL!';
const FRAMING_FILE = new URL('./decktype-framing.json', import.meta.url).href;

export function createHeadToHead(root) {
  let state = defaults(), disposed = false, frame = null, framingLibrary = {};
  const doc = root.ownerDocument, view = doc.defaultView, motion = createMotion(root, { gpu: gpuCompositing(doc) });
  const texts = [...root.querySelectorAll('[data-field]')];
  const fitted = [...root.querySelectorAll('[data-fit]')];
  const images = [...root.querySelectorAll('[data-image]')];
  const tracks = [...root.querySelectorAll('.scroll-track')];

  // Enough copies of the phrase to cover the frame plus one more, so the loop never shows a gap.
  function fillTracks() {
    for (const track of tracks) {
      if (!track.firstElementChild) {
        // data-text feeds the glow outlines drawn behind the phrase (see head-to-head.css).
        const span = doc.createElement('span'); span.textContent = PHRASE; span.dataset.text = PHRASE; track.append(span);
      }
      const width = track.firstElementChild.offsetWidth;
      const wanted = width > 0 ? Math.ceil(1920 / width) + 1 : 1;
      while (track.children.length < wanted) track.append(track.firstElementChild.cloneNode(true));
      while (track.children.length > wanted) track.lastElementChild.remove();
    }
  }
  const fit = () => {
    if (disposed) return;
    for (const label of fitted) fitHorizontal(label, label.parentElement.clientWidth - (label.classList.contains('round') ? 40 : 0));
  };
  const schedule = () => {
    if (!disposed && frame === null) frame = view.requestAnimationFrame(() => { frame = null; fit(); });
  };
  const fontsChanged = () => { fillTracks(); motion.restartLoops(); schedule(); };
  const resize = new view.ResizeObserver(schedule);
  for (const label of fitted) resize.observe(label);
  doc.fonts?.addEventListener('loadingdone', fontsChanged);
  doc.fonts?.ready.then(fontsChanged);
  // A missing flag or decktype hides instead of showing a broken-image icon.
  for (const image of images) {
    image.addEventListener('error', () => { image.hidden = true; });
    image.addEventListener('load', () => { image.hidden = !image.getAttribute('src'); });
  }
  // A slow font, image or framing file must not hold Play longer than about one second.
  function bounded(promise, milliseconds = 1000) {
    let timer;
    const limit = new Promise((resolve) => { timer = view.setTimeout(resolve, milliseconds); });
    return Promise.race([promise, limit]).finally(() => view.clearTimeout(timer));
  }
  // Read fresh each time, so a framing saved between plays is used on the next one.
  async function loadFraming() {
    try {
      const response = await view.fetch(FRAMING_FILE, { cache: 'no-store' });
      if (response.ok) framingLibrary = await response.json();
    } catch { /* keep the last framing that loaded */ }
  }
  const imageValue = (key) => {
    if (key === 'leftDeck') return decktypeURL(state.leftDecktype);
    if (key === 'rightDeck') return decktypeURL(state.rightDecktype);
    return state[key];
  };
  function applyFraming() {
    for (const [side, name, override] of [['.blue', state.leftDecktype, state.leftFraming], ['.red', state.rightDecktype, state.rightFraming]]) {
      const framing = deckFraming(framingLibrary, name, override);
      const deck = root.querySelector(side + ' .deck');
      deck.style.setProperty('--deck-zoom', String(framing.zoom));
      deck.style.setProperty('--deck-x', framing.x);
      deck.style.setProperty('--deck-y', framing.y);
    }
  }
  function render() {
    for (const label of texts) {
      const key = label.dataset.field;
      label.textContent = key === 'roundLine' ? roundLine(state) : key.endsWith('Record') ? recordLine(state[key]) : state[key];
    }
    for (const image of images) {
      const value = imageValue(image.dataset.image);
      if (image.getAttribute('src') === value && !(image.complete && image.naturalWidth === 0)) {
        if (image.complete) image.hidden = !value;
        continue;
      }
      // Hidden until it loads, so a slow image never shows the previous player's.
      image.hidden = true;
      if (value) image.setAttribute('src', value);
      else image.removeAttribute('src');
    }
    applyFraming();
    fit();
    schedule();
  }
  const api = {
    update(input) {
      if (disposed) return;
      state = applyFields(state, input);
      render();
      // SPX awaits this before showing the frame and calling Play.
      // The background is decoded here too, so the band doesn't stall the first time it opens onto it.
      const pictures = [...images.filter((image) => image.getAttribute('src')), root.querySelector('.background')]
        .map((image) => image.decode().catch(() => {}));
      return bounded(Promise.all([doc.fonts?.ready, loadFraming().then(applyFraming), ...pictures])).then(() => { fillTracks(); fit(); });
    },
    play() { if (!disposed) { fillTracks(); motion.play(); schedule(); } },
    stop() { return motion.stop(); },
    getState() { return structuredClone(state); },
    dispose() {
      disposed = true; motion.dispose(); resize.disconnect();
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
