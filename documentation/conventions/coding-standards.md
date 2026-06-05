# Coding Standards

**Status:** Current.

## Overview

These standards keep Polar Recorder small, inspectable, and safe to run inside AvNav.

## Key Details

Python standards:

- Runtime code uses only Python 3.9+ standard library.
- Every Python file in `plugin.py`, `server/polarrecorder/`, and `tests/` includes `from __future__ import annotations`.
- Every function is fully typed; `mypy --strict` is required.
- Public functions have Google-style docstrings.
- Ruff formatting and linting are required.
- No `print()` calls in runtime or tests.
- `server/polarrecorder/` does not import AvNav modules or `plugin.py`.
- `plugin.py` is the only AvNav boundary and stays thin.
- `plugin.py` owns the single lock and snapshots live state for API, export, and persistence handoff.
- Domain modules receive clocks, raw data, configs, snapshots, protocols, or fakes; they do not reach outward to runtime services.
- `plugin.py`, `server/polarrecorder/`, and `tests/` have a 400 non-empty-line hard limit.
- `server/polarrecorder/**/*.py`, except `__init__.py`, must begin with:

```python
"""Module: <Name> - <One-line description>.

Documentation: documentation/<path>.md
Depends: <list of polarrecorder/ module dependencies>
"""
```

JavaScript standards:

- `viewer/*.js` files are plain scripts loaded by `viewer/viewer.html`.
- `plugin.mjs` is the only planned ES module exception.
- Use `window.Polarrecorder` for all exported browser functionality.
- Use kebab-case filenames, PascalCase exported namespace members, and camelCase functions.
- No `console.log`, `var`, loose equality, `eval()`, `innerHTML` assignment, or commented-out code blocks.
- Viewer JS files have mandatory `/** Module: ... */` headers and a 400-line hard limit.

Documentation standards:

- Every `documentation/*.md` file has a title, `Status`, `Overview`, `Key Details`, and `Related`.
- New docs must be linked from [the documentation index](../TABLEOFCONTENTS.md).
- AvNav behavior docs must be self-contained contracts, not references to machine-specific paths.
- Keep `AGENTS.md` and `CLAUDE.md` shared instruction blocks byte-identical.

## Repo Rules Override Exec-Plans

Repo rules and core principles always outrank execution-plan instructions. A plan is the implementation source of truth for *what to build*, but it cannot waive a mechanically enforced repo rule.

- The 400 non-empty-line limit is always in effect. If an exec-plan phase would cause a file to exceed it, refactor and split the file as part of that same phase. The plan does not need to mention splitting; do not defer to a later "cleanup" phase, and do not use one-liner compression to fit more logic into fewer lines.
- The quality gate (`tools/check-all.sh`), coverage thresholds, and blocking smells bind every phase regardless of what the plan says.
- If a plan conflicts with a repo rule, surface the defect and amend the plan rather than silently improvising around it.

## Test and Gate Integrity

- Never weaken or delete a test, lower a coverage threshold, skip a check, or suppress a smell to obtain a green gate. Fix the root cause instead.
- Keep `tests/mock-data/` fixtures consistent with the behavior they assert; a green gate must reflect real, current behavior.

## Related

- [Core principles](../core-principles.md)
- [Smell prevention](smell-prevention.md)
- [Testing infrastructure](testing-infrastructure.md)
- [AvNav plugin lifecycle](../avnav/plugin-lifecycle.md)
