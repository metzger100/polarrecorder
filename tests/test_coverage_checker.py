from __future__ import annotations

import importlib.util
import io
import json
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Protocol, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "tools" / "check-coverage.py"


class CheckerModule(Protocol):
    def main(self) -> int:
        """Run the checker."""


def test_coverage_checker_accepts_required_floors(tmp_path: Path) -> None:
    report = tmp_path / "coverage.json"
    write_report(
        report,
        {
            "server/polarrecorder/validation/core.py": coverage(
                covered=95,
                missing=5,
                branches_covered=95,
                branches_missing=5,
            ),
            "server/polarrecorder/histogram.py": coverage(
                covered=19,
                missing=1,
                branches_covered=9,
                branches_missing=1,
            ),
        },
    )

    result, output = run_checker(report)

    assert result == 0
    assert "Coverage rule check passed" in output


def test_coverage_checker_blocks_low_validation_floor(tmp_path: Path) -> None:
    report = tmp_path / "coverage.json"
    write_report(
        report,
        {
            "server/polarrecorder/validation/core.py": coverage(
                covered=94,
                missing=6,
                branches_covered=100,
                branches_missing=0,
            ),
            "server/polarrecorder/histogram.py": coverage(
                covered=20,
                missing=0,
                branches_covered=10,
                branches_missing=0,
            ),
        },
    )

    result, output = run_checker(report)

    assert result == 1
    assert "validation package" in output
    assert "94.00%" in output


def test_coverage_checker_blocks_missing_rule_target(tmp_path: Path) -> None:
    report = tmp_path / "coverage.json"
    write_report(
        report,
        {
            "server/polarrecorder/histogram.py": coverage(
                covered=20,
                missing=0,
                branches_covered=10,
                branches_missing=0,
            )
        },
    )

    result, output = run_checker(report)

    assert result == 1
    assert "validation package: no files matched" in output


def test_coverage_checker_blocks_low_branch_floor(tmp_path: Path) -> None:
    report = tmp_path / "coverage.json"
    write_report(
        report,
        {
            "server/polarrecorder/validation/core.py": coverage(
                covered=100,
                missing=0,
                branches_covered=94,
                branches_missing=6,
            ),
            "server/polarrecorder/histogram.py": coverage(
                covered=20,
                missing=0,
                branches_covered=10,
                branches_missing=0,
            ),
        },
    )

    result, output = run_checker(report)

    assert result == 1
    assert "validation package" in output
    assert "branches 94.00%" in output


def coverage(
    *,
    covered: int,
    missing: int,
    branches_covered: int,
    branches_missing: int,
) -> dict[str, list[int] | list[tuple[int, int]]]:
    """Build coverage.py line and branch lists with deterministic counts."""
    return {
        "executed_lines": list(range(1, covered + 1)),
        "missing_lines": list(range(covered + 1, covered + missing + 1)),
        "executed_branches": branches(branches_covered),
        "missing_branches": branches(branches_missing),
    }


def branches(count: int) -> list[tuple[int, int]]:
    """Build deterministic branch arcs."""
    return [(index, index + 1) for index in range(1, count + 1)]


def write_report(path: Path, files: dict[str, dict[str, Any]]) -> None:
    """Write a minimal coverage.py JSON report."""
    payload: dict[str, Any] = {"files": files}
    path.write_text(json.dumps(payload), encoding="utf-8")


def run_checker(report: Path) -> tuple[int, str]:
    checker = load_checker()
    old_argv = sys.argv
    out, err = io.StringIO(), io.StringIO()
    try:
        sys.argv = ["check-coverage.py", str(report)]
        with redirect_stdout(out), redirect_stderr(err):
            result = checker.main()
    finally:
        sys.argv = old_argv
    return result, out.getvalue() + err.getvalue()


def load_checker() -> CheckerModule:
    module_name = "polarrecorder_check_coverage_test"
    spec = importlib.util.spec_from_file_location(module_name, CHECKER_PATH)
    if spec is None or spec.loader is None:
        msg = "could not load check-coverage.py"
        raise AssertionError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return cast("CheckerModule", module)
