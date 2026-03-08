# Field and Template Definition Distribution Proposal

**Status**: proposed
**Related docs**: `docs/field-library-architecture.md`, `docs/versioning-architecture.md`, `docs/field-template-versioning-explainer.md`, `docs/plans/iterative-implementation-plan.md`, `docs/plans/field-versioning-schema-proposal.md`, `docs/plans/field-versioning-api-proposal.md`
**Purpose**: define the planning model for field definitions and template definitions as separately versioned artifacts, with fields as the primary reusable and mergeable unit

## Scope

This proposal covers:

- field definitions as primary shareable artifacts
- template definitions as versioned compositions of field definitions
- separation of field-definition semantics from template-definition composition
- context creation using pinned template and field-definition versions
- import/export and update flows for definitions
- merge boundaries for local changes and third-party updates

This proposal does not define the final API or schema shape. `packages/schema` remains the canonical structural source when implementation begins.

## Design goals

- Keep semantic meaning owned by fields, not duplicated across templates
- Allow the same field definition to be reused across many templates
- Allow communities of practice to share versioned field and template definitions
- Allow local customization without losing upstream lineage
- Keep open `DecisionContext` records reproducible by pinning exact resolved definition versions
- Keep runtime field-value history separate from definition-management history
- Make imports, updates, and merges understandable at field and template granularity

## Core model

### 1. Field definitions are primary

A field definition is the canonical reusable unit.

A field definition should own:

- stable identity
- namespace and name
- semantic version
- semantic intent
- extraction guidance and prompt context
- validation and value-shape metadata
- display defaults that are intrinsic to the field itself

A field definition should not depend on one specific template for its core meaning.

### 2. Template definitions are compositions

A template definition is a versioned composition of field definitions for a broader decision context such as technical, cultural, budget, governance, or strategy work.

A template definition should own:

- stable identity
- semantic version
- ordered field references
- requiredness flags
- grouping or layout metadata when needed
- template-level workflow framing

A template definition should not override or redefine field semantics.

In particular, templates should not own:

- field prompt meaning
- field validation logic
- field semantic description
- field extraction behavior that changes the field's meaning

Templates provide wider framing. Fields provide the reusable semantic unit.

### 3. No template semantic overrides

If a template needs a materially different field meaning, that should be a different field definition rather than a template override.

Option A is the preferred rule: remove per-template field label and description override columns entirely rather than trying to distinguish semantic overrides from presentation-only overrides.

If a different label or description is needed, define a distinct field definition with its own lineage and version history.

This preserves:

- field portability across templates
- clean merge behavior
- stable export/import semantics
- understandable field lineage

### 4. Decision contexts pin resolved versions

When a `DecisionContext` is created, it should bind to:

- one specific template definition version
- the resolved set of field-definition versions referenced by that template version

This binding is part of the context's working configuration.

Open contexts should not automatically change when newer field or template versions are published.

## Versioning model

### Field definition versioning

Field definitions should version independently.

A new field-definition version is appropriate when any of the following changes materially affect behavior or meaning:

- prompt or extraction guidance
- semantic description
- validation/value-shape expectations
- normalization rules
- structured output expectations

### Template definition versioning

Template definitions should version independently from fields.

A new template-definition version is appropriate when any of the following changes:

- included field set
- field order
- requiredness
- grouping or layout semantics
- template-level workflow framing
- referenced field-definition versions

### Recommended dependency rule

A template definition version should reference exact field-definition versions, not floating ranges.

That gives:

- deterministic imports
- deterministic context creation
- reproducible exports
- simpler diff and merge behavior

If a template adopts a newer field-definition version, that should normally produce a new template-definition version.

## Merge boundaries

### Field merge boundary

Field definitions are the primary merge unit.

Upstream or local changes to a field should be evaluated and merged at the field-definition level.

Typical field-level changes:

- updated prompt guidance
- revised description
- changed validation metadata
- structured value-shape refinements

### Template merge boundary

Template definitions merge separately at the composition layer.

Typical template-level changes:

- add or remove a field reference
- reorder fields
- change requiredness
- change grouping or layout metadata
- adopt newer field-definition versions

This keeps template diffs focused on composition instead of embedding field semantics.

## Import and export model

### Export unit

The preferred export unit is a definition package that may contain:

- one or more field definitions
- one or more template definitions
- provenance metadata
- optional expert definitions in a later extension

### Required export metadata

Each exported definition package should preserve at least:

- stable identity
- version
- publisher or source namespace
- created/exported timestamp
- lineage metadata when forked
- dependency references between templates and fields

### Import modes

Imports should support at least:

- import as upstream-tracked definitions
- import as local copy
- import as local fork preserving upstream lineage

## Local modification model

### Local field changes

If a user changes a field definition locally, that change should create either:

- a new local field-definition version in the same lineage, or
- a local fork when compatibility with upstream lineage cannot be preserved cleanly

### Local template changes

If a user changes a template definition locally, that should create either:

- a new local template-definition version in the same lineage, or
- a local fork when it intentionally diverges from upstream

Local template changes may also adopt local field-definition versions.

## Upstream update model

When new third-party definitions are downloaded:

1. compare imported field definitions against local known lineage
2. compare imported template definitions against local known lineage
3. apply field-definition updates independently from template-definition updates
4. preserve lineage and provenance metadata
5. surface conflicts when local changes and upstream changes diverge materially

### Diff and re-import

Diff tooling may exist outside the core application.

The core system should still support re-import of a diff-derived update artifact so long as it can:

- identify the target definition lineage
- identify the base version expected by the diff
- validate applicability
- either apply cleanly or surface a conflict state

## Decision-context migration rules

### No in-context definition editing

A `DecisionContext` may edit:

- field values
- lock state
- visibility state
- transcript/context guidance attached to the working draft

A `DecisionContext` should not edit:

- field-definition semantics
- template-definition composition

### Migrating an open context

If an open context should adopt a newer version of the same template definition, treat that as an explicit migration event.

That migration should:

- update the pinned template-definition version
- update the resolved field-definition version set
- recompute visibility state
- preserve existing values
- optionally transform or regenerate unlocked fields when needed
- avoid synthetic field-value versions for unchanged values

Migration to a newer template-definition version should use the same operational semantics as template-to-template migration.

## Required implementation directions

Implementation should eventually add support for:

- field-definition identity and version lineage
- template-definition identity and version lineage
- template-to-field version references
- decision-context pinning of resolved template and field-definition versions
- import/export of definition packages
- local fork and upstream-tracking metadata
- explicit migration flows for open contexts

## Open questions

- Should local non-fork edits within the same lineage be allowed, or should every local divergence become an explicit fork?
- Should template-definition exports always include their dependent field definitions, or may they reference already-known shared packages?
- Should expert definitions be modeled in the same package/distribution system or in a parallel one?
- What compatibility rules should permit fast-forward adoption versus conflict review?
- What provenance and signature model is needed for trusted third-party definition sharing?

## Recommendation

Adopt the following planning stance:

- field definitions are the primary reusable and mergeable unit
- template definitions are pure compositions over field-definition versions
- templates must not override field semantics
- decision contexts pin exact resolved template and field-definition versions
- open-context adoption of new template versions is explicit migration, not implicit rebinding
- import/export and merge flows should operate at both field and template layers, with fields as the semantic base layer
