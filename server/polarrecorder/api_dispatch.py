"""Module: API Dispatch - Request dispatch for the AvNav plugin shell.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.api_handlers, polarrecorder.bins, polarrecorder.export,
polarrecorder.import_common, polarrecorder.persistence, polarrecorder.preset_backup
"""

from __future__ import annotations

import secrets
from collections.abc import Callable
from typing import Any

from polarrecorder import api_handlers, export, import_common, persistence, preset_backup
from polarrecorder.bins import TWS_BIN_MAX
from polarrecorder.import_common import BackupError

Route = Callable[[Any, dict[str, str]], dict[str, object]]

IMPORT_KINDS = frozenset({"learned-data", "presets"})


def handle_request(plugin: Any, url: str, args: dict[str, str]) -> dict[str, object]:
    """Route a normalized plugin API request."""
    try:
        route = ROUTES.get(url)
        if route is None:
            return api_handlers.error(f"Unknown endpoint '{url}'")
        return route(plugin, args)
    except (export.ExportError, BackupError) as exc:
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
    return api_handlers.format_polar(
        model_bins, preset.twa, preset.tws, percentile, generation, preset.name
    )


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


def _export_presets(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        presets = export.list_presets(plugin._data_dir, plugin._logger)
    user_presets = [preset for preset in presets if not preset.builtin]
    return api_handlers.ok(preset_backup.serialize_presets(user_presets))


def _import_begin(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    kind = args.get("kind", "")
    if kind not in IMPORT_KINDS:
        msg = "Invalid parameter 'kind': expected 'learned-data' or 'presets'"
        raise export.ExportError(msg)
    token = secrets.token_hex(16)
    with plugin._lock:
        plugin._reset_import_staging()
        plugin._import_token = token
        plugin._import_kind = kind
        plugin._import_last_activity = plugin._clock()
    return api_handlers.ok(
        {
            "token": token,
            "kind": kind,
            "max_bytes": import_common.MAX_IMPORT_BYTES,
            "max_chunks": plugin.MAX_IMPORT_CHUNKS,
        }
    )


def _import_chunk(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    if "seq" not in args:
        msg = "Invalid parameter 'seq': required"
        raise export.ExportError(msg)
    seq = _parse_int_arg(args, "seq", 0, 0, plugin.MAX_IMPORT_CHUNKS)
    data = args.get("data", "")
    chunk_bytes = len(data.encode("utf-8"))
    with plugin._lock:
        _require_active_import(plugin, args.get("token", ""))
        if seq != len(plugin._import_parts):
            plugin._reset_import_staging()
            msg = "Import chunk out of order"
            raise export.ExportError(msg)
        if plugin._import_bytes + chunk_bytes > import_common.MAX_IMPORT_BYTES:
            plugin._reset_import_staging()
            msg = "Import exceeds the size limit"
            raise export.ExportError(msg)
        if len(plugin._import_parts) >= plugin.MAX_IMPORT_CHUNKS:
            plugin._reset_import_staging()
            msg = "Import has too many chunks"
            raise export.ExportError(msg)
        plugin._import_parts.append(data)
        plugin._import_bytes += chunk_bytes
        plugin._import_last_activity = plugin._clock()
        received, total_bytes = len(plugin._import_parts), plugin._import_bytes
    return api_handlers.ok({"received": received, "bytes": total_bytes})


def _import_commit(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        _require_active_import(plugin, args.get("token", ""))
        if args.get("confirm") != "yes":
            msg = "Invalid parameter 'confirm': expected 'yes'"
            raise export.ExportError(msg)
        assembled = "".join(plugin._import_parts)
        kind = plugin._import_kind
        plugin._reset_import_staging()
    if kind == "learned-data":
        return api_handlers.ok(plugin._apply_learned_data_restore(assembled))
    return api_handlers.ok(plugin._apply_presets_restore(assembled))


def _import_abort(plugin: Any, _args: dict[str, str]) -> dict[str, object]:
    with plugin._lock:
        plugin._reset_import_staging()
    return api_handlers.ok({})


def _require_active_import(plugin: Any, token: str) -> None:
    if plugin._import_token is None:
        msg = "No import is in progress"
        raise export.ExportError(msg)
    if token != plugin._import_token:
        plugin._reset_import_staging()
        msg = "Import token mismatch"
        raise export.ExportError(msg)
    if plugin._clock() - plugin._import_last_activity > plugin.IMPORT_IDLE_TIMEOUT_SECONDS:
        plugin._reset_import_staging()
        msg = "Import session expired; please retry"
        raise export.ExportError(msg)


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
    "export/presets": _export_presets,
    "import/begin": _import_begin,
    "import/chunk": _import_chunk,
    "import/commit": _import_commit,
    "import/abort": _import_abort,
    "reset": _reset,
    "pause": _pause,
    "resume": _resume,
    "presets/save": _preset_save,
    "presets/delete": _preset_delete,
}
