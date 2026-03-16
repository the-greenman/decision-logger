import { api } from "../client.js";
import { getSessionState, incrementTurn, requireMeeting } from "../session.js";

interface StreamResponse {
  buffered: boolean;
  eventCount: number;
}


export async function addSegment(args: {
  text: string;
  speaker?: string | undefined;
  fieldId?: string | undefined;
}): Promise<string> {
  const meetingId = requireMeeting();
  const { flaggedDecisionId, turnCount } = getSessionState();

  // Build context tags that escalate with focus
  const contexts: string[] = [`meeting:${meetingId}`];
  if (flaggedDecisionId) {
    contexts.push(`decision:${flaggedDecisionId}`);
    if (args.fieldId) {
      contexts.push(`decision:${flaggedDecisionId}:${args.fieldId}`);
    }
  }

  const result = await api.post<StreamResponse>(`/api/meetings/${meetingId}/transcripts/stream`, {
    text: args.text,
    speaker: args.speaker ?? "User",
    timestamp: new Date().toISOString(),
    sequenceNumber: turnCount + 1,
    contexts,
  });

  incrementTurn();

  await api.post(`/api/meetings/${meetingId}/streaming/flush`);

  return `Segment logged (turn ${turnCount + 1}, ${result.eventCount ?? 1} buffered). Contexts: [${contexts.join(", ")}]`;
}
