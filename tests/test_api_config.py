from __future__ import annotations

from typing import cast

from conftest import FakeAvNavAPI
from plugin_integration_support import response_data

import plugin as plugin_module


class FailingSaveAPI(FakeAvNavAPI):
    """Fake host whose persistent configuration write fails."""

    def saveConfigValues(self, configDict: dict[str, str]) -> None:
        """Raise instead of persisting the requested values."""
        message = "config storage unavailable"
        raise OSError(message)


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
    fields = {
        cast("str", field["field"]): field
        for group in groups
        for field in cast("list[dict[str, object]]", group["fields"])
    }
    assert "fresh SOG" in cast("str", fields["anchored_stw_threshold"]["description"])
    for name in (
        "stability_twa_range",
        "stability_tws_range",
        "stability_stw_range",
    ):
        assert "current sample" in cast("str", fields[name]["description"])
    assert unknown["status"] == "ERROR"
    assert invalid["status"] == "ERROR"
    assert out_of_range["status"] == "ERROR"
    assert invalid_bool["status"] == "ERROR"
    assert plugin.config.debug_logging is True
    assert plugin.config.low_wind_threshold == 4.2
    assert plugin.config.max_tws == 48
    assert plugin.config.sample_interval == 2.5
    assert plugin.config.stability_window_seconds == 30
    assert not hasattr(plugin._state, "stability_window_seconds")
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


def test_advanced_save_persists_nonempty_core_source_keys() -> None:
    api = FakeAvNavAPI()
    plugin = plugin_module.Plugin(api)

    blank = plugin._handle_request("advanced/save", object(), {"twa_key": [""]})
    saved = response_data(
        plugin._handle_request(
            "advanced/save",
            object(),
            {
                "twa_key": ["custom.twa"],
                "tws_key": ["custom.tws"],
                "stw_key": ["custom.stw"],
            },
        )
    )

    assert blank["status"] == "ERROR"
    assert plugin.config.twa_key == "custom.twa"
    assert plugin.config.tws_key == "custom.tws"
    assert plugin.config.stw_key == "custom.stw"
    assert api.saved_configs == [
        {"twa_key": "custom.twa", "tws_key": "custom.tws", "stw_key": "custom.stw"}
    ]
    assert cast("dict[str, object]", saved["config"]) == {
        "stw_key": "custom.stw",
        "twa_key": "custom.twa",
        "tws_key": "custom.tws",
    }


def test_failed_config_persistence_leaves_runtime_config_unchanged() -> None:
    api = FailingSaveAPI()
    plugin = plugin_module.Plugin(api)
    previous = plugin.config

    response = plugin._handle_request(
        "advanced/save",
        object(),
        {"low_wind_threshold": ["4.2"]},
    )

    assert response["status"] == "ERROR"
    assert plugin.config is previous
    assert plugin.config.low_wind_threshold == 3.0
    assert api.saved_configs == []


def test_enhanced_save_rejects_invalid_values_without_side_effects() -> None:
    api = FakeAvNavAPI()
    plugin = plugin_module.Plugin(api)

    invalid_numeric = plugin._handle_request("enhanced/save", object(), {"enh_slip_ratio": ["nan"]})
    invalid_boolean = plugin._handle_request(
        "enhanced/save", object(), {"enh_rpm_enabled": ["maybe"]}
    )

    assert invalid_numeric["status"] == "ERROR"
    assert invalid_boolean["status"] == "ERROR"
    assert plugin.config.enh_slip_ratio == 0.5
    assert plugin.config.enh_rpm_enabled is True
    assert api.saved_configs == []
