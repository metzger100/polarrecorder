# Testing Infrastructure

**Status:** Current.

## Overview

Tests are deterministic, stdlib-friendly, and independent of a live AvNav server. Fakes model only the AvNav surface Polar Recorder actually uses.

## Key Details

- `tests/conftest.py` provides `FakeAvNavAPI`, `FakeClock`, and `FakeLogger`.
- `FakeAvNavAPI` mirrors the AvNav methods used by Polar Recorder and deliberately exposes no `fileName` attribute.
- Tests use injected clocks instead of sleeping or monkey-patching time.
- The coverage gate measures `server/polarrecorder/` only and requires at least 90 percent total coverage with branch coverage enabled.
- `tools/check-coverage.py` enforces per-area line and branch floors for the validation package and histogram core.
- The smoke test imports `polarrecorder` and instantiates `plugin.py` so pytest never exits with zero collected tests.
- Plugin integration tests exercise the single-lock API/persistence boundary with fakes rather than a live AvNav process.
- Mock API fixture files under `tests/mock-data/` mirror the viewer/mock-server starting state and should change with user-visible API shape changes.
- `npm run test:plugin` imports `plugin.mjs`, verifies the default export, and calls it with a fake AvNav API object so the module entry point cannot grow untested behavior.
- `npm run test:viewer` runs stdlib-only Node.js tests for static viewer behavior that needs DOM-like fakes without a browser, including the AvNav theme bridge, polar chart rendering, and cross-module viewer smoke flow. It is part of `npm run check:js:all`, which is called by the full `tools/check-all.sh` / `npm run check:all` gate.
- `npm run test:tools` runs stdlib-only Node.js tests for custom JS quality tooling, including positive and clean cases for `tools/check-patterns.mjs` fail-fast rules.
- `tools/check-js-coverage.mjs` runs those viewer tests under V8 coverage and requires every `viewer/*.js` file to have an explicit line-coverage floor.
- `tools/check-performance.py` runs deterministic smoke checks for model update and polar-format hot paths; ceilings are generous and intended to catch algorithmic regressions.

## Related

- [Coding standards](coding-standards.md)
- [Quality gates](quality-gates.md)
- [Core principles](../core-principles.md)
- [API shape](../architecture/api.md)
- [AvNav editable parameters](../avnav/editable-parameters.md)
