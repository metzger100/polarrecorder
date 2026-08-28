"""Module: Enhanced Input - Canonical optional-signal acquisition semantics.

Documentation: documentation/architecture/data-pipeline.md
Depends: none
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Literal, Protocol

EnhancedInputState = Literal["missing", "stale", "invalid", "usable"]
TimestampState = Literal["invalid", "stale", "future", "usable"]
InvalidInputCause = Literal["value", "range", "timestamp", "future_timestamp"]
MAX_FUTURE_TIMESTAMP_SKEW_SECONDS = 0.5


class StoreEntryLike(Protocol):
    """Store entry shape needed to assess an enhanced input."""

    @property
    def value(self) -> object:
        """Return the raw store value."""
        ...

    @property
    def timestamp(self) -> object:
        """Return the monotonic store timestamp."""
        ...


class EnhancedInputPolicy(Protocol):
    """Role-specific normalization and physical-bound policy."""

    @property
    def minimum_value(self) -> float | None:
        """Return the canonical inclusive lower bound."""
        ...

    @property
    def maximum_value(self) -> float | None:
        """Return the canonical inclusive upper bound."""
        ...

    @property
    def normalizer(self) -> Callable[[float], float] | None:
        """Return the store-to-canonical conversion function."""
        ...


@dataclass(frozen=True)
class DefaultInputPolicy:
    """Unbounded identity policy for generic timestamp-focused acquisition."""

    minimum_value: float | None = None
    maximum_value: float | None = None
    normalizer: Callable[[float], float] | None = None


DEFAULT_INPUT_POLICY = DefaultInputPolicy()


@dataclass(frozen=True)
class EnhancedInput:
    """One optional signal's canonical acquisition result."""

    state: EnhancedInputState
    raw_value: object | None
    timestamp: float | None
    numeric_value: float | None
    invalid_cause: InvalidInputCause | None = None


def assess_enhanced_input(
    entry: StoreEntryLike | None,
    now_monotonic: float,
    stale_threshold: float,
    *,
    policy: EnhancedInputPolicy = DEFAULT_INPUT_POLICY,
) -> EnhancedInput:
    """Classify one store entry exactly as the sampling path consumes it.

    Args:
        entry: Store entry, or ``None`` when the key is unavailable.
        now_monotonic: Current monotonic timestamp.
        stale_threshold: Maximum usable source age in seconds.
        policy: Role-specific normalization and physical-bound policy.

    Returns:
        A complete missing, stale, invalid, or usable acquisition result.
    """
    if entry is None:
        return EnhancedInput("missing", None, None, None)
    timestamp_state, timestamp = classify_timestamp(entry.timestamp, now_monotonic, stale_threshold)
    numeric = coerce_finite_float(entry.value)
    normalized = _normalize_finite(numeric, policy.normalizer)
    invalid_cause: InvalidInputCause | None = None
    if timestamp_state == "invalid":
        invalid_cause = "timestamp"
        timestamp = None
    elif timestamp_state == "future":
        invalid_cause = "future_timestamp"
    elif normalized is None:
        invalid_cause = "value"
    elif _outside_range(normalized, policy):
        invalid_cause = "range"
    if invalid_cause is not None:
        return EnhancedInput("invalid", entry.value, timestamp, None, invalid_cause)
    if timestamp_state == "stale":
        return EnhancedInput("stale", entry.value, timestamp, normalized)
    return EnhancedInput("usable", entry.value, timestamp, normalized)


def _normalize_finite(
    value: float | None, normalizer: Callable[[float], float] | None
) -> float | None:
    if value is None:
        return None
    try:
        normalized = value if normalizer is None else normalizer(value)
    except OverflowError:
        return None
    return normalized if math.isfinite(normalized) else None


def _outside_range(value: float, policy: EnhancedInputPolicy) -> bool:
    below = policy.minimum_value is not None and value < policy.minimum_value
    above = policy.maximum_value is not None and value > policy.maximum_value
    return below or above


def classify_timestamp(
    value: object,
    now_monotonic: float,
    stale_threshold: float,
) -> tuple[TimestampState, float | None]:
    """Classify a raw store timestamp against freshness and future-skew bounds."""
    timestamp = coerce_finite_timestamp(value)
    if timestamp is None:
        return "invalid", None
    return classify_timestamp_age(now_monotonic - timestamp, stale_threshold), timestamp


def classify_timestamp_age(age_seconds: float, stale_threshold: float) -> TimestampState:
    """Classify a finite timestamp age using the canonical temporal policy."""
    if age_seconds < -MAX_FUTURE_TIMESTAMP_SKEW_SECONDS:
        return "future"
    if age_seconds > stale_threshold:
        return "stale"
    return "usable"


def coerce_finite_timestamp(value: object) -> float | None:
    """Return a finite numeric timestamp, rejecting booleans and strings."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        timestamp = float(value)
    except OverflowError:
        return None
    return timestamp if math.isfinite(timestamp) else None


def coerce_finite_float(value: object) -> float | None:
    """Coerce a supported scalar to a finite float.

    Booleans are rejected for every signal role: no physical role encodes an
    on/off state, and ``bool`` is an ``int`` subclass that would otherwise
    coerce to ``1.0``/``0.0``.

    Args:
        value: Raw number or numeric string.

    Returns:
        The finite float, or ``None`` for unsupported or non-finite input.
    """
    coerced: float | None = None
    if not isinstance(value, bool) and isinstance(value, (int, float, str)):
        try:
            coerced = float(value)
        except (OverflowError, ValueError):
            coerced = None
    if coerced is None or not math.isfinite(coerced):
        return None
    return coerced
