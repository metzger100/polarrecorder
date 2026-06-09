"""Module: Config - Runtime configuration parsing.

Documentation: documentation/user/configuration.md
Depends: polarrecorder.logger, polarrecorder.params
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, cast

from polarrecorder.params import CONFIG_PARAMETERS

if TYPE_CHECKING:
    from collections.abc import Mapping

    from polarrecorder.logger import Logger


@dataclass(frozen=True)
class Config:
    """Parsed runtime configuration."""

    sample_interval: float = 1.0
    percentile: int = 65
    flush_interval: int = 300
    stale_threshold: float = 3.0
    age_skew_threshold: float = 2.0
    max_tws: int = 60
    max_stw: int = 40
    low_wind_threshold: float = 3.0
    head_to_wind_threshold: int = 10
    anchored_stw_threshold: float = 0.3
    twa_roc_threshold: float = 15.0
    tws_roc_threshold: float = 10.0
    stw_roc_threshold: float = 2.0
    cooldown_seconds: int = 30
    stability_window_seconds: int = 15
    stability_twa_range: float = 20.0
    stability_tws_range: float = 10.0
    stability_stw_range: float = 4.0
    engine_tws_ceil: float = 5.0
    engine_stw_floor: float = 3.0
    min_samples_for_export: int = 10
    debug_logging: bool = False
    enh_rpm_enabled: bool = True
    enh_rpm_key: str = ""
    enh_rpm_idle_max: int = 900
    enh_engine_state_enabled: bool = True
    enh_engine_state_key: str = ""
    enh_engine_state_on_threshold: float = 0.5
    enh_depth_enabled: bool = True
    enh_depth_key: str = "gps.depthBelowKeel"
    enh_depth_floor_m: float = 1.0
    enh_slip_enabled: bool = True
    enh_sog_key: str = "gps.speed"
    enh_current_drift_key: str = "gps.currentDrift"
    enh_slip_sog_floor_kt: float = 1.0
    enh_slip_ratio: float = 0.5
    enh_tw_crosscheck_enabled: bool = True
    enh_awa_key: str = "gps.windAngle"
    enh_aws_key: str = "gps.windSpeed"
    enh_tw_twa_tol_deg: float = 15.0
    enh_tw_tws_tol_kt: float = 3.0
    enh_heel_enabled: bool = True
    enh_heel_key: str = ""
    enh_heel_min_deg: float = 0.0
    enh_heel_max_deg: float = 35.0
    enh_turnconfirm_enabled: bool = True
    enh_heading_key: str = "gps.headingTrue"
    enh_cog_key: str = "gps.track"
    enh_turn_min_roc: float = 3.0


def parse_config_values(
    values: Mapping[str, str],
    logger: Logger | None = None,
    previous: Config | None = None,
) -> Config:
    """Parse AvNav string values into a runtime config.

    Args:
        values: Raw string values keyed by editable parameter name.
        logger: Optional logger for clamp and parse-failure diagnostics.
        previous: Existing config to preserve for missing or invalid values.

    Returns:
        Parsed and range-clamped configuration.
    """
    parsed: dict[str, Any] = {}
    for spec in CONFIG_PARAMETERS:
        name = _spec_string(spec, "name")
        if name in values:
            parsed[name] = _parse_supplied_value(spec, values[name], logger, previous)
        elif previous is not None:
            parsed[name] = getattr(previous, name)
        else:
            parsed[name] = _parse_spec_value(spec, _spec_string(spec, "default"), logger)
    return Config(**parsed)


def default_config() -> Config:
    """Return the config produced by editable parameter defaults."""
    return parse_config_values({})


def _parse_spec_value(
    spec: Mapping[str, object],
    raw_value: str,
    logger: Logger | None,
) -> object:
    value_type = _spec_string(spec, "type")
    if value_type == "BOOLEAN":
        return raw_value.strip().upper() == "TRUE"
    if value_type == "NUMBER":
        return int(_clamp(float(int(raw_value)), spec, logger))
    if value_type == "FLOAT":
        return _clamp(float(raw_value), spec, logger)
    return raw_value


def _parse_supplied_value(
    spec: Mapping[str, object],
    raw_value: str,
    logger: Logger | None,
    previous: Config | None,
) -> object:
    try:
        return _parse_spec_value(spec, raw_value, logger)
    except (AttributeError, TypeError, ValueError):
        name = _spec_string(spec, "name")
        if logger is not None:
            message = f"Invalid config {name}={raw_value!r}; keeping previous/default value"
            logger.warning(message)
        if previous is not None:
            return getattr(previous, name)
        return _parse_spec_value(spec, _spec_string(spec, "default"), logger)


def _clamp(value: float, spec: Mapping[str, object], logger: Logger | None) -> float:
    bounds = cast("list[int | float]", spec["rangeOrList"])
    lower = float(bounds[0])
    upper = float(bounds[1])
    clamped = min(max(value, lower), upper)
    if clamped != value and logger is not None:
        message = f"Clamped config {spec['name']} from {value} to {clamped}"
        logger.debug(message)
    return clamped


def _spec_string(spec: Mapping[str, object], key: str) -> str:
    return cast("str", spec[key])
