"""Module: Histogram - Deciknot speed histogram algorithms.

Documentation: documentation/architecture/polar-model.md
Depends: none
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping


def speed_key(stw_kt: float) -> int:
    """Convert a speed in knots to a deciknot histogram key."""
    return round(stw_kt * 10.0)


def add_sample(histogram: dict[int, int], stw_kt: float) -> None:
    """Add one STW sample to a deciknot histogram.

    Args:
        histogram: Mutable histogram keyed by rounded deciknot speed.
        stw_kt: Speed through water in knots.
    """
    key = speed_key(stw_kt)
    histogram[key] = histogram.get(key, 0) + 1


def merge_histograms(histograms: Iterable[Mapping[int, int]]) -> dict[int, int]:
    """Merge histograms into a fresh detached histogram."""
    merged: dict[int, int] = {}
    for source in histograms:
        for key, count in source.items():
            merged[key] = merged.get(key, 0) + count
    return merged


def percentile(histogram: Mapping[int, int], percentile_value: float) -> float | None:
    """Return the nearest-rank percentile as knots.

    Args:
        histogram: Deciknot-keyed histogram.
        percentile_value: Percentile target, normally 1 through 99.

    Returns:
        The first observed speed whose cumulative count reaches the target
        rank, or ``None`` when the histogram is empty.
    """
    items = sorted(histogram.items())
    total = sum(count for _, count in items)
    if total == 0:
        return None

    target_rank = (percentile_value / 100.0) * total
    cumulative = 0
    for key, count in items:
        cumulative += count
        if cumulative >= target_rank:
            return key / 10.0
    return items[-1][0] / 10.0
