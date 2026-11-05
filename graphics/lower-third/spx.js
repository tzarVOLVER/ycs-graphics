// Classic SPX lifecycle entry points are available before module loading ends.
(function () {
  'use strict';
  var ready = import('./main.js').then(function (module) {
    return module.createLowerThird(document.getElementById('lower-third'));
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
      console.error('[YCS Lower Third]', error);
    });
    return result;
  }
  // Data changes never call play or restart the entrance animation.
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
