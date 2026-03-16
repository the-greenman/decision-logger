import { api } from "../client.js";
import { requireMeeting, requireFlaggedDecision, setFlaggedDecision, setContext } from "../session.js";

interface FlaggedDecision {
  id: string;
  suggestedTitle: string;
  confidence: number;
  status: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  fieldCount?: number;
}

interface DecisionContext {
  id: string;
  templateId: string;
  flaggedDecisionId: string;
  status: string;
}

interface DecisionField {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
  fieldType: string;
}

export async function flagDecision(args: {
  title: string;
  contextSummary?: string | undefined;
  confidence?: number | undefined;
}): Promise<string> {
  const meetingId = requireMeeting();
  const decision = await api.post<FlaggedDecision>(`/api/meetings/${meetingId}/flagged-decisions`, {
    suggestedTitle: args.title,
    contextSummary: args.contextSummary ?? "",
    confidence: args.confidence ?? 0.8,
    priority: 3,
    status: "pending",
    chunkIds: [],
  });
  setFlaggedDecision(decision.id);
  const ctx = await api.post<{ activeDecisionContextId?: string }>(
    `/api/meetings/${meetingId}/context/decision`,
    { flaggedDecisionId: decision.id },
  );
  if (ctx.activeDecisionContextId) {
    setContext(ctx.activeDecisionContextId);
  }
  return [
    `Decision flagged: "${decision.suggestedTitle}"`,
    `Decision ID: ${decision.id}`,
    ctx.activeDecisionContextId ? `Context ID: ${ctx.activeDecisionContextId}` : "",
    ``,
    `Next: call list_templates to choose a template, then create_context.`,
  ].filter(Boolean).join("\n");
}

export async function listTemplates(): Promise<string> {
  const response = await api.get<{ templates: Template[] }>("/api/templates");
  const templates = response.templates;
  if (templates.length === 0) return "No templates available.";

  const lines = ["Available decision templates:", ""];
  templates.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.name} (${t.category})`);
    lines.push(`   ID: ${t.id}`);
    if (t.description) lines.push(`   ${t.description}`);
    lines.push("");
  });
  return lines.join("\n");
}

export async function createContext(args: { templateId: string }): Promise<string> {
  const meetingId = requireMeeting();
  const flaggedDecisionId = requireFlaggedDecision();

  const ctx = await api.post<DecisionContext>("/api/decision-contexts", {
    flaggedDecisionId,
    templateId: args.templateId,
    meetingId,
  });
  setContext(ctx.id);

  // Fetch fields so Claude can see what needs filling
  const fieldsResponse = await api.get<{ fields: DecisionField[] }>(
    `/api/templates/${args.templateId}/fields`,
  );
  const fields = fieldsResponse.fields;

  const lines = [
    `Decision context created.`,
    `Context ID: ${ctx.id}`,
    `Template: ${args.templateId}`,
    ``,
    `Fields to fill (${fields.length} total):`,
    "",
  ];
  fields.forEach((f, i) => {
    const req = f.required ? " [required]" : "";
    lines.push(`${i + 1}. ${f.name}${req}`);
    if (f.description) lines.push(`   ${f.description}`);
  });
  lines.push("");
  lines.push("Use set_field to fill each field as we discuss it. Use lock_field when a value is confirmed.");
  return lines.join("\n");
}
