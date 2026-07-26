# Contributing

**Status:** Current.

## Overview

Contributions follow the documentation preflight and the deterministic quality gate. The project values small scoped changes that keep code, tests, and documentation synchronized.

## Local development setup

Development requires Node 26 and npm 12.0.1 (declared in `package.json`'s `engines`/`packageManager`)
plus a supported developer Python (`tools/quality-policy/developer-python.json`). The runtime stays
stdlib-only; the quality gate needs dev-only tooling, provisioned once with:

```sh
npm run setup
```

This runs `npm ci` (locked Node dev tools), creates/updates a project-local `venv` from the frozen developer-Python contract (`tools/quality-policy/developer-python.json`, currently Python 3.14.x) and installs the hash-locked `requirements-dev.txt` with `pip install --require-hashes`, and provisions a checksum-verified `actionlint` binary into a persistent cache outside the repository. `npm run setup` is the only command allowed to touch the network; every other check runs offline against what it installed.

The git pre-push hook automatically prepends `venv/bin` to `PATH`, so no manual activation is needed. To use a virtual environment elsewhere, point it at the hook with the `POLARRECORDER_VENV` environment variable:

```sh
export POLARRECORDER_VENV=/path/to/venv
```

Regenerating the hash-locked `requirements-dev.txt` from `requirements-dev.in` is a separate, maintainer-only, network-using step (never run by a gate):

```sh
npm run requirements:lock
```

Install the pre-push hook (sets `core.hooksPath` to `.githooks`) with:

```sh
npm run hooks:install
```

Verify the hook is active at any time with `npm run hooks:doctor`; it prints the exact repair
command if the hook path is unset, points elsewhere, or the hook file is missing or not
executable.

## Key Details

- Read `documentation/TABLEOFCONTENTS.md`, `documentation/conventions/coding-standards.md`, and `documentation/conventions/smell-prevention.md` before changing code or docs.
- For complex multi-session work, write a fresh execution plan using `documentation/guides/exec-plan-authoring.md`.
- Run `npm run check:all` before handing off changes (`tools/check-all.sh` is a compatibility wrapper around the same command).
- Do not add runtime dependencies, generated build artifacts, unrelated product logic, or raw reference-source copies.
- Standard maintained tools (Ruff, mypy, ESLint, Stylelint, jscpd, markdownlint-cli2, Linkinator, actionlint, c8) own every rule they can express; a focused custom checker is added only when no maintained tool covers the rule, and it ships with its own self-test in the same change.
- `npm run format`/`format:check` (write/check Prettier + Ruff formatting), `npm run check:standard` (formatting, lint, actionlint, duplication), `npm run check:fast` (a faster iteration subset: `check:standard`, `typecheck`, `test:split`, `check:python-contracts`), `npm run check:core` (the full literal non-coverage gate), `npm run test:split` (Python then Node tests), and `npm run check:all` (`check:core` plus coverage) are documented in full in [quality gates](documentation/conventions/quality-gates.md).
- Releases are prepared, validated, and created locally (`npm run release:prepare`, manual notes/version review, `npm run release:create -- --version=X.Y.Z`, then `git push --tags`); see the [release workflow guide](documentation/guides/release-workflow.md).

## Change workflow

- Keep each change small and self-consistent. A commit should be independently green: it must pass `npm run check:all` on its own, not rely on a later commit to fix what it broke.
- For multi-file work that touches domain modules, persistence, validation, the API shape, or the viewer together, plan the change before editing. For complex multi-session work, author a fresh execution plan (`documentation/guides/exec-plan-authoring.md`).
- Repo rules and core principles override execution-plan instructions. A plan is the source of truth for _what_ to build, but it cannot waive a mechanically enforced repo rule (the 400-line limit, the gate, coverage thresholds, blocking smells). If a plan conflicts with a repo rule, amend the plan.
- When behavior changes, update the mapped documentation, fixtures, and tests in the same change (see `AGENTS.md` Sections 9 and 10).

## Review expectations

- The author owns final correctness, architecture, and documentation quality; the gate is a floor, not a substitute for review.
- Reject weakened test assertions, lowered coverage thresholds, skipped checks, and suppressed smells introduced only to obtain a green gate. A passing `npm run check:all` must reflect real, current behavior — fix the root cause instead. When unsure how to fix a specific smell, follow [the smell-fix playbooks](documentation/conventions/smell-fix-playbooks.md).

## Enforcement model

- Every smell rule in this project is **blocking**: there is no warn-only tier or deferred cleanup ledger. A rule either holds repo-wide in the same change or it is not added.
- Adding or changing a custom check is part of the same change as the behavior it governs. A new `tools/check-patterns.mjs` rule must ship with a positive and a clean test case in `tests/js/check-patterns.test.mjs` (`npm run test:tools`); new Python checkers ship with a `tests/test_*_checker.py`. Before adding a rule to the gate, run it across the whole repo and drive the violation count to zero so the gate stays green from the first commit.

## Related

- [Agent instructions](AGENTS.md)
- [Coding standards](documentation/conventions/coding-standards.md)
- [Smell prevention](documentation/conventions/smell-prevention.md)
- [Quality gates](documentation/conventions/quality-gates.md)
- [Release workflow](documentation/guides/release-workflow.md)
- [Documentation maintenance](documentation/guides/documentation-maintenance.md)
