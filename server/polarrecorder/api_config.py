"""Module: API Config - Runtime configuration settings API handlers.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.api_handlers, polarrecorder.config, polarrecorder.params
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, cast

from polarrecorder import api_handlers
from polarrecorder.config import parse_config_values
from polarrecorder.params import CONFIG_PARAMETERS

if TYPE_CHECKING:
    from collections.abc import Mapping


@dataclass(frozen=True)
class AdvancedField:
    """One user-facing advanced setting."""

    name: str
    label: str
    description: str
    step: str


@dataclass(frozen=True)
class AdvancedGroup:
    """One Settings-tab group of advanced settings."""

    label: str
    description: str
    fields: tuple[AdvancedField, ...]


ADVANCED_GROUPS = (
    AdvancedGroup(
        "Sampling and Persistence",
        "Runtime cadence controls for reading instruments and writing learned data.",
        (
            AdvancedField(
                "sample_interval",
                "Sample interval",
                "Seconds between store reads after NMEA queue wakeups.",
                "0.1",
            ),
            AdvancedField(
                "flush_interval",
                "Flush interval",
                "Seconds between periodic polar.json writes.",
                "1",
            ),
            AdvancedField(
                "debug_logging",
                "Debug logging",
                "Writes one diagnostic log line per sampling iteration.",
                "",
            ),
        ),
    ),
    AdvancedGroup(
        "Sensor Freshness",
        "How closely the core wind and boat-speed readings must line up in time.",
        (
            AdvancedField(
                "stale_threshold",
                "Maximum value age",
                "Rejects a sample when any core instrument value is older than this many seconds.",
                "0.1",
            ),
            AdvancedField(
                "age_skew_threshold",
                "Maximum timestamp skew",
                "Rejects a sample when true wind angle, true wind speed, "
                "and boat speed are too far apart in time.",
                "0.1",
            ),
        ),
    ),
    AdvancedGroup(
        "Core Filters",
        "Basic sailing-condition filters that keep impossible or unhelpful samples out.",
        (
            AdvancedField(
                "low_wind_threshold",
                "Minimum true wind",
                "Rejects very light-air samples below this true-wind speed.",
                "0.1",
            ),
            AdvancedField(
                "head_to_wind_threshold",
                "Head-to-wind exclusion",
                "Rejects samples inside this many degrees of the bow.",
                "1",
            ),
            AdvancedField(
                "anchored_stw_threshold",
                "Anchored boat-speed floor",
                "Rejects near-zero through-water speed when wind is present.",
                "0.1",
            ),
            AdvancedField(
                "max_tws",
                "Maximum true wind",
                "Rejects true wind speeds above this plausible wind-speed ceiling.",
                "1",
            ),
            AdvancedField(
                "max_stw",
                "Maximum boat speed",
                "Rejects through-water speeds above this plausible boat-speed ceiling.",
                "1",
            ),
        ),
    ),
    AdvancedGroup(
        "Stability and Maneuvers",
        "Transient filters that wait for steady sailing after turns, gusts, or sensor spikes.",
        (
            AdvancedField(
                "twa_roc_threshold",
                "Wind-angle change rate",
                "Detects a maneuver when true wind angle changes faster than "
                "this many degrees per second.",
                "0.1",
            ),
            AdvancedField(
                "tws_roc_threshold",
                "Wind-speed change rate",
                "Rejects sudden true-wind speed jumps above this many knots per second.",
                "0.1",
            ),
            AdvancedField(
                "stw_roc_threshold",
                "Boat-speed change rate",
                "Rejects sudden boat-speed changes above this many knots per second.",
                "0.1",
            ),
            AdvancedField(
                "cooldown_seconds",
                "Maneuver cooldown",
                "Keeps rejecting samples for this many seconds after a detected turn.",
                "1",
            ),
            AdvancedField(
                "stability_window_seconds",
                "Stable sailing window",
                "Requires this many seconds of prior stable readings before learning a sample.",
                "1",
            ),
            AdvancedField(
                "stability_twa_range",
                "Stable wind-angle range",
                "Rejects the sample when prior true wind angle varied by "
                "this many degrees or more.",
                "0.1",
            ),
            AdvancedField(
                "stability_tws_range",
                "Stable wind-speed range",
                "Rejects the sample when prior true wind speed varied by this many knots or more.",
                "0.1",
            ),
            AdvancedField(
                "stability_stw_range",
                "Stable boat-speed range",
                "Rejects the sample when prior boat speed varied by this many knots or more.",
                "0.1",
            ),
        ),
    ),
    AdvancedGroup(
        "Engine Heuristic",
        "Low-wind movement checks used when no definitive engine signal is configured.",
        (
            AdvancedField(
                "engine_tws_ceil",
                "Low-wind engine ceiling",
                "Quarantines samples below this true-wind speed when the boat is moving quickly.",
                "0.1",
            ),
            AdvancedField(
                "engine_stw_floor",
                "Moving-under-engine floor",
                "Quarantines low-wind samples when boat speed is above this threshold.",
                "0.1",
            ),
        ),
    ),
)
ADVANCED_PARAM_NAMES = frozenset(field.name for group in ADVANCED_GROUPS for field in group.fields)
_PARAM_SPECS = {str(spec["name"]): spec for spec in CONFIG_PARAMETERS}


def advanced_settings(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    """Return the grouped advanced settings shown in the viewer."""
    with plugin._lock:
        config = plugin.config
    return api_handlers.ok({"groups": [_format_group(group, config) for group in ADVANCED_GROUPS]})


def advanced_save(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    """Persist safe advanced settings, self-applying before saving to AvNav config."""
    unknown = sorted(name for name in args if name not in ADVANCED_PARAM_NAMES)
    if unknown:
        return api_handlers.error(f"Unknown advanced parameter(s): {', '.join(unknown)}")
    updates = {name: value for name, value in args.items() if name in ADVANCED_PARAM_NAMES}
    if not updates:
        return api_handlers.error("No advanced parameters supplied")
    validation_error = _first_validation_error(updates)
    if validation_error:
        return api_handlers.error(validation_error)
    with plugin._lock:
        new_config = parse_config_values(updates, plugin._logger, plugin.config)
        plugin.config = new_config
        plugin._state.stability_window_seconds = float(new_config.stability_window_seconds)
    plugin.api.saveConfigValues(dict(updates))
    saved = {name: getattr(new_config, name) for name in sorted(updates)}
    return api_handlers.ok({"config": saved})


def _format_group(group: AdvancedGroup, config: Any) -> dict[str, object]:
    return {
        "label": group.label,
        "description": group.description,
        "fields": [_format_field(field, config) for field in group.fields],
    }


def _format_field(field: AdvancedField, config: Any) -> dict[str, object]:
    spec = _PARAM_SPECS[field.name]
    value_type = cast("str", spec["type"])
    data: dict[str, object] = {
        "field": field.name,
        "label": field.label,
        "description": field.description,
        "type": value_type,
        "value": getattr(config, field.name),
    }
    if value_type != "BOOLEAN":
        lower, upper = _bounds(spec)
        data["min"] = lower
        data["max"] = upper
        data["step"] = field.step
    return data


def _bounds(spec: Mapping[str, object]) -> tuple[int | float, int | float]:
    bounds = cast("list[int | float]", spec["rangeOrList"])
    return bounds[0], bounds[1]


def _first_validation_error(updates: Mapping[str, str]) -> str:
    for name, raw_value in updates.items():
        error = _validation_error(name, raw_value)
        if error:
            return error
    return ""


def _validation_error(name: str, raw_value: str) -> str:
    spec = _PARAM_SPECS[name]
    value_type = cast("str", spec["type"])
    if value_type == "BOOLEAN":
        return _boolean_validation_error(name, raw_value)
    lower, upper = _bounds(spec)
    try:
        value = _parse_numeric(value_type, raw_value)
    except ValueError:
        return f"Invalid advanced parameter '{name}': expected {value_type.lower()}"
    if value < lower or value > upper:
        return f"Invalid advanced parameter '{name}': expected {lower}..{upper}"
    return ""


def _boolean_validation_error(name: str, raw_value: str) -> str:
    if raw_value.strip().lower() in {"true", "false"}:
        return ""
    return f"Invalid advanced parameter '{name}': expected boolean"


def _parse_numeric(value_type: str, raw_value: str) -> int | float:
    if value_type == "NUMBER":
        return int(raw_value)
    value = float(raw_value)
    if not math.isfinite(value):
        msg = "non-finite advanced parameter"
        raise ValueError(msg)
    return value
