from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from conftest import FakeAvNavAPI, RequestHandlerReturn

import plugin as plugin_module


class PartialAvNavAPI:
    def __init__(self) -> None:
        self.config: dict[str, str] = {}
        self.editable_parameters: list[dict[str, Any]] = []
        self.change_callback: Callable[[dict[str, str]], None] | None = None
        self.request_handler: (
            Callable[[str, Any, dict[str, list[str]]], RequestHandlerReturn] | None
        ) = None
        self.restart_callback: Callable[[], None] | None = None
        self.user_apps: list[tuple[str, str, str | None]] = []

    def getConfigValue(self, key: str, default: str | None = None) -> str | None:
        return self.config.get(key, default)

    def registerEditableParameters(
        self,
        paramList: list[dict[str, Any]],
        changeCallback: Callable[[dict[str, str]], None],
    ) -> None:
        self.editable_parameters = paramList
        self.change_callback = changeCallback

    def registerRequestHandler(
        self,
        callback: Callable[[str, Any, dict[str, list[str]]], RequestHandlerReturn],
    ) -> None:
        self.request_handler = callback

    def registerRestart(self, stopCallback: Callable[[], None]) -> None:
        self.restart_callback = stopCallback

    def setStatus(self, value: str, info: str) -> None:
        del value, info

    def error(self, format: str, *param: object) -> None:  # noqa: A002
        del format, param


class PartialAvNavAPIWithUserApp(PartialAvNavAPI):
    def __init__(self) -> None:
        super().__init__()
        self.user_apps: list[tuple[str, str, str | None]] = []

    def registerUserApp(
        self,
        url: str,
        iconFile: str,
        title: str | None = None,
        preventConnectionLost: bool = False,
    ) -> str:
        del preventConnectionLost
        self.user_apps.append((url, iconFile, title))
        return "partial-user-app-id"


def test_plugin_json_does_not_declare_duplicate_user_apps() -> None:
    data = json.loads(Path("plugin.json").read_text(encoding="utf-8"))

    assert isinstance(data, dict)
    assert "userApps" not in data


def test_python_registers_user_app_with_full_api(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    plugin = _make_plugin(tmp_path, api)

    plugin._register_user_app()
    plugin._register_user_app()

    assert api.user_apps == [
        (
            "/plugins/user-polarrecorder/viewer/viewer.html",
            "viewer/icon.svg",
            "Polar Recorder",
        )
    ]


def test_python_skips_user_app_when_register_method_is_missing(tmp_path: Path) -> None:
    api = PartialAvNavAPI()
    plugin = _make_plugin(tmp_path, api)

    plugin._register_user_app()

    assert plugin._user_app_registered is False


def test_python_skips_user_app_when_base_url_method_is_missing(tmp_path: Path) -> None:
    api = PartialAvNavAPIWithUserApp()
    plugin = _make_plugin(tmp_path, api)

    plugin._register_user_app()

    assert plugin._user_app_registered is False
    assert api.user_apps == []


def _make_plugin(tmp_path: Path, api: object) -> plugin_module.Plugin:
    plugin = plugin_module.Plugin(api)
    plugin._data_dir = str(tmp_path)
    plugin._load_persistence()
    return plugin
