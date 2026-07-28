---
name: create-plan
description:
  Creates multi-session execution plans for complex features in this repository and encodes the canonical plan structure
  with repository-verification safeguards.
---

# Skill: create-plan

## Description

Creates multi-session execution plans for complex features in this repository. Encodes the canonical plan structure
derived from the repository's completed and active execution plans. Includes automated baseline verification against the
live repo to prevent the "rewritten after repository verification" failure mode.

## When to Use

When implementing a feature that involves:

- Multi-file changes spanning core logic, runtime, and shared-utility layers
- A new module kind or new module
- Refactors touching boundaries, dependencies, or checks
- Any unclear requirement or high ambiguity

The developer must decide to use planning mode before prompting (per your project's contribution guidelines).

## Instructions

### Step 0: Pre-Plan Interview (Recommended)

Before writing the plan, use an interview-style skill (if one is available in this repository) to interview the user
about every design decision. The interview should produce a structured decision log that feeds into this plan.

If the user declines the interview, proceed directly to Step 1 but flag any assumptions explicitly in the Verified
Baseline.

### Step 1: Write the Plan Header

```markdown
# PLAN{N} — {Title}

## Status

Written after repository verification and concept review.

This plan includes [describe what the plan covers]. The coding agent may choose equivalent implementations for [describe
flexibility areas] as long as the behavioral, structural, and documentation outcomes below are met. [List any plan-level
contracts that must be followed as specified.]

---
```

Title should be: `{Feature Name} ({component/context})`

### Step 2: Write the Goal Section

```markdown
## Goal

{1-2 sentence goal statement.}

Expected outcomes after completion:

- {Outcome 1: What the feature does}
- {Outcome 2: Behavior modes and edge-case behavior, if applicable}
- {Outcome 3: Data contracts and formatting}
- {Outcome 4: Interaction/API model}
- {Outcome 5: Architectural compliance (module pattern, shared helper conventions, lifecycle, fail-closed,
  smell-prevention, file-size)}
- {Outcome 6: Documentation and tests cover the new feature end-to-end}

---
```

### Step 3: Verify the Baseline Against the Live Repo

This is the critical step that prevents plan rewrites. For each assertion, **actually read the repo file** and confirm
the fact.

```markdown
## Verified Baseline

The following points were rechecked against the repository before this plan:

1. {Reference implementation}: {What it does and how it's structured}
2. {Lifecycle owner}: {What it owns and its contract}
3. {Routing/registration metadata}: {Current state, where new entries must go}
4. {Routing/registration metadata}: {Current inventory, where new modules must go}
5. {Dispatch/branching logic}: {Current branches, how new kinds are added}
6. {Shared utilities}: {Available helpers relevant to this feature}
7. {Config}: {Current config keys, editables, kind list}
8. {Cross-cutting contract}: {Relevant shape/schema contracts}
9. {Boundary}: {If interactive/networked, what capabilities exist}
10. {Confirmed absence}: {No existing code for this feature exists}

---
```

**Verification checklist — read these files:**

- The file(s) that hold current route/registration tuples for this kind of feature
- The file(s) that hold the current dispatch or branching logic that a new kind must extend
- The file(s) that register modules of this kind, to see current registrations
- The config file that defines keys and editable settings for the relevant grouping
- The controller or module that owns lifecycle for this kind of feature (creation, teardown, update)
- Your project's shared-utility directory — check for reusable helpers before writing new ones
- The module that exposes host/boundary actions, if the feature is interactive
- The reference implementation file for the chosen archetype

### Step 4: Write the Concept Specification (If Applicable)

For features with layout, interaction, or data-formatting complexity:

```markdown
## Concept Specification

This section is the authoritative behavioral specification for the {feature}.

### Exposed Settings

{Each editable parameter: name, type, default, behavior, mode-specific effects}

### Behavior Concept

{Mode resolution rules, state transitions, edge-case behavior}

### Data Contracts

{Config/store keys, normalization rules, formatting rules}

### Interaction Model

{API/action behavior per context, dispatch vs passive, handler names}
```

### Step 5: Write Architecture Notes

```markdown
## Architecture Notes

These notes anchor the plan. They are descriptive, not prescriptive.

### How {reference} serves as the template

{Describe the canonical flow and how this feature differs}

### {Technical concern 1}

{Description and consequence}

### {Technical concern 2}

{Description and consequence}

---
```

### Step 6: Write Hard Constraints

```markdown
## Hard Constraints

### Architecture

- Do not change the host integration/registration strategy.
- Do not introduce a new module system or build step; follow the project's existing module pattern.
- Do not add a second mechanism for a concern the project already owns centrally; reuse the existing one.
- Do not duplicate shared utilities. {Feature-specific architecture constraints}

### File organization

- {File list with ownership descriptions}
- {Domain/model location}
- {Boundary/adapter owner locations}
- Each file must stay within the project's line-count budget (check your project's conventions for the exact number).
- The line-count limit is absolute and overrides all other plan guidance. If any phase would push a file over the limit,
  that phase must include a split step. Plans must not assume agents will use one-liner compression as a workaround.
- For implementation phases that touch files already close to the limit, include an explicit note: "Check file size
  before and after; split if approaching the limit."

### Behavioral

- {Specific behavioral contracts that must be followed exactly}
- {Validation rules}
- {Formatting rules}
- {Interaction rules}

### Scope

- Do not change existing {reference implementation} code or tests.
- Do not change {lifecycle owner} internals.
- Do not perform source-code changes in the documentation phase.
- Do not leave a permanent plan/phase citation in shipped code, docs, or tests outside the plans directory; describe
  results standalone instead (a literal plan-file-path reference is still fine).

---
```

### Step 7: Write the Implementation Order

Structure as phased steps with explicit dependencies:

```markdown
## Implementation Order

### Phase A — {Name}

**Intent:** {what this phase achieves} **Dependencies:** {none / an earlier phase's name}

#### A1. {Sub-step title}

{Detailed instructions: contract, file to create, code template}

#### A2. {Test sub-step}

{What to test, coverage requirements}

#### A3. {Registration sub-step}

{Where to register, code snippet}

### Phase B — {Name}

...

### Phase N — Documentation

**Intent:** create/update documentation without source-code changes.

#### NA. Create the feature's documentation page

{Content requirements following your project's documentation-format conventions}

#### NB. Update the documentation index/table of contents

{Entries to add}

#### NC. Update related guidance

{README, contributor guide, agent instructions, or other workflow docs if applicable}

---
```

### Step 8: Write Acceptance Criteria

```markdown
## Acceptance Criteria

- [ ] {Feature works: specific testable behavior}
- [ ] {Modes: transitions correct, if applicable}
- [ ] {Interaction: dispatch/passive behavior per context}
- [ ] {Edge cases: empty data, disconnect, missing fields}
- [ ] {Cross-cutting contracts: schema/shape validated}
- [ ] {Boundary behavior: fallback/error paths covered}
- [ ] All new files within the project's line-count budget
- [ ] No smell-prevention violations
- [ ] Documentation complete and linked from the documentation index
- [ ] The project's full check/test suite passes
```

### Step 9: Save the Plan

Save to the repository's active-plans directory, e.g. `exec-plans/active/PLAN{N}.md`.

After the plan is fully implemented and verified, move it to the corresponding completed-plans directory, e.g.
`exec-plans/completed/PLAN{N}.md`.

### Anti-Patterns

- ❌ Writing a plan without reading the live repo (leads to "rewritten after verification")
- ❌ Making the plan prescriptive about code-level details when multiple solutions work
- ❌ Omitting the Verified Baseline section
- ❌ Omitting the Hard Constraints section
- ❌ Putting the Documentation Phase inside a coding phase
- ❌ Forgetting acceptance criteria
- ❌ Plans over 1500 lines (split into multiple phases/plans if needed)
- ❌ Leaving a permanent plan/phase citation in shipped code, docs, or tests outside the plans directory; see your
  project's exec-plan authoring guidance for the exact citation rule and how it is enforced
