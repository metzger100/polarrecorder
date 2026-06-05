#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VENV_DIR="${POLARRECORDER_VENV:-$REPO_ROOT/venv}"
if [ -d "$VENV_DIR/bin" ]; then
  export PATH="$VENV_DIR/bin:$PATH"
fi

cd "$REPO_ROOT"

# Python checks
python -m ruff check .
python -m ruff format --check .
python -m mypy server/polarrecorder tests plugin.py --strict
python -m pytest tests/ --tb=short
python -m pytest tests/ --cov=polarrecorder --cov-report=term-missing --cov-fail-under=90
python tools/check-python-filesize.py
python tools/check-release.py --dry-run  # exits 0 if no zip in releases/; validates if present

# JS checks (dyninstruments-derived)
npm run check:all

echo "All checks passed."
