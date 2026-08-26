"""Module: Sample - Raw and normalized sample data types.

Documentation: documentation/architecture/polar-model.md
Depends: polarrecorder.enhanced_input, polarrecorder.units
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Literal

from polarrecorder.enhanced_input import coerce_finite_timestamp
from polarrecorder.units import is_finite_meters_per_second_input, meters_per_second_to_knots

if TYPE_CHECKING:
    from polarrecorder.enhanced_input import EnhancedInput

ClockFn = Callable[[], float]
WallClockFn = Callable[[], float]
RuleDecision = Literal["accept", "reject", "quarantine", "pass"]
TWA_FULL_CIRCLE_DEG = 360.0
TWA_HALF_CIRCLE_DEG = 180.0
MAX_ENGINE_RPM = 100_000.0
MAX_ENGINE_SIGNAL = 100_000.0
MAX_DEPTH_M = 12_000.0
MAX_BOAT_SPEED_KT = 100.0
MAX_WIND_SPEED_KT = 200.0
MAX_SIGNED_ANGLE_DEG = 360.0
MAX_HEEL_DEG = 180.0
MAX_BEARING_DEG = 360.0


@dataclass(frozen=True)
class EnhancedSignalSpec:
    """Mapping from an optional-signal role to its config key/enable fields."""

    role: str
    key_field: str
    enable_fields: tuple[str, ...]
    normalizer: Callable[[float], float] | None
    accepts_bool: bool = False
    minimum_value: float | None = None
    maximum_value: float | None = None


ENHANCED_SIGNAL_SPECS: tuple[EnhancedSignalSpec, ...] = (
    EnhancedSignalSpec(
        "rpm",
        "enh_rpm_key",
        ("enh_rpm_enabled",),
        normalizer=None,
        minimum_value=0.0,
        maximum_value=MAX_ENGINE_RPM,
    ),
    EnhancedSignalSpec(
        "engine_signal",
        "enh_engine_state_key",
        ("enh_engine_state_enabled",),
        normalizer=None,
        accepts_bool=True,
        minimum_value=0.0,
        maximum_value=MAX_ENGINE_SIGNAL,
    ),
    EnhancedSignalSpec(
        "depth_m",
        "enh_depth_key",
        ("enh_depth_enabled",),
        normalizer=None,
        minimum_value=0.0,
        maximum_value=MAX_DEPTH_M,
    ),
    EnhancedSignalSpec(
        "sog_kt",
        "enh_sog_key",
        (),
        normalizer=meters_per_second_to_knots,
        minimum_value=0.0,
        maximum_value=MAX_BOAT_SPEED_KT,
    ),
    EnhancedSignalSpec(
        "current_drift_kt",
        "enh_current_drift_key",
        ("enh_slip_enabled",),
        normalizer=meters_per_second_to_knots,
        minimum_value=0.0,
        maximum_value=MAX_BOAT_SPEED_KT,
    ),
    EnhancedSignalSpec(
        "awa_deg",
        "enh_awa_key",
        ("enh_tw_crosscheck_enabled",),
        normalizer=None,
        minimum_value=-MAX_SIGNED_ANGLE_DEG,
        maximum_value=MAX_SIGNED_ANGLE_DEG,
    ),
    EnhancedSignalSpec(
        "aws_kt",
        "enh_aws_key",
        ("enh_tw_crosscheck_enabled",),
        normalizer=meters_per_second_to_knots,
        minimum_value=0.0,
        maximum_value=MAX_WIND_SPEED_KT,
    ),
    EnhancedSignalSpec(
        "heel_deg",
        "enh_heel_key",
        ("enh_heel_enabled",),
        normalizer=None,
        minimum_value=-MAX_HEEL_DEG,
        maximum_value=MAX_HEEL_DEG,
    ),
    EnhancedSignalSpec(
        "heading_deg",
        "enh_heading_key",
        ("enh_turnconfirm_enabled",),
        normalizer=None,
        minimum_value=0.0,
        maximum_value=MAX_BEARING_DEG,
    ),
    EnhancedSignalSpec(
        "cog_deg",
        "enh_cog_key",
        ("enh_turnconfirm_enabled",),
        normalizer=None,
        minimum_value=0.0,
        maximum_value=MAX_BEARING_DEG,
    ),
)
ENHANCED_SIGNAL_BY_ROLE = {spec.role: spec for spec in ENHANCED_SIGNAL_SPECS}


@dataclass(frozen=True)
class ReadResult:
    """Raw output from the store reader before validation."""

    timestamp_monotonic: float
    timestamp_wall: float
    twa_raw: object | None
    tws_raw: object | None
    stw_raw: object | None
    twa_timestamp: object | None
    tws_timestamp: object | None
    stw_timestamp: object | None
    enhanced_values: dict[str, tuple[float, float]] | None = None
    enhanced_inputs: dict[str, EnhancedInput] | None = None


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
    invalid_enhanced_roles: frozenset[str] = frozenset()


@dataclass(frozen=True)
class RuleResult:
    """Result returned by one validation rule."""

    decision: RuleDecision
    reason_codes: tuple[str, ...]
    predicate_codes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        """Use a rejecting rule's decision reasons as default predicates."""
        if self.decision != "pass" and not self.predicate_codes:
            object.__setattr__(self, "predicate_codes", self.reason_codes)


def pass_rule() -> RuleResult:
    """Return the canonical passing rule result."""
    return RuleResult(decision="pass", reason_codes=())


def reject_rule(code: str) -> RuleResult:
    """Return the canonical single-code rejecting rule result."""
    return RuleResult(decision="reject", reason_codes=(code,))


def enhanced_value(sample: Sample, role: str) -> float | None:
    """Return one optional-signal value from a sample, or ``None`` when absent."""
    enhanced = sample.enhanced
    if enhanced is None:
        return None
    return enhanced.get(role)


def build_sample(read_result: ReadResult) -> Sample | None:
    """Build a normalized sample from a raw read.

    Args:
        read_result: Raw core-value read from the store.

    Returns:
        A normalized sample, or ``None`` when any core value is missing or
        non-finite.
    """
    timestamps = _finite_timestamps(read_result)
    if not _required_values_are_normalizable(read_result) or timestamps is None:
        return None

    assert isinstance(read_result.twa_raw, (int, float))
    assert isinstance(read_result.tws_raw, (int, float))
    assert isinstance(read_result.stw_raw, (int, float))
    twa_abs, twa_signed = _normalize_twa(read_result.twa_raw)
    freshness = _build_freshness(read_result.timestamp_monotonic, timestamps)
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
        enhanced=_build_enhanced(read_result.enhanced_values),
        invalid_enhanced_roles=_invalid_enhanced_roles(read_result),
    )


def _build_enhanced(
    enhanced_values: dict[str, tuple[float, float]] | None,
) -> dict[str, float] | None:
    if not enhanced_values:
        return None
    return {role: value[0] for role, value in enhanced_values.items()}


def _invalid_enhanced_roles(read_result: ReadResult) -> frozenset[str]:
    if read_result.enhanced_inputs is None:
        return frozenset()
    return frozenset(
        role
        for role, acquisition in read_result.enhanced_inputs.items()
        if acquisition.state == "invalid"
    )


def is_finite_core_value(value: object | None) -> bool:
    """Return whether a raw core sensor value is finite and numeric but not boolean."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _required_values_are_normalizable(read_result: ReadResult) -> bool:
    return (
        is_finite_core_value(read_result.twa_raw)
        and is_finite_meters_per_second_input(read_result.tws_raw)
        and is_finite_meters_per_second_input(read_result.stw_raw)
    )


def _finite_timestamps(read_result: ReadResult) -> tuple[float, float, float] | None:
    timestamps = tuple(
        coerce_finite_timestamp(value)
        for value in (
            read_result.twa_timestamp,
            read_result.tws_timestamp,
            read_result.stw_timestamp,
        )
    )
    if any(value is None for value in timestamps):
        return None
    twa_timestamp, tws_timestamp, stw_timestamp = timestamps
    assert twa_timestamp is not None
    assert tws_timestamp is not None
    assert stw_timestamp is not None
    return twa_timestamp, tws_timestamp, stw_timestamp


def _normalize_twa(twa_deg_raw: float) -> tuple[float, float]:
    normalized = twa_deg_raw % TWA_FULL_CIRCLE_DEG
    if normalized <= TWA_HALF_CIRCLE_DEG:
        return normalized, normalized
    return TWA_FULL_CIRCLE_DEG - normalized, normalized - TWA_FULL_CIRCLE_DEG


def _build_freshness(now: float, timestamps: tuple[float, float, float]) -> Freshness:
    twa_age = now - timestamps[0]
    tws_age = now - timestamps[1]
    stw_age = now - timestamps[2]
    ages = (twa_age, tws_age, stw_age)
    return Freshness(
        twa_age_s=twa_age,
        tws_age_s=tws_age,
        stw_age_s=stw_age,
        max_age_s=max(ages),
        age_skew_s=max(ages) - min(ages),
    )
