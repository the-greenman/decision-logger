# Versioning Architecture

**Status**: authoritative
**Owns**: long-term versioning model for decisions, fields, template transforms, and rollback behavior
**Must sync with**: `docs/plans/iterative-implementation-plan.md`, `docs/transcript-reading-and-segment-selection-architecture.md`, `docs/decision-detection-implementation-reference.md`, `docs/field-template-versioning-explainer.md`, `docs/plans/field-versioning-schema-proposal.md`, `docs/plans/field-versioning-api-proposal.md`, `packages/schema`, `packages/db`

## Purpose

Define the long-term versioning architecture for Decision Logger.

The target model is field-centric versioning, not whole-draft snapshot versioning.

This document is authoritative for semantic rules.

Use `docs/field-template-versioning-explainer.md` for the expanded rationale, examples, and strategy discussion.

## Goals

- Preserve complete history for each field value.
- Support field-level restore and audit.
- Support template transforms without data loss.
- Keep lock semantics deterministic across regenerate/edit/transform flows.
- Keep export/finalization consistent with active template.
- Keep `DecisionContext` independent of any single meeting.
- Allow one `DecisionContext` to accumulate preparation work across multiple meetings or asynchronous work periods.
- Allow meetings to manage an ordered agenda by selecting from open decision contexts.
- Ensure automatically detected decision candidates remain candidates until explicitly promoted into decision contexts.
- Support transcript evidence from many meetings linking into one decision context.
- Keep the final `DecisionLog` anchored to a specific decision moment, meeting context, and authority participant snapshot.

## Long-Term Model

### Core Entities

`DecisionContext` remains the working container for one decision draft.

`DecisionContext` is not required to be meeting-scoped and should not be modeled as owned by a single meeting.

It may span:

- multiple meetings discussing the same pending decision
- preparation work outside a meeting
- asynchronous refinement between meetings

Meetings may select existing open decision contexts into an ordered agenda, but that meeting agenda relationship does not define the lifetime of the context.

Automatically detected decision candidates are not decision contexts by default.

Promotion is the boundary where:

- a candidate becomes an actively managed decision topic
- a `DecisionContext` is created or linked
- the decision can appear on meeting agendas

`DecisionLog` remains the immutable finalized record for a specific decision moment.

It should capture the meeting/event context and the participant set with authority to make the decision at the moment it was actually logged.

Contributor history can be inferred separately from transcript relations if needed; it is not the same as the final authority participant list.

`FieldVersion` is the canonical history record:

```typescript
type FieldVersion = {
  id: string;
  decisionContextId: string;
  fieldId: string;
  version: number;
  value: unknown;
  source: 'ai_generated' | 'manual_edit' | 'regen' | 'template_transform' | 'rollback';
  sourceInteractionId?: string;
  createdAt: string;
  createdBy?: string;
  notes?: string;
  isActive: boolean;
};
```

`FieldVisibilityState` tracks template-driven visibility without deleting content:

```typescript
type FieldVisibilityState = {
  decisionContextId: string;
  fieldId: string;
  visibleInTemplate: boolean;
  hiddenReason?: 'not_in_template' | 'manual_hide';
  updatedAt: string;
};
```

### Invariants

- Each field has a strictly increasing `version` per `decisionContextId`.
- Exactly one active version per field per context.
- Template switch never deletes field versions.
- Hidden fields are excluded from exports and required-field checks for the active template.
- Locked fields cannot receive new versions from regenerate or template transform.
- Field restore is append-only: restoring an old value creates a new active `FieldVersion`; historical versions are never reactivated in place.
- Template change alone is not a field-value version event; it becomes a version event only if a field value is actually transformed or regenerated.
- Decision-level rollback is compatibility behavior built on field restore semantics, not the canonical history model.

## Operational Behavior

### Manual Edit

- Create new `FieldVersion` with `source='manual_edit'`.
- Mark previous active version inactive.
- Recommended lock behavior: manual edit is explicit user intent and may proceed even when a field is locked, unless a stricter product rule is introduced later.

### Field Regenerate

- If unlocked, create new `FieldVersion` with `source='regen'`.
- Attach LLM interaction provenance when available.

### Full Draft Regenerate

- Process each unlocked active field independently.
- Create one new field version per updated field.

### Template Transform

- Update active template reference on context.
- Recompute visibility state for fields.
- Preserve all values.
- For unlocked fields entering active template, optional transform/regenerate writes new versions.
- Locked fields remain unchanged.
- Template change by itself does not create new `FieldVersion` rows for unchanged values.

### Field Restore

- Restoring an old field value creates a new active `FieldVersion` with `source='rollback'`.
- Historical versions are immutable.
- Restore is a field-level event inside the current `DecisionContext`; it does not create a new top-level decision object.

### Completion

- Decision completion captures timestamp + free-text completion notes.
- Final log references active field versions at completion time.
- Final log should capture the meeting or event context associated with the actual decision moment, even when the underlying `DecisionContext` accumulated work across earlier meetings or off-meeting preparation.

## API/CLI Direction

- Field history endpoints and commands become first-class:
  - list versions for one field
  - view specific field version
  - restore field version
- Decision-level rollback becomes optional convenience behavior built on field restores.
- Existing whole-draft snapshot endpoints can remain as temporary compatibility wrappers while field-centric endpoints are finished.
- User-facing field references may accept stable field identity as a convenience layer, but canonical history records always resolve to `fieldId` internally.

## Export Rules

- Export includes only fields visible in active template.
- Hidden fields remain stored and recoverable but are not exported.
- Completion export is based on active field versions at lock/finalize time.

## Meeting Scope And Decision Scope

- `DecisionContext` models ongoing preparation state for one decision topic.
- Preparation may continue across multiple meetings and outside meeting boundaries.
- Meetings manage ordered agendas and may select from open decision contexts.
- Meetings contribute discussion evidence and candidate decision moments.
- Transcripts from multiple meetings may all relate to the same `DecisionContext`.
- Automatically detected decision candidates remain reviewable inputs until explicitly promoted.
- `DecisionLog` captures the finalization event at one specific point in time.
- The finalization event should record the meeting/event identity and the authority participant snapshot relevant to that decision moment.

## Implementation Sequence

### Phase A: Introduce Field Version Tables

- Add new schema/tables for field versions and visibility state.
- Replace provisional field-value handling with the field-version model directly where practical.

### Phase B: Wire Field-Specific Writes

- On edit/regenerate, persist through the field-version model.
- Keep any temporary snapshot behavior only where it still reduces implementation churn in incomplete code paths.
- Add tests proving the field-version path is authoritative.

### Phase C: Wire Field-Centric Reads

- UI/API/CLI read active field values from field-version model.
- Remove provisional read paths as soon as field-version reads cover the required surfaces.

### Phase D: Rollback And Context/Meeting Alignment

- Convert decision-level rollback into field-based orchestration.
- Add explicit context/meeting linkage semantics so meetings select from open contexts without owning them.
- Add transcript-to-context relations that allow one context to gather evidence from many meetings.

## Risks

- Template transform edge cases for locked + hidden fields.
- Confusion between meeting participants, transcript contributors, and final decision authorities.
- Confusion between decision candidates, open decision contexts, and finalized decision logs.

## Acceptance Criteria

1. Field edits/regenerations always create append-only field versions.
2. Locked fields are unchanged by regenerate and template transform.
3. Template switch hides non-template fields without deleting versions.
4. Hidden fields are excluded from export.
5. Field restore works and is auditable.
6. Completion records notes text and timestamp.
7. API/CLI expose equivalent field-version workflows.

## Related documents

- `docs/field-template-versioning-explainer.md` — detailed explanation, examples, tradeoffs, and recommended operating rules
- `docs/plans/field-versioning-schema-proposal.md` — proposed schema, constraints, indexes, and implementation shape
- `docs/plans/field-versioning-api-proposal.md` — proposed API and CLI contracts for field history, restore, and context/meeting coordination
