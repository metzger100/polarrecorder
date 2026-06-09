"""Module: API Enhanced - Enhanced-rule API handlers (keys, status, save).

Documentation: documentation/architecture/api.md
Depends: polarrecorder.api_handlers, polarrecorder.config, polarrecorder.enhanced_status,
polarrecorder.params
"""

from __future__ import annotations

from typing import Any

from polarrecorder import api_handlers, enhanced_status
from polarrecorder.config import parse_config_values
from polarrecorder.enhanced_status import ENHANCED_RULE_SPECS, KeyProbe
from polarrecorder.params import EDITABLE_PARAMETERS

ENHANCED_PARAM_NAMES = frozenset(
    str(spec["name"]) for spec in EDITABLE_PARAMETERS if str(spec["name"]).startswith("enh_")
)


def enhanced_keys(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    """Return currently-present store keys for the enhanced key pickers."""
    with plugin._lock:
        config = plugin.config
    keys: set[str] = set()
    for prefix in _key_prefixes(config):
        _flatten_keys(prefix, plugin.api.getDataByPrefix(prefix), keys)
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
    """Persist enhanced settings, self-applying under the lock before saving to disk."""
    unknown = sorted(name for name in args if name not in ENHANCED_PARAM_NAMES)
    if unknown:
        return api_handlers.error(f"Unknown enhanced parameter(s): {', '.join(unknown)}")
    updates = {name: value for name, value in args.items() if name in ENHANCED_PARAM_NAMES}
    if not updates:
        return api_handlers.error("No enhanced parameters supplied")
    with plugin._lock:
        new_config = parse_config_values(updates, plugin._logger, plugin.config)
        plugin.config = new_config
    plugin.api.saveConfigValues(dict(updates))
    saved = {name: getattr(new_config, name) for name in sorted(updates)}
    return api_handlers.format_enhanced_config(saved)


def _key_prefixes(config: Any) -> list[str]:
    prefixes = {"gps"}
    for spec in ENHANCED_RULE_SPECS:
        for field in spec.key_fields:
            key = str(getattr(config, field))
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
) -> dict[str, KeyProbe]:
    probes: dict[str, KeyProbe] = {}
    for spec in ENHANCED_RULE_SPECS:
        for field in spec.key_fields:
            key = str(getattr(config, field))
            if key and key not in probes:
                probes[key] = _probe(plugin, key, now, stale_threshold)
    return probes


def _probe(plugin: Any, key: str, now: float, stale_threshold: float) -> KeyProbe:
    entry = plugin.api.getSingleValue(key, includeInfo=True)
    if entry is None:
        return KeyProbe(present=False, fresh=False)
    return KeyProbe(present=True, fresh=now - entry.timestamp <= stale_threshold)
