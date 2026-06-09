from __future__ import annotations

from typing import cast

from conftest import FakeAvNavAPI
from plugin_integration_support import response_data

import plugin as plugin_module


def test_advanced_settings_endpoint_groups_and_saves_safe_values() -> None:
    api = FakeAvNavAPI()
    plugin = plugin_module.Plugin(api)

    settings = response_data(plugin._handle_request("advanced/settings", object(), {}))
    groups = cast("list[dict[str, object]]", settings["groups"])
    group_labels = [cast("str", group["label"]) for group in groups]
    unknown = plugin._handle_request("advanced/save", object(), {"percentile": ["75"]})
    invalid = plugin._handle_request(
        "advanced/save",
        object(),
        {"low_wind_threshold": ["not-a-number"]},
    )
    out_of_range = plugin._handle_request(
        "advanced/save",
        object(),
        {"low_wind_threshold": ["99"]},
    )
    invalid_bool = plugin._handle_request(
        "advanced/save",
        object(),
        {"debug_logging": ["maybe"]},
    )
    saved = response_data(
        plugin._handle_request(
            "advanced/save",
            object(),
            {
                "debug_logging": ["true"],
                "low_wind_threshold": ["4.2"],
                "max_tws": ["48"],
                "sample_interval": ["2.5"],
                "stability_window_seconds": ["30"],
            },
        )
    )

    assert "Sampling and Persistence" in group_labels
    assert "Core Filters" in group_labels
    assert "Stability and Maneuvers" in group_labels
    assert unknown["status"] == "ERROR"
    assert invalid["status"] == "ERROR"
    assert out_of_range["status"] == "ERROR"
    assert invalid_bool["status"] == "ERROR"
    assert plugin.config.debug_logging is True
    assert plugin.config.low_wind_threshold == 4.2
    assert plugin.config.max_tws == 48
    assert plugin.config.sample_interval == 2.5
    assert plugin.config.stability_window_seconds == 30
    assert plugin._state.stability_window_seconds == 30.0
    assert api.saved_configs == [
        {
            "debug_logging": "true",
            "low_wind_threshold": "4.2",
            "max_tws": "48",
            "sample_interval": "2.5",
            "stability_window_seconds": "30",
        }
    ]
    assert cast("dict[str, object]", saved["config"])["debug_logging"] is True
    assert cast("dict[str, object]", saved["config"])["low_wind_threshold"] == 4.2
