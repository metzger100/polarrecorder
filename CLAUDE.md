# CLAUDE.md - Project Standards & Workflow

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

Repo rules and core principles always override execution-plan instructions. An exec-plan in `exec-plans/` is the source of truth for *what to build*, but it cannot waive a mechanically enforced repo rule. In particular, the 400-line limit, the `tools/check-all.sh` gate, coverage thresholds, and blocking smells bind every phase even when the plan does not mention them — for example, if a phase would push a file past 400 lines, split it within that same phase rather than deferring. When a plan conflicts with a repo rule, amend the plan; do not work around the rule.

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
- Runtime configuration is AvNav plugin configuration state; only the host-facing `enabled` switch is registered as an AvNav editable parameter. `polar.json` stores learned-model data and metadata, not active settings.

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
- `plugin.py`, `server/polarrecorder/`, `tests/`, `viewer/*.js`, `plugin.js`, `plugin.mjs`, project Markdown files, and `documentation/**/*.md` have a 400 non-empty-line hard limit; `tools/` and `exec-plans/` are exempt.
- `server/polarrecorder/**/*.py` files, except `__init__.py`, must start with the mandatory module header.
- All functions are typed; public functions have Google-style docstrings.
- Ruff formatting and `mypy --strict` are binding.
- No `print()` calls; use the logging protocol or AvNav boundary logging.
- No broad unchecked exception handling in `server/polarrecorder/`.

JavaScript:

- `viewer/*.js` files and `plugin.js` are plain scripts, not ES modules. `plugin.mjs` is the only planned ES module exception.
- `viewer/*.js` files must use `window.Polarrecorder`.
- No `console.log`, `var`, loose equality, `eval()`, `innerHTML` assignment, or commented-out code blocks.
- Viewer JS files have a 400-line hard limit and mandatory `/** Module: ... */` headers. `plugin.js` and `plugin.mjs` are also covered by the JS pattern and file-size gates.
- Documentation and root project Markdown files have a 400 non-empty-line hard limit.

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
- [ ] Updated user-facing `README.md` when installation, configuration, export/import, requirements, or viewer behavior changes (Section 9).
- [ ] Reused existing helpers instead of duplicating them, and avoided the forbidden anti-patterns in Section 8.
- [ ] Synced fixtures and tests in the same task when validation, export/import, persistence, or API shapes changed (Section 10).
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

---

## 8. AI Agent Anti-Patterns & Reuse Discipline

These rules exist because AI agents reliably regress in specific ways: duplicating helpers, adding defensive code that masks contract gaps, re-doing work the pipeline already did, and inventing sentinels. Treat them as fail-closed.

### Before creating any helper, function, or constant

1. Search for an existing one first. Domain helpers live in `server/polarrecorder/` (for example `units.py`, `validation/angle_math.py`, `projection.py`, `bins.py`, `histogram.py`, `counters.py`); viewer helpers live under `window.Polarrecorder`.
2. Grep before writing: `grep -rn "def <name>" server/` for Python, `grep -rn "Polarrecorder\." viewer/` for the viewer namespace.
3. If a canonical helper exists, import and use it. Do not copy it into a local variant.
4. If none exists but the helper is generic, add it to the appropriate existing module rather than a new ad hoc location. `tools/check-duplication.py` blocks cross-file duplicate function bodies and long copied statement blocks, so extract and import one canonical helper.

### Forbidden patterns

- Never add defensive fallback code that masks a contract gap: no `value or <default>`, `getattr(obj, "field", <fallback>)`, or JS `obj.field ?? <fallback>` where the field is guaranteed by the producer. If the contract is unmet, fail loudly instead of papering over it. `tools/check-py-contracts.py` blocks the Python forms.
- Never re-validate or re-normalize samples that already passed the validation pipeline. Accepted samples and `plugin.py` snapshots are contract-guaranteed; downstream formatting trusts them.
- Never use `NaN`, `-1`, or `0` as a sentinel for an absent optional. Use `None` in Python and `undefined` in JS, and let the boundary decide presentation. `tools/check-py-contracts.py` blocks `float("nan")`, `math.nan`, and `math.inf` sentinels.
- Never convert units or coerce types more than once. Conversion happens at the boundary (`units.py` / `reader.py`); downstream code consumes already-converted values.
- Never duplicate a model or validation threshold inline. Reference the named config or constant (see the magic-threshold smell); ruff `PLR2004` blocks magic values in comparisons.
- Never silence the gate: lint and type suppressions must name specific codes and carry a reason (`# noqa: <CODES>  # <reason>`, `# type: ignore[<code>]  # <reason>`); blanket and file-level suppressions are blocked by `check-patterns.mjs`.
- Never weaken or delete a test, lower a coverage threshold, skip a check, or suppress a smell to obtain a green gate. Fix the root cause; a passing `tools/check-all.sh` must reflect real behavior.

### Value and snapshot boundary rules

- Raw AvNav store values enter only through `reader.py` and the validation pipeline. Validate and convert once at that boundary, not repeatedly downstream.
- `plugin.py` snapshots live shared state under the single lock; API, export, and persistence responses are formatted by pure helpers off that snapshot. Domain and formatting code must not re-snapshot or read live shared state.
- `polar.json` stores learned-model data and metadata, never active settings. Runtime configuration is AvNav plugin configuration state, with only the host-facing `enabled` switch registered as an AvNav editable parameter.

---

## 9. User-Facing README Sync Rule (Fail-Closed)

`README.md` is mandatory documentation when user-facing behavior changes; it is not optional. Update `README.md` in the same task whenever changes affect any of:

1. Installation, plugin packaging, or activation workflow (dropping the plugin directory into AvNav).
2. Configuration keys or defaults users set in AvNav plugin configuration or the Settings tab (`params.py` / `documentation/user/configuration.md`).
3. Export or import behavior (CSV/Windy export, presets, JSON backup, and restore).
4. Requirements or platform support statements (Python 3.9+ stdlib, no target-device `pip install`).
5. Viewer behavior visible to users (`window.Polarrecorder` viewer screens, charts, or controls).

For execution plans, include explicit `README.md` deliverables and exit conditions for these categories.

---

## 10. Fail-Closed Fixture/Test Sync Rules

When changing behavior with fixture or test coverage, update the related fixtures and tests in the same task:

1. Validation rule changes (R1 through R16, reason codes, gates): update `tests/test_validation_*.py`, `tests/test_poisoning_scenarios.py`, and `tests/mock-data/rejections.json`.
2. Export/import format changes: update `tests/mock-data/export-windy.csv`, `tests/mock-data/export-json.json`, `tests/mock-data/presets.json`, and `tests/test_export.py`.
3. `polar.json` schema, recovery, or migration changes: update `tests/mock-data/polar.json` and `tests/test_persistence.py`.
4. API response shape changes: update `tests/mock-data/status.json`, `tests/mock-data/timeline.json`, and `tests/test_api_handlers.py`.
5. Viewer behavior changes covered by `tools/test-viewer-*.mjs`: keep those checks green and extend them when new visuals are added.

Silent truncation of coverage (skipping a fixture, leaving a stale snapshot) is a fail-closed violation, not a follow-up.

<!-- END SHARED_INSTRUCTIONS -->

## Claude-Specific Notes

- Keep responses concise and cite exact files when reporting changes.
- Prefer targeted reads through `documentation/TABLEOFCONTENTS.md` over broad context loading.
- Do not use polished verification language unless deterministic gate output and actual files have been inspected.
