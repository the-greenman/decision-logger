import type { BusEvent, ConnectionSSEEvent } from "../interfaces/i-global-context-service";

export class ContextEventBus {
  private listeners = new Map<string, Set<(event: BusEvent) => void>>();
  private ringBuffers = new Map<string, BusEvent[]>();
  private counters = new Map<string, number>();

  constructor(private readonly bufferSize = 200) {}

  subscribe(connectionId: string, fn: (event: BusEvent) => void): () => void {
    if (!this.listeners.has(connectionId)) {
      this.listeners.set(connectionId, new Set());
    }
    this.listeners.get(connectionId)!.add(fn);

    return () => {
      const set = this.listeners.get(connectionId);
      if (set) {
        set.delete(fn);
        if (set.size === 0) this.listeners.delete(connectionId);
      }
    };
  }

  emit(connectionId: string, event: ConnectionSSEEvent): void {
    const counter = (this.counters.get(connectionId) ?? 0) + 1;
    this.counters.set(connectionId, counter);

    const busEvent: BusEvent = { ...event, id: counter };

    // Prepend to ring buffer (newest first), capped at bufferSize
    const buffer = this.ringBuffers.get(connectionId) ?? [];
    buffer.unshift(busEvent);
    if (buffer.length > this.bufferSize) buffer.pop();
    this.ringBuffers.set(connectionId, buffer);

    const listeners = this.listeners.get(connectionId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(busEvent);
        } catch (err) {
          console.error(`SSE listener error for connection ${connectionId}:`, err);
        }
      }
    }
  }

  /**
   * Returns all buffered events with id > afterId, in ascending order.
   * Returns "resync" if afterId predates the oldest buffered event (gap too large).
   * Returns undefined if no events have ever been emitted for this connection.
   */
  replay(connectionId: string, afterId: number): BusEvent[] | "resync" | undefined {
    const buffer = this.ringBuffers.get(connectionId);
    if (!buffer || buffer.length === 0) return undefined;

    const oldest = buffer[buffer.length - 1];
    // There's a gap if the oldest event we have is not the one immediately after afterId
    if (oldest !== undefined && oldest.id > afterId + 1) {
      return "resync";
    }

    // buffer is stored newest-first; reverse to get ascending order
    return buffer.filter((e) => e.id > afterId).reverse();
  }
}
