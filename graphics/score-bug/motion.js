// The package's reveal: same easing, wipes and short slides, no opacity animation,
// finished by 500ms. Both bars open outward from the centre of the frame.
const wipeLeft = [{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)' }];
const wipeRight = [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }];
const wipeUp = [{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' }];
const barTracks = (bar, wipe, slide) => [
  [bar + ' .shell', wipe, 0, 460],
  [bar + ' .score-mask', wipeUp, 120, 330],
  [bar + ' .score-motion', [{ translate: '0 32px' }, { translate: '0 0px' }], 120, 330],
  [bar + ' .flag-mask', wipe, 100, 310],
  [bar + ' .name-mask', wipe, 110, 350],
  [bar + ' .name-motion', [{ translate: slide }, { translate: '0px 0' }], 110, 350]
];
export const tracks = [
  ...barTracks('.blue', wipeLeft, '22px 0'),
  ...barTracks('.red', wipeRight, '-22px 0'),
  // The round box rises into place above the bars.
  ['.round-box', [{ translate: '0 43px' }, { translate: '0 0px' }], 150, 350]
];

export function createMotion(root) {
  let phase = 'hidden', generation = 0, animations = [];
  const view = root.ownerDocument.defaultView;
  const reduced = () => view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cancel = () => { animations.forEach((animation) => animation.cancel()); animations = []; };
  return {
    play() {
      if (phase === 'shown') return;
      ++generation; cancel(); phase = 'shown'; root.classList.add('visible');
      const still = reduced();
      animations = tracks.map(([selector, frames, delay, duration]) => root.querySelector(selector).animate(frames, {
        duration: still ? 1 : duration, delay: still ? 0 : delay, easing: 'cubic-bezier(.07,.24,0,1)', fill: 'both'
      }));
    },
    // Reverses from wherever the reveal has reached, within the slot's 250ms exit.
    async stop() {
      if (phase === 'hidden') return;
      const token = ++generation;
      phase = 'exiting';
      const still = reduced();
      for (const animation of animations) {
        const timing = animation.effect.getTiming();
        const progress = Math.max(0.001, Math.min(animation.currentTime ?? 0, timing.delay + timing.duration));
        animation.currentTime = progress;
        animation.reverse();
        animation.playbackRate = -Math.max(1, progress / (still ? 1 : 220));
      }
      await Promise.allSettled(animations.map((animation) => animation.finished));
      if (generation !== token) return;
      root.classList.remove('visible'); cancel(); phase = 'hidden';
    },
    dispose() { ++generation; cancel(); root.classList.remove('visible'); phase = 'hidden'; }
  };
}
