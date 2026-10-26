// Bridge for the classic SPX HTML lifecycle. No SPX runtime dependency in core.
// Validate the installed SPX version and its renderer before production use.
(function () {
  'use strict';
  var queue = Promise.resolve();
  var mapping = import('../src/spx-data.js');
  var linking;
  var link;
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
      // Only the pilot template declares f13. Normal templates never connect.
      var fields = typeof input === 'string' ? JSON.parse(input) : input;
      if (Array.isArray(fields?.data)) fields = Object.fromEntries(fields.data.map(function (field) { return [field.id, field.value]; }));
      else if (fields?.data && typeof fields.data === 'object') fields = fields.data;
      if (fields && Object.hasOwn(fields, 'f13')) {
        linking ||= import('../src/data-link.js');
        var api = await linking;
        if (!link) {
          link = new api.RoundDataLink({
            apply: function (round) { return enqueue(function (activeTicker) {
              if (link.state?.mode === 'linked' && link.lastValue === round) return activeTicker.update({ currentRound: round });
            }); },
            fetchSnapshot: async function () {
              var response = await fetch(api.LINK_ENDPOINT + '/snapshot', { cache: 'no-store', signal: AbortSignal.timeout(1500) });
              if (!response.ok) throw new Error('Data source unavailable');
              return response.json();
            }
          });
          window.addEventListener('pagehide', function () { link.dispose(); }, { once: true });
        }
        var round = await link.configure(fields.f13, value.patch.currentRound);
        if (round !== undefined) value.patch.currentRound = round;
      }
      await ticker.update(value.patch);
    });
  };
  window.play = window.runAnimationIN = function () { window.YCS_SPX_CONTROLLED = true; return enqueue(function (ticker) { return ticker.show(); }); };
  window.stop = window.runAnimationOUT = function () { window.YCS_SPX_CONTROLLED = true; return enqueue(function (ticker) { return ticker.hide(); }); };
})();
