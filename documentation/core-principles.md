# Core Principles

**Status:** Current.

## Overview

These rules have the highest documentation precedence in the project. When another document conflicts with this file, this file wins.

## Key Details

1. **Stdlib-only runtime.** No pip dependencies in `plugin.py` or `server/polarrecorder/`. Users install by dropping a directory; no target-device `pip install`.
2. **AvNav boundary isolation.** `server/polarrecorder/` never imports AvNav modules. Only `plugin.py` touches the AvNav API. The API is injected via protocols and fakes.
3. **No build step.** Runtime viewer files are served as-is by AvNav. `viewer/*.js` files are plain scripts under `window.Polarrecorder`.
4. **Histogram, not average.** The polar model uses per-bin speed histograms with configurable percentile extraction, never a naive mean.
5. **Honest uncertainty.** Empty bins are empty, not interpolated. Confidence is visible per bin. Undetectable threats are documented.
6. **Never crash AvNav.** Exceptions are caught at the `plugin.py` boundary. Corrupt files fall back gracefully.
7. **Minimal disk writes.** The model is in-memory with a configurable flush interval. No per-sample disk writes.
8. **Single lock, no nesting.** Threading is `plugin.py`'s responsibility. `server/polarrecorder/` modules are lock-unaware and thread-unaware. API responses use locked snapshots, then pure formatting.
9. **Clock injection.** Time-dependent modules receive clock callables. Hidden real-clock calls in domain modules are forbidden.
10. **Quality gate before commit.** `tools/check-all.sh` must pass. No exceptions.
11. **Documentation before code.** Every module has a documentation target. Structural docs exist before implementation starts.
12. **File size limits are absolute.** A 400 non-empty-line hard limit applies to `plugin.py`, `server/polarrecorder/`, `tests/`, and `viewer/*.js`; split modules instead of compressing code.

## Related

- [Coding standards](conventions/coding-standards.md)
- [Smell prevention](conventions/smell-prevention.md)
- [AvNav plugin lifecycle](avnav/plugin-lifecycle.md)
