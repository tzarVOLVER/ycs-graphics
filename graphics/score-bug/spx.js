// Classic SPX entry points are ready while the shared renderer module loads.
(function () {
  'use strict';
  var ready = import('./main.js').then(function (module) {
    return module.createScoreBug(document.getElementById('score-bug'));
  });
  var queue = Promise.resolve();
  function enqueue(action, input) {
    var result = queue
      .then(function () {
        return ready;
      })
      .then(function (graphic) {
        return graphic[action](input);
      });
    queue = result.catch(function (error) {
      console.error('[YCS Score Bug]', error);
    });
    return result;
  }
  window.update = function (input) {
    return enqueue('update', input);
  };
  window.play = window.runAnimationIN = function () {
    return enqueue('play');
  };
  window.stop = window.runAnimationOUT = function () {
    return enqueue('stop');
  };
})();
