"""Module: Projection - Pure raw-bin to grid projection and origin anchoring.

Documentation: documentation/architecture/polar-model.md
Depends: polarrecorder.bins, polarrecorder.histogram
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from polarrecorder import histogram
from polarrecorder.bins import TWS_BIN_MAX

ORIGIN_TWA = 0
ORIGIN_STW = 0.0
TWA_FOLD_MAX = 180
TWA_FULL_CIRCLE = 360

SnapshotBins = Mapping[tuple[int, int], Mapping[str, object]]


@dataclass(frozen=True)
class ProjectedCell:
    """One projected polar grid cell."""

    stw: float
    samples: int


def project_grid(
    model_bins: SnapshotBins,
    twa_grid: Sequence[int],
    tws_grid: Sequence[int],
    percentile: int,
    min_samples: int,
) -> dict[tuple[int, int], ProjectedCell]:
    """Project sparse raw bins onto a target TWA/TWS grid.

    Raw bins carry true 0-359 deg TWA and are never folded. The grid mode follows
    which sides of the centerline carry columns. A grid with columns both below
    and above 180 deg is ``full`` and assigns each raw bin to its nearest grid
    point on the circle. A ``starboard`` grid (no column above 180 deg) keeps
    linear half-open midpoint intervals over 0-180 deg, so port bins (181-359 deg)
    fall outside the top interval and are excluded. A ``port`` grid (no column
    below 180 deg, mirror of starboard) keeps linear intervals over 180-360 deg,
    so starboard bins (1-179 deg) are excluded.
    """
    raw = _raw_bins(model_bins)
    tws_intervals = _intervals(tws_grid, TWS_BIN_MAX)
    mode = _grid_mode(twa_grid)
    if mode == "full":
        cells = _circular_cells(raw, twa_grid, tws_intervals)
    elif mode == "port":
        cells = _linear_cells(raw, twa_grid, tws_intervals, TWA_FOLD_MAX, TWA_FULL_CIRCLE)
    else:
        cells = _linear_cells(raw, twa_grid, tws_intervals, 0, TWA_FOLD_MAX)
    projected: dict[tuple[int, int], ProjectedCell] = {}
    for (twa, tws), merged in cells.items():
        samples = sum(merged.values())
        speed = histogram.percentile(merged, percentile)
        if samples >= min_samples and speed is not None:
            projected[(twa, tws)] = ProjectedCell(stw=speed, samples=samples)
    return projected


def anchor_origin(
    projected: Mapping[tuple[int, int], ProjectedCell],
) -> dict[tuple[int, int], ProjectedCell]:
    """Anchor each populated TWS band to 0 deg TWA / 0 STW (head to wind).

    At 0 deg TWA boat speed is physically zero, so this is a grid boundary
    condition shared by the polar diagram and the CSV export rather than learned
    data. For every TWS band that already carries genuine data, an origin cell is
    added at TWA 0 unless real data already occupies it, so the rule never creates
    or promotes an empty band. Consumers whose TWA grid omits 0 deg simply never
    read the added cells.

    Args:
        projected: Genuine projected cells keyed by ``(twa, tws)``.

    Returns:
        A new projection mapping with origin cells added for populated bands.
    """
    anchored = dict(projected)
    for _twa, tws in projected:
        anchored.setdefault((ORIGIN_TWA, tws), ProjectedCell(stw=ORIGIN_STW, samples=0))
    return anchored


def _raw_bins(model_bins: SnapshotBins) -> list[tuple[int, int, Mapping[int, int]]]:
    raw: list[tuple[int, int, Mapping[int, int]]] = []
    for (twa, tws), data in sorted(model_bins.items()):
        raw_histogram = data.get("histogram", {})
        if isinstance(raw_histogram, dict):
            raw.append((twa, tws, _int_histogram(raw_histogram)))
    return raw


def _grid_mode(twa_grid: Sequence[int]) -> str:
    has_starboard = any(0 < value < TWA_FOLD_MAX for value in twa_grid)
    has_port = any(value > TWA_FOLD_MAX for value in twa_grid)
    if has_starboard and has_port:
        return "full"
    if has_port:
        return "port"
    return "starboard"


def _linear_cells(
    raw: Sequence[tuple[int, int, Mapping[int, int]]],
    twa_grid: Sequence[int],
    tws_intervals: Sequence[tuple[int, float, float, bool]],
    lower_axis: int,
    upper_axis: int,
) -> dict[tuple[int, int], dict[int, int]]:
    cells: dict[tuple[int, int], dict[int, int]] = {}
    twa_intervals = _intervals(twa_grid, upper_axis, lower_axis)
    for twa, twa_lower, twa_upper, twa_last in twa_intervals:
        for tws, tws_lower, tws_upper, tws_last in tws_intervals:
            merged = _cell_histogram(
                raw,
                (twa_lower, twa_upper, twa_last),
                (tws_lower, tws_upper, tws_last),
            )
            if merged:
                cells[(twa, tws)] = merged
    return cells


def _circular_cells(
    raw: Sequence[tuple[int, int, Mapping[int, int]]],
    twa_grid: Sequence[int],
    tws_intervals: Sequence[tuple[int, float, float, bool]],
) -> dict[tuple[int, int], dict[int, int]]:
    cells: dict[tuple[int, int], dict[int, int]] = {}
    points = sorted(set(twa_grid))
    for twa, tws, source in raw:
        grid_twa = _nearest_circular(twa, points)
        for grid_tws, tws_lower, tws_upper, tws_last in tws_intervals:
            if _inside(tws, (tws_lower, tws_upper, tws_last)):
                bucket = cells.setdefault((grid_twa, grid_tws), {})
                for key, count in source.items():
                    bucket[key] = bucket.get(key, 0) + count
                break
    return cells


def _nearest_circular(twa: int, points: Sequence[int]) -> int:
    best = points[0]
    best_distance = _circular_distance(twa, best)
    for point in points[1:]:
        distance = _circular_distance(twa, point)
        if distance < best_distance:
            best = point
            best_distance = distance
    return best


def _circular_distance(a: int, b: int) -> int:
    diff = abs(a - b) % TWA_FULL_CIRCLE
    return min(diff, TWA_FULL_CIRCLE - diff)


def _cell_histogram(
    raw: Sequence[tuple[int, int, Mapping[int, int]]],
    twa_interval: tuple[float, float, bool],
    tws_interval: tuple[float, float, bool],
) -> dict[int, int]:
    merged: dict[int, int] = {}
    for twa, tws, source in raw:
        if _inside(twa, twa_interval) and _inside(tws, tws_interval):
            for key, count in source.items():
                merged[key] = merged.get(key, 0) + count
    return merged


def _intervals(
    values: Sequence[int], upper_axis: int, lower_axis: int = 0
) -> list[tuple[int, float, float, bool]]:
    return [
        (
            value,
            float(lower_axis) if index == 0 else (values[index - 1] + value) / 2.0,
            float(upper_axis) if index == len(values) - 1 else (value + values[index + 1]) / 2.0,
            index == len(values) - 1,
        )
        for index, value in enumerate(values)
    ]


def _inside(value: int, interval: tuple[float, float, bool]) -> bool:
    lower, upper, closed_upper = interval
    if closed_upper:
        return lower <= value <= upper
    return lower <= value < upper


def _int_histogram(raw: dict[object, object]) -> dict[int, int]:
    return {to_int(key): to_int(count) for key, count in raw.items()}


def to_int(value: object) -> int:
    """Coerce an int-compatible scalar to ``int`` or raise ``TypeError``."""
    if isinstance(value, (str, bytes, bytearray, int, float)):
        return int(value)
    msg = f"Expected int-compatible value, got {type(value).__name__}"
    raise TypeError(msg)
