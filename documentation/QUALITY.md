# Quality

**Status:** Current.

## Overview

Polar Recorder quality is enforced by the full project gate, coverage review, smell-prevention checks, release validation, and manual AvNav verification. The automated gate is required before commits and was rerun after final reference-source cleanup.

## Key Details

The binding automated gate is `tools/check-all.sh`. It runs:

- `python -m ruff check .`
- `python -m ruff format --check .`
- `python -m mypy server/polarrecorder tests plugin.py --strict`
- `python -m pytest tests/ --tb=short`
- `python -m pytest tests/ --cov=polarrecorder --cov-report=term-missing --cov-fail-under=90`
- `python tools/check-python-filesize.py`
- `python tools/check-release.py --dry-run`
- `npm run check:all`

Coverage requirements are:

- `server/polarrecorder/` overall: at least 90%.
- `server/polarrecorder/validation/`: at least 95%.
- `server/polarrecorder/histogram.py`: at least 95%.

Smell prevention is enforced by the Python gate, the JavaScript check scripts, and review. Blocking smells include AvNav imports outside the plugin boundary, reverse dependencies from domain code to `plugin.py`, lock acquisition in domain modules, hidden real-time dependencies, magic validation thresholds outside named configuration, unsafe browser patterns, and dead commented-out code.

JavaScript and documentation checks run through `npm run check:all`. These checks cover browser script patterns, namespace use, file sizes, headers, naming, dependency shape, documentation table-of-contents sync, documentation format, internal link reachability, and AI-instruction sync.

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
