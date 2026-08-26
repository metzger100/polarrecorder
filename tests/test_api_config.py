from __future__ import annotations

import threading
from typing import cast

from conftest import FakeAvNavAPI
from plugin_integration_support import response_data
from validation_helpers import make_warmed_state

import plugin as plugin_module


class FailingSaveAPI(FakeAvNavAPI):
    """Fake host whose persistent configuration write fails."""

    def saveConfigValues(self, configDict: dict[str, str]) -> None:
        """Raise instead of persisting the requested values."""
        message = "config storage unavailable"
        raise OSError(message)


class BlockingSaveAPI(FakeAvNavAPI):
    """Fake host that holds one configuration write in flight."""

    def __init__(self) -> None:
        super().__init__()
        self.save_started = threading.Event()
        self.allow_save = threading.Event()

    def saveConfigValues(self, configDict: dict[str, str]) -> None:
        """Block until the test permits the host write to complete."""
        self.save_started.set()
        assert self.allow_save.wait(timeout=2.0)
        self.saved_configs.append(configDict)


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
    assert plugin._config_save_active is False


def test_overlapping_config_save_is_rejected_without_runtime_persistence_drift() -> None:
    api = BlockingSaveAPI()
    plugin = plugin_module.Plugin(api)
    first_response: list[dict[str, object]] = []

    def save_first() -> None:
        first_response.append(
            plugin._handle_request("advanced/save", object(), {"low_wind_threshold": ["4.0"]})
        )

    thread = threading.Thread(target=save_first)
    thread.start()
    assert api.save_started.wait(timeout=2.0)
    overlapping = plugin._handle_request("advanced/save", object(), {"low_wind_threshold": ["5.0"]})
    api.allow_save.set()
    thread.join(timeout=2.0)

    assert not thread.is_alive()
    assert first_response[0]["status"] == "OK"
    assert overlapping == {
        "status": "ERROR",
        "error": "Configuration save already in progress",
    }
    assert api.saved_configs == [{"low_wind_threshold": "4.0"}]
    assert plugin.config.low_wind_threshold == 4.0
    assert plugin._config_save_active is False


def test_config_save_rejects_invalid_cross_field_relationships() -> None:
    api = FakeAvNavAPI()
    plugin = plugin_module.Plugin(api)

    heel = plugin._handle_request("enhanced/save", object(), {"enh_heel_min_deg": ["40"]})
    cooldown = plugin._handle_request(
        "advanced/save", object(), {"stability_window_seconds": ["40"]}
    )

    assert heel["status"] == "ERROR"
    assert cooldown["status"] == "ERROR"
    assert api.saved_configs == []
    assert plugin.config.enh_heel_min_deg == 0.0
    assert plugin.config.stability_window_seconds == 15


def test_source_changes_reset_only_dependent_validation_history() -> None:
    plugin = plugin_module.Plugin(FakeAvNavAPI())
    plugin._state = make_warmed_state()
    plugin._state.cooldown_expires = 120.0

    core = plugin._handle_request("advanced/save", object(), {"twa_key": ["custom.twa"]})

    assert core["status"] == "OK"
    assert not plugin._state.window
    assert plugin._state.previous_sample is None
    assert plugin._state.cooldown_expires == 0.0

    plugin._state = make_warmed_state()
    window_before = tuple(plugin._state.window)
    heading = plugin._handle_request(
        "enhanced/save", object(), {"enh_heading_key": ["custom.heading"]}
    )

    assert heading["status"] == "OK"
    assert tuple(plugin._state.window) == window_before
    assert plugin._state.previous_sample is None


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
