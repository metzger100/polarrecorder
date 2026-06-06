# Smell Prevention

**Status:** Current.

## Overview

The smell catalog defines blocking anti-patterns and the required replacement patterns. Treat these as fail-closed rules for code and docs.

## Key Details

| Smell Class | Anti-Pattern | Required Pattern | Enforcement | Severity |
|---|---|---|---|---|
| AvNav import leak | `server/polarrecorder/` imports `avnav_api`, `pluginhandler`, or AvNav internals | Inject AvNav dependencies through protocols/fakes | ruff banned imports and `check-patterns.mjs` | block |
| Reverse dependency | `server/polarrecorder/` imports `plugin.py` | Dependency flows from `plugin.py` inward only | `check-patterns.mjs` and review | block |
| Lock acquisition in domain code | `threading.Lock`, `RLock`, or `Condition` in `server/polarrecorder/` | Locks belong only in `plugin.py` | `check-patterns.mjs` | block |
| Real sleep in domain code | `time.sleep()` in `server/polarrecorder/` | Use injected clocks and deterministic tests | `check-patterns.mjs` | block |
| Broad domain exception | Bare or broad `except` in `server/polarrecorder/` | Catch specific exceptions; boundary handles crash safety | ruff and review | block |
| Print statement | `print()` | Use logger protocol or AvNav logging boundary | ruff `T20` | block |
| Python version drift | Python 3.10+ syntax, `tomllib`, newer `typing` names, or `dataclass(slots=True)` in covered Python files | Keep runtime and tests valid on Python 3.9, or raise the documented runtime floor deliberately | `check-python-compat.py` | block |
| Magic threshold | Hardcoded model or validation threshold in a comparison | Use named config/constants | ruff `PLR2004` and review | block |
| Defensive fallback masking a contract gap | `value or <falsy-default>`, `getattr(obj, "field", <default>)` on a guaranteed producer value | Access the value directly and fail loudly if the contract is unmet | `check-py-contracts.py` | block |
| Absent-value sentinel | `float("nan")`, `math.nan`, `math.inf` (or `NaN`/`-1`/`0`) as an absent marker | Use `None` and let the boundary decide presentation | `check-py-contracts.py` and review | block |
| Redundant type guard (Python) | `x if isinstance(x, list) else []` or `str(x if x is None else ...)` re-sanitizes a producer-guaranteed value | Trust the validated contract; do not re-check the type downstream (Python twin of the viewer `redundant-null-type-guard`) | `check-py-contracts.py` (`redundant-type-guard`) | block |
| Framework method guard (Python) | `hasattr(self, "field")` or `callable(getattr(self, "field", ...))` probes a guaranteed attribute/method | Access `self.field` directly and fail loudly if the contract is unmet (Python twin of the viewer `framework-method-typeof-guard`) | `check-py-contracts.py` (`framework-method-guard`) | block |
| Premature legacy support (Python) | A module/class-level `def` or constant named `*legacy*`/`*compat*`/`*deprecated*` that nothing references is a speculative shim | Remove it until a live boundary contract requires it; referenced aliases (e.g. `LEGACY_PRESET_ALIASES`) stay allowed | `check-py-contracts.py` (`premature-legacy-support`) | block |
| Duplicate helper or function | A helper or long statement block re-implemented in another module instead of importing the canonical one | Extract one canonical helper and import it | `check-duplication.py` | block |
| Hot-path algorithmic regression | Model update or polar-format hot paths become unexpectedly slow, or per-sample work turns super-linear (an accidental O(n^2)) | Keep per-sample updates and projection/formatting bounded and deterministic; generous absolute ceilings plus a machine-independent doubling-ratio guard | `check-performance.py` (absolute ceilings + `MAX_UPDATE_SCALING_RATIO`) | block |
| Runtime non-finite leak | A NaN/Infinity produced at runtime reaches the polar/CSV/Windy boundary, or a `nan`/`inf` sentinel string reaches an export payload | Keep boundary numbers finite and absent values as `None`; the static `nan-sentinel` rule cannot see runtime-produced non-finites | `check-runtime-contracts.py` | block |
| Duplicate viewer helper | A `viewer/*.js` function body or long function block re-implemented in another viewer file | Extract one canonical `window.Polarrecorder` helper and reuse it | `check-js-duplication.mjs` | block |
| Absolute home path | Machine-local `/home/<user>/...` or `/Users/<user>/...` committed in source, docs, workflows, or release metadata | Project-relative or redacted placeholder (`/home/<user>/...`) | `check-patterns.mjs` | block |
| Unjustified lint suppression | Blanket `# noqa`, `# type: ignore`, or file-level `# ruff: noqa` / `# mypy: ignore-errors`, or a coded suppression with no reason | Suppress specific codes with a trailing `# <reason>` | `check-patterns.mjs` | block |
| Viewer lint/type suppression | `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `prettier-ignore`, `istanbul ignore` in `viewer/*.js` | Fix the root cause | `check-patterns.mjs` | block |
| Unowned TODO | `TODO`/`FIXME` without owner and date in source or Markdown | `TODO(owner, YYYY-MM-DD): ...` | `check-patterns.mjs` | block |
| Untested viewer logic | A gated `viewer/*.js` file below its line-coverage floor | Add vm-based viewer tests until the floor is met | `check-js-coverage.mjs` | block |
| Missing viewer coverage target | A new `viewer/*.js` file is not listed in the per-file coverage target map | Add a target and exercise it through vm-based viewer tests | `check-js-coverage.mjs` and `check-smell-contracts.mjs` | block |
| Viewer dependency header drift | A `viewer/*.js` file's `Depends:` header omits or stales a real cross-file `window.Polarrecorder` dependency | Keep `Depends:` equal to the real viewer namespace references | `check-smell-contracts.mjs` | block |
| Viewer script contract drift | `viewer/viewer.html` misses a viewer script or changes the approved load order accidentally | Keep the static script list explicit and ordered for the no-build runtime | `check-smell-contracts.mjs` | block |
| Machine-specific host citation in docs | Docs depend on a machine-specific AvNav path | Describe the AvNav behavior contract directly | review and `check:docs` | block |
| File size bypass | One-line compression to evade code limits, including stacked declarations, packed destructuring or `for` headers, comma assignment chains, collapsed literals/bodies, or oversized Markdown docs that bury routing/contract details | Split modules/docs and keep readable formatting | Python and JS filesize/oneliner checks plus Markdown filesize checks | block |
| Commented-out code | Dead code left in comments | Delete it; version control keeps history | ruff and `check-patterns.mjs` | block |
| JS global pollution | Globals outside `window.Polarrecorder` | Namespace all browser exports | `check-namespace.mjs` | block |
| JS ES module syntax | `import`/`export` in `viewer/*.js` | Plain scripts; `plugin.mjs` only for AvNav module entry and is still pattern-scanned | `check-patterns.mjs` | block |
| JS debug leftover | `console.log()` | Remove or use `console.warn`/`console.error` intentionally | `check-patterns.mjs` | block |
| JS unsafe DOM mutation | `innerHTML` assignment or `eval()` | DOM APIs and safe text assignment | `check-patterns.mjs` | block |
| JS bare isFinite | `isFinite(x)` (global coercion) | `Number.isFinite(x)` | `check-patterns.mjs` | block |
| JS empty catch | A lexical `try { ... } catch (e) {}` that swallows errors silently | Rethrow, route to visible state, or use a structured boundary-fallback marker for an intentional host-boundary fallback | `check-patterns.mjs` | block |
| JS empty Promise catch | `.catch(function () {})` or equivalent empty Promise catch swallows a rejected request | Route errors to a named handler or visible UI state | `check-patterns.mjs` (`promise-empty-catch`) | block |
| JS silent catch fallback | A lexical `catch { ... }` that neither rethrows nor carries `polarrecorder-boundary-fallback(<owner>): ...` swallows the error and degrades to a fallback | Rethrow, route to visible state, or mark a real host/browser boundary fallback with the structured owner marker | `check-patterns.mjs` (`catch-fallback`) | block |
| JS internal namespace re-default | `Polarrecorder.X.Helper(...) \|\| fb` / `?? fb` re-defaults a contract-guaranteed namespace result | Trust the namespace contract; fix caller order instead of adding a second default owner (boundary defaulting on optional API fields stays allowed) | `check-patterns.mjs` (`internal-namespace-fallback`) | block |
| Canonical helper redefinition (Python) | A module-level `def` re-implements a canonical domain helper owned by another module (e.g. `twa_bin`, `circular_distance`) | Import the canonical helper from its owner module; do not fork the contract under the same name | `check-py-contracts.py` (`canonical-helper-redefinition`) | block |
| Stale canonical-helper map | The `_CANONICAL_HELPERS` owner map points at a module/name that no longer defines that helper (renamed, moved, or deleted), silently disabling the redefinition guard | Keep the owner map equal to reality; restore the helper or fix the map (the static twin of the dyninstruments `canonical-helper-completeness` runtime check) | `check-py-contracts.py` (`canonical-helper-map-stale`) | block |
| JS truthy default clobber | `x.default \|\| fallback` in `viewer/*.js`, clobbering an explicit `""`, `0`, or `false` | Use `??` or a presence check; only `.default` is targeted so boundary defaulting on optional API fields stays allowed | `check-patterns.mjs` (default-truthy-fallback) | block |
| JS redundant re-sanitize | `Array.isArray(x) ? x : []` or `String(x == null ? ... : x)` on a producer-guaranteed value | Trust the validated contract; do not re-sanitize | `check-patterns.mjs` (redundant-null-type-guard) | block |
| JS hardcoded runtime default | Viewer code duplicates config defaults after `Polarrecorder.ConfigCache` should be loaded, including literal `ConfigCache = { ... }`, `ConfigCache || {}`, or `config.<field> ||/?? <literal>` fallbacks | Trust the API/config boundary and surface boundary failures instead of adding a second default owner | `check-patterns.mjs` (`hardcoded-runtime-default`) | block |
| JS placeholder literal duplication | Viewer code repeats absent-value placeholders such as `"No Data"`, `"---"`, or `"N/A"` outside the placeholder owner | Use `Polarrecorder.Placeholders` so placeholder vocabulary has one owner | `check-patterns.mjs` (`placeholder-literal`) | block |
| JS responsive hard floor | Viewer code uses inline user-visible layout/text floors such as `Math.max(12, size)` or `clamp(value, 12, max)` | Put responsive floor policy in a shared owner and consume that result; technical `0`/`1` guards stay allowed | `check-patterns.mjs` (`responsive-layout-hard-floor`) | block |
| JS canvas API paranoia | Viewer drawing code checks standard Canvas 2D methods with `typeof ctx.save === "function"` | Trust the validated canvas context inside drawing code; keep capability checks at real external boundaries only | `check-patterns.mjs` (`canvas-api-typeof-guard`) | block |
| JS try/finally canvas drawing | Internal draw paths wrap `ctx.save()` / `ctx.restore()` in `try/finally` without an external throwing boundary | Use direct save/draw/restore pairing; reserve `try/finally` for boundary cleanup | `check-patterns.mjs` (`try-finally-canvas-drawing`) | block |
| JS framework method guard | `typeof Polarrecorder.* === "function"` around guaranteed namespace methods | Trust loaded internal namespace contracts; branch only at optional external boundaries | `check-patterns.mjs` (`framework-method-typeof-guard`) | block |
| JS dead code | Constant `if (true)` / `if (false)`, or a top-level `function` declared but never referenced | Delete the unreachable branch or stale function | `check-patterns.mjs` (dead-code) | block |
| JS unused fallback | A `fallback`-named binding declared but never used | Remove the stale leftover or wire it into an active path | `check-patterns.mjs` (unused-fallback) | block |
| JS premature legacy support | A declaration named `*legacy*` / `*compat*` / `*deprecated*` for a speculative path | Remove speculative compat unless an active boundary contract requires it | `check-patterns.mjs` (premature-legacy-support) | block |
| Stale dependency header | A `server/polarrecorder/` module whose `Depends:` header omits an imported `polarrecorder.*` module or lists one it does not import (runtime and `TYPE_CHECKING` imports both count) | Keep the header equal to the module's real intra-package imports | `check-py-dependencies.py` (header-accuracy) | block |
| Domain import cycle | A runtime import cycle among `server/polarrecorder/` modules | Break the cycle; move type-only edges under `TYPE_CHECKING` | `check-py-dependencies.py` (no-cycles) | block |
| Backwards layer import | A `server/polarrecorder/` module imports a higher architectural layer (e.g. a primitive importing an orchestration module); dependencies must flow down only | Depend on the same or a lower layer; if a low module needs a high one, the design is inverted — move the shared logic down | `check-py-dependencies.py` (layer-direction) | block |
| Stale layer map | The `_LAYER_RANK` map omits a real domain module or names one that no longer exists, silently disabling the layer-direction guard | Keep the map equal to reality; assign every module a layer (the Python twin of `canonical-helper-map-stale`) | `check-py-dependencies.py` (layer-map-stale) | block |
| Rendered sentinel leak | The viewer renders a `NaN`/`undefined`/`null` token from a contract-valid payload, or clobbers a present `0` reading to a placeholder | Keep boundary numbers finite, route absent optionals to a placeholder, and presence-check the container not the value (the viewer twin of `check-runtime-contracts.py`) | `check-viewer-contracts.mjs` (viewer-render-no-sentinel, viewer-absent-placeholder, viewer-falsy-preservation) | block |
| Untested custom checker rule | A custom `tools/check-*` rule (JS or Python) has no positive and clean test case | Add a self-test in the same task — `tools/test-js-checkers.mjs` / `tools/test-check-patterns.mjs` for JS, `tests/test_*_checker.py` for Python | `npm run test:tools`, `pytest` | block |

## Related

- [Coding standards](coding-standards.md)
- [Smell-fix playbooks](smell-fix-playbooks.md)
- [Quality](../QUALITY.md)
- [AvNav plugin lifecycle](../avnav/plugin-lifecycle.md)
