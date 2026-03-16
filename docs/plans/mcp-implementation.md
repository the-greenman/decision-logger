# Plan: MCP Server for Claude Code Integration (TDD)

**Status**: active
**Branch**: `feature/mcp-decision-integration`
**Related docs**: `docs/mcp-server.md`, `docs/mcp-architecture-strategy.md`, `docs/transcript-context-management.md`

---

## Goal

Build `apps/mcp/` — an MCP server that exposes the decision-logger workflow as Claude Code tools, enabling a conversation in Claude Code to participate in and produce the same structured decision records as any other meeting.

---

## Acceptance Criteria

- `start_session` creates a meeting and returns a meeting ID held in server session state
- `add_segment` pushes conversation text to the streaming transcript endpoint with correct context tags
- `flag_decision` creates a `FlaggedDecision` record scoped to the active meeting
- `list_templates` returns the available decision templates
- `create_context` creates a `DecisionContext` and records the context ID in session state
- `get_fields` returns template fields with current values and lock status
- `get_draft` returns the full current draft
- `set_field` sets a single field value via `PATCH /api/decision-contexts/:id/fields/:fieldId`
- `lock_field` locks a field via the existing lock endpoint
- `generate_draft` triggers LLM draft generation and returns updated fields
- `log_decision` finalizes the decision and returns a log ID
- All tools fail gracefully (non-throwing, human-readable error text) when the API is unreachable
- The server starts via stdio transport and registers correctly with Claude Code

---

## TDD Execution Strategy

Work in vertical slices. For each slice:
1. Write a failing test that captures the desired behavior
2. Implement the smallest change that makes the test pass
3. Refactor only after the test is green
4. Keep the server runnable after every slice

Slices are ordered by dependency: client first, tools second, server wiring last.

---

## Slice 0 — Documentation

### Test intent
No code test required.

### Work
- `docs/mcp-server.md` — evergreen reference ✓
- This plan ✓

### Done when
- Reference doc and plan exist; tool interface is stable enough to implement against

---

## Slice 1 — App Scaffold

### Test intent
```
GIVEN: apps/mcp/package.json exists
WHEN: pnpm build runs from the monorepo root
THEN: apps/mcp/dist/index.js is produced with no type errors
```

### Work

**`apps/mcp/package.json`**
```json
{
  "name": "@repo/mcp",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.11.0"
  }
}
```

**`apps/mcp/tsconfig.json`** — extends `../../tsconfig.base.json`, outDir `./dist`, includes `src/**/*.ts`

**`apps/mcp/src/index.ts`** — minimal stub that starts a stdio MCP server (no tools yet)

**`turbo.json`** — add `@repo/mcp#build` to the build pipeline

### Done when
```bash
pnpm --filter @repo/mcp build  # exits 0
node apps/mcp/dist/index.js    # starts without crashing
```

---

## Slice 2 — HTTP Client

### Test intent
```
GIVEN: DECISION_LOGGER_API_URL=http://localhost:3001
WHEN: client.get("/api/status") is called and the API is running
THEN: returns the parsed JSON response

WHEN: the API is unreachable
THEN: throws an error with a human-readable message (not a network stack trace)
```

### Work

**`apps/mcp/src/client.ts`**

Identical pattern to `apps/cli/src/client.ts`:
- `BASE_URL` from `process.env.DECISION_LOGGER_API_URL ?? "http://localhost:3001"`
- `request<T>(method, path, body?)` — fetch + JSON parse, throws `Error` with `payload.error` on non-OK
- `api = { get, post, put, patch, delete }`

No tests written for the client directly — it's validated by the tool integration tests below.

### Done when
Client module compiles; used by all tool slices below.

---

## Slice 3 — Session Tools (`start_session`, `get_session`)

### Test intent (manual integration test)
```
GIVEN: API is running, no active session
WHEN: start_session is called with { title: "Test session" }
THEN: a meeting is created in the DB (visible in dlogger meeting list)
AND:  the returned meetingId is stored in server session state

WHEN: get_session is called immediately after
THEN: returns { meetingId: <the-id>, contextId: null, status: "active" }
```

### Work

**`apps/mcp/src/session.ts`** — module-level state:
```typescript
let activeMeetingId: string | undefined;
let activeFlaggedDecisionId: string | undefined;
let activeContextId: string | undefined;
let turnCount = 0;

export function getSessionState() { ... }
export function setMeeting(id: string) { ... }
export function setFlaggedDecision(id: string) { ... }
export function setContext(id: string) { ... }
export function incrementTurn() { ... }
export function clearSession() { ... }
```

**`apps/mcp/src/tools/session.ts`** — tool definitions:

`start_session`:
- Calls `POST /api/meetings` with `{ title, participants, date: new Date().toISOString() }`
- Calls `setMeeting(result.id)` on success
- Returns formatted string: `Session started. Meeting ID: ${id}. Topic: ${title}`

`get_session`:
- Reads from `getSessionState()`
- Returns formatted string of current state

### Register tools in `src/index.ts`

### Done when
```bash
# Run manually in Claude Code after `claude mcp add`
# Call start_session → meeting appears in: dlogger meeting list
# Call get_session → returns correct meeting ID
```

---

## Slice 4 — Transcript Tool (`add_segment`)

### Test intent (manual integration test)
```
GIVEN: active meeting session
WHEN: add_segment is called with { text: "We should pick PostgreSQL", speaker: "User" }
THEN: POST /api/meetings/:id/transcripts/stream is called with correct body
AND:  contexts array includes ["meeting:<id>"] (or ["meeting:<id>", "decision:<id>"] if decision is active)
AND:  incrementTurn() is called
```

### Work

**`apps/mcp/src/tools/transcript.ts`**:

`add_segment`:
- Requires active meeting (error if none)
- Builds `contexts` from session state:
  - Always includes `meeting:<meetingId>`
  - If `activeFlaggedDecisionId` is set: also `decision:<flaggedDecisionId>`
  - If `activeContextId` and `fieldId` param provided: also `decision:<flaggedDecisionId>:<fieldId>`
- Posts to `POST /api/meetings/:meetingId/transcripts/stream`
- Calls `incrementTurn()`
- Returns `Segment logged (turn ${turnCount})`

**`add_segment` input schema:**
```typescript
z.object({
  text: z.string().describe("Conversation text to log"),
  speaker: z.string().default("User").describe("'User' or 'Claude'"),
  fieldId: z.string().optional().describe("If discussing a specific field, pass its ID for fine-grained context tagging"),
})
```

### Done when
```bash
# After start_session, call add_segment
# Verify: dlogger transcript read --meeting-id <id> shows the segment
```

---

## Slice 5 — Decision Tools (`flag_decision`, `list_templates`, `create_context`)

### Test intent (manual integration test)
```
GIVEN: active meeting session
WHEN: flag_decision is called with { title: "Use PostgreSQL for storage", confidence: 0.9 }
THEN: POST /api/meetings/:id/flagged-decisions creates the record
AND:  activeFlaggedDecisionId is set in session state

WHEN: list_templates is called
THEN: returns a readable list of templates with names and IDs

WHEN: create_context is called with { templateId: "<technology-selection-id>" }
THEN: POST /api/decision-contexts creates the context linked to the flagged decision
AND:  activeContextId is set in session state
AND:  returns field summary so Claude knows what to fill
```

### Work

**`apps/mcp/src/tools/decisions.ts`**:

`flag_decision`:
- Requires active meeting
- Posts to `POST /api/meetings/:meetingId/flagged-decisions` with `{ suggestedTitle, contextSummary, confidence, priority: 3 }`
- Calls `setFlaggedDecision(result.id)`
- Returns `Decision flagged: "${title}" (ID: ${id})`

`list_templates`:
- Gets `GET /api/templates`
- Formats as readable list: `1. Technology Selection (11 fields) — Choosing tools, frameworks, platforms`

`create_context`:
- Requires active meeting and active flagged decision
- Posts to `POST /api/decision-contexts` with `{ flaggedDecisionId, templateId, meetingId }`
- Calls `setContext(result.id)`
- Fetches `GET /api/templates/:templateId/fields`
- Returns context ID + numbered field list

### Done when
```bash
# flag_decision → dlogger decisions list shows the flagged decision
# create_context → dlogger draft show -c <contextId> shows empty draft
```

---

## Slice 6 — Field Tools (`get_fields`, `get_draft`, `set_field`, `lock_field`, `generate_draft`)

### Test intent (manual integration test)
```
GIVEN: active context with Technology Selection template
WHEN: get_fields is called
THEN: returns all 11 fields with name, description, required flag, current value (empty), locked status

WHEN: set_field is called with { fieldId: "<problem-statement-id>", value: "We need semantic search on decisions" }
THEN: PATCH /api/decision-contexts/:id/fields/:fieldId updates the field
AND:  get_draft shows the updated value

WHEN: lock_field is called with the same fieldId
THEN: PUT /api/decision-contexts/:id/lock-field locks it
AND:  get_draft shows the field as [LOCKED]

WHEN: generate_draft is called
THEN: POST /api/decision-contexts/:id/generate-draft runs LLM extraction
AND:  unlocked fields are filled from transcript; locked field is unchanged
```

### Work

**`apps/mcp/src/tools/fields.ts`**:

`get_fields`:
- Requires active context + meeting → fetches template ID from `GET /api/decision-contexts/:id`
- Then `GET /api/templates/:templateId/fields`
- Also fetches current draft from `GET /api/decision-contexts/:id`
- Merges: for each field, show name, description, required, current value, locked status

`get_draft`:
- `GET /api/decision-contexts/:id`
- Formats as `fieldName: value [LOCKED]` list

`set_field`:
- `PATCH /api/decision-contexts/:contextId/fields/:fieldId` with `{ value }`
- Returns `Field "${fieldName}" set`

`lock_field`:
- `PUT /api/decision-contexts/:contextId/lock-field` with `{ fieldId }`
- Returns `Field "${fieldName}" locked`

`generate_draft`:
- `POST /api/decision-contexts/:contextId/generate-draft`
- Returns updated field list showing newly filled values

### Done when
```bash
# set_field + lock_field → dlogger draft show reflects changes + locks
# generate_draft → remaining unlocked fields are filled
```

---

## Slice 7 — Log Tool (`log_decision`)

### Test intent (manual integration test)
```
GIVEN: active context with required fields filled
WHEN: log_decision is called with { method: "consensus", loggedBy: "greenman" }
THEN: POST /api/decision-contexts/:id/log creates the immutable record
AND:  returns the log ID
AND:  dlogger draft export <logId> produces a valid markdown document
```

### Work

**`apps/mcp/src/tools/log.ts`**:

`log_decision`:
- Requires active context
- Posts to `POST /api/decision-contexts/:contextId/log` with `{ loggedBy, decisionMethod: { type: method, details } }`
- On success: clears `activeContextId` and `activeFlaggedDecisionId` from session state (ready for next decision)
- Returns `✓ Decision logged. Log ID: ${id}. Export: dlogger draft export ${id}`

### Done when
```bash
# log_decision → dlogger draft export <id> produces markdown
# Session state cleared; ready for next flag_decision
```

---

## Slice 8 — Server Wiring

### Test intent
```
GIVEN: all tool files exist
WHEN: apps/mcp/src/index.ts is compiled and run
THEN: stdio MCP server starts
AND:  claude mcp add registers it successfully
AND:  /mcp in Claude Code shows all 11 tools
```

### Work

**`apps/mcp/src/index.ts`**:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "decision-logger", version: "1.0.0" });

// Register all tools
server.tool("start_session", startSessionSchema, startSessionHandler);
server.tool("get_session", getSessionSchema, getSessionHandler);
server.tool("add_segment", addSegmentSchema, addSegmentHandler);
// ... etc

const transport = new StdioServerTransport();
await server.connect(transport);
```

Each tool handler returns `{ content: [{ type: "text", text: "..." }] }`.

### Done when
```bash
pnpm --filter @repo/mcp build
claude mcp add decision-logger node \
  /home/greenman/dev/decision-logger/apps/mcp/dist/index.js \
  --env DECISION_LOGGER_API_URL=http://localhost:3001

# In a new Claude Code session: /mcp → shows decision-logger with 11 tools
```

---

## Slice 9 — End-to-End Smoke Test

### Test intent
Run a complete decision session end-to-end in Claude Code:

1. Start a session with `start_session`
2. Add several conversation segments with `add_segment`
3. Flag a decision with `flag_decision`
4. List and select a template
5. Create context with `create_context`
6. Fill fields with `set_field` + lock with `lock_field`
7. Log with `log_decision`
8. Export with `dlogger draft export <id>`

### Done when
- The exported markdown document is complete and well-formed
- `dlogger meeting list` shows the session meeting
- `dlogger decisions list` shows the flagged decision
- The decision log contains the conversation transcript as source context

---

## Build and Validation Commands

```bash
# After each slice
pnpm --filter @repo/mcp build
pnpm type-check

# After Slice 8
claude mcp add decision-logger node \
  /home/greenman/dev/decision-logger/apps/mcp/dist/index.js \
  --env DECISION_LOGGER_API_URL=http://localhost:3001

# Full system check
pnpm build
pnpm type-check
pnpm lint:workspace
```

---

## API Endpoints Used (Quick Reference)

| Tool | Method | Path |
|------|--------|------|
| start_session | POST | `/api/meetings` |
| get_session | GET | `/api/context` |
| add_segment | POST | `/api/meetings/:id/transcripts/stream` |
| flag_decision | POST | `/api/meetings/:id/flagged-decisions` |
| list_templates | GET | `/api/templates` |
| create_context | POST | `/api/decision-contexts` |
| get_fields | GET | `/api/templates/:id/fields` + `/api/decision-contexts/:id` |
| get_draft | GET | `/api/decision-contexts/:id` |
| set_field | PATCH | `/api/decision-contexts/:id/fields/:fieldId` |
| lock_field | PUT | `/api/decision-contexts/:id/lock-field` |
| generate_draft | POST | `/api/decision-contexts/:id/generate-draft` |
| log_decision | POST | `/api/decision-contexts/:id/log` |
