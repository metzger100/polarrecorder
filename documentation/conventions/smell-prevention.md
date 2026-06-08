# Smell Prevention

**Status:** Current.

## Overview

This catalog lists every blocking rule enforced by the repository linters, custom checkers, and quality-gate scripts. Treat each rule as fail-closed: fix the root cause in the same change instead of suppressing, deferring, or hiding it.

## Key Details

The source of truth for the commands is [quality gates](quality-gates.md). This file is the source of truth for what those commands reject.

Python rules:

| Rule | Forbidden or Required | Replacement or Required Pattern | Enforcement |
|---|---|---|---|
| Ruff selected families | Violations from the configured `E`, `F`, `W`, `I`, `N`, `UP`, `B`, `A`, `SIM`, `TCH`, `RUF`, `C90`, `D`, `PT`, `ARG`, `ERA`, `S`, `PIE`, `RSE`, `RET`, `FBT`, `PL`, `T20`, `TID`, `FA`, `C4`, `BLE`, `TRY`, `EM`, `G`, `PERF`, `PTH`, `YTT`, `DTZ`, and `FURB` rule families | Keep Python lint-clean under the project `pyproject.toml` configuration | `ruff check` |
| Ruff format | Python files that are not Ruff-formatted | Run Ruff formatting and keep formatting stable | `ruff format --check` |
| Strict typing | Untyped functions, unresolved strict typing issues, returning `Any`, unused mypy config, or weak `None` equality | Type every function and preserve strict contracts | `mypy --strict` |
| Python 3.9 runtime floor | Python 3.10+ syntax, `tomllib`, 3.10+ or 3.11+ `typing` names, or `dataclass(slots=True)` in covered Python files | Use Python 3.9-compatible syntax and stdlib APIs | `check-python-compat.py` |
| Future annotations | Covered Python files missing `from __future__ import annotations` | Add the future import | Ruff `FA` |
| Public docstrings | Public Python functions without Google-style docstrings | Add concise Google-style docstrings | Ruff `D` |
| Print statement | `print()` in runtime or tests | Use logger protocols or test assertions | Ruff `T20` |
| Broad domain exception | Bare or broad `except` in domain code | Catch specific exceptions; let the boundary own crash safety | Ruff `BLE`, `TRY` |
| Magic threshold | Hardcoded model or validation threshold in comparisons | Use named configuration or constants | Ruff `PLR2004` |
| AvNav import leak | `server/polarrecorder/` imports `avnav_api`, `pluginhandler`, `avnav_store`, `avnav_nmea`, or AvNav internals | Inject AvNav dependencies through protocols and fakes | Ruff `TID`, `check-patterns.mjs` (`avnav-import`, `pluginhandler-import`) |
| Reverse dependency | Domain modules import `plugin.py` | Dependency flow stays from `plugin.py` inward | `check-patterns.mjs` (`reverse-plugin-import`) |
| Lock acquisition in domain code | `threading.Lock`, `RLock`, or `Condition` in `server/polarrecorder/` | Keep locking in `plugin.py` only | `check-patterns.mjs` (`domain-lock-acquisition`) |
| Real sleep in domain code | `time.sleep()` in `server/polarrecorder/` | Use injected clocks and deterministic tests | `check-patterns.mjs` (`domain-time-sleep`) |
| Defensive fallback masking a contract gap | `value or <fallback>` or `getattr(obj, "field", <fallback>)` on producer-guaranteed values | Access contract values directly and fail loudly | `check-py-contracts.py` |
| Absent-value sentinel | `float("nan")`, `math.nan`, `math.inf`, or sentinel strings at runtime boundaries | Use `None`; boundary formatting decides presentation | `check-py-contracts.py`, `check-runtime-contracts.py` |
| Redundant type guard | `x if isinstance(x, list) else []` or `str(x if x is None else ...)` on producer-guaranteed values | Trust the validated contract | `check-py-contracts.py` |
| Framework method guard | `hasattr(self, ...)` or `callable(getattr(self, ...))` for guaranteed methods or attributes | Access the method or attribute directly | `check-py-contracts.py` |
| Premature legacy support | Unreferenced `*legacy*`, `*compat*`, or `*deprecated*` module/class declarations | Remove speculative shims until a live boundary requires them | `check-py-contracts.py` |
| Canonical helper redefinition | Re-defining helpers owned by canonical modules | Import the canonical helper | `check-py-contracts.py` |
| Stale canonical-helper map | `_CANONICAL_HELPERS` points at missing or renamed helpers | Keep the helper owner map equal to reality | `check-py-contracts.py` |
| Duplicate Python logic | Cross-file duplicate function bodies or long copied statement blocks | Extract one canonical helper and import it | `check-duplication.py` |
| Python file size | Covered Python files over 400 non-empty lines | Split modules before the limit is exceeded | `check-python-filesize.py` |
| Python module header | Covered domain modules missing the mandatory `Module`, `Documentation`, and `Depends` header | Add an accurate module header | `check-python-filesize.py` |
| Python one-line compression | Semicolon packing, collapsed compound bodies, chained conditionals, collapsed literals, crammed comprehensions, packed lambdas, long packed lines, operator-dense lines, or deeply nested packed expressions | Keep code readable; split lines and helpers | `check-python-filesize.py` |
| Python suppression comment | Blanket or unjustified `# noqa`, `# type: ignore`, file-level `# ruff: noqa`, `# flake8: noqa`, or `# mypy: ignore-errors` | Suppress specific codes only with a reason | `check-patterns.mjs` (`python-suppression`) |
| Stale Python dependency header | `Depends:` omits a real intra-package import or lists a stale one | Keep headers equal to runtime and `TYPE_CHECKING` imports | `check-py-dependencies.py` |
| Domain import cycle | Runtime cycle among `server/polarrecorder/` modules | Break cycles; move type-only edges under `TYPE_CHECKING` | `check-py-dependencies.py` |
| Backwards layer import | A module imports a higher architectural layer | Move shared logic downward or invert the dependency | `check-py-dependencies.py` |
| Stale layer map | `_LAYER_RANK` omits a real module or names a removed one | Assign every domain module to the correct layer | `check-py-dependencies.py` |
| Hot-path regression | Model update or polar formatting becomes too slow or scales super-linearly | Keep per-sample and formatting paths bounded | `check-performance.py` |
| Runtime non-finite leak | NaN/Infinity reaches polar, CSV, or Windy export output | Keep boundary numbers finite and optionals explicit | `check-runtime-contracts.py` |

JavaScript and viewer rules:

| Rule | Forbidden or Required | Replacement or Required Pattern | Enforcement |
|---|---|---|---|
| Viewer namespace | Missing `window.Polarrecorder` usage or global assignments outside it | Export viewer functionality through `window.Polarrecorder` only | `check-namespace.mjs` |
| JS naming | Non-kebab-case viewer filenames, non-PascalCase namespace exports, or non-camelCase functions | Follow the viewer naming convention | `check-naming.mjs` |
| Viewer module header | Missing top `/** Module */` header, missing `Module`/`Documentation`/`Depends`, or dead documentation target | Keep headers complete and current | `check-headers.mjs` |
| Viewer dependency header | `Depends:` omits or stales real `window.Polarrecorder` cross-file references | Keep `Depends:` equal to actual references | `check-smell-contracts.mjs` (`viewer-dependency-header-contract`) |
| Viewer script order | `viewer.html` omits a viewer script or changes the approved load order | Load every viewer script in the documented static order | `check-smell-contracts.mjs` (`viewer-script-contract`) |
| Viewer module-load dependency | `viewer.js` references late-wired modules before `DOMContentLoaded` | Resolve late modules after the viewer is initialized | `check-dependencies.mjs` |
| JS namespace cycle | Circular `window.Polarrecorder` references among viewer modules | Break cycles or move shared helpers to a lower owner | `check-dependencies.mjs` |
| JS ES module syntax | `import` or `export` in `viewer/*.js` | Keep viewer files as plain scripts; `plugin.mjs` is the exception | `check-patterns.mjs` (`es-module-syntax`) |
| JS debug leftover | `console.log()` | Remove it or use intentional warning/error reporting | `check-patterns.mjs` (`console-log`) |
| JS `var` declaration | `var` | Use `const` or `let` | `check-patterns.mjs` (`var-declaration`) |
| JS loose equality | `==` or `!=` | Use `===` or `!==` | `check-patterns.mjs` (`loose-equality`) |
| JS unsafe execution or DOM mutation | `eval()` or `innerHTML` assignment | Use safe DOM APIs and text assignment | `check-patterns.mjs` (`eval-call`, `inner-html-assignment`) |
| JS bare finite check | Global `isFinite()` | Use `Number.isFinite()` | `check-patterns.mjs` (`bare-isfinite`) |
| JS commented-out code | Three or more consecutive commented code lines | Delete dead code | `check-patterns.mjs` (`commented-out-code`) |
| Viewer suppression comment | `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `prettier-ignore`, or `istanbul ignore` | Fix the root cause | `check-patterns.mjs` (`viewer-suppression-comment`) |
| Empty catch | Lexical empty `catch` or empty Promise catch | Rethrow, route to visible state, or use a marked boundary fallback | `check-patterns.mjs` (`empty-catch`, `promise-empty-catch`) |
| Silent catch fallback | Non-empty `catch` that swallows without visible state, rethrow, or `polarrecorder-boundary-fallback(...)` | Make the fallback explicit and owned | `check-patterns.mjs` (`catch-fallback`) |
| Internal namespace re-default | Re-defaulting a guaranteed `Polarrecorder.*` helper result with `||` or `??` | Trust the namespace contract and fix caller order | `check-patterns.mjs` (`internal-namespace-fallback`) |
| Truthy default clobber | `.default || fallback` clobbers explicit falsy values | Use `??` or presence checks | `check-patterns.mjs` (`default-truthy-fallback`) |
| Redundant JS re-sanitize | `Array.isArray(x) ? x : []` or `String(x == null ? ... : x)` on producer-guaranteed values | Trust producer contracts | `check-patterns.mjs` (`redundant-null-type-guard`) |
| Hardcoded runtime default | Duplicated `ConfigCache` or `config.<field>` defaults after config load | Keep defaults owned by the API/config boundary | `check-patterns.mjs` (`hardcoded-runtime-default`) |
| Placeholder literal duplication | Repeating `"No Data"`, `"---"`, or `"N/A"` outside the placeholder owner | Use `Polarrecorder.Placeholders` | `check-patterns.mjs` (`placeholder-literal`) |
| Responsive hard floor | Inline user-visible floors such as `Math.max(12, ...)` or `clamp(..., 12, ...)` | Put responsive policy in a shared owner | `check-patterns.mjs` (`responsive-layout-hard-floor`) |
| Canvas API paranoia | `typeof ctx.save === "function"` and similar internal canvas guards | Trust the validated canvas context inside draw code | `check-patterns.mjs` (`canvas-api-typeof-guard`) |
| Try/finally canvas drawing | Internal `ctx.save()` / `ctx.restore()` wrapped in `try/finally` | Use direct save/draw/restore pairing | `check-patterns.mjs` (`try-finally-canvas-drawing`) |
| JS framework method guard | `typeof Polarrecorder.* === "function"` for guaranteed namespace methods | Trust loaded internal namespace contracts | `check-patterns.mjs` (`framework-method-typeof-guard`) |
| JS dead code | Constant `if (true)`/`if (false)` or unreferenced top-level functions | Delete unreachable or stale code | `check-patterns.mjs` (`dead-code`) |
| JS unused fallback | Unused binding with `fallback` in its name | Remove it or wire it into a real path | `check-patterns.mjs` (`unused-fallback`) |
| JS premature legacy support | Speculative `*legacy*`, `*compat*`, or `*deprecated*` declarations | Remove speculative compatibility paths | `check-patterns.mjs` (`premature-legacy-support`) |
| Duplicate viewer helper | Duplicate viewer function bodies or long copied function blocks | Extract one canonical `window.Polarrecorder` helper | `check-js-duplication.mjs` |
| Viewer file size | `viewer/*.js` or `plugin.mjs` over 400 non-empty lines | Split modules before the limit is exceeded | `check-file-size.mjs` |
| JS one-line compression | Dense statements, single-line blocks/bodies, collapsed literals, packed arrow bodies, chained ternaries, long packed lines, operator-dense lines, nested packed expressions, packed destructuring, or packed `for` headers | Keep viewer code readable and split statements | `check-file-size.mjs` |
| Viewer coverage target | A viewer file missing from `COVERAGE_TARGETS` or never executed by coverage tests | Add a target and exercise it | `check-js-coverage.mjs`, `check-smell-contracts.mjs` (`viewer-coverage-target-contract`) |
| Untested viewer logic | Viewer line coverage below the file floor | Add vm-based viewer tests | `check-js-coverage.mjs` |
| Viewer rendered sentinel | Healthy payload renders `NaN`, `undefined`, or `null` | Route absent values to placeholders | `check-viewer-contracts.mjs` |
| Viewer absent placeholder | Missing `current_values` does not render the approved placeholder | Render `No Data`, not sentinel text | `check-viewer-contracts.mjs` |
| Viewer falsy preservation | Present zero readings fall back to placeholders | Preserve explicit `0` readings | `check-viewer-contracts.mjs` |
| `plugin.mjs` entry contract | Default export missing or fake AvNav API call contract broken | Keep the entry stub-thin and executable | `test-plugin-mjs.mjs` |
| Viewer behavior regressions | Theme bridge, polar chart, or smoke flow breaks | Keep viewer behavior covered by stdlib Node tests | `test-viewer-*.mjs` |

Documentation, repository, and release rules:

| Rule | Forbidden or Required | Replacement or Required Pattern | Enforcement |
|---|---|---|---|
| Documentation TOC coverage | Documentation files missing from `TABLEOFCONTENTS.md` or TOC links to missing docs | Link every documentation file from the TOC | `check-docs.mjs` |
| Documentation format | Missing title, `Status`, `Overview`, `Key Details`, or `Related` | Keep every documentation file structurally complete | `check-doc-format.mjs` |
| Documentation reachability | Broken links or docs unreachable from `AGENTS.md` / `CLAUDE.md` | Keep docs navigable through the instruction map | `check-doc-reachability.mjs` |
| AI instruction drift | Shared instruction block differs between `AGENTS.md` and `CLAUDE.md` | Sync the shared block byte-for-byte | `check-ai-instructions.mjs` |
| Markdown file size | Root or documentation Markdown over 400 non-empty lines | Split docs and keep routing details focused | `check-file-size.mjs` |
| Machine-specific host citation | Committed `/home/<user>/...` or `/Users/<user>/...` paths, or AvNav docs depending on local checkout paths | Use project-relative or redacted paths and portable host contracts | `check-patterns.mjs` (`absolute-home-path`), review |
| Unowned TODO | `TODO` or `FIXME` without `owner, YYYY-MM-DD` | Use `TODO(owner, YYYY-MM-DD): ...` | `check-patterns.mjs` (`unowned-todo`) |
| Release artifact drift | Release zip contains unexpected files, misses runtime files, has invalid metadata, or notes/artifact pairing is wrong | Keep runtime allowlist and release notes exact | `check-release.py`, release tooling |
| Hook installation drift | Missing `.githooks/pre-push`, wrong `core.hooksPath`, or non-executable hook | Run `npm run hooks:install` | `check-hooks.mjs` |
| Custom checker without tests | New or changed custom checker behavior lacks clean and failing cases | Add checker self-tests in the same change | `test:tools`, `pytest` |
| Smell catalog completeness | A checker rule exists without a matching row here, or this catalog contains a row unknown to the catalog linter | Add or update the catalog row and the linter-owned required-rule list together | `check-smell-catalog.mjs` |

Test and coverage rules:

| Rule | Forbidden or Required | Replacement or Required Pattern | Enforcement |
|---|---|---|---|
| Pytest regressions | Failing Python tests or zero useful smoke coverage | Keep unit, integration, and smoke tests green | `pytest` |
| Overall Python coverage | `server/polarrecorder/` below 90 percent branch-enabled coverage | Add meaningful tests | `pytest --cov`, coverage config |
| Validation coverage floor | Validation package below 95 percent line or branch coverage | Add validation-focused tests | `check-coverage.py` |
| Histogram coverage floor | `histogram.py` below 95 percent line or 90 percent branch coverage | Add histogram tests | `check-coverage.py` |
| Fixture drift | Mock data no longer matches API, export, persistence, validation, or viewer behavior | Update fixtures with behavior changes | Tests and review |

## Related

- [Quality gates](quality-gates.md)
- [Coding standards](coding-standards.md)
- [Documentation format](documentation-format.md)
- [Smell-fix playbooks](smell-fix-playbooks.md)
- [Testing infrastructure](testing-infrastructure.md)
- [AvNav plugin lifecycle](../avnav/plugin-lifecycle.md)
