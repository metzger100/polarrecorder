# CLAUDE.md - Project Standards and Workflow

This file is guidance for Claude agents working in this repository.

<!-- BEGIN SHARED_INSTRUCTIONS -->
**Critical:** AGENTS.md is a routing map. Use it to find focused docs, not to store full implementation details.

---

## 0. Mandatory Session Preflight (No Exceptions)

Before planning, coding, review, or documentation edits, always read:

1. `documentation/TABLEOFCONTENTS.md`
2. `documentation/conventions/coding-standards.md`
3. `documentation/conventions/smell-prevention.md`

These three reads are mandatory for every task. Start implementation only after this preflight is complete.

If guidance conflicts, precedence is:

1. `documentation/core-principles.md`
2. `documentation/conventions/coding-standards.md`
3. `documentation/conventions/smell-prevention.md`
4. Task-specific documentation

Phase 0 and Phase 1 are human-authored bootstrap phases. Agent-driven implementation begins only at Phase 2, after the human has inspected the foundation, run the full gate, and marked Phase 0 and Phase 1 done in the progress ledger.

---

## 1. Project Constraints (AvNav Plugin Environment)

- Runtime Python is Python 3.9+ stdlib only. Users install by dropping this plugin directory into AvNav; no `pip install` is allowed on target devices.
- Runtime browser files are served as plain static files by AvNav. There is no bundler and no runtime build step.
- Plain JS uses the single namespace `window.Polarrecorder`. CSS custom properties use the `--polarrecorder-` prefix.
- The Python package and plugin identifier are `polarrecorder`; the display title is `Polar Recorder`.
- Dev-only tooling is allowed: pytest, ruff, mypy, coverage, and Node.js check scripts.
- `avnav_api` may be referenced only in `plugin.py`, and only as a `TYPE_CHECKING`-guarded type import. It must never be imported at runtime.
- `polarrecorder/` modules must not import AvNav modules or `plugin.py`; AvNav API access is injected through protocols/fakes.

---

## 2. Token-Efficient Documentation System

Read `documentation/TABLEOFCONTENTS.md` first, then identify one to three relevant documents for the task. Do not read every documentation file sequentially.

Every documentation file uses this structure:

1. `Status`
2. `Overview`
3. `Key Details`
4. `Related`

Documentation may be stubbed only when PLAN1 explicitly marks a stub-to-complete lifecycle. In Phase 1, only `README.md` and `documentation/QUALITY.md` are stubs.

---

## 3. Coding Standards Summary

Python:

- Every Python file in `plugin.py`, `polarrecorder/`, and `tests/` uses `from __future__ import annotations`.
- `plugin.py`, `polarrecorder/`, and `tests/` have a 400 non-empty-line hard limit; `tools/` is exempt.
- `polarrecorder/**/*.py` files, except `__init__.py`, must start with the mandatory module header.
- All functions are typed; public functions have Google-style docstrings.
- Ruff formatting and `mypy --strict` are binding.
- No `print()` calls; use the logging protocol or AvNav boundary logging.
- No broad unchecked exception handling in `polarrecorder/`.

JavaScript:

- Root `*.js` files are plain scripts, not ES modules. `plugin.mjs` is the only planned ES module exception.
- Root `*.js` files must use `window.Polarrecorder`.
- No `console.log`, `var`, loose equality, `eval()`, `innerHTML` assignment, or commented-out code blocks.
- Root JS files have a 400-line hard limit and mandatory `/** Module: ... */` headers.

---

## 4. Smell Prevention Summary

Blocking smells include:

- AvNav imports in `polarrecorder/`.
- Reverse dependency from `polarrecorder/` to `plugin.py`.
- Lock acquisition in `polarrecorder/`; locking is exclusively the integration shell's responsibility.
- Product/domain logic accumulating in `plugin.py`.
- Hidden real-time dependencies in domain modules instead of injected clocks.
- Magic thresholds outside named config/constants modules.
- One-line compression to bypass file-size limits.
- Dead/commented-out code blocks.

Use `documentation/conventions/smell-prevention.md` for the full catalog.

---

## 5. Quality Gate

`tools/check-all.sh` must pass before any commit and before any phase is marked complete. In this repository, prefer `PATH=/tmp/polarrecorder-venv/bin:$PATH tools/check-all.sh` so the project virtualenv tooling is found. The gate runs:

- `python -m ruff check .`
- `python -m ruff format --check .`
- `python -m mypy polarrecorder tests plugin.py --strict`
- `python -m pytest tests/ --tb=short`
- `python -m pytest tests/ --cov=polarrecorder --cov-report=term-missing --cov-fail-under=90`
- `python tools/check-python-filesize.py`
- `python tools/check-release.py --dry-run`
- `npm run check:all`

Agents must fix all failures before proceeding. A green gate is required but does not replace human inspection for the Phase 1 foundation.

---

## 6. File Map

- `plugin.py`: thin AvNav integration shell only.
- `polarrecorder/`: domain logic, no AvNav dependency.
- `polarrecorder/validation/`: validation pipeline and rules in later phases.
- `tests/`: unit and integration tests with fakes.
- `tools/`: quality gate scripts and release tooling.
- [documentation/TABLEOFCONTENTS.md](documentation/TABLEOFCONTENTS.md): modular documentation index.
- [documentation/core-principles.md](documentation/core-principles.md): highest-precedence rules.
- [documentation/QUALITY.md](documentation/QUALITY.md): quality policy and checklist home.
- [documentation/TECH-DEBT.md](documentation/TECH-DEBT.md): known debt ledger.
- [documentation/conventions/coding-standards.md](documentation/conventions/coding-standards.md): coding rules.
- [documentation/conventions/smell-prevention.md](documentation/conventions/smell-prevention.md): smell catalog.
- [documentation/conventions/testing-infrastructure.md](documentation/conventions/testing-infrastructure.md): test fakes and strategy.
- [documentation/guides/exec-plan-authoring.md](documentation/guides/exec-plan-authoring.md): execution-plan workflow.
- `exec-plans/active/`: active execution plans and progress ledgers.
- `exec-plans/completed/`: completed execution plans.
- `releases/`: generated release artifacts.
- `plugin.json`: plugin metadata and user app declaration.
- `viewer.html`, `viewer.css`, and root viewer JS files: Phase 9 UI files.

---

## 7. Exec-Plan Workflow

Active plans live in `exec-plans/active/`; completed plans move to `exec-plans/completed/`. Sequential numbering uses `PLAN{N}.md`.

Implementation follows the active plan unless an amendment is explicitly recorded. Do not skip phases, reorder deliverables, or infer completion from repository contents. The progress ledger beside the active plan is the source of truth for the next incomplete phase.

The agent-driven loop starts at Phase 2. Before running it, confirm Phase 0 and Phase 1 are marked done by the human and `tools/check-all.sh` is green.
<!-- END SHARED_INSTRUCTIONS -->

## Claude-Specific Notes

- Keep responses concise and cite exact files when reporting changes.
- Prefer targeted reads through `documentation/TABLEOFCONTENTS.md` over broad context loading.
- Treat PLAN1 and its progress ledger as the durable task state across sessions.
- Do not use Pro-style verification language unless the deterministic gate output and actual files have been inspected.
