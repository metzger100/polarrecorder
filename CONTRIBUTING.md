# Contributing

**Status:** Current.

## Overview

Contributions follow the documentation preflight and the deterministic quality gate. The project values small scoped changes that keep code, tests, and documentation synchronized.

## Local development setup

The runtime stays stdlib-only, but the quality gate needs dev-only tooling. Install it once into a project-local virtual environment:

```sh
python3 -m venv venv
venv/bin/pip install ruff mypy pytest pytest-cov coverage
```

The git pre-push hook and `tools/check-all.sh` automatically prepend `venv/bin` to `PATH`, so no manual activation is needed. To use a virtual environment elsewhere, point both at it with the `POLARRECORDER_VENV` environment variable:

```sh
export POLARRECORDER_VENV=/path/to/venv
```

Install the pre-push hook (sets `core.hooksPath` to `.githooks`) with:

```sh
npm run hooks:install
```

The Node.js checks run directly via `node` and need no `npm install`.

## Key Details

- Read `documentation/TABLEOFCONTENTS.md`, `documentation/conventions/coding-standards.md`, and `documentation/conventions/smell-prevention.md` before changing code or docs.
- For complex multi-session work, write a fresh execution plan using `documentation/guides/exec-plan-authoring.md`.
- Run `tools/check-all.sh` before handing off changes.
- Do not add runtime dependencies, generated build artifacts, unrelated product logic, or raw reference-source copies.

## Change workflow

- Keep each change small and self-consistent. A commit should be independently green: it must pass `tools/check-all.sh` on its own, not rely on a later commit to fix what it broke.
- For multi-file work that touches domain modules, persistence, validation, the API shape, or the viewer together, plan the change before editing. For complex multi-session work, author a fresh execution plan (`documentation/guides/exec-plan-authoring.md`).
- Repo rules and core principles override execution-plan instructions. A plan is the source of truth for *what* to build, but it cannot waive a mechanically enforced repo rule (the 400-line limit, the gate, coverage thresholds, blocking smells). If a plan conflicts with a repo rule, amend the plan.
- When behavior changes, update the mapped documentation, fixtures, and tests in the same change (see `CLAUDE.md` Sections 9 and 10).

## Review expectations

- The author owns final correctness, architecture, and documentation quality; the gate is a floor, not a substitute for review.
- Reject weakened test assertions, lowered coverage thresholds, skipped checks, and suppressed smells introduced only to obtain a green gate. A passing `tools/check-all.sh` must reflect real, current behavior — fix the root cause instead. When unsure how to fix a specific smell, follow [the smell-fix playbooks](documentation/conventions/smell-fix-playbooks.md).

## Enforcement model

- Every smell rule in this project is **blocking**: there is no warn-only tier or deferred cleanup ledger. A rule either holds repo-wide in the same change or it is not added.
- Adding or changing a custom check is part of the same change as the behavior it governs. A new `tools/check-patterns.mjs` rule must ship with a positive and a clean test case in `tools/test-check-patterns.mjs` (`npm run test:tools`); new Python checkers ship with a `tests/test_*_checker.py`. Before adding a rule to the gate, run it across the whole repo and drive the violation count to zero so the gate stays green from the first commit.

## Related

- [Agent instructions](AGENTS.md)
- [Coding standards](documentation/conventions/coding-standards.md)
- [Smell prevention](documentation/conventions/smell-prevention.md)
- [Documentation maintenance](documentation/guides/documentation-maintenance.md)
