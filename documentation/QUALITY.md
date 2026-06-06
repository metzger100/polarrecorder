# Quality

**Status:** Current.

## Overview

Polar Recorder quality is enforced by the full project gate, coverage review, smell-prevention checks, release validation, documentation reachability, and manual AvNav verification. The automated gate is required before commits and handoff.

## Key Details

The binding automated gate is `tools/check-all.sh`. It runs:

- `python -m ruff check .`
- `python -m ruff format --check .`
- `python -m mypy server/polarrecorder tests plugin.py --strict`
- `python tools/check-python-compat.py`
- `python -m pytest tests/ --tb=short`
- `python -m pytest tests/ --cov=polarrecorder --cov-branch --cov-report=term-missing --cov-report=json:/tmp/polarrecorder-coverage.json --cov-fail-under=90`
- `python tools/check-coverage.py /tmp/polarrecorder-coverage.json`
- `python tools/check-python-filesize.py`
- `python tools/check-py-contracts.py`
- `python tools/check-py-dependencies.py`
- `python tools/check-duplication.py`
- `python tools/check-performance.py`
- `python tools/check-runtime-contracts.py`
- `python tools/check-release.py --dry-run`
- `npm run check:js:all`

`npm run check:all` is an alias for the full project gate, so agents and hooks
cannot accidentally run only the JavaScript/documentation subgate and miss
Python failures.

Coverage requirements are:

- `server/polarrecorder/` overall: at least 90%.
- `server/polarrecorder/validation/`: at least 95% line coverage and 95% branch coverage, enforced by `tools/check-coverage.py`.
- `server/polarrecorder/histogram.py`: at least 95% line coverage and 90% branch coverage, enforced by `tools/check-coverage.py`.
- Every `viewer/*.js` file has an explicit per-file line-coverage floor (`tools/check-js-coverage.mjs`); new viewer files fail until covered and listed.

Smell prevention is enforced by the Python gate, semantic contract checks, JavaScript check scripts, and review. Blocking smells include AvNav imports outside the plugin boundary, reverse dependencies from domain code to `plugin.py`, lock acquisition in domain modules, hidden real-time dependencies, magic validation thresholds outside named configuration, defensive fallbacks that mask a contract gap, absent-value sentinels, duplicate helpers or long copied blocks, unjustified lint suppressions, unowned TODOs, unsafe browser patterns, stale viewer dependency headers, missing viewer coverage targets, and dead commented-out code. The domain-contract smells are mechanically enforced by `tools/check-py-contracts.py` (fallbacks, sentinels, and canonical-helper redefinition) and `tools/check-duplication.py` (cross-file clones and long copied statement blocks); magic thresholds in comparisons are caught by ruff `PLR2004`. `tools/check-py-dependencies.py` enforces that each domain module's `Depends:` header equals its real intra-package imports (runtime and `TYPE_CHECKING`), that the runtime import graph stays acyclic, that imports flow downward through the primitives/core/domain/orchestration layers (`layer-direction`), and that the layer map stays equal to the real package (`layer-map-stale`).

JavaScript and documentation checks run through `npm run check:js:all`. These checks cover browser script patterns, semantic smell contracts, executable viewer behavioral contracts (`tools/check-viewer-contracts.mjs`), the `plugin.mjs` entry contract, namespace use, viewer and Markdown file sizes, headers, naming, dependency shape, suppression discipline, TODO ownership, every viewer file's line coverage, documentation table-of-contents sync, documentation format, internal link reachability, and AI-instruction sync. `npm run test:tools` exercises every custom JS checker through its `run*` entry point (`tools/test-check-patterns.mjs` and `tools/test-js-checkers.mjs`), so a custom JS rule cannot ship untested. The browser-pattern checks also block truthy-default clobbering of falsy values, empty Promise catches, silent non-empty catch fallbacks without `polarrecorder-boundary-fallback(...)`, re-defaulting of internal `Polarrecorder` namespace results, hardcoded config default duplication, duplicated placeholder literals, inline user-visible responsive floors, canvas API type guards, try/finally canvas drawing wrappers, redundant re-sanitizing of producer-guaranteed values, internal `Polarrecorder` method type guards, dead code, unused `fallback` bindings, speculative legacy/compat declarations, and cross-file duplicate function/block clones in `viewer/*.js`.

Severity model and rule rollout:

- Every rule wired into the gate is **blocking**. Polar Recorder intentionally does not ship a permanent non-blocking "warn" tier; a rule that is in the gate must pass, and a green gate therefore reflects real, current behavior.
- When a new rule is introduced against a tree that is not yet clean, do the cleanup in the same change. If that is genuinely impossible, record the temporary state and the owner in [TECH-DEBT.md](TECH-DEBT.md) and promote the rule to blocking as soon as the tree is clean — never leave it as a silent warning. This gives the staged-rollout discipline without weakening the steady-state gate.

Performance regression coverage:

- `tools/check-performance.py` runs deterministic hot-path smoke checks for model updates and polar response formatting with generous ceilings. It is intended to catch accidental algorithmic regressions, not micro-benchmark small changes.

Documentation quality requirements:

- Every `documentation/*.md` file is listed in [the documentation index](TABLEOFCONTENTS.md).
- Documentation files and root project Markdown files stay under the 400 non-empty-line hard limit.
- AvNav-focused docs describe portable behavior contracts and do not depend on machine-specific paths.
- `AGENTS.md` and `CLAUDE.md` keep the shared instruction block byte-identical.

Manual test checklist:

- [ ] Install plugin by copying directory to AvNav plugins.
- [ ] AvNav loads plugin without errors.
- [ ] Plugin status shows RUNNING on AvNav status page.
- [ ] Viewer app accessible from AvNav user apps.
- [ ] With wind instruments active, samples are accepted and bins populate.
- [ ] With instruments off, no samples are accepted (missing values).
- [ ] Pause/resume works from viewer.
- [ ] Export produces valid CSV.
- [ ] User preset can be saved, selected for export, and deleted from viewer.
- [ ] Reset clears polar, counters, and per-bin rejection histograms, and the cleared state persists across an AvNav restart (reset is flushed by the plugin thread within one sample interval).
- [ ] Plugin survives AvNav restart (data persisted and reloaded).
- [ ] Corrupt `polar.json` is recovered from backup.
- [ ] Plugin does not crash AvNav under any condition tested.

## Related

- [Coding standards](conventions/coding-standards.md)
- [Smell prevention](conventions/smell-prevention.md)
- [Testing infrastructure](conventions/testing-infrastructure.md)
