import { defaults, applyFields, winnerLabel } from './data.js';
import { fitHorizontal } from '../shared/fit.js';

export function createWinner(root) {
  let state = defaults(), phase = 'hidden', revision = 0, pending = [], frame = null, disposed = false;
  const doc = root.ownerDocument, view = doc.defaultView;
  const name = root.querySelector('.name'), result = root.querySelector('.result');
  const fit = () => { if (!disposed) for (const label of [name, result]) fitHorizontal(label, label.parentElement.clientWidth); };
  const schedule = () => { if (!disposed && frame === null) frame = view.requestAnimationFrame(() => { frame = null; fit(); }); };
  const observer = new view.ResizeObserver(schedule);
  observer.observe(root);
  doc.fonts?.addEventListener('loadingdone', schedule);
  doc.fonts?.ready.then(schedule);
  const cancel = () => { for (const animation of pending) animation.cancel(); pending = []; };
  const tracks = [
    ['.plate', { clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)' }, 0, 450],
    ['.name-mask', { clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)' }, 85, 365],
    ['.label-mask', { clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)' }, 140, 310],
    ['.name-box', { translate: '0 58px' }, { translate: '0 0px' }, 85, 365],
    ['.label-box', { translate: '0 -36px' }, { translate: '0 0px' }, 140, 310]
  ];
  function render() { name.textContent = state.name; result.textContent = winnerLabel(state); fit(); schedule(); }
  const api = {
    update(input) { if (disposed) return; state = applyFields(state, input); render(); },
    play() {
      if (disposed || phase === 'shown') return;
      ++revision; cancel(); phase = 'shown'; root.classList.add('visible');
      const reduced = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
      pending = tracks.map(([selector, from, to, delay, duration]) => root.querySelector(selector).animate([from, to], {
        duration: reduced ? 1 : duration, delay: reduced ? 0 : delay, easing: 'cubic-bezier(.07,.24,0,1)', fill: 'both'
      }));
      schedule();
    },
    async stop() {
      if (disposed || phase === 'hidden') return;
      const token = ++revision;
      phase = 'exiting';
      const reduced = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Reverse the actual entrance progress, including Stop during the reveal.
      for (const animation of pending) {
        const timing = animation.effect.getTiming();
        const progress = Math.max(0.001, Math.min(animation.currentTime ?? 0, timing.delay + timing.duration));
        animation.currentTime = progress;
        animation.reverse();
        animation.playbackRate = -Math.max(1, progress / (reduced ? 1 : 200));
      }
      await Promise.allSettled(pending.map(animation => animation.finished));
      if (token !== revision || disposed) return;
      root.classList.remove('visible'); cancel(); phase = 'hidden';
    },
    getState() { return structuredClone(state); },
    dispose() {
      disposed = true; ++revision; cancel();
      if (frame !== null) view.cancelAnimationFrame(frame);
      observer.disconnect(); doc.fonts?.removeEventListener('loadingdone', schedule);
      view.removeEventListener('resize', schedule); view.removeEventListener('pagehide', api.dispose);
      root.classList.remove('visible');
    }
  };
  view.addEventListener('resize', schedule);
  view.addEventListener('pagehide', api.dispose, { once: true });
  render();
  return api;
}
