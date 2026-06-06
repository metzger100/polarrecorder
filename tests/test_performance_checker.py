from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Protocol, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "tools" / "check-performance.py"


class CheckerModule(Protocol):
    def evaluate_performance(
        self,
        update_elapsed: float,
        update_elapsed_double: float,
        format_elapsed: float,
    ) -> list[str]:
        """Return performance failures for the given timings."""


def test_linear_scaling_under_ceilings_passes() -> None:
    checker = load_checker()
    assert checker.evaluate_performance(0.05, 0.10, 0.5) == []


def test_update_ceiling_breach_flagged() -> None:
    checker = load_checker()
    failures = checker.evaluate_performance(2.0, 4.0, 0.5)
    assert any("model update" in failure for failure in failures)


def test_format_ceiling_breach_flagged() -> None:
    checker = load_checker()
    failures = checker.evaluate_performance(0.05, 0.10, 5.0)
    assert any("polar format" in failure for failure in failures)


def test_superlinear_scaling_flagged() -> None:
    checker = load_checker()
    failures = checker.evaluate_performance(0.05, 0.30, 0.5)
    assert any("scaling" in failure for failure in failures)


def test_tiny_basis_skips_scaling_guard() -> None:
    checker = load_checker()
    # Below the ratio basis floor the doubling ratio is noise, so it is ignored.
    assert checker.evaluate_performance(0.005, 0.05, 0.5) == []


def load_checker() -> CheckerModule:
    module_name = "polarrecorder_check_performance_test"
    spec = importlib.util.spec_from_file_location(module_name, CHECKER_PATH)
    if spec is None or spec.loader is None:
        msg = "could not load check-performance.py"
        raise AssertionError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return cast("CheckerModule", module)
