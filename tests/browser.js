const summary = document.getElementById('summary');
const results = document.getElementById('results');
const frames = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function record(name, okay, detail = '') {
  const li = document.createElement('li');
  li.className = okay ? 'pass' : 'fail';
  li.textContent = `${okay ? 'PASS' : 'FAIL'} — ${name}${detail ? ': ' + detail : ''}`;
  results.append(li);
  if (!okay) throw new Error(li.textContent);
}
async function frame(url) {
  const container = document.createElement('div');
  container.className = 'output';
  const el = document.createElement('iframe');
  el.title = url;
  container.append(el);
  document.getElementById('outputs').append(container);
  new ResizeObserver(() => {
    const scale = container.clientWidth / 1920;
    container.style.height = `${250 * scale}px`;
    el.style.transform = `scale(${scale}) translateY(-830px)`;
  }).observe(container);
  const loaded = new Promise(resolve => el.addEventListener('load', resolve, { once: true }));
  el.src = url;
  await loaded;
  frames.push(el);
  return el.contentWindow;
}
async function waitUntil(predicate, timeout = 10000) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeout) throw new Error('Timed out waiting for browser state');
    await wait(20);
  }
}

document.getElementById('run').addEventListener('click', async event => {
  event.target.disabled = true;
  summary.textContent = 'Running…';
  try {
    const outputs = await Promise.all([1, 2, 3].map(index => frame(`./ticker.html?instance=broadcast-${index}`)));
    await Promise.all(outputs.map(output => output.Ticker.ready));
    record('Three independent outputs load fonts and data', outputs.every(output => output.document.documentElement.dataset.ready === 'true'));
    const baseline = await frame('./prototype.html');
    await baseline.document.fonts.ready;
    baseline.Ticker.pause();
    await Promise.all(outputs.map(output => output.Ticker.pause()));
    const styleProperties = ['fontFamily', 'fontSize', 'fontWeight', 'color', 'height', 'width', 'left', 'right', 'bottom', 'top', 'lineHeight', 'gap', 'transitionDuration', 'transitionTimingFunction'];
    const differences = [];
    for (const id of ['ticker', 'bg', 'logo', 'left', 'date', 'location', 'center', 'topicbar', 'topic-inner', 'category', 'topic', 'crawl-viewport', 'right', 'status', 'round', 'remaining']) {
      const oldStyle = baseline.getComputedStyle(baseline.document.getElementById(id));
      const newStyle = outputs[0].getComputedStyle(outputs[0].document.getElementById(id));
      for (const prop of styleProperties) if (oldStyle[prop] !== newStyle[prop]) differences.push(`${id}.${prop}: ${oldStyle[prop]} -> ${newStyle[prop]}`);
    }
    record('Prototype layout, fonts, colors and animation timings match', differences.length === 0, differences.join('; '));
    await outputs[0].Ticker.updateStage({ status: 'STAGE ONE ONLY' });
    record('Stage update stays within its broadcast', outputs[0].document.getElementById('status').textContent === 'STAGE ONE ONLY' && outputs[1].document.getElementById('status').textContent === 'IN PROGRESS' && outputs[2].document.getElementById('status').textContent === 'IN PROGRESS');
    await Promise.all(outputs.map(output => output.Ticker.updateShared({ location: 'SHARED LOCATION' })));
    record('Shared data reaches all three outputs', outputs.every(output => output.document.getElementById('location').textContent === 'SHARED LOCATION'));
    const before = outputs[0].Ticker.getState().offset;
    await outputs[0].Ticker.update({ topicEntryDelayMs: 120, headerTransitionMs: 180, crawlSpeed: 900, tickerItems: [
      { category: 'TEST', topic: 'ALPHA', subtopic: 'Alpha broadcast message for testing continuous motion and a category transition at the right edge.' },
      { category: 'TEST', topic: 'BETA', subtopic: 'Beta broadcast message for testing a separate topic while the text keeps moving.' }
    ] });
    record('Timing and playlist updates preserve the current crawl position', outputs[0].Ticker.getState().offset === before);
    await outputs[0].Ticker.resume();

    const output = outputs[0];
    const track = output.document.getElementById('crawl-track');
    const viewport = output.document.getElementById('crawl-viewport');
    const inner = output.document.getElementById('topic-inner');
    const positions = new WeakMap();
    let lastCrossing = null, outSeen = false, swapped = false, motionFrames = 0, lastOut = false, lastCategory = output.document.getElementById('topic').textContent;
    const start = performance.now();
    while (!swapped && performance.now() - start < 25000) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const time = performance.now(), offset = output.Ticker.getState().offset;
      const rightEdge = viewport.clientWidth;
      for (const node of track.children) {
        const x = node.offsetLeft + offset, previous = positions.get(node);
        if (previous !== undefined && previous >= rightEdge && x < rightEdge) lastCrossing = { time, topic: node.entry.topic };
        if (inner.classList.contains('out') && previous !== undefined && x < previous) motionFrames++;
        positions.set(node, x);
      }
      const out = inner.classList.contains('out');
      if (out && !lastOut && lastCrossing && ['ALPHA', 'BETA'].includes(lastCrossing.topic)) {
        const delay = time - lastCrossing.time;
        record('Header starts out after the next subtopic enters from the right', delay >= 85 && delay < 230, `${Math.round(delay)} ms observed; 120 ms configured`);
        record('Crawler keeps full opacity during header animation', output.getComputedStyle(track).opacity === '1' && track.getAnimations().length === 0);
        outSeen = true;
      }
      const category = output.document.getElementById('topic').textContent;
      if (outSeen && !out && category !== lastCategory && ['ALPHA', 'BETA'].includes(category)) swapped = true;
      lastCategory = category;
      lastOut = out;
    }
    record('Header swaps its label and animates back in', swapped);
    record('Text continues moving during the header transition', motionFrames > 2, `${motionFrames} moving samples`);
    record('Other broadcasts keep independent playback state', outputs[1].Ticker.getState().paused && outputs[2].Ticker.getState().paused && !output.Ticker.getState().paused);
    await output.update(JSON.stringify({ data: [{ id: 'f0', value: 'broadcast-1' }, { id: 'f1', value: '{"status":"SPX UPDATE"}' }] }));
    await output.stop();
    record('SPX update and stop bridge works', output.document.getElementById('status').textContent === 'SPX UPDATE' && !output.Ticker.getState().visible);
    await output.play();
    record('SPX play bridge shows the ticker', output.Ticker.getState().visible);
    const priorData = output.Ticker.getData().status;
    let rejected = false;
    try { await output.Ticker.update({ status: 'BAD', crawlSpeed: -1 }); } catch { rejected = true; }
    record('Invalid data is rejected without corrupting output', rejected && output.Ticker.getData().status === priorData);
    await output.Ticker.update({ crawlSpeed: 2500, tickerItems: [] });
    await waitUntil(() => output.Ticker.getState().queuedItems === 0);
    record('An empty playlist drains without a frozen final label', output.document.getElementById('topic').textContent === '');
    await output.Ticker.update({ crawlSpeed: 145, tickerItems: [{ category: 'RECOVERED', topic: 'BACK ON AIR', subtopic: 'The ticker can resume after an empty playlist.' }] });
    await waitUntil(() => output.document.getElementById('topic').textContent === 'BACK ON AIR');
    record('A new playlist recovers after the queue is empty', output.Ticker.getState().queuedItems > 0 && !output.Ticker.getState().paused);
    summary.textContent = `All ${results.childElementCount} browser checks passed.`;
    summary.dataset.result = 'pass';
  } catch (error) {
    summary.textContent = error.message;
    summary.dataset.result = 'fail';
    console.error(error);
  }
});
