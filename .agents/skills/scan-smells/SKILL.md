---
name: scan-smells
description:
  Scans proposed code changes against the project's smell catalog before committing and catches the defensive, verbose
  patterns that AI agents typically introduce.
---

# Skill: scan-smells

## Description

Scans proposed code changes against the project's smell catalog (`documentation/conventions/smell-prevention.md`) before
committing. Catches the defensive, verbose, "play it safe" patterns that AI agents typically introduce. Understands the
boundary model: where defaults/validation belong vs. where interior code should trust its inputs.

## When to Use

Before committing any code change. Run this mental checklist against every file you've written or modified.

## Instructions

### The Core Principle

**Fail-fast / keep-it-simple:** Defaults and validation belong at boundaries. Internal code trusts normalized contracts.
If you're adding a guard, fallback, or normalization inside a viewer module, a domain module under
`server/polarrecorder/`, or a validation stage — you're almost certainly in the wrong place.

Boundaries are: `reader.py` (raw AvNav store access), `units.py` (unit conversion), the validation pipeline's entry
point, `plugin.py` (the single lock and snapshot boundary), `Polarrecorder.ConfigCache` (viewer config load), and
`Polarrecorder.Placeholders` (absent-value display text).

Interior code is: everything else in `server/polarrecorder/`, and every `viewer/*.js` module past its own boundary call.

### Smell Checklist

Scan every line of your proposed code against these patterns. If you find a match, apply the fix. Generic lint-disable
directives are forbidden in production; use only a checker-owned canonical exception or the validated boundary-fallback
marker described below.

#### Category 1: Redundant Guards on Normalized Values (BLOCK)

**`redundant-null-type-guard`** — Interior code repeatedly sanitizes an already-normalized value.

```python
# ❌ SMELL: value is already validated by the pipeline
result = x if isinstance(x, list) else []
text = str(x if x is None else x)

# ✅ FIX: trust the validated contract
result = x
text = str(x)
```

```javascript
// ❌ SMELL: producer already guarantees the shape
Array.isArray(x) ? x : [];
String(x == null ? "" : x);

// ✅ FIX: trust the producer contract
x;
String(x);
```

#### Category 2: Duplicated Defaults (BLOCK)

**`hardcoded-runtime-default`** — Viewer/config code duplicates a default already owned by the API/config boundary.

```javascript
// ❌ SMELL: ConfigCache is loaded before dependent UI runs
const interval = Polarrecorder.ConfigCache || {};
const threshold = config.low_wind_threshold || 3;

// ✅ FIX: trust the config boundary; a missing value is a caller-order bug, not a place for a second default
const interval = Polarrecorder.ConfigCache;
const threshold = config.low_wind_threshold;
```

**Defensive fallback masking a contract gap (Python)** — `value or <fallback>` / `getattr(obj, "field", <fallback>)` on
a producer-guaranteed value.

```python
# ❌ SMELL
name = sample.owner or "unknown"
value = getattr(config, "percentile", 65)

# ✅ FIX: access the contract value directly and fail loudly if it's actually missing
name = sample.owner
value = config.percentile
```

#### Category 3: Defensive Framework Guards (BLOCK)

**`canvas-api-typeof-guard`** — Internal drawing code checks standard Canvas 2D methods.

```javascript
// ❌ SMELL: the Canvas 2D context is validated at the boundary
if (typeof ctx.setLineDash === "function") {
  ctx.setLineDash([5, 3]);
}

// ✅ FIX: trust the validated Canvas 2D context
ctx.setLineDash([5, 3]);
```

**`framework-method-typeof-guard`** — Internal code checks a `Polarrecorder.*` method after module load.

```javascript
// ❌ SMELL: the namespace was already resolved when the module loaded
if (typeof Polarrecorder.Presets.Fallback === "function") {
  return Polarrecorder.Presets.Fallback();
}

// ✅ FIX: trust the namespace contract
return Polarrecorder.Presets.Fallback();
```

**`try-finally-canvas-drawing`** — Internal save/draw/restore wrapped in `try/finally` without a real throwing boundary.

```javascript
// ❌ SMELL
try {
  ctx.save();
  ctx.rotate(angle);
  drawPointer(ctx);
} finally {
  ctx.restore();
}

// ✅ FIX: direct save/draw/restore pairing
ctx.save();
ctx.rotate(angle);
drawPointer(ctx);
ctx.restore();
```

**Framework method guard (Python)** — `hasattr(self, "field")` / `callable(getattr(self, "field", ...))` on a guaranteed
method or attribute.

```python
# ❌ SMELL
if hasattr(self, "clock"):
    now = self.clock.now()

# ✅ FIX: access it directly
now = self.clock.now()
```

#### Category 4: Internal Namespace Fallbacks (BLOCK)

**`internal-namespace-fallback`** — Calling an internal `Polarrecorder.X.Helper(...)` and immediately defaulting its
result with `||`/`??`.

```javascript
// ❌ SMELL: re-defaulting a value the namespace contract already guarantees
const label = Polarrecorder.Dom.RequireById("polar-chart") || fallbackHost;

// ✅ FIX: trust the namespace and fix caller order if it's actually wrong
const label = Polarrecorder.Dom.RequireById("polar-chart");
```

#### Category 5: Falsy Default Clobbering (BLOCK)

**`default-truthy-fallback`** — Using `||` which clobbers explicit `""`, `0`, `false`.

```javascript
// ❌ SMELL: clobbers an explicit empty string or zero
const label = data.default || "---";
const value = data.minValue || 0;

// ✅ FIX: use nullish coalescing or a presence check
const label = data.default ?? "---";
const value = data.minValue != null ? data.minValue : 0;
```

#### Category 6: Placeholder and Responsive Ownership (BLOCK)

**`placeholder-literal`** — Duplicating `"No Data"`, `"---"`, or `"N/A"` outside `Polarrecorder.Placeholders`.

```javascript
// ❌ SMELL
status.textContent = value == null ? "No Data" : String(value);

// ✅ FIX: reuse the owned placeholder
status.textContent = value == null ? Polarrecorder.Placeholders.NoData : String(value);
```

**`responsive-layout-hard-floor`** — Inline `Math.max(N, ...)` / `clamp(..., N, ...)` (N >= 8) for a user-visible
layout/text floor.

```javascript
// ❌ SMELL: floor belongs to a shared owner
const fontSize = Math.max(12, computed);

// ✅ FIX: derive the floor from the shared owner instead of an inline literal
```

#### Category 7: Structural Patterns (BLOCK)

**`catch-fallback`** — Non-rethrow, non-empty catch silently swallows the error.

```javascript
// ❌ SMELL
try {
  result = compute();
} catch (e) {
  result = fallback;
}

// ✅ FIX: rethrow, route to visible state, or mark an intentional boundary fallback
try {
  result = compute();
} catch (e) {
  // polarrecorder-boundary-fallback(export-ui): host clipboard API may be unavailable
  result = fallback;
}
```

**`promise-empty-catch`** / **empty catch** — An empty `catch {}` or empty `.catch(function () {})`.

```javascript
// ❌ SMELL
fetch(url).catch(function () {});

// ✅ FIX: route the error to visible state or a named handler
fetch(url).catch(function (error) {
  showError(error);
});
```

**`premature-legacy-support`** — Speculative compat/legacy/deprecated naming with no live caller.

```javascript
// ❌ SMELL
function legacyResolve() { ... }
const compatValue = oldApi ? oldApi.get() : newApi.get();

// ✅ FIX: remove until a live boundary requires it
```

**`unused-fallback`** — A `fallback`-named binding declared but never wired into an active path.

**`commented-out-code`** — Three or more consecutive commented-out lines that look like code. Delete it; git history
already has it.

#### Category 8: Suppression Discipline (BLOCK)

**`invalid-lint-suppression`** (Python `# noqa`/`# type: ignore`; JS is ESLint's `no-warning-comments` job) — a blanket
suppression, or one missing a specific code and a trailing reason.

```python
# ❌ SMELL
value = risky_call()  # noqa
value = risky_call()  # type: ignore

# ✅ FIX: name the specific code and the reason
value = risky_call()  # noqa: BLE001  # upstream API has no typed exception here
```

### After Scanning

1. Fix every finding before committing; all live rules are blocking.
2. Run the project's pattern checker to verify mechanically: `npm run check:patterns` (JS/Python cross-file rules),
   `npm run lint:ruff` (Python-specific families), `npm run lint:js` (ESLint-owned JS rules).
3. Run `npm run check:all` as the final gate.

### Suppression Syntax

Generic production suppressions are forbidden. The only source marker is for a genuine intentional boundary fallback:

```javascript
// polarrecorder-boundary-fallback(<owner>): <reason>
```

- The marker affects only `catch-fallback`.
- An `<owner>` and a reason are required; a comment-only swallow without the marker fails `catch-fallback`.
- Python lint suppressions must name specific codes and carry a reason: `# noqa: <CODES>  # <reason>` and
  `# type: ignore[<code>]  # <reason>`. Blanket forms fail `invalid-lint-suppression`.
