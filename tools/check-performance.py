#!/usr/bin/env python3
"""Deterministic performance gate for Polar Recorder hot paths.

Two complementary guards:

- Absolute ceilings catch a gross slowdown on reference-class hardware.
- A machine-independent scaling ratio catches algorithmic regressions that stay
  under the (generous) absolute ceiling: the per-sample update path is O(1), so
  doubling the sample count must roughly double the time. A super-linear ratio
  means an accidental O(n^2) crept in. The ratio needs no committed wall-clock
  baseline, so it does not go stale or flake across machines the way an absolute
  baseline would. This is the substance of the dyninstruments perf gate's
  "regression vs baseline" tracking, expressed as self-calibrating scaling.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server"
sys.path.insert(0, str(SERVER))

from polarrecorder import api_handlers, export  # noqa: E402  # tool path setup precedes imports
from polarrecorder.polar_model import PolarModel  # noqa: E402  # tool path setup precedes imports
from polarrecorder.sample import Freshness, Sample  # noqa: E402  # tool path setup precedes imports

SAMPLE_COUNT = 6000
# Absolute ceilings are deliberately generous gross-slowdown backstops (order-of-
# magnitude protection that does not flake across machines). Subtle regressions
# in the per-sample update path are caught precisely by MAX_UPDATE_SCALING_RATIO.
UPDATE_MAX_SECONDS = 1.0
FORMAT_MAX_SECONDS = 1.5

# Doubling the sample count is O(1) per sample, so the elapsed-time ratio should
# sit near 2.0. The ceiling tolerates measurement noise and constant overhead
# while still failing on any super-linear (e.g. O(n^2) -> ~4.0) regression.
MAX_UPDATE_SCALING_RATIO = 2.8
# Below this the single-pass time is too small for the ratio to be meaningful;
# noise would dominate, so the scaling guard is skipped (the absolute ceiling
# still applies).
MIN_RATIO_BASIS_SECONDS = 0.01


def main() -> int:
    """Run hot-path performance checks with ceilings and a scaling guard."""
    update_elapsed = measure_updates(SAMPLE_COUNT)
    update_elapsed_double = measure_updates(SAMPLE_COUNT * 2)
    format_elapsed = measure_format(_populated_snapshot())

    failures = evaluate_performance(update_elapsed, update_elapsed_double, format_elapsed)
    if failures:
        for failure in failures:
            sys.stderr.write(f"[performance] {failure}\n")
        return 1

    ratio = update_elapsed_double / update_elapsed if update_elapsed > 0 else 0.0
    sys.stdout.write(
        f"[performance] model update {update_elapsed:.3f}s, "
        f"polar format {format_elapsed:.3f}s, update scaling x{ratio:.2f}\n"
    )
    sys.stdout.write("Performance check passed.\n")
    return 0


def evaluate_performance(
    update_elapsed: float,
    update_elapsed_double: float,
    format_elapsed: float,
) -> list[str]:
    """Return failure messages for breached ceilings or super-linear scaling.

    Args:
        update_elapsed: Seconds to apply ``SAMPLE_COUNT`` updates.
        update_elapsed_double: Seconds to apply ``2 * SAMPLE_COUNT`` updates.
        format_elapsed: Seconds to format the polar response repeatedly.

    Returns:
        A list of human-readable failures; empty when every guard passes.
    """
    failures: list[str] = []
    if update_elapsed > UPDATE_MAX_SECONDS:
        failures.append(f"model update {update_elapsed:.3f}s exceeds {UPDATE_MAX_SECONDS:.3f}s")
    if format_elapsed > FORMAT_MAX_SECONDS:
        failures.append(f"polar format {format_elapsed:.3f}s exceeds {FORMAT_MAX_SECONDS:.3f}s")
    if update_elapsed >= MIN_RATIO_BASIS_SECONDS:
        ratio = update_elapsed_double / update_elapsed
        if ratio > MAX_UPDATE_SCALING_RATIO:
            failures.append(
                f"model update scaling x{ratio:.2f} exceeds x{MAX_UPDATE_SCALING_RATIO:.2f} "
                f"(doubling samples must stay near-linear; suspect an O(n^2) regression)"
            )
    return failures


def measure_updates(count: int) -> float:
    """Apply ``count`` deterministic accepted samples to a fresh model."""
    model = PolarModel()
    start = time.perf_counter()
    for index in range(count):
        model.update_accepted(sample_for(index))
    return time.perf_counter() - start


def _populated_snapshot() -> export.SnapshotBins:
    """Return a snapshot from a model populated with ``SAMPLE_COUNT`` samples."""
    model = PolarModel()
    for index in range(SAMPLE_COUNT):
        model.update_accepted(sample_for(index))
    return model.snapshot_bins()


def measure_format(snapshot: export.SnapshotBins) -> float:
    """Format a projected polar response from a populated snapshot."""
    start = time.perf_counter()
    for _index in range(20):
        api_handlers.format_polar(
            snapshot,
            list(export.DEFAULT_TWA_STARBOARD180),
            list(export.WINDY_TWS),
            65,
            1,
            export.DEFAULT_STARBOARD180_NAME,
        )
    return time.perf_counter() - start


def sample_for(index: int) -> Sample:
    """Return one deterministic sample spread across common bins."""
    twa = float(index % 181)
    tws_kt = float(export.WINDY_TWS[index % len(export.WINDY_TWS)])
    stw_kt = 4.0 + float(index % 40) / 10.0
    return Sample(
        timestamp_monotonic=float(index),
        timestamp_wall=float(index),
        twa_deg_raw=twa,
        twa_deg_abs=twa,
        twa_deg_signed=twa,
        tws_ms=tws_kt / 1.9438444924406048,
        tws_kt=tws_kt,
        stw_ms=stw_kt / 1.9438444924406048,
        stw_kt=stw_kt,
        freshness=Freshness(
            twa_age_s=0.0,
            tws_age_s=0.0,
            stw_age_s=0.0,
            max_age_s=0.0,
            age_skew_s=0.0,
        ),
        enhanced=None,
    )


if __name__ == "__main__":
    raise SystemExit(main())
