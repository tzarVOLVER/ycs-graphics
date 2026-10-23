const container = document.getElementById('outputs');
const notice = document.getElementById('notice');
const frames = [];
function send(frame, action, data) {
  frame.contentWindow.postMessage({ type: 'YCS_TICKER', action, data }, location.origin);
}
for (let index = 1; index <= 3; index++) {
  const id = `broadcast-${index}`;
  const section = document.createElement('section');
  section.innerHTML = `<header><strong>${id} / stage-${index}</strong>
    <a target="_blank" href="./ticker.html?instance=${id}">Open output</a>
    <button data-action="show">Show</button><button data-action="hide">Hide</button>
    <button data-action="pause">Pause</button><button data-action="resume">Resume</button>
    <label>Topic delay <input class="delay" type="number" min="0" value="180"> ms</label>
    <label>Header animation <input class="duration" type="number" min="0" value="180"> ms</label>
    <button class="apply">Apply timing</button></header><div class="output"><iframe title="${id} output" src="./ticker.html?instance=${id}"></iframe></div>`;
  container.append(section);
  const frame = section.querySelector('iframe');
  frames.push(frame);
  for (const button of section.querySelectorAll('[data-action]')) button.addEventListener('click', () => send(frame, button.dataset.action));
  section.querySelector('.apply').addEventListener('click', () => {
    const topicEntryDelayMs = Number(section.querySelector('.delay').value);
    const headerTransitionMs = Number(section.querySelector('.duration').value);
    if (![topicEntryDelayMs, headerTransitionMs].every(value => Number.isFinite(value) && value >= 0)) {
      notice.textContent = 'Enter nonnegative timing values.';
      return;
    }
    send(frame, 'update', { topicEntryDelayMs, headerTransitionMs });
    notice.textContent = `${id}: timing updated. Save values in data/instances.json to keep them after reload.`;
  });
  const output = section.querySelector('.output');
  new ResizeObserver(() => {
    const scale = output.clientWidth / 1920;
    frame.style.transform = `scale(${scale}) translateY(-830px)`;
    output.style.height = `${250 * scale}px`;
  }).observe(output);
}
document.getElementById('apply-shared').addEventListener('click', () => {
  for (const frame of frames) send(frame, 'shared', { status: document.getElementById('shared-status').value });
  notice.textContent = 'Shared status sent. Stage or instance overrides retain precedence. Updates here are temporary.';
});
