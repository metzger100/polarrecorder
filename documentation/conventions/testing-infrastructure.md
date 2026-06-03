# Testing Infrastructure

**Status:** Current.

## Overview

Tests are deterministic, stdlib-friendly, and independent of a live AvNav server. Fakes model only the AvNav surface Polar Recorder actually uses.

## Key Details

- `tests/conftest.py` provides `FakeAvNavAPI`, `FakeClock`, and `FakeLogger`.
- `FakeAvNavAPI` mirrors the AvNav methods used by Polar Recorder and deliberately exposes no `fileName` attribute.
- Tests use injected clocks instead of sleeping or monkey-patching time.
- The coverage gate measures `server/polarrecorder/` only and requires at least 90 percent line coverage.
- The smoke test imports `polarrecorder` and instantiates `plugin.py` so pytest never exits with zero collected tests.
- Plugin integration tests exercise the single-lock API/persistence boundary with fakes rather than a live AvNav process.
- Mock API fixture files under `tests/mock-data/` mirror the viewer/mock-server starting state and should change with user-visible API shape changes.

## Related

- [Coding standards](coding-standards.md)
- [Core principles](../core-principles.md)
- [API shape](../architecture/api.md)
- [AvNav editable parameters](../avnav/editable-parameters.md)
