# Transcript Reading And Segment Selection Architecture

**Status**: authoritative
**Owns**: human-readable transcript projection, segment selection workflow, AI segment suggestion workflow, selection-to-chunk mapping rules
**Must sync with**: `docs/transcript-context-management.md`, `docs/context-tagging-strategy.md`, `docs/decision-detection-implementation-reference.md`, `docs/plans/iterative-implementation-plan.md`, `docs/v2/modular-architecture.md`

## Purpose

Define a durable architecture for selecting transcript evidence during manual and AI-assisted decision creation.

This document exists because chunk overlap improves LLM extraction quality but harms human readability during review and selection.

## Objectives

- Provide a readable transcript experience for long meetings.
- Preserve overlap-based chunking for model quality.
- Support manual and AI-assisted segment selection from the same UI flow.
- Keep API and CLI behavior aligned for the same operations.
- Preserve auditable mapping from user-visible selections to stored chunk IDs.

## Workflow Policy Decisions (Locked)

1. Candidate queue distinguishes `suggested` from `agenda` items. New suggestions must not be appended blindly at the end of the agenda.
2. Core workflow entities maintain timestamps for lifecycle visibility and auditability.
3. Template transforms must not discard field content when destination template lacks a field; such fields are hidden and excluded from export.
4. Versioning is field-centric. Template version changes move fields in/out of active view for unlocked fields only.
5. New transcript added while focused on a decision/field is explicitly context-tagged and treated as high-priority recent context for later manual regeneration.
6. Decision completion records completion notes as free text.

## Non-Goals

- Replacing existing chunking strategies.
- Removing overlap from stored chunks.
- Coupling the workflow to a single retrieval backend.

## Core Model: Two Representations

1. **Model chunks** (existing):
- Potentially overlapped chunks used for retrieval and generation.

2. **Reading projection** (new):
- De-overlapped, sequence-ordered display stream for human review.
- Represents what users read/select in UI and CLI reading mode.

Selections always originate in reading projection and are mapped to model chunks before persistence.

## Reading Projection Contract

Reading projection is a derived, human-readable view over transcript artifacts. It is not the source-of-truth storage format for model retrieval.

### Identity And Stability Invariants

- `readingRowId` must be stable for the lifetime of a reading row.
- `sequenceNumber` in reading mode must be deterministic and ordered for a given meeting.
- Reading rows are append-only for ongoing transcript ingestion. New transcript material adds new rows with higher sequence numbers; existing rows are not renumbered.
- Confirmed selections freeze their resolved chunk IDs at confirmation time for auditability, even if later transcript append operations produce additional rows or chunk relations.
- CLI and API must resolve the same reading rows to the same ordered, deduplicated chunk ID set for equivalent parameters.

### Persistence Contract

Selections must persist both the user-visible reading-row references and the storage-facing chunk references.

```typescript
type PersistedSelection = {
  meetingId: string;
  selectionRefType: 'candidate' | 'flagged_decision' | 'decision_context';
  selectionRefId: string;
  readingRowIds: string[];
  chunkIds: string[];
  selectionSource: 'manual' | 'ai_suggested' | 'hybrid';
  confirmedByUser: boolean;
};
```

In v1, confirmed persistence stores the final ordered, deduplicated chunk ID set together with the selected reading row IDs.

### API

`GET /api/meetings/:id/transcript-reading?from=<seq>&to=<seq>&q=<text>&page=<n>&pageSize=<n>`

Returns ordered reading rows:

```typescript
type TranscriptReadingRow = {
  readingRowId: string;
  meetingId: string;
  sequenceNumber: number;
  speaker?: string; // optional, may be unknown
  text: string;
  startTime?: string;
  endTime?: string;
  sourceChunkIds: string[]; // mapping back to overlapped chunks
  overlapCount: number; // number of additional chunks sharing text window
};
```

### Resolution Rules

- v1 selection granularity is whole-row only.
- Selecting multiple rows resolves to the ordered, deduplicated union of each row's `sourceChunkIds`.
- `sourceChunkIds` are provenance metadata for persistence and audit, not primary display content.
- Hidden or expanded overlap indicators must not change the selected reading rows or the resolved chunk set.

### CLI

`transcript list --reading --meeting-id <id> [--from <seq>] [--to <seq>] [--query <text>] [--page <n>] [--page-size <n>]`

CLI output must match API ordering/content for equivalent parameters.

## Selection Workflow

### Manual

1. User opens reading projection.
2. User selects rows (single, range, drag).
3. System resolves selected reading rows to `sourceChunkIds`.
4. Persist normalized segment/chunk linkage for decision candidate or manual flagged decision.

### AI-Assisted

1. User enters candidate title + summary.
2. System requests AI suggestions over meeting transcript (optionally bounded by range/query).
3. Response returns suggested reading rows/chunks with confidence.
4. UI pre-selects suggestions for user review.
5. User edits selection and confirms.
6. Persist final reviewed selection.

## Candidate Queue And Agenda Model

Candidates and decisions must support ordered meeting workflow.

```typescript
type CandidateQueueStatus = 'suggested' | 'agenda' | 'promoted' | 'dismissed';

type CandidateQueueItem = {
  candidateId: string;
  meetingId: string;
  status: CandidateQueueStatus;
  agendaOrder?: number; // required when status='agenda'
  createdAt: string;
  detectedAt?: string;
  agendaUpdatedAt?: string;
  promotedAt?: string;
  dismissedAt?: string;
};
```

Rules:
- Agenda view renders only `agenda` items in `agendaOrder`.
- Suggested candidates remain separately visible and can be inserted into agenda at a chosen position.
- Promoted/dismissed candidates leave the agenda ordering surface but remain auditable.

## Append And Update Rules

- Ongoing transcript ingestion may append new reading rows, but must not rewrite previously confirmed selection mappings.
- AI suggestion requests may optionally operate over the full meeting, a bounded sequence range, or a query-filtered subset.
- Updating one decision's saved selection must not remove row/chunk linkages used by another decision or candidate.

## AI Segment Suggestion Contract

### API

`POST /api/meetings/:id/segment-suggestions`

Request:

```typescript
type SegmentSuggestionRequest = {
  title: string;
  summary: string;
  fromSequenceNumber?: number;
  toSequenceNumber?: number;
  query?: string;
  limit?: number; // default 25
  minConfidence?: number; // default 0.5
};
```

Response:

```typescript
type SegmentSuggestion = {
  readingRowIds: string[];
  startSequenceNumber: number;
  endSequenceNumber: number;
  sourceChunkIds: string[];
  confidence: number;
  reason: string;
};

type SegmentSuggestionResponse = {
  suggestions: SegmentSuggestion[];
  model: string;
  threshold: number;
};
```

### CLI

`decisions suggest-segments --meeting-id <id> --title <text> --summary <text> [--from <seq>] [--to <seq>] [--limit <n>]`

Single-row suggestions are represented as a one-element `readingRowIds` list with identical `startSequenceNumber` and `endSequenceNumber`.

## Overlap Handling Rules

- Reading mode must not duplicate overlapping text blocks.
- Overlap is metadata, not primary content.
- UI default: hide overlap details; optional compact icon/count.
- Selection must remain stable even when overlap metadata is hidden.
- A chunk/row can be linked to multiple decisions; never remove another decision's linkage on update/dismiss.

## Decision Workspace Policies

### Field-Centric Versioning

- Field edits/regenerations create field-level versions.
- Users can move between versions per field and restore an earlier version.
- Full-draft regenerate updates only unlocked fields.

### Template Transform Behavior

- Switching template updates active field set.
- Unlocked fields not present in new template are hidden, not deleted.
- Hidden fields are excluded from export while inactive.
- Locked fields remain fixed during template changes and regeneration.

### Recency Weighting For New Context

- Transcript added in decision or field context is tagged accordingly (`decision:<id>` and optional `decision:<id>:<field>`).
- Newer tagged segments receive higher retrieval weight.
- Regeneration remains manual-triggered; no automatic rewrite on ingest.

### Completion Metadata

- Completing a decision records:
  - completion timestamp
  - completion notes text (how agreement was reached)
- Decision can remain incomplete and be resumed later without data loss.

## Separation Of Concerns

This architecture intentionally separates transcript reading/selection from expert inference and decision detection.

- Transcript reading and selection own the human-readable projection, manual selection UX, selection persistence shape, and row-to-chunk mapping.
- AI segment suggestion owns proposing relevant reading rows for a user-supplied title/summary, but it does not create decision candidates automatically.
- Decision Detection owns meeting-wide candidate discovery, candidate persistence, revisit linking, and promotion/dismissal lifecycle.
- Expert consultation owns domain advice and structured inference infrastructure; it may power suggestion or detection flows, but it does not own transcript projection semantics.

### Relationship To Experts And Decision Detection

- `segment-suggestions` is decision-creation assistance scoped to a user-provided title/summary and always requires human confirmation before persistence.
- Decision detection scans the meeting transcript for possible decisions, creates candidate records, and manages candidate review/promotion.
- The two workflows may share expert-system infrastructure and retrieval primitives, but they must not share persistence semantics or lifecycle responsibilities.
- Detection outputs candidate evidence/revisit links; selection flow outputs confirmed evidence chosen by a human for one explicit decision workflow item.

## Implementation Boundaries

- Transcript manager / transcript service layer should own reading projection generation and row-to-chunk resolution.
- Decision creation workflow should own confirmed selection persistence for manual and AI-assisted flows.
- Expert system may provide suggestion inference, but only behind an explicit interface that returns suggestions in the contract above.
- Decision detector may consume the same transcript manager interfaces, but should continue to operate on candidate contracts defined in `docs/decision-detection-implementation-reference.md`.

## UI Requirements

- Transcript hidden by default on candidate overview.
- Candidate overview omits segment details and shows confidence with minimal visual encoding.
- Segment selection lives on its own screen.
- Drag-to-select required for mouse and touch.
- Speaker is optional; fallback label is `Speaker unknown`.
- Reading mode is default; chunk/debug mode is opt-in.

## Observability

For reading projection and suggestion actions, record:

- query/range parameters
- selected reading row IDs
- resolved chunk IDs
- suggestion model/threshold/confidence
- final accepted vs rejected suggestions

Do not log full transcript bodies by default.

## Failure Modes And Mitigations

- **Dense overlap makes mapping ambiguous**: include `sourceChunkIds` per reading row and deterministic mapping strategy.
- **AI suggests noisy rows**: threshold + limit + human review gate.
- **Very long meetings**: pagination + range filtering + query filtering.
- **Missing speaker metadata**: explicit fallback text, no null/blank UI.
- **CLI/API drift**: enforce parity tests on reading and suggestion endpoints.

## Acceptance Scenarios

1. Reading projection returns no duplicate overlap text for a meeting with overlapped chunks.
2. Same query/range via CLI and API returns equivalent ordered reading rows.
3. Manual drag selection resolves to stable chunk ID mapping.
4. AI suggestion pre-selects rows; user can remove/add before save.
5. Overlap indicator toggling does not alter selected rows.
6. Rows with missing speaker render as `Speaker unknown`.
7. Updating one decision’s selection does not remove linkages used by other decisions.
8. End-to-end: title+summary -> AI suggestions -> review -> persisted selection -> draft generation.

## V2 Alignment

This design aligns with the v2 modular direction as follows:

- Reading projection is a transcript-manager concern and can remain a derived projection over a future `Timestream` abstraction.
- Row-to-chunk mapping preserves backend independence; graph-backed or multi-pipeline retrieval may improve suggestion quality later without changing the API/CLI contract.
- AI suggestion remains an optional inference layer over transcript-manager access, not a storage format or UI-only concern.
- Decision detection and revisit linking may adopt richer graph retrieval in v2, but must preserve their separate candidate contract and not absorb manual selection responsibilities.

## V2 Extension Path

Graph-backed retrieval (for example Graphiti) may improve suggestion quality and revisit detection, but must remain optional.

- Keep this contract backend-agnostic.
- Any v2 retrieval engine must preserve API/CLI shapes and selection mapping behavior above.
