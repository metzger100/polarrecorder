# Architecture

**Status:** Current.

## Overview

Polar Recorder is a Python-first AvNav plugin. `plugin.py` is the thin AvNav boundary, while product behavior lives in the stdlib-only `server/polarrecorder/` package.

## Key Details

- `plugin.py` owns AvNav lifecycle integration and is the only runtime file that may touch AvNav APIs.
- `server/polarrecorder/` contains pure domain modules with injected dependencies and no AvNav imports.
- Runtime browser files are static files served by AvNav without a build step.
- Threading and locks belong at the integration boundary; domain modules remain lock-unaware.
- Release packaging ships only runtime files and keeps development docs, tests, and tooling out of the AvNav artifact.

Repository layout (development-only roots, none shipped in a release artifact):

- `types/`: ambient JSDoc/TypeScript declarations (`polarrecorder-globals.d.ts`) used only for strict no-emit `checkJs` typing of viewer/plugin JS; never imported at runtime.
- `tests/js/`: every executable JavaScript test and reusable checker self-test (`node:test`/`node:assert/strict`), covering viewer behavior, plugin entrypoints, and the custom `tools/check-*.mjs` quality checkers.
- `tools/quality-policy/`: the JavaScript quality-tooling policy engine — immutable baseline captures, complexity/coverage/test-inventory checkers, the format-scope and command-graph contracts, and their shared canonical-JSON helper. Python quality tooling (`tools/check-*.py`) lives directly under `tools/` and is a separate, parallel authority; the two do not share code, only the `npm run check:*`/`check:core` command graph that invokes both.

## Related

- [Core principles](documentation/core-principles.md)
- [Coding standards](documentation/conventions/coding-standards.md)
- [Testing infrastructure](documentation/conventions/testing-infrastructure.md)
