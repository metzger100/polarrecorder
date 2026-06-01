# Architecture

**Status:** Current for version 1.0.0.

## Overview

Polar Recorder is a Python-first AvNav plugin. `plugin.py` is the thin AvNav boundary, while product behavior lives in the stdlib-only `server/polarrecorder/` package.

## Key Details

- `plugin.py` owns AvNav lifecycle integration and is the only runtime file that may touch AvNav APIs.
- `server/polarrecorder/` contains pure domain modules with injected dependencies and no AvNav imports.
- Runtime browser files are static files served by AvNav without a build step.
- Threading and locks belong at the integration boundary; domain modules remain lock-unaware.
- Release packaging ships only runtime files and keeps development docs, tests, and tooling out of the AvNav artifact.

## Related

- [Core principles](documentation/core-principles.md)
- [Coding standards](documentation/conventions/coding-standards.md)
- [Testing infrastructure](documentation/conventions/testing-infrastructure.md)
