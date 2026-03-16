import { api } from "../client.js";
import { requireContext, clearDecision } from "../session.js";

interface DecisionLog {
  id: string;
  loggedAt: string;
  decisionMethod: { type: string; details?: string };
  loggedBy: string;
}

export async function logDecision(args: {
  method: string;
  loggedBy: string;
  details?: string | undefined;
}): Promise<string> {
  const contextId = requireContext();
  const log = await api.post<DecisionLog>(`/api/decision-contexts/${contextId}/log`, {
    loggedBy: args.loggedBy,
    decisionMethod: { type: args.method, details: args.details },
  });

  clearDecision();

  return [
    `✓ Decision logged.`,
    `Log ID:  ${log.id}`,
    `Method:  ${log.decisionMethod.type}`,
    `By:      ${log.loggedBy}`,
    `At:      ${log.loggedAt}`,
    ``,
    `Export: dlogger draft export ${log.id}`,
    `Export (JSON): dlogger draft export ${log.id} --format json`,
    ``,
    `Decision context cleared. Ready for the next decision.`,
  ].join("\n");
}
