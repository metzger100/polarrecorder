# AGENTS.md - Project Standards & Workflow

This file is guidance for agents working in this repository. It is the sole canonical instruction owner; `CLAUDE.md` is
a short pointer to it, not a copy.

**Critical:** AGENTS.md is a routing map. Use it to find focused docs, not to store full implementation details.

---

<!-- BEGIN SHARED_INSTRUCTIONS -->

**Critical:** This file is a routing map. Use it to find focused documentation, not to store implementation details.

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

## 1. Documentation Navigation Rule

1. **Read `documentation/TABLEOFCONTENTS.md` FIRST**
2. **Read `documentation/conventions/coding-standards.md` and `documentation/conventions/smell-prevention.md` for every
   task**
3. Identify 1-3 additional relevant files for your task
4. Read ONLY those additional files
5. **Never read all files sequentially** (wastes tokens)

---

## 2. Plan and Phase Citation Rule

A comment, docstring, config note, or documentation paragraph outside `exec-plans/` must not cite a historical exec-plan
number (`PLANn`) or phase identifier (`Phase N`) as authority. Describe the code or config standalone instead; a literal
pointer to a real `PLANn.md` file (for example in a "related plans" list) is still fine. Plan prose belongs only inside
`exec-plans/`.

---

## 3. README Sync Principle

`README.md` is mandatory documentation when user-facing behavior changes. Do not treat it as optional. Update
`README.md` in the same task whenever a change affects theming/configuration, user-selectable options, installation or
packaging, bundled assets, requirements/platform support, or contributor-visible workflow. For execution plans, include
explicit README deliverables and exit conditions for these categories.

---

## 4. Quality Checklist Skeleton

- [ ] Completed the mandatory preflight reads.
- [ ] Read only necessary additional documentation beyond mandatory preflight.
- [ ] Implementation complete.
- [ ] Updated relevant documentation, including the navigation index if a doc was added, moved, or removed.
- [ ] Updated `README.md` when the change is user-facing (see the README sync principle above).
- [ ] Ran the project's full quality gate — no failures.
- [ ] New/changed tests and coverage/complexity policy stay within this project's checked floors, budgets, and
      classifications; no suppression, skip, or lowered threshold was added to reach green.
- [ ] For releases, followed this project's release workflow exactly, without rerunning quality inside the publish step.

---

## Required Documentation Shape

Every maintained documentation page has a title, a plain `**Status:** Current.` line, and `## Overview`,
`## Key Details`, and `## Related` sections. Additional interface material is optional when it helps explain a public
contract. Keep documentation concise, concrete, and linked from the navigation index when it is new.

<!-- END SHARED_INSTRUCTIONS -->

---

## 5. Project Constraints (AvNav Plugin Environment)

- Runtime Python is Python 3.9+ stdlib only. Users install by dropping this plugin directory into AvNav; no
  target-device `pip install` is allowed.
- Runtime browser files are served as plain static files by AvNav. There is no bundler and no runtime build step.
- Plain viewer JS uses the single namespace `window.Polarrecorder`. CSS custom properties use the `--polarrecorder-`
  prefix.
- The Python package and plugin identifier are `polarrecorder`; the display title is `Polar Recorder`.
- Dev-only tooling is allowed: pytest, ruff, mypy, coverage, and Node.js check scripts.
- `avnav_api` may be referenced only in `plugin.py`, and only as a `TYPE_CHECKING`-guarded type import. It must never be
  imported at runtime.
- `server/polarrecorder/` modules must not import AvNav modules or `plugin.py`; AvNav API access is injected through
  protocols and fakes.
- Locks are owned by `plugin.py`. Domain modules are lock-unaware and thread-unaware.
- Runtime configuration is AvNav plugin configuration state; only the host-facing `enabled` switch is registered as an
  AvNav editable parameter. `polar.json` stores learned-model data and metadata, not active settings.

---

## 6. Code Hygiene Rules for AI Agents

Python:

- Every Python file in `plugin.py`, `server/polarrecorder/`, and `tests/` uses `from __future__ import annotations`.
- `plugin.py`, `server/polarrecorder/`, `tests/`, `viewer/*.js`, `viewer/*.css`, `viewer/*.html`, `plugin.js`,
  `plugin.mjs`, `tools/**/*.mjs`, `tools/**/*.py`, project Markdown files, and `documentation/**/*.md` have a 400
  non-empty-line hard limit; `exec-plans/` is exempt.
- `server/polarrecorder/**/*.py` files, except `__init__.py`, must start with the mandatory module header.
- All functions are typed; public functions have Google-style docstrings.
- Ruff formatting and `mypy --strict` are binding.
- No `print()` calls; use the logging protocol or AvNav boundary logging.
- No broad unchecked exception handling in `server/polarrecorder/`.

JavaScript:

- `viewer/*.js` files and `plugin.js` are plain scripts, not ES modules. `plugin.mjs` is the only planned ES module
  exception.
- `viewer/*.js` files must use `window.Polarrecorder`.
- No `console.log`, `var`, loose equality, `eval()`, `innerHTML` assignment, or commented-out code blocks.
- Viewer JS files have a 400-line hard limit and mandatory `/** @file ... */` headers. `plugin.js` and `plugin.mjs` are
  also covered by the JS pattern and file-size gates.
- Documentation and root project Markdown files have a 400 non-empty-line hard limit.

State and threading:

- Keep product/domain logic out of `plugin.py`; it is the AvNav integration shell.
- Keep live shared state behind the single `plugin.py` lock.
- Snapshot live state under the lock, then format API/export responses through pure helpers.
- Do not add locks, sleeps, hidden real-time dependencies, or AvNav imports to `server/polarrecorder/`.

---

## 7. File Map

- Feature and API lookups: [documentation/TABLEOFCONTENTS.md](documentation/TABLEOFCONTENTS.md)
- Non-negotiable project rules: [documentation/core-principles.md](documentation/core-principles.md)
- Root structural orientation map: [ARCHITECTURE.md](ARCHITECTURE.md)
- AvNav host contracts: [documentation/avnav/](documentation/TABLEOFCONTENTS.md#avnav-integration)
- Runtime architecture docs: [documentation/architecture/](documentation/TABLEOFCONTENTS.md#architecture)
- Validation and poisoning docs:
  [documentation/filters/](documentation/TABLEOFCONTENTS.md#validation-and-poisoning-resistance)
- Step-by-step maintenance workflows: [documentation/guides/](documentation/TABLEOFCONTENTS.md#maintenance-guides)
- `plugin.py`: thin AvNav integration shell only.
- `server/polarrecorder/`: domain logic, no AvNav dependency.
- `tests/`: unit and integration tests with fakes.
- `tools/`: quality gate scripts and release tooling.
- `viewer/`: static user app files served by AvNav.

---

## 8. Smell Prevention & Fail-Closed Rules

- Mandatory on every task: follow `documentation/conventions/coding-standards.md` and
  `documentation/conventions/smell-prevention.md`.
- Blocking smells include AvNav imports in `server/polarrecorder/`, reverse imports from domain code to `plugin.py`,
  lock acquisition in domain modules, hidden real-time dependencies, magic thresholds outside named config/constants,
  unsafe browser patterns, dead commented-out code, and citing a plan or phase number outside `exec-plans/` (see section
  2 above and `documentation/guides/exec-plan-authoring.md`).
- Required completion gate: `npm run check:all`.
- Documentation reachability and the `CLAUDE.md` pointer contract are enforced by `npm run docs:check`.

---

## 9. Normal Development Workflow

Use the guides in `documentation/guides/` when a task needs a repeatable workflow.

For routine work, keep changes small and source-driven: update the implementation, update the mapped documentation, add
or adjust tests when behavior changes, and run the quality gate before handoff. For complex multi-session work, author a
fresh execution plan using `documentation/guides/exec-plan-authoring.md`.

---

## 10. AI Agent Anti-Patterns & Reuse Discipline

These rules exist because AI agents reliably regress in specific ways: duplicating helpers, adding defensive code that
masks contract gaps, re-doing work the pipeline already did, and inventing sentinels. Treat them as fail-closed.

### Before creating any helper, function, or constant

1. Search for an existing one first. Domain helpers live in `server/polarrecorder/` (for example `units.py`,
   `validation/angle_math.py`, `projection.py`, `bins.py`, `histogram.py`, `counters.py`); viewer helpers live under
   `window.Polarrecorder`.
2. Grep before writing: `grep -rn "def <name>" server/` for Python, `grep -rn "Polarrecorder\." viewer/` for the viewer
   namespace.
3. If a canonical helper exists, import and use it. Do not copy it into a local variant.
4. If none exists but the helper is generic, add it to the appropriate existing module rather than a new ad hoc
   location. The generic `duplicate-functions` rule and `jscpd` block cross-file duplicate function bodies and long
   copied statement blocks, so extract and import one canonical helper.

### Forbidden patterns

- Never add defensive fallback code that masks a contract gap: no `value or <default>`,
  `getattr(obj, "field", <fallback>)`, or JS `obj.field ?? <fallback>` where the field is guaranteed by the producer. If
  the contract is unmet, fail loudly instead of papering over it. `tools/check-py-contracts.py` blocks the Python forms.
- Never re-validate or re-normalize samples that already passed the validation pipeline. Accepted samples and
  `plugin.py` snapshots are contract-guaranteed; downstream formatting trusts them.
- Never use `NaN`, `-1`, or `0` as a sentinel for an absent optional. Use `None` in Python and `undefined` in JS, and
  let the boundary decide presentation. `tools/check-py-contracts.py` blocks `float("nan")`, `math.nan`, and `math.inf`
  sentinels.
- Never convert units or coerce types more than once. Conversion happens at the boundary (`units.py` / `reader.py`);
  downstream code consumes already-converted values.
- Never duplicate a model or validation threshold inline. Reference the named config or constant (see the
  magic-threshold smell); ruff `PLR2004` blocks magic values in comparisons.
- Never silence the gate: lint and type suppressions must name specific codes and carry a reason
  (`# noqa: <CODES>  # <reason>`, `# type: ignore[<code>]  # <reason>`); blanket and file-level suppressions are blocked
  by `check-patterns.mjs`.
- Never weaken or delete a test, lower a coverage threshold, skip a check, or suppress a smell to obtain a green gate.
  Fix the root cause; a passing `npm run check:all` must reflect real behavior.

### Value and snapshot boundary rules

- Raw AvNav store values enter only through `reader.py` and the validation pipeline. Validate and convert once at that
  boundary, not repeatedly downstream.
- `plugin.py` snapshots live shared state under the single lock; API, export, and persistence responses are formatted by
  pure helpers off that snapshot. Domain and formatting code must not re-snapshot or read live shared state.
- `polar.json` stores learned-model data and metadata, never active settings. Runtime configuration is AvNav plugin
  configuration state, with only the host-facing `enabled` switch registered as an AvNav editable parameter.

---

## 11. User-Facing README Sync Rule (Fail-Closed)

The generic principle behind this rule lives in section 3 above. In this repository specifically, update `README.md` in
the same task whenever changes affect any of:

1. Installation, plugin packaging, or activation workflow (dropping the plugin directory into AvNav).
2. Configuration keys or defaults users set in AvNav plugin configuration or the Settings tab (`params.py` /
   `documentation/user/configuration.md`).
3. Export or import behavior (CSV/Windy export, presets, JSON backup, and restore).
4. Requirements or platform support statements (Python 3.9+ stdlib, no target-device `pip install`).
5. Viewer behavior visible to users (`window.Polarrecorder` viewer screens, charts, or controls).

For execution plans, include explicit `README.md` deliverables and exit conditions for these categories.

---

## 12. Fail-Closed Fixture/Test Sync Rules

When changing behavior with fixture or test coverage, update the related fixtures and tests in the same task:

1. Validation rule changes (R1 through R16, reason codes, gates): update `tests/test_validation_*.py`,
   `tests/test_poisoning_scenarios.py`, and `tests/mock-data/rejections.json`.
2. Export/import format changes: update `tests/mock-data/export-windy.csv`, `tests/mock-data/export-json.json`,
   `tests/mock-data/presets.json`, and `tests/test_export.py`.
3. `polar.json` schema, recovery, or migration changes: update `tests/mock-data/polar.json` and
   `tests/test_persistence.py`.
4. API response shape changes: update `tests/mock-data/status.json`, `tests/mock-data/timeline.json`, and
   `tests/test_api_handlers.py`.
5. Viewer behavior changes covered by `tests/js/viewer-*.test.mjs`: keep those checks green and extend them when new
   visuals are added.

Silent truncation of coverage (skipping a fixture, leaving a stale snapshot) is a fail-closed violation, not a
follow-up.
