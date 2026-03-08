# UI/UX Overview

**Status**: authoritative
**Owns**: page-level UX goals, core user journeys, display-mode rules (projection vs facilitator), uncluttered meeting-first interaction principles
**Must sync with**: `docs/OVERVIEW.md`, `docs/transcript-reading-and-segment-selection-architecture.md`, `docs/manual-decision-workflow.md`, `docs/decision-detection-implementation-reference.md`, `docs/plans/iterative-implementation-plan.md`

## Purpose

Maintain a text-first, durable description of the UI/UX so implementation stays aligned with meeting realities and does not drift into cluttered, developer-only screens.

## Primary Product UX Goal (v1)

Provide a simple, presentable interface for larger meetings that is easy to project and easy to follow.

Required characteristics:
- High readability at distance (large text, strong contrast, minimal visual noise).
- Clear next action per screen.
- Transcript details hidden unless the user is explicitly selecting evidence.
- Candidate/agenda workflow visible without exposing low-value technical details.

## UX Modes

### 1. Shared Display Mode (default)

Audience-facing meeting view.

Rules:
- Keep screens uncluttered and action-oriented.
- Hide implementation details (IDs, verbose metadata, raw chunk overlap text).
- Prefer compact confidence/status indicators over dense numeric blocks.
- Keep candidate list and agenda status highly visible.

### 2. Facilitator Mode (planned extension)

Operator-focused view for detailed triage and control.

Rules:
- Can expose advanced controls (exact segment links, provenance, thresholds, detailed diagnostics).
- Should not be required for normal participant-facing flow.
- May be a separate screen/app route or split-pane mode.

## Core UX Principles

1. Candidate-first workflow: meetings revolve around candidate queue and agenda order.
2. Decision contexts are long-lived: they persist across meetings until closed.
3. Meeting context is local: meeting agenda selects open contexts; it does not own context lifecycle.
4. Human confirmation gate: AI can suggest, humans confirm before promotion/finalization.
5. Reading-first evidence selection: transcript appears in reading mode for segment selection tasks only.
6. Recoverability: users can always return to flagged list and see newly detected items.

## Page Catalog: Goals And Key Stories

### 1) Meeting Setup / Overview

Primary goal:
- Start and manage a meeting session with clear metadata and participant state.

Key user stories:
- As a facilitator, I can create/open a meeting and set its name/date.
- As a facilitator, I can add/update participants as people join/leave.
- As a facilitator, I can start transcript upload or live stream ingestion.
- As a facilitator, I can see agenda contexts and suggested candidates separately.

### 2) Flagged List + Agenda Screen (default landing during meetings)

Primary goal:
- Keep decision work organized by separating `agenda` from `suggested/new flags`.

Key user stories:
- As a participant, I can see what is already on the agenda vs newly suggested.
- As a facilitator, I can return to flagged list from any workflow screen.
- As a facilitator, I can detect and see “new flags” without losing current work.
- As a facilitator, I can insert a candidate/context into a chosen agenda position (not just append).

### 3) Candidate Review / Context Linking

Primary goal:
- Review one candidate, refine its instruction text, and decide whether to link/create a decision context.

Key user stories:
- As a facilitator, I can edit candidate title/summary before draft generation.
- As a facilitator, I can search open contexts from other meetings and link one.
- As a facilitator, I can create a new context when no existing one fits.
- As a facilitator, I can add a linked open context to this meeting’s agenda.

### 4) Segment Selection (Reading Mode)

Primary goal:
- Select evidence quickly and accurately in long transcripts with minimal visual overload.

Key user stories:
- As a facilitator, I can drag-select multiple rows with mouse/touch.
- As a facilitator, I can filter by text and sequence range.
- As a facilitator, I can default to current meeting transcript and optionally include other meetings.
- As a facilitator, I can handle unknown speakers without broken UI.
- As a facilitator, I can keep overlap mostly hidden, with optional compact indicators.

### 5) Template Selection + Initial Draft Generation

Primary goal:
- Promote candidate/context into a structured draft with template-aware generation.

Key user stories:
- As a facilitator, I must pick a template before generating the initial draft.
- As a facilitator, I can start from detector-suggested template and override it.
- As a facilitator, I can use candidate summary as generation instruction seed.
- As a facilitator, I can run generation without losing selected evidence links.

### 6) Decision Workspace (Full Decision View)

Primary goal:
- Iterate on a complete draft while preserving control over stable content.

Key user stories:
- As a facilitator, I can scroll full decision content.
- As a facilitator, I can lock fields and regenerate unlocked fields.
- As a facilitator, I can add more transcript context while staying in decision view.
- As a facilitator, I can keep working on an open context across future meetings.

### 7) Field Focus View

Primary goal:
- Deep edit/regenerate one field with local version control.

Key user stories:
- As a facilitator, I can zoom into one field and edit it directly.
- As a facilitator, I can regenerate only this field if unlocked.
- As a facilitator, I can move between field versions and restore one.

### 8) Finalization + Export

Primary goal:
- Capture final agreement state and export cleanly.

Key user stories:
- As a facilitator, I can mark decision complete with agreement notes and timestamp.
- As a facilitator, I can leave a decision incomplete and resume later.
- As a facilitator, I can export only active template fields (hidden fields excluded).

## Facilitator Interface Direction

The shared display should stay simple even if operator controls grow. To avoid clutter:
- Keep participant-facing screens minimal by default.
- Move advanced controls into facilitator mode as they appear.
- Preserve the same underlying workflows and APIs for both modes.

Potential split strategies:
- Single app with mode toggle (`shared` / `facilitator`).
- Separate facilitator route using same backend contracts.
- Dual-screen setup where shared screen is read-only projection and facilitator screen is control surface.

## Alignment With API/CLI

UI behavior must map cleanly to API/CLI workflows:
- Candidate queue and agenda ordering semantics must match API/CLI commands.
- Reading mode filters and sequence semantics must be consistent across UI/API/CLI.
- Promotion, locking, regeneration, and completion states must be represented identically in all interfaces.

## Maintenance Rules

- Update this document when adding/removing screens or changing primary user flow.
- Each new screen must include:
  - one primary goal
  - key user stories
  - mode implications (shared display vs facilitator)
- If a workflow becomes too dense for shared display, document its move to facilitator mode here and in iterative planning.
