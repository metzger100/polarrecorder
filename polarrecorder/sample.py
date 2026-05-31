"""Module: Sample - Raw and normalized sample data types.

Documentation: documentation/architecture/polar-model.md
Depends: polarrecorder.units
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Literal

from polarrecorder.units import meters_per_second_to_knots

ClockFn = Callable[[], float]
WallClockFn = Callable[[], float]
RuleDecision = Literal["accept", "reject", "quarantine", "pass"]
TWA_FULL_CIRCLE_DEG = 360.0
TWA_HALF_CIRCLE_DEG = 180.0


@dataclass(frozen=True)
class ReadResult:
    """Raw output from the store reader before validation."""

    timestamp_monotonic: float
    timestamp_wall: float
    twa_raw: float | None
    tws_raw: float | None
    stw_raw: float | None
    twa_timestamp: float | None
    tws_timestamp: float | None
    stw_timestamp: float | None


@dataclass(frozen=True)
class Freshness:
    """Age summary for the three required store values."""

    twa_age_s: float
    tws_age_s: float
    stw_age_s: float
    max_age_s: float
    age_skew_s: float


@dataclass(frozen=True)
class Sample:
    """Normalized sample consumed by validation rules and the polar model."""

    timestamp_monotonic: float
    timestamp_wall: float
    twa_deg_raw: float
    twa_deg_abs: float
    twa_deg_signed: float
    tws_ms: float
    tws_kt: float
    stw_ms: float
    stw_kt: float
    freshness: Freshness
    enhanced: dict[str, float] | None = None


@dataclass(frozen=True)
class RuleResult:
    """Result returned by one validation rule."""

    decision: RuleDecision
    reason_codes: list[str]


def build_sample(read_result: ReadResult) -> Sample | None:
    """Build a normalized sample from a raw read.

    Args:
        read_result: Raw core-value read from the store.

    Returns:
        A normalized sample, or ``None`` when any core value is missing or
        non-finite.
    """
    if not _required_values_are_finite(read_result):
        return None

    assert read_result.twa_raw is not None
    assert read_result.tws_raw is not None
    assert read_result.stw_raw is not None
    assert read_result.twa_timestamp is not None
    assert read_result.tws_timestamp is not None
    assert read_result.stw_timestamp is not None

    twa_abs, twa_signed = _normalize_twa(read_result.twa_raw)
    freshness = _build_freshness(read_result)
    return Sample(
        timestamp_monotonic=read_result.timestamp_monotonic,
        timestamp_wall=read_result.timestamp_wall,
        twa_deg_raw=read_result.twa_raw,
        twa_deg_abs=twa_abs,
        twa_deg_signed=twa_signed,
        tws_ms=read_result.tws_raw,
        tws_kt=meters_per_second_to_knots(read_result.tws_raw),
        stw_ms=read_result.stw_raw,
        stw_kt=meters_per_second_to_knots(read_result.stw_raw),
        freshness=freshness,
        enhanced=None,
    )


def _required_values_are_finite(read_result: ReadResult) -> bool:
    values = (read_result.twa_raw, read_result.tws_raw, read_result.stw_raw)
    return all(value is not None and math.isfinite(value) for value in values)


def _normalize_twa(twa_deg_raw: float) -> tuple[float, float]:
    normalized = twa_deg_raw % TWA_FULL_CIRCLE_DEG
    if normalized <= TWA_HALF_CIRCLE_DEG:
        return normalized, normalized
    return TWA_FULL_CIRCLE_DEG - normalized, normalized - TWA_FULL_CIRCLE_DEG


def _build_freshness(read_result: ReadResult) -> Freshness:
    assert read_result.twa_timestamp is not None
    assert read_result.tws_timestamp is not None
    assert read_result.stw_timestamp is not None

    twa_age = read_result.timestamp_monotonic - read_result.twa_timestamp
    tws_age = read_result.timestamp_monotonic - read_result.tws_timestamp
    stw_age = read_result.timestamp_monotonic - read_result.stw_timestamp
    ages = (twa_age, tws_age, stw_age)
    return Freshness(
        twa_age_s=twa_age,
        tws_age_s=tws_age,
        stw_age_s=stw_age,
        max_age_s=max(ages),
        age_skew_s=max(ages) - min(ages),
    )
