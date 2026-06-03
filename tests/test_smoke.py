from __future__ import annotations

import importlib.util
from pathlib import Path

import polarrecorder
from conftest import FakeAvNavAPI

from plugin import Plugin


def test_import_package_and_instantiate_plugin() -> None:
    api = FakeAvNavAPI()
    plugin = Plugin(api)

    assert polarrecorder.__version__ == "0.0.0-dev"
    assert plugin.api is api
    assert Plugin.pluginInfo()["version"] == "0.0.0-dev"
    api.stop_main_thread = True
    plugin.run()


def test_plugin_loads_with_avnav_import_pattern() -> None:
    spec = importlib.util.spec_from_file_location(
        "user-polarrecorder",
        Path(__file__).parents[1] / "plugin.py",
    )

    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.Plugin.pluginInfo()["version"] == "0.0.0-dev"
