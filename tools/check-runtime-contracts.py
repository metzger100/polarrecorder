#!/usr/bin/env python3
"""Runtime contract gate: no non-finite numbers leak to the API/export boundary.

The static ``nan-sentinel`` rule in check-py-contracts.py only catches *literal*
``float("nan")`` / ``math.nan``. A non-finite value produced at runtime (a
division, unit-conversion overflow, percentile over an empty band, or projection
edge case) is invisible to AST scanning. This checker exercises hostile core
normalization and formats status, polar, and CSV/Windy boundary responses. It
fails if any number is NaN/Infinity or export text carries a ``nan``/``inf``
sentinel.

Run from the repo root. Exit 0 when clean, 1 when a non-finite value leaks.
"""

from __future__ import annotations

import math
import re
import sys
from typing import Any

from polarrecorder import api_handlers, export
from polarrecorder.config import default_config
from polarrecorder.polar_model import PolarModel
from polarrecorder.sample import Freshness, ReadResult, Sample
from polarrecorder.validation import pipeline
from polarrecorder.validation.state import ValidationState

SAMPLE_COUNT = 4000
KNOTS_PER_METER_PER_SECOND = 1.9438444924406048

# Whole-word ``nan``/``inf`` sentinels that must never reach an export payload.
_SENTINEL_TEXT = re.compile(r"(?i)(?<![A-Za-z])(nan|[+-]?inf(?:inity)?)(?![A-Za-z])")


def main() -> int:
    """Format real boundary responses and fail on any non-finite leak.

    Returns:
        Process exit code: 0 when clean, 1 when a violation is found.
    """
    model = PolarModel()
    for index in range(SAMPLE_COUNT):
        model.update_accepted(sample_for(index))
    snapshot = model.snapshot_bins()

    twa_grid = list(export.DEFAULT_TWA_STARBOARD180)
    tws_grid = list(export.WINDY_TWS)
    name = export.DEFAULT_STARBOARD180_NAME

    failures: list[str] = []
    status = status_response(sample_for(0))
    failures.extend(
        f"format_status{path}: non-finite value {value!r}"
        for path, value in nonfinite_paths(status)
    )
    failures.extend(hostile_core_normalization_failures())
    for percentile in (50, 65, 90):
        polar = api_handlers.format_polar(snapshot, twa_grid, tws_grid, percentile, 1, name)
        failures.extend(
            f"format_polar(percentile={percentile}){path}: non-finite value {value!r}"
            for path, value in nonfinite_paths(polar)
        )
        export_response = api_handlers.format_export(
            snapshot, twa_grid, tws_grid, percentile, export.MIN_SAMPLES_DISPLAY
        )
        failures.extend(
            f"format_export(percentile={percentile}){path}: non-finite value {value!r}"
            for path, value in nonfinite_paths(export_response)
        )
        failures.extend(
            f"format_export(percentile={percentile}).data.csv: {detail}"
            for detail in sentinel_text_failures(_csv_text(export_response))
        )

    if failures:
        for failure in failures:
            sys.stderr.write(f"[runtime-contracts] {failure}\n")
        sys.stderr.write(f"[runtime-contracts] {len(failures)} violation(s) found.\n")
        return 1
    sys.stdout.write(
        f"[runtime-contracts] status, polar, and export boundaries finite across "
        f"{SAMPLE_COUNT} samples.\n"
    )
    sys.stdout.write("Runtime contract check passed.\n")
    return 0


def nonfinite_paths(value: object, path: str = "") -> list[tuple[str, float]]:
    """Return ``(path, value)`` for every NaN/Infinity float reachable in value.

    Walks dicts, lists and tuples. ``bool`` is an ``int`` subclass and is never
    a float sentinel, so only genuine ``float`` leaves are range-checked.

    Args:
        value: The response structure to walk.
        path: Accumulated dotted/indexed path used in findings.

    Returns:
        One entry per non-finite float leaf.
    """
    findings: list[tuple[str, float]] = []
    if isinstance(value, float):
        if not math.isfinite(value):
            findings.append((path, value))
    elif isinstance(value, dict):
        for key, item in value.items():
            findings.extend(nonfinite_paths(item, f"{path}.{key}"))
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            findings.extend(nonfinite_paths(item, f"{path}[{index}]"))
    return findings


def sentinel_text_failures(text: str) -> list[str]:
    """Return findings for ``nan``/``inf`` sentinel tokens in export text."""
    matches = sorted({match.group(0) for match in _SENTINEL_TEXT.finditer(text)})
    if matches:
        return [f"contains sentinel token(s) {', '.join(repr(token) for token in matches)}"]
    return []


def _csv_text(export_response: dict[str, object]) -> str:
    """Extract the CSV payload from a ``format_export`` response."""
    data = export_response["data"]
    if not isinstance(data, dict):
        msg = f"format_export data is not a mapping: {type(data).__name__}"
        raise TypeError(msg)
    csv = data["csv"]
    if not isinstance(csv, str):
        msg = f"format_export csv is not a string: {type(csv).__name__}"
        raise TypeError(msg)
    return csv


def hostile_core_normalization_failures() -> list[str]:
    """Return failures when finite raw core speeds escape as non-finite knots."""
    failures: list[str] = []
    for role in ("tws", "stw"):
        read_result = hostile_core_read(role)
        result, sample = pipeline.run(read_result, ValidationState(), default_config())
        expected_reason = f"reject_non_finite_{role}"
        if sample is not None:
            failures.extend(
                f"hostile_{role}_normalization{path}: non-finite value {value!r}"
                for path, value in nonfinite_paths(status_response(sample))
            )
            failures.append(f"hostile_{role}_normalization: built a Sample")
        if result.reason_codes != (expected_reason,):
            failures.append(
                f"hostile_{role}_normalization: expected {expected_reason}, "
                f"got {result.reason_codes!r}"
            )
    return failures


def hostile_core_read(role: str) -> ReadResult:
    """Build one finite raw read whose selected speed overflows in knots."""
    return ReadResult(
        timestamp_monotonic=10.0,
        timestamp_wall=1000.0,
        twa_raw=90.0,
        tws_raw=1e308 if role == "tws" else 6.0,
        stw_raw=1e308 if role == "stw" else 3.0,
        twa_timestamp=10.0,
        tws_timestamp=10.0,
        stw_timestamp=10.0,
    )


def status_response(sample: Sample) -> dict[str, object]:
    """Format a representative status response from a finite sample."""
    current_values = api_handlers.CurrentValuesSnapshot(
        twa_deg=sample.twa_deg_raw,
        tws_kt=sample.tws_kt,
        stw_kt=sample.stw_kt,
        twa_timestamp=sample.timestamp_monotonic,
        tws_timestamp=sample.timestamp_monotonic,
        stw_timestamp=sample.timestamp_monotonic,
    )
    return api_handlers.format_status(
        api_handlers.StatusSnapshot(
            recording=True,
            data_status="receiving",
            warming_up=False,
            uptime_seconds=sample.timestamp_monotonic,
            current_values=current_values,
            current_decision={"state": "accepted", "reason_codes": []},
            counters={
                "total_seen": 1,
                "total_accepted": 1,
                "total_rejected": 0,
                "total_quarantined": 0,
            },
            top_rejections=[],
            top_predicates=[],
            last_flush_wall=sample.timestamp_wall,
            file_size_bytes=0,
            bins_with_data=1,
            bins_total=1,
            generation=1,
            now_monotonic=sample.timestamp_monotonic,
            stale_threshold=3.0,
        )
    )


def sample_for(index: int) -> Any:
    """Return one deterministic accepted sample spread across common bins."""
    twa = float(index % 181)
    tws_kt = float(export.WINDY_TWS[index % len(export.WINDY_TWS)])
    stw_kt = 4.0 + float(index % 40) / 10.0
    return Sample(
        timestamp_monotonic=float(index),
        timestamp_wall=float(index),
        twa_deg_raw=twa,
        twa_deg_abs=twa,
        twa_deg_signed=twa,
        tws_ms=tws_kt / KNOTS_PER_METER_PER_SECOND,
        tws_kt=tws_kt,
        stw_ms=stw_kt / KNOTS_PER_METER_PER_SECOND,
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
