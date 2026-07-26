from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Protocol, cast

import pytest

_SEMVER_CORPUS_PATH = (
    Path(__file__).resolve().parents[1] / "tools" / "quality-policy" / "semver-corpus.json"
)


class ReleaseManifestModule(Protocol):
    ReleaseError: type[ValueError]
    DEV_VERSION: str
    FIXED_ZIP_TIME: tuple[int, int, int, int, int, int]

    def plugin_json_data(self, root: Path = Path()) -> dict[str, object]: ...

    def expected_runtime_files(self) -> list[tuple[str, Path]]: ...

    def validate_semver(self, version: str) -> None: ...

    def is_prerelease(self, version: str) -> bool: ...

    def validate_versions_match(self, expected_version: str | None = None) -> str: ...

    def stamp_plugin_json(self, version: str) -> bytes: ...

    def runtime_file_bytes(self, name: str, source: Path, version: str | None = None) -> bytes: ...

    def build_zip_bytes(self, version: str, entries: list[tuple[str, Path]]) -> bytes: ...


def load_release_manifest() -> ReleaseManifestModule:
    # Cache in sys.modules under its real import name so any other dynamically-loaded
    # tools/*.py module that does `import release_manifest` (e.g. check-release.py in
    # tests/test_check_release.py) shares this exact module object -- and therefore the
    # same `ReleaseError` class -- instead of re-executing a second, distinct instance
    # whose exception type would never match `pytest.raises(manifest.ReleaseError)`.
    cached = sys.modules.get("release_manifest")
    if cached is not None:
        return cast("ReleaseManifestModule", cached)
    module_path = Path(__file__).resolve().parents[1] / "tools" / "release_manifest.py"
    spec = importlib.util.spec_from_file_location("release_manifest", module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["release_manifest"] = module
    spec.loader.exec_module(module)
    return cast("ReleaseManifestModule", module)


def test_plugin_json_data_accepts_object(tmp_path: Path) -> None:
    manifest = load_release_manifest()
    (tmp_path / "plugin.json").write_text("{}", encoding="utf-8")

    assert manifest.plugin_json_data(tmp_path) == {}


def test_plugin_json_data_rejects_non_object(tmp_path: Path) -> None:
    manifest = load_release_manifest()
    (tmp_path / "plugin.json").write_text("[]", encoding="utf-8")

    with pytest.raises(manifest.ReleaseError, match="JSON object"):
        manifest.plugin_json_data(tmp_path)


def test_expected_runtime_files_include_user_app_targets() -> None:
    manifest = load_release_manifest()

    names = {name for name, _source in manifest.expected_runtime_files()}

    assert {
        "plugin.py",
        "plugin.json",
        "viewer/viewer.html",
        "viewer/icon.svg",
    } <= names


def test_every_corpus_valid_version_is_accepted_with_expected_prerelease() -> None:
    manifest = load_release_manifest()
    corpus = json.loads(_SEMVER_CORPUS_PATH.read_text(encoding="utf-8"))

    for entry in corpus["valid"]:
        manifest.validate_semver(entry["version"])
        assert manifest.is_prerelease(entry["version"]) == entry["prerelease"], entry["version"]


def test_every_corpus_invalid_version_is_rejected() -> None:
    manifest = load_release_manifest()
    corpus = json.loads(_SEMVER_CORPUS_PATH.read_text(encoding="utf-8"))

    for version in corpus["invalid"]:
        with pytest.raises(manifest.ReleaseError):
            manifest.validate_semver(version)
