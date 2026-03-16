import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the error handling behaviour of client.ts by importing it and
// stubbing globalThis.fetch.

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Dynamic import so the fetch stub is in place before the module loads.
const { api } = await import("../client.js");

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "Error",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("api client error handling", () => {
  it("throws a string message when error field is a string", async () => {
    mockFetch.mockResolvedValue(makeResponse(400, { error: "Bad meeting ID" }));
    await expect(api.get("/api/context")).rejects.toThrow("Bad meeting ID");
  });

  it("does not throw [object Object] when error field is an object", async () => {
    // This was the root cause of the flag_decision bug.
    mockFetch.mockResolvedValue(
      makeResponse(422, { error: { code: "VALIDATION_ERROR", field: "meetingId" } }),
    );
    await expect(api.get("/api/context")).rejects.toThrow(/VALIDATION_ERROR/);
  });

  it("falls back to HTTP status text when no error field", async () => {
    mockFetch.mockResolvedValue(makeResponse(503, {}));
    await expect(api.get("/api/context")).rejects.toThrow(/503|Error/);
  });

  it("returns undefined for 204 responses", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() } as unknown as Response);
    const result = await api.delete("/api/context/meeting");
    expect(result).toBeUndefined();
  });
});
