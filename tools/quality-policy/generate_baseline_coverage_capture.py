"""Generate `baseline-coverage-capture.json`, the immutable pre-migration coverage capture.

Usage:
    python tools/quality-policy/generate_baseline_coverage_capture.py --write
    python tools/quality-policy/generate_baseline_coverage_capture.py --stdout

Unlike the Git-blob-derived captures, coverage numbers require actually running the test
suite. When this capture was first taken, `git diff --stat` proved `server/polarrecorder`,
`tests/`, `plugin.py`, `viewer/`, `plugin.js`, `plugin.mjs`, and `tools/` were
byte-identical between `CAPTURED_COMMIT` and the live worktree, so measuring the live tree
was equivalent to measuring `CAPTURED_COMMIT` itself. A later `viewer/viewer.js` split
broke that equivalence: **this generator must no longer be invoked directly on the live
working tree.** Regenerate it only from a disposable worktree pinned to `CAPTURED_COMMIT`
(`git worktree add --detach <dir> <CAPTURED_COMMIT>`), copying this file and
`canonical_json.py` in and running `--stdout` there, exactly as the original capture did.

Every metric is rounded to two decimal places before being written so that floating-point
noise across coverage.py/Node versions does not make byte-for-byte comparison flaky.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from canonical_json import REPO_ROOT, dumps_canonical

CAPTURED_COMMIT = "08edef88b0102af6507ef02fd4448f7fd1eaca45"
OUTPUT_PATH = Path(__file__).resolve().parent / "baseline-coverage-capture.json"

_VIEWER_LINE = re.compile(
    r"\[js-coverage] (?P<path>\S+): (?P<pct>[\d.]+)% \(floor (?P<floor>[\d.]+)%\)"
)


def _round2(value: float) -> float:
    return round(value + 1e-9, 2)


def _measure_python_package_coverage() -> dict[str, float]:
    with tempfile.TemporaryDirectory() as tmp:
        report_path = Path(tmp) / "coverage.json"
        subprocess.run(  # noqa: S603 -- fixed local pytest invocation, no untrusted input
            [
                sys.executable,
                "-m",
                "pytest",
                "tests/",
                "--cov=polarrecorder",
                "--cov-branch",
                f"--cov-report=json:{report_path}",
                "--quiet",
            ],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        report = json.loads(report_path.read_text(encoding="utf-8"))
    totals = report["totals"]
    return {
        "combinedLineAndBranchPercent": _round2(totals["percent_covered"]),
        "numStatements": totals["num_statements"],
        "missingLines": totals["missing_lines"],
        "numBranches": totals["num_branches"],
        "missingBranches": totals["missing_branches"],
    }


def _measure_plugin_py_coverage() -> dict[str, float]:
    with tempfile.TemporaryDirectory() as tmp:
        report_path = Path(tmp) / "coverage.json"
        subprocess.run(  # noqa: S603 -- fixed local pytest invocation, no untrusted input
            [
                sys.executable,
                "-m",
                "pytest",
                "tests/",
                "--cov=plugin",
                "--cov-branch",
                f"--cov-report=json:{report_path}",
                "--quiet",
            ],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        report = json.loads(report_path.read_text(encoding="utf-8"))
    file_report = report["files"]["plugin.py"]["summary"]
    covered = file_report["covered_lines"] + file_report["covered_branches"]
    total = file_report["num_statements"] + file_report["num_branches"]
    return {
        "combinedLineAndBranchPercent": _round2(100.0 * covered / total),
        "numStatements": file_report["num_statements"],
        "missingLines": file_report["missing_lines"],
        "numBranches": file_report["num_branches"],
        "missingBranches": file_report["missing_branches"],
    }


def _measure_viewer_coverage() -> dict[str, float]:
    result = subprocess.run(
        [  # noqa: S607 -- npm is expected on PATH
            "npm",
            "run",
            "--silent",
            "check:js-coverage",
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    per_file: dict[str, float] = {}
    for line in result.stdout.splitlines():
        match = _VIEWER_LINE.match(line)
        if match:
            per_file[match.group("path")] = _round2(float(match.group("pct")))
    return dict(sorted(per_file.items()))


def build_capture() -> dict[str, object]:
    """Measure and assemble the canonical baseline-coverage-capture.

    Returns:
        The full capture as a JSON-serializable dict, ready for canonical dumping.
    """
    return {
        "capturedCommit": CAPTURED_COMMIT,
        "pythonPackageCoverage": _measure_python_package_coverage(),
        "pluginPyCoverage": _measure_plugin_py_coverage(),
        "viewerLineCoveragePercentByFile": _measure_viewer_coverage(),
        "preMigrationConfiguredFloors": {
            "pythonAggregateCombinedPercent": 90.0,
            "validationPackageLinePercent": 95.0,
            "validationPackageBranchPercent": 95.0,
            "histogramCoreLinePercent": 95.0,
            "histogramCoreBranchPercent": 90.0,
            "viewerViewerJsLinePercent": 45.0,
            "viewerExportUiJsLinePercent": 60.0,
            "viewerSettingsUiJsLinePercent": 60.0,
            "viewerGridEditorJsLinePercent": 75.0,
            "viewerTimelineChartJsLinePercent": 75.0,
            "viewerImportUploadJsLinePercent": 80.0,
            "viewerAdvancedSettingsJsLinePercent": 80.0,
            "viewerPolarChartJsLinePercent": 85.0,
            "viewerPresetsJsLinePercent": 90.0,
            "viewerThemeJsLinePercent": 95.0,
            "viewerDomJsLinePercent": 80.0,
            "viewerEnhancedSettingsJsLinePercent": 80.0,
            "viewerPlaceholdersJsLinePercent": 100.0,
        },
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
    group.add_argument("--write", action="store_true", help="write baseline-coverage-capture.json")
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
