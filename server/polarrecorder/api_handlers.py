"""Module: API Handlers - Pure API response formatting.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.config, polarrecorder.export
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import TYPE_CHECKING

from polarrecorder import export

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from polarrecorder.config import Config

Response = dict[str, object]


@dataclass(frozen=True)
class CurrentValuesSnapshot:
    """Detached latest finite store values for status formatting."""

    twa_deg: float
    tws_kt: float
    stw_kt: float
    twa_timestamp: float
    tws_timestamp: float
    stw_timestamp: float


@dataclass(frozen=True)
class StatusSnapshot:
    """Detached status input consumed by ``format_status``."""

    recording: bool
    data_status: str
    warming_up: bool
    uptime_seconds: float
    current_values: CurrentValuesSnapshot | None
    current_decision: dict[str, object] | None
    counters: dict[str, int]
    top_rejections: list[dict[str, object]]
    last_flush_wall: float
    file_size_bytes: int
    bins_with_data: int
    bins_total: int
    generation: int
    now_monotonic: float
    stale_threshold: float


def ok(data: object) -> Response:
    """Wrap a successful response body."""
    return {"status": "OK", "data": data}


def error(message: str) -> Response:
    """Wrap an application error response."""
    return {"status": "ERROR", "error": message}


def format_status(snapshot: StatusSnapshot) -> Response:
    """Format the recording status endpoint."""
    total_seen = snapshot.counters["total_seen"]
    total_accepted = snapshot.counters["total_accepted"]
    counters: dict[str, object] = {
        "total_seen": total_seen,
        "total_accepted": total_accepted,
        "total_rejected": snapshot.counters["total_rejected"],
        "total_quarantined": snapshot.counters["total_quarantined"],
        "acceptance_rate": 0.0 if total_seen == 0 else total_accepted / total_seen,
    }
    return ok(
        {
            "recording": snapshot.recording,
            "data_status": snapshot.data_status,
            "warming_up": snapshot.warming_up,
            "uptime_seconds": snapshot.uptime_seconds,
            "current_values": _format_current_values(snapshot),
            "current_decision": snapshot.current_decision,
            "counters": counters,
            "top_rejections": snapshot.top_rejections,
            "persistence": {
                "last_flush_wall": snapshot.last_flush_wall,
                "file_size_bytes": snapshot.file_size_bytes,
                "bins_with_data": snapshot.bins_with_data,
                "bins_total": snapshot.bins_total,
            },
            "generation": snapshot.generation,
        }
    )


def format_polar(
    model_bins: export.SnapshotBins,
    twa_grid: Sequence[int],
    tws_grid: Sequence[int],
    percentile: int,
    generation: int,
    format_name: str,
) -> Response:
    """Format the polar diagram endpoint.

    Projects onto the preset ``twa_grid`` so band membership and per-cell
    midpoint merging match the CSV export, then shares ``export.anchor_origin``
    so each populated band starts at 0 deg TWA / 0 STW. Cells are placed into a
    360-entry array indexed by absolute TWA 0-359 deg, so projected port cells
    (181-359 deg) are addressable alongside starboard cells; non-preset indices
    are ``None``. The origin cell carries 0 samples for the viewer to treat as
    full confidence, and because the anchor only touches bands that already have
    data it never creates a band.
    """
    projected = export.anchor_origin(
        export.project_grid(
            model_bins,
            twa_grid,
            tws_grid,
            percentile,
            export.MIN_SAMPLES_DISPLAY,
        )
    )
    curves: dict[str, list[dict[str, object] | None]] = {}
    bands: list[int] = []
    for tws in tws_grid:
        curve = [_polar_entry(projected.get((twa, tws))) for twa in range(export.TWA_FULL_CIRCLE)]
        if any(entry is not None for entry in curve):
            bands.append(tws)
            curves[str(tws)] = curve
    return ok(
        {
            "format": format_name,
            "percentile": percentile,
            "generation": generation,
            "tws_bands": bands,
            "curves": curves,
        }
    )


def format_rejections(
    global_histogram: Mapping[str, int],
    per_bin_histograms: Mapping[tuple[int, int], Mapping[str, int]],
) -> Response:
    """Format global and per-bin rejection diagnostics."""
    per_bin = {
        f"{address[0]}_{address[1]}": dict(sorted(histogram.items()))
        for address, histogram in sorted(per_bin_histograms.items())
        if histogram
    }
    return ok({"global": dict(sorted(global_histogram.items())), "per_bin": per_bin})


def format_timeline(entries: Sequence[Mapping[str, object]]) -> Response:
    """Format already-filtered timeline buckets."""
    return ok({"buckets": [dict(entry) for entry in entries]})


def format_export(
    model_bins: export.SnapshotBins,
    twa_grid: Sequence[int],
    tws_grid: Sequence[int],
    percentile: int,
    min_samples: int,
) -> Response:
    """Format the CSV export endpoint."""
    selection = export.ExportSelection("custom", list(twa_grid), list(tws_grid), min_samples)
    return ok({"csv": export.csv_export(model_bins, selection, percentile)})


def format_config(config: Config) -> Response:
    """Format current parsed runtime config values."""
    return ok(asdict(config))


def format_presets(presets: Sequence[export.Preset]) -> Response:
    """Format built-in and user export presets."""
    return ok(
        {
            "presets": [
                {
                    "name": preset.name,
                    "builtin": preset.builtin,
                    "twa": list(preset.twa),
                    "tws": list(preset.tws),
                }
                for preset in presets
            ]
        }
    )


def export_json(serialized: Mapping[str, object]) -> Response:
    """Wrap an already serialized persistence payload."""
    return ok(dict(serialized))


def format_enhanced_keys(keys: Sequence[str]) -> Response:
    """Format the available-store-keys endpoint."""
    return ok({"keys": list(keys)})


def format_enhanced_status(rows: Sequence[Mapping[str, object]]) -> Response:
    """Format the enhanced-rule live-status endpoint."""
    return ok({"rules": [dict(row) for row in rows]})


def format_enhanced_config(values: Mapping[str, object]) -> Response:
    """Format the saved enhanced configuration subset."""
    return ok({"config": dict(values)})


def _format_current_values(snapshot: StatusSnapshot) -> dict[str, object] | None:
    values = snapshot.current_values
    if values is None:
        return None
    twa_age = snapshot.now_monotonic - values.twa_timestamp
    tws_age = snapshot.now_monotonic - values.tws_timestamp
    stw_age = snapshot.now_monotonic - values.stw_timestamp
    return {
        "twa_deg": values.twa_deg,
        "tws_kt": values.tws_kt,
        "stw_kt": values.stw_kt,
        "twa_age_s": twa_age,
        "tws_age_s": tws_age,
        "stw_age_s": stw_age,
        "twa_stale": twa_age > snapshot.stale_threshold,
        "tws_stale": tws_age > snapshot.stale_threshold,
        "stw_stale": stw_age > snapshot.stale_threshold,
    }


def _polar_entry(cell: export.ProjectedCell | None) -> dict[str, object] | None:
    if cell is None:
        return None
    return {"stw": cell.stw, "samples": cell.samples}
