#!/bin/bash
set -euo pipefail
# Agent orchestration setup checks
tools/check-agent-setup.sh
# Python checks
python -m ruff check .
python -m ruff format --check .
python -m mypy polarrecorder tests plugin.py --strict
python -m pytest tests/ --tb=short
python -m pytest tests/ --cov=polarrecorder --cov-report=term-missing --cov-fail-under=90
python tools/check-python-filesize.py
python tools/check-release.py --dry-run  # exits 0 if no zip in releases/; validates if present
# JS checks (dyninstruments-derived)
npm run check:all
echo "All checks passed."
