#!/usr/bin/env python3
"""Enforce the advertised Python 3.9 runtime compatibility floor."""

from __future__ import annotations

import ast
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("POLARRECORDER_CHECK_ROOT", Path(__file__).resolve().parent.parent))
PY39_FEATURE_VERSION = (3, 9)
PY310_STDLIB_MODULES = frozenset({"tomllib"})
PY310_TYPING_NAMES = frozenset({"Concatenate", "ParamSpec", "Self", "TypeAlias"})
PY311_TYPING_NAMES = frozenset({"Never", "NotRequired", "Required", "TypeVarTuple", "Unpack"})


def main() -> int:
    """Scan runtime and test Python files for Python 3.10+ constructs."""
    failures: list[str] = []
    for path in iter_python_targets():
        failures.extend(check_file(path))

    if failures:
        for failure in failures:
            sys.stderr.write(f"[python-compat] {failure}\n")
        return 1
    sys.stdout.write("Python 3.9 compatibility check passed.\n")
    return 0


def iter_python_targets() -> list[Path]:
    """Return Python files covered by the project compatibility contract."""
    paths: list[Path] = []
    plugin = ROOT / "plugin.py"
    if plugin.exists():
        paths.append(plugin)
    for root_name in ("server/polarrecorder", "tests"):
        root = ROOT / root_name
        if root.exists():
            paths.extend(sorted(root.rglob("*.py")))
    return sorted(set(paths))


def check_file(path: Path) -> list[str]:
    """Return compatibility findings for one file."""
    rel = path.relative_to(ROOT).as_posix()
    source = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source, filename=str(path), feature_version=PY39_FEATURE_VERSION)
    except SyntaxError as error:
        return [f"{rel}:{error.lineno}: syntax is not valid on Python 3.9: {error.msg}"]

    findings: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            findings.extend(check_import(node, rel))
        elif isinstance(node, ast.ImportFrom):
            findings.extend(check_import_from(node, rel))
        elif isinstance(node, ast.Call):
            findings.extend(check_call(node, rel))
    return findings


def check_import(node: ast.Import, rel: str) -> list[str]:
    """Return import findings for one ``import`` statement."""
    findings: list[str] = []
    for alias in node.names:
        root_name = alias.name.split(".", 1)[0]
        if root_name in PY310_STDLIB_MODULES:
            findings.append(
                f"{rel}:{node.lineno}: '{root_name}' is not available in Python 3.9"
            )
    return findings


def check_import_from(node: ast.ImportFrom, rel: str) -> list[str]:
    """Return import findings for one ``from ... import`` statement."""
    findings: list[str] = []
    module = node.module or ""
    root_name = module.split(".", 1)[0]
    if root_name in PY310_STDLIB_MODULES:
        findings.append(f"{rel}:{node.lineno}: '{root_name}' is not available in Python 3.9")
    if module == "typing":
        blocked = PY310_TYPING_NAMES | PY311_TYPING_NAMES
        for alias in node.names:
            if alias.name in blocked:
                findings.append(
                    f"{rel}:{node.lineno}: typing.{alias.name} is not available in Python 3.9"
                )
    return findings


def check_call(node: ast.Call, rel: str) -> list[str]:
    """Return call-shape findings for 3.10+ keyword options."""
    if not is_dataclass_call(node):
        return []
    for keyword in node.keywords:
        if keyword.arg == "slots" and is_true(keyword.value):
            return [f"{rel}:{node.lineno}: dataclasses.dataclass(slots=True) needs Python 3.10"]
    return []


def is_dataclass_call(node: ast.Call) -> bool:
    """Return True when node calls ``dataclass`` / ``dataclasses.dataclass``."""
    if isinstance(node.func, ast.Name):
        return node.func.id == "dataclass"
    if isinstance(node.func, ast.Attribute):
        return node.func.attr == "dataclass"
    return False


def is_true(node: ast.expr) -> bool:
    """Return True for the literal ``True``."""
    return isinstance(node, ast.Constant) and node.value is True


if __name__ == "__main__":
    raise SystemExit(main())
