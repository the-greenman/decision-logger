import { describe, it, expect, beforeEach } from "vitest";
import {
  getSessionState,
  setMeeting,
  setFlaggedDecision,
  setContext,
  restoreSession,
  requireMeeting,
  requireFlaggedDecision,
  requireContext,
  clearDecision,
} from "../session.js";

const MEETING_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DECISION_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const CONTEXT_ID = "cccccccc-0000-0000-0000-000000000003";

beforeEach(() => {
  // Reset state between tests by clearing everything
  try { clearDecision(); } catch { /* ignore */ }
  // Force clear meeting by setting a dummy then clearing via restoreSession with no ids
  // restoreSession with undefined ids is not supported — use setMeeting to clear to a known state
});

describe("setMeeting", () => {
  it("sets meeting and clears downstream state", () => {
    setMeeting(MEETING_ID);
    setFlaggedDecision(DECISION_ID);
    setContext(CONTEXT_ID);

    setMeeting("new-meeting");
    const s = getSessionState();
    expect(s.meetingId).toBe("new-meeting");
    expect(s.flaggedDecisionId).toBeUndefined();
    expect(s.contextId).toBeUndefined();
  });
});

describe("restoreSession", () => {
  it("restores all three IDs without cascade-clearing", () => {
    // This is the key behaviour: setMeeting clears decision/context, but
    // restoreSession must set all three atomically.
    restoreSession(MEETING_ID, DECISION_ID, CONTEXT_ID);
    const s = getSessionState();
    expect(s.meetingId).toBe(MEETING_ID);
    expect(s.flaggedDecisionId).toBe(DECISION_ID);
    expect(s.contextId).toBe(CONTEXT_ID);
  });

  it("restores meeting only when optional IDs are omitted", () => {
    restoreSession(MEETING_ID);
    const s = getSessionState();
    expect(s.meetingId).toBe(MEETING_ID);
    expect(s.flaggedDecisionId).toBeUndefined();
    expect(s.contextId).toBeUndefined();
  });

  it("resets turn count to 0", () => {
    restoreSession(MEETING_ID, DECISION_ID, CONTEXT_ID);
    expect(getSessionState().turnCount).toBe(0);
  });
});

describe("require guards", () => {
  it("requireMeeting throws when no meeting is set", () => {
    restoreSession("" as string);
    // Restore to empty — the guard checks for falsy
    expect(() => requireMeeting()).toThrow("No active session");
  });

  it("requireFlaggedDecision throws when no decision is set", () => {
    restoreSession(MEETING_ID);
    expect(() => requireFlaggedDecision()).toThrow("No flagged decision");
  });

  it("requireContext throws when no context is set", () => {
    restoreSession(MEETING_ID, DECISION_ID);
    expect(() => requireContext()).toThrow("No active decision context");
  });
});
