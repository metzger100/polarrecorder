"""Self-tests for tools/check-release.py, the release artifact validator.

Every case builds its zip bytes in memory (`release_manifest.build_zip_bytes`) rather
than writing to `releases/`, matching the same fixture-provenance preference used
throughout this suite.
"""

from __future__ import annotations

import importlib.util
import json
import sys
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Protocol, cast

import pytest
from test_release_manifest import load_release_manifest

REPO_ROOT = Path(__file__).resolve().parents[1]
TOOLS_DIR = REPO_ROOT / "tools"
# check-release.py itself does `import release_manifest`; that sibling import only
# resolves once tools/ is on sys.path (loading it via spec_from_file_location does not
# add its own directory the way running it as a script would).
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

manifest = load_release_manifest()


class CheckReleaseModule(Protocol):
    def validate_zip_bytes(
        self, zip_bytes: bytes, expected_entries: list[tuple[str, Path]], release_version: str
    ) -> None: ...

    def resolve_release_version(self, version: str | None, zip_path: str | None) -> str: ...

    def main(self) -> int: ...


def load_check_release() -> CheckReleaseModule:
    module_name = "polarrecorder_check_release_test"
    module_path = TOOLS_DIR / "check-release.py"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return cast("CheckReleaseModule", module)


def _tiny_entries(tmp_path: Path) -> list[tuple[str, Path]]:
    """A minimal 2-entry manifest: plugin.json (version-stamped) plus one plain file."""
    other = tmp_path / "other.py"
    other.write_text("x = 1\n", encoding="utf-8")
    (tmp_path / "plugin.json").write_text("{}", encoding="utf-8")
    return [("plugin.json", tmp_path / "plugin.json"), ("server/polarrecorder/other.py", other)]


def test_dry_run_builds_and_validates_an_in_memory_dev_artifact() -> None:
    checker = load_check_release()
    zip_bytes = manifest.build_zip_bytes(manifest.DEV_VERSION, manifest.expected_runtime_files())

    checker.validate_zip_bytes(zip_bytes, manifest.expected_runtime_files(), manifest.DEV_VERSION)


def test_build_zip_bytes_is_byte_identical_across_two_builds() -> None:
    entries = manifest.expected_runtime_files()

    first = manifest.build_zip_bytes(manifest.DEV_VERSION, entries)
    second = manifest.build_zip_bytes(manifest.DEV_VERSION, entries)

    assert first == second


def test_build_zip_bytes_nests_everything_under_one_top_level_directory() -> None:
    entries = manifest.expected_runtime_files()
    zip_bytes = manifest.build_zip_bytes(manifest.DEV_VERSION, entries)

    with zipfile.ZipFile(BytesIO(zip_bytes)) as archive:
        top_level_dirs = {name.split("/", 1)[0] for name in archive.namelist()}

    assert top_level_dirs == {"polarrecorder"}


def test_build_zip_bytes_uses_the_fixed_timestamp() -> None:
    entries = manifest.expected_runtime_files()
    zip_bytes = manifest.build_zip_bytes(manifest.DEV_VERSION, entries)

    with zipfile.ZipFile(BytesIO(zip_bytes)) as archive:
        for info in archive.infolist():
            assert info.date_time == manifest.FIXED_ZIP_TIME


def test_validate_zip_bytes_passes_for_a_matching_archive(tmp_path: Path) -> None:
    checker = load_check_release()
    entries = _tiny_entries(tmp_path)
    zip_bytes = manifest.build_zip_bytes("1.0.0", entries)

    checker.validate_zip_bytes(zip_bytes, entries, "1.0.0")


def test_validate_zip_bytes_detects_a_missing_runtime_file(tmp_path: Path) -> None:
    checker = load_check_release()
    entries = _tiny_entries(tmp_path)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("polarrecorder/plugin.json", manifest.stamp_plugin_json("1.0.0"))
    with pytest.raises(manifest.ReleaseError, match="missing runtime files"):
        checker.validate_zip_bytes(buffer.getvalue(), entries, "1.0.0")


def test_validate_zip_bytes_detects_an_unexpected_entry(tmp_path: Path) -> None:
    checker = load_check_release()
    entries = _tiny_entries(tmp_path)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, source in entries:
            archive.writestr(
                f"polarrecorder/{name}", manifest.runtime_file_bytes(name, source, "1.0.0")
            )
        archive.writestr("polarrecorder/unexpected.txt", "surprise")
    with pytest.raises(manifest.ReleaseError, match="non-runtime files"):
        checker.validate_zip_bytes(buffer.getvalue(), entries, "1.0.0")


def test_validate_zip_bytes_detects_stale_content_drift(tmp_path: Path) -> None:
    checker = load_check_release()
    entries = _tiny_entries(tmp_path)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("polarrecorder/plugin.json", manifest.stamp_plugin_json("1.0.0"))
        archive.writestr("polarrecorder/server/polarrecorder/other.py", "x = 999  # drifted\n")
    with pytest.raises(manifest.ReleaseError, match="differ from source files"):
        checker.validate_zip_bytes(buffer.getvalue(), entries, "1.0.0")


def test_validate_zip_bytes_rejects_an_unsafe_path(tmp_path: Path) -> None:
    checker = load_check_release()
    entries = _tiny_entries(tmp_path)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, source in entries:
            archive.writestr(
                f"polarrecorder/{name}", manifest.runtime_file_bytes(name, source, "1.0.0")
            )
        archive.writestr("../escape.txt", "escape")
    with pytest.raises(manifest.ReleaseError, match="unsafe path"):
        checker.validate_zip_bytes(buffer.getvalue(), entries, "1.0.0")


def test_validate_zip_bytes_rejects_duplicate_entries_after_normalization(tmp_path: Path) -> None:
    checker = load_check_release()
    entries = _tiny_entries(tmp_path)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, source in entries:
            archive.writestr(
                f"polarrecorder/{name}", manifest.runtime_file_bytes(name, source, "1.0.0")
            )
        # A zip is permitted to carry the exact same entry name twice; a second write
        # with an identical archive name is a legitimate duplicate-entry attack shape.
        archive.writestr("polarrecorder/plugin.json", manifest.stamp_plugin_json("1.0.0"))
    with pytest.raises(manifest.ReleaseError, match="duplicate entries"):
        checker.validate_zip_bytes(buffer.getvalue(), entries, "1.0.0")


def test_resolve_release_version_infers_from_zip_name() -> None:
    checker = load_check_release()
    assert checker.resolve_release_version(None, "releases/polarrecorder-1.2.3.zip") == "1.2.3"


def test_resolve_release_version_prefers_explicit_version() -> None:
    checker = load_check_release()
    assert checker.resolve_release_version("9.9.9", "releases/polarrecorder-1.2.3.zip") == "9.9.9"


def test_resolve_release_version_requires_something() -> None:
    checker = load_check_release()
    with pytest.raises(manifest.ReleaseError, match="Release version is required"):
        checker.resolve_release_version(None, None)


def test_version_stamping_overrides_plugin_json_and_development_fallback(tmp_path: Path) -> None:
    # stamp_plugin_json always reads the real repo's own plugin.json (there is only ever
    # one); runtime_file_bytes's `source` argument is only consulted for non-stamped files.
    stamped = manifest.runtime_file_bytes("plugin.json", tmp_path / "unused.json", "2.0.0")

    data = json.loads(stamped)
    assert data["version"] == "2.0.0"
    assert next(iter(data)) == "version"

    # No version anywhere (real repo state) falls back to DEV_VERSION.
    assert manifest.validate_versions_match() == manifest.DEV_VERSION
