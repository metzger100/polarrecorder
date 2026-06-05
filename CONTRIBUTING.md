# Contributing

**Status:** Current.

## Overview

Contributions follow the documentation preflight and the deterministic quality gate. The project values small scoped changes that keep code, tests, and documentation synchronized.

## Local development setup

The runtime stays stdlib-only, but the quality gate needs dev-only tooling. Install it once into a project-local virtual environment:

```sh
python3 -m venv venv
venv/bin/pip install ruff mypy pytest pytest-cov coverage
```

The git pre-push hook and `tools/check-all.sh` automatically prepend `venv/bin` to `PATH`, so no manual activation is needed. To use a virtual environment elsewhere, point both at it with the `POLARRECORDER_VENV` environment variable:

```sh
export POLARRECORDER_VENV=/path/to/venv
```

Install the pre-push hook (sets `core.hooksPath` to `.githooks`) with:

```sh
npm run hooks:install
```

The Node.js checks run directly via `node` and need no `npm install`.

## Key Details

- Read `documentation/TABLEOFCONTENTS.md`, `documentation/conventions/coding-standards.md`, and `documentation/conventions/smell-prevention.md` before changing code or docs.
- For complex multi-session work, write a fresh execution plan using `documentation/guides/exec-plan-authoring.md`.
- Run `tools/check-all.sh` before handing off changes.
- Do not add runtime dependencies, generated build artifacts, unrelated product logic, or raw reference-source copies.

## Related

- [Agent instructions](AGENTS.md)
- [Coding standards](documentation/conventions/coding-standards.md)
- [Smell prevention](documentation/conventions/smell-prevention.md)
- [Documentation maintenance](documentation/guides/documentation-maintenance.md)
