from __future__ import annotations

from dataclasses import fields
from typing import cast

import polarrecorder.logger as logger_module
from conftest import FakeLogger
from polarrecorder.config import Config, default_config, parse_config_values
from polarrecorder.params import CONFIG_PARAMETERS, EDITABLE_PARAMETERS


def test_logger_module_smoke_import_for_coverage() -> None:
    assert hasattr(logger_module, "Logger")


def test_default_config_matches_phase_3_defaults() -> None:
    config = default_config()

    assert config.sample_interval == 1.0
    assert config.percentile == 65
    assert config.flush_interval == 300
    assert config.max_tws == 60
    assert config.debug_logging is False


def test_parse_config_values_uses_avnav_string_conventions() -> None:
    config = parse_config_values(
        {
            "debug_logging": "true",
            "percentile": "75",
            "sample_interval": "2.5",
        }
    )

    assert config.debug_logging is True
    assert config.percentile == 75
    assert config.sample_interval == 2.5


def test_parse_config_values_clamps_numeric_ranges_from_params() -> None:
    logger = FakeLogger()
    below: dict[str, str] = {}
    above: dict[str, str] = {}
    numeric_specs = [spec for spec in CONFIG_PARAMETERS if spec["type"] in {"NUMBER", "FLOAT"}]

    for spec in numeric_specs:
        name = str(spec["name"])
        lower, upper = cast("list[int | float]", spec["rangeOrList"])
        if spec["type"] == "NUMBER":
            below[name] = str(int(lower) - 100)
            above[name] = str(int(upper) + 100)
        else:
            below[name] = str(float(lower) - 100.0)
            above[name] = str(float(upper) + 100.0)

    below_config = parse_config_values(below, logger)
    above_config = parse_config_values(above, logger)

    for spec in numeric_specs:
        name = str(spec["name"])
        lower, upper = cast("list[int | float]", spec["rangeOrList"])
        assert getattr(below_config, name) == lower
        assert getattr(above_config, name) == upper
    assert any(level == "debug" for level, _ in logger.messages)


def test_invalid_number_with_previous_keeps_previous_value_and_warns() -> None:
    previous = parse_config_values({"percentile": "72"})
    logger = FakeLogger()

    config = parse_config_values({"percentile": "abc"}, logger, previous)

    assert config.percentile == 72
    assert logger.messages == [
        ("warn", "Invalid config percentile='abc'; keeping previous/default value")
    ]


def test_invalid_float_with_previous_keeps_previous_value_and_warns() -> None:
    previous = parse_config_values({"sample_interval": "2.5"})
    logger = FakeLogger()

    config = parse_config_values({"sample_interval": "bad"}, logger, previous)

    assert config.sample_interval == 2.5
    assert logger.messages == [
        ("warn", "Invalid config sample_interval='bad'; keeping previous/default value")
    ]


def test_partial_values_with_previous_update_only_supplied_fields() -> None:
    previous = parse_config_values(
        {
            "percentile": "72",
            "sample_interval": "2.5",
            "debug_logging": "true",
        }
    )

    config = parse_config_values({"percentile": "55"}, previous=previous)

    assert config.percentile == 55
    assert config.sample_interval == 2.5
    assert config.debug_logging is True


def test_invalid_values_without_previous_fall_back_to_defaults_and_warn() -> None:
    logger = FakeLogger()

    config = parse_config_values(
        {
            "percentile": "abc",
            "sample_interval": "bad",
        },
        logger,
    )

    assert config.percentile == default_config().percentile
    assert config.sample_interval == default_config().sample_interval
    assert logger.messages == [
        ("warn", "Invalid config sample_interval='bad'; keeping previous/default value"),
        ("warn", "Invalid config percentile='abc'; keeping previous/default value"),
    ]


def test_config_parameters_are_consistent_with_config_fields() -> None:
    config_field_names = {field.name for field in fields(Config)}

    for spec in CONFIG_PARAMETERS:
        name = str(spec["name"])
        value_type = spec["type"]
        parsed_value = getattr(parse_config_values({name: str(spec["default"])}), name)

        assert name in config_field_names
        if value_type == "BOOLEAN":
            assert isinstance(parsed_value, bool)
            assert "rangeOrList" not in spec
        elif value_type == "NUMBER":
            assert isinstance(parsed_value, int)
            assert not isinstance(parsed_value, bool)
            assert "rangeOrList" in spec
        elif value_type == "FLOAT":
            assert isinstance(parsed_value, float)
            assert "rangeOrList" in spec
        elif value_type == "STRING":
            assert isinstance(parsed_value, str)
            assert "rangeOrList" not in spec


def test_no_runtime_settings_are_registered_as_avnav_editable_parameters() -> None:
    assert EDITABLE_PARAMETERS == []


def test_enhanced_defaults_match_documented_values() -> None:
    config = default_config()

    assert config.enh_rpm_enabled is True
    assert config.enh_rpm_key == ""
    assert config.enh_rpm_idle_max == 900
    assert config.enh_engine_state_on_threshold == 0.5
    assert config.enh_depth_key == "gps.depthBelowKeel"
    assert config.enh_depth_floor_m == 1.0
    assert config.enh_sog_key == "gps.speed"
    assert config.enh_current_drift_key == "gps.currentDrift"
    assert config.enh_slip_ratio == 0.5
    assert config.enh_awa_key == "gps.windAngle"
    assert config.enh_aws_key == "gps.windSpeed"
    assert config.enh_heel_min_deg == 0.0
    assert config.enh_heel_max_deg == 35.0
    assert config.enh_heading_key == "gps.headingTrue"
    assert config.enh_cog_key == "gps.track"
    assert config.enh_turn_min_roc == 3.0


def test_enhanced_string_keys_pass_through_unchanged() -> None:
    config = parse_config_values(
        {
            "enh_rpm_key": "n2k.engine.0.rpm",
            "enh_heel_key": "signalk.navigation.attitude.roll",
            "enh_depth_key": "",
        }
    )

    assert config.enh_rpm_key == "n2k.engine.0.rpm"
    assert config.enh_heel_key == "signalk.navigation.attitude.roll"
    assert config.enh_depth_key == ""


def test_enhanced_numeric_invalid_keeps_previous_or_default() -> None:
    previous = parse_config_values({"enh_rpm_idle_max": "1200"})
    logger = FakeLogger()

    config = parse_config_values({"enh_rpm_idle_max": "bad"}, logger, previous)

    assert config.enh_rpm_idle_max == 1200
    assert logger.messages == [
        ("warn", "Invalid config enh_rpm_idle_max='bad'; keeping previous/default value")
    ]
