# Decision Detection Implementation Reference

**Status**: authoritative
**Owns**: detection execution workflow, segment relevance tagging, candidate persistence, review/promotion lifecycle
**Must sync with**: `docs/decision-detection-architecture.md`, `docs/context-tagging-strategy.md`, `docs/transcript-context-management.md`, `docs/plans/iterative-implementation-plan.md`, `docs/v2/modular-architecture.md`

## Purpose

This document defines the implementation reference for decision detection and relevant segment flagging.

- It complements `docs/decision-detection-architecture.md` (prompt design and detection patterns).
- It does not replace template/field extraction docs.
- It describes how detected decisions become persistent candidates and how humans refine/promote them.

## Inputs and Core Model

Detection operates on transcript chunks for a meeting:

```typescript
type DetectionInputChunk = {
  id: string;
  meetingId: string;
  sequenceNumber: number;
  speaker?: string;
  text: string;
  contexts: string[]; // e.g. meeting:<id>, decision:<id>, decision:<id>:<field>
};
```

Assumption: most relevant context is contiguous in sequence, but the same decision may be revisited later in non-contiguous spans.

## Canonical Two-Pass Workflow

### Pass 1: Contiguous Candidate Detection

1. Load transcript chunks for a meeting, ordered by `sequenceNumber`.
2. Send ordered chunks to the Decision Detector expert via structured output (`consultStructured()`).
3. Return candidate decisions with:
   - contiguous primary span (`startSequenceNumber`, `endSequenceNumber`)
   - initial evidence segments (`evidenceSegmentIds`)
   - confidence and suggested template
4. Apply configurable include threshold (default `0.5`).

### Pass 2: Revisit Linking

For each above-threshold candidate:

1. Query for later chunks likely to be the same decision (semantic/topic and entity overlap with candidate title/summary).
2. Exclude chunks already in the primary span/evidence.
3. Add non-contiguous references as `revisitSegmentIds`.
4. Record inclusion reason for each linked chunk (`revisit`).

This pass must not force contiguity. It is designed to capture repeated discussion of the same decision over time.

## Candidate Output Contract

Decision detector output should map to this canonical candidate shape:

```typescript
type DecisionCandidate = {
  id: string;
  meetingId: string;
  title: string;
  contextSummary: string;
  confidence: number; // 0..1
  suggestedTemplateId: string;
  startSequenceNumber: number;
  endSequenceNumber: number;
  evidenceSegmentIds: string[];
  revisitSegmentIds: string[];
  source: 'ai' | 'manual';
  status: 'pending_candidate' | 'promoted' | 'dismissed';
};
```

Notes:
- `source='manual'` and `source='ai'` must coexist in one candidate list.
- `promoted` means the candidate has been turned into an active decision context / flagged decision workflow item.

## Persistence and Tagging Rules

### Persistence Policy

- Persist all above-threshold detector results as candidate records by default.
- Persist confidence, suggested template, span boundaries, and provenance metadata.
- Persist per-candidate segment linkage metadata with inclusion reason:
  - `contiguous`
  - `revisit`
  - `manual`

### Segment Tagging Rules

- Apply decision-level context tags for candidate-linked segments: `decision:<decisionContextId>` after promotion.
- Allow a segment to link to multiple decision candidates/decisions.
- Do not remove tags belonging to other decisions when one candidate is edited or dismissed.

## Review, Refinement, and Promotion Lifecycle

1. Detection run writes candidate records (`status='pending_candidate'`).
2. Human reviews candidate list with confidence and evidence/revisit segments.
3. Human may:
   - refine title and context summary
   - add/remove linked segments
   - merge duplicate/overlapping candidates
   - dismiss candidates
   - promote candidate to active decision workflow
4. Promotion creates/associates decision context and enables draft generation.
5. Dismissal marks candidate `dismissed` and preserves audit history.

## CLI/API Contract Parity

Detection candidate lifecycle must expose equivalent CLI and API workflows.

| Workflow | CLI | API |
|---|---|---|
| Run detection | `decisions detect --meeting-id <id>` | `POST /api/meetings/:id/detect-decisions` |
| List candidates | `decisions candidates --meeting-id <id>` | `GET /api/meetings/:id/decision-candidates` |
| Refine candidate | `decisions candidates update <candidate-id> ...` | `PATCH /api/decision-candidates/:id` |
| Promote candidate | `decisions candidates promote <candidate-id>` | `POST /api/decision-candidates/:id/promote` |
| Dismiss candidate | `decisions candidates dismiss <candidate-id>` | `DELETE /api/decision-candidates/:id` |

Parity rule:
- If one side ships first, document the temporary asymmetry in milestone notes and add the missing side in the next planned milestone checkpoint.

## Confidence and Deduplication Guidance

- Include threshold is configurable per run; default `0.5`.
- Higher thresholds favor precision; lower thresholds favor recall.
- Deduplicate candidates when they represent the same decision:
  - overlapping primary span plus similar title/summary
  - shared evidence segments with same implied outcome
- Keep separate candidates when the same span supports distinct decision outcomes.

## Service Boundaries

- `DecisionDetectionService`: orchestration only (chunk retrieval, two-pass flow, persistence coordination).
- `ExpertService` (`consultStructured`): detector inference and structured parsing.
- `FlaggedDecisionService` / candidate persistence layer: create/update/dismiss/promote candidate records.
- `TranscriptService`/context-tagging components: chunk lookup and tag application.

The detector service should not contain prompt business logic beyond selecting expert/persona and passing run parameters.

## Detector Prompt Contract (Structured)

The detector expert must return structured data sufficient for candidate persistence:

```typescript
type DetectorStructuredResult = Array<{
  title: string;
  contextSummary: string;
  confidence: number;
  suggestedTemplateId: string;
  startSequenceNumber: number;
  endSequenceNumber: number;
  evidenceSegmentIds: string[];
}>;
```

`revisitSegmentIds` are appended by Pass 2 orchestration and stored on the final candidate records.

## Observability Requirements

For each detection run, store:

- prompt segments and serialized prompt text
- model/provider/latency/token metadata
- threshold used and chunk count processed
- resulting candidates
- evidence/revisit provenance per linked segment

This enables explainability for "why this was detected" and "why this segment was linked."

## Failure Modes and Mitigations

- Over-segmentation (too many tiny candidates): merge heuristics + human merge action.
- Merged decisions (one candidate covers multiple decisions): split in refinement UI/CLI.
- Low-confidence noise: tune threshold upward and filter by minimum evidence count.
- Missed revisits: adjust pass-2 retrieval limits and semantic matching prompt/query.
- Conflicting candidate edits: preserve audit trail and last-writer metadata.

## Acceptance Scenarios

1. Explicit decision in one contiguous span produces one candidate with matching start/end and evidence IDs.
2. Implicit defer/reject language produces a medium-confidence candidate (`>= 0.5`) with correct summary.
3. Same decision revisited later appears in `revisitSegmentIds` while primary span stays contiguous.
4. Overlapping chunks can be linked to two different candidates without data loss.
5. AI candidate can be manually refined and promoted to active decision context.
6. Dismissing one candidate does not remove tags/links used by other candidates.
7. Threshold change (`0.5` to `0.7`) reduces candidate count predictably.
8. No-decision transcript returns empty or sparse candidates without excessive false positives.

## V2 Path: Optional Graph Extension

Graph-backed temporal retrieval (for example Graphiti) is an optional v2 extension, not a core dependency.

- Core detection remains platform-agnostic and works with existing repositories/services.
- Optional graph layer can improve revisit linking and temporal relationship traversal.
- Any graph integration must preserve the same canonical candidate contract in this document.
