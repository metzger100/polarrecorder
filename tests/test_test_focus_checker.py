"""Self-tests for tools/check-test-focus.py, the Python focused/disabled-test blocker.
Every negative case uses an in-memory `tmp_path` fixture rather than a committed one,
per this project's fixture-provenance convention.
"""

from __future__ import annotations

import importlib.util
import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Protocol, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "tools" / "check-test-focus.py"


class CheckerModule(Protocol):
    ROOT: Path

    def main(self) -> int:
        """Run the checker."""


def test_a_clean_test_file_passes(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "def test_does_the_thing():\n    assert True\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 0
    assert "Python test-focus check passed" in output


def test_a_comment_mentioning_skip_is_not_a_false_positive(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "# Do not use @pytest.mark.skip here -- see review notes.\n"
        "def test_still_runs():\n"
        "    assert True\n",
    )

    result, _output = run_checker(tmp_path)

    assert result == 0


def test_a_string_literal_mentioning_skip_is_not_a_false_positive(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "def test_checks_failure_text():\n"
        '    assert "pytest.mark.skip should be forbidden" is not None\n',
    )

    result, _output = run_checker(tmp_path)

    assert result == 0


def test_pytest_mark_skip_fails(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "import pytest\n\n\n@pytest.mark.skip\ndef test_skipped():\n    assert True\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "@...skip" in output


def test_pytest_mark_skipif_fails(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "import pytest\n\n\n"
        '@pytest.mark.skipif(True, reason="unused")\n'
        "def test_skipped():\n"
        "    assert True\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "@...skipif" in output


def test_pytest_mark_xfail_fails(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "import pytest\n\n\n@pytest.mark.xfail\ndef test_expected_fail():\n    assert True\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "@...xfail" in output


def test_unittest_skip_decorator_fails(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "import unittest\n\n\n"
        "class ExampleCase(unittest.TestCase):\n"
        '    @unittest.skip("unused")\n'
        "    def test_skipped(self):\n"
        "        self.assertTrue(True)\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "@...skip" in output


def test_unittest_expected_failure_decorator_fails(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "import unittest\n\n\n"
        "class ExampleCase(unittest.TestCase):\n"
        "    @unittest.expectedFailure\n"
        "    def test_fails(self):\n"
        "        self.assertTrue(False)\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "@...expectedFailure" in output


def test_self_skip_test_call_fails(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        "import unittest\n\n\n"
        "class ExampleCase(unittest.TestCase):\n"
        "    def test_conditionally_skipped(self):\n"
        '        self.skipTest("unused")\n',
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "...skipTest(...)" in output


def test_pytest_skip_call_fails(tmp_path: Path) -> None:
    write_test_file(
        tmp_path,
        'import pytest\n\n\ndef test_skipped():\n    pytest.skip("unused")\n',
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "...skip(...)" in output


def test_an_unparseable_file_fails_closed(tmp_path: Path) -> None:
    write_test_file(tmp_path, "def test_broken(:\n    pass\n")

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "could not parse" in output


def test_the_real_repo_has_no_focused_or_disabled_python_tests() -> None:
    checker = load_checker()
    checker.ROOT = REPO_ROOT
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        result = checker.main()
    assert result == 0, out.getvalue() + err.getvalue()


def run_checker(root: Path) -> tuple[int, str]:
    checker = load_checker()
    checker.ROOT = root
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        result = checker.main()
    return result, out.getvalue() + err.getvalue()


def load_checker() -> CheckerModule:
    module_name = "polarrecorder_check_test_focus_test"
    spec = importlib.util.spec_from_file_location(module_name, CHECKER_PATH)
    if spec is None or spec.loader is None:
        msg = "could not load check-test-focus.py"
        raise AssertionError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return cast("CheckerModule", module)


def write_test_file(root: Path, body: str) -> None:
    path = root / "tests" / "test_example.py"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("from __future__ import annotations\n\n" + body, encoding="utf-8")
