# CLAUDE.md - Pointer to Canonical Instructions

This file is a pointer, not a copy. The canonical instructions for every agent working in this repository, including
Claude, live in [AGENTS.md](AGENTS.md). Read it in full before planning, coding, review, or documentation edits.

## Mandatory Preflight (No Exceptions)

Before any task, read, in this order:

1. `documentation/TABLEOFCONTENTS.md`
2. `documentation/conventions/coding-standards.md`
3. `documentation/conventions/smell-prevention.md`

Then read [AGENTS.md](AGENTS.md) for the full project standards, workflow, quality checklist, anti-pattern rules, and
README/fixture sync rules. Do not re-expand this file into a duplicate of AGENTS.md; keep it a short pointer so the two
can never drift out of sync.

## Claude-Specific Notes

- Keep responses concise and cite exact files when reporting changes.
- Prefer targeted reads through `documentation/TABLEOFCONTENTS.md` over broad context loading.
- Do not use polished verification language unless deterministic gate output and actual files have been inspected.
