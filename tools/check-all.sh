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
python tools/check-python-compat.py
python -m pytest tests/ --tb=short
python -m pytest tests/ --cov=polarrecorder --cov-branch --cov-report=term-missing --cov-report=json:/tmp/polarrecorder-coverage.json --cov-fail-under=90
python tools/check-coverage.py /tmp/polarrecorder-coverage.json
python tools/check-python-filesize.py
python tools/check-py-contracts.py
python tools/check-py-dependencies.py
python tools/check-duplication.py
python tools/check-performance.py
python tools/check-runtime-contracts.py
python tools/check-release.py --dry-run  # exits 0 if no zip in releases/; validates if present

# JS checks (dyninstruments-derived)
npm run check:js:all

echo "All checks passed."
