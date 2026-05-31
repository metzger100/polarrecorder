# Coding Standards

**Status:** Complete for Phase 1 bootstrap.

## Overview

These standards keep Polar Recorder small, inspectable, and safe to run inside AvNav.

## Key Details

Python standards:

- Runtime code uses only Python 3.9+ standard library.
- Every Python file in `plugin.py`, `polarrecorder/`, and `tests/` includes `from __future__ import annotations`.
- Every function is fully typed; `mypy --strict` is required.
- Public functions have Google-style docstrings.
- Ruff formatting and linting are required.
- No `print()` calls in runtime or tests.
- `polarrecorder/` does not import AvNav modules or `plugin.py`.
- `plugin.py` is the only AvNav boundary and stays thin.
- `plugin.py`, `polarrecorder/`, and `tests/` have a 400 non-empty-line hard limit.
- `polarrecorder/**/*.py`, except `__init__.py`, must begin with:

```python
"""Module: <Name> - <One-line description>.

Documentation: documentation/<path>.md
Depends: <list of polarrecorder/ module dependencies>
"""
```

JavaScript standards:

- Root `*.js` files are plain scripts loaded by AvNav.
- `plugin.mjs` is the only planned ES module exception.
- Use `window.Polarrecorder` for all exported browser functionality.
- Use kebab-case filenames, PascalCase exported namespace members, and camelCase functions.
- No `console.log`, `var`, loose equality, `eval()`, `innerHTML` assignment, or commented-out code blocks.
- Root JS files have mandatory `/** Module: ... */` headers and a 400-line hard limit.

## Related

- [Core principles](../core-principles.md)
- [Smell prevention](smell-prevention.md)
- [Testing infrastructure](testing-infrastructure.md)
