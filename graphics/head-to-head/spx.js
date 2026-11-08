// Classic SPX entry points are ready while the shared renderer module loads.
(function () {
  'use strict';
  var ready = import('./main.js').then(function (module) {
    return module.createHeadToHead(document.getElementById('head-to-head'));
  });
  var queue = Promise.resolve();
  var lastPlay = Promise.resolve();
  function enqueue(action, input) {
    var result = queue
      .then(function () {
        return ready;
      })
      .then(function (graphic) {
        return graphic[action](input);
      });
    queue = result.catch(function (error) {
      console.error('[YCS Head to Head]', error);
    });
    return result;
  }
  window.update = function (input) {
    return enqueue('update', input);
  };
  window.play = window.runAnimationIN = function () {
    var result = enqueue('play');
    lastPlay = result.catch(function () {});
    return result;
  };
  // Stop doesn't wait behind a data update still loading images: SPX removes the graphic 2s after
  // Stop, and the out needs most of that time. It does wait for a Play that's still queued, so the
  // graphic can never appear after its Stop.
  window.stop = window.runAnimationOUT = function () {
    return Promise.all([ready, lastPlay]).then(function (values) {
      return values[0].stop();
    });
  };
})();
