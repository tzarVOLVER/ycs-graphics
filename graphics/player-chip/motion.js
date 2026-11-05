// Approved 500ms reveal, no position settle and no opacity animation.
const tracks = [
  ['.shell', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }, 0, 460],
  ['.deck', { translate: '24px 0' }, { translate: '0px 0' }, 70, 430],
  ['.rule', { scale: '0 1' }, { scale: '1 1' }, 65, 400],
  ['.flag-mask', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }, 100, 310],
  ['.logo-mask', { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' }, 160, 320],
  ['.name-mask', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }, 110, 350],
  ['.name-motion', { translate: '-22px 0' }, { translate: '0px 0' }, 110, 350],
  ['.record-mask', { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' }, 155, 325],
  ['.record-motion', { translate: '0 32px' }, { translate: '0 0px' }, 155, 325],
  ['.caption-mask', { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' }, 205, 295],
  ['.caption-motion', { translate: '0 16px' }, { translate: '0 0px' }, 205, 295]
];

export function createMotion(root) {
  let phase = 'hidden', generation = 0, animations = [];
  const cancel = () => { animations.forEach(a => a.cancel()); animations = []; };
  return {
    play() {
      if (phase === 'shown') return;
      ++generation; cancel(); phase = 'shown'; root.classList.add('visible');
      const reduced = root.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
      animations = tracks.map(([selector, from, to, delay, duration]) => root.querySelector(selector).animate([from, to], {
        duration: reduced ? 1 : duration, delay: reduced ? 0 : delay, easing: 'cubic-bezier(.07,.24,0,1)', fill: 'both'
      }));
    },
    async stop() {
      if (phase === 'hidden') return;
      const token = ++generation;
      phase = 'exiting';
      const reduced = root.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const animation of animations) {
        const timing = animation.effect.getTiming();
        const progress = Math.max(.001, Math.min(animation.currentTime ?? 0, timing.delay + timing.duration));
        animation.currentTime = progress;
        animation.reverse();
        animation.playbackRate = -Math.max(1, progress / (reduced ? 1 : 220));
      }
      await Promise.allSettled(animations.map(a => a.finished));
      if (generation !== token) return;
      root.classList.remove('visible'); cancel(); phase = 'hidden';
    },
    dispose() { ++generation; cancel(); root.classList.remove('visible'); phase = 'hidden'; }
  };
}
