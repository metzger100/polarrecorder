# Coding Standards

**Status:** Current.

## Overview

These standards keep Polar Recorder small, inspectable, and safe to run inside AvNav.

## Key Details

Python standards:

- Runtime code uses only Python 3.9+ standard library.
- `tools/check-python-compat.py` enforces Python 3.9 syntax and blocks known Python 3.10+ stdlib/type conveniences in covered Python files.
- Every Python file in `plugin.py`, `server/polarrecorder/`, and `tests/` includes `from __future__ import annotations`.
- Every function is fully typed; `mypy --strict` is required.
- Public functions have Google-style docstrings.
- Ruff formatting and linting are required.
- No `print()` calls in runtime or tests.
- `server/polarrecorder/` does not import AvNav modules or `plugin.py`.
- `plugin.py` is the only AvNav boundary and stays thin.
- `plugin.py` owns the single lock and snapshots live state for API, export, and persistence handoff.
- Domain modules receive clocks, raw data, configs, snapshots, protocols, or fakes; they do not reach outward to runtime services.
- `plugin.py`, `server/polarrecorder/`, `tests/`, `viewer/*.js`, `plugin.js`, `plugin.mjs`, project Markdown files, and `documentation/**/*.md` have a 400 non-empty-line hard limit.
- Each `server/polarrecorder/` module's `Depends:` header must list exactly the intra-package modules it imports — no undeclared imports and no stale declarations. Runtime and `TYPE_CHECKING` imports of `polarrecorder.*` both count. The runtime import graph must stay acyclic (move type-only edges under `TYPE_CHECKING`). `tools/check-py-dependencies.py` enforces both.
- Domain modules sit in four layers — primitives, core, domain, orchestration — and imports flow downward only: a module may import the same or a lower layer, never a higher one. `tools/check-py-dependencies.py` enforces the direction (`layer-direction`) against the `_LAYER_RANK` map and keeps that map equal to reality (`layer-map-stale`), so a new module must be assigned a layer in the same change.
- `server/polarrecorder/**/*.py`, except `__init__.py`, must begin with:

```python
"""Module: <Name> - <One-line description>.

Documentation: documentation/<path>.md
Depends: <list of polarrecorder/ module dependencies>
"""
```

- In `server/polarrecorder/`, do not add defensive fallbacks (`value or <falsy-default>`, `getattr(obj, "field", <default>)`) on producer-guaranteed values, and do not use `float("nan")`, `math.nan`, or `math.inf` as absent-value sentinels. Use `None`. `tools/check-py-contracts.py` enforces this. The same checker also blocks redundant re-sanitizing guards (`x if isinstance(x, list) else []`, `str(x if x is None else ...)`), `hasattr(self, "field")` / `callable(getattr(self, "field", ...))` framework-method guards, and speculative `*legacy*`/`*compat*`/`*deprecated*` declarations that nothing references — the Python twins of the viewer contract-trust rules. It additionally validates that the `_CANONICAL_HELPERS` owner map still matches reality (`canonical-helper-map-stale`).
- Runtime numeric output must stay finite. `tools/check-runtime-contracts.py` populates a real model and fails if any NaN/Infinity, or a `nan`/`inf` sentinel string, reaches the polar or CSV/Windy export boundary; it catches non-finites produced at runtime that the static `nan-sentinel` rule cannot see.
- Hot paths are gated by `tools/check-performance.py`, which pairs generous absolute ceilings (gross-slowdown backstops) with a machine-independent doubling-ratio guard (`MAX_UPDATE_SCALING_RATIO`) that fails on super-linear (e.g. accidental O(n^2)) per-sample regressions without a flaky committed wall-clock baseline.
- Do not re-implement a canonical domain helper (e.g. `twa_bin`, `circular_distance`, `merge_histograms`) under the same name in another module; import it from its owner module. `tools/check-py-contracts.py` (`canonical-helper-redefinition`) enforces this against a curated owner map.
- Do not re-implement a helper that already exists; import the canonical one. `tools/check-duplication.py` blocks cross-file duplicate function bodies and long copied statement blocks.
- Lint and type suppressions must name specific codes and carry a reason: `# noqa: <CODES>  # <reason>` and `# type: ignore[<code>]  # <reason>`. Blanket `# noqa`, blanket `# type: ignore`, and file-level `# ruff: noqa` / `# mypy: ignore-errors` are blocked by `check-patterns.mjs`.
- `TODO` and `FIXME` markers in source and Markdown must use the form `TODO(owner, YYYY-MM-DD): ...`.

JavaScript standards:

- `viewer/*.js` files are plain scripts loaded by `viewer/viewer.html`.
- `plugin.js` is a legacy plain-script entrypoint. `plugin.mjs` is the only planned ES module exception; both are scanned by the JS pattern and file-size gates.
- Use `window.Polarrecorder` for all exported browser functionality.
- Use kebab-case filenames, PascalCase exported namespace members, and camelCase functions.
- No `console.log`, `var`, loose equality, `eval()`, `innerHTML` assignment, or commented-out code blocks.
- Use `Number.isFinite(x)`; bare global `isFinite(x)` coerces its argument and is forbidden.
- No empty `try { ... } catch (e) {}` or empty Promise `.catch(function () {})`: route errors to visible UI state, a named handler, or an intentional boundary fallback.
- No silent non-empty catch either: a lexical `catch { ... }` must rethrow, route the error to visible state, or carry a structured `polarrecorder-boundary-fallback(<owner>): ...` comment for an intentional boundary fallback. `tools/check-patterns.mjs` (`catch-fallback`) blocks casual comment-only swallows.
- Do not re-default the result of an internal namespace helper (`Polarrecorder.X.Helper(...) || fb` / `?? fb`); trust the contract and fix caller order instead. `tools/check-patterns.mjs` (`internal-namespace-fallback`) blocks this. Boundary defaulting on optional API fields (`data.counters || {}`) stays allowed.
- Do not re-implement a viewer helper that already exists; extract one canonical `window.Polarrecorder` helper and reuse it. `tools/check-js-duplication.mjs` blocks cross-file duplicate function bodies and long copied function blocks (the JS counterpart of `check-duplication.py`).
- Do not clobber explicit falsy defaults with `x.default || fallback` (use `??` or a presence check), re-sanitize producer-guaranteed values (`Array.isArray(x) ? x : []`, `String(x == null ? ... : x)`), duplicate config defaults downstream of `Polarrecorder.ConfigCache` (including literal `ConfigCache = { ... }` fallbacks), duplicate placeholder strings outside `Polarrecorder.Placeholders`, hardcode user-visible responsive floors with `Math.max(12, ...)`/`clamp(..., 12, ...)`, add Canvas 2D API `typeof` guards, wrap internal canvas drawing in `try/finally`, add `typeof Polarrecorder.* === "function"` guards around guaranteed namespace methods, leave dead code (`if (true)`/`if (false)`, unreferenced top-level functions), keep `fallback`-named bindings that are never used, or add speculative `*legacy*`/`*compat*`/`*deprecated*` paths. `tools/check-patterns.mjs` blocks all of these. Boundary defaulting on optional API fields (`data.counters || {}`) stays allowed — only owned internal contracts are targeted.
- Every custom JS checker (`check-patterns.mjs`, `check-namespace.mjs`, `check-naming.mjs`, `check-headers.mjs`, `check-dependencies.mjs`, `check-smell-contracts.mjs`, `check-smell-catalog.mjs`, `check-js-duplication.mjs`, `check-file-size.mjs`, and `check-viewer-contracts.mjs`) exports a testable `run*` entry point and is exercised by `npm run test:tools` (`tools/test-check-patterns.mjs` and `tools/test-js-checkers.mjs`). Add a clean-pass and failing case when adding or changing a custom JS rule.
- `viewer/*.js` behavioral contracts are executed, not just pattern-matched: `tools/check-viewer-contracts.mjs` drives the real scripts through the shared `tools/viewer-harness.mjs` and fails if any contract-valid payload renders a `NaN`/`undefined`/`null` token, clobbers a present `0`, or skips the absent-value placeholder. It is the viewer twin of `check-runtime-contracts.py`.
- No lint/type suppression comments (`eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `prettier-ignore`, `istanbul ignore`); fix the root cause.
- Viewer JS files have mandatory `/** Module: ... */` headers and a 400-line hard limit. `plugin.js` and `plugin.mjs` share the JS file-size and one-liner-compression gate. `tools/check-file-size.mjs` also enforces the Markdown hard limit and blocks JS one-liner compression (dense statements, stacked declarations, packed destructuring or `for` headers, comma assignment sequences, collapsed literals/bodies, chained ternaries, operator-dense and over-long packed lines), matching the Python checker's coverage.
- `plugin.js` and `plugin.mjs` have an executable entry-contract check (`npm run test:plugin`) in addition to the pattern and file-size gates; keep them stub-thin unless a documented AvNav startup contract requires behavior there.
- Every `viewer/*.js` file must have an explicit per-file line-coverage floor, enforced by `tools/check-js-coverage.mjs` over the vm-based viewer tests; new viewer files fail until listed and exercised.
- Viewer `Depends:` headers must match real cross-file `window.Polarrecorder` references, and `viewer/viewer.html` must load the known viewer scripts in the documented order. `tools/check-smell-contracts.mjs` enforces both.
- Do not commit machine-local absolute paths (`/home/<user>/...`, `/Users/<user>/...`) in source, docs, workflow files, or release metadata; `tools/check-patterns.mjs` blocks them. Use project-relative or redacted placeholders.
- The pre-push gate must be installed (`npm run hooks:install`); `npm run hooks:doctor` verifies `core.hooksPath` and the hook are configured.

Documentation standards:

- Every `documentation/*.md` file has a title, `Status`, `Overview`, `Key Details`, and `Related`.
- Markdown documentation and root project Markdown files have the same 400 non-empty-line hard limit as runtime/test code.
- New docs must be linked from [the documentation index](../TABLEOFCONTENTS.md).
- AvNav behavior docs must be self-contained contracts, not references to machine-specific paths.
- Keep `AGENTS.md` and `CLAUDE.md` shared instruction blocks byte-identical.

## Repo Rules Override Exec-Plans

Repo rules and core principles always outrank execution-plan instructions. A plan is the implementation source of truth for *what to build*, but it cannot waive a mechanically enforced repo rule.

- The 400 non-empty-line limit is always in effect for runtime code, tests, viewer scripts, and Markdown. If an exec-plan phase would cause a file to exceed it, refactor and split the file as part of that same phase. The plan does not need to mention splitting; do not defer to a later "cleanup" phase, and do not use one-liner compression to fit more logic into fewer lines.
- The quality gate (`tools/check-all.sh`), coverage thresholds, and blocking smells bind every phase regardless of what the plan says.
- If a plan conflicts with a repo rule, surface the defect and amend the plan rather than silently improvising around it.

## Test and Gate Integrity

- Never weaken or delete a test, lower a coverage threshold, skip a check, or suppress a smell to obtain a green gate. Fix the root cause instead.
- Keep `tests/mock-data/` fixtures consistent with the behavior they assert; a green gate must reflect real, current behavior.

## Related

- [Core principles](../core-principles.md)
- [Documentation format](documentation-format.md)
- [Quality gates](quality-gates.md)
- [Smell prevention](smell-prevention.md)
- [Smell-fix playbooks](smell-fix-playbooks.md)
- [Testing infrastructure](testing-infrastructure.md)
- [AvNav plugin lifecycle](../avnav/plugin-lifecycle.md)
