# Expert System Architecture - Hybrid Approach

**Status**: authoritative
**Owns**: expert-system scope, expert data model, MCP integration detail, expert/MCP API and CLI surface
**Must sync with**: `packages/schema`, `docs/OVERVIEW.md`, `docs/plans/iterative-implementation-plan.md`

> **Implementation Note (see `docs/plans/iterative-implementation-plan.md` M5-M7)**:
> The expert system is implemented in stages.
> - **M5**: API endpoints for experts and MCP servers are created as stubs.
> - **M6**: The first expert, the "Decision Detector," is implemented.
> - **M7+**: The full custom expert and MCP framework is built out.
> This document describes the final architecture. Refer to the iterative plan for the specific implementation sequence.

## Overview

The system supports two types of experts:

1. **Core Experts** - Baked into the application, always available
2. **Custom Experts** - User-defined, stored in database, fully configurable

Exact domain shapes and implemented route contracts must follow `packages/schema` and the implemented API/core layers.

Inline interfaces and code sketches in this document are illustrative architecture examples, not a second canonical schema source.

If this architecture depends on schema or API changes that are not yet canonical, those changes should be referenced through the relevant documents in `docs/plans/`.

## MCP Integration with Configurable Experts

### MCP Server Registry

Each MCP server should be treated as a registry-backed integration point with:

- stable identity
- server type and connection configuration
- discoverable tools and resources
- lifecycle status

Exact MCP registry structure remains planning-owned until it exists canonically in `packages/schema`.

See `docs/plans/iterative-implementation-plan.md` for preserved future registry/detail notes.

### Expert MCP Access Configuration

Experts should be able to declare which MCP servers they can use, and may later support finer restrictions such as allowed tools, allowed resources, and structured-output configuration.

Exact expert-template structure remains canonical only when defined in `packages/schema`.

Planning-level future detail is preserved in `docs/plans/iterative-implementation-plan.md`.

### How MCP Works with Custom Experts (Vercel AI SDK)

#### 1. Expert Execution with Tools

Using the Vercel AI SDK `generateObject` or `generateText` with dynamic tools:

```typescript
// packages/core/src/services/expert.service.ts
import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

async function executeExpert(
  expertId: string,
  decisionContext: DecisionContext
) {
  const expert = await getExpertTemplate(expertId);
  const mcpClients = await getMCPClients(expert.mcpAccess.servers);
  
  // Convert MCP tools to Vercel AI SDK tools
  const tools = mcpClients.flatMap(client => 
    client.getTools().map(mcpTool => tool({
      description: mcpTool.description,
      parameters: mcpTool.inputSchema,
      execute: async (args) => client.executeTool(mcpTool.name, args)
    }))
  );

  const { text } = await generateText({
    model: anthropic('claude-3-5-sonnet-latest'),
    system: buildSystemPrompt(expert.promptTemplate, decisionContext),
    prompt: `Analyze this decision context and provide expert advice.`,
    tools: Object.fromEntries(tools.map(t => [t.name, t]))
  });
  
  return text;
}
```

#### 3. MCP Tool Discovery

Custom experts should be able to discover available MCP servers, tools, and resources through a registry/discovery surface.

This allows users to:
- See what MCP capabilities are available
- Configure custom experts to use specific tools
- Test MCP access before creating experts

## Persistence ownership

Expert-system persistence should support at least:

- expert template records
- MCP server registry records
- expert advice history with enough auditability to understand what context was consulted and which MCP tools were used

Exact persistence structure belongs in `packages/schema` and `packages/db` once canonical.

Future persistence direction is preserved in `docs/plans/iterative-implementation-plan.md`.

## Core Experts (Baked In)

Core experts are defined in code and automatically seeded on first run:

```typescript
// src/core/experts/core-experts.ts
export const CORE_EXPERTS: ExpertTemplate[] = [
  {
    id: 'policy-compliance',
    name: 'policy-compliance',
    displayName: 'Policy Compliance Expert',
    type: 'core',
    description: 'Ensures decisions align with organizational policies',
    promptTemplate: `You are a policy compliance expert...
{decision_context}
{draft_fields}

Check alignment with policies via MCP tools.`,
    mcpAccess: {
      servers: ['policy-database'],
      allowedTools: ['search_policies', 'get_policy'],
    },
    outputSchema: z.object({
      advice: z.string(),
      concerns: z.array(z.string()),
      recommendations: z.array(z.string()),
      relatedPolicies: z.array(z.any())
    }),
    isActive: true,
    createdAt: new Date(),
  },
  // ... other core experts
];
```

## Custom Expert Creation

### API ownership

Custom expert creation/update/deletion, consultation, and test flows are valid parts of the planned expert API surface.

Exact route contracts should be treated as planning-owned until implemented canonically.

See:

- `docs/plans/iterative-implementation-plan.md`
- `packages/schema`

## MCP Configuration for Custom Experts

### Scenario 1: Custom Expert with Existing MCP Servers

User creates a "Legal Compliance Expert" using existing policy database:

```bash
decision-logger expert create legal-compliance \
  --display-name "Legal Compliance Expert" \
  --description "Reviews legal requirements and liability" \
  --mcp-servers "policy-database" \
  --mcp-tools "search_policies,get_policy" \
  --prompt-file ./prompts/legal-expert.txt
```

The system:
1. Validates MCP servers exist
2. Validates tools are available on those servers
3. Stores expert configuration
4. Expert can now use those MCP tools

### Scenario 2: Custom Expert with New MCP Server

User wants to create "Vendor Selection Expert" with access to vendor database:

**Step 1: Register new MCP server**
```bash
decision-logger mcp register vendor-database \
  --type postgresql \
  --connection "postgresql://localhost/vendors" \
  --tools-config ./mcp/vendor-tools.json
```

**Step 2: Create expert using new server**
```bash
decision-logger expert create vendor-selection \
  --display-name "Vendor Selection Expert" \
  --mcp-servers "vendor-database,decision-archive" \
  --prompt-file ./prompts/vendor-expert.txt
```

### Scenario 3: Restricting MCP Access

Experts may later support restricted MCP access by limiting which servers, tools, or resources they can use.

This expert can:
- ✅ Search policies (but only financial ones via resource filter)
- ✅ Get budget tracking data
- ❌ Cannot get full policy details (get_policy not allowed)
- ❌ Cannot access non-financial policies

## Prompt Template Variables

Custom experts can use these variables in prompts:

```
{decision_context}      - Decision title and summary
{draft_fields}          - Current field values
{meeting_title}         - Meeting title
{meeting_date}          - Meeting date
{meeting_participants}  - List of participants
{template_name}         - Template being used
{focus_area}            - Optional focus area from request
{source_segments}       - Relevant transcript segments
```

Example custom prompt:

```
You are a {focus_area} expert for housing cooperatives.

Meeting: {meeting_title} on {meeting_date}
Participants: {meeting_participants}

Decision being considered:
{decision_context}

Current draft:
{draft_fields}

Your task:
1. Analyze this decision from a {focus_area} perspective
2. Use MCP tools to access relevant historical data
3. Provide specific, actionable recommendations

Focus particularly on: {focus_area}
```

## MCP Server Management

### Registering MCP Servers

MCP server registration should capture enough information to connect to the server, understand its capabilities, and make those capabilities available for discovery and expert access control.

### MCP Server Types

MCP server registrations may eventually support different backing integration types such as database-backed servers and HTTP-backed servers.

The important architectural requirement is that server type differences remain hidden behind one discovery and execution model for experts.

## Security & Permissions

### MCP Access Control

MCP access control may later include expert allowlists, rate limiting, and audit requirements.

### Expert Permissions

Expert permissions may later include ownership/edit rights and context-specific usage restrictions.

Those details remain planning-level until they are defined canonically.

## CLI Commands

The CLI surface should cover:

- expert discovery and inspection
- expert creation/update/deletion where supported
- expert consultation/testing flows
- MCP server discovery, registration, testing, and capability inspection where implemented

Exact CLI command surfaces remain planning-owned until implemented canonically.


## Benefits of Hybrid Approach

✅ **Core experts always available** - Reliable, tested, maintained  
✅ **Extensible** - Users can create domain-specific experts  
✅ **Flexible MCP access** - Custom experts can use any registered MCP server  
✅ **Secure** - Fine-grained control over MCP access per expert  
✅ **Auditable** - Track which MCP tools each expert uses  
✅ **Testable** - Test custom experts before deploying  
✅ **Shareable** - Export/import custom expert configurations  

## Example: Creating a Custom Expert

Typical workflow:

1. Discover available MCP servers and capabilities.
2. Create or configure a custom expert with access to the relevant servers.
3. Test the expert against a decision context.
4. Use the expert as part of the normal decision-refinement workflow.

For milestone-specific command and route detail, see `docs/plans/iterative-implementation-plan.md`.
