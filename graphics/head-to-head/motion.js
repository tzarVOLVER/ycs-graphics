// Timings are in milliseconds. Play builds the screen in about 1.6s; Stop swaps the players for the round,
// holds it, and closes the band, all inside SPX's 2s exit limit.
const OUT = 'cubic-bezier(.16,1,.3,1)';
const IN_OUT = 'cubic-bezier(.65,0,.35,1)';
const ACCEL = 'cubic-bezier(.55,0,.8,.2)';
export const SCROLL_SPEED = 64; // px per second, as measured in the CharacterWorks original
export const STOP_LIMIT = 2000;

// A wipe made of two opposite slides: the clipping box moves by `distance` and its contents move back,
// ending `drift` px from where they started. Only transforms change, so nothing is repainted per frame.
// `reveal` plays it from hidden to shown; otherwise from shown to hidden.
const wipe = (box, contents, distance, drift, delay, duration, easing, reveal = false) => {
  const boxFrames = [{ translate: '0 0' }, { translate: `${distance}px 0` }];
  const contentFrames = [{ translate: '0 0' }, { translate: `${drift - distance}px 0` }];
  if (reveal) { boxFrames.reverse(); contentFrames.reverse(); }
  return [[box, boxFrames, delay, duration, easing], [contents, contentFrames, delay, duration, easing]];
};
const band = (from, to) => [{ clipPath: `inset(${from}px 0 ${from}px 0)` }, { clipPath: `inset(${to}px 0 ${to}px 0)` }];
const lift = (from) => [{ translate: `0 ${from}px` }, { translate: '0 0' }];

// [selector, keyframes, delay, duration, easing]
export const inTracks = [
  // The two outlines open from the middle and start running.
  ['.scroll-blue .scroll-move', [{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' }], 0, 450, OUT],
  ['.scroll-red .scroll-move', [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], 0, 450, OUT],
  ['.scroll-blue', [{ translate: '0 271px', opacity: 1 }, { translate: '0 271px', opacity: 1, offset: 0.5, easing: IN_OUT }, { translate: '0 0', opacity: 0.42 }], 0, 1200, 'linear'],
  ['.scroll-red', [{ translate: '0 -255px', opacity: 1 }, { translate: '0 -255px', opacity: 1, offset: 0.5, easing: IN_OUT }, { translate: '0 0', opacity: 0.42 }], 0, 1200, 'linear'],
  // A blue and a red bar draw across the middle, then split and open the band between them.
  ['.bar', [{ scale: '0 1' }, { scale: '1 1' }], 380, 260, OUT],
  ['.band', band(540, 0), 600, 560, IN_OUT],
  ['.bar-blue', [{ translate: '0 524px' }, { translate: '0 -16px' }], 600, 560, IN_OUT],
  ['.bar-red', [{ translate: '0 -524px' }, { translate: '0 16px' }], 600, 560, IN_OUT],
  ['.rule-mid-blue, .rule-mid-red', [{ scale: '0 1' }, { scale: '1 1' }], 900, 650, OUT],
  // The players are left out of drawing entirely until their wipes start (cheaper with GPU off).
  ['.side', [{ visibility: 'hidden' }, { visibility: 'hidden', offset: 0.99 }, { visibility: 'visible' }], 0, 940, 'linear'],
  // Players come in from the middle of the frame.
  // Each window slides out from the centre while its art slides back, so the coloured edge leads the wipe.
  ...wipe('.blue .deck-window', '.blue .deck-inner', -642, 0, 950, 600, OUT, true),
  ...wipe('.red .deck-window', '.red .deck-inner', 642, 0, 990, 600, OUT, true),
  ['.vs', lift(46), 1000, 450, OUT],
  ['.blue .name-motion', lift(70), 1020, 500, OUT],
  ['.red .name-motion', lift(-70), 1060, 500, OUT],
  ['.underline', [{ scale: '0 1' }, { scale: '1 1' }], 1080, 560, OUT],
  ['.blue .info-motion', lift(-52), 1120, 480, OUT],
  ['.red .info-motion', lift(52), 1160, 480, OUT]
];

export const outTracks = [
  // Players leave towards the sides while the round rises into the middle.
  ...wipe('.blue .deck-window', '.blue .deck-inner', -642, 0, 0, 300, ACCEL),
  ...wipe('.red .deck-window', '.red .deck-inner', 642, 0, 0, 300, ACCEL),
  // Names and records wipe away towards the sides while drifting 60px outwards. The mask travels its own
  // width plus that drift, so its edge passes the last letter.
  ...wipe('.blue .name-mask', '.blue .name-motion', -670, -60, 20, 320, ACCEL),
  ...wipe('.blue .info-mask', '.blue .info-motion', -480, -60, 20, 320, ACCEL),
  ...wipe('.red .name-mask', '.red .name-motion', 670, 60, 20, 320, ACCEL),
  ...wipe('.red .info-mask', '.red .info-motion', 480, 60, 20, 320, ACCEL),
  ['.underline', [{ scale: '1 1' }, { scale: '0 1' }], 0, 300, ACCEL],
  ['.rule-mid-blue, .rule-mid-red', [{ scale: '1 1' }, { scale: '0 1' }], 40, 300, ACCEL],
  ['.vs', [{ translate: '0 0' }, { translate: '0 46px' }], 0, 240, ACCEL],
  // Once their wipes have finished, the players are left out of drawing entirely.
  ['.side, .vs-mask', [{ visibility: 'visible' }, { visibility: 'visible', offset: 0.99 }, { visibility: 'hidden' }], 0, 360, 'linear'],
  ['.round-motion', lift(100), 300, 480, OUT],
  // After the round has held, the band closes back to the middle and the bars shrink away.
  // The outlines fade as the bars start in, then leave drawing, so the closing band doesn't redraw their
  // glow every frame (that cost about 7 frames of the close with vMix's GPU acceleration off).
  ['.scroll', [{ opacity: 0.42 }, { opacity: 0 }], 1240, 160, ACCEL],
  ['.scroll', [{ visibility: 'visible' }, { visibility: 'visible', offset: 0.99 }, { visibility: 'hidden' }], 1240, 170, 'linear'],
  ['.closer', band(0, 540), 1240, 420, IN_OUT],
  ['.bar-blue', [{ translate: '0 -16px' }, { translate: '0 524px' }], 1240, 420, IN_OUT],
  ['.bar-red', [{ translate: '0 16px' }, { translate: '0 -524px' }], 1240, 420, IN_OUT],
  ['.bar', [{ scale: '1 1' }, { scale: '0 1' }], 1600, 180, ACCEL]
];

export const trackEnd = (tracks) => Math.max(...tracks.map(([, , delay, duration]) => delay + duration));
// Both round to zero in an 8-bit frame (below 1/510), so these never reach the picture.
export const FRAME_BEAT_OPACITY = ['0.001', '0.0012'];

// Measured in vMix's browser (Chromium 115) at 60fps. With GPU acceleration on, the start of the close
// froze for about 270ms after the scroll had been the only thing moving. Changing two opposite corners
// every frame (the ticker's fix) makes the changed area the whole frame and cleared it. With GPU off, as
// the stages run, there's no freeze and the beat cost about 7% of a core, so it runs only when
// options.gpu is true (see shared/gpu.js).
export function createMotion(root, options = {}) {
  let phase = 'hidden', generation = 0, animations = [], loops = [], beatFrame = null, beatState = 0;
  const view = root.ownerDocument.defaultView;
  const beats = options.gpu ? [...root.ownerDocument.querySelectorAll('.frame-beat')] : [];
  const beat = () => {
    beatState = 1 - beatState;
    for (const element of beats) element.style.opacity = FRAME_BEAT_OPACITY[beatState];
    beatFrame = view.requestAnimationFrame(beat);
  };
  const startBeat = () => { if (beatFrame === null && beats.length) beatFrame = view.requestAnimationFrame(beat); };
  const stopBeat = () => { if (beatFrame !== null) view.cancelAnimationFrame(beatFrame); beatFrame = null; };
  const run = (tracks) => tracks.flatMap(([selector, keyframes, delay, duration, easing]) =>
    [...root.querySelectorAll(selector)].map((element) => element.animate(keyframes, { delay, duration, easing, fill: 'both' })));
  const cancel = () => {
    for (const animation of [...animations, ...loops]) animation.cancel();
    animations = []; loops = [];
  };
  // Each track holds enough copies of the phrase to cover the frame, so one copy's width loops seamlessly.
  const startLoops = () => {
    for (const track of root.querySelectorAll('.scroll-track')) {
      // The exact (fractional) width, so the loop wraps without a half-pixel jump.
      const width = track.firstElementChild?.getBoundingClientRect().width || 0;
      if (!width) continue;
      const left = track.dataset.direction === 'left';
      loops.push(track.animate(
        [{ transform: `translateX(${left ? 0 : -width}px)` }, { transform: `translateX(${left ? -width : 0}px)` }],
        { duration: (width / SCROLL_SPEED) * 1000, iterations: Infinity, easing: 'linear' }
      ));
    }
  };
  return {
    get phase() { return phase; },
    play() {
      if (phase === 'shown') return;
      ++generation; cancel();
      phase = 'shown'; root.classList.add('visible');
      animations = run(inTracks);
      startLoops();
      startBeat();
    },
    async stop() {
      if (phase !== 'shown') return;
      const token = ++generation;
      phase = 'exiting';
      // A Stop during the build jumps the build to its end first, so the out starts from a whole screen.
      for (const animation of animations) animation.finish();
      const out = run(outTracks);
      animations.push(...out);
      await Promise.allSettled(out.map((animation) => animation.finished));
      if (generation !== token) return;
      root.classList.remove('visible'); cancel(); stopBeat(); phase = 'hidden';
    },
    restartLoops() { if (phase !== 'hidden') { for (const loop of loops) loop.cancel(); loops = []; startLoops(); } },
    dispose() { ++generation; cancel(); stopBeat(); root.classList.remove('visible'); phase = 'hidden'; }
  };
}
