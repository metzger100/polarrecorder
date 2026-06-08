# Smell-Fix Playbooks

**Status:** Current.

## Overview

When the gate flags a blocking smell, the correct response is almost never to
suppress, weaken, or work around the check — it is to fix the root cause. This
file gives a per-smell remediation recipe so the fix is consistent and does not
just move the problem. Each playbook names the rule, the checker that raises it,
and the concrete fix. Pair this with [smell-prevention.md](smell-prevention.md)
(the rule catalog) and [coding-standards.md](coding-standards.md).

## Key Details

### Defensive fallback masking a contract gap (`truthy-fallback`, `getattr-fallback`)

- **Checker:** `tools/check-py-contracts.py`.
- **Why it fires:** `value or <falsy-default>` / `getattr(obj, "field", default)`
  on a producer-guaranteed value hides a broken contract behind a default.
- **Fix:** Access the value directly. If the producer can legitimately omit it,
  make that explicit in the type (`X | None`) and branch on `None`; do not mask a
  falsy-but-valid value (`0`, `""`, `[]`). If the contract is genuinely unmet,
  let it raise at the boundary rather than papering over it downstream.

### Absent-value sentinel (`nan-sentinel`)

- **Checker:** `tools/check-py-contracts.py`.
- **Why it fires:** `float("nan")`, `math.nan`, `math.inf` used to mean "absent".
- **Fix:** Use `None` for absence and let the boundary decide presentation.
  Reserve non-finite floats for real numeric results, never as markers.

### Canonical-helper redefinition (`canonical-helper-redefinition`)

- **Checker:** `tools/check-py-contracts.py`.
- **Why it fires:** A module-level `def` re-implements a canonical helper owned by
  another module (for example `twa_bin`, `circular_distance`, `merge_histograms`),
  forking the contract even when the body diverges enough to dodge duplication
  detection.
- **Fix:** Delete the local copy and `import` the canonical helper from its owner
  module. If the helper genuinely needs to move, move it (and update the owner map
  in the checker) — do not keep two.

### Duplicate helper or copied block (`check-duplication.py`, `check-js-duplication.mjs`)

- **Why it fires:** The same function body or a long statement block appears in
  two files.
- **Fix:** Extract one canonical helper into the appropriate existing module
  (`units.py`, `bins.py`, a `window.Polarrecorder` namespace) and import/reuse it.
  Search before writing (`grep -rn "def <name>" server/`, `grep -rn
  "Polarrecorder\." viewer/`).

### Silent error swallowing (`empty-catch`, `catch-fallback`, `promise-empty-catch`)

- **Checker:** `tools/check-patterns.mjs`.
- **Why it fires:** A `catch` block is empty, or it neither rethrows nor marks
  a real boundary fallback; or a Promise `.catch()` swallows the
  rejection.
- **Fix:** Route the error to visible UI state or a named handler, rethrow it, or
  — when the catch is a deliberate boundary fallback (for example a cross-origin
  access that is expected to throw) — add a short
  `polarrecorder-boundary-fallback(<owner>): ...` comment explaining why the
  silent fallback is correct. A casual comment is not the escape hatch.

### Re-defaulting an internal contract result (`internal-namespace-fallback`, `default-truthy-fallback`, `redundant-null-type-guard`)

- **Checker:** `tools/check-patterns.mjs`.
- **Why it fires:** Viewer code calls an internal `Polarrecorder.*` helper and
  then `|| / ??`-defaults its result, clobbers an explicit falsy `.default`, or
  re-sanitizes a producer-guaranteed value.
- **Fix:** Trust the namespace contract. If a value can legitimately be absent,
  fix the ordering or the producer so the caller does not need a second default
  owner. Boundary defaulting on optional API fields (`data.counters || {}`) stays
  allowed.

### Speculative or dead code (`premature-legacy-support`, `dead-code`, `unused-fallback`)

- **Checker:** `tools/check-patterns.mjs`.
- **Why it fires:** A `*legacy*`/`*compat*`/`*deprecated*` declaration, a constant
  `if (true/false)`, an unreferenced function, or a stale `fallback` binding.
- **Fix:** Delete it. Version control keeps history; speculative paths are added
  only when an active boundary contract requires them.

### File-size pressure and one-liner compression (`check-python-filesize.py`, `check-file-size.mjs`)

- **Why it fires:** A file crosses the 400 non-empty-line limit, or logic is
  packed into dense one-liners to dodge it.
- **Fix:** Split the module along a real seam and keep readable formatting. Do
  this inside the same change — never defer to a later "cleanup" phase and never
  compress to fit.

### Backwards layer import or stale layer map (`layer-direction`, `layer-map-stale`)

- **Checker:** `tools/check-py-dependencies.py`.
- **Why it fires:** A domain module imports a higher architectural layer
  (primitives < core < domain < orchestration), or the `_LAYER_RANK` map no
  longer matches the package (a module is unassigned, or a mapped name was
  renamed/deleted).
- **Fix:** Make dependencies flow downward only. If a low-layer module appears to
  need a high-layer one, the design is inverted — push the shared logic down to a
  layer both can depend on, or inject it from the orchestration layer. When you
  add, rename, or remove a `server/polarrecorder/` module, update `_LAYER_RANK`
  in the same change so `layer-map-stale` stays green.

### Rendered sentinel or clobbered zero (`viewer-render-no-sentinel`, `viewer-absent-placeholder`, `viewer-falsy-preservation`)

- **Checker:** `tools/check-viewer-contracts.mjs`.
- **Why it fires:** The viewer rendered a `NaN`/`undefined`/`null` token from a
  contract-valid payload, dropped the absent-value placeholder, or turned a
  present `0` reading into a placeholder.
- **Fix:** Keep boundary numbers finite and presence-check the container, not the
  value (`values ? format(values.x) : placeholder`), so a real `0` survives and a
  genuinely absent optional routes to the placeholder. Do not add per-field
  defensive guards — fix the producer or the presence check. The contract only
  ever feeds contract-valid payloads, so a failure is a real rendering bug.

### Unjustified suppression (`*-suppression`)

- **Checker:** `tools/check-patterns.mjs`.
- **Why it fires:** A blanket `# noqa` / `# type: ignore`, a file-level
  suppression, or a viewer `eslint-disable` / `@ts-ignore`.
- **Fix:** Remove the suppression and fix the underlying lint/type error. If a
  suppression is genuinely warranted, name the specific code and add a trailing
  `# <reason>`; file-level and blanket suppressions are never allowed.

## Related

- [Smell prevention](smell-prevention.md)
- [Coding standards](coding-standards.md)
- [Testing infrastructure](testing-infrastructure.md)
- [Contributing](../../CONTRIBUTING.md)
