---
name: grill-me-repo
description:
  Interviews the user about a planned feature, grounded in the actual repository, and resolves design branches one by
  one with recommended answers.
---

# Skill: grill-me-repo

## Description

Interview the user relentlessly about every aspect of a planned feature, grounded in the actual repository. Walk down
each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide a
recommended answer based on codebase exploration. Ask questions one at a time. If a question can be answered by
exploring the codebase, explore the codebase instead of asking.

## When to Use

Before creating an execution plan (`create-plan` skill) for any medium-to-complex feature. Also useful when requirements
are ambiguous or when the user says "I want to add X" without specifying how.

## Instructions

### Interview Protocol

1. Ask ONE question at a time.
2. For each question, provide YOUR recommended answer based on codebase analysis.
3. Wait for the user to confirm, modify, or reject before proceeding.
4. If a question can be answered by reading the codebase, read the code instead of asking.
5. Track decisions in a structured log as you go.

### Decision Tree: Walk These Branches In Order

#### Branch 1: Category / Layer Selection

**Explore first:** Read this repository's coding standards or conventions documentation for any documented catalog of
module categories or architectural layers.

Questions to resolve:

- What kind of output or behavior does this feature produce? (Identify the closest categories this repository already
  distinguishes between — e.g. a validation rule, a domain helper, a viewer module, a quality-gate checker.)
- Does it match an existing category/layer? Find and read at least one existing implementation of that category to
  confirm the match.
- If not, is a brand-new category justified? (Read existing implementations first to check whether one can be extended
  or generalized instead of creating a new one.)

**Codebase check:** Read any category/layer catalog and at least one reference implementation. Recommend the closest
match.

#### Branch 2: Grouping / Placement

**Explore first:** Read the directories or config that define how this repository groups related modules together
(packages, layers, rule families — whatever the repository's own organizing unit is).

Questions to resolve:

- Which existing group does this feature belong to? Enumerate the groups that already exist and ask the user to pick
  one, or confirm none fit.
- If it belongs to an existing group: what related items already live there? Is there existing shared state,
  configuration, or data that can be reused?
- If a new group is needed: ask the user to identify the naming convention this repository uses for such groups and for
  the top-level items within them, by reading an existing example end-to-end.

**Codebase check:** Read the relevant grouping/config file and any file that maps or wires that group together.

#### Branch 3: Data Model

**Explore first:** Read how existing, similar features source their input data in this repository.

Questions to resolve:

- What is the underlying data source for this feature? (Ask the user to identify the equivalent concept in this project
  — e.g. an AvNav store key, a config value, a persisted `polar.json` field — by pointing at how a similar existing
  feature sources its data.)
- What normalization is needed? (numeric coercion, unit conversion, null/undefined handling)
- Is a shared intermediate model needed? (Multiple consumers sharing the same normalized data → yes)
- What is the "no data" / stale / invalid state, and how should it be represented?

**Codebase check:** Read the directory or module where existing shared/normalized data models live, if one exists.

#### Branch 4: Output Surface

**Explore first:** Read whatever file or config maps features/modules to their output surface (an API endpoint, a viewer
tab, an export format, a quality-gate report) in this repository.

Questions to resolve:

- What output surface does this feature use? (Ask the user to name the surfaces/mechanisms this repository already
  supports — e.g. the status API, the export CSV, a new checker's SUMMARY_JSON — and pick the closest fit.)
- If it reuses an existing surface: which shared implementation handles it? Which extension points does this feature
  need to use?
- If it needs a new surface: what is the ownership split between the pieces involved (e.g. collection vs. formatting vs.
  presentation)? Does it need a dedicated module for each concern, following this repository's existing pattern for that
  split?

#### Branch 5: Trigger / Threshold Conditions

Questions to resolve:

- How many decision states does this feature need? (Ask the user to identify how many states comparable existing
  features support, and what triggers switching between them — e.g. accepted/rejected/quarantined.)
- What are the thresholds or conditions that trigger each state? (check existing similar features for precedent)
- Any special edge-case behavior that forces a particular state?

**Codebase check:** Read a reference implementation's state-transition logic end-to-end.

#### Branch 6: Configurable / User-Facing Parameters

**Explore first:** Read this repository's documentation or code for the mechanism it uses to expose user-configurable
settings (`params.py`, a settings schema, a validated config file — whatever this project's equivalent is).

Questions to resolve:

- What user-configurable settings are needed for this feature?
- What types does the configuration mechanism support here, and which type fits each setting? (string, number, boolean,
  enum/select, reference-to-another-value, etc. — ask the user to confirm against what this repository's mechanism
  actually offers.)
- What are the sensible default values for each?
- Are there conditions under which a setting should or shouldn't apply? (e.g. only for a specific rule family, or only
  in combination with another setting)
- Are there settings that repeat across multiple similar instances? Does this repository have an existing pattern for
  factoring those out, or should this be standalone?

#### Branch 7: Formatting / Presentation of Values

Questions to resolve:

- Ask the user to identify which existing formatting/presentation utilities in this repository apply to this feature's
  output values (e.g. `units.py`, `Polarrecorder.Placeholders`, timeline formatting).
- What formatter parameters or options are needed?
- Should the formatting choice be configurable/passed through by the caller, or hard-coded by the feature itself?

**Codebase check:** Read this repository's documentation or catalog of available formatting utilities, if one exists.

#### Branch 8: Interaction Model (For Interactive/API-Facing Kinds Only)

**Explore first:** Read whatever module in this repository centralizes dispatching of API requests or side effects, if
one exists.

Questions to resolve:

- Is this feature interactive/API-facing or purely internal/display-only?
- If interactive: what actions or side effects does it trigger, and through what existing mechanism? Ask the user to
  name the equivalent action-dispatch pattern this repository already uses elsewhere (e.g. `api_dispatch.py`).
- Context-specific behavior: are there contexts/modes where the action should be allowed vs. suppressed?
- How should validation/rejection gating be structured, if this repository has a pattern for that?
- What named handlers or callbacks are needed?

**Codebase check:** Read this repository's documentation on the relevant boundary, and find one existing similar feature
to use as a reference pattern.

#### Branch 9: Cross-Cutting Contracts

Questions to resolve:

- Does the feature need to respond to a shared contract this repository already enforces (a schema, a coverage floor, a
  hotspot budget, a namespace convention)? Which existing owner covers it?
- Does it need a new shared primitive, or does an existing shared module already cover it?
- Is feature-local logic needed? What should the feature own vs. what should a shared/parent layer own?

#### Branch 10: File Organization

Questions to resolve:

- What files need to be created? (List each with its ownership role.)
- Can any existing modules be reused without modification?
- Will any file risk exceeding this repository's size/complexity limits, if it has documented ones? (Plan the split
  early if so.)

### Output: Decision Log

After completing all branches, produce a structured decision log:

```markdown
## Design Decision Log

### Category / Layer

- Match: {category/layer}
- Shared implementation reused: {module/engine}
- Reference: {file path}

### Grouping

- Group: {name}
- Item/kind: {name}
- New group: {yes/no}

### Data Model

- Data sources: {list}
- Shared model: {yes/no, name}
- No-data / stale behavior: {description}

### Output Surface

- Type: {surface/mechanism}
- Collection owner: {module}
- Formatting owner: {module}

### Trigger / Threshold Conditions

- States: {list}
- Thresholds/conditions: {list}
- Special cases: {edge-case behavior}

### Configurable Parameters

- {name}: {type}, default {value}, condition {condition}

### Formatting

- Formatters/utilities used: {list with parameters}

### Interaction

- Model: {passive / context-aware dispatch}
- Actions/side effects: {list}
- Named handlers: {list}
- Validation/rejection gate: {description}

### Files to Create

- {path}: {ownership role}

### Open Questions

- {Any unresolved decisions}
```

This log feeds directly into the `create-plan` skill's Verified Baseline and Implementation Order sections.
