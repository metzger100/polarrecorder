from __future__ import annotations

from dataclasses import fields
from typing import cast

import polarrecorder.logger as logger_module
from conftest import FakeLogger
from polarrecorder.config import Config, default_config, parse_config_values
from polarrecorder.params import EDITABLE_PARAMETERS


def test_logger_module_smoke_import_for_coverage() -> None:
    assert hasattr(logger_module, "Logger")


def test_default_config_matches_phase_3_defaults() -> None:
    config = default_config()

    assert config.record_enabled is True
    assert config.sample_interval == 1.0
    assert config.percentile == 65
    assert config.flush_interval == 300
    assert config.max_tws == 60
    assert config.debug_logging is False


def test_parse_config_values_uses_avnav_string_conventions() -> None:
    config = parse_config_values(
        {
            "record_enabled": "FALSE",
            "debug_logging": "true",
            "percentile": "75",
            "sample_interval": "2.5",
        }
    )

    assert config.record_enabled is False
    assert config.debug_logging is True
    assert config.percentile == 75
    assert config.sample_interval == 2.5


def test_parse_config_values_clamps_numeric_ranges_from_params() -> None:
    logger = FakeLogger()
    below: dict[str, str] = {}
    above: dict[str, str] = {}
    numeric_specs = [spec for spec in EDITABLE_PARAMETERS if spec["type"] in {"NUMBER", "FLOAT"}]

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
            "record_enabled": "false",
        }
    )

    config = parse_config_values({"percentile": "55"}, previous=previous)

    assert config.percentile == 55
    assert config.sample_interval == 2.5
    assert config.record_enabled is False


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


def test_editable_parameters_are_consistent_with_config_fields() -> None:
    config_field_names = {field.name for field in fields(Config)}

    for spec in EDITABLE_PARAMETERS:
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
