// Bridge for the classic SPX HTML lifecycle. No SPX runtime dependency in core.
// Validate the installed SPX version and its renderer before production use.
(function () {
  'use strict';
  var queue = Promise.resolve();
  var mapping = import('../src/spx-data.js');
  function tickerReady() {
    if (window.Ticker) return window.Ticker.ready.then(function () { return window.Ticker; });
    return new Promise(function (resolve, reject) {
      window.addEventListener('ycs-ticker-ready', function () { resolve(window.Ticker); }, { once: true });
      window.addEventListener('ycs-ticker-error', function (event) { reject(new Error(event.detail)); }, { once: true });
    });
  }
  function enqueue(task) {
    var result = queue.then(tickerReady).then(task);
    queue = result.catch(function (error) { console.error('[YCS SPX]', error); });
    return result;
  }
  window.update = function (input) {
    window.YCS_SPX_CONTROLLED = true;
    return enqueue(async function (ticker) {
      var value = (await mapping).mapSpxUpdate(input);
      if (value.instanceId && value.instanceId !== ticker.getState().instanceId) await ticker.selectInstance(value.instanceId);
      await ticker.update(value.patch);
    });
  };
  window.play = window.runAnimationIN = function () { window.YCS_SPX_CONTROLLED = true; return enqueue(function (ticker) { return ticker.show(); }); };
  window.stop = window.runAnimationOUT = function () { window.YCS_SPX_CONTROLLED = true; return enqueue(function (ticker) { return ticker.hide(); }); };
})();
