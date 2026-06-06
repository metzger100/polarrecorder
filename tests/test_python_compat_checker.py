from __future__ import annotations

import importlib.util
import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Protocol, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "tools" / "check-python-compat.py"


class CheckerModule(Protocol):
    ROOT: Path

    def main(self) -> int:
        """Run the checker."""


def test_python_compat_accepts_python39_file(tmp_path: Path) -> None:
    write_server_file(tmp_path, "VALUE: list[int] = [1]\n")

    result, output = run_checker(tmp_path)

    assert result == 0
    assert "Python 3.9 compatibility check passed" in output


def test_python_compat_blocks_match_syntax(tmp_path: Path) -> None:
    write_server_file(
        tmp_path,
        "def classify(value: int) -> str:\n"
        "    match value:\n"
        "        case 1:\n"
        "            return 'one'\n"
        "    return 'other'\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "syntax is not valid on Python 3.9" in output


def test_python_compat_blocks_too_new_stdlib_import(tmp_path: Path) -> None:
    write_server_file(tmp_path, "import tomllib\n")

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "tomllib" in output


def test_python_compat_blocks_too_new_dataclass_slots(tmp_path: Path) -> None:
    write_server_file(
        tmp_path,
        "from dataclasses import dataclass\n\n"
        "@dataclass(slots=True)\n"
        "class Target:\n"
        "    value: int\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "slots=True" in output


def run_checker(root: Path) -> tuple[int, str]:
    checker = load_checker()
    checker.ROOT = root
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        result = checker.main()
    return result, out.getvalue() + err.getvalue()


def load_checker() -> CheckerModule:
    module_name = "polarrecorder_check_python_compat_test"
    spec = importlib.util.spec_from_file_location(module_name, CHECKER_PATH)
    if spec is None or spec.loader is None:
        msg = "could not load check-python-compat.py"
        raise AssertionError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return cast("CheckerModule", module)


def write_server_file(root: Path, body: str) -> None:
    path = root / "server" / "polarrecorder" / "target.py"
    path.parent.mkdir(parents=True)
    path.write_text("from __future__ import annotations\n\n" + body, encoding="utf-8")
