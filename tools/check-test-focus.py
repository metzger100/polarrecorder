#!/usr/bin/env python3
"""Python half of `test:focus:check`: block skip/skipif/xfail markers.

Scans every `tests/*.py` file with the standard-library `ast` module (so string and
comment content can never trigger a false positive) for pytest and unittest
skip/skipif/xfail/expectedFailure decorators and `self.skipTest(...)` /
`pytest.skip(...)` / `pytest.xfail(...)` calls. The verified initial exception set is
empty; adding one requires reviewed owner, date, reason, hash-locked-site, and
explicit-negative-test justification -- not silent implementation convenience.
"""

from __future__ import annotations

import ast
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("POLARRECORDER_CHECK_ROOT", Path(__file__).resolve().parent.parent))

DECORATOR_MARKER_NAMES = frozenset(
    {"skip", "skipif", "skipIf", "skipUnless", "xfail", "expectedFailure"}
)
CALL_MARKER_NAMES = frozenset({"skipTest", "skip", "xfail"})


def main() -> int:
    """Scan `tests/*.py` for focused/disabled-test markers."""
    failures: list[str] = []
    files = iter_python_test_files()
    for path in files:
        failures.extend(check_file(path))

    if failures:
        for failure in failures:
            sys.stderr.write(f"[test-focus] {failure}\n")
        return 1
    sys.stdout.write(f"Python test-focus check passed ({len(files)} files).\n")
    return 0


def iter_python_test_files() -> list[Path]:
    """Return every `tests/*.py` file covered by this contract."""
    tests_dir = ROOT / "tests"
    if not tests_dir.exists():
        return []
    return sorted(tests_dir.rglob("*.py"))


def check_file(path: Path) -> list[str]:
    """Return focus/disable findings for one Python test file."""
    rel = path.relative_to(ROOT).as_posix()
    source = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as error:
        return [f"{rel}:{error.lineno}: could not parse ({error.msg})"]

    findings: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            findings.extend(check_decorators(node, rel))
        elif isinstance(node, ast.Call):
            findings.extend(check_call(node, rel))
    return findings


def check_decorators(
    node: ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef, rel: str
) -> list[str]:
    """Return findings for a function/class's skip/skipif/xfail decorators."""
    findings: list[str] = []
    for decorator in node.decorator_list:
        name = decorator_marker_name(decorator)
        if name is not None:
            findings.append(
                f"{rel}:{decorator.lineno}: focused/disabled test decorator '@...{name}'"
            )
    return findings


def decorator_marker_name(decorator: ast.expr) -> str | None:
    """Return the final attribute/call name of a decorator if it is a known marker."""
    target = decorator.func if isinstance(decorator, ast.Call) else decorator
    if isinstance(target, ast.Attribute) and target.attr in DECORATOR_MARKER_NAMES:
        return target.attr
    if isinstance(target, ast.Name) and target.id in DECORATOR_MARKER_NAMES:
        return target.id
    return None


def check_call(node: ast.Call, rel: str) -> list[str]:
    """Return findings for a `self.skipTest(...)` / `pytest.skip(...)` style call."""
    func = node.func
    if isinstance(func, ast.Attribute) and func.attr in CALL_MARKER_NAMES:
        return [f"{rel}:{node.lineno}: focused/disabled test call '...{func.attr}(...)'"]
    return []


if __name__ == "__main__":
    raise SystemExit(main())
