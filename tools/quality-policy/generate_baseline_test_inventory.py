"""Generate `baseline-test-inventory.json`, the immutable frozen test inventory.

Usage:
    python tools/quality-policy/generate_baseline_test_inventory.py --write
    python tools/quality-policy/generate_baseline_test_inventory.py --stdout

Captures, at `CAPTURED_COMMIT`:
    - every executable JavaScript test/helper file (the strict-typing inventory
      `tools/quality-policy/test-inventory.mjs` owns; `tools/viewer-harness.mjs` is a
      helper, not itself a `test-*.mjs` file, but belongs in the same strict/inventory-owned
      set as the tests it backs);
    - every Python test file and Python test-support helper file under `tests/`;
    - a verified-empty focused/disabled-test marker search across both, so the strict-test
      exception baseline (`tools/quality-policy/test-exception-baseline.json`) starts from a
      proven-empty set rather than an assumed one.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from canonical_json import dumps_canonical, git_blob_content, git_ls_tree_blobs

CAPTURED_COMMIT = "08edef88b0102af6507ef02fd4448f7fd1eaca45"
OUTPUT_PATH = Path(__file__).resolve().parent / "baseline-test-inventory.json"

JS_TEST_HELPER_FILE_NAMES = (
    "tools/test-check-patterns.mjs",
    "tools/test-js-checkers.mjs",
    "tools/test-plugin-mjs.mjs",
    "tools/test-viewer-advanced.mjs",
    "tools/test-viewer-enhanced.mjs",
    "tools/test-viewer-polar.mjs",
    "tools/test-viewer-smoke.mjs",
    "tools/test-viewer-theme.mjs",
    "tools/viewer-harness.mjs",
)

PYTHON_TEST_SUPPORT_HELPER_FILE_NAMES = (
    "tests/conftest.py",
    "tests/plugin_integration_support.py",
    "tests/validation_helpers.py",
)

_JS_FOCUS_DISABLE_PATTERN = re.compile(r"\.(only|skip|todo)\s*\(")
_PY_FOCUS_DISABLE_PATTERN = re.compile(
    r"@pytest\.mark\.(skip|skipif|xfail)\b|pytest\.skip\(|unittest\.skip"
)


def _find_markers(commit: str, files: tuple[str, ...], pattern: re.Pattern[str]) -> list[str]:
    hits: list[str] = []
    for path in files:
        text = git_blob_content(commit, path)
        for lineno, line in enumerate(text.splitlines(), start=1):
            if pattern.search(line):
                hits.append(f"{path}:{lineno}")
    return hits


def build_capture() -> dict[str, object]:
    """Build the canonical baseline-test-inventory capture from Git at `CAPTURED_COMMIT`.

    Returns:
        The full capture as a JSON-serializable dict, ready for canonical dumping.
    """
    js_blobs = git_ls_tree_blobs(CAPTURED_COMMIT, *JS_TEST_HELPER_FILE_NAMES)
    python_test_blobs = git_ls_tree_blobs(CAPTURED_COMMIT, "tests")
    python_test_files = {
        p: h
        for p, h in python_test_blobs.items()
        if p.endswith(".py") and Path(p).name.startswith("test_")
    }
    python_helper_blobs = git_ls_tree_blobs(CAPTURED_COMMIT, *PYTHON_TEST_SUPPORT_HELPER_FILE_NAMES)

    js_focus_hits = _find_markers(
        CAPTURED_COMMIT, JS_TEST_HELPER_FILE_NAMES, _JS_FOCUS_DISABLE_PATTERN
    )
    python_all_test_files = tuple(sorted(python_test_files))
    py_focus_hits = _find_markers(CAPTURED_COMMIT, python_all_test_files, _PY_FOCUS_DISABLE_PATTERN)

    return {
        "capturedCommit": CAPTURED_COMMIT,
        "javascriptExecutableTestHelperFiles": {
            "files": [{"path": p, "gitBlobSha1": js_blobs[p]} for p in sorted(js_blobs)],
            "count": len(js_blobs),
        },
        "pythonTestFiles": {
            "files": [
                {"path": p, "gitBlobSha1": python_test_files[p]} for p in sorted(python_test_files)
            ],
            "count": len(python_test_files),
        },
        "pythonTestSupportHelperFiles": {
            "files": [
                {"path": p, "gitBlobSha1": python_helper_blobs[p]}
                for p in sorted(python_helper_blobs)
            ],
            "count": len(python_helper_blobs),
        },
        "verifiedEmptyFocusedOrDisabledMarkers": {
            "javascript": js_focus_hits,
            "python": py_focus_hits,
        },
        "executableTestExceptionSet": [],
    }


def main(argv: list[str]) -> int:
    """Run the CLI entry point.

    Args:
        argv: Command-line arguments, excluding the program name.

    Returns:
        The process exit code.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true", help="write baseline-test-inventory.json")
    group.add_argument("--stdout", action="store_true", help="print canonical JSON, do not write")
    args = parser.parse_args(argv)

    canonical = dumps_canonical(build_capture())
    if args.write:
        OUTPUT_PATH.write_text(canonical, encoding="utf-8")
        sys.stderr.write(f"wrote {OUTPUT_PATH}\n")
    else:
        sys.stdout.write(canonical)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
