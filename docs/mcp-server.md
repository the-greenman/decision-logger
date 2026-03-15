# Decision Logger MCP Server

**Status**: authoritative
**Owns**: MCP server design, tool interface, Claude Code integration pattern
**Must sync with**: `docs/mcp-architecture-strategy.md`, `docs/transcript-context-management.md`

---

## What It Is

The MCP server exposes the decision-logger workflow as tools that Claude Code can call during a conversation. This makes Claude a first-class participant in the decision process — not just a coding assistant, but a deliberation partner whose conversations become part of the permanent decision record.

The key insight: **the conversation IS the transcript**. Every exchange between you and Claude is streamed to the decision-logger via the standard streaming transcript endpoint, tagged with the appropriate meeting/decision context. When a decision is logged, it carries the full conversation that led to it as its source material.

---

## Architecture

The MCP server (`apps/mcp/`) is a thin REST wrapper over the existing API, following the same pattern as the CLI:

```
Claude Code (MCP client)
  ↓ MCP protocol (stdio)
apps/mcp/src/index.ts
  ↓ HTTP fetch
apps/api (Hono REST API, port 3001)
  ↓ @repo/core services
  ↓ @repo/db (Drizzle ORM)
  ↓ PostgreSQL
```

This means:
- The API server must be running (`pnpm dev --filter=apps/api`)
- All business logic stays in `@repo/core` — the MCP server adds no logic
- Consistent with how the CLI works

---

## Setup

### 1. Build the MCP server

```bash
pnpm --filter @repo/mcp build
```

### 2. Register with Claude Code

```bash
claude mcp add decision-logger \
  node /home/greenman/dev/decision-logger/apps/mcp/dist/index.js \
  --env DECISION_LOGGER_API_URL=http://localhost:3001
```

Or add manually to `~/.claude.json`:

```json
{
  "mcpServers": {
    "decision-logger": {
      "command": "node",
      "args": ["/home/greenman/dev/decision-logger/apps/mcp/dist/index.js"],
      "env": {
        "DECISION_LOGGER_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 3. Start the API server

```bash
pnpm dev --filter=apps/api
```

### 4. Verify tools are available

In Claude Code: `/mcp` → should show `decision-logger` with all tools listed.

---

## Available Tools

### Session Management

#### `start_session`
Creates a meeting record that anchors this conversation. Call once at the start of a session where decisions may be made, or when a decision topic first surfaces.

**Input:**
```json
{
  "title": "string — topic or purpose of this conversation",
  "participants": ["string"] — optional, defaults to ["User", "Claude"]
}
```

**Output:** `{ meetingId: string, title: string }`

The `meetingId` is stored in the MCP server's session state and used automatically by all subsequent tool calls.

---

#### `get_session`
Returns the current active session state — meeting ID, active decision context, turn count.

**Input:** none

**Output:** `{ meetingId?, contextId?, turnCount, status }`

---

### Decision Workflow

#### `flag_decision`
Records that a decision topic has been identified in the conversation. Call this proactively when a decision is surfacing — don't wait to be asked.

**Input:**
```json
{
  "title": "string — concise decision statement",
  "contextSummary": "string — what led to this, what's being decided",
  "confidence": "number (0–1) — how certain this is a decision vs exploration"
}
```

**Output:** `{ flaggedDecisionId: string, title: string }`

---

#### `list_templates`
Returns available decision templates. Use this to suggest an appropriate template when a decision is flagged.

**Input:** none

**Output:** Array of `{ id, name, category, description, fieldCount }`

**Templates available:**
- Technology Selection (11 fields)
- Budget Approval (10 fields)
- Strategy Decision (9 fields)
- Standard Decision (10 fields)
- Policy Change (8 fields)
- Proposal Acceptance (7 fields)

---

#### `create_context`
Creates a draft workspace for a flagged decision using a selected template. This starts the field-filling process.

**Input:**
```json
{
  "flaggedDecisionId": "string",
  "templateId": "string"
}
```

**Output:** `{ contextId: string, templateId: string, fields: FieldSummary[] }`

The `contextId` is stored in session state and used by subsequent field tools.

---

### Field Workflow

#### `get_fields`
Returns the template fields with their current status (empty, filled, locked).

**Input:** none (uses active context)

**Output:** Array of `{ fieldId, name, description, required, value?, locked }`

Use this to understand what still needs to be discussed.

---

#### `get_draft`
Returns the full current draft — all field values and which are locked.

**Input:** none (uses active context)

**Output:** `{ contextId, fields: Record<fieldId, value>, lockedFields: string[] }`

---

#### `set_field`
Sets a field value based on what was discussed. Call this as soon as a field's value is clear from the conversation — don't batch fields together.

**Input:**
```json
{
  "fieldId": "string",
  "value": "any — the field value"
}
```

**Output:** `{ fieldId, value, contextId }`

---

#### `lock_field`
Locks a field to prevent it from being overwritten by `generate_draft`. Use this when the user has confirmed a value is correct.

**Input:**
```json
{
  "fieldId": "string"
}
```

**Output:** `{ fieldId, locked: true }`

---

#### `generate_draft`
Runs the LLM draft generation against all accumulated transcript chunks to fill remaining unlocked fields. Use this after sufficient transcript context has been captured.

**Input:** none (uses active context)

**Output:** Updated draft with newly-filled fields.

---

### Transcript

#### `add_segment`
Pushes a conversation turn to the streaming transcript. **Call this for every substantive exchange** — both user turns and Claude turns. This is what makes the conversation retrievable as source context for the decision record.

Context tags escalate as focus narrows:
- Before a decision is flagged: `["meeting:<meetingId>"]`
- After flagging: `["meeting:<meetingId>", "decision:<flaggedDecisionId>"]`
- While discussing a specific field: `["meeting:<meetingId>", "decision:<flaggedDecisionId>", "decision:<flaggedDecisionId>:<fieldId>"]`

**Input:**
```json
{
  "text": "string — the conversation text",
  "speaker": "string — 'User' or 'Claude'",
  "contexts": ["string"] — optional, auto-populated from session state
}
```

**Output:** `{ buffered: true, eventCount: number }`

---

### Logging

#### `log_decision`
Finalizes the decision as an immutable record. Call this when all required fields are filled and the user has confirmed they're ready to log.

**Input:**
```json
{
  "method": "consensus | vote | authority | defer | reject | manual | ai_assisted",
  "loggedBy": "string — name of the person logging",
  "details": "string — optional additional context"
}
```

**Output:** `{ logId: string, loggedAt: string, templateId: string }`

---

## Workflow: Complete Example

```
1. Conversation starts — Claude calls start_session proactively if decision topic surfaces

2. Every exchange:
   → Claude calls add_segment for user turn (contexts: ["meeting:abc"])
   → Claude responds
   → Claude calls add_segment for own turn (contexts: ["meeting:abc"])

3. Decision surfaces:
   → Claude calls flag_decision
   → Claude calls list_templates, suggests appropriate template
   → User confirms template
   → Claude calls create_context

4. Field-by-field discussion:
   → Claude calls get_fields to see what's needed
   → For each field, Claude asks targeted question
   → When user answers, Claude calls set_field
   → add_segment called for each exchange, now tagged with decision context
   → Claude calls lock_field when user confirms a value

5. All required fields filled:
   → Claude calls get_draft to confirm state
   → Claude proposes logging
   → User confirms method + name
   → Claude calls log_decision

6. Confirmation:
   → Claude reports log ID, notes decision is permanent
   → dlogger draft export <logId> to retrieve as markdown
```

---

## Context Tagging Strategy

The transcript chunk context tags follow the pattern from `docs/transcript-context-management.md`. For MCP sessions:

| Phase | Context tags |
|-------|-------------|
| General conversation (pre-decision) | `["meeting:<id>"]` |
| Decision topic identified | `["meeting:<id>", "decision:<flaggedId>"]` |
| Discussing specific field | `["meeting:<id>", "decision:<flaggedId>", "decision:<flaggedId>:<fieldId>"]` |

Field-tagged chunks get highest priority in LLM extraction during `generate_draft`.

---

## Checking Logged Decisions

```bash
# List decisions for a meeting
dlogger decisions list

# Export a logged decision as markdown
dlogger draft export <log-id>

# Export as JSON
dlogger draft export <log-id> --format json
```

---

## Troubleshooting

**Tools not appearing in Claude Code:**
Run `claude mcp list` to verify registration. Check the node path is correct and the binary exists at `apps/mcp/dist/index.js`.

**API connection refused:**
The API server must be running. Run `pnpm dev --filter=apps/api` and verify it's listening on port 3001.

**Session state lost:**
The MCP server process holds session state in memory. If it restarts, call `start_session` again with `--meeting-id <existing-id>` to resume a session, or call `get_session` to check if state is still present.
