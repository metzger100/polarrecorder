from __future__ import annotations

import io
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RELEASES = ROOT / "releases"
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
DEV_VERSION = "0.0.0-dev"
PLUGIN_DIR = "polarrecorder"
PROJECT_RE = re.compile(r"^\[project\]\s*$")
SECTION_RE = re.compile(r"^\[[^]]+\]\s*$")
VERSION_RE = re.compile(r'^version\s*=\s*"([^"]+)"')
DYNAMIC_VERSION_RE = re.compile(r'^dynamic\s*=\s*\[[^]]*"version"[^]]*\]')
# Canonical semver.org-recommended pattern -- byte-equivalent to tools/release-version.mjs's
# SEMVER_REGEX. Both are asserted against the same tools/quality-policy/semver-corpus.json
# corpus so the JS and Python SemVer authorities can never silently diverge.
SEMVER_RE = re.compile(
    r"^(0|[1-9]\d*)\."
    r"(0|[1-9]\d*)\."
    r"(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)"
    r"(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)
ROOT_RUNTIME_FILES = (
    "plugin.css",
    "plugin.js",
    "plugin.json",
    "plugin.mjs",
    "plugin.py",
    "viewer/icon.svg",
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


def plugin_json_version() -> str | None:
    data = plugin_json_data()
    version = data.get("version")
    if version is None:
        return None
    if not isinstance(version, str) or not version:
        raise ReleaseError("plugin.json version must be a non-empty string when present")
    validate_semver(version)
    return version


def plugin_json_data(root: Path = ROOT) -> dict[str, object]:
    try:
        data = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ReleaseError(f"Could not read plugin.json: {exc}") from exc
    if not isinstance(data, dict):
        raise ReleaseError("plugin.json must contain a JSON object")
    return data


def pyproject_project_version() -> str | None:
    try:
        lines = (ROOT / "pyproject.toml").read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise ReleaseError(f"Could not read pyproject.toml: {exc}") from exc

    in_project = False
    dynamic_version = False
    for line in lines:
        if PROJECT_RE.match(line):
            in_project = True
            continue
        if in_project and SECTION_RE.match(line):
            break
        if in_project:
            match = VERSION_RE.search(line)
            if match:
                version = match.group(1)
                validate_semver(version)
                return version
            if DYNAMIC_VERSION_RE.search(line):
                dynamic_version = True
    if dynamic_version:
        return None
    raise ReleaseError("Could not find [project] version or dynamic version in pyproject.toml")


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
    for pattern in ("*.js", "*.css"):
        entries.extend(
            (source.relative_to(ROOT).as_posix(), source)
            for source in sorted(viewer_root.glob(pattern), key=lambda path: path.name)
        )

    package_root = ROOT / "server" / "polarrecorder"
    if not package_root.is_dir():
        raise ReleaseError("Missing runtime package directory: server/polarrecorder")
    entries.extend(
        (source.relative_to(ROOT).as_posix(), source)
        for source in sorted(
            package_root.rglob("*.py"),
            key=lambda path: path.as_posix(),
        )
    )

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


def validate_versions_match(expected_version: str | None = None) -> str:
    if expected_version is not None:
        validate_semver(expected_version)
    plugin_version = plugin_json_version()
    pyproject_version = pyproject_project_version()

    if expected_version is not None:
        _validate_static_version("plugin.json", plugin_version, expected_version)
        _validate_static_version("pyproject.toml", pyproject_version, expected_version)
        return expected_version

    if plugin_version is None and pyproject_version is None:
        return DEV_VERSION
    if plugin_version != pyproject_version:
        msg = (
            "Version mismatch: "
            f"plugin.json has {plugin_version!r}, pyproject.toml has {pyproject_version!r}"
        )
        raise ReleaseError(msg)
    if plugin_version is None:
        return DEV_VERSION
    return plugin_version


def validate_semver(version: str) -> None:
    if not SEMVER_RE.match(version):
        raise ReleaseError(f"Invalid SemVer version: {version!r}")


def is_prerelease(version: str) -> bool:
    """Return whether `version` carries a SemVer prerelease segment.

    Build metadata alone (e.g. ``1.0.0+build.1``) never makes a version a prerelease;
    only the prerelease segment (the part after ``-``, before any ``+``) does.

    Args:
        version: A valid SemVer string, without a leading ``v``.

    Returns:
        Whether the version's prerelease segment is present.
    """
    match = SEMVER_RE.match(version)
    if match is None:
        raise ReleaseError(f"Invalid SemVer version: {version!r}")
    return match.group(4) is not None


def stamp_plugin_json(version: str) -> bytes:
    validate_semver(version)
    data = plugin_json_data()
    stamped = {"version": version}
    stamped.update({key: value for key, value in data.items() if key != "version"})
    return (json.dumps(stamped, indent=2) + "\n").encode("utf-8")


def runtime_file_bytes(name: str, source: Path, version: str | None = None) -> bytes:
    if name == "plugin.json" and version is not None:
        return stamp_plugin_json(version)
    return source.read_bytes()


def archive_name(runtime_name: str) -> str:
    validate_runtime_name(runtime_name)
    return f"{PLUGIN_DIR}/{runtime_name}"


def build_zip_bytes(version: str, entries: list[tuple[str, Path]]) -> bytes:
    """Build a deterministic release zip in memory.

    Shared by `release-zip.py` (writes the bytes to `releases/`) and
    `check-release.py --dry-run` (validates the bytes without ever touching disk), so
    the archive-construction logic has exactly one owner.

    Args:
        version: The SemVer version to stamp into the archived `plugin.json`.
        entries: `(runtime_name, source)` pairs, as returned by `expected_runtime_files()`.

    Returns:
        The zip file's raw bytes.
    """
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for runtime_name, source in entries:
            info = zipfile.ZipInfo(archive_name(runtime_name), FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, runtime_file_bytes(runtime_name, source, version))
    return buffer.getvalue()


def runtime_name_from_archive(name: str) -> str:
    archive_prefix = f"{PLUGIN_DIR}/"
    if not name.startswith(archive_prefix):
        raise ReleaseError(f"Release zip entry is not under {PLUGIN_DIR}/: {name}")
    runtime_name = name[len(archive_prefix) :]
    if not runtime_name:
        raise ReleaseError(f"Release zip contains empty path under {PLUGIN_DIR}/")
    validate_runtime_name(runtime_name)
    return runtime_name


def validate_runtime_name(name: str) -> None:
    if name.startswith(("/", "../")) or "/../" in name:
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
        or name in {"LICENSE", "LICENSE.md"}
    )


def _validate_static_version(label: str, version: str | None, expected_version: str) -> None:
    if version is not None and version != expected_version:
        raise ReleaseError(
            f"Version mismatch: {label} has {version!r}, release version is {expected_version!r}"
        )
