"""Module: API Dispatch - Request dispatch for the AvNav plugin shell.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.api_handlers, polarrecorder.export, polarrecorder.persistence
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from polarrecorder import api_handlers, export, persistence
from polarrecorder.bins import TWS_BIN_MAX

Route = Callable[[Any, dict[str, str]], dict[str, object]]


def handle_request(plugin: Any, url: str, args: dict[str, str]) -> dict[str, object]:
    """Route a normalized plugin API request."""
    try:
        route = ROUTES.get(url)
        if route is None:
            return api_handlers.error(f"Unknown endpoint '{url}'")
        return route(plugin, args)
    except export.ExportError as exc:
        return api_handlers.error(str(exc))


def _status(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        snapshot = _status_snapshot(plugin)
    return api_handlers.format_status(snapshot)


def _polar(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    if "twa" in args or "tws" in args:
        msg = (
            "Invalid parameters: 'polar' does not accept inline 'twa' or 'tws'; use export instead"
        )
        raise export.ExportError(msg)
    with plugin._lock:
        preset = export.resolve_polar_preset(plugin._data_dir, args, plugin._logger)
        percentile = export.parse_percentile(args, plugin.config.percentile)
        model_bins = plugin._model.snapshot_bins()
        generation = plugin._model.generation
    return api_handlers.format_polar(model_bins, preset.tws, percentile, generation, preset.name)


def _rejections(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        global_hist = dict(plugin._counters.rejection_histogram)
        per_bin = {
            address: dict(model_bin["rejection_histogram"])
            for address, model_bin in plugin._model.snapshot_bins().items()
        }
    return api_handlers.format_rejections(global_hist, per_bin)


def _timeline(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    minutes = _parse_int_arg(args, "minutes", 240, 1, 240)
    with plugin._lock:
        entries = plugin._timeline.query(minutes)
    return api_handlers.format_timeline(entries)


def _export_csv(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        selection = export.resolve_export_selection(
            plugin._data_dir,
            args,
            plugin.config.max_tws,
            plugin.config.min_samples_for_export,
            plugin._logger,
        )
        percentile = export.parse_percentile(args, plugin.config.percentile)
        model_bins = plugin._model.snapshot_bins()
    return api_handlers.format_export(
        model_bins,
        selection.twa,
        selection.tws,
        percentile,
        selection.min_samples,
    )


def _config(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        config = plugin.config
    return api_handlers.format_config(config)


def _presets(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        presets = export.list_presets(plugin._data_dir, plugin._logger)
    return api_handlers.format_presets(presets)


def _export_json(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        payload = persistence.serialize_to_dict(
            plugin._model,
            plugin._counters,
            _persistence_metadata(plugin, plugin._last_flush_wall),
        )
    return api_handlers.export_json(payload)


def _reset(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    if args.get("confirm") != "yes":
        return api_handlers.error("Invalid parameter 'confirm': expected 'yes'")
    with plugin._lock:
        plugin._model.reset()
        plugin._counters.reset()
        plugin._flush_requested = True
    return api_handlers.ok({})


def _pause(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        plugin._paused = True
    return api_handlers.ok({"recording": False})


def _resume(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        plugin._paused = False
        recording = plugin.config.record_enabled
    return api_handlers.ok({"recording": recording})


def _preset_save(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        preset = export.save_preset(
            plugin._data_dir,
            args.get("name", ""),
            args.get("twa", ""),
            args.get("tws", ""),
            plugin.config.max_tws,
            plugin._logger,
        )
    return api_handlers.ok({"preset": _preset_dict(preset)})


def _preset_delete(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        export.delete_preset(
            plugin._data_dir,
            args.get("name", ""),
            args.get("confirm", ""),
            plugin._logger,
        )
    return api_handlers.ok({})


def _status_snapshot(plugin: Any) -> api_handlers.StatusSnapshot:
    now = plugin._clock()
    counters = plugin._counters.to_dict()
    rejection_histogram = dict(counters["rejection_histogram"])
    return api_handlers.StatusSnapshot(
        record_enabled=plugin.config.record_enabled,
        recording=plugin.config.record_enabled and not plugin._paused,
        data_status=plugin._last_data_status,
        warming_up=plugin._warming_up,
        uptime_seconds=now - plugin._run_start_monotonic,
        current_values=_current_values_snapshot(plugin),
        current_decision=_copy_decision(plugin._last_decision),
        counters={
            "total_seen": counters["total_seen"],
            "total_accepted": counters["total_accepted"],
            "total_rejected": counters["total_rejected"],
            "total_quarantined": counters["total_quarantined"],
        },
        top_rejections=_top_rejections(rejection_histogram),
        last_flush_wall=plugin._last_flush_wall,
        file_size_bytes=plugin._last_flush_size_bytes,
        bins_with_data=len(plugin._model.snapshot_bins()),
        bins_total=360 * (TWS_BIN_MAX + 1),
        generation=plugin._model.generation,
        now_monotonic=now,
        stale_threshold=plugin.config.stale_threshold,
    )


def _current_values_snapshot(plugin: Any) -> api_handlers.CurrentValuesSnapshot | None:
    values = plugin._last_current_values
    if values is None:
        return None
    return api_handlers.CurrentValuesSnapshot(
        twa_deg=values.twa_deg,
        tws_kt=values.tws_kt,
        stw_kt=values.stw_kt,
        twa_timestamp=values.twa_timestamp,
        tws_timestamp=values.tws_timestamp,
        stw_timestamp=values.stw_timestamp,
    )


def _persistence_metadata(plugin: Any, last_flush_wall: float) -> persistence.PersistenceMetadata:
    created_wall = (
        plugin._created_wall if plugin._created_wall is not None else plugin._wall_clock()
    )
    version = plugin.__class__.pluginInfo().get("version", "0.0.0-dev")
    return persistence.PersistenceMetadata(
        plugin_version=str(version),
        created_wall=created_wall,
        last_flush_wall=last_flush_wall,
        percentile=plugin.config.percentile,
        max_tws=plugin.config.max_tws,
    )


def _parse_int_arg(
    args: dict[str, str],
    name: str,
    default: int,
    lower: int,
    upper: int,
) -> int:
    raw = args.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        msg = f"Invalid parameter '{name}': expected integer {lower}-{upper}, got {raw!r}"
        raise export.ExportError(msg) from exc
    if lower <= value <= upper:
        return value
    msg = f"Invalid parameter '{name}': expected integer {lower}-{upper}, got {raw!r}"
    raise export.ExportError(msg)


def _top_rejections(histogram: dict[str, int]) -> list[dict[str, object]]:
    return [
        {"reason": reason, "count": count}
        for reason, count in sorted(histogram.items(), key=_rejection_sort_key)[:5]
    ]


def _rejection_sort_key(item: tuple[str, int]) -> tuple[int, str]:
    reason, count = item
    return -count, reason


def _copy_decision(decision: dict[str, object] | None) -> dict[str, object] | None:
    if decision is None:
        return None
    copied = dict(decision)
    reasons = copied.get("reason_codes")
    if isinstance(reasons, list):
        copied["reason_codes"] = list(reasons)
    return copied


def _preset_dict(preset: export.Preset) -> dict[str, object]:
    return {
        "name": preset.name,
        "builtin": preset.builtin,
        "twa": list(preset.twa),
        "tws": list(preset.tws),
    }


ROUTES: dict[str, Route] = {
    "status": _status,
    "polar": _polar,
    "rejections": _rejections,
    "timeline": _timeline,
    "export": _export_csv,
    "config": _config,
    "presets": _presets,
    "export/json": _export_json,
    "reset": _reset,
    "pause": _pause,
    "resume": _resume,
    "presets/save": _preset_save,
    "presets/delete": _preset_delete,
}
