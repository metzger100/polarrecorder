"""Module: Polar Model - Sparse histogram-backed polar storage.

Documentation: documentation/architecture/polar-model.md
Depends: polarrecorder.bins, polarrecorder.histogram, polarrecorder.sample
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

from polarrecorder import histogram
from polarrecorder.bins import Bin, bin_address

if TYPE_CHECKING:
    from collections.abc import Iterator, Sequence

    from polarrecorder.sample import Sample


class SnapshotBin(TypedDict):
    """Detached plain-dict representation of one model bin."""

    histogram: dict[int, int]
    total_accepted: int
    total_rejected: int
    total_quarantined: int
    last_update_wall: float
    rejection_histogram: dict[str, int]


class PolarModel:
    """Sparse 360 degree by 0-60 knot polar model."""

    def __init__(self) -> None:
        """Create an empty model."""
        self._bins: dict[tuple[int, int], Bin] = {}
        self.generation = 0

    @property
    def bins(self) -> dict[tuple[int, int], Bin]:
        """Return live bins for in-process single-threaded callers."""
        return self._bins

    def iter_bins(self) -> Iterator[tuple[tuple[int, int], Bin]]:
        """Iterate live sparse bins for in-process single-threaded callers."""
        return iter(self._bins.items())

    def update_accepted(self, sample: Sample) -> None:
        """Record one accepted sample and bump the model generation."""
        model_bin = self._bin_for_sample(sample)
        histogram.add_sample(model_bin.histogram, sample.stw_kt)
        model_bin.total_accepted += 1
        model_bin.last_update_wall = sample.timestamp_wall
        self.generation += 1

    def record_rejection(self, sample: Sample, reason_codes: Sequence[str]) -> None:
        """Record a quality-gate rejection at the sample's bin."""
        model_bin = self._bin_for_sample(sample)
        model_bin.total_rejected += 1
        for reason_code in reason_codes:
            _increment_reason(model_bin.rejection_histogram, reason_code)

    def record_quarantine(self, sample: Sample, reason_code: str) -> None:
        """Record a quarantined sample at the sample's bin."""
        model_bin = self._bin_for_sample(sample)
        model_bin.total_quarantined += 1
        _increment_reason(model_bin.rejection_histogram, reason_code)

    def reset(self) -> None:
        """Clear all bins and bump the model generation."""
        self._bins.clear()
        self.generation += 1

    def query(self, percentile_value: float) -> dict[tuple[int, int], float]:
        """Return per-bin percentile speeds for populated histograms."""
        results: dict[tuple[int, int], float] = {}
        for address, model_bin in self._bins.items():
            speed = histogram.percentile(model_bin.histogram, percentile_value)
            if speed is not None:
                results[address] = speed
        return results

    def snapshot_bins(self) -> dict[tuple[int, int], SnapshotBin]:
        """Return a detached plain-data snapshot of all live bins."""
        return {
            address: {
                "histogram": dict(model_bin.histogram),
                "total_accepted": model_bin.total_accepted,
                "total_rejected": model_bin.total_rejected,
                "total_quarantined": model_bin.total_quarantined,
                "last_update_wall": model_bin.last_update_wall,
                "rejection_histogram": dict(model_bin.rejection_histogram),
            }
            for address, model_bin in self._bins.items()
        }

    def _bin_for_sample(self, sample: Sample) -> Bin:
        address = bin_address(sample.twa_deg_raw, sample.tws_kt)
        model_bin = self._bins.get(address)
        if model_bin is None:
            model_bin = Bin(twa_deg=address[0], tws_kt=address[1])
            self._bins[address] = model_bin
        return model_bin


def _increment_reason(rejection_histogram: dict[str, int], reason_code: str) -> None:
    rejection_histogram[reason_code] = rejection_histogram.get(reason_code, 0) + 1
