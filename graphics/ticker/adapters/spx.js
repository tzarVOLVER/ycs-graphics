// Bridge for the classic SPX HTML lifecycle. No SPX runtime dependency in core.
// Validate the installed SPX version and its renderer before production use.
(function () {
  'use strict';
  var queue = Promise.resolve();
  function tickerReady() {
    if (window.Ticker) return window.Ticker.ready.then(function () { return window.Ticker; });
    return new Promise(function (resolve, reject) {
      window.addEventListener('ycs-ticker-ready', function () { resolve(window.Ticker); }, { once: true });
      window.addEventListener('ycs-ticker-error', function (event) { reject(new Error(event.detail)); }, { once: true });
    });
  }
  function fields(input) {
    var payload = typeof input === 'string' ? JSON.parse(input) : input;
    if (!payload) return {};
    if (Array.isArray(payload.data)) {
      return Object.fromEntries(payload.data.map(function (field) { return [field.id, field.value]; }));
    }
    return payload;
  }
  function enqueue(task) {
    var result = queue.then(tickerReady).then(task);
    queue = result.catch(function (error) { console.error('[YCS SPX]', error); });
    return result;
  }
  window.update = function (input) {
    return enqueue(async function (ticker) {
      var value = fields(input);
      var patch = typeof value.f1 === 'string' ? JSON.parse(value.f1 || '{}') : value.f1 || {};
      if (value.f0 && value.f0 !== ticker.getState().instanceId) await ticker.selectInstance(value.f0);
      await ticker.update(patch);
    });
  };
  window.play = window.runAnimationIN = function () { return enqueue(function (ticker) { return ticker.show(); }); };
  window.stop = window.runAnimationOUT = function () { return enqueue(function (ticker) { return ticker.hide(); }); };
})();
