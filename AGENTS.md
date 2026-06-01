# AGENTS.md - Project Standards and Workflow

This file is guidance for agents working in this repository.

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

The initial implementation is complete. New work uses normal development flow: read the focused docs, make scoped changes, keep docs synchronized with behavior, and run the quality gate before handoff.

---

## 1. Project Constraints (AvNav Plugin Environment)

- Runtime Python is Python 3.9+ stdlib only. Users install by dropping this plugin directory into AvNav; no `pip install` is allowed on target devices.
- Runtime browser files are served as plain static files by AvNav. There is no bundler and no runtime build step.
- Plain viewer JS uses the single namespace `window.Polarrecorder`. CSS custom properties use the `--polarrecorder-` prefix.
- The Python package and plugin identifier are `polarrecorder`; the display title is `Polar Recorder`.
- Dev-only tooling is allowed: pytest, ruff, mypy, coverage, and Node.js check scripts.
- `avnav_api` may be referenced only in `plugin.py`, and only as a `TYPE_CHECKING`-guarded type import. It must never be imported at runtime.
- `server/polarrecorder/` modules must not import AvNav modules or `plugin.py`; AvNav API access is injected through protocols/fakes.

---

## 2. Token-Efficient Documentation System

Read `documentation/TABLEOFCONTENTS.md` first, then identify one to three relevant documents for the task. Do not read every documentation file sequentially.

Every documentation file uses this structure:

1. `Status`
2. `Overview`
3. `Key Details`
4. `Related`

Documentation must be complete when added or changed. Do not leave stub sections unless a current execution plan explicitly records the lifecycle and owner.

---

## 3. Coding Standards Summary

Python:

- Every Python file in `plugin.py`, `server/polarrecorder/`, and `tests/` uses `from __future__ import annotations`.
- `plugin.py`, `server/polarrecorder/`, and `tests/` have a 400 non-empty-line hard limit; `tools/` is exempt.
- `server/polarrecorder/**/*.py` files, except `__init__.py`, must start with the mandatory module header.
- All functions are typed; public functions have Google-style docstrings.
- Ruff formatting and `mypy --strict` are binding.
- No `print()` calls; use the logging protocol or AvNav boundary logging.
- No broad unchecked exception handling in `server/polarrecorder/`.

JavaScript:

- `viewer/*.js` files are plain scripts, not ES modules. `plugin.mjs` is the only planned ES module exception.
- `viewer/*.js` files must use `window.Polarrecorder`.
- No `console.log`, `var`, loose equality, `eval()`, `innerHTML` assignment, or commented-out code blocks.
- Viewer JS files have a 400-line hard limit and mandatory `/** Module: ... */` headers.

---

## 4. Smell Prevention Summary

Blocking smells include:

- AvNav imports in `server/polarrecorder/`.
- Reverse dependency from `server/polarrecorder/` to `plugin.py`.
- Lock acquisition in `server/polarrecorder/`; locking is exclusively the integration shell's responsibility.
- Product/domain logic accumulating in `plugin.py`.
- Hidden real-time dependencies in domain modules instead of injected clocks.
- Magic thresholds outside named config/constants modules.
- One-line compression to bypass file-size limits.
- Dead/commented-out code blocks.

Use `documentation/conventions/smell-prevention.md` for the full catalog.

---

## 5. Quality Gate

`tools/check-all.sh` must pass before any commit, release, or handoff. The script auto-detects the project virtualenv at `/tmp/polarrecorder-venv/bin` and prepends it to `PATH`. The gate runs:

- `python -m ruff check .`
- `python -m ruff format --check .`
- `python -m mypy server/polarrecorder tests plugin.py --strict`
- `python -m pytest tests/ --tb=short`
- `python -m pytest tests/ --cov=polarrecorder --cov-report=term-missing --cov-fail-under=90`
- `python tools/check-python-filesize.py`
- `python tools/check-release.py --dry-run`
- `npm run check:all`

Agents must fix all failures before proceeding. A green gate is required for normal development handoff.

---

## 6. File Map

- `plugin.py`: thin AvNav integration shell only.
- `server/polarrecorder/`: domain logic, no AvNav dependency.
- `server/polarrecorder/validation/`: validation pipeline and rules in later phases.
- `tests/`: unit and integration tests with fakes.
- `tools/`: quality gate scripts and release tooling.
- [documentation/TABLEOFCONTENTS.md](documentation/TABLEOFCONTENTS.md): modular documentation index.
- [documentation/core-principles.md](documentation/core-principles.md): highest-precedence rules.
- [documentation/QUALITY.md](documentation/QUALITY.md): quality policy and checklist home.
- [documentation/TECH-DEBT.md](documentation/TECH-DEBT.md): known debt ledger.
- [documentation/conventions/coding-standards.md](documentation/conventions/coding-standards.md): coding rules.
- [documentation/conventions/smell-prevention.md](documentation/conventions/smell-prevention.md): smell catalog.
- [documentation/conventions/testing-infrastructure.md](documentation/conventions/testing-infrastructure.md): test fakes and strategy.
- [documentation/guides/documentation-maintenance.md](documentation/guides/documentation-maintenance.md): documentation synchronization workflow.
- [documentation/guides/exec-plan-authoring.md](documentation/guides/exec-plan-authoring.md): optional execution-plan workflow for complex work.
- [documentation/guides/garbage-collection.md](documentation/guides/garbage-collection.md): cleanup workflow.
- [documentation/guides/release-workflow.md](documentation/guides/release-workflow.md): release packaging workflow.
- `releases/`: generated release artifacts.
- `plugin.json`: plugin metadata and user app declaration.
- `viewer/`: viewer HTML, CSS, icon, and plain JS files.

---

## 7. Normal Development Workflow

Use the guides in `documentation/guides/` when a task needs a repeatable workflow.

For routine work, keep changes small and source-driven: update the implementation, update the mapped documentation, add or adjust tests when behavior changes, and run `tools/check-all.sh`. For complex multi-session work, author a fresh execution plan using `documentation/guides/exec-plan-authoring.md`.
<!-- END SHARED_INSTRUCTIONS -->
