from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Protocol, cast

import pytest


class ReleaseManifestModule(Protocol):
    ReleaseError: type[ValueError]

    def plugin_json_data(self, root: Path = Path()) -> dict[str, object]: ...

    def expected_runtime_files(self) -> list[tuple[str, Path]]: ...


def load_release_manifest() -> ReleaseManifestModule:
    module_path = Path(__file__).resolve().parents[1] / "tools" / "release_manifest.py"
    spec = importlib.util.spec_from_file_location("release_manifest", module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
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
