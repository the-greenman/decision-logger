/**
 * In-process session state for the MCP server.
 * Holds active meeting/decision context so tools don't require IDs on every call.
 */

let activeMeetingId: string | undefined;
let activeFlaggedDecisionId: string | undefined;
let activeContextId: string | undefined;
let turnCount = 0;

export interface SessionState {
  meetingId: string | undefined;
  flaggedDecisionId: string | undefined;
  contextId: string | undefined;
  turnCount: number;
}

export function getSessionState(): SessionState {
  return { meetingId: activeMeetingId, flaggedDecisionId: activeFlaggedDecisionId, contextId: activeContextId, turnCount };
}

export function setMeeting(id: string): void {
  activeMeetingId = id;
  activeFlaggedDecisionId = undefined;
  activeContextId = undefined;
}

export function setFlaggedDecision(id: string): void {
  activeFlaggedDecisionId = id;
  activeContextId = undefined;
}

export function setContext(id: string): void {
  activeContextId = id;
}

export function incrementTurn(): void {
  turnCount++;
}

export function restoreSession(meetingId: string, flaggedDecisionId?: string, contextId?: string): void {
  activeMeetingId = meetingId;
  activeFlaggedDecisionId = flaggedDecisionId;
  activeContextId = contextId;
  turnCount = 0;
}

export function clearDecision(): void {
  activeFlaggedDecisionId = undefined;
  activeContextId = undefined;
}

export function requireMeeting(): string {
  if (!activeMeetingId) throw new Error("No active session. Call start_session first.");
  return activeMeetingId;
}

export function requireFlaggedDecision(): string {
  if (!activeFlaggedDecisionId) throw new Error("No flagged decision. Call flag_decision first.");
  return activeFlaggedDecisionId;
}

export function requireContext(): string {
  if (!activeContextId) throw new Error("No active decision context. Call create_context first.");
  return activeContextId;
}
