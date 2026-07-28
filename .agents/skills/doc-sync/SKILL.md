---
name: doc-sync
description:
  Ensures documentation stays synchronized with code changes, applies the touchpoint matrix, and enforces the
  documentation format.
---

# Skill: doc-sync

## Description

Ensures documentation stays synchronized with code changes. Applies the touchpoint matrix from
`documentation-maintenance.md` and enforces the documentation format from `documentation-format.md`.

## When to Use

After every code change, before running the completion gate. Core principle: "Documentation must be updated in the same
task as code/architecture changes."

## Instructions

### Step 1: Identify Changed Files

List all files you have created or modified in this session.

### Step 2: Apply the Touchpoint Matrix

For each changed file, determine the minimum documentation updates required. The categories below are examples — adapt
them to this repository's actual module/documentation layout, then keep the matrix itself up to date as new categories
emerge.

| Change Type                                                                                  | Minimum Docs to Update                                                                        |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| New/changed core module or its registration entry point                                      | The relevant architecture doc, plus the affected module's own doc                             |
| New instance of a repeated/pluggable pattern (e.g. a new checker, rule, or validation stage) | The "how to add a new X" guide, the architecture doc for that subsystem, relevant module docs |
| New validation/rejection rule or reason code                                                 | The rejection-rules/poisoning-resistance doc, the module doc                                  |
| Changes in startup/lifecycle flow                                                            | The AvNav plugin-lifecycle doc, the architecture doc for that boundary                        |
| Changes in shared helper/formatter contracts                                                 | The coding-standards doc's "Shared Utilities" mentions                                        |
| Quality-gate or tooling changes (checkers, config, hooks)                                    | The documentation-maintenance guide, `README.md`, `AGENTS.md`, `CLAUDE.md`                    |
| New documentation file                                                                       | The table of contents doc                                                                     |
| New/changed persistence, export, or API response shape                                       | Relevant architecture doc section, plus the matching `tests/mock-data/` fixture               |
| New/changed shared utility                                                                   | The coding-standards doc, "Shared Utilities" section                                          |
| New/changed configuration key                                                                | `documentation/user/configuration.md`, `README.md` if user-facing                             |

### Step 3: Update Each Affected Doc

For each doc identified in Step 2:

1. Read the current doc
2. Update sections that describe the changed behavior
3. Verify the doc still follows the mandatory format (see Step 4)
4. Ensure file paths, config keys, and API signatures are current

### Step 4: Enforce Documentation Format

Every documentation file MUST follow this structure (see `documentation/conventions/documentation-format.md`):

```markdown
# Title

**Status:** Current.

## Overview

One or two sentences explaining when to use the document.

## Key Details

Compact bullets, tables, signatures, config keys, constants, and file paths.

## Related

- Links to nearby source-of-truth docs.
```

**Forbidden content — do NOT include:**

- Verbose prose explanations
- "Why?" sections (keep rationale brief and implementation-tied)
- Large ASCII diagrams
- Excessive examples (max 1-2)
- "Future Enhancements" sections
- Empty sections
- Decorative formatting
- Machine-local absolute paths

**Required content — do NOT omit:**

- API function signatures with parameters
- Config keys with types and defaults
- File paths and code locations
- Reason codes, fixtures, and checker rule IDs when they are part of the contract
- Critical implementation details

### Step 5: Update the Table of Contents

If you created a new documentation file:

1. Open `documentation/TABLEOFCONTENTS.md`
2. Add a question→link entry in the appropriate section
3. Follow the existing format: `**"How do I ...?"** -> [doc-name.md](path/doc-name.md)`

**Reachability rule:** Every new doc must be linked from at least one other doc that is itself reachable from
`AGENTS.md`. The easiest way is adding an entry to the table-of-contents doc.

### Step 6: Update Root Agent Instructions (When Applicable)

**AGENTS.md / CLAUDE.md** — Update when:

- Architecture guidance changes
- New file map entries are needed
- Keep `AGENTS.md` canonical. Keep `CLAUDE.md` as a short pointer unless genuinely tool-specific notes are required.

### Step 7: Validate

Run the documentation validation checks:

```bash
npm run docs:check              # markdownlint, doc-links fixture proof, and the real Linkinator scan
```

The documentation-shape, table-of-contents, reachability, and smell-catalog-completeness contracts (the concerns a
sibling project's `check:doclinks`/`check:docformat`/`check:reachability` scripts cover) live as Vitest contract tests
here, reached through:

```bash
npm run test:tools -- tests/js/doc-format-contract.test.mjs tests/js/doc-toc-contract.test.mjs tests/js/doc-reachability-contract.test.mjs
```

Or run everything at once:

```bash
npm run check:all
```

Non-zero exit means docs are not consistent. Fix all failures before proceeding.

### Anti-Patterns

- ❌ Changing code without updating linked docs
- ❌ Creating a new doc without adding it to the table of contents
- ❌ Writing verbose "Why?" sections or "Future Enhancements"
- ❌ Using more than 1-2 examples per concept
- ❌ Leaving empty sections in docs
- ❌ Duplicating the full AGENTS.md rule catalog into CLAUDE.md
