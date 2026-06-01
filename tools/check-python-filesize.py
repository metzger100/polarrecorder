from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_NON_EMPTY_LINES = 400


def main() -> int:
    failures: list[str] = []
    for path in iter_python_targets():
        non_empty_lines = count_non_empty_lines(path)
        relative = path.relative_to(ROOT)
        if non_empty_lines > MAX_NON_EMPTY_LINES:
            failures.append(
                f"{relative}: {non_empty_lines} non-empty lines "
                f"(limit {MAX_NON_EMPTY_LINES})"
            )
        if needs_header(path) and not has_module_header(path):
            failures.append(f"{relative}: missing required module header")

    if failures:
        for failure in failures:
            print(f"[python-filesize] {failure}")
        return 1

    print("Python file size/header check passed.")
    return 0


def iter_python_targets() -> list[Path]:
    paths: list[Path] = []
    plugin = ROOT / "plugin.py"
    if plugin.exists():
        paths.append(plugin)
    for root_name in ("server/polarrecorder", "tests"):
        root = ROOT / root_name
        if root.exists():
            paths.extend(sorted(root.rglob("*.py")))
    return sorted(set(paths))


def count_non_empty_lines(path: Path) -> int:
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def needs_header(path: Path) -> bool:
    try:
        relative = path.relative_to(ROOT / "server" / "polarrecorder")
    except ValueError:
        return False
    return relative.name != "__init__.py"


def has_module_header(path: Path) -> bool:
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        return line.startswith('"""Module:')
    return False


if __name__ == "__main__":
    raise SystemExit(main())
