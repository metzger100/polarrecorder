#!/usr/bin/env python3
"""Enforce per-area coverage floors from a coverage.py JSON report."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

COVERAGE_JSON = Path("/tmp/polarrecorder-coverage.json")


@dataclass(frozen=True)
class CoverageRule:
    """A named coverage threshold over one or more source path selectors."""

    name: str
    prefixes: tuple[str, ...]
    exact: tuple[str, ...]
    line_minimum_percent: float
    branch_minimum_percent: float | None


RULES = (
    CoverageRule(
        name="validation package",
        prefixes=("server/polarrecorder/validation/",),
        exact=(),
        line_minimum_percent=95.0,
        branch_minimum_percent=95.0,
    ),
    CoverageRule(
        name="histogram core",
        prefixes=(),
        exact=("server/polarrecorder/histogram.py",),
        line_minimum_percent=95.0,
        branch_minimum_percent=90.0,
    ),
)


def main() -> int:
    """Validate per-area coverage floors.

    Returns:
        Process exit code: 0 when every floor passes, 1 otherwise.
    """
    report_path = Path(sys.argv[1]) if len(sys.argv) > 1 else COVERAGE_JSON
    if not report_path.exists():
        sys.stderr.write(f"[coverage] JSON report not found: {report_path}\n")
        return 1

    payload = json.loads(report_path.read_text(encoding="utf-8"))
    files = _files(payload)
    failures: list[str] = []
    for rule in RULES:
        matched = [(path, summary) for path, summary in files.items() if _matches(path, rule)]
        if not matched:
            failures.append(f"{rule.name}: no files matched coverage rule")
            continue
        line_covered, line_total = _line_totals(matched)
        line_percent = _percent(line_covered, line_total)
        line_rounded = f"{line_percent:.2f}"
        if line_percent + 1e-9 < rule.line_minimum_percent:
            failures.append(f"{rule.name}: lines {line_rounded}% < {rule.line_minimum_percent:.0f}%")
        else:
            sys.stdout.write(
                f"[coverage] {rule.name}: lines {line_rounded}% "
                f"(floor {rule.line_minimum_percent:.0f}%)\n"
            )
        if rule.branch_minimum_percent is not None:
            branch_covered, branch_total = _branch_totals(matched)
            branch_percent = _percent(branch_covered, branch_total)
            branch_rounded = f"{branch_percent:.2f}"
            if branch_percent + 1e-9 < rule.branch_minimum_percent:
                failures.append(
                    f"{rule.name}: branches {branch_rounded}% "
                    f"< {rule.branch_minimum_percent:.0f}%"
                )
            else:
                sys.stdout.write(
                    f"[coverage] {rule.name}: branches {branch_rounded}% "
                    f"(floor {rule.branch_minimum_percent:.0f}%)\n"
                )

    if failures:
        for failure in failures:
            sys.stderr.write(f"[coverage] {failure}\n")
        return 1
    sys.stdout.write("Coverage rule check passed.\n")
    return 0


def _files(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    raw_files = payload.get("files", {})
    if not isinstance(raw_files, dict):
        return {}
    return {
        str(path).replace("\\", "/"): summary
        for path, summary in raw_files.items()
        if isinstance(summary, dict)
    }


def _matches(path: str, rule: CoverageRule) -> bool:
    return path in rule.exact or any(path.startswith(prefix) for prefix in rule.prefixes)


def _line_totals(files: list[tuple[str, dict[str, Any]]]) -> tuple[int, int]:
    covered = 0
    total = 0
    for _path, summary in files:
        executed = summary.get("executed_lines", [])
        missing = summary.get("missing_lines", [])
        if isinstance(executed, list):
            covered += len(executed)
        if isinstance(missing, list):
            total += len(executed) + len(missing)
    return covered, total


def _branch_totals(files: list[tuple[str, dict[str, Any]]]) -> tuple[int, int]:
    covered = 0
    total = 0
    for _path, summary in files:
        executed = summary.get("executed_branches", [])
        missing = summary.get("missing_branches", [])
        if isinstance(executed, list):
            covered += len(executed)
        if isinstance(missing, list):
            total += len(executed) + len(missing)
    return covered, total


def _percent(covered: int, total: int) -> float:
    return 100.0 if total == 0 else (covered / total) * 100.0


if __name__ == "__main__":
    raise SystemExit(main())
