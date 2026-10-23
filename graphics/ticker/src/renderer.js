import { TopicTiming, topicKey, crossedRightEdge, advanceOffset } from './timing.js';

export class TickerRenderer {
  constructor(root) {
    this.root = root;
    this.$ = id => root.querySelector(`[id="${id}"]`);
    this.track = this.$('crawl-track');
    this.viewport = this.$('crawl-viewport');
    this.timing = new TopicTiming();
    this.previousX = new WeakMap();
    this.offset = 0;
    this.lastTime = null;
    this.nextIndex = 0;
    this.items = [];
    this.paused = false;
    this.disposed = false;
    this.headerTimer = null;
    this.frame = null;
    this.headerKey = null;
    this.onResize = () => { this.fillTrack(); this.seedPositions(); this.fitRound(); };
    window.addEventListener('resize', this.onResize);
  }

  apply(data) {
    const playlistChanged = JSON.stringify(data.tickerItems) !== JSON.stringify(this.data?.tickerItems);
    this.data = structuredClone(data);
    this.timing.delayMs = data.topicEntryDelayMs;
    this.root.style.setProperty('--topic-transition-duration', `${data.headerTransitionMs}ms`);
    this.$('logo').src = data.logo || './assets/ycs-logo.png';
    this.$('bg').src = data.background || './assets/ticker-background.png';
    for (const [id, field] of [['date', 'dayDate'], ['location', 'location'], ['status', 'status'], ['round', 'currentRound'], ['remaining', 'roundsRemaining']]) {
      this.$(id).textContent = data[field] || '';
    }
    this.$('right').classList.toggle('no-remaining', !data.showRoundsRemaining);
    this.fitRound();
    if (playlistChanged) {
      // Already queued text stays in place. New items join at the offscreen tail.
      this.items = data.tickerItems;
      this.nextIndex = 0;
    }
  }

  fitRound() {
    const el = this.$('round'), panel = this.$('right');
    el.style.transform = 'none';
    const scaleX = Math.min(1, (panel.clientWidth - 8) / Math.max(el.scrollWidth, 1));
    const maxH = panel.classList.contains('no-remaining') ? 51 : 39;
    const scaleY = Math.min(1, maxH / Math.max(el.getBoundingClientRect().height, 1));
    el.style.transform = `scale(${scaleX},${scaleY})`;
  }

  appendItem() {
    const entry = this.items[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.items.length;
    const node = document.createElement('div');
    node.className = 'crawl-item';
    node.entry = entry;
    const text = document.createElement('span');
    text.textContent = entry.subtopic;
    const gap = document.createElement('span');
    gap.className = 'crawl-gap';
    node.append(text, gap);
    this.track.append(node);
    this.previousX.set(node, node.offsetLeft + this.offset);
  }

  fillTrack() {
    if (!this.items.length || this.viewport.clientWidth <= 0) return;
    const target = this.viewport.clientWidth * 2 + 2000;
    while (this.track.offsetWidth + this.offset < target) {
      const oldWidth = this.track.offsetWidth;
      this.appendItem();
      if (this.track.offsetWidth <= oldWidth) break;
    }
  }

  seedPositions() {
    for (const node of this.track.children) this.previousX.set(node, node.offsetLeft + this.offset);
  }

  setHeader(item, instant = false) {
    const key = topicKey(item);
    if (!instant && key === this.headerKey) return;
    this.headerKey = key;
    clearTimeout(this.headerTimer);
    const inner = this.$('topic-inner');
    const apply = () => {
      this.$('category').textContent = item.category;
      this.$('topic').textContent = item.topic;
      inner.classList.remove('out');
      this.headerTimer = null;
    };
    if (instant) { apply(); return; }
    inner.classList.add('out');
    this.headerTimer = setTimeout(apply, this.data.headerTransitionMs + this.data.headerSwapGapMs);
  }

  start() {
    if (this.frame !== null || this.disposed) return;
    this.fillTrack();
    const first = this.track.firstElementChild;
    if (first) { this.setHeader(first.entry, true); this.timing.reset(first.entry); }
    this.seedPositions();
    this.lastTime = null;
    const tick = time => {
      if (this.disposed) return;
      const elapsed = this.lastTime === null ? 0 : time - this.lastTime;
      this.lastTime = time;
      if (!this.paused) this.advance(time, elapsed);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  advance(time, elapsed) {
    if (!this.track.firstElementChild && !this.items.length) return;
    this.offset = advanceOffset(this.offset, elapsed, this.data.crawlSpeed);
    while (this.track.firstElementChild) {
      const first = this.track.firstElementChild, width = first.offsetWidth;
      if (width <= 0 || this.offset + width > 0) break;
      this.offset += width;
      first.remove();
    }
    this.fillTrack();
    this.track.style.transform = `translateX(${this.offset}px)`;
    if (this.headerKey === null && this.track.firstElementChild) {
      const firstItem = this.track.firstElementChild.entry;
      this.setHeader(firstItem, true);
      this.timing.reset(firstItem);
    }
    for (const node of this.track.children) {
      const x = node.offsetLeft + this.offset;
      if (crossedRightEdge(this.previousX.get(node), x, this.viewport.clientWidth)) this.timing.entered(node.entry, time);
      this.previousX.set(node, x);
    }
    const next = this.timing.takeDue(time);
    if (next) this.setHeader(next);
    if (!this.track.firstElementChild && !this.items.length) {
      this.offset = 0;
      clearTimeout(this.headerTimer);
      this.$('category').textContent = '';
      this.$('topic').textContent = '';
      this.$('topic-inner').classList.remove('out');
      this.headerKey = null;
      this.timing.reset(null);
    }
  }

  show() { this.root.classList.add('visible'); }
  hide() { this.root.classList.remove('visible'); }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  getState() {
    return { offset: this.offset, paused: this.paused, visible: this.root.classList.contains('visible'), headerKey: this.headerKey, queuedItems: this.track.childElementCount };
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.headerTimer);
    window.removeEventListener('resize', this.onResize);
  }
}
