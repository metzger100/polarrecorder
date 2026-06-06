from __future__ import annotations

import importlib.util
import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Protocol, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "tools" / "check-py-contracts.py"


class CheckerModule(Protocol):
    ROOT: Path
    SCAN_ROOT: Path

    def main(self) -> int:
        """Run the checker."""

    def validate_canonical_helper_map(
        self,
        helpers: dict[str, str] | None = ...,
        root: Path | None = ...,
    ) -> list[str]:
        """Validate the canonical-helper owner map against owner modules."""


HEADER = (
    '"""Module: Sample - test target.\n\n'
    "Documentation: documentation/test.md\n"
    "Depends: none\n"
    '"""\n\n'
    "from __future__ import annotations\n\n"
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
    checker.SCAN_ROOT = root / "server" / "polarrecorder"
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        result = checker.main()
    return result, out.getvalue() + err.getvalue()


def load_checker() -> CheckerModule:
    module_name = "polarrecorder_check_py_contracts_test"
    spec = importlib.util.spec_from_file_location(module_name, CHECKER_PATH)
    if spec is None or spec.loader is None:
        msg = "could not load check-py-contracts.py"
        raise AssertionError(msg)
    loaded = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = loaded
    spec.loader.exec_module(loaded)
    return cast("CheckerModule", loaded)


def test_clean_package_passes(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {"units.py": HEADER + "def meters_per_second_to_knots(x: float) -> float:\n    return x\n"},
    )
    result, _ = run_checker(tmp_path)
    assert result == 0


def test_truthy_fallback_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {"sample.py": HEADER + "def read(value: str) -> str:\n    return value or ''\n"},
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "truthy-fallback" in output


def test_nan_sentinel_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {"sample.py": HEADER + "def absent() -> float:\n    return float('nan')\n"},
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "nan-sentinel" in output


def test_canonical_helper_redefinition_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "rogue.py": HEADER
            + "def twa_bin(twa_deg_raw: float) -> int:\n    return int(twa_deg_raw)\n"
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "canonical-helper-redefinition" in output
    assert "owned by server/polarrecorder/bins.py" in output


def test_canonical_helper_in_owner_passes(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "bins.py": HEADER
            + "def twa_bin(twa_deg_raw: float) -> int:\n    return int(twa_deg_raw)\n"
        },
    )
    result, _ = run_checker(tmp_path)
    assert result == 0


def test_canonical_helper_as_method_allowed(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "widget.py": HEADER
            + "class Grid:\n    def twa_bin(self, x: float) -> int:\n        return int(x)\n"
        },
    )
    result, _ = run_checker(tmp_path)
    assert result == 0


def test_redundant_type_guard_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "sample.py": HEADER
            + "def coerce(value: list[int]) -> list[int]:\n"
            + "    return value if isinstance(value, list) else []\n"
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "redundant-type-guard" in output


def test_redundant_str_guard_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "sample.py": HEADER
            + "def label(value: str | None) -> str:\n"
            + "    return str(value if value is not None else '')\n"
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "redundant-type-guard" in output


def test_framework_method_guard_hasattr_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "sample.py": HEADER
            + "class Engine:\n"
            + "    def run(self) -> bool:\n"
            + "        return hasattr(self, 'value')\n"
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "framework-method-guard" in output


def test_framework_method_guard_callable_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "sample.py": HEADER
            + "class Engine:\n"
            + "    def run(self) -> bool:\n"
            + "        return callable(getattr(self, 'step', None))\n"
        },
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "framework-method-guard" in output


def test_speculative_legacy_blocked(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {"sample.py": HEADER + "def legacy_convert(value: int) -> int:\n    return value\n"},
    )
    result, output = run_checker(tmp_path)
    assert result == 1
    assert "premature-legacy-support" in output


def test_referenced_legacy_alias_allowed(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "aliases.py": HEADER + "LEGACY_ALIASES = {'old': 'new'}\n",
            "lookup.py": HEADER
            + "def resolve(name: str) -> str:\n"
            + "    return LEGACY_ALIASES.get(name, name)\n",
        },
    )
    result, _ = run_checker(tmp_path)
    assert result == 0


def test_canonical_helper_map_stale_when_helper_missing(tmp_path: Path) -> None:
    checker = load_checker()
    (tmp_path / "server" / "polarrecorder").mkdir(parents=True)
    owner = tmp_path / "server" / "polarrecorder" / "bins.py"
    owner.write_text(HEADER + "def something_else() -> int:\n    return 0\n", encoding="utf-8")
    findings = checker.validate_canonical_helper_map(
        {"twa_bin": "server/polarrecorder/bins.py"}, tmp_path
    )
    assert len(findings) == 1
    assert "canonical-helper-map-stale" in findings[0]


def test_canonical_helper_map_stale_when_owner_missing(tmp_path: Path) -> None:
    checker = load_checker()
    findings = checker.validate_canonical_helper_map(
        {"twa_bin": "server/polarrecorder/bins.py"}, tmp_path
    )
    assert len(findings) == 1
    assert "owner module for 'twa_bin' is missing" in findings[0]


def test_canonical_helper_map_passes_when_helper_present(tmp_path: Path) -> None:
    checker = load_checker()
    (tmp_path / "server" / "polarrecorder").mkdir(parents=True)
    owner = tmp_path / "server" / "polarrecorder" / "bins.py"
    owner.write_text(
        HEADER + "def twa_bin(value: float) -> int:\n    return int(value)\n", encoding="utf-8"
    )
    findings = checker.validate_canonical_helper_map(
        {"twa_bin": "server/polarrecorder/bins.py"}, tmp_path
    )
    assert findings == []


def test_real_canonical_helper_map_is_current() -> None:
    checker = load_checker()
    assert checker.validate_canonical_helper_map() == []
