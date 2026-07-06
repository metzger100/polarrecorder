from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Protocol, cast

import pytest


class ReleaseManifestModule(Protocol):
    ReleaseError: type[ValueError]

    def validate_plugin_json_user_apps(self, root: Path = Path()) -> None: ...


def load_release_manifest() -> ReleaseManifestModule:
    module_path = Path(__file__).resolve().parents[1] / "tools" / "release_manifest.py"
    spec = importlib.util.spec_from_file_location("release_manifest", module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return cast("ReleaseManifestModule", module)


def write_plugin_json(root: Path, user_apps: list[dict[str, object]]) -> None:
    payload = {"userApps": user_apps}
    (root / "plugin.json").write_text(json.dumps(payload), encoding="utf-8")


def valid_user_app() -> dict[str, object]:
    return {
        "url": "viewer/viewer.html",
        "iconFile": "viewer/icon.svg",
        "title": "Polar Recorder",
        "name": "polarrecorder",
        "page": "addonpage",
        "shortText": "Polar",
        "longText": "Polar Recorder",
    }


def test_validate_plugin_json_user_apps_accepts_selector_metadata(tmp_path: Path) -> None:
    manifest = load_release_manifest()
    write_plugin_json(tmp_path, [valid_user_app()])

    manifest.validate_plugin_json_user_apps(tmp_path)


def test_validate_plugin_json_user_apps_rejects_missing_selector_metadata(
    tmp_path: Path,
) -> None:
    manifest = load_release_manifest()
    app = valid_user_app()
    del app["shortText"]
    write_plugin_json(tmp_path, [app])

    with pytest.raises(manifest.ReleaseError, match="shortText"):
        manifest.validate_plugin_json_user_apps(tmp_path)
