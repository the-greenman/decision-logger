import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionState, restoreSession } from "../session.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { resumeSession, hydrateFromApi } = await import("../tools/session.js");

const MEETING_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DECISION_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const CONTEXT_ID = "cccccccc-0000-0000-0000-000000000003";

function makeOk(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
  restoreSession("", undefined, undefined);
});

describe("resumeSession", () => {
  it("restores state from API context and returns confirmation", async () => {
    mockFetch.mockResolvedValue(
      makeOk({
        activeMeetingId: MEETING_ID,
        activeDecisionId: DECISION_ID,
        activeDecisionContextId: CONTEXT_ID,
      }),
    );

    const result = await resumeSession();
    expect(result).toContain("Session restored");
    expect(result).toContain(MEETING_ID);

    const s = getSessionState();
    expect(s.meetingId).toBe(MEETING_ID);
    expect(s.flaggedDecisionId).toBe(DECISION_ID);
    expect(s.contextId).toBe(CONTEXT_ID);
  });

  it("returns helpful message when no active context exists in API", async () => {
    mockFetch.mockResolvedValue(makeOk({}));
    const result = await resumeSession();
    expect(result).toContain("No active context");
  });
});

describe("hydrateFromApi", () => {
  it("silently succeeds when API is unavailable", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(hydrateFromApi()).resolves.toBeUndefined();
  });

  it("restores state when API has active context", async () => {
    mockFetch.mockResolvedValue(
      makeOk({ activeMeetingId: MEETING_ID }),
    );
    await hydrateFromApi();
    expect(getSessionState().meetingId).toBe(MEETING_ID);
  });
});
