# Testing Infrastructure

**Status:** Current.

## Overview

Tests are deterministic, stdlib-friendly, and independent of a live AvNav server. Fakes model only the AvNav surface
Polar Recorder actually uses.

## Key Details

- `tests/conftest.py` provides `FakeAvNavAPI`, `FakeClock`, and `FakeLogger`.
- `FakeAvNavAPI` mirrors the AvNav methods used by Polar Recorder and deliberately exposes no `fileName` attribute.
- Tests use injected clocks instead of sleeping or monkey-patching time.
- `npm run test:coverage:python` measures `server/polarrecorder/` and `plugin.py` together
  (`--cov=polarrecorder --cov=plugin --cov-branch`), writes `coverage/python/coverage.json`, and natively fails under 90
  percent combined coverage. `npm run test:coverage:viewer` measures `viewer/*.js`, `plugin.js`, and `plugin.mjs`
  together via Vitest's native V8 coverage provider (VM-attributed through the `filename` option every
  `vm.runInNewContext` call already passes), writes `coverage/viewer/coverage-summary.json`, and natively fails its own
  80/80/80/65 percent line/function/statement/branch global floor. Both report directories are `coverage/`-ignored and
  are cleaned and recreated on every run.
- The V8 provider remaps coverage through the real AST, so only genuinely executable statements and lines count toward a
  percentage. Comment-only lines, blank lines, and lone closing braces are excluded from the denominator instead of
  being counted as covered code, which makes the reported percentages lower than a purely line-based approximation of
  the same covered code. Compare percentages only against reports from the same provider.
- `npm run check:coverage-inventory` (`tools/quality-policy/check-coverage-inventory.mjs`) reads both reports and:
  proves every `server/polarrecorder/**/*.py`, `plugin.py`, `viewer/*.js`, `plugin.js`, and `plugin.mjs` file is
  classified `measured` (present in a report) or `contract-owned` (a real, runner/pytest-discovered owner test that
  actually imports the target, never a partially-measured file); enforces the validation-package (95/95), histogram-core
  (95/90), Python-aggregate (90), viewer-family, and plugin-entrypoint-family (80/80/80/65 each) floors plus
  `plugin.py`'s and every viewer file's per-file floor, all read from `tools/quality-policy/coverage-floors.json`; and
  proves those active floors never fall below `tools/quality-policy/coverage-floor-baseline.json`, itself mechanically
  re-derived every run from the frozen `baseline-coverage-capture.json` (whose SHA-256 is independently hardcoded in
  `tests/js/coverage-inventory.test.mjs`, so a coordinated edit to both the capture and the baseline still needs a
  visible test-file change). `npm run test:coverage:check` runs all three in sequence and is the sole coverage half of
  the final `check:all`.
- The smoke test imports `polarrecorder` and instantiates `plugin.py` so pytest never exits with zero collected tests.
- Plugin integration tests exercise the single-lock API/persistence boundary with fakes rather than a live AvNav
  process.
- Mock API fixture files under `tests/mock-data/` mirror the viewer/mock-server starting state and should change with
  user-visible API shape changes.
- Every executable JavaScript test/helper lives under `tests/js/*.test.mjs` (plus the shared `tools/viewer-harness.mjs`
  fake-DOM/fetch harness) and runs under Vitest with `node:assert/strict` assertions -- no custom runner, no success
  `console.log` sentinel; Vitest reports pass/fail and exit code itself. Reusable CLI checker implementations
  (`check-*.mjs`) stay under `tools/`, imported by their matching `tests/js/*.test.mjs` file.
- `vitest.config.mjs` defines three projects by include pattern rather than by file list: `viewer`
  (`tests/js/viewer-*.test.mjs`), `plugin` (`tests/js/plugin-*.test.mjs`), and `tools` (every other
  `tests/js/*.test.mjs`). Because the projects are pattern-matched, a newly added test file is picked up by a gate
  automatically. `tests/js/vitest-projects.test.mjs` additionally asserts that every tracked `tests/js` test file is
  claimed by exactly one project, so a file can never be silently excluded, and that the patterns stay inside the glob
  subset that contract can verify. `allowOnly: false` is set globally and per project, so a stray `.only` fails the run
  itself in addition to failing `test:focus:check`.
- `npm run test:plugin` executes legacy `plugin.js`, imports `plugin.mjs`, verifies the default export, and calls it
  with a fake AvNav API object so the entrypoints cannot grow untested behavior.
- `npm run test:viewer` runs the Vitest `viewer` project over the theme bridge, polar chart, band selection, grid
  editor, and cross-module viewer smoke/enhanced/advanced settings suites with DOM-like fakes and no browser. It is
  reached through `test:node` (part of `test:split`, part of `check:core`) and directly through the bounded `test:unit`
  aggregate (part of `check:fast`); `tools/check-all.sh` is a compatibility wrapper around `check:all`. The `viewer` and
  `tools` projects both set `fileParallelism: false` because some fixtures (e.g. the ESLint self-tests) briefly write
  into the real `viewer/`/`plugin.js`/`plugin.mjs` tree, which would race under concurrent file execution.
- `npm run test:tools` runs the Vitest `tools` project over the custom JS quality-tooling self-tests, including positive
  and clean cases for `tools/check-patterns.mjs` fail-fast rules.
- `npm run typecheck:source` (`tools/quality-policy/typecheck-source.mjs`) strictly no-emit `checkJs`-types every
  shipped `plugin.js`, `plugin.mjs`, and `viewer/*.js` file against `tsconfig.checkjs.json` and fails if the live
  shipped-source set drifts from that config's `include` list. `tests/js/typecheck-source.test.mjs` proves the
  inventory-drift detection plus five negative contract fixtures (a new viewer file omitted from the inventory, a
  misspelled namespace method, a nullable DOM value used without narrowing, runtime `import`/`export` drift, and an
  incompatible mock payload), each shown to fail on the bad shape and pass on the clean one.
- `npm run typecheck:tests` (`tools/quality-policy/test-inventory.mjs`) is the permanent owner for every executable JS
  test/helper: it verifies the committed `tools/quality-policy/test-inventory.json` (every entry classified `strict`;
  there is no harness exception class) and `tsconfig.tests.json`'s `include` list both match live discovery with no
  drift, verifies `tools/quality-policy/test-exception-baseline.json`'s exception list stays empty (independently
  digest-anchored in `tests/js/test-inventory.test.mjs`), verifies any file under `tests/fixtures/quality/` matches a
  planned, non-executable, referenced entry in `tools/quality-policy/planned-quality-fixtures.json`, then strictly
  no-emit `checkJs`-types the whole set against `tsconfig.tests.json`.
- `npm run typecheck:tools` (`tools/quality-policy/typecheck-tools.mjs`) is the `typecheck:source`/`typecheck:tests`
  twin for maintained JavaScript quality tooling: it verifies the committed `tsconfig.tools.json`'s `include` list
  matches live discovery of every `tools/**/*.mjs` file with no drift, then strictly no-emit `checkJs`-types the whole
  set. `tests/js/typecheck-tools.test.mjs` proves the inventory-drift detection (a live tool file missing from the list,
  a stale listed entry) and that the real repo's tool source typechecks clean.
- `npm run test:focus:check` blocks focused or disabled tests before they merge: `tools/check-test-focus.mjs` parses
  every executable JS test/helper with `acorn` (so string/comment content can never trigger a false positive) for
  `.only(`/`.skip(`/`.todo(` calls, Jasmine-style bare aliases (`fdescribe`/`fit`/`xdescribe`/`xit`/`xtest`), Vitest's
  chained conditional modifiers (`test.skipIf(...)`/`test.runIf(...)`, whose test name sits on the outer call), and the
  `{ only/skip/todo: true }` options-object form; `tools/check-test-focus.py` walks every `tests/*.py` file's AST for
  `@pytest.mark.skip`/`skipif`/`xfail`, `@unittest.skip`/`skipIf`/`skipUnless`/`expectedFailure`, and
  `self.skipTest(...)`/`pytest.skip(...)`/`pytest.xfail(...)` calls. The verified initial exception set for both is
  empty.
- `npm run check:complexity` runs maintained ESLint directly against `viewer/*.js`, `plugin.js`, and `plugin.mjs` with a
  focused flat configuration (`tools/quality-policy/eslint.complexity.config.mjs`) that sets `complexity`,
  `max-statements`, `max-depth`, and `max-params` to error-level 10/40/4/6. There is no scanner, budget ledger, or
  baseline file for ESLint to read, so a coordinated edit to policy data can never authorize a violation -- this
  replaced an earlier custom scanner/budget/baseline design (adapted from the sibling `dyninstruments` plugin) that let
  an over-limit function pass once a matching baseline entry existed. `tests/js/complexity-policy.test.mjs` proves a
  clean function passes, each of the four limits fails independently, `plugin.js`/`plugin.mjs`/`viewer/*.js` are all
  covered, a dev-tool function over the same numeric limit is outside the shipped-product scope, the retired
  scanner/budget/baseline files stay absent, and a fixture recreating a matching `complexity-baseline.json` next to a
  real violation still fails because ESLint never reads it.
- `npm run check:scaling` replaces the old wall-clock `tools/check-performance.py` with deterministic,
  machine-independent counted-operation contracts: `tests/operation_count_evaluator.py` (adapted from `dyninstruments`'
  `operation-count-evaluator.mjs`) offers `evaluate_linear_scaling` (`work(2n) <= 2 * work(n) + fixed_overhead`) and
  `evaluate_bounded_by_configured_steps` (`work(steps) <= steps * tolerance_per_step`), both pure functions over
  caller-supplied operation counts -- never a clock. Counts come from test-only counting `dict` substitutions
  (`tests/counting_dict.py`) or a monkeypatched call-counting wrapper, never from instrumentation added to production
  code. Three real contracts exercise this: `PolarModel.update_accepted`'s per-sample dict/histogram operations stay
  linear in accepted-sample count (`tests/test_polar_model.py`); `projection.project_grid`'s raw-bin reads stay linear
  in raw-bin count for a fixed grid, and its cells match the uninstrumented result
  (`tests/test_projection_scaling_contract.py`); and `api_handlers.format_polar`'s projection-facing reads stay linear
  in raw-bin count for a fixed grid, its curve/cell assembly stays bounded by the configured TWS grid cell count, and
  its complete response (metadata, curves, confidence, missing-cell behavior) matches the ordinary formatter's output
  (`tests/test_api_handlers_scaling_contract.py`).
- Hypothesis (pinned in the developer lock only) adds generative property tests for core math:
  `circular_distance`/`circular_range` symmetry, rotation invariance, and `[0, 180]`/`[0, 360]` bounds in
  `tests/test_angle_math.py`; `twa_bin`/`tws_bin` bounded output and `twa_bin`'s 360-degree periodicity in
  `tests/test_bins.py`; knot/meters-per-second round trips within a named relative+absolute tolerance in
  `tests/test_units.py`; and `percentile`'s `None`-only-for-empty-input, finite-and-observed-key, and monotonicity
  invariants in `tests/test_histogram.py`. Every strategy generates finite, bounded values
  (`allow_nan=False, allow_infinity=False`) so no NaN/Infinity filtering is hidden inside production code; float-bound
  assertions carry a small epsilon where floating-point modulo/rounding can legitimately overshoot an exact mathematical
  bound by a few ULPs.

## Related

- [Coding standards](coding-standards.md)
- [Quality gates](quality-gates.md)
- [Core principles](../core-principles.md)
- [API shape](../architecture/api.md)
- [AvNav editable parameters](../avnav/editable-parameters.md)
