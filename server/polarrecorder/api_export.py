"""Module: API Export - CSV and routing POL request orchestration.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.api_handlers, polarrecorder.export
"""

from __future__ import annotations

from typing import Any

from polarrecorder import api_handlers, export


def export_csv(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    """Snapshot and format a tack-aware CSV export request."""
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


def export_routing_pol(plugin: Any, args: dict[str, str]) -> dict[str, object]:
    """Snapshot and format a fixed-grid, tack-folded routing POL request."""
    if any(name in args for name in ("format", "twa", "tws")):
        msg = "Invalid parameters: 'export/pol' uses its fixed routing grid"
        raise export.ExportError(msg)
    with plugin._lock:
        percentile = export.parse_percentile(args, plugin.config.percentile)
        min_samples = export.resolve_min_samples(args, plugin.config.min_samples_for_export)
        model_bins = plugin._model.snapshot_bins()
    return api_handlers.format_routing_pol(model_bins, percentile, min_samples)
