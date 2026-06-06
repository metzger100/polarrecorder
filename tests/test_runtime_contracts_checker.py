from __future__ import annotations

import importlib.util
import io
import math
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Protocol, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "tools" / "check-runtime-contracts.py"


class CheckerModule(Protocol):
    def main(self) -> int:
        """Run the checker."""

    def nonfinite_paths(self, value: object, path: str = ...) -> list[tuple[str, float]]:
        """Return non-finite float leaves reachable in a response."""

    def sentinel_text_failures(self, text: str) -> list[str]:
        """Return findings for nan/inf sentinel tokens in export text."""


def test_nonfinite_paths_finds_nan_and_inf() -> None:
    checker = load_checker()
    response = {
        "data": {
            "curves": {"6": [{"stw": math.nan, "samples": 3}, None]},
            "ratio": math.inf,
            "ok": 4.2,
        }
    }
    findings = checker.nonfinite_paths(response)
    paths = {path for path, _value in findings}
    assert ".data.curves.6[0].stw" in paths
    assert ".data.ratio" in paths
    assert len(findings) == 2


def test_nonfinite_paths_clean_response_passes() -> None:
    checker = load_checker()
    response = {"data": {"curves": {"6": [{"stw": 5.1, "samples": 3}, None]}, "bands": [6, 8]}}
    assert checker.nonfinite_paths(response) == []


def test_nonfinite_paths_ignores_bool_and_int() -> None:
    checker = load_checker()
    assert checker.nonfinite_paths({"recording": True, "count": 12}) == []


def test_sentinel_text_failures_flags_nan_and_inf_tokens() -> None:
    checker = load_checker()
    assert checker.sentinel_text_failures("twa;stw\n0;nan\n90;inf") != []


def test_sentinel_text_failures_ignores_normal_numbers_and_words() -> None:
    checker = load_checker()
    assert checker.sentinel_text_failures("twa;stw;info\n0;5.2;3\n90;-3.5;7") == []


def test_real_boundary_responses_are_finite() -> None:
    checker = load_checker()
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        result = checker.main()
    assert result == 0, out.getvalue() + err.getvalue()


def load_checker() -> CheckerModule:
    module_name = "polarrecorder_check_runtime_contracts_test"
    spec = importlib.util.spec_from_file_location(module_name, CHECKER_PATH)
    if spec is None or spec.loader is None:
        msg = "could not load check-runtime-contracts.py"
        raise AssertionError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return cast("CheckerModule", module)
