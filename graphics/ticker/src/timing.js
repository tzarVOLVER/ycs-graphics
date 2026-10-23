export const topicKey = item => JSON.stringify([item.category || '', item.topic || '']);

// One scheduler per output. Time comes from the crawler's frame clock, not timers
// that could become detached from the actual moment text enters the viewport.
export class TopicTiming {
  constructor(delayMs = 180) {
    this.delayMs = delayMs;
    this.activeKey = null;
    this.pending = null;
  }

  reset(item) {
    this.activeKey = item ? topicKey(item) : null;
    this.pending = null;
  }

  entered(item, time) {
    const key = topicKey(item);
    if (key === this.activeKey) {
      this.pending = null;
    } else if (key !== this.pending?.key) {
      this.pending = { key, item, at: time };
    }
  }

  takeDue(time) {
    if (!this.pending || time - this.pending.at < this.delayMs) return null;
    const { key, item } = this.pending;
    this.activeKey = key;
    this.pending = null;
    return item;
  }
}

export function crossedRightEdge(previousX, currentX, rightEdge) {
  return previousX !== undefined && previousX >= rightEdge && currentX < rightEdge;
}

export function advanceOffset(offset, elapsedMs, speed) {
  // Retain the prototype's frame-gap behavior after browser stalls/backgrounding.
  return offset - speed * Math.min(Math.max(elapsedMs, 0), 50) / 1000;
}
