from __future__ import annotations

import importlib.util
import io
import sys
from contextlib import redirect_stdout
from pathlib import Path
from typing import Protocol, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "tools" / "check-python-filesize.py"
MODULE_HEADER = (
    '"""Module: Target - Test target.\n\n'
    "Documentation: documentation/test.md\n"
    "Depends: none\n"
    '"""\n\n'
    "from __future__ import annotations\n\n"
)


class CheckerModule(Protocol):
    ROOT: Path

    def main(self) -> int:
        """Run the checker."""


def test_python_filesize_blocks_oversized_file(tmp_path: Path) -> None:
    lines = [
        "from __future__ import annotations",
        *[f"VALUE_{index} = {index}" for index in range(401)],
    ]
    (tmp_path / "plugin.py").write_text("\n".join(lines), encoding="utf-8")

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "non-empty lines" in output


def test_python_filesize_blocks_missing_server_header(tmp_path: Path) -> None:
    write_server_file(tmp_path, "from __future__ import annotations\n", with_header=False)

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "missing required module header" in output


def test_python_filesize_blocks_semicolon_packing(tmp_path: Path) -> None:
    write_server_file(
        tmp_path,
        "def sample() -> int:\n    value = 1; other = 2\n    return value + other\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "semicolon-packed" in output


def test_python_filesize_blocks_collapsed_compound_body(tmp_path: Path) -> None:
    write_server_file(
        tmp_path,
        "def sample(flag: bool) -> int:\n    if flag: return 1\n    return 0\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "collapsed-compound-body" in output


def test_python_filesize_blocks_chained_conditional(tmp_path: Path) -> None:
    write_server_file(tmp_path, "VALUE = 1 if True else 2 if False else 3\n")

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "chained-conditional" in output


def test_python_filesize_blocks_collapsed_literal(tmp_path: Path) -> None:
    write_server_file(
        tmp_path,
        "VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "collapsed-literal" in output


def test_python_filesize_blocks_crammed_comprehension(tmp_path: Path) -> None:
    write_server_file(
        tmp_path,
        "VALUES = [value * 2 for value in range(100) "
        "if value % 2 == 0 and value > 10 and value < 90 and value not in {22, 44, 66}]\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "crammed-comprehension" in output


def test_python_filesize_blocks_packed_lambda(tmp_path: Path) -> None:
    write_server_file(
        tmp_path,
        "CALLBACK = lambda value, other, third: "
        "(value + other + third, value * other, third - other)\n",
    )

    result, output = run_checker(tmp_path)

    assert result == 1
    assert "lambda-packed" in output


def run_checker(root: Path) -> tuple[int, str]:
    checker = load_checker()
    checker.ROOT = root
    output = io.StringIO()
    with redirect_stdout(output):
        result = checker.main()
    return result, output.getvalue()


def load_checker() -> CheckerModule:
    module_name = "polarrecorder_check_python_filesize_test"
    spec = importlib.util.spec_from_file_location(module_name, CHECKER_PATH)
    if spec is None or spec.loader is None:
        msg = "could not load check-python-filesize.py"
        raise AssertionError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return cast("CheckerModule", module)


def write_server_file(root: Path, body: str, *, with_header: bool = True) -> None:
    path = root / "server" / "polarrecorder" / "target.py"
    path.parent.mkdir(parents=True)
    prefix = MODULE_HEADER if with_header else ""
    path.write_text(prefix + body, encoding="utf-8")
