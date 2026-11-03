(function () {
  const ready = import('./main.js').then(module => module.createPlayerChip(document.getElementById('player-chip')));
  let queue = Promise.resolve();
  function enqueue(action, input) {
    const result = queue.then(() => ready).then(graphic => graphic[action](input));
    queue = result.catch(error => console.error('[YCS Player Chip]', error));
    return result;
  }
  window.update = input => enqueue('update', input);
  window.play = window.runAnimationIN = () => enqueue('play');
  window.stop = window.runAnimationOUT = () => enqueue('stop');
})();
