from __future__ import annotations

from conftest import FakeAvNavAPI

import polarrecorder
from plugin import Plugin


def test_import_package_and_instantiate_plugin() -> None:
    api = FakeAvNavAPI()
    plugin = Plugin(api)

    assert polarrecorder.__version__ == "1.0.0"
    assert plugin.api is api
    assert Plugin.pluginInfo()["version"] == "1.0.0"
    api.stop_main_thread = True
    plugin.run()
