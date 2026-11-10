/** Per-tick event buffer. The sim pushes during a tick; consumers drain after the step. */
export class EventQueue<E> {
  private buffer: E[] = [];

  push(event: E): void {
    this.buffer.push(event);
  }

  /** Returns everything queued since the last drain and empties the queue. */
  drain(): E[] {
    const out = this.buffer;
    this.buffer = [];
    return out;
  }

  get length(): number {
    return this.buffer.length;
  }

  /**
   * The event at `index` among those queued since the last drain (no copy, nothing removed).
   * The trigger system reads the tick's events this way (docs/phase-5g.md).
   */
  at(index: number): E | undefined {
    return this.buffer[index];
  }
}
