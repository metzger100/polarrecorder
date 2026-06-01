# Testing Infrastructure

**Status:** Current for version 1.0.0.

## Overview

Tests are deterministic, stdlib-friendly, and independent of a live AvNav server.

## Key Details

- `tests/conftest.py` provides `FakeAvNavAPI`, `FakeClock`, and `FakeLogger`.
- `FakeAvNavAPI` mirrors the AvNav methods used by Polar Recorder and deliberately exposes no `fileName` attribute.
- Tests use injected clocks instead of sleeping or monkey-patching time.
- The coverage gate measures `polarrecorder/` only and requires at least 90 percent line coverage.
- The smoke test imports `polarrecorder` and instantiates `plugin.py` so pytest never exits with zero collected tests.

## Related

- [Coding standards](coding-standards.md)
- [Core principles](../core-principles.md)
