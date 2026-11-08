// Timings are in milliseconds. Play builds the screen in about 1.55s and holds; Stop is one clean wipe
// that opens from the middle line outwards, about half a second.
const OUT = 'cubic-bezier(.16,1,.3,1)';
const IN_OUT = 'cubic-bezier(.65,0,.35,1)';
// A softer ease out for the outlines leaving, so the opening bars stay ahead of them.
const SOFT_OUT = 'cubic-bezier(.33,1,.68,1)';
export const SCROLL_SPEED = 64; // px per second, the same as the head-to-head
// SPX removes a graphic 2s after Stop whatever happens, so the out must be done well inside that.
export const STOP_LIMIT = 2000;
// How far each outline travels from beside the middle of the frame out to its edge.
const SCROLL_TRAVEL = 825;
// The bars start touching at the middle and finish just outside the frame.
const BAR_TRAVEL = 912;

// A horizontal gap through the middle, `gap` px tall, cut out of the whole frame.
const split = (gap) => {
  const top = 540 - gap / 2, bottom = 540 + gap / 2;
  return `polygon(evenodd, -10px -10px, 1930px -10px, 1930px 1090px, -10px 1090px, -10px ${top}px, 1930px ${top}px, 1930px ${bottom}px, -10px ${bottom}px)`;
};

// How far each outline slides out from behind the centre line to reveal itself (as in the CharacterWorks
// build); it starts wholly hidden past the middle, in the other half of the frame, with room to spare
// whichever scroll font is in use.
const REVEAL = 160;

// Both outlines keep scrolling the whole time. Each one: slides out from the centre line to reveal itself
// (0-0.75s), holds briefly, then eases out to its own side and dims (0.8-1.5s).
const scrollTrack = (side) => {
  const near = side * (SCROLL_TRAVEL + REVEAL), beside = side * SCROLL_TRAVEL;
  return [
    { translate: `${near}px 0`, opacity: 1, easing: OUT },
    { translate: `${beside}px 0`, opacity: 1, offset: 0.5 },
    { translate: `${beside}px 0`, opacity: 1, offset: 0.533, easing: SOFT_OUT },
    { translate: '0 0', opacity: 0.42 }
  ];
};

// [selector, keyframes, delay, duration, easing]
export const inTracks = [
  ['.scroll-blue', scrollTrack(1), 0, 1500, 'linear'],
  ['.scroll-red', scrollTrack(-1), 0, 1500, 'linear'],
  // A blue and a red bar draw down the middle, then split and open the band between them.
  ['.bar', [{ scale: '1 0' }, { scale: '1 1' }], 380, 260, OUT],
  ['.band', [{ clipPath: 'inset(0 960px 0 960px)' }, { clipPath: 'inset(0 0px 0 0px)' }], 600, 560, IN_OUT],
  ['.bar-blue', [{ translate: `${BAR_TRAVEL}px 0` }, { translate: '-48px 0' }], 600, 560, IN_OUT],
  ['.bar-red', [{ translate: `${-BAR_TRAVEL}px 0` }, { translate: '48px 0' }], 600, 560, IN_OUT],
  ['.game-motion', [{ translate: '0 -220px' }, { translate: '0 0' }], 900, 650, OUT]
];

export const outTracks = [
  ['.closer', [{ clipPath: split(0) }, { clipPath: split(1100) }], 0, 480, IN_OUT]
];

export const trackEnd = (tracks) => Math.max(...tracks.map(([, , delay, duration]) => delay + duration));
export const FRAME_BEAT_OPACITY = ['0.001', '0.0012'];

// Same structure as the head-to-head's motion: the corner-pixel beat runs only with GPU acceleration.
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
  // Each track runs along its own strip (turned on its side). Moving towards the end of the phrase is down
  // the frame for blue and up the frame for red.
  const startLoops = () => {
    for (const track of root.querySelectorAll('.scroll-track')) {
      // The exact (fractional) length of one copy, so the loop wraps without a half-pixel jump. The strip is
      // turned on its side, so its length is the height on screen.
      const width = track.firstElementChild?.getBoundingClientRect().height || 0;
      if (!width) continue;
      loops.push(track.animate(
        [{ transform: `translateX(${-width}px)` }, { transform: 'translateX(0px)' }],
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
