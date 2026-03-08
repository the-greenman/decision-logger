# Field Versioning API Proposal

**Status**: proposed
**Related docs**: `docs/versioning-architecture.md`, `docs/field-template-versioning-explainer.md`, `docs/plans/field-versioning-schema-proposal.md`, `docs/plans/iterative-implementation-plan.md`
**Purpose**: define the proposed API and CLI contracts for field-centric version history, restore flows, agenda/context coordination, and direct implementation sequencing

## Scope

This proposal covers:

- field history read APIs
- field restore APIs
- active field read semantics
- template-change implications for API behavior
- temporary compatibility wrappers for any unfinished snapshot-oriented endpoints
- CLI command proposals matching the API

## Design goals

- Make field history first-class
- Keep user-facing field references ergonomic
- Keep internal persistence canonical on `fieldId`
- Make restore semantics append-only and auditable
- Avoid making template change look like synthetic value churn
- Allow one `DecisionContext` to remain the preparation workspace across multiple meetings or off-meeting work periods
- Keep finalization APIs explicit about the single meeting/event context and authority participant set associated with the actual decision moment
- Keep agenda selection separate from context ownership
- Keep decision-candidate promotion separate from decision-context lifecycle

## Decision scope vs meeting scope

- `DecisionContext` should represent the ongoing work on a decision topic.
- That work may continue across multiple meetings and between meetings.
- Meetings should select from open decision contexts into an ordered agenda rather than own those contexts.
- Automatically detected decision candidates should remain candidates until explicitly promoted.
- Transcript evidence from many meetings may link into the same context.
- `DecisionLog` should represent the finalization event at one specific moment.
- Finalization APIs should therefore capture the meeting/event identity and authority participant snapshot for that moment instead of assuming the entire context belongs to one meeting forever.

## Reference resolution rules

All field-centric endpoints should conceptually accept a `fieldRef`.

A `fieldRef` may be:

- the assigned field UUID
- a stable field name convenience reference
- later, if needed, a fully-qualified stable identity like `namespace:name@version`

### Recommendation

For Phase 1 API behavior:

- accept UUID or stable field name
- resolve to canonical `fieldId` server-side within the active `DecisionContext`
- reject ambiguous or unassigned references

### Resolution rules

1. If `fieldRef` matches an assigned `fieldId`, use it.
2. Otherwise resolve by stable field identity.
3. If no field is found, return `404`.
4. If field exists but is not assigned/visible in the requested operation context, return `400` or `409` depending on operation semantics.
5. All persistence and history records use resolved `fieldId` internally.

## Proposed response models

## `FieldVersion`

```json
{
  "id": "uuid",
  "decisionContextId": "uuid",
  "fieldId": "uuid",
  "version": 4,
  "value": "Approve migration in Q3",
  "source": "rollback",
  "sourceInteractionId": null,
  "createdBy": "alice",
  "notes": "Restored from version 1 after review",
  "isActive": true,
  "supersedesFieldVersionId": "uuid",
  "createdAt": "2026-03-07T20:00:00.000Z"
}
```

## Finalization API implications

The finalization/logging flow should explicitly model the fact that preparation may span multiple meetings while the actual decision event happens at one point in time.

### Recommendation

Keep `POST /api/decision-contexts/:id/log`, but evolve the request contract to carry explicit finalization context.

### Suggested request additions

```json
{
  "decisionMethod": {
    "type": "consensus",
    "details": "5 for, 2 against"
  },
  "actors": ["Alice", "Bob"],
  "loggedBy": "Alice",
  "finalizedMeetingId": "uuid",
  "participantSnapshot": ["Alice", "Bob", "Carol"],
  "finalizedAt": "2026-03-08T09:00:00.000Z"
}
```

### Semantics

- `finalizedMeetingId` identifies the meeting or event context in which the decision was actually taken
- `participantSnapshot` preserves who had authority at that decision moment, even if broader contributor history was larger
- `finalizedAt` allows explicit capture of the decision moment when it differs from storage write time

### Planning note

If off-meeting finalization must be supported, the contract may later generalize from `finalizedMeetingId` to a broader event reference while still keeping the same boundary: long-running context, point-in-time final log.

Contributor history can be derived from transcript/context relations if needed; it should not redefine the authority participant list on the final log.

## `FieldHistorySummary`

```json
{
  "fieldId": "uuid",
  "fieldRef": "decision_statement",
  "activeVersion": 4,
  "visibleInTemplate": true,
  "versions": [
    {
      "version": 4,
      "source": "rollback",
      "createdAt": "2026-03-07T20:00:00.000Z",
      "isActive": true
    },
    {
      "version": 3,
      "source": "manual_edit",
      "createdAt": "2026-03-07T19:55:00.000Z",
      "isActive": false
    }
  ]
}
```

## `FieldVisibilityState`

```json
{
  "fieldId": "uuid",
  "visibleInTemplate": false,
  "hiddenReason": "not_in_template",
  "updatedAt": "2026-03-07T20:10:00.000Z"
}
```

## Proposed endpoints

## 1. List field versions

### Route

`GET /api/decision-contexts/:id/fields/:fieldRef/versions`

### Purpose

List the version history for one field in one decision context.

### Behavior

- resolve `fieldRef`
- return versions in descending order
- include current visibility and active version metadata
- hidden fields may still be listed if they belong to the context history

### Response

`200 OK`

```json
{
  "fieldId": "uuid",
  "fieldRef": "decision_statement",
  "activeVersion": 4,
  "visibleInTemplate": true,
  "versions": [
    {
      "version": 4,
      "source": "rollback",
      "createdAt": "2026-03-07T20:00:00.000Z",
      "isActive": true
    },
    {
      "version": 3,
      "source": "manual_edit",
      "createdAt": "2026-03-07T19:55:00.000Z",
      "isActive": false
    }
  ]
}
```

### Errors

- `404` if context or field is not found
- `400` if `fieldRef` is invalid for the context

## 2. Get one field version

### Route

`GET /api/decision-contexts/:id/fields/:fieldRef/versions/:version`

### Purpose

Fetch one specific historical version for display or comparison.

### Response

`200 OK`

```json
{
  "fieldVersion": {
    "id": "uuid",
    "decisionContextId": "uuid",
    "fieldId": "uuid",
    "version": 3,
    "value": "Approve migration in Q4",
    "source": "manual_edit",
    "sourceInteractionId": null,
    "createdBy": "alice",
    "notes": null,
    "isActive": false,
    "supersedesFieldVersionId": "uuid",
    "createdAt": "2026-03-07T19:55:00.000Z"
  }
}
```

## 3. Restore field version

### Route

`POST /api/decision-contexts/:id/fields/:fieldRef/restore`

### Request body

```json
{
  "version": 1,
  "notes": "Restore approved wording from earlier review",
  "restoredBy": "alice"
}
```

### Purpose

Restore an old field value by creating a new active version.

### Behavior

- resolve `fieldRef`
- fetch historical version requested
- create a new active `FieldVersion` with:
  - copied value
  - `source='rollback'`
  - incremented version number
- mark previous active version inactive
- update compatibility state during migration

### Response

`200 OK`

```json
{
  "fieldVersion": {
    "id": "uuid",
    "decisionContextId": "uuid",
    "fieldId": "uuid",
    "version": 4,
    "value": "Approve migration in Q3",
    "source": "rollback",
    "createdBy": "alice",
    "notes": "Restore approved wording from earlier review",
    "isActive": true,
    "createdAt": "2026-03-07T20:00:00.000Z"
  }
}
```

### Recommended lock behavior

Recommended policy:

- restore is explicit user intent
- restore may proceed even when the field is locked
- regenerate/template-transform remains blocked while locked

If product wants stricter semantics, return `409 Locked` or `400` with a clear message.

## 4. Get active field state

### Route

`GET /api/decision-contexts/:id/fields`

### Purpose

Return the current active field state for a context based on canonical field versions.

### Behavior

- after Phase C, this should read from `field_versions`
- before Phase C, this may remain backed by compatibility reads
- should include visibility and lock status

### Response

```json
{
  "templateId": "uuid",
  "fields": [
    {
      "fieldId": "uuid",
      "fieldRef": "decision_statement",
      "label": "Decision Statement",
      "value": "Approve migration in Q3",
      "activeVersion": 4,
      "visibleInTemplate": true,
      "locked": true,
      "manuallyEdited": true
    }
  ]
}
```

## 5. Optional hidden-field listing

### Route

`GET /api/decision-contexts/:id/hidden-fields`

### Purpose

Expose hidden but recoverable field state after template change.

### Response

```json
{
  "fields": [
    {
      "fieldId": "uuid",
      "fieldRef": "risks",
      "visibleInTemplate": false,
      "hiddenReason": "not_in_template",
      "activeVersion": 2,
      "value": "Timeline risk"
    }
  ]
}
```

### Recommendation

This endpoint is optional for first release.

It becomes more useful once template switching and visibility state are user-visible features.

## Existing endpoints and how they should evolve

## Existing field update endpoint

### Current

`PATCH /api/decision-contexts/:id/fields/:fieldId`

### Proposed semantics

Keep the route, but treat `:fieldId` as `:fieldRef` at the contract layer.

The operation should:

- resolve the reference
- validate assignment/visibility policy
- create a new active `FieldVersion` with `source='manual_edit'`
- dual-write compatibility `draftData` during migration

### Recommended response

Prefer returning the updated field state and created active version metadata.

Example:

```json
{
  "fieldId": "uuid",
  "fieldRef": "decision_statement",
  "value": "Updated wording",
  "activeVersion": 5,
  "manuallyEdited": true,
  "locked": false
}
```

Compatibility option:

- keep returning full `DecisionContext` during migration
- later move to more field-centric responses

When returning `DecisionContext`, do not imply that one meeting owns the context lifecycle. Any existing `meetingId` should be treated as temporary origin metadata only.

## Meeting agenda and candidate-promotion implications

### Ordered agenda selection

Meetings need an ordered agenda, but agenda membership should be a selection of open contexts.

Recommended planning direction:

- keep context retrieval centered on `GET /api/decision-contexts/:id`
- add meeting-agenda endpoints that reference `decisionContextId`
- avoid meeting-scoped APIs that imply the context only exists inside one meeting

Examples:

- `GET /api/meetings/:id/agenda`
- `POST /api/meetings/:id/agenda-items` with `{ decisionContextId, order }`
- `PATCH /api/meetings/:id/agenda-items/:agendaItemId` for reorder/move/remove behavior

### Candidate promotion

Automatically detected candidates should not create contexts automatically.

Recommended planning direction:

- keep candidate review endpoints separate
- add an explicit promotion action that creates or links a `DecisionContext`

Example:

- `POST /api/decision-candidates/:id/promote`

## Existing field regenerate endpoint

### Current

`POST /api/decision-contexts/:id/fields/:fieldId/regenerate`

### Proposed semantics

- resolve field reference
- reject if locked
- generate new value
- create `FieldVersion` with `source='regen'`
- return new active field state

## Existing transcript endpoint

### Current

`GET /api/decision-contexts/:id/fields/:fieldId/transcript`

### Proposed semantics

- keep route shape
- resolve `fieldRef`
- return transcript evidence for the canonical `fieldId`

This endpoint is evidence-oriented, not version-history-oriented.

## Template-change behavior in the API

## Recommendation

Introduce template-change semantics explicitly rather than treating them as silent field rewrites.

### Proposed route

`POST /api/decision-contexts/:id/template-change`

### Request body

```json
{
  "templateRef": "standard_decision",
  "transformMode": "visibility_only"
}
```

### Suggested transform modes

- `visibility_only`
- `transform_unlocked_visible_fields`

### Meaning

- `visibility_only`
  - update context template reference
  - recompute visibility state
  - create no new field versions for unchanged values
- `transform_unlocked_visible_fields`
  - update visibility state
  - optionally generate or transform values for unlocked fields entering the template
  - create `template_transform` versions only for those changed fields

### Recommended response

```json
{
  "decisionContextId": "uuid",
  "templateId": "uuid",
  "changedVisibility": [
    {
      "fieldId": "uuid",
      "visibleInTemplate": false,
      "hiddenReason": "not_in_template"
    }
  ],
  "transformedFields": [
    {
      "fieldId": "uuid",
      "activeVersion": 3,
      "source": "template_transform"
    }
  ]
}
```

## Decision-level rollback compatibility wrapper

## Existing compatibility route

`POST /api/decision-contexts/:id/rollback`

### Long-term meaning

This should become a wrapper over field-level restore orchestration.

### Two possible compatibility modes

#### Mode A — exact snapshot compatibility

- restore compatibility snapshot
- translate snapshot differences into field restore operations
- create new `rollback` versions for affected fields

#### Mode B — best-effort field restore orchestration

- map snapshot version to desired field states
- restore each differing field by creating new active versions
- return a summary of restored fields

### Recommendation

Use **Mode B** as the long-term implementation target.

Reason:

- aligns with append-only field history
- avoids reintroducing snapshot-centric semantics
- makes compatibility behavior explicit

### Suggested response

```json
{
  "decisionContextId": "uuid",
  "restoredFields": [
    {
      "fieldId": "uuid",
      "fromVersion": 5,
      "toVersion": 6,
      "restoredFromHistoricalVersion": 2
    }
  ]
}
```

## Error semantics

### `400 Bad Request`

Use for:

- malformed `fieldRef`
- invalid requested restore version
- field exists but operation is invalid in current state

### `404 Not Found`

Use for:

- context not found
- field not found in context history
- requested historical version not found

### `409 Conflict`

Recommended for:

- locked-field operation rejected by policy
- conflicting template transform state
- stale expected-version optimistic concurrency failure if later introduced

## CLI proposal

## Field history commands

```bash
draft field-history <field-ref>
draft show-field-version <field-ref> --version <n>
draft restore-field <field-ref> --version <n> [--notes "..."]
```

## Optional convenience commands

```bash
draft show-hidden-fields
draft change-template <template-ref> [--transform-mode visibility_only|transform_unlocked_visible_fields]
```

## CLI/API parity requirements

The CLI should use the same concepts as the API:

- `field-ref`
- active version
- visibility state
- restore creates a new active version
- template change does not imply value change by default

## Implementation behavior

## Phase B

Existing endpoints may temporarily update provisional snapshot structures only where unfinished code still depends on them, but the target implementation should center on field-version-backed writes for:

- manual edit route
- regenerate field route
- full regenerate route
- restore field route once added

## Phase C

Switch field read responses to canonical field-version-backed active state.

Temporary compatibility responses may still include legacy context fields while incomplete consumers are being finished.

## Open API decisions

1. Should `GET /api/decision-contexts/:id/fields` include hidden fields behind a query flag like `?includeHidden=true`?
2. Should restore on a locked field return `409`, or remain allowed as explicit user intent?
3. Should template-change be a new route, or an extension of the existing context/template update flow?
4. Should field update/regenerate endpoints continue returning full `DecisionContext`, or migrate to field-centric payloads?
5. How should cross-meeting preparation links be exposed: on `GET /api/decision-contexts/:id`, through related meetings subresources, or both?
6. Should finalization always require a meeting ID, or support a broader event/finalization context contract for off-meeting decisions?
7. Should agenda ordering live only under meeting agenda endpoints, or also surface a current-agenda projection on context payloads?
8. Should candidate promotion create a fresh context every time, or allow linking to an existing open context for the same decision topic?

## Recommendation summary

- Treat field history as first-class API surface.
- Keep `fieldRef` ergonomic but resolve to `fieldId` internally.
- Make restore append-only.
- Keep template change and value-version creation separate.
- Preserve decision-level rollback only as compatibility behavior.
- Aim for CLI/API parity around field history and restore semantics.
