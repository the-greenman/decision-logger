import { describe, it, expect, beforeEach } from "vitest";
import { ContextEventBus } from "../events/context-event-bus";
import type { BusEvent, ConnectionSSEEvent } from "../interfaces/i-global-context-service";

const CONN_A = crypto.randomUUID();
const CONN_B = crypto.randomUUID();

function contextEvent(): ConnectionSSEEvent {
  return { type: "context", data: { activeMeetingId: crypto.randomUUID() } };
}

describe("ContextEventBus", () => {
  let bus: ContextEventBus;

  beforeEach(() => {
    bus = new ContextEventBus();
  });

  // ---------------------------------------------------------------------------
  // subscribe / emit
  // ---------------------------------------------------------------------------

  it("delivers emitted events to subscribers on the matching connection", () => {
    const received: BusEvent[] = [];
    bus.subscribe(CONN_A, (e) => received.push(e));

    bus.emit(CONN_A, contextEvent());

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("context");
  });

  it("assigns monotonically increasing ids per connection", () => {
    const ids: number[] = [];
    bus.subscribe(CONN_A, (e) => ids.push(e.id));

    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());

    expect(ids).toEqual([1, 2, 3]);
  });

  it("ids are scoped per connection — each connection starts at 1", () => {
    const idsA: number[] = [];
    const idsB: number[] = [];
    bus.subscribe(CONN_A, (e) => idsA.push(e.id));
    bus.subscribe(CONN_B, (e) => idsB.push(e.id));

    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_B, contextEvent());

    expect(idsA).toEqual([1, 2]);
    expect(idsB).toEqual([1]);
  });

  it("does not deliver events to subscribers on a different connection", () => {
    const received: BusEvent[] = [];
    bus.subscribe(CONN_B, (e) => received.push(e));

    bus.emit(CONN_A, contextEvent());

    expect(received).toHaveLength(0);
  });

  it("stops delivering events after unsubscribing", () => {
    const received: BusEvent[] = [];
    const unsubscribe = bus.subscribe(CONN_A, (e) => received.push(e));

    bus.emit(CONN_A, contextEvent());
    unsubscribe();
    bus.emit(CONN_A, contextEvent());

    expect(received).toHaveLength(1);
  });

  it("supports multiple subscribers on the same connection", () => {
    const a: BusEvent[] = [];
    const b: BusEvent[] = [];
    bus.subscribe(CONN_A, (e) => a.push(e));
    bus.subscribe(CONN_A, (e) => b.push(e));

    bus.emit(CONN_A, contextEvent());

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].id).toBe(b[0].id);
  });

  it("delivers all ConnectionSSEEvent types with correct payload", () => {
    const received: BusEvent[] = [];
    bus.subscribe(CONN_A, (e) => received.push(e));

    const chunk = { id: crypto.randomUUID(), meetingId: crypto.randomUUID(), text: "hello", wordCount: 1, createdAt: new Date().toISOString() };
    const decision = { id: crypto.randomUUID(), meetingId: crypto.randomUUID(), suggestedTitle: "D", confidence: 1, priority: 0, status: "pending" as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const log = { id: crypto.randomUUID(), meetingId: crypto.randomUUID(), decisionContextId: crypto.randomUUID(), templateId: crypto.randomUUID(), templateVersion: 1, fields: {}, decisionMethod: { type: "manual" as const }, loggedBy: "Alice", loggedAt: new Date().toISOString() };

    bus.emit(CONN_A, { type: "chunk", data: chunk });
    bus.emit(CONN_A, { type: "flagged", data: decision });
    bus.emit(CONN_A, { type: "logged", data: log });
    bus.emit(CONN_A, { type: "resync" });

    expect(received[0].type).toBe("chunk");
    expect(received[1].type).toBe("flagged");
    expect(received[2].type).toBe("logged");
    expect(received[3].type).toBe("resync");
  });

  // ---------------------------------------------------------------------------
  // replay
  // ---------------------------------------------------------------------------

  it("returns undefined when no events have been emitted for the connection", () => {
    expect(bus.replay(CONN_A, 0)).toBeUndefined();
  });

  it("returns an empty array when the client is already up to date", () => {
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());

    const result = bus.replay(CONN_A, 2);

    expect(result).toEqual([]);
  });

  it("replays events after the given id in ascending order", () => {
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());

    const result = bus.replay(CONN_A, 3);

    expect(Array.isArray(result)).toBe(true);
    const events = result as BusEvent[];
    expect(events.map((e) => e.id)).toEqual([4, 5]);
  });

  it("replays all events when afterId is 0", () => {
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());
    bus.emit(CONN_A, contextEvent());

    const result = bus.replay(CONN_A, 0);

    expect(Array.isArray(result)).toBe(true);
    expect((result as BusEvent[]).map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it("returns 'resync' when afterId is older than the oldest buffered event", () => {
    // Fill the buffer beyond its capacity to force eviction
    const smallBus = new ContextEventBus(3);
    // Emit 4 events — event id=1 is evicted
    smallBus.emit(CONN_A, contextEvent());
    smallBus.emit(CONN_A, contextEvent());
    smallBus.emit(CONN_A, contextEvent());
    smallBus.emit(CONN_A, contextEvent()); // id=1 drops off

    // afterId=0 means client has seen nothing; event 1 was evicted → resync
    expect(smallBus.replay(CONN_A, 0)).toBe("resync");
    // afterId=1 means client has seen event 1; we can serve events 2–4 → no resync
    const result = smallBus.replay(CONN_A, 1);
    expect(Array.isArray(result)).toBe(true);
    expect((result as import("../interfaces/i-global-context-service").BusEvent[]).map((e) => e.id)).toEqual([2, 3, 4]);
  });
});
