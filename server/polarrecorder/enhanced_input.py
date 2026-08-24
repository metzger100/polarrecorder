"""Module: Enhanced Input - Canonical optional-signal acquisition semantics.

Documentation: documentation/architecture/data-pipeline.md
Depends: none
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal, Protocol

EnhancedInputState = Literal["missing", "stale", "invalid", "usable"]
TimestampState = Literal["invalid", "stale", "future", "usable"]
InvalidInputCause = Literal["value", "timestamp", "future_timestamp"]
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
    accepts_bool: bool = False,
) -> EnhancedInput:
    """Classify one store entry exactly as the sampling path consumes it.

    Args:
        entry: Store entry, or ``None`` when the key is unavailable.
        now_monotonic: Current monotonic timestamp.
        stale_threshold: Maximum usable source age in seconds.
        accepts_bool: Whether this signal role permits boolean input.

    Returns:
        A complete missing, stale, invalid, or usable acquisition result.
    """
    if entry is None:
        return EnhancedInput("missing", None, None, None)
    timestamp_state, timestamp = classify_timestamp(entry.timestamp, now_monotonic, stale_threshold)
    numeric = coerce_finite_float(entry.value, accepts_bool=accepts_bool)
    invalid_cause: InvalidInputCause | None = None
    if timestamp_state == "invalid":
        invalid_cause = "timestamp"
        timestamp = None
    elif timestamp_state == "future":
        invalid_cause = "future_timestamp"
    elif numeric is None:
        invalid_cause = "value"
    if invalid_cause is not None:
        return EnhancedInput("invalid", entry.value, timestamp, None, invalid_cause)
    if timestamp_state == "stale":
        return EnhancedInput("stale", entry.value, timestamp, numeric)
    return EnhancedInput("usable", entry.value, timestamp, numeric)


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


def coerce_finite_float(value: object, *, accepts_bool: bool = False) -> float | None:
    """Coerce a supported scalar to a finite float.

    Args:
        value: Raw bool, number, or numeric string.
        accepts_bool: Whether boolean input maps to zero or one.

    Returns:
        The finite float, or ``None`` for unsupported or non-finite input.
    """
    coerced: float | None = None
    if isinstance(value, bool):
        if accepts_bool:
            coerced = 1.0 if value else 0.0
    elif isinstance(value, (int, float, str)):
        try:
            coerced = float(value)
        except (OverflowError, ValueError):
            coerced = None
    if coerced is None or not math.isfinite(coerced):
        return None
    return coerced
