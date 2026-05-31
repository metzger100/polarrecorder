# Testing Infrastructure

**Status:** Complete for Phase 1 bootstrap.

## Overview

Tests are deterministic, stdlib-friendly, and independent of a live AvNav server.

## Key Details

- `tests/conftest.py` provides `FakeAvNavAPI`, `FakeClock`, and `FakeLogger`.
- `FakeAvNavAPI` mirrors the AvNav methods used by the plan and deliberately exposes no `fileName` attribute.
- Tests use injected clocks instead of sleeping or monkey-patching time.
- The coverage gate measures `polarrecorder/` only and requires at least 90 percent line coverage.
- The Phase 1 smoke test imports `polarrecorder` and instantiates the `plugin.py` stub so pytest never exits with zero collected tests.

## Related

- [Coding standards](coding-standards.md)
- [Core principles](../core-principles.md)
