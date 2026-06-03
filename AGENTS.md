# AGENTS.md - Project Standards & Workflow

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

---

## 1. Project Constraints (AvNav Plugin Environment)

- Runtime Python is Python 3.9+ stdlib only. Users install by dropping this plugin directory into AvNav; no target-device `pip install` is allowed.
- Runtime browser files are served as plain static files by AvNav. There is no bundler and no runtime build step.
- Plain viewer JS uses the single namespace `window.Polarrecorder`. CSS custom properties use the `--polarrecorder-` prefix.
- The Python package and plugin identifier are `polarrecorder`; the display title is `Polar Recorder`.
- Dev-only tooling is allowed: pytest, ruff, mypy, coverage, and Node.js check scripts.
- `avnav_api` may be referenced only in `plugin.py`, and only as a `TYPE_CHECKING`-guarded type import. It must never be imported at runtime.
- `server/polarrecorder/` modules must not import AvNav modules or `plugin.py`; AvNav API access is injected through protocols and fakes.
- Locks are owned by `plugin.py`. Domain modules are lock-unaware and thread-unaware.
- Runtime configuration is AvNav editable-parameter state; `polar.json` stores learned-model data and metadata, not active settings.

---

## 2. Token-Efficient Documentation System

### Rule: Always Start with the Table of Contents

1. Read `documentation/TABLEOFCONTENTS.md` first.
2. Read `documentation/conventions/coding-standards.md` and `documentation/conventions/smell-prevention.md` for every task.
3. Identify one to three additional relevant files from the routing index.
4. Read only those additional files unless the task genuinely needs more context.
5. Do not read every documentation file sequentially.

### Required Documentation Shape

Every documentation file uses this structure:

1. `Status`
2. `Overview`
3. `Key Details`
4. `Related`

Documentation must be complete when added or changed. Do not leave stub sections unless a current execution plan explicitly records the lifecycle and owner.

---

## 3. Code Hygiene Rules for AI Agents

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

State and threading:

- Keep product/domain logic out of `plugin.py`; it is the AvNav integration shell.
- Keep live shared state behind the single `plugin.py` lock.
- Snapshot live state under the lock, then format API/export responses through pure helpers.
- Do not add locks, sleeps, hidden real-time dependencies, or AvNav imports to `server/polarrecorder/`.

---

## 4. File Map

- Feature and API lookups: [documentation/TABLEOFCONTENTS.md](documentation/TABLEOFCONTENTS.md)
- Non-negotiable project rules: [documentation/core-principles.md](documentation/core-principles.md)
- Root structural orientation map: [ARCHITECTURE.md](ARCHITECTURE.md)
- AvNav host contracts: [documentation/avnav/](documentation/avnav/)
- Runtime architecture docs: [documentation/architecture/](documentation/architecture/)
- Validation and poisoning docs: [documentation/filters/](documentation/filters/)
- Step-by-step maintenance workflows: [documentation/guides/](documentation/guides/)
- `plugin.py`: thin AvNav integration shell only.
- `server/polarrecorder/`: domain logic, no AvNav dependency.
- `tests/`: unit and integration tests with fakes.
- `tools/`: quality gate scripts and release tooling.
- `viewer/`: static user app files served by AvNav.

---

## 5. Quality Checklist

- [ ] Completed mandatory preflight reads: `TABLEOFCONTENTS.md`, coding standards, and smell prevention.
- [ ] Read only necessary additional documentation beyond mandatory preflight.
- [ ] Kept changes scoped to the requested behavior/docs.
- [ ] Updated mapped documentation when behavior changes.
- [ ] Updated user-facing `README.md` when installation, configuration, export/import, requirements, or viewer behavior changes.
- [ ] Updated `documentation/TABLEOFCONTENTS.md` when adding, moving, or deleting docs.
- [ ] Preserved the shared instruction block in `AGENTS.md` and `CLAUDE.md`.
- [ ] Ran `tools/check-all.sh` before handoff for normal development work.

---

## 6. Smell Prevention & Fail-Closed Rules

- Mandatory on every task: follow `documentation/conventions/coding-standards.md` and `documentation/conventions/smell-prevention.md`.
- Blocking smells include AvNav imports in `server/polarrecorder/`, reverse imports from domain code to `plugin.py`, lock acquisition in domain modules, hidden real-time dependencies, magic thresholds outside named config/constants, unsafe browser patterns, and dead commented-out code.
- Required completion gate: `tools/check-all.sh`.
- Documentation reachability and AI instruction sync are enforced by `npm run check:docs`.

---

## 7. Normal Development Workflow

Use the guides in `documentation/guides/` when a task needs a repeatable workflow.

For routine work, keep changes small and source-driven: update the implementation, update the mapped documentation, add or adjust tests when behavior changes, and run the quality gate before handoff. For complex multi-session work, author a fresh execution plan using `documentation/guides/exec-plan-authoring.md`.

<!-- END SHARED_INSTRUCTIONS -->
