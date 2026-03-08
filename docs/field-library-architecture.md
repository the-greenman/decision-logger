# Field Library Architecture

**Status**: authoritative
**Owns**: field-library schema, template composition model, field-level extraction prompt structure
**Must sync with**: `packages/schema`, `docs/OVERVIEW.md`, `docs/plans/iterative-implementation-plan.md`

## Core Concept

**Fields are the atomic units of decision documentation.**

- **Field Library**: A collection of reusable decision fields, each with its own definition and prompt
- **Decision Template**: A curated collection of fields for a specific decision type
- **Field Reuse**: Same field can appear in multiple templates

## Architecture

### 1. Canonical schema ownership

The canonical structural definitions for field-library entities live in `packages/schema/src/index.ts`.

Use those source-of-truth schema symbols when you need the exact shape of:

- `DecisionFieldSchema`
- `DecisionTemplateSchema`
- template field-assignment shapes

This document owns the semantics of the field library, not the full structural definitions.

### 2. Semantic model

#### Decision fields

A decision field is an atomic reusable definition that should carry:

- stable identity
- semantic intent
- extraction guidance
- field-type and validation hints
- versioned metadata

Important architectural rules:

- field identity is definition-level and stable
- field `name` is a programmatic key, not a user-facing label
- field prompts belong to the field definition, not the template
- templates reuse fields rather than duplicating them

#### Decision templates

A template is a curated composition of reusable fields.

Important architectural rules:

- templates reference fields by `fieldId`
- templates are versioned configuration artifacts
- template assignments control order and requiredness
- templates may provide broader workflow framing or grouping without changing field meaning
- templates do not own field history; they control active presentation
- decision contexts should bind to a specific template version rather than editing template structure in place

#### Template field assignments

A template field assignment should be treated as the place where template composition is configured.

Typical responsibilities include:

- field reference
- display order
- required flag
- optional grouping or layout metadata that does not redefine field semantics

#### Runtime boundary

Field definitions and template definitions should be managed independently from decision drafting.

When a `DecisionContext` is created, it should resolve and bind one specific template version plus the field-definition set referenced by that template version.

From that point onward, the context manages working state such as field values, locks, and visibility, but it should not directly edit field-library records or template-definition structure.

If an open context needs to adopt a newer version of the same template definition, that should be treated as an explicit template migration rather than an in-context template edit.

### 3. Field Library

#### Core Fields (Universal)

**decision_statement**
- **Category**: core
- **Description**: A clear, concise statement of what is being decided
- **Type**: short_text
- **Prompt**: "Extract a single sentence stating what decision is being made. Use active voice."
- **Used in**: All templates

**decision_context**
- **Category**: core
- **Description**: Background information and situation leading to this decision
- **Type**: long_text
- **Prompt**: "Summarize the context and background that led to this decision need."
- **Used in**: All templates

**decision_rationale**
- **Category**: core
- **Description**: Why this decision was made
- **Type**: long_text
- **Prompt**: "Explain the reasoning behind the chosen option."
- **Used in**: Most templates

#### Evaluation Fields

**evaluation_criteria**
- **Category**: evaluation
- **Description**: Criteria used to evaluate options
- **Type**: list
- **Prompt**: "List the criteria used to evaluate options. Format as bullet points."
- **Used in**: Standard Decision, Technology Selection, Strategy Decision

**options**
- **Category**: evaluation
- **Description**: Available options or alternatives considered
- **Type**: list
- **Prompt**: "List all options discussed. Include brief description of each."
- **Used in**: Standard Decision, Technology Selection, Strategy Decision

**evaluation_matrix**
- **Category**: evaluation
- **Description**: How each option scores against criteria
- **Type**: structured
- **Prompt**: "Create a comparison of options against criteria. Format as table or structured list."
- **Used in**: Technology Selection

**selected_option**
- **Category**: evaluation
- **Description**: The chosen option
- **Type**: short_text
- **Prompt**: "State which option was selected."
- **Used in**: Technology Selection, Strategy Decision

**rejected_options_rationale**
- **Category**: evaluation
- **Description**: Why other options were not chosen
- **Type**: long_text
- **Prompt**: "Explain why each rejected option was not selected."
- **Used in**: Technology Selection

#### Impact Fields

**consequences_positive**
- **Category**: impact
- **Description**: Positive outcomes and benefits
- **Type**: list
- **Prompt**: "List positive consequences and benefits. Focus only on upsides."
- **Used in**: Standard Decision, Strategy Decision, Policy Change

**consequences_negative**
- **Category**: impact
- **Description**: Negative outcomes and risks
- **Type**: list
- **Prompt**: "List negative consequences and risks. Focus only on downsides."
- **Used in**: Standard Decision, Strategy Decision, Policy Change

**stakeholder_impact**
- **Category**: impact
- **Description**: How different stakeholders are affected
- **Type**: structured
- **Prompt**: "Identify stakeholders and how each is impacted by this decision."
- **Used in**: Strategy Decision, Policy Change, Proposal Acceptance

**opportunity_cost**
- **Category**: impact
- **Description**: What we're giving up by choosing this option
- **Type**: long_text
- **Prompt**: "Describe what opportunities or alternatives are foregone by this choice."
- **Used in**: Strategy Decision, Budget Approval

#### Risk Fields

**risk_assessment**
- **Category**: risk
- **Description**: Identified risks and their severity
- **Type**: structured
- **Prompt**: "List risks with severity (high/medium/low) and likelihood."
- **Used in**: Technology Selection, Budget Approval, Strategy Decision

**risks_and_mitigations**
- **Category**: risk
- **Description**: Risks and how they will be addressed
- **Type**: structured
- **Prompt**: "For each risk, describe the mitigation strategy."
- **Used in**: Technology Selection, Strategy Decision

**assumptions**
- **Category**: risk
- **Description**: Underlying assumptions being made
- **Type**: list
- **Prompt**: "List assumptions underlying this decision. Focus on unstated premises."
- **Used in**: Standard Decision, Strategy Decision, Technology Selection

**reversibility**
- **Category**: risk
- **Description**: How easily this decision can be undone
- **Type**: short_text
- **Prompt**: "Describe how reversible this decision is and what it would take to undo it."
- **Used in**: Standard Decision, Technology Selection

#### Financial Fields

**budget_amount**
- **Category**: financial
- **Description**: Amount of money involved
- **Type**: numeric
- **Prompt**: "Extract the monetary amount (requested, approved, or spent)."
- **Used in**: Budget Approval

**roi_analysis**
- **Category**: financial
- **Description**: Return on investment analysis
- **Type**: structured
- **Prompt**: "Describe expected ROI, including timeline and metrics."
- **Used in**: Budget Approval, Technology Selection

**cost_breakdown**
- **Category**: financial
- **Description**: Detailed breakdown of costs
- **Type**: structured
- **Prompt**: "Break down costs by category (e.g., labor, materials, licenses)."
- **Used in**: Budget Approval

**budget_source**
- **Category**: financial
- **Description**: Where funding comes from
- **Type**: short_text
- **Prompt**: "Identify the budget line or funding source."
- **Used in**: Budget Approval

#### Stakeholder Fields

**proposer**
- **Category**: stakeholder
- **Description**: Who submitted the proposal
- **Type**: short_text
- **Prompt**: "Identify who proposed or submitted this."
- **Used in**: Proposal Acceptance

**approval_authority**
- **Category**: stakeholder
- **Description**: Who has authority to approve
- **Type**: short_text
- **Prompt**: "Identify who has the authority to approve this decision."
- **Used in**: Budget Approval, Policy Change

**affected_stakeholders**
- **Category**: stakeholder
- **Description**: List of stakeholders affected
- **Type**: list
- **Prompt**: "List all stakeholders or groups affected by this decision."
- **Used in**: Policy Change, Strategy Decision

**stakeholder_concerns**
- **Category**: stakeholder
- **Description**: Concerns raised by stakeholders
- **Type**: structured
- **Prompt**: "List concerns raised by stakeholders during discussion."
- **Used in**: Proposal Acceptance, Policy Change

**concerns_addressed**
- **Category**: stakeholder
- **Description**: How concerns were resolved
- **Type**: structured
- **Prompt**: "For each concern, describe how it was addressed or resolved."
- **Used in**: Proposal Acceptance

#### Implementation Fields

**implementation_plan**
- **Category**: implementation
- **Description**: How the decision will be executed
- **Type**: long_text
- **Prompt**: "Describe the implementation plan and key steps."
- **Used in**: Policy Change, Strategy Decision

**implementation_owner**
- **Category**: implementation
- **Description**: Who is responsible for execution
- **Type**: short_text
- **Prompt**: "Identify who will be responsible for implementing this decision."
- **Used in**: Proposal Acceptance, Policy Change

**timeline**
- **Category**: implementation
- **Description**: Key dates and milestones
- **Type**: structured
- **Prompt**: "List key dates, milestones, and deadlines."
- **Used in**: Strategy Decision, Budget Approval, Policy Change

**success_metrics**
- **Category**: implementation
- **Description**: How success will be measured
- **Type**: list
- **Prompt**: "List metrics that will indicate if this decision was successful."
- **Used in**: Technology Selection, Strategy Decision

**next_steps**
- **Category**: implementation
- **Description**: Immediate actions to take
- **Type**: list
- **Prompt**: "List the immediate next steps following this decision."
- **Used in**: Proposal Acceptance, Standard Decision

#### Governance Fields

**compliance_requirements**
- **Category**: governance
- **Description**: Legal or regulatory requirements
- **Type**: list
- **Prompt**: "List any legal, regulatory, or compliance requirements."
- **Used in**: Policy Change, Budget Approval

**approval_conditions**
- **Category**: governance
- **Description**: Conditions attached to approval
- **Type**: list
- **Prompt**: "List any conditions or constraints on the approval."
- **Used in**: Budget Approval, Proposal Acceptance

**review_triggers**
- **Category**: governance
- **Description**: When to review this decision
- **Type**: list
- **Prompt**: "List events or conditions that should trigger a review of this decision."
- **Used in**: Standard Decision, Strategy Decision, Policy Change

**review_date**
- **Category**: governance
- **Description**: Scheduled review date
- **Type**: date
- **Prompt**: "Extract when this decision should be reviewed."
- **Used in**: Technology Selection, Policy Change

### 4. Template Definitions (Using Field Library)

#### Standard Decision Template
```typescript
{
  id: "standard-decision",
  name: "Standard Decision",
  category: "general",
  fields: [
    { fieldId: "decision_statement", order: 1, required: true },
    { fieldId: "decision_context", order: 2, required: true },
    { fieldId: "evaluation_criteria", order: 3, required: false },
    { fieldId: "options", order: 4, required: false },
    { fieldId: "decision_rationale", order: 5, required: true },
    { fieldId: "consequences_positive", order: 6, required: false },
    { fieldId: "consequences_negative", order: 7, required: false },
    { fieldId: "assumptions", order: 8, required: false },
    { fieldId: "reversibility", order: 9, required: false },
    { fieldId: "review_triggers", order: 10, required: false }
  ]
}
```

#### Technology Selection Template
```typescript
{
  id: "technology-selection",
  name: "Technology Selection",
  category: "technical",
  fields: [
    { fieldId: "decision_statement", order: 1, required: true },
    { fieldId: "decision_context", order: 2, required: true, 
      customLabel: "Problem Statement" }, // Override label
    { fieldId: "evaluation_criteria", order: 3, required: true,
      customLabel: "Requirements" }, // Override label
    { fieldId: "options", order: 4, required: true,
      customLabel: "Options Evaluated" },
    { fieldId: "evaluation_matrix", order: 5, required: true },
    { fieldId: "selected_option", order: 6, required: true },
    { fieldId: "decision_rationale", order: 7, required: true,
      customLabel: "Selection Rationale" },
    { fieldId: "rejected_options_rationale", order: 8, required: false },
    { fieldId: "risks_and_mitigations", order: 9, required: false },
    { fieldId: "success_metrics", order: 10, required: false },
    { fieldId: "review_date", order: 11, required: false }
  ]
}
```

#### Budget Approval Template
```typescript
{
  id: "budget-approval",
  name: "Budget Approval",
  category: "financial",
  fields: [
    { fieldId: "decision_statement", order: 1, required: true },
    { fieldId: "budget_amount", order: 2, required: true },
    { fieldId: "decision_context", order: 3, required: true,
      customLabel: "Business Justification" },
    { fieldId: "roi_analysis", order: 4, required: true },
    { fieldId: "cost_breakdown", order: 5, required: false },
    { fieldId: "budget_source", order: 6, required: true },
    { fieldId: "timeline", order: 7, required: true },
    { fieldId: "risk_assessment", order: 8, required: false },
    { fieldId: "approval_conditions", order: 9, required: false },
    { fieldId: "review_date", order: 10, required: false }
  ]
}
```

### 5. Persistence ownership

The canonical structural definitions for field-library persistence belong in:

- `packages/schema/src/index.ts`
- `packages/db`

This document should not restate the exact SQL or full structural shape.

Instead, the field-library persistence model must support:

- durable field definitions with stable identity and versioning
- durable template definitions with stable identity and versioning
- many-to-many template field assignments
- template-local ordering and requiredness
- template-local label/description overrides
- prompt/configuration data attached to fields rather than duplicated across templates

### 6. Prompt Organization

```
prompts/
├── decision-detection.md           # Includes template classification
└── templates/
    ├── standard-decision.json      # Template field references and ordering
    ├── technology-selection.json
    ├── budget-approval.json
    └── ...
```

Field extraction prompts should not be maintained as separate per-field prompt files.

Instead:

- the canonical prompt guidance lives on the field definition itself
- templates select fields, but do not duplicate their extraction prompts
- prompt refinement should update the field-library record rather than a parallel prompt-file tree

### 7. Benefits

✅ **Field Reuse**: "decision_statement" defined once, used in all templates  
✅ **Consistent Extraction**: Same field always uses same prompt  
✅ **Easy Refinement**: Improve "options" prompt → improves all templates using it  
✅ **Template Flexibility**: Mix and match fields for new decision types  
✅ **Custom Templates**: Users can create templates from field library  
✅ **Prompt Versioning**: Each field has its own version history  

### 8. Implementation

> **Implementation Note**: The `DraftGenerationService` and its methods, including `regenerateField`, are defined in Milestone 1 and Milestone 4 of `docs/plans/iterative-implementation-plan.md`. That document is the authoritative source for the implementation, which uses a layered architecture with a dedicated `ILLMService` and `PromptBuilder`.

### 9. CLI Workflow

```bash
# List all fields in library
decision-logger field list
# Core Fields:
#   - decision_statement: A clear statement of what is being decided
#   - decision_context: Background and situation
# Evaluation Fields:
#   - evaluation_criteria: Criteria used to evaluate options
#   - options: Available options considered
# ...

# View field details
decision-logger field show options
# Field: Options
# Category: Evaluation
# Type: list
# Description: Available options or alternatives considered
# Used in: 5 templates (Standard Decision, Technology Selection, ...)

# List templates
decision-logger template list
# 1. Standard Decision (10 fields)
# 2. Technology Selection (11 fields)
# 3. Budget Approval (10 fields)
# ...

# View template composition
decision-logger template show technology-selection
# Template: Technology Selection
# Fields:
#   1. decision_statement (required)
#   2. problem_statement (required) [custom label for: decision_context]
#   3. requirements (required) [custom label for: evaluation_criteria]
#   4. options_evaluated (required) [custom label for: options]
#   ...

# Create custom template from fields
decision-logger template create "Vendor Selection" \
  --fields decision_statement,decision_context,evaluation_criteria,options,roi_analysis,risk_assessment \
  --category technical
```

### 10. Implementation Sequence

1. **Phase 1**: Define field-library schemas and normalized database tables
2. **Phase 2**: Seed the field library and core templates
3. **Phase 3**: Update LLM services to resolve fields through the library
4. **Post-MVP**: Enable custom template creation once the core workflow is stable
