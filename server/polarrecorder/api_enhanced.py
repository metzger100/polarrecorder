"""Module: API Enhanced - Enhanced-rule API handlers (keys, status, save).

Documentation: documentation/architecture/api.md
Depends: polarrecorder.api_config, polarrecorder.api_handlers, polarrecorder.enhanced_input,
polarrecorder.enhanced_status, polarrecorder.params,
polarrecorder.sample, polarrecorder.source_params
"""

from __future__ import annotations

from typing import Any

from polarrecorder import api_config, api_handlers, enhanced_status
from polarrecorder.enhanced_input import EnhancedInput, assess_enhanced_input
from polarrecorder.enhanced_status import ENHANCED_RULE_SPECS
from polarrecorder.params import CONFIG_PARAMETERS
from polarrecorder.sample import ENHANCED_SIGNAL_BY_ROLE
from polarrecorder.source_params import CORE_KEY_FIELDS

ENHANCED_PARAM_NAMES = frozenset(
    str(spec["name"]) for spec in CONFIG_PARAMETERS if str(spec["name"]).startswith("enh_")
)
ENHANCED_STRING_PARAM_NAMES = frozenset(
    str(spec["name"])
    for spec in CONFIG_PARAMETERS
    if str(spec["name"]).startswith("enh_") and spec["type"] == "STRING"
)


def enhanced_keys(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    """Return currently-present store keys for the enhanced key pickers."""
    with plugin._lock:
        config = plugin.config
    keys: set[str] = set()
    for prefix in _key_prefixes(config):
        _flatten_keys(prefix, plugin._store_data_by_prefix(prefix), keys)
    return api_handlers.format_enhanced_keys(sorted(keys))


def enhanced_status_view(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    """Return the live status of every enhanced rule."""
    with plugin._lock:
        config = plugin.config
        now = plugin._clock()
        stale_threshold = config.stale_threshold
    probes = _probe_keys(plugin, config, now, stale_threshold)
    rows = enhanced_status.compute_enhanced_status(config, probes)
    return api_handlers.format_enhanced_status(rows)


def enhanced_save(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    """Validate and persist enhanced settings before installing them."""
    unknown = sorted(name for name in args if name not in ENHANCED_PARAM_NAMES)
    if unknown:
        return api_handlers.error(f"Unknown enhanced parameter(s): {', '.join(unknown)}")
    updates = {name: value for name, value in args.items() if name in ENHANCED_PARAM_NAMES}
    if not updates:
        return api_handlers.error("No enhanced parameters supplied")
    validation_error = api_config.first_validation_error(
        updates,
        allow_empty_strings=ENHANCED_STRING_PARAM_NAMES,
    )
    if validation_error:
        return api_handlers.error(validation_error)
    new_config = api_config.apply_config_updates(plugin, updates)
    saved = {name: getattr(new_config, name) for name in sorted(updates)}
    return api_handlers.format_enhanced_config(saved)


def _key_prefixes(config: Any) -> list[str]:
    prefixes = {"gps"}
    for field in CORE_KEY_FIELDS:
        prefixes.add(str(getattr(config, field)).split(".", 1)[0])
    for spec in ENHANCED_RULE_SPECS:
        for role in spec.source_roles:
            signal = ENHANCED_SIGNAL_BY_ROLE[role]
            key = str(getattr(config, signal.key_field))
            if key:
                prefixes.add(key.split(".", 1)[0])
    return sorted(prefixes)


def _flatten_keys(prefix: str, data: object, out: set[str]) -> None:
    if isinstance(data, dict):
        for key, value in data.items():
            _flatten_keys(f"{prefix}.{key}", value, out)
    else:
        out.add(prefix)


def _probe_keys(
    plugin: Any,
    config: Any,
    now: float,
    stale_threshold: float,
) -> dict[str, EnhancedInput]:
    probes: dict[str, EnhancedInput] = {}
    for spec in ENHANCED_RULE_SPECS:
        for role in spec.source_roles:
            signal = ENHANCED_SIGNAL_BY_ROLE[role]
            key = str(getattr(config, signal.key_field))
            if key and role not in probes:
                probes[role] = _probe(
                    plugin,
                    key,
                    now,
                    stale_threshold,
                    accepts_bool=signal.accepts_bool,
                    minimum_value=signal.minimum_value,
                )
    return probes


def _probe(
    plugin: Any,
    key: str,
    now: float,
    stale_threshold: float,
    *,
    accepts_bool: bool,
    minimum_value: float | None,
) -> EnhancedInput:
    entry = plugin.get_single_value(key, include_info=True)
    return assess_enhanced_input(
        entry,
        now,
        stale_threshold,
        accepts_bool=accepts_bool,
        minimum_value=minimum_value,
    )
