from __future__ import annotations

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
