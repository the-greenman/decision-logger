import { api } from "../client.js";
import { requireContext, requireMeeting } from "../session.js";

interface DecisionContext {
  id: string;
  templateId: string;
  status: string;
  draftData?: Record<string, unknown>;
  lockedFields?: string[];
}

interface DecisionField {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
  fieldType: string;
  order?: number;
}

export async function getFields(): Promise<string> {
  const contextId = requireContext();
  const ctx = await api.get<DecisionContext>(`/api/decision-contexts/${contextId}`);
  const fieldsResponse = await api.get<{ fields: DecisionField[] }>(
    `/api/templates/${ctx.templateId}/fields`,
  );

  const draft = ctx.draftData ?? {};
  const locked = new Set(ctx.lockedFields ?? []);
  const fields = fieldsResponse.fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const lines = [`Fields for context ${contextId} (status: ${ctx.status}):`, ""];
  for (const f of fields) {
    const value = draft[f.id];
    const lockedMark = locked.has(f.id) ? " [LOCKED]" : "";
    const reqMark = f.required ? " [required]" : "";
    const valueLine = value ? `   Value: ${String(value)}` : `   Value: (empty)`;
    lines.push(`• ${f.name}${reqMark}${lockedMark}`);
    lines.push(`  ID: ${f.id}`);
    if (f.description) lines.push(`  ${f.description}`);
    lines.push(valueLine);
    lines.push("");
  }
  return lines.join("\n");
}

export async function getDraft(): Promise<string> {
  const contextId = requireContext();
  const ctx = await api.get<DecisionContext>(`/api/decision-contexts/${contextId}`);
  const draft = ctx.draftData ?? {};
  const locked = new Set(ctx.lockedFields ?? []);

  const entries = Object.entries(draft);
  if (entries.length === 0) {
    return `No draft data yet for context ${contextId}. Use set_field or generate_draft.`;
  }

  const lines = [`Draft (context: ${contextId}, status: ${ctx.status}):`, ""];
  for (const [fieldId, value] of entries) {
    const lockedMark = locked.has(fieldId) ? " [LOCKED]" : "";
    lines.push(`${fieldId.slice(0, 8)}…${lockedMark}: ${String(value)}`);
  }
  return lines.join("\n");
}

export async function setField(args: { fieldId: string; value: unknown }): Promise<string> {
  const contextId = requireContext();
  const meetingId = requireMeeting();
  await api.patch(`/api/decision-contexts/${contextId}/fields/${args.fieldId}`, {
    value: args.value,
  });
  await api.post(`/api/meetings/${meetingId}/context/field`, { fieldId: args.fieldId });
  return `Field ${args.fieldId} set to: ${String(args.value)}`;
}

export async function lockField(args: { fieldId: string }): Promise<string> {
  const contextId = requireContext();
  const meetingId = requireMeeting();
  await api.put(`/api/decision-contexts/${contextId}/lock-field`, {
    fieldId: args.fieldId,
  });
  await api.delete(`/api/meetings/${meetingId}/context/field`);
  return `Field ${args.fieldId} locked.`;
}

export async function generateDraft(): Promise<string> {
  const contextId = requireContext();
  const ctx = await api.post<DecisionContext>(
    `/api/decision-contexts/${contextId}/generate-draft`,
    {},
  );
  const draft = ctx.draftData ?? {};
  const locked = new Set(ctx.lockedFields ?? []);

  const lines = [`Draft generated for context ${contextId}:`, ""];
  for (const [fieldId, value] of Object.entries(draft)) {
    const lockedMark = locked.has(fieldId) ? " [LOCKED]" : "";
    lines.push(`${fieldId.slice(0, 8)}…${lockedMark}: ${String(value)}`);
  }
  return lines.join("\n");
}
