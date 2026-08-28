"""Module: API Config - Runtime configuration settings API handlers.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.api_handlers, polarrecorder.config, polarrecorder.params,
polarrecorder.source_params
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, cast

from polarrecorder import api_handlers
from polarrecorder.config import (
    SOURCE_KEY_FIELDS,
    Config,
    first_config_relation_error,
    parse_config_values,
)
from polarrecorder.params import CONFIG_PARAMETERS
from polarrecorder.source_params import CORE_KEY_FIELDS

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
                "Writes one decision diagnostic per completed store read.",
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
                "Rejects near-zero SOG when fresh SOG is available; otherwise uses STW. "
                "Wind must be present.",
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
                "Requires a full stable window ending at the current sample before learning it.",
                "1",
            ),
            AdvancedField(
                "stability_twa_range",
                "Stable wind-angle range",
                "Rejects when true wind angle across the stability window, including the "
                "current sample, spans this many degrees or more.",
                "0.1",
            ),
            AdvancedField(
                "stability_tws_range",
                "Stable wind-speed range",
                "Rejects when true wind speed across the stability window, including the "
                "current sample, spans this many knots or more.",
                "0.1",
            ),
            AdvancedField(
                "stability_stw_range",
                "Stable boat-speed range",
                "Rejects when boat speed across the stability window, including the current "
                "sample, spans this many knots or more.",
                "0.1",
            ),
        ),
    ),
    AdvancedGroup(
        "Engine Heuristic",
        "Low-wind movement checks supplemented by the optional RPM rule.",
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
SOURCE_PARAM_NAMES = frozenset(CORE_KEY_FIELDS)
SAVABLE_PARAM_NAMES = ADVANCED_PARAM_NAMES | SOURCE_PARAM_NAMES
_PARAM_SPECS = {str(spec["name"]): spec for spec in CONFIG_PARAMETERS}
TURN_SOURCE_KEY_FIELDS = ("enh_heading_key", "enh_cog_key")


class ConfigUpdateError(ValueError):
    """Expected configuration transaction rejection."""


def advanced_settings(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    """Return the grouped advanced settings shown in the viewer."""
    with plugin._lock:
        config = plugin.config
    return api_handlers.ok({"groups": [_format_group(group, config) for group in ADVANCED_GROUPS]})


def advanced_save(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    """Validate and persist safe viewer settings before installing them."""
    unknown = sorted(name for name in args if name not in SAVABLE_PARAM_NAMES)
    validation_error = ""
    if unknown:
        validation_error = f"Unknown advanced parameter(s): {', '.join(unknown)}"
    updates = {name: value for name, value in args.items() if name in SAVABLE_PARAM_NAMES}
    if not validation_error and not updates:
        validation_error = "No advanced parameters supplied"
    if not validation_error:
        validation_error = first_validation_error(updates)
    if validation_error:
        return api_handlers.error(validation_error)
    try:
        new_config = apply_config_updates(plugin, updates)
    except ConfigUpdateError as exc:
        return api_handlers.error(str(exc))
    saved = {name: getattr(new_config, name) for name in sorted(updates)}
    return api_handlers.ok({"config": saved})


def apply_config_updates(plugin: Any, updates: dict[str, str]) -> Config:
    """Persist validated updates, then merge them into the live config.

    Persistence happens before runtime mutation so a host write failure leaves
    the active configuration unchanged. Only one host save may be in flight.
    """
    with plugin._lock:
        if plugin._config_save_active:
            message = "Configuration save already in progress"
            raise ConfigUpdateError(message)
        previous_config = plugin.config
        new_config = parse_config_values(updates, plugin._logger, previous_config)
        relation_error = first_config_relation_error(new_config)
        if relation_error:
            raise ConfigUpdateError(relation_error)
        persisted_updates = {
            name: str(getattr(new_config, name)) if name in SOURCE_KEY_FIELDS else raw_value
            for name, raw_value in updates.items()
        }
        plugin._config_save_active = True
    persisted = False
    try:
        plugin._save_config_values(persisted_updates)
        persisted = True
    finally:
        with plugin._lock:
            try:
                if persisted:
                    plugin.config = new_config
                    reset_validation_state_for_source_changes(
                        plugin._state, previous_config, new_config
                    )
            finally:
                plugin._config_save_active = False
    return new_config


def reset_validation_state_for_source_changes(
    state: Any, previous: Config, current: Config
) -> None:
    """Reset retained observations when their configured source identity changes."""
    if any(getattr(previous, field) != getattr(current, field) for field in CORE_KEY_FIELDS):
        state.reset_source_history()
        return
    if any(getattr(previous, field) != getattr(current, field) for field in TURN_SOURCE_KEY_FIELDS):
        state.reset_transition()


def apply_host_config_change(
    previous: Config, state: Any, changed: Mapping[str, str], logger: Any
) -> Config:
    """Parse one host callback update and reset source-dependent state."""
    candidate = parse_config_values(changed, logger, previous)
    relation_error = first_config_relation_error(candidate)
    if relation_error:
        message = f"configuration callback rejected: {relation_error}"
        logger.debug(message)
        return previous
    reset_validation_state_for_source_changes(state, previous, candidate)
    return candidate


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


def first_validation_error(
    updates: Mapping[str, str],
    *,
    allow_empty_strings: frozenset[str] = frozenset(),
) -> str:
    """Return the first invalid config update, or an empty string.

    Args:
        updates: Endpoint-allowlisted raw configuration strings.
        allow_empty_strings: String fields for which clearing the value is valid.

    Returns:
        A validation message, or an empty string when every update is valid.
    """
    for name, raw_value in updates.items():
        error = _validation_error(name, raw_value, name in allow_empty_strings)
        if error:
            return error
    return ""


def _validation_error(name: str, raw_value: str, allow_empty_string: bool) -> str:
    spec = _PARAM_SPECS[name]
    value_type = cast("str", spec["type"])
    if value_type == "BOOLEAN":
        return _boolean_validation_error(name, raw_value)
    if value_type == "STRING":
        return _string_validation_error(name, raw_value, allow_empty_string)
    return _numeric_validation_error(name, raw_value, value_type, spec)


def _numeric_validation_error(
    name: str,
    raw_value: str,
    value_type: str,
    spec: Mapping[str, object],
) -> str:
    lower, upper = _bounds(spec)
    try:
        value = _parse_numeric(value_type, raw_value)
    except ValueError:
        return f"Invalid parameter '{name}': expected {value_type.lower()}"
    if value < lower or value > upper:
        return f"Invalid parameter '{name}': expected {lower}..{upper}"
    return ""


def _boolean_validation_error(name: str, raw_value: str) -> str:
    if raw_value.strip().lower() in {"true", "false"}:
        return ""
    return f"Invalid parameter '{name}': expected boolean"


def _string_validation_error(name: str, raw_value: str, allow_empty: bool) -> str:
    if allow_empty or raw_value.strip():
        return ""
    return f"Invalid parameter '{name}': expected a store key"


def _parse_numeric(value_type: str, raw_value: str) -> int | float:
    if value_type == "NUMBER":
        return int(raw_value)
    value = float(raw_value)
    if not math.isfinite(value):
        msg = "non-finite advanced parameter"
        raise ValueError(msg)
    return value
