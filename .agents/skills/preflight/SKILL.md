---
name: preflight
description:
  Mandatory session bootstrap for every task in this repository. Reads required docs, routes to task-relevant docs, and
  produces a structured context summary. Must run before any planning, coding, review, or documentation work.
---

# Skill: preflight

## Description

Mandatory session bootstrap for every task in this repository. Reads required docs, routes to task-relevant docs, and
produces a structured context summary. Must run before any planning, coding, review, or documentation work.

## When to Use

Every single session. No exceptions. Before you write a single line of code, before you open a plan, before you touch
documentation.

## Instructions

### Step 1: Read the Mandatory Files

Read these files in this order. Do not skip any of them.

1. `documentation/TABLEOFCONTENTS.md` (or the repository's equivalent top-level documentation index)
2. `documentation/conventions/coding-standards.md`
3. `documentation/conventions/smell-prevention.md`

If any of these paths do not exist in the repository, look for the nearest equivalent (a documentation index, a
coding-standards document, and an anti-pattern/code-smell document) before proceeding. If no such documents exist at
all, note that explicitly in the context summary in Step 4 rather than silently skipping this step.

### Step 2: Classify the Task

Determine which category the task falls into. Use the repository's own vocabulary for feature types where it differs
from the generic labels below:

| Category                 | Signal                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| New module               | "add", "new checker", "new module", request to build a new unit      |
| New variant of a pattern | Request matches an existing family of modules with a shared contract |
| New integration/adapter  | "integration", "adapter", "connector", "new kind of interface"       |
| Refactor / cleanup       | "refactor", "cleanup", "extract", "consolidate"                      |
| Documentation            | "docs", "document", "update docs", "sync docs"                       |
| Bug fix                  | "fix", "broken", "regression", "failing"                             |
| Plan creation            | "plan", "design", "architecture plan", "exec-plan"                   |

### Step 3: Route to Task-Specific Docs

Based on the category, read ONLY the additional docs listed below (adjust paths to match this repository's actual
layout). Never read all docs sequentially.

**New module:**

- The repository's "how to add a new X" guide, if one exists (commonly under `documentation/guides/`)
- The relevant style guide for that category of module
- Reference: an existing, representative implementation of the same kind

**New variant of an existing pattern:**

- The style guide for that pattern family
- Reference: the most recently added sibling implementation, to confirm the pattern is still current

**New integration/adapter:**

- The architecture document describing how integrations/adapters are wired into the system
- The module registry or contract document, if the repository has one

**Refactor / cleanup:**

- `documentation/conventions/smell-prevention.md` (or equivalent)
- `documentation/guides/documentation-maintenance.md` (or equivalent)

**Documentation:**

- `documentation/guides/documentation-maintenance.md`
- `documentation/conventions/documentation-format.md`

**Bug fix:**

- The architecture document for the subsystem the bug lives in, if the bug is subsystem-related
- The specific module documentation referenced in the bug's file header or nearest doc comment

**Plan creation:**

- `documentation/core-principles.md`
- The top-level architecture document (commonly `ARCHITECTURE.md`)
- The relevant guide for the pattern/category involved
- Existing completed plans (read structure only, not full content)

### Step 4: Produce Context Summary

After reading, produce a short structured summary for yourself (do not output this to the user unless asked):

```text
TASK: [one-line description]
CATEGORY: [from Step 2]
PATTERN/ARCHETYPE: [pattern or module family if applicable, else "N/A"]
SHARED ENGINE/UTILITY: [name if applicable, else "N/A"]
REFERENCE IMPL: [file path if applicable, else "N/A"]
KEY CONSTRAINTS:
- [runtime/build constraints from the repository's own conventions]
- [any hard limits on file size, module structure, or dependency use — repo rules override any plan document]
- [task-specific constraints from docs read]
RELEVANT SHARED UTILITIES: [list from coding-standards.md, if such a section exists]
ACTIVE ANTI-PATTERN RULES: [list rules most likely to trigger for this task type]
COMPLETION GATE: [the repository's standard check/test command, e.g. `npm run check:all` or equivalent]
```

### Step 5: Verify Precedence

If any guidance conflicts during the task, apply this precedence:

1. `documentation/core-principles.md`
2. `documentation/conventions/coding-standards.md`
3. `documentation/conventions/smell-prevention.md`
4. Task-specific documentation

### Step 5.5: File-Size Awareness Check

Before starting implementation, check whether any file you will modify is already close to the repository's documented
size limit (if one exists):

```bash
wc -l <file>
```

If a file is already large and your task will add significant code to it, plan the split upfront — do not defer it to
"later" or assume a plan document will handle it. Hard size limits documented in the repository's conventions are
absolute and take precedence over any plan document.

### Anti-Patterns

- Reading all documentation files sequentially
- Re-reading the same docs repeatedly within a session
- Starting implementation before completing preflight
- Skipping the smell-prevention/anti-pattern document because "it's just a cleanup task"
- Reading verbose examples when not implementing a matching pattern
