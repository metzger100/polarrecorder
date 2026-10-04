"""Module: Projection - Pure raw-bin to grid projection and origin anchoring.

Documentation: documentation/architecture/polar-model.md
Depends: polarrecorder.bins, polarrecorder.histogram
"""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import TypedDict

from polarrecorder import histogram
from polarrecorder.bins import TWS_BIN_MAX

ORIGIN_TWA = 0
ORIGIN_STW = 0.0
TWA_FOLD_MAX = 180
TWA_FULL_CIRCLE = 360


class ProjectionBin(TypedDict):
    """The part of a model snapshot bin that projection reads.

    ``polar_model.SnapshotBin`` carries this key among others, so a model snapshot
    is a valid ``SnapshotBins`` mapping without conversion or re-coercion.
    """

    histogram: dict[int, int]


SnapshotBins = Mapping[tuple[int, int], ProjectionBin]
Cell = tuple[int, int]
Interval = tuple[int, float, float, bool]
RawBin = tuple[int, int, Mapping[int, int]]


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
    tws_axis = _Axis.build(tws_grid, TWS_BIN_MAX)
    mode = _grid_mode(twa_grid)
    if mode == "full":
        cells = _circular_cells(raw, twa_grid, tws_axis)
    elif mode == "port":
        cells = _linear_cells(raw, _Axis.build(twa_grid, TWA_FULL_CIRCLE, TWA_FOLD_MAX), tws_axis)
    else:
        cells = _linear_cells(raw, _Axis.build(twa_grid, TWA_FOLD_MAX), tws_axis)
    return _project_cells(cells, percentile, min_samples)


def project_folded_grid(
    model_bins: SnapshotBins,
    twa_grid: Sequence[int],
    tws_grid: Sequence[int],
    percentile: int,
    min_samples: int,
) -> dict[tuple[int, int], ProjectedCell]:
    """Project both tacks onto an absolute 0-180 degree routing grid.

    Source angles are folded with ``min(twa, 360 - twa)`` before target-cell
    assignment. Histograms from both tacks are merged first, so the percentile
    and minimum-sample floor apply to the combined sample population.
    """
    folded = [
        (min(twa, TWA_FULL_CIRCLE - twa), tws, source) for twa, tws, source in _raw_bins(model_bins)
    ]
    cells = _linear_cells(
        folded,
        _Axis.build(twa_grid, TWA_FOLD_MAX),
        _Axis.build(tws_grid, TWS_BIN_MAX),
    )
    return _project_cells(cells, percentile, min_samples)


@dataclass(frozen=True)
class _Axis:
    """Midpoint intervals of one ascending grid axis, searchable by lower bound."""

    intervals: list[Interval]
    lowers: list[float]

    @classmethod
    def build(cls, values: Sequence[int], upper_axis: int, lower_axis: int = 0) -> _Axis:
        intervals = _intervals(values, upper_axis, lower_axis)
        return cls(intervals, [interval[1] for interval in intervals])

    def owner(self, value: int) -> int | None:
        """Return the grid value whose interval holds ``value``, or ``None`` outside the axis."""
        index = bisect_right(self.lowers, value) - 1
        if index < 0:
            return None
        grid_value, lower, upper, closed_upper = self.intervals[index]
        return grid_value if _inside(value, (lower, upper, closed_upper)) else None


def _project_cells(
    cells: Mapping[Cell, Mapping[int, int]],
    percentile: int,
    min_samples: int,
) -> dict[tuple[int, int], ProjectedCell]:
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


def _raw_bins(model_bins: SnapshotBins) -> list[RawBin]:
    return [(twa, tws, data["histogram"]) for (twa, tws), data in model_bins.items()]


def _grid_mode(twa_grid: Sequence[int]) -> str:
    has_starboard = any(0 < value < TWA_FOLD_MAX for value in twa_grid)
    has_port = any(value > TWA_FOLD_MAX for value in twa_grid)
    if has_starboard and has_port:
        return "full"
    if has_port:
        return "port"
    return "starboard"


def _linear_cells(
    raw: Sequence[RawBin],
    twa_axis: _Axis,
    tws_axis: _Axis,
) -> dict[Cell, dict[int, int]]:
    assignments: list[tuple[Cell, Mapping[int, int]]] = []
    for twa, tws, source in raw:
        grid_twa = twa_axis.owner(twa)
        grid_tws = tws_axis.owner(tws)
        if grid_twa is not None and grid_tws is not None:
            assignments.append(((grid_twa, grid_tws), source))
    return _merge_cells(assignments)


def _circular_cells(
    raw: Sequence[RawBin],
    twa_grid: Sequence[int],
    tws_axis: _Axis,
) -> dict[Cell, dict[int, int]]:
    assignments: list[tuple[Cell, Mapping[int, int]]] = []
    points = sorted(set(twa_grid))
    for twa, tws, source in raw:
        grid_tws = tws_axis.owner(tws)
        if grid_tws is not None:
            assignments.append(((_nearest_circular(twa, points), grid_tws), source))
    return _merge_cells(assignments)


def _merge_cells(
    assignments: Iterable[tuple[Cell, Mapping[int, int]]],
) -> dict[Cell, dict[int, int]]:
    grouped: dict[Cell, list[Mapping[int, int]]] = {}
    for cell, source in assignments:
        grouped.setdefault(cell, []).append(source)
    return {cell: histogram.merge_histograms(sources) for cell, sources in grouped.items()}


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


def _intervals(values: Sequence[int], upper_axis: int, lower_axis: int = 0) -> list[Interval]:
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
