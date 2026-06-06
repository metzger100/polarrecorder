from __future__ import annotations

import importlib.util
import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Protocol, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "tools" / "check-py-dependencies.py"


class CheckerModule(Protocol):
    ROOT: Path

    def main(self) -> int:
        """Run the checker."""

    def validate_layer_map(
        self, layers: dict[str, int] | None = ..., package_dir: Path | None = ...
    ) -> list[str]:
        """Validate the layer map against the package on disk."""


def module(name: str, depends: str, body: str = "") -> str:
    """Build a domain module source with a Depends header."""
    return (
        f'"""Module: {name} - test target.\n\n'
        "Documentation: documentation/test.md\n"
        f"Depends: {depends}\n"
        '"""\n\n'
        "from __future__ import annotations\n\n" + body
    )


def write_package(root: Path, files: dict[str, str]) -> None:
    """Materialize a fake polarrecorder package under ``root``."""
    package = root / "server" / "polarrecorder"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("", encoding="utf-8")
    for rel, source in files.items():
        path = package / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding="utf-8")


def run_checker(root: Path) -> tuple[int, str]:
    checker = load_checker()
    checker.ROOT = root
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        result = checker.main()
    return result, out.getvalue() + err.getvalue()


def load_checker() -> CheckerModule:
    module_name = "polarrecorder_check_py_dependencies_test"
    spec = importlib.util.spec_from_file_location(module_name, CHECKER_PATH)
    if spec is None or spec.loader is None:
        msg = "could not load check-py-dependencies.py"
        raise AssertionError(msg)
    loaded = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = loaded
    spec.loader.exec_module(loaded)
    return cast("CheckerModule", loaded)


def test_clean_package_passes(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "units.py": module("Units", "none"),
            "sample.py": module(
                "Sample", "polarrecorder.units", "from polarrecorder.units import knots\n"
            ),
        },
    )
    result, _ = run_checker(tmp_path)
    assert result == 0


def test_undeclared_import_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "units.py": module("Units", "none"),
            "sample.py": module("Sample", "none", "from polarrecorder.units import knots\n"),
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "imports 'polarrecorder.units' but the 'Depends:' header omits it" in output


def test_stale_declaration_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "units.py": module("Units", "none"),
            "sample.py": module("Sample", "polarrecorder.units"),
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "lists 'polarrecorder.units' but it is not imported" in output


def test_type_checking_import_must_be_declared(tmp_path: Path) -> None:
    body = (
        "from typing import TYPE_CHECKING\n\n"
        "if TYPE_CHECKING:\n    from polarrecorder.units import Knots\n"
    )
    write_package(
        tmp_path,
        {"units.py": module("Units", "none"), "sample.py": module("Sample", "none", body)},
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "imports 'polarrecorder.units'" in output


def test_runtime_cycle_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "a.py": module("A", "polarrecorder.b", "from polarrecorder.b import thing\n"),
            "b.py": module("B", "polarrecorder.a", "from polarrecorder.a import other\n"),
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "runtime import cycle" in output


def test_type_only_edge_is_not_a_cycle(tmp_path: Path) -> None:
    a_body = "from polarrecorder.b import thing\n"
    b_body = (
        "from typing import TYPE_CHECKING\n\n"
        "if TYPE_CHECKING:\n    from polarrecorder.a import other\n"
    )
    write_package(
        tmp_path,
        {
            "a.py": module("A", "polarrecorder.b", a_body),
            "b.py": module("B", "polarrecorder.a", b_body),
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 0
    assert "cycle" not in output


def test_layer_direction_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "units.py": module(
                "Units", "polarrecorder.reader", "from polarrecorder.reader import intake\n"
            ),
            "reader.py": module("Reader", "none"),
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "layer-direction: 'units' (primitives) imports 'reader' (domain)" in output


def test_same_layer_import_allowed(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "reader.py": module(
                "Reader", "polarrecorder.export", "from polarrecorder.export import build\n"
            ),
            "export.py": module("Export", "none"),
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 0
    assert "layer-direction" not in output


def test_real_layer_map_is_current() -> None:
    checker = load_checker()
    assert checker.validate_layer_map() == []


def test_layer_map_detects_unassigned(tmp_path: Path) -> None:
    package = tmp_path / "server" / "polarrecorder"
    package.mkdir(parents=True)
    (package / "units.py").write_text("", encoding="utf-8")
    (package / "newthing.py").write_text("", encoding="utf-8")
    checker = load_checker()
    findings = checker.validate_layer_map(layers={"units": 0}, package_dir=package)
    assert any("module 'newthing' has no layer" in line for line in findings)


def test_layer_map_detects_stale_entry(tmp_path: Path) -> None:
    package = tmp_path / "server" / "polarrecorder"
    package.mkdir(parents=True)
    (package / "units.py").write_text("", encoding="utf-8")
    checker = load_checker()
    findings = checker.validate_layer_map(layers={"units": 0, "ghost": 2}, package_dir=package)
    needle = "'ghost' is mapped to a layer but no such module exists"
    assert any(needle in line for line in findings)
