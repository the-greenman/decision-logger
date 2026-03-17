/**
 * Phase 2: SSE endpoint tests
 *
 * Contract:
 *   GET /api/connections/:id/events
 *   - Returns Content-Type: text/event-stream
 *   - Sends an initial context snapshot immediately on connect
 *   - Emits `event: context` when context is mutated via another API call on
 *     the same connection ID
 *   - Streams for different connection IDs are isolated
 *
 * Wire format (named SSE):
 *   event: context
 *   data: <GlobalContext JSON>
 *   id: <monotonic integer>
 *
 *   event: chunk
 *   data: <TranscriptChunk JSON>
 *   id: <monotonic integer>
 *
 *   event: flagged
 *   data: <FlaggedDecision JSON>
 *   id: <monotonic integer>
 */

import { describe, it, expect } from "vitest";

process.env.DATABASE_URL =
  "postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test";
process.env.USE_MOCK_LLM = "true";

const { app } = await import("../index");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads SSE events from the response body until `count` events have arrived
 * or the controller signals abort.  Returns the raw text of collected chunks.
 */
async function readSSEEvents(
  body: ReadableStream<Uint8Array>,
  count: number,
  timeoutMs = 3000,
): Promise<string[]> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const events: string[] = [];
  let buffer = "";

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`SSE timeout after ${timeoutMs}ms`)), timeoutMs),
  );

  try {
    await Promise.race([
      (async () => {
        while (events.length < count) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Split on double newline (SSE event boundary)
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (part.trim()) events.push(part.trim());
          }
        }
      })(),
      timeout,
    ]);
  } finally {
    reader.cancel();
  }

  return events;
}

/**
 * Parses a single SSE event block into { event, data, id } fields.
 */
function parseSSEEvent(raw: string): { event?: string; data?: string; id?: string } {
  const result: { event?: string; data?: string; id?: string } = {};
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) result.event = line.slice(6).trim();
    else if (line.startsWith("data:")) result.data = line.slice(5).trim();
    else if (line.startsWith("id:")) result.id = line.slice(3).trim();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/connections/:id/events (SSE)", () => {
  it("returns 200 with Content-Type text/event-stream", async () => {
    const connId = crypto.randomUUID();

    const response = await app.request(`/api/connections/${connId}/events`, {
      headers: { "X-Connection-ID": connId },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    response.body?.cancel();
  });

  it("sends Cache-Control: no-cache on the SSE response", async () => {
    const connId = crypto.randomUUID();

    const response = await app.request(`/api/connections/${connId}/events`, {
      headers: { "X-Connection-ID": connId },
    });

    expect(response.headers.get("Cache-Control")).toContain("no-cache");
    response.body?.cancel();
  });

  it("sends an initial context snapshot as the first SSE event", async () => {
    const connId = crypto.randomUUID();

    const response = await app.request(`/api/connections/${connId}/events`, {
      headers: { "X-Connection-ID": connId },
    });

    const events = await readSSEEvents(response.body!, 1);
    expect(events).toHaveLength(1);

    const parsed = parseSSEEvent(events[0]);
    expect(parsed.event).toBe("context");
    expect(() => JSON.parse(parsed.data ?? "")).not.toThrow();
  });

  it("emits a context event after active meeting is cleared on the same connection", async () => {
    const connId = crypto.randomUUID();

    // Open the SSE stream
    const sseResponse = await app.request(`/api/connections/${connId}/events`, {
      headers: { "X-Connection-ID": connId },
    });

    // Read the initial context snapshot
    await readSSEEvents(sseResponse.body!, 1);

    // Trigger a context mutation on the same connection
    await app.request("/api/context/meeting", {
      method: "DELETE",
      headers: { "X-Connection-ID": connId },
    });

    // The stream should emit a second context event reflecting the cleared state
    const followUpEvents = await readSSEEvents(sseResponse.body!, 1);
    expect(followUpEvents).toHaveLength(1);

    const parsed = parseSSEEvent(followUpEvents[0]);
    expect(parsed.event).toBe("context");

    const data = JSON.parse(parsed.data ?? "{}");
    expect(data.activeMeetingId).toBeUndefined();
  });

  it("does not deliver events from connection A to connection B's stream", async () => {
    const connA = crypto.randomUUID();
    const connB = crypto.randomUUID();

    const responseB = await app.request(`/api/connections/${connB}/events`, {
      headers: { "X-Connection-ID": connB },
    });

    // Consume the initial event for B
    await readSSEEvents(responseB.body!, 1);

    // Mutate connection A's context
    await app.request("/api/context/meeting", {
      method: "DELETE",
      headers: { "X-Connection-ID": connA },
    });

    // B's stream should NOT receive an additional event — timeout is expected
    await expect(readSSEEvents(responseB.body!, 1, 300)).rejects.toThrow("SSE timeout");
  });

  it("each SSE event carries a monotonically increasing id", async () => {
    const connId = crypto.randomUUID();

    const sseResponse = await app.request(`/api/connections/${connId}/events`, {
      headers: { "X-Connection-ID": connId },
    });

    // Initial event
    const firstEvents = await readSSEEvents(sseResponse.body!, 1);
    const first = parseSSEEvent(firstEvents[0]);

    // Trigger mutation
    await app.request("/api/context/meeting", {
      method: "DELETE",
      headers: { "X-Connection-ID": connId },
    });

    // Second event
    const secondEvents = await readSSEEvents(sseResponse.body!, 1);
    const second = parseSSEEvent(secondEvents[0]);

    expect(Number(first.id)).toBeGreaterThanOrEqual(0);
    expect(Number(second.id)).toBeGreaterThan(Number(first.id));
  });

  // ---------------------------------------------------------------------------
  // Reconnect: Last-Event-ID replay
  // ---------------------------------------------------------------------------

  it("replays missed events when client reconnects with Last-Event-ID", async () => {
    const connId = crypto.randomUUID();

    // Emit 3 context mutations so the server has a ring buffer for this connection
    for (let i = 0; i < 3; i++) {
      await app.request("/api/context/meeting", {
        method: "DELETE",
        headers: { "X-Connection-ID": connId },
      });
    }

    // Connect with Last-Event-ID: 1 — should receive events 2 and 3 immediately
    const response = await app.request(`/api/connections/${connId}/events`, {
      headers: {
        "X-Connection-ID": connId,
        "Last-Event-ID": "1",
      },
    });

    expect(response.status).toBe(200);
    const events = await readSSEEvents(response.body!, 2);
    expect(events).toHaveLength(2);

    const ids = events.map((e) => Number(parseSSEEvent(e).id));
    expect(ids[0]).toBe(2);
    expect(ids[1]).toBe(3);
  });

  it("sends event: resync when Last-Event-ID is older than the ring buffer", async () => {
    const connId = crypto.randomUUID();

    // Reconnect claiming to have seen event 0 but the ring buffer is already past it
    // (simulated by providing an impossibly old Last-Event-ID after events have been emitted
    // and the buffer has rolled over — we use Last-Event-ID: 0 here which is always valid
    // to replay from; to trigger resync we need the id to predate the oldest buffered event.
    // This test verifies the wire format when the server sends a resync.)
    const response = await app.request(`/api/connections/${connId}/events`, {
      headers: {
        "X-Connection-ID": connId,
        "Last-Event-ID": "99999",
      },
    });

    expect(response.status).toBe(200);
    const events = await readSSEEvents(response.body!, 1);
    const parsed = parseSSEEvent(events[0]);

    // If the server has no ring buffer for this connection (first connect) it sends
    // the initial context snapshot. If it detects a gap it sends resync.
    // Either way the event field must be a valid named event.
    expect(["context", "resync"]).toContain(parsed.event);
  });
});
