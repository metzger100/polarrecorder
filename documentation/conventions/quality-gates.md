# Quality Gates

**Status:** Current.

## Overview

The quality gate is the executable contract for Polar Recorder development. Run the full gate before handoff for normal development work, and use targeted gates only while iterating.

## Key Details

Full gate:

```bash
tools/check-all.sh
```

The full gate runs from the repository root, prepends `venv/bin` or `POLARRECORDER_VENV/bin` to `PATH` when present, and fails on the first failing command.

Python gate commands:

| Command | Purpose |
|---|---|
| `python -m ruff check .` | Python linting, import rules, docstrings, print bans, complexity, security, and configured Ruff families |
| `python -m ruff format --check .` | Python formatting stability |
| `python -m mypy server/polarrecorder tests plugin.py --strict` | Strict Python typing |
| `python tools/check-python-compat.py` | Python 3.9 runtime compatibility |
| `python -m pytest tests/ --tb=short` | Python unit, integration, and smoke tests |
| `python -m pytest tests/ --cov=polarrecorder --cov-branch --cov-report=term-missing --cov-report=json:/tmp/polarrecorder-coverage.json --cov-fail-under=90` | Overall branch-enabled coverage floor |
| `python tools/check-coverage.py /tmp/polarrecorder-coverage.json` | Per-area validation and histogram coverage floors |
| `python tools/check-python-filesize.py` | Python 400-line limit, mandatory headers, and one-line compression checks |
| `python tools/check-py-contracts.py` | Python contract-trust smells, sentinels, canonical helper ownership, and legacy-shim checks |
| `python tools/check-py-dependencies.py` | Domain dependency headers, import cycles, and layer direction |
| `python tools/check-duplication.py` | Python duplicate helper/function/block detection |
| `python tools/check-performance.py` | Deterministic hot-path performance backstops |
| `python tools/check-runtime-contracts.py` | Runtime finite-number export/API contract checks |
| `python tools/check-release.py --dry-run` | Release manifest and artifact sanity checks |

JavaScript, documentation, and viewer gate commands:

| Command | Purpose |
|---|---|
| `npm run test:tools` | Custom JS checker self-tests |
| `npm run check:smells` | JS/Python pattern checks plus viewer contract metadata checks |
| `npm run check:docs` | Documentation TOC, format, reachability, smell-catalog completeness, and AI instruction sync |
| `npm run check:filesize` | Viewer, `plugin.mjs`, Markdown file-size and JS one-line compression checks |
| `npm run check:headers` | Viewer module headers and documentation targets |
| `npm run check:namespace` | `window.Polarrecorder` namespace discipline |
| `npm run check:naming` | Viewer filename, namespace member, and function naming |
| `npm run test:plugin` | `plugin.mjs` entry-contract smoke test |
| `npm run test:viewer` | Theme, polar chart, and viewer smoke tests |
| `npm run check:viewer-contracts` | Rendered sentinel, absent-placeholder, and zero-preservation contracts |
| `npm run check:js-coverage` | Per-viewer-file V8 line coverage floors |
| `npm run check:js-duplication` | Viewer duplicate helper/block detection |
| `npm run check:deps` | Viewer namespace dependency cycles and module-load dependency checks |

Convenience aliases:

| Alias | Expands To |
|---|---|
| `npm run check:all` | `tools/check-all.sh` |
| `npm run check:js:all` | The complete JavaScript, viewer, and documentation subgate |
| `npm run check:core` | Alias for the JavaScript, viewer, and documentation subgate |

Optional maintainer gates:

| Command | Purpose |
|---|---|
| `npm run hooks:install` | Install the pre-push hook path |
| `npm run hooks:doctor` | Verify hook installation |
| `npm run release:prepare` | Collect release context for version and notes decisions |
| `npm run release:create -- --version=X.Y.Z` | Run the full gate, build release artifacts, commit them, and tag the release |

Rule ownership:

- [Smell prevention](smell-prevention.md) lists every blocking rule enforced by these commands.
- [Coding standards](coding-standards.md) explains the implementation conventions behind the rules.
- [Testing infrastructure](testing-infrastructure.md) explains the fake AvNav, coverage, and viewer-test setup.
- [Release workflow](../guides/release-workflow.md) explains release artifact creation and publishing.

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Coding standards](coding-standards.md)
- [Smell prevention](smell-prevention.md)
- [Testing infrastructure](testing-infrastructure.md)
- [Release workflow](../guides/release-workflow.md)
