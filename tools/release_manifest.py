from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RELEASES = ROOT / "releases"
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
PROJECT_RE = re.compile(r"^\[project\]\s*$")
SECTION_RE = re.compile(r"^\[[^]]+\]\s*$")
VERSION_RE = re.compile(r'^version\s*=\s*"([^"]+)"')
ROOT_RUNTIME_FILES = (
    "README.md",
    "plugin.css",
    "plugin.json",
    "plugin.mjs",
    "plugin.py",
    "viewer/icon.svg",
    "viewer/viewer.css",
    "viewer/viewer.html",
)
EXCLUDED_PREFIXES = (
    ".git/",
    ".githooks/",
    ".kilo/",
    "data/",
    "documentation/",
    "exec-plans/",
    "misc/",
    "releases/",
    "tests/",
    "tools/",
)
EXCLUDED_NAMES = {
    ".gitignore",
    "package.json",
    "package-lock.json",
    "pyproject.toml",
    "skills-lock.json",
    "vitest.config.js",
}


class ReleaseError(ValueError):
    pass


def plugin_json_version() -> str:
    try:
        data = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ReleaseError(f"Could not read plugin.json: {exc}") from exc
    version = data.get("version")
    if not isinstance(version, str) or not version:
        raise ReleaseError("plugin.json must contain a non-empty string version")
    return version


def pyproject_project_version() -> str:
    try:
        lines = (ROOT / "pyproject.toml").read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise ReleaseError(f"Could not read pyproject.toml: {exc}") from exc

    in_project = False
    for line in lines:
        if PROJECT_RE.match(line):
            in_project = True
            continue
        if in_project and SECTION_RE.match(line):
            break
        if in_project:
            match = VERSION_RE.search(line)
            if match:
                return match.group(1)
    raise ReleaseError("Could not find [project] version in pyproject.toml")


def expected_runtime_files() -> list[tuple[str, Path]]:
    entries: list[tuple[str, Path]] = []
    for relative in ROOT_RUNTIME_FILES:
        source = ROOT / relative
        if not source.is_file():
            raise ReleaseError(f"Missing runtime file: {relative}")
        entries.append((relative, source))

    viewer_root = ROOT / "viewer"
    if not viewer_root.is_dir():
        raise ReleaseError("Missing runtime viewer directory: viewer")
    for source in sorted(viewer_root.glob("*.js"), key=lambda path: path.name):
        entries.append((source.relative_to(ROOT).as_posix(), source))

    package_root = ROOT / "server" / "polarrecorder"
    if not package_root.is_dir():
        raise ReleaseError("Missing runtime package directory: server/polarrecorder")
    for source in sorted(package_root.rglob("*.py"), key=lambda path: path.as_posix()):
        entries.append((source.relative_to(ROOT).as_posix(), source))

    archive_names = [name for name, _source in entries]
    duplicates = sorted({name for name in archive_names if archive_names.count(name) > 1})
    if duplicates:
        raise ReleaseError(f"Duplicate runtime entries: {', '.join(duplicates)}")
    for name in archive_names:
        validate_runtime_name(name)
    return sorted(entries, key=lambda item: item[0])


def expected_runtime_names() -> set[str]:
    return {name for name, _source in expected_runtime_files()}


def default_zip_path(version: str) -> Path:
    return RELEASES / f"polarrecorder-{version}.zip"


def companion_notes_path(version: str) -> Path:
    return RELEASES / f"polarrecorder-{version}.md"


def validate_versions_match() -> str:
    plugin_version = plugin_json_version()
    pyproject_version = pyproject_project_version()
    if plugin_version != pyproject_version:
        msg = (
            "Version mismatch: "
            f"plugin.json has {plugin_version!r}, pyproject.toml has {pyproject_version!r}"
        )
        raise ReleaseError(msg)
    return plugin_version


def validate_runtime_name(name: str) -> None:
    if name.startswith("/") or name.startswith("../") or "/../" in name:
        raise ReleaseError(f"Unsafe runtime path: {name}")
    if is_excluded(name):
        raise ReleaseError(f"Runtime allowlist contains excluded path: {name}")


def is_excluded(name: str) -> bool:
    path_parts = set(name.split("/"))
    return (
        name in EXCLUDED_NAMES
        or any(name.startswith(prefix) for prefix in EXCLUDED_PREFIXES)
        or name.endswith(".pyc")
        or "__pycache__" in path_parts
        or name == "LICENSE"
        or name == "LICENSE.md"
    )
