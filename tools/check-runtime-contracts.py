#!/usr/bin/env python3
"""Runtime contract gate: no non-finite numbers leak to the API/export boundary.

The static ``nan-sentinel`` rule in check-py-contracts.py only catches *literal*
``float("nan")`` / ``math.nan``. A non-finite value produced at runtime (a
division, a percentile over an empty band, a projection edge case) is invisible
to AST scanning. This checker is the behavioral twin of the dyninstruments
``mapper-output-no-nan`` / ``placeholder-contract`` checks: it populates a real
model, formats the polar and CSV/Windy boundary responses, and fails if any
number is NaN/Infinity or any export text carries a ``nan``/``inf`` sentinel.

Run from the repo root. Exit 0 when clean, 1 when a non-finite value leaks.
"""

from __future__ import annotations

import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server"
sys.path.insert(0, str(SERVER))

from polarrecorder import api_handlers, export  # noqa: E402  # tool path setup precedes imports
from polarrecorder.polar_model import PolarModel  # noqa: E402  # tool path setup precedes imports
from polarrecorder.sample import Freshness, Sample  # noqa: E402  # tool path setup precedes imports

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
        f"[runtime-contracts] polar and export boundaries finite across "
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


def sample_for(index: int) -> Sample:
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
