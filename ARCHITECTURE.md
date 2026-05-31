# Architecture

**Status:** Complete for Phase 1 bootstrap.

## Overview

Polar Recorder is a Python-first AvNav plugin. `plugin.py` is the thin AvNav boundary, while future product behavior lives in the stdlib-only `polarrecorder/` package.

## Key Details

- `plugin.py` owns AvNav lifecycle integration and is the only runtime file that may touch AvNav APIs.
- `polarrecorder/` contains pure domain modules with injected dependencies and no AvNav imports.
- Runtime browser files are static files served by AvNav without a build step.
- Threading and locks belong at the integration boundary; domain modules remain lock-unaware.
- The repository is phase-driven through `exec-plans/active/PLAN1.md`.

## Related

- [Core principles](documentation/core-principles.md)
- [Coding standards](documentation/conventions/coding-standards.md)
- [Testing infrastructure](documentation/conventions/testing-infrastructure.md)
