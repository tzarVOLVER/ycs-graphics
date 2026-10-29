// Figma 1:20: a 2 s timeline, with the entrance complete at 22.426%.
// SPX holds the final frame instead of looping. Stop reverses only the entrance.
const entranceFraction = 0.22426;

export function createMotion(root) {
  let phase = 'hidden',
    revision = 0;
  const animations = () => root.getAnimations({ subtree: true });
  const hide = () => {
    root.classList.remove('visible');
    phase = 'hidden';
  };
  return {
    play() {
      if (phase === 'shown') return;
      ++revision;
      if (phase === 'exiting') {
        for (const animation of animations()) {
          animation.playbackRate = 1;
          animation.play();
        }
      } else root.classList.add('visible');
      phase = 'shown';
    },
    stop() {
      if (phase !== 'shown') return;
      phase = 'exiting';
      const currentRevision = ++revision;
      const pending = animations();
      if (!pending.length) {
        hide();
        return;
      }
      for (const animation of pending) {
        const duration = animation.effect.getTiming().duration;
        // Skip Figma's trailing hold, including a stop during the entrance.
        // Reversing exactly at zero auto-rewinds a Web Animation to its end.
        animation.currentTime = Math.max(
          0.001,
          Math.min(animation.currentTime ?? 0, duration * entranceFraction)
        );
        animation.reverse();
        // Keep the exit inside the controller's existing 250 ms slot retirement.
        animation.playbackRate = -2;
      }
      Promise.allSettled(pending.map((animation) => animation.finished)).then(() => {
        if (revision === currentRevision) hide();
      });
    },
    dispose() {
      ++revision;
      for (const animation of animations()) animation.cancel();
      hide();
    }
  };
}
