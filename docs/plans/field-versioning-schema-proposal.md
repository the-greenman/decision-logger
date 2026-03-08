# Field Versioning Schema Proposal

**Status**: proposed
**Related docs**: `docs/versioning-architecture.md`, `docs/field-template-versioning-explainer.md`, `docs/plans/iterative-implementation-plan.md`
**Purpose**: define the proposed persistence model for field-centric versioning, visibility state, context/meeting relations, and direct implementation sequencing

## Scope

This proposal introduces schema for:

- `field_versions`
- `field_visibility_state`
- optional `decision_context_revision_events`

It also defines:

- constraints
- indexes
- invariants enforced in application logic vs database
- implementation shape for current in-development code

## Design goals

- Keep `FieldVersion` as the canonical history record
- Keep hidden-field semantics separate from field value history
- Support append-only restore semantics
- Support automated and manual provenance
- Make read-path switch possible without schema churn
- Allow one `DecisionContext` to span multiple meetings and off-meeting preparation periods
- Preserve enough finalization metadata for `DecisionLog` to record the specific meeting/event and authority participant snapshot at decision time
- Keep meeting agenda selection separate from decision-context ownership
- Keep automatically detected decision candidates separate from decision contexts until promotion

## Proposed tables

## 1. `field_versions`

Canonical append-only value history for one field within one decision context.

### Suggested columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `uuid` | no | primary key |
| `decision_context_id` | `uuid` | no | FK to `decision_contexts.id` |
| `field_id` | `uuid` | no | FK to `decision_fields.id` |
| `version` | `integer` | no | strictly increasing per `(decision_context_id, field_id)` |
| `value` | `jsonb` | yes | canonical field value payload |
| `source` | enum | no | `ai_generated`, `manual_edit`, `regen`, `template_transform`, `rollback` |
| `source_interaction_id` | `uuid` | yes | FK to `llm_interactions.id` when applicable |
| `created_by` | `text` | yes | user/system identity |
| `notes` | `text` | yes | optional rollback/transform/manual note |
| `is_active` | `boolean` | no | exactly one active row per field per context |
| `supersedes_field_version_id` | `uuid` | yes | optional explicit provenance link |
| `created_at` | `timestamp with time zone` | no | default now |

### Recommended enum

```typescript
export const fieldVersionSourceEnum = pgEnum('field_version_source', [
  'ai_generated',
  'manual_edit',
  'regen',
  'template_transform',
  'rollback',
]);
```

### Proposed Drizzle-style shape

```typescript
export const fieldVersions = pgTable('field_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionContextId: uuid('decision_context_id')
    .notNull()
    .references(() => decisionContexts.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id')
    .notNull()
    .references(() => decisionFields.id, { onDelete: 'restrict' }),
  version: integer('version').notNull(),
  value: jsonb('value'),
  source: fieldVersionSourceEnum('source').notNull(),
  sourceInteractionId: uuid('source_interaction_id')
    .references(() => llmInteractions.id, { onDelete: 'set null' }),
  createdBy: text('created_by'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(false),
  supersedesFieldVersionId: uuid('supersedes_field_version_id')
    .references(() => fieldVersions.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  contextFieldVersionUq: uniqueIndex('uq_field_versions_context_field_version')
    .on(table.decisionContextId, table.fieldId, table.version),
  activePerFieldUq: uniqueIndex('uq_field_versions_active_per_field')
    .on(table.decisionContextId, table.fieldId)
    .where(sql`${table.isActive} = true`),
  contextIdx: index('idx_field_versions_context').on(table.decisionContextId),
  fieldIdx: index('idx_field_versions_field').on(table.fieldId),
  contextFieldCreatedAtIdx: index('idx_field_versions_context_field_created_at')
    .on(table.decisionContextId, table.fieldId, table.createdAt),
  sourceIdx: index('idx_field_versions_source').on(table.source),
}));
```

### Notes

- `value` should be `jsonb`, not plain text, so field types can evolve without another persistence redesign.
- `is_active` is denormalized but useful for efficient reads.
- `supersedes_field_version_id` is optional but valuable for lineage.
  - manual edit can supersede prior active version
  - rollback can supersede current active version while semantically restoring an older payload

## 2. `field_visibility_state`

Tracks whether a field participates in the current active template view.

### Suggested columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| `decision_context_id` | `uuid` | no | FK to `decision_contexts.id` |
| `field_id` | `uuid` | no | FK to `decision_fields.id` |
| `visible_in_template` | `boolean` | no | current active visibility |
| `hidden_reason` | enum | yes | `not_in_template`, `manual_hide` |
| `updated_at` | `timestamp with time zone` | no | last state update |

### Recommended enum

```typescript
export const fieldVisibilityHiddenReasonEnum = pgEnum('field_visibility_hidden_reason', [
  'not_in_template',
  'manual_hide',
]);
```

### Proposed Drizzle-style shape

```typescript
export const fieldVisibilityState = pgTable('field_visibility_state', {
  decisionContextId: uuid('decision_context_id')
    .notNull()
    .references(() => decisionContexts.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id')
    .notNull()
    .references(() => decisionFields.id, { onDelete: 'restrict' }),
  visibleInTemplate: boolean('visible_in_template').notNull().default(true),
  hiddenReason: fieldVisibilityHiddenReasonEnum('hidden_reason'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.decisionContextId, table.fieldId] }),
  contextVisibleIdx: index('idx_field_visibility_context_visible')
    .on(table.decisionContextId, table.visibleInTemplate),
  fieldIdx: index('idx_field_visibility_field').on(table.fieldId),
}));
```

### Notes

- Visibility is current state, not append-only history.
- If visibility history later becomes important, add a separate event/audit table rather than overloading this table.

## 3. Optional `decision_context_revision_events`

This table is optional.

Use it only if product/UX needs a human-friendly “decision revision” concept.

### Why optional

The canonical history model is still `field_versions`.

A context revision is a convenience aggregate, not the source of truth.

### Suggested columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `uuid` | no | primary key |
| `decision_context_id` | `uuid` | no | FK |
| `revision` | `integer` | no | monotonically increasing per context |
| `event_type` | enum/text | no | `field_write`, `template_change`, `restore`, `status_change` |
| `caused_by_field_id` | `uuid` | yes | optional field involved |
| `created_by` | `text` | yes | actor |
| `created_at` | `timestamp with time zone` | no | default now |

### Recommendation

Do **not** introduce this in Phase A unless a specific UX or audit requirement needs it.

## Existing tables that remain for now

These may remain temporarily while the direct field-version implementation is completed:

- `decision_contexts.draftData`
- `draft_versions`
- `decision_contexts.lockedFields`
- `decision_contexts.templateId`

## Existing fields that may stay long-term

These may still remain useful long-term:

- `decision_contexts.templateId`
- `decision_contexts.status`
- `decision_contexts.lockedFields`

The major change is that active field values should eventually come from `field_versions`, not `draftData`.

## Meeting scope implications

`DecisionContext` should be treated as decision-scoped preparation state, not strictly as one-meeting state.

That means the long-term persistence model should support:

- discussion evidence from multiple meetings linking into one context
- context updates that occur between meetings
- finalization of the same context at one specific decision moment

### Current model constraint

Today `DecisionContext` carries `meetingId`.

That can remain as a creation/origin anchor for now, but it is too narrow to fully express a multi-meeting preparation lifecycle by itself.

### Recommended planning direction

Plan for one of these evolutions alongside the field-version foundation work:

- introduce a `decision_context_meetings` link table for many-to-many association between contexts and meetings
- or redefine `decision_contexts.meetingId` as an origin/primary meeting pointer plus add related-meeting links

Recommendation:

- keep the current `meetingId` field for compatibility now
- add explicit multi-meeting linkage later rather than overloading `field_versions` with meeting ownership semantics

## Additional planning entities

The field-version tables should not carry meeting agenda or candidate-promotion semantics directly.

Plan for adjacent structures such as:

- `decision_context_meetings` for many-meeting linkage
- `meeting_agenda_items` for ordered selection of open contexts into a meeting agenda
- candidate-to-context promotion relations handled outside `field_versions`

## Recommended invariants

## DB-enforced invariants

Use constraints/indexes for:

- unique `(decision_context_id, field_id, version)`
- max one active row per `(decision_context_id, field_id)`
- valid foreign keys to context/field/interaction

## Application-enforced invariants

Enforce in services for:

- next version number generation
- lock behavior rules
- assignment validation against active template
- visibility recomputation on template change
- restore behavior creating a new active version instead of mutating an old one
- rejecting automated writes to locked fields

## Write patterns

## Manual edit

1. resolve context + field
2. validate field assignment or allowed hidden restore rule
3. read active version
4. insert new `field_versions` row with:
   - `source='manual_edit'`
   - `version = previous + 1`
   - `is_active=true`
   - `supersedes_field_version_id = previous.id`
5. mark previous active row inactive
6. update any still-required provisional draft projection if a remaining incomplete code path depends on it

## Field regenerate

1. resolve context + field
2. reject if locked
3. generate value
4. insert new `field_versions` row with `source='regen'`
5. mark previous active row inactive
6. update any still-required provisional draft projection if needed

## Full regenerate

For each unlocked visible field:

- perform the field regenerate sequence independently

Do not generate synthetic versions for:

- locked fields
- hidden fields unless explicitly requested by product rules

## Template change

1. update `decision_contexts.templateId`
2. recompute `field_visibility_state`
3. do not write `field_versions` for unchanged fields
4. optionally create `template_transform` versions only for fields whose values are actively recomputed

## Restore field

1. resolve target historical version
2. resolve current active version
3. insert new row with:
   - copied/restored `value`
   - `source='rollback'`
   - `version = current + 1`
   - `is_active=true`
   - `supersedes_field_version_id = current.id`
4. mark current active version inactive
5. update any still-required provisional draft projection if still present

## Recommended query patterns

### Get active field values for a context

- join `field_visibility_state`
- read rows from `field_versions` where `is_active=true`
- filter to visible fields for export/default rendering

### List history for one field

- query `field_versions`
- filter by `(decision_context_id, field_id)`
- order by `version desc`

### Build final log

- use active `field_versions` for visible fields at finalize time
- preserve `decision_contexts.templateId` as the active template reference used for log creation
- record the specific meeting/event identity and participant snapshot associated with the actual decision moment rather than assuming the whole context belongs to a single meeting forever

## Lock semantics in schema terms

Recommended policy:

- keep lock state on `decision_contexts.lockedFields` during migration
- no separate field-lock table required yet

Rationale:

- lock is current control state, not append-only history
- existing lock representation already works for orchestration

Possible later upgrade:

- add `field_lock_events` only if audit requirements demand explicit lock history

## Implementation plan alignment

## Phase A

- add `field_versions`
- add `field_visibility_state`
- add enums and indexes
- keep any unfinished provisional snapshot persistence only where it still supports incomplete code paths

### Direct implementation note

There is no production data migration burden here.

Prioritize shaping the in-development code around the target model instead of preserving provisional structures longer than necessary.

## Phase B

Implement field-version-backed writes for:

- manual edit
- field regenerate
- full regenerate
- restore once implemented

Add parity tests for:

- active visible read values
- hidden field preservation
- lock behavior

## Phase C

- switch read paths to `field_versions`
- remove provisional fallback reads as soon as the necessary surfaces are covered
- keep decision-level snapshot routes only if they still reduce churn while the field-centric routes are completed

## Open decisions

1. Should `value` allow `null` to represent explicit empty state, or should deletion/clearing use a sentinel payload?
2. Should hidden fields be editable directly while hidden, or only restorable/viewable?
3. Should manual edit on a locked field remain allowed, or should product adopt a stricter universal lock?
4. Do we want `decision_context_revision_events`, or is field history sufficient for first release?
5. Should cross-meeting preparation be modeled by a new `decision_context_meetings` join table, or by a broader “decision work item” entity above `DecisionContext`?
6. Should `meeting_agenda_items` be the sole ordered agenda structure, or should contexts also carry a primary agenda projection?
7. Should `DecisionLog` store an authority participant snapshot directly, or reference meeting participants plus explicit override fields for off-meeting finalization cases?

## Recommendation summary

- Introduce `field_versions` and `field_visibility_state` in Phase A.
- Keep `draftData` and `draft_versions` only as migration compatibility state.
- Treat `field_versions` as canonical.
- Treat visibility as current state, not history.
- Do not treat template change alone as a version event.
- Model restore as append-only creation of a new active field version.
