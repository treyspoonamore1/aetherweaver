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
}
