import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { startSession, getSession, resumeSession, hydrateFromApi } from "./tools/session.js";
import { addSegment } from "./tools/transcript.js";
import { flagDecision, listTemplates, createContext } from "./tools/decisions.js";
import { getFields, getDraft, setField, lockField, generateDraft } from "./tools/fields.js";
import { logDecision } from "./tools/log.js";

const server = new McpServer({
  name: "decision-logger",
  version: "1.0.0",
});

// ── Session ────────────────────────────────────────────────────────────────

server.tool(
  "start_session",
  "Start a decision-logging session for this conversation. Call this proactively when a decision topic surfaces, or at the start of any conversation where decisions may be made. Creates a meeting record that anchors subsequent transcript and decision data.",
  {
    title: z.string().describe("Topic or purpose of this session"),
    participants: z
      .array(z.string())
      .optional()
      .describe("Participant names — defaults to ['User', 'Claude']"),
  },
  async (args) => {
    try {
      const text = await startSession(args);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

server.tool(
  "resume_session",
  "Restore the active session from the API context store after an MCP server restart. Call this at the start of a conversation when a session may already be active. Returns the restored meeting, decision, and context IDs.",
  {},
  async () => {
    try {
      const text = await resumeSession();
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

server.tool(
  "get_session",
  "Return the current session state: active meeting ID, flagged decision ID, context ID, and turn count.",
  {},
  async () => {
    const text = getSession();
    return { content: [{ type: "text", text }] };
  },
);

// ── Transcript ─────────────────────────────────────────────────────────────

server.tool(
  "add_segment",
  "Push a conversation turn to the streaming transcript. Call this for EVERY substantive exchange — both user turns and your own responses. This is what makes the conversation retrievable as source context for the decision record. Context tags are managed automatically based on session state.",
  {
    text: z.string().describe("The conversation text to log"),
    speaker: z
      .string()
      .optional()
      .describe("Speaker name — 'User' or 'Claude' (defaults to 'User')"),
    fieldId: z
      .string()
      .optional()
      .describe("If this exchange is about a specific template field, pass the field ID for fine-grained context tagging"),
  },
  async (args) => {
    try {
      const text = await addSegment(args);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

// ── Decision Workflow ──────────────────────────────────────────────────────

server.tool(
  "flag_decision",
  "Record that a decision topic has been identified in the conversation. Call this proactively when a decision is surfacing — don't wait to be asked. After flagging, call list_templates to suggest an appropriate template.",
  {
    title: z.string().describe("Concise decision statement"),
    contextSummary: z
      .string()
      .optional()
      .describe("What led to this decision and what is being decided"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Confidence this is a real decision (0–1, defaults to 0.8)"),
  },
  async (args) => {
    try {
      const text = await flagDecision(args);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

server.tool(
  "list_templates",
  "Return the available decision templates with their IDs. Use this after flagging a decision to suggest an appropriate template to the user.",
  {},
  async () => {
    try {
      const text = await listTemplates();
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

server.tool(
  "create_context",
  "Create a decision context (draft workspace) for the active flagged decision using the specified template. Returns the list of fields that need to be filled. Call this after the user has agreed on a template.",
  {
    templateId: z.string().describe("The template ID to use for this decision"),
  },
  async (args) => {
    try {
      const text = await createContext(args);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

// ── Field Workflow ─────────────────────────────────────────────────────────

server.tool(
  "get_fields",
  "Return all template fields for the active decision context with their current values and lock status. Use this to understand what still needs to be discussed.",
  {},
  async () => {
    try {
      const text = await getFields();
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

server.tool(
  "get_draft",
  "Return the current draft — all field values and which are locked. Use this to show progress or verify state before logging.",
  {},
  async () => {
    try {
      const text = await getDraft();
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

server.tool(
  "set_field",
  "Set a field value based on what was discussed. Call this as soon as a field's value becomes clear from the conversation — don't batch fields together.",
  {
    fieldId: z.string().describe("The field ID to set"),
    value: z.unknown().describe("The field value"),
  },
  async (args) => {
    try {
      const text = await setField({ fieldId: args.fieldId, value: args.value });
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

server.tool(
  "lock_field",
  "Lock a field to prevent it from being overwritten by generate_draft. Use this when the user has confirmed a value is correct.",
  {
    fieldId: z.string().describe("The field ID to lock"),
  },
  async (args) => {
    try {
      const text = await lockField(args);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

server.tool(
  "generate_draft",
  "Run LLM draft generation against all accumulated transcript chunks to fill remaining unlocked fields. Use this after sufficient context has been captured via add_segment, or to fill fields that weren't explicitly set in conversation.",
  {},
  async () => {
    try {
      const text = await generateDraft();
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

// ── Log ────────────────────────────────────────────────────────────────────

server.tool(
  "log_decision",
  "Finalize the decision as an immutable record. Call this when all required fields are filled and the user has confirmed they're ready to log. Clears the active decision context so the session is ready for the next decision.",
  {
    method: z
      .enum(["consensus", "vote", "authority", "defer", "reject", "manual", "ai_assisted"])
      .describe("How the decision was reached"),
    loggedBy: z.string().describe("Name of the person logging the decision"),
    details: z.string().optional().describe("Additional context about how the decision was made"),
  },
  async (args) => {
    try {
      const text = await logDecision(args);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${String(e)}` }], isError: true };
    }
  },
);

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
await hydrateFromApi();
