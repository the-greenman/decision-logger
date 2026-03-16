import { api } from "../client.js";
import { getSessionState, setMeeting, restoreSession } from "../session.js";

interface GlobalContext {
  activeMeetingId?: string;
  activeDecisionId?: string;
  activeDecisionContextId?: string;
  activeField?: string;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  status: string;
}

export async function startSession(args: {
  title: string;
  participants?: string[] | undefined;
}): Promise<string> {
  const participants = args.participants ?? ["User", "Claude"];
  const meeting = await api.post<Meeting>("/api/meetings", {
    title: args.title,
    date: new Date().toISOString(),
    participants,
  });
  setMeeting(meeting.id);
  await api.post("/api/context/meeting", { meetingId: meeting.id });
  return [
    `Session started.`,
    `Meeting ID: ${meeting.id}`,
    `Topic: ${meeting.title}`,
    `Participants: ${meeting.participants.join(", ")}`,
    ``,
    `The conversation is now being logged as a meeting transcript.`,
    `Call add_segment after each exchange to capture it.`,
    `Call flag_decision when a decision topic surfaces.`,
  ].join("\n");
}

export async function resumeSession(): Promise<string> {
  const ctx = await api.get<GlobalContext>("/api/context");
  if (!ctx.activeMeetingId) {
    return "No active context found in API. Use start_session to begin a new session.";
  }
  restoreSession(ctx.activeMeetingId, ctx.activeDecisionId, ctx.activeDecisionContextId);
  const s = getSessionState();
  return [
    `Session restored from API context.`,
    `Meeting ID:   ${s.meetingId}`,
    `Decision ID:  ${s.flaggedDecisionId ?? "(none)"}`,
    `Context ID:   ${s.contextId ?? "(none)"}`,
    ``,
    `Transcript turn count reset to 0. Continue adding segments.`,
  ].join("\n");
}

export async function hydrateFromApi(): Promise<void> {
  try {
    const ctx = await api.get<GlobalContext>("/api/context");
    if (ctx.activeMeetingId) {
      restoreSession(ctx.activeMeetingId, ctx.activeDecisionId, ctx.activeDecisionContextId);
    }
  } catch {
    // API not available on startup — start with empty state
  }
}

export function getSession(): string {
  const s = getSessionState();
  if (!s.meetingId) {
    return "No active session. Call start_session to begin.";
  }
  const lines = [
    `Active session:`,
    `  Meeting ID:   ${s.meetingId}`,
    `  Decision ID:  ${s.flaggedDecisionId ?? "(none)"}`,
    `  Context ID:   ${s.contextId ?? "(none)"}`,
    `  Turns logged: ${s.turnCount}`,
  ];
  return lines.join("\n");
}
